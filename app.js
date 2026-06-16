import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import prisma from "./prisma/client.js";
import path from "path";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import nodemailer from "nodemailer";
import cron from "node-cron";

const isProduction = process.env.NODE_ENV === "production";
const SESSION_COOKIE_NAME = "dearme.sid";
const USERID_REGEX = /^[a-zA-Z0-9]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 128;
const USERID_MAX_LENGTH = 20;
const NAME_MAX_LENGTH = 10;
const RECIPIENT_NAME_MAX_LENGTH = 50;
const LETTER_CONTENT_MAX_LENGTH = 500;
const LETTER_EMAIL_SUBJECT_MAX_LENGTH = 80;
const TEACHER_TITLE_MAX_LENGTH = 120;
const TEACHER_CONTENT_MAX_LENGTH = 10000;
const PUBLIC_LETTER_CONTENT_MAX_LENGTH = 100;
const PUBLIC_LETTER_NICKNAME_MAX_LENGTH = 12;
const PUBLIC_LETTER_PAGE_SIZE = 8;
const PUBLIC_LETTER_PIN_REGEX = /^\d{4}$/;
const SUPPORT_MESSAGE_CONTENT_MAX_LENGTH = 200;
const URL_MAX_LENGTH = 2048;
const MAIL_SEND_TIMEOUT_MS = Number(process.env.MAIL_SEND_TIMEOUT_MS || 20000);
const ALLOWED_LETTER_TYPES = new Set(["text", "video", "draw"]);
const ALLOWED_PUBLIC_LETTER_TYPES = new Set(["text", "draw", "photo"]);
const PUBLIC_LETTER_BLOCKED_WORDS = [
  "씨발", "시발", "ㅅㅂ", "병신", "ㅂㅅ", "좆", "지랄", "꺼져", "죽어",
  "sex", "porn", "fuck",
];
const IMAGE_CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const DEFAULT_TEACHER_LETTER_TITLE = "3214 장세은 개발자가 보낸 편지 💗";
const DEFAULT_TEACHER_LETTER_TITLE_ALIASES = ["000님의 앞길을 응원합니다", DEFAULT_TEACHER_LETTER_TITLE];
const DEFAULT_TEACHER_LETTER_TEACHER_NAME = "3214 장세은";
const TEACHER_TEST_EMAIL = process.env.TEACHER_TEST_EMAIL || "s2468@e-mirim.hs.kr";
const TEACHER_TEST_NAME = process.env.TEACHER_TEST_NAME || "장세은";
const DEFAULT_TEACHER_LETTER_CONTENT = `안녕하세요, 000님! Dear Me ; Dear You와 함께해 주셔서 진심으로 감사합니다.
살아가다 보면 감사함, 미안함, 후회, 위로처럼 참 다양한 감정을 느끼게 되는 것 같아요. 그런 감정들은 타인에게만 향하는 게 아니라, 때로는 자기 자신에게도 향하기도 하죠.
그 감정을 느끼고 돌아보는 것 자체가 이미 살아가는 과정이라고 생각해요. 그런 경험들을 하나씩 쌓아 가면서 우리는 조금 더 나다운 사람, 나를 존중하고 타인도 배려할 수 있는 사람으로 자라가는 게 아닐까요?
내가 나에게 작은 힘이 되어 준다면, 다시 앞으로 나아갈 용기도 생기고, 언젠가는 또 다른 누군가에게도 따뜻한 힘을 전할 수 있는 사람이 될 수 있을 거예요.
힘든 일이 생기더라도 자기 자신을 너무 미워하지 말고, 적어도 나에게는 떳떳한 사람으로 천천히 나아가 봐요. 000님이라면 분명 그렇게 하실 수 있을 거라 믿어요.
오늘 미림마이스터고등학교에서 좋은 작품 많이 보고 가시고, 앞으로의 삶에 행복한 일이 가득하길 바랍니다.
000님의 앞길을 응원하며, 감사합니다!`;

function envValue(primary, legacy) {
  return process.env[primary] || (legacy ? process.env[legacy] : undefined);
}

function stripTrailingSlash(value = "") {
  return value.replace(/\/+$/, "");
}

const r2BucketName = envValue("R2_BUCKET_NAME", "VITE_R2_BUCKET_NAME");
const r2PublicBaseUrl = stripTrailingSlash(envValue("R2_PUBLIC_URL", "VITE_R2_PUBLIC_URL") || "");
const r2Endpoint = envValue("R2_ENDPOINT", "VITE_R2_ENDPOINT");
const r2AccessKeyId = envValue("R2_ACCESS_KEY_ID", "VITE_R2_ACCESS_KEY_ID");
const r2SecretAccessKey = envValue("R2_SECRET_ACCESS_KEY", "VITE_R2_SECRET_ACCESS_KEY");
const scheduledEmailsEnabled = process.env.ENABLE_SCHEDULED_EMAILS !== "false";

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required in production.");
}
if (!isProduction && !process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not set. Using a development-only fallback secret.");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
});

// 이메일 전송 설정: Brevo API가 있으면 HTTPS API를 우선 사용하고, 없으면 Gmail SMTP를 사용한다.
const mailer = nodemailer.createTransport({
  service: "gmail",
  connectionTimeout: MAIL_SEND_TIMEOUT_MS,
  greetingTimeout: MAIL_SEND_TIMEOUT_MS,
  socketTimeout: MAIL_SEND_TIMEOUT_MS,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});
const brevoApiKey = process.env.BREVO_API_KEY;
const emailSenderName = process.env.EMAIL_SENDER_NAME || "Dear Me; Dear You";
const emailFromAddress = process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER;
const emailReplyTo = process.env.BREVO_REPLY_TO || process.env.GMAIL_USER || emailFromAddress;
const emailFromHeader = `"${emailSenderName}" <${emailFromAddress}>`;
const developerEmail = process.env.DEVELOPER_EMAIL || TEACHER_TEST_EMAIL;

function serializeMailError(err) {
  return {
    code: err?.code,
    responseCode: err?.responseCode,
    command: err?.command,
    message: err?.message || "unknown mail error",
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_REGEX.test(value);
}

function normalizePublicText(value = "") {
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasContactOrLink(value = "") {
  const text = String(value);
  return /https?:\/\/|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:\d[\s-]?){8,}/i.test(text);
}

function hasBlockedPublicLetterText(value = "") {
  const normalized = String(value).toLowerCase().replace(/\s+/g, "");
  return PUBLIC_LETTER_BLOCKED_WORDS.some(word => normalized.includes(word));
}

function validatePublicLetterText({ nickname, content }) {
  const combined = `${nickname}\n${content}`;
  if (hasContactOrLink(combined)) return "링크, 이메일, 전화번호는 열린 편지함에 남길 수 없습니다.";
  if (hasBlockedPublicLetterText(combined)) return "조금 더 다정한 말로 남겨주세요.";
  return null;
}

function validatePublicLetterPin(pin) {
  return PUBLIC_LETTER_PIN_REGEX.test(String(pin || ""));
}

function normalizeEmailTheme(value) {
  return String(value || "").trim().toLowerCase() === "pink" ? "pink" : "dark";
}

function mailHeader(value, maxLength = 180) {
  return String(value || "").replace(/[\r\n]+/g, " ").slice(0, maxLength);
}

function normalizeEmailSubject(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeout,
  ]);
}

function normalizeMailRecipients(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return values
    .map(item => String(item || "").trim())
    .filter(Boolean)
    .map(item => {
      const match = item.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
      const email = (match ? match[2] : item).trim().toLowerCase();
      const name = match?.[1]?.trim();
      return name ? { email, name } : { email };
    })
    .filter(item => isValidEmail(item.email));
}

function textToHtml(value = "") {
  return `<div style="white-space:pre-wrap;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.7">${escapeHtml(value)}</div>`;
}

function letterKindLabel(type) {
  if (type === "video") return "영상 편지";
  if (type === "draw") return "그림 편지";
  return "편지";
}

function plainArrivalLine({ type, isToOther, senderName }) {
  const kind = letterKindLabel(type);
  return isToOther
    ? `${senderName}님이 남긴 ${kind}가 도착했습니다.`
    : `나에게 남긴 ${kind}가 도착했습니다.`;
}

function htmlArrivalLine({ type, isToOther, safeSenderName }) {
  const kind = letterKindLabel(type);
  return isToOther
    ? `<strong>${safeSenderName}</strong>님이 남긴 ${kind}가 도착했습니다.`
    : `나에게 남긴 ${kind}가 도착했습니다.`;
}

function recipientArrivalSubject({ type, isToOther, senderName }) {
  const kind = letterKindLabel(type);
  return isToOther
    ? `${senderName}님의 ${kind}가 도착했습니다`
    : `나에게 남긴 ${kind}가 도착했습니다`;
}

async function sendBrevoMail(options) {
  if (!brevoApiKey || !isValidEmail(emailFromAddress)) {
    throw new Error("brevo config missing");
  }

  const recipients = normalizeMailRecipients(options.to);
  if (recipients.length === 0) {
    throw new Error("missing recipient email");
  }

  const payload = {
    sender: { name: emailSenderName, email: emailFromAddress },
    to: recipients,
    subject: options.subject,
    htmlContent: options.html || textToHtml(options.text || ""),
  };

  if (isValidEmail(emailReplyTo)) {
    payload.replyTo = { name: emailSenderName, email: emailReplyTo };
  }

  const response = await withTimeout(fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": brevoApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  }), MAIL_SEND_TIMEOUT_MS, "mail send timeout");

  const body = await response.text();
  if (!response.ok) {
    const err = new Error(body || `Brevo API error ${response.status}`);
    err.code = "BREVO_API_ERROR";
    err.responseCode = response.status;
    throw err;
  }

  return body ? JSON.parse(body) : {};
}

async function sendMail(options) {
  if (brevoApiKey) {
    return sendBrevoMail(options);
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error("mail config missing");
  }
  return withTimeout(mailer.sendMail(options), MAIL_SEND_TIMEOUT_MS, "mail send timeout");
}

function mailMessageId(result) {
  if (!result) return null;
  if (typeof result.messageId === "string") return result.messageId;
  if (Array.isArray(result.messageIds) && result.messageIds[0]) return result.messageIds[0];
  return null;
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상으로 입력해주세요.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 ${PASSWORD_MAX_LENGTH}자를 넘을 수 없습니다.`;
  }
  return null;
}

function parseOpenDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  return date;
}

function safeHttpUrl(value) {
  if (!value || String(value).length > URL_MAX_LENGTH) return null;
  try {
    const url = new URL(String(value).trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function originFromUrl(value) {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

function isPublicAssetUrl(value) {
  const safeUrl = safeHttpUrl(value);
  if (!safeUrl || !r2PublicBaseUrl) return false;

  try {
    const url = new URL(safeUrl);
    const baseUrl = new URL(r2PublicBaseUrl);
    if (url.origin !== baseUrl.origin) return false;

    const basePath = baseUrl.pathname.endsWith("/")
      ? baseUrl.pathname
      : `${baseUrl.pathname}/`;
    return baseUrl.pathname === "/" || url.pathname.startsWith(basePath);
  } catch {
    return false;
  }
}

function normalizePublicAssetUrl(value) {
  if (!value) return null;
  const safeUrl = safeHttpUrl(value);
  return safeUrl && isPublicAssetUrl(safeUrl) ? safeUrl : null;
}

function publicAssetUrl(key) {
  if (!r2PublicBaseUrl) return "";
  return `${r2PublicBaseUrl}/${key}`;
}

function makeObjectKey(folder, userId, extension) {
  return `${folder}/${userId}/${randomUUID()}.${extension}`;
}

async function verifyMailerConfig() {
  if (brevoApiKey) {
    if (!isValidEmail(emailFromAddress)) {
      console.warn("Brevo mail config missing: BREVO_SENDER_EMAIL or GMAIL_USER is required");
      return;
    }
    console.log("Brevo email API configured");
    return;
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("mail config missing: GMAIL_USER and GMAIL_APP_PASSWORD are required");
    return;
  }

  try {
    await mailer.verify();
    console.log("mail transporter ready");
  } catch (err) {
    console.error("mail transporter verify failed:", serializeMailError(err));
  }
}

verifyMailerConfig();

// 개봉일이 된 편지 이메일 발송
async function sendDueLetters({ authorId, letterId, force = false } = {}) {
  const now = new Date();
  const stats = {
    checked: 0,
    sent: 0,
    failed: 0,
    skippedNoEmail: 0,
    senderNotifyFailed: 0,
    accepted: [],
    errors: [],
  };

  try {
    const letters = await prisma.letter.findMany({
      where: {
        ...(letterId ? { id: letterId } : {}),
        ...(authorId ? { authorId } : {}),
        type: { not: "call" },
        sentAt: null,
        ...(!force ? { openDate: { lte: now } } : {}),
      },
      include: { author: true },
    });
    stats.checked = letters.length;

    for (const letter of letters) {
      // 관리자 지정 이메일이 있으면 우선 사용하고, 없으면 받는 사람/작성자 이메일로 발송한다.
      const email = letter.deliveryEmail || letter.recipientEmail || letter.author.email;
      if (!isValidEmail(email)) {
        stats.skippedNoEmail += 1;
        stats.errors.push({
          letterId: letter.id,
          reason: "missing_or_invalid_email",
          message: "발송할 이메일 주소가 없거나 형식이 올바르지 않습니다.",
        });
        continue;
      }

      const deliveredAt = new Date();
      const recipientName = letter.recipientName || letter.recipientEmail || letter.author.name;
      const senderName = letter.author.name;
      const isToOther = !!letter.recipientEmail;
      const isVideo = letter.type === "video";
      const isDraw = letter.type === "draw";
      const emailTheme = normalizeEmailTheme(letter.emailTheme);
      const emailSubject = normalizeEmailSubject(letter.emailSubject);
      const emailMeta = {
        emailSubject,
        recipientName,
        recipientEmail: email,
        senderName,
        senderEmail: letter.author.email,
        createdAt: letter.createdAt,
        deliveredAt,
        openDate: letter.openDate,
      };

      const html = isVideo
        ? buildVideoEmail(recipientName, senderName, letter.videoUrl, letter.openDate, isToOther, emailTheme, emailMeta)
        : isDraw
          ? buildDrawEmail(recipientName, senderName, letter.imageUrl, letter.openDate, isToOther, emailTheme, emailMeta)
          : buildTextEmail(recipientName, senderName, letter.content, letter.openDate, isToOther, letter.imageUrl, letter.signatureData, emailTheme, emailMeta);

      const metaText = buildLetterMetaText(emailMeta);

      const arrivalLine = plainArrivalLine({ type: letter.type, isToOther, senderName });
      const text = isVideo
        ? `안녕하세요, ${recipientName}님.\n${arrivalLine}\n\n${metaText}\n\n영상 보기: ${letter.videoUrl}`
        : isDraw
          ? `안녕하세요, ${recipientName}님.\n${arrivalLine}\n\n${metaText}\n\n그림 보기: ${letter.imageUrl}`
          : `안녕하세요, ${recipientName}님.\n${arrivalLine}\n\n${metaText}\n\n${letter.content}`;
      try {
        // 수신자에게 발송
        const recipientResult = await sendMail({
          from: emailFromHeader,
          replyTo: emailReplyTo,
          to: email,
          subject: mailHeader(emailSubject || recipientArrivalSubject({ type: letter.type, isToOther, senderName })),
          text,
          html,
        });

        await prisma.letter.update({
          where: { id: letter.id },
          data: { sentAt: deliveredAt, sentToEmail: email },
        });

        stats.sent += 1;
        stats.accepted.push({
          letterId: letter.id,
          to: email,
          messageId: mailMessageId(recipientResult),
        });
        console.log(`✉ 발송 요청 접수: ${email} (편지 #${letter.id}, messageId: ${mailMessageId(recipientResult) || "n/a"})`);

        // 타인에게 보내는 편지라면 발신자에게도 발송 알림. 이 알림 실패는 수신자 발송 성공을 취소하지 않는다.
        if (isToOther && isValidEmail(letter.author.email)) {
          try {
            const senderHtml = buildSenderNotifyEmail(senderName, recipientName, letter.openDate, emailTheme, emailMeta);
            await sendMail({
              from: emailFromHeader,
              replyTo: emailReplyTo,
              to: letter.author.email,
              subject: mailHeader(`${recipientName}에게 보낸 편지가 전달되었습니다`),
              text: `안녕하세요, ${senderName}님.\n${recipientName}에게 보낸 편지가 오늘 전달되었습니다.\n\n${metaText}`,
              html: senderHtml,
            });
          } catch (notifyErr) {
            stats.senderNotifyFailed += 1;
            stats.errors.push({
              letterId: letter.id,
              reason: "sender_notify_failed",
              message: "수신자 이메일 발송 요청은 접수됐지만 발신자 알림 메일은 실패했습니다.",
            });
            console.error(`✉ 발신자 알림 실패: ${letter.author.email}`, notifyErr.message);
          }
        }
      } catch (err) {
        stats.failed += 1;
        stats.errors.push({
          letterId: letter.id,
          reason: classifyMailError(err),
          code: err?.code || null,
          responseCode: err?.responseCode || null,
          message: publicMailErrorMessage(err),
        });
        console.error(`✉ 발송 실패: ${email}`, err.message);
      }
    }
  } catch (err) {
    console.error("sendDueLetters 오류:", err);
    stats.failed += 1;
    stats.errors.push({
      reason: "delivery_query_failed",
      message: "편지 발송 처리 중 서버 오류가 발생했습니다. 관리자에서 다시 발송해주세요.",
    });
  }

  return stats;
}

function classifyMailError(err) {
  if (err?.message === "brevo config missing") return "brevo_config_missing";
  if (err?.message === "missing recipient email") return "missing_or_invalid_email";
  if (err?.code === "BREVO_API_ERROR") return "brevo_api_failed";
  if (err?.message === "mail config missing") return "mail_config_missing";
  if (err?.message === "mail send timeout") return "mail_timeout";
  if (err?.code === "EAUTH" || err?.responseCode === 534 || err?.responseCode === 535) return "mail_auth_failed";
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET"].includes(err?.code)) return "mail_connection_failed";
  return "mail_send_failed";
}

function publicMailErrorMessage(err) {
  const reason = classifyMailError(err);
  if (reason === "brevo_config_missing") {
    return "Brevo 발송 설정이 없습니다. BREVO_API_KEY와 BREVO_SENDER_EMAIL을 확인해주세요.";
  }
  if (reason === "missing_or_invalid_email") {
    return "발송할 이메일 주소가 없거나 형식이 올바르지 않습니다.";
  }
  if (reason === "brevo_api_failed") {
    if (err?.responseCode === 401 || err?.responseCode === 403) {
      return "Brevo API 인증에 실패했습니다. Render의 BREVO_API_KEY를 확인해주세요.";
    }
    if (err?.responseCode === 400) {
      return "Brevo가 메일 요청을 거절했습니다. 발신자 이메일이 Brevo에 등록/인증되어 있는지 확인해주세요.";
    }
    return "Brevo 이메일 API 발송에 실패했습니다. Brevo 대시보드의 Transactional logs를 확인해주세요.";
  }
  if (reason === "mail_config_missing") {
    return "배포 서버에 GMAIL_USER 또는 GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.";
  }
  if (reason === "mail_auth_failed") {
    return "Gmail 인증에 실패했습니다. Render 환경변수의 Gmail 계정과 앱 비밀번호를 확인해주세요.";
  }
  if (reason === "mail_timeout") {
    return brevoApiKey
      ? "Brevo API 응답 시간이 초과됐습니다. 잠시 후 관리자에서 다시 발송해주세요."
      : "Gmail SMTP 응답 시간이 초과됐습니다. 잠시 후 관리자에서 다시 발송해주세요.";
  }
  if (reason === "mail_connection_failed") {
    return "배포 서버에서 Gmail SMTP에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
  return "Gmail SMTP 발송이 거절되었거나 일시 오류가 발생했습니다.";
}

function deliveryResultMessage(delivery) {
  if (!delivery) return "";
  if (delivery.sent > 0) return "이메일 발송 요청이 접수되었습니다. 받은편지함에 없으면 스팸함이나 프로모션함도 확인해주세요.";
  if (delivery.checked === 0) return "발송 대상 편지를 찾지 못했습니다. 관리자에서 편지 상태를 확인해주세요.";
  if (delivery.skippedNoEmail > 0) return "발송할 이메일 주소가 없거나 형식이 올바르지 않습니다.";
  if (delivery.errors?.[0]?.message) return delivery.errors[0].message;
  return "편지는 저장됐지만 이메일 발송은 실패했습니다. 관리자에서 다시 발송해주세요.";
}

function buildLegacySenderNotifyEmail(senderName, recipientName, openDate) {
  const safeSenderName = escapeHtml(senderName);
  const safeRecipientName = escapeHtml(recipientName);
  return `
  <div style="max-width:600px;margin:0 auto;background:#151f2e;color:#f0ebe0;font-family:sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a3a4d,#3d4b5a);padding:40px;text-align:center">
      <div style="font-size:13px;color:rgba(255,252,223,0.5);margin-bottom:10px">DEAR ME; DEAR YOU</div>
      <div style="font-size:26px;font-weight:300;color:#e9dcc6">편지가 전달되었습니다</div>
    </div>
    <div style="padding:36px 40px">
      <p style="font-size:16px;line-height:1.9;color:#d9cfc0">
        안녕하세요, <strong>${safeSenderName}</strong>님.<br><br>
        <strong>${safeRecipientName}</strong>님에게 보낸 편지가 오늘 전달되었습니다.<br>
        소중한 마음이 조용히 닿기를 바랍니다.
      </p>
    </div>
    <div style="padding:20px 40px 36px;text-align:center;color:rgba(255,252,223,0.3);font-size:12px">
      Dear Me; Dear You
    </div>
  </div>`;
}

function buildLegacyTextEmail(recipientName, senderName, content, openDate, isToOther, imageUrl, signatureData) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeContent = escapeHtml(content || "");
  const safeImageUrl = normalizePublicAssetUrl(imageUrl);
  const safeSignatureUrl = normalizePublicAssetUrl(signatureData);
  const headerMsg = htmlArrivalLine({ type: "text", isToOther, safeSenderName });
  return `
  <div style="max-width:600px;margin:0 auto;background:#151f2e;color:#f0ebe0;font-family:sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a3a4d,#3d4b5a);padding:40px;text-align:center">
      <div style="font-size:28px;font-weight:300;color:#cd9a63">Dear Me<span style="color:#fff;margin:0 8px">;</span><span style="color:#f0ebe0">Dear You</span></div>
      <div style="margin-top:8px;color:rgba(255,252,223,0.6);font-size:14px">${new Date(openDate).toLocaleDateString("ko-KR")} 개봉</div>
    </div>
    <div style="padding:40px">
      <p style="font-size:18px;color:#e9dcc6;margin-bottom:24px">안녕하세요, <strong>${safeRecipientName}</strong>님.<br>${headerMsg}</p>
      <div style="background:rgba(140,130,115,0.2);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:28px;font-size:16px;line-height:1.8;color:#fffcdf;white-space:pre-wrap">${safeContent}</div>
      ${safeImageUrl ? `<div style="margin-top:20px;text-align:center"><img src="${escapeHtml(safeImageUrl)}" style="max-width:100%;border-radius:10px" /></div>` : ''}
      ${safeSignatureUrl ? `<div style="margin-top:20px;text-align:right"><img src="${escapeHtml(safeSignatureUrl)}" style="max-height:80px" /></div>` : ''}
    </div>
    <div style="padding:20px 40px 40px;text-align:center;color:rgba(255,252,223,0.4);font-size:12px">Dear Me; Dear You</div>
  </div>`;
}

function buildLegacyDrawEmail(recipientName, senderName, imageUrl, openDate, isToOther) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeImageUrl = normalizePublicAssetUrl(imageUrl);
  const headerMsg = htmlArrivalLine({ type: "draw", isToOther, safeSenderName });
  return `
  <div style="max-width:600px;margin:0 auto;background:#151f2e;color:#f0ebe0;font-family:sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a3a4d,#3d4b5a);padding:40px;text-align:center">
      <div style="font-size:28px;font-weight:300;color:#cd9a63">Dear Me<span style="color:#fff;margin:0 8px">;</span><span style="color:#f0ebe0">Dear You</span></div>
      <div style="margin-top:8px;color:rgba(255,252,223,0.6);font-size:14px">${new Date(openDate).toLocaleDateString("ko-KR")} 개봉</div>
    </div>
    <div style="padding:40px">
      <p style="font-size:18px;color:#e9dcc6;margin-bottom:24px">안녕하세요, <strong>${safeRecipientName}</strong>님.<br>${headerMsg}</p>
      <div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
        ${safeImageUrl ? `<img src="${escapeHtml(safeImageUrl)}" style="width:100%;display:block" />` : `<div style="padding:24px;text-align:center;color:rgba(255,252,223,0.55)">그림 URL을 확인할 수 없습니다.</div>`}
      </div>
    </div>
    <div style="padding:20px 40px 40px;text-align:center;color:rgba(255,252,223,0.4);font-size:12px">Dear Me; Dear You</div>
  </div>`;
}

function buildLegacyVideoEmail(recipientName, senderName, videoUrl, openDate, isToOther) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeVideoUrl = normalizePublicAssetUrl(videoUrl);
  const headerMsg = htmlArrivalLine({ type: "video", isToOther, safeSenderName });
  return `
  <div style="max-width:600px;margin:0 auto;background:#151f2e;color:#f0ebe0;font-family:sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a3a4d,#3d4b5a);padding:40px;text-align:center">
      <div style="font-size:28px;font-weight:300;color:#cd9a63">Dear Me<span style="color:#fff;margin:0 8px">;</span><span style="color:#f0ebe0">Dear You</span></div>
      <div style="margin-top:8px;color:rgba(255,252,223,0.6);font-size:14px">${new Date(openDate).toLocaleDateString("ko-KR")} 개봉</div>
    </div>
    <div style="padding:40px;text-align:center">
      <p style="font-size:18px;color:#e9dcc6;margin-bottom:28px">안녕하세요, <strong>${safeRecipientName}</strong>님.<br>${headerMsg}</p>
      ${safeVideoUrl ? `<a href="${escapeHtml(safeVideoUrl)}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#e7cfa1,#cfa874);color:#2b1e10;border-radius:50px;text-decoration:none;font-size:18px;font-weight:600">영상 보기</a>` : `<p style="color:rgba(255,252,223,0.55)">영상 URL을 확인할 수 없습니다.</p>`}
    </div>
    <div style="padding:20px 40px 40px;text-align:center;color:rgba(255,252,223,0.4);font-size:12px">Dear Me; Dear You</div>
  </div>`;
}

function formatMailDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMailDateOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getLetterEmailTheme(theme) {
  if (normalizeEmailTheme(theme) === "pink") {
    return {
      name: "pink",
      outerBg: "linear-gradient(160deg,#3d2249 0%,#6b3a5a 20%,#8c5265 35%,#7a5878 55%,#4a4872 75%,#2e3560 90%,#1e2848 100%)",
      glowBg: "radial-gradient(ellipse 80% 40% at 15% 10%,rgba(220,160,180,0.18) 0%,transparent 60%),radial-gradient(ellipse 60% 50% at 85% 80%,rgba(160,120,200,0.14) 0%,transparent 60%)",
      panelBg: "rgba(20,10,35,0.52)",
      panelBorder: "rgba(255,180,210,0.2)",
      panelShadow: "0 30px 80px rgba(10,4,22,0.6),inset 0 1px 0 rgba(255,200,230,0.12)",
      headerBg: "rgba(255,255,255,0.025)",
      headerBorder: "rgba(255,175,205,0.1)",
      text: "rgba(248,228,238,0.95)",
      muted: "rgba(218,185,208,0.72)",
      soft: "rgba(218,188,208,0.78)",
      brandMain: "#f2c8da",
      brandMainShadow: "0 0 22px rgba(230,130,180,0.32),0 0 48px rgba(200,100,150,0.13)",
      brandSecond: "rgba(245,240,255,0.88)",
      brandSecondShadow: "0 0 20px rgba(225,218,255,0.22)",
      semicolon: "rgba(200,168,218,0.35)",
      star: "rgba(255,210,190,0.32)",
      rule: "linear-gradient(to right,transparent,rgba(210,150,185,0.38),transparent)",
      ruleShadow: "0 0 8px rgba(210,130,170,0.18)",
      cardBg: "rgba(10,4,22,0.38)",
      cardBorder: "rgba(220,162,192,0.15)",
      cardShadow: "inset 0 1px 0 rgba(240,188,218,0.06)",
      cardText: "rgba(248,228,236,0.97)",
      metaBorder: "rgba(255,175,205,0.1)",
      metaLabel: "rgba(200,168,218,0.52)",
      metaValue: "rgba(248,228,238,0.95)",
      signature: "rgba(202,172,218,0.58)",
      buttonBg: "linear-gradient(135deg,#f2c8da,#c8b7f0)",
      buttonText: "#24132d",
      footer: "rgba(188,158,208,0.28)",
      skyA: "rgba(255,235,210,0.55)",
      skyB: "rgba(240,220,255,0.48)",
    };
  }

  return {
    name: "dark",
    outerBg: "linear-gradient(180deg,#0a1018 0%,#0d1520 25%,#111c2a 50%,#1e1c14 75%,#2a2010 100%)",
    glowBg: "radial-gradient(ellipse 100% 45% at 50% 100%,rgba(150,110,50,0.28) 0%,transparent 65%),radial-gradient(ellipse 70% 35% at 30% 40%,rgba(15,35,60,0.5) 0%,transparent 70%)",
    panelBg: "rgba(8,12,22,0.58)",
    panelBorder: "rgba(190,185,220,0.14)",
    panelShadow: "0 30px 80px rgba(2,4,12,0.75),inset 0 1px 0 rgba(205,200,255,0.07)",
    headerBg: "rgba(255,255,255,0.018)",
    headerBorder: "rgba(185,180,220,0.1)",
    text: "rgba(232,228,250,0.92)",
    muted: "rgba(188,182,225,0.58)",
    soft: "rgba(188,182,225,0.62)",
    brandMain: "rgba(245,240,255,0.88)",
    brandMainShadow: "0 0 20px rgba(220,215,255,0.25)",
    brandSecond: "#eed28e",
    brandSecondShadow: "0 0 22px rgba(210,175,80,0.3),0 0 48px rgba(185,145,55,0.12)",
    semicolon: "rgba(185,178,220,0.3)",
    star: "rgba(205,200,240,0.28)",
    rule: "linear-gradient(to right,transparent,rgba(185,178,225,0.32),transparent)",
    ruleShadow: "none",
    cardBg: "rgba(5,7,16,0.52)",
    cardBorder: "rgba(178,172,218,0.13)",
    cardShadow: "inset 0 1px 0 rgba(200,195,250,0.05)",
    cardText: "rgba(232,228,248,0.95)",
    metaBorder: "rgba(182,176,220,0.1)",
    metaLabel: "rgba(172,165,210,0.48)",
    metaValue: "rgba(232,228,250,0.92)",
    signature: "rgba(178,170,215,0.52)",
    buttonBg: "linear-gradient(135deg,#eed28e,#b89958)",
    buttonText: "#16150f",
    footer: "rgba(172,165,210,0.26)",
    skyA: "rgba(210,215,240,0.55)",
    skyB: "rgba(205,210,238,0.42)",
  };
}

function buildLetterMetaText(meta = {}) {
  return [
    `보낸 날: ${formatMailDate(meta.createdAt)}`,
    `개봉일: ${formatMailDate(meta.openDate)}`,
  ].join("\n");
}

function formatMailPerson(name, email) {
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim();
  if (cleanName && cleanEmail && cleanName !== cleanEmail) return `${cleanName} (${cleanEmail})`;
  return cleanName || cleanEmail || "-";
}

function buildEmailStarField(themeStyles) {
  const a = themeStyles.skyA;
  const b = themeStyles.skyB;
  return `
  <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 700 700" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="28" r="0.7" fill="${a}"/><circle cx="158" cy="15" r="1.0" fill="${b}"/><circle cx="235" cy="68" r="0.5" fill="${a}"/><circle cx="325" cy="24" r="0.8" fill="${b}"/>
    <circle cx="418" cy="12" r="0.6" fill="${a}"/><circle cx="505" cy="55" r="1.1" fill="${b}"/><circle cx="582" cy="22" r="0.5" fill="${a}"/><circle cx="655" cy="78" r="0.8" fill="${b}"/>
    <circle cx="108" cy="148" r="1.0" fill="${b}"/><circle cx="245" cy="185" r="0.5" fill="${a}"/><circle cx="365" cy="148" r="0.7" fill="${b}"/><circle cx="472" cy="170" r="1.0" fill="${a}"/>
    <circle cx="188" cy="318" r="0.9" fill="${a}"/><circle cx="312" cy="268" r="0.6" fill="${b}"/><circle cx="428" cy="295" r="0.9" fill="${a}"/><circle cx="622" cy="302" r="0.7" fill="${b}"/>
  </svg>`;
}

function buildLetterMetaHtml(meta = {}, themeStyles) {
  const rows = [
    ["보낸 날", formatMailDateOnly(meta.createdAt)],
    ["개봉일", formatMailDateOnly(meta.openDate)],
    ["받는 사람", meta.recipientName || meta.recipientEmail],
  ];

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 24px">
      ${rows.map(([label, value], index) => `
        <tr>
          <td style="width:80px;padding:10px 0;${index < rows.length - 1 ? `border-bottom:1px solid ${themeStyles.metaBorder};` : ""}color:${themeStyles.metaLabel};font-size:12px;line-height:1.5;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:10px 0;${index < rows.length - 1 ? `border-bottom:1px solid ${themeStyles.metaBorder};` : ""}color:${themeStyles.metaValue || themeStyles.text};font-size:13px;line-height:1.5;word-break:break-word;vertical-align:top">${escapeHtml(value || "-")}</td>
        </tr>
      `).join("")}
    </table>`;
}

function buildEmailShell({ theme, openDate, subtitle, body, maxWidth = 620 }) {
  const themeStyles = getLetterEmailTheme(theme);
  const headerSubtitle = subtitle || "미래의 나에게 보내는 편지";
  return `
  <div style="padding:40px 16px 56px;background:${themeStyles.outerBg};font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;position:relative;overflow:hidden">
    <div style="position:absolute;inset:0;pointer-events:none;background:${themeStyles.glowBg}"></div>
    ${buildEmailStarField(themeStyles)}
    <div style="max-width:${maxWidth}px;margin:0 auto;position:relative;z-index:1;background:${themeStyles.panelBg};border:1px solid ${themeStyles.panelBorder};border-radius:28px;overflow:hidden;box-shadow:${themeStyles.panelShadow}">
      <div style="padding:44px 40px 32px;text-align:center;border-bottom:1px solid ${themeStyles.headerBorder};background:${themeStyles.headerBg}">
        <div style="margin-bottom:18px;color:${themeStyles.star};font-size:8px;letter-spacing:14px">✦ &nbsp; ✦ &nbsp; ✦</div>
        <div style="font-size:24px;font-weight:300;letter-spacing:0.05em;line-height:1">
          <span style="color:${themeStyles.brandMain};text-shadow:${themeStyles.brandMainShadow}">Dear Me</span>
          <span style="margin:0 9px;color:${themeStyles.semicolon};font-weight:300">;</span>
          <span style="color:${themeStyles.brandSecond};text-shadow:${themeStyles.brandSecondShadow}">Dear You</span>
        </div>
        <div style="margin-top:18px;font-size:13px;color:${themeStyles.muted};letter-spacing:0.03em;line-height:1.6">${escapeHtml(headerSubtitle)}</div>
        <div style="width:48px;height:1px;margin:18px auto 0;background:${themeStyles.rule};box-shadow:${themeStyles.ruleShadow}"></div>
      </div>
      ${body(themeStyles)}
      <div style="padding:0 40px 36px;text-align:center;font-size:11px;letter-spacing:0.12em;color:${themeStyles.footer}">Dear Me ; Dear You</div>
    </div>
  </div>`;
}

function buildSenderNotifyEmail(senderName, recipientName, openDate, emailTheme = "dark", meta = {}) {
  const safeSenderName = escapeHtml(senderName);
  const safeRecipientName = escapeHtml(recipientName);
  return buildEmailShell({
    theme: emailTheme,
    openDate,
    body: themeStyles => `
    <div style="padding:36px 40px 44px">
      <div style="font-size:14px;color:${themeStyles.soft};line-height:1.85;margin-bottom:28px">Dear Me; Dear You에서 보낸 편지 알림입니다.</div>
      ${buildLetterMetaHtml(meta, themeStyles)}
      <div style="padding:30px 32px;border:1px solid ${themeStyles.cardBorder};border-radius:16px;background:${themeStyles.cardBg};box-shadow:${themeStyles.cardShadow};color:${themeStyles.cardText};font-size:15px;line-height:2.1;white-space:pre-wrap">안녕하세요, ${safeSenderName}님.

${safeRecipientName}님에게 보낸 편지가 오늘 전달되었습니다.
소중한 마음이 조용히 도착했으니, 이제 마음 편히 놓아두셔도 괜찮습니다.</div>
    </div>`,
  });
}

function buildTextEmail(recipientName, senderName, content, openDate, isToOther, imageUrl, signatureData, emailTheme = "dark", meta = {}) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeContent = escapeHtml(content || "");
  const safeImageUrl = normalizePublicAssetUrl(imageUrl);
  const safeSignatureUrl = normalizePublicAssetUrl(signatureData);
  const headerMsg = htmlArrivalLine({ type: "text", isToOther, safeSenderName });

  return buildEmailShell({
    theme: emailTheme,
    openDate,
    subtitle: meta.emailSubject || undefined,
    body: themeStyles => `
    <div style="padding:36px 40px 44px">
      <div style="font-size:14px;color:${themeStyles.soft};line-height:1.85;margin-bottom:28px">Dear Me; Dear You에서 보낸 편지 알림입니다.</div>
      ${buildLetterMetaHtml(meta, themeStyles)}
      <div style="padding:30px 32px;border:1px solid ${themeStyles.cardBorder};border-radius:16px;background:${themeStyles.cardBg};box-shadow:${themeStyles.cardShadow};color:${themeStyles.cardText};font-size:15px;line-height:2.1;white-space:pre-wrap">${safeContent}</div>
      ${safeImageUrl ? `<div style="margin-top:20px;text-align:center"><img src="${escapeHtml(safeImageUrl)}" style="max-width:100%;border-radius:14px" /></div>` : ""}
      ${safeSignatureUrl ? `<div style="margin-top:20px;text-align:right"><img src="${escapeHtml(safeSignatureUrl)}" style="max-height:80px" /></div>` : ""}
      <div style="margin-top:20px;text-align:right;font-size:12.5px;color:${themeStyles.signature};line-height:1.75">${formatMailDateOnly(meta.createdAt)}의 ${safeSenderName}으로부터</div>
    </div>`,
  });
}

function buildDrawEmail(recipientName, senderName, imageUrl, openDate, isToOther, emailTheme = "dark", meta = {}) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeImageUrl = normalizePublicAssetUrl(imageUrl);
  const headerMsg = htmlArrivalLine({ type: "draw", isToOther, safeSenderName });

  return buildEmailShell({
    theme: emailTheme,
    openDate,
    subtitle: meta.emailSubject || undefined,
    body: themeStyles => `
    <div style="padding:36px 40px 44px">
      <div style="font-size:14px;color:${themeStyles.soft};line-height:1.85;margin-bottom:28px">Dear Me; Dear You에서 보낸 편지 알림입니다.</div>
      ${buildLetterMetaHtml(meta, themeStyles)}
      <div style="border-radius:16px;overflow:hidden;border:1px solid ${themeStyles.cardBorder};background:${themeStyles.cardBg}">
        ${safeImageUrl ? `<img src="${escapeHtml(safeImageUrl)}" style="width:100%;display:block" />` : `<div style="padding:24px;text-align:center;color:${themeStyles.muted}">그림 URL을 확인할 수 없습니다.</div>`}
      </div>
      <div style="margin-top:20px;text-align:right;font-size:12.5px;color:${themeStyles.signature};line-height:1.75">${formatMailDateOnly(meta.createdAt)}의 ${safeSenderName}으로부터</div>
    </div>`,
  });
}

function buildVideoEmail(recipientName, senderName, videoUrl, openDate, isToOther, emailTheme = "dark", meta = {}) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeVideoUrl = normalizePublicAssetUrl(videoUrl);
  const headerMsg = htmlArrivalLine({ type: "video", isToOther, safeSenderName });

  return buildEmailShell({
    theme: emailTheme,
    openDate,
    subtitle: meta.emailSubject || undefined,
    body: themeStyles => `
    <div style="padding:36px 40px 44px;text-align:center">
      <div style="text-align:left;font-size:14px;color:${themeStyles.soft};line-height:1.85;margin-bottom:28px">Dear Me; Dear You에서 보낸 편지 알림입니다.</div>
      <div style="text-align:left">${buildLetterMetaHtml(meta, themeStyles)}</div>
      ${safeVideoUrl ? `<a href="${escapeHtml(safeVideoUrl)}" style="display:inline-block;padding:16px 40px;background:${themeStyles.buttonBg};color:${themeStyles.buttonText};border-radius:50px;text-decoration:none;font-size:18px;font-weight:600">영상 보기</a>` : `<p style="color:${themeStyles.muted}">영상 URL을 확인할 수 없습니다.</p>`}
      <div style="margin-top:20px;text-align:right;font-size:12.5px;color:${themeStyles.signature};line-height:1.75">${formatMailDateOnly(meta.createdAt)}의 ${safeSenderName}으로부터</div>
    </div>`,
  });
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function pickBalancedTeacherLetter() {
  const teacherLetters = await prisma.teacherLetter.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { deliveries: true } } },
  });
  if (teacherLetters.length === 0) return null;

  const leastAssignedCount = Math.min(...teacherLetters.map(letter => letter._count.deliveries));
  const leastAssignedLetters = teacherLetters.filter(letter => letter._count.deliveries === leastAssignedCount);
  return pickRandom(leastAssignedLetters);
}

async function createBalancedTeacherDelivery(memberId) {
  const teacherLetter = await pickBalancedTeacherLetter();
  if (!teacherLetter) return null;

  return prisma.teacherLetterDelivery.create({
    data: {
      memberId,
      teacherLetterId: teacherLetter.id,
    },
    include: { member: true, teacherLetter: true },
  });
}

function personalizeTeacherText(value = "", memberName = "") {
  const safeName = String(memberName || "").trim() || "여러분";
  return String(value || "").replaceAll("000", safeName);
}

function personalizeTeacherLetterForMember(teacherLetter, memberName) {
  if (!teacherLetter) return teacherLetter;
  return {
    ...teacherLetter,
    title: teacherLetter.title ? personalizeTeacherText(teacherLetter.title, memberName) : teacherLetter.title,
    content: personalizeTeacherText(teacherLetter.content, memberName),
  };
}

function buildTeacherLetterEmail(memberName, teacherLetter) {
  const personalizedTeacherLetter = personalizeTeacherLetterForMember(teacherLetter, memberName);
  const rawTeacherName = String(personalizedTeacherLetter.teacherName || "").trim();
  const rawTitle = personalizedTeacherLetter.title || `${rawTeacherName || "선생님"}의 편지`;
  const teacherName = escapeHtml(rawTeacherName);
  const title = escapeHtml(rawTitle);
  const content = escapeHtml(personalizedTeacherLetter.content);

  return `
  <div style="box-sizing:border-box;width:100%;margin:0;padding:36px 0 46px;background:#20152e;background-image:linear-gradient(160deg,#20152e 0%,#35213b 28%,#49384d 52%,#30385a 76%,#1b2743 100%);font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;position:relative;overflow:hidden;color:#f6eaf1">
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 80% 42% at 16% 8%,rgba(221,145,184,0.16) 0%,transparent 62%),radial-gradient(ellipse 70% 54% at 88% 80%,rgba(126,147,210,0.13) 0%,transparent 64%);pointer-events:none"></div>
    <div style="box-sizing:border-box;width:88%;max-width:620px;margin:0 auto;position:relative;z-index:1;background:#21182f;border:1px solid rgba(237,208,228,0.18);border-radius:26px;overflow:hidden;box-shadow:0 28px 70px rgba(7,5,18,0.52),inset 0 1px 0 rgba(255,232,246,0.08)">
      <div style="padding:38px 28px 30px;text-align:center;border-bottom:1px solid rgba(237,208,228,0.1);background:#2b1f39">
        <div style="margin-bottom:18px;color:rgba(232,190,212,0.48);font-size:9px;line-height:1;letter-spacing:13px">***</div>
        <div style="font-size:28px;font-weight:300;letter-spacing:0.04em;line-height:1">
          <span style="color:#e3a9c2;text-shadow:0 0 14px rgba(227,169,194,0.18)">Dear Me</span>
          <span style="margin:0 10px;color:#fff6fb;font-weight:300;text-shadow:0 0 12px rgba(255,246,251,0.12)">;</span>
          <span style="color:#bcc8f4;text-shadow:0 0 14px rgba(188,200,244,0.16)">Dear You</span>
        </div>
        <div style="width:58px;height:1px;margin:24px auto 0;background:linear-gradient(to right,transparent,rgba(232,190,212,0.28),transparent);line-height:1px"></div>
      </div>
      <div style="padding:34px 28px 40px">
        <div style="font-size:16px;font-weight:400;color:#ead9e5;margin:0 0 20px;line-height:1.7;overflow-wrap:anywhere;word-break:break-all">${title}</div>
        <div style="box-sizing:border-box;width:100%;max-width:100%;padding:28px 26px;border:1px solid rgba(237,208,228,0.14);border-radius:16px;background:#2b2038;box-shadow:inset 0 1px 0 rgba(255,232,246,0.07);color:#f6eaf1;font-size:15px;line-height:2.08;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all">${content}</div>
        <div style="margin-top:20px;text-align:left;font-size:14px;color:#d7c2d2;line-height:1.75;overflow-wrap:anywhere;word-break:break-all">${teacherName || "선생님"}</div>
      </div>
      <div style="padding:0 40px 36px;text-align:center;font-size:11.5px;font-weight:300;letter-spacing:0.12em;color:rgba(214,190,210,0.28)">Dear Me; Dear You</div>
    </div>
  </div>`;
}

async function sendTeacherDelivery(delivery) {
  const member = delivery.member;
  const teacherLetter = delivery.teacherLetter;
  const personalizedTeacherLetter = personalizeTeacherLetterForMember(teacherLetter, member.name);

  if (!isValidEmail(member.email)) {
    await prisma.teacherLetterDelivery.update({
      where: { id: delivery.id },
      data: { lastError: "member has no valid email" },
    });
    return { sent: false, error: "member has no valid email" };
  }

  try {
    const teacherIntro = `${teacherLetter.teacherName}의 편지가 도착했습니다`;
    await sendMail({
      from: emailFromHeader,
      replyTo: emailReplyTo,
      to: member.email,
      subject: mailHeader(teacherIntro),
      text: `${teacherIntro}\n\n${personalizedTeacherLetter.content}`,
      html: buildTeacherLetterEmail(member.name, personalizedTeacherLetter),
    });

    await prisma.teacherLetterDelivery.update({
      where: { id: delivery.id },
      data: { sentAt: new Date(), lastError: null },
    });
    return { sent: true };
  } catch (err) {
    console.error("teacher letter email failed:", {
      deliveryId: delivery.id,
      memberId: member.id,
      ...serializeMailError(err),
    });
    await prisma.teacherLetterDelivery.update({
      where: { id: delivery.id },
      data: { lastError: err.message || "send failed" },
    });
    return { sent: false, error: err.message || "send failed" };
  }
}

async function assignRandomTeacherLetterToMember(memberId) {
  const existing = await prisma.teacherLetterDelivery.findUnique({ where: { memberId } });
  if (existing) return { created: false, sent: false, reason: "already assigned" };

  const delivery = await createBalancedTeacherDelivery(memberId);
  if (!delivery) return { created: false, sent: false, reason: "no active teacher letters" };

  const result = await sendTeacherDelivery(delivery);
  return { created: true, sent: result.sent, reason: result.error || null, teacherLetterId: delivery.teacherLetterId };
}

async function sendRandomTeacherLetters() {
  const activeTeacherLetterCount = await prisma.teacherLetter.count({ where: { active: true } });

  if (activeTeacherLetterCount === 0) {
    return { ok: false, message: "No active teacher letters", created: 0, retried: 0, sent: 0, failed: 0, skippedNoEmail: 0 };
  }

  const skippedNoEmail = await prisma.member.count({
    where: {
      lastLoginAt: { not: null },
      email: null,
      teacherLetterDeliveries: { none: {} },
    },
  });

  const retryDeliveries = await prisma.teacherLetterDelivery.findMany({
    where: {
      sentAt: null,
      member: { email: { not: null } },
    },
    include: { member: true, teacherLetter: true },
  });

  const members = await prisma.member.findMany({
    where: {
      lastLoginAt: { not: null },
      email: { not: null },
      teacherLetterDeliveries: { none: {} },
    },
    select: { id: true },
  });

  const newDeliveries = [];
  for (const member of members) {
    try {
      const delivery = await createBalancedTeacherDelivery(member.id);
      if (delivery) newDeliveries.push(delivery);
    } catch (err) {
      if (err.code !== "P2002") throw err;
    }
  }

  let sent = 0;
  let failed = 0;
  for (const delivery of [...retryDeliveries, ...newDeliveries]) {
    const result = await sendTeacherDelivery(delivery);
    if (result.sent) sent += 1;
    else failed += 1;
  }

  return {
    ok: true,
    created: newDeliveries.length,
    retried: retryDeliveries.length,
    sent,
    failed,
    skippedNoEmail,
  };
}

async function resendTeacherLetters() {
  const deliveries = await prisma.teacherLetterDelivery.findMany({
    where: {
      member: { email: { not: null } },
    },
    include: { member: true, teacherLetter: true },
  });

  const skippedNoEmail = await prisma.teacherLetterDelivery.count({
    where: {
      member: { email: null },
    },
  });

  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries) {
    const result = await sendTeacherDelivery(delivery);
    if (result.sent) sent += 1;
    else failed += 1;
  }

  return {
    ok: true,
    resent: deliveries.length,
    sent,
    failed,
    skippedNoEmail,
  };
}

if (scheduledEmailsEnabled) {
  cron.schedule("0 9 * * *", () => {
    console.log("📬 개봉일 편지 체크 중...");
    sendDueLetters();
  }, { timezone: "Asia/Seoul" });

  // 서버 시작 시 한 번 체크
  sendDueLetters();
} else {
  console.warn("scheduled email jobs disabled: ENABLE_SCHEDULED_EMAILS=false");
}

// ─────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 4000;
const PgSession = connectPgSimple(session);
const sessionPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
});

const r2EndpointOrigin = originFromUrl(r2Endpoint);
const r2PublicOrigin = originFromUrl(r2PublicBaseUrl);
const configuredAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
const devAllowedOrigins = isProduction
  ? []
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

function compactSources(sources) {
  return [...new Set(sources.filter(Boolean))];
}

function requestOrigin(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function allowedOriginsForRequest(req) {
  return new Set([
    requestOrigin(req),
    ...configuredAllowedOrigins,
    ...devAllowedOrigins,
  ]);
}

function sameOriginGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.get("origin");
  const referer = req.get("referer");
  const allowedOrigins = allowedOriginsForRequest(req);

  if (isProduction && !origin && !referer) {
    return res.status(403).json({ message: "요청 출처를 확인할 수 없습니다." });
  }

  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ message: "허용되지 않은 요청 출처입니다." });
  }

  if (!origin && referer) {
    const refererOrigin = originFromUrl(referer);
    if (!refererOrigin || !allowedOrigins.has(refererOrigin)) {
      return res.status(403).json({ message: "허용되지 않은 요청 출처입니다." });
    }
  }

  next();
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "object-src": ["'none'"],
      "frame-ancestors": ["'none'"],
      "form-action": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      "font-src": ["'self'", "data:", "https://cdn.jsdelivr.net"],
      "img-src": compactSources(["'self'", "data:", "blob:", r2PublicOrigin]),
      "media-src": compactSources(["'self'", "blob:", r2PublicOrigin]),
      "connect-src": compactSources(["'self'", r2EndpointOrigin, r2PublicOrigin, ...devAllowedOrigins]),
    },
  },
}));

app.use(sameOriginGuard);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "관리자 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
});

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
});

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "저장 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
});

const publicLetterLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "열린 편지는 잠시 후 다시 남겨주세요." },
});

const publicUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 24,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "이미지 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
});

function setNoStoreHeaders(res) {
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  };

  if (typeof res.set === "function") {
    res.set(headers);
    return;
  }

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith(".html")) {
    setNoStoreHeaders(res);
  }
  next();
});
app.use(express.static(path.resolve("client/dist"), {
  setHeaders(res, filePath) {
    if (filePath.endsWith("index.html")) {
      setNoStoreHeaders(res);
    }
  },
}));

app.use(session({
  store: new PgSession({
    pool: sessionPool,
    tableName: "user_sessions",
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || "development-only-session-secret",
  resave: false,
  saveUninitialized: false,
  name: SESSION_COOKIE_NAME,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
  }
}));

const privilegedUserids = new Set(["leejeahee", "jagseeun1"]);
const adminUserids = new Set(privilegedUserids);
const developerUserids = new Set(privilegedUserids);

function isAdminUser(user) {
  return !!user && adminUserids.has(user.userid);
}

function isDeveloperUser(user) {
  if (!user) return false;
  return developerUserids.has(user.userid);
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Login required" });
  if (!isAdminUser(req.session.user)) return res.status(403).json({ message: "Admin only" });
  next();
}

function requireDeveloper(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Login required" });
  if (!isDeveloperUser(req.session.user)) return res.status(403).json({ message: "Developer only" });
  next();
}

async function ensureDefaultTeacherLetter() {
  const adminUseridList = [...adminUserids];
  if (adminUseridList.length === 0) return;

  const author = await prisma.member.findFirst({
    where: { userid: { in: adminUseridList } },
    orderBy: { id: "asc" },
  });

  if (!author) {
    console.warn("default teacher letter skipped: no admin author found");
    return;
  }

  const existing = await prisma.teacherLetter.findFirst({
    where: {
      authorId: author.id,
      OR: [
        { title: { in: DEFAULT_TEACHER_LETTER_TITLE_ALIASES } },
        { content: { contains: "Dear Me ; Dear You와 함께해 주셔서" } },
      ],
    },
    orderBy: { id: "asc" },
  });

  const data = {
    title: DEFAULT_TEACHER_LETTER_TITLE,
    teacherName: DEFAULT_TEACHER_LETTER_TEACHER_NAME,
    content: DEFAULT_TEACHER_LETTER_CONTENT,
    active: true,
    authorId: author.id,
  };

  if (existing) {
    await prisma.teacherLetter.update({ where: { id: existing.id }, data });
    return;
  }

  await prisma.teacherLetter.create({ data });
}

// DB 연결 테스트
app.get("/db-test", requireAdmin, async (req, res) => {
  try { await prisma.$connect(); res.send("DB 연결 성공"); }
  catch (err) { res.status(500).send("DB 연결 실패"); }
});

// 1. 아이디 중복 확인
app.post("/check-username", authLimiter, async (req, res) => {
  const userid = String(req.body.userid || "").trim();
  if (!userid) return res.status(400).json({ available: false, message: "아이디를 입력해주세요." });
  if (userid.length > USERID_MAX_LENGTH) return res.status(400).json({ available: false, message: `아이디는 ${USERID_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (!USERID_REGEX.test(userid)) return res.status(400).json({ available: false, message: "영어와 숫자만 가능합니다." });
  try {
    const existing = await prisma.member.findUnique({ where: { userid } });
    if (existing) return res.status(400).json({ available: false, message: "이미 사용 중인 아이디입니다." });
    res.status(200).json({ available: true, message: "사용 가능한 아이디입니다." });
  } catch { res.status(500).json({ message: "서버 오류" }); }
});

// 2. 회원가입
app.post("/register", authLimiter, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const userid = String(req.body.userid || "").trim();
  const password = String(req.body.password || "");
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!name || !userid || !password || !email) return res.status(400).json({ message: "모든 값을 입력해주세요." });
  if (name.length > NAME_MAX_LENGTH) return res.status(400).json({ message: `이름은 ${NAME_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (userid.length > USERID_MAX_LENGTH) return res.status(400).json({ message: `아이디는 ${USERID_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (!USERID_REGEX.test(userid)) return res.status(400).json({ message: "아이디는 영어와 숫자만 사용할 수 있습니다." });
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ message: passwordError });
  if (!isValidEmail(email)) return res.status(400).json({ message: "이메일 형식이 올바르지 않습니다." });
  try {
    const existingEmail = await prisma.member.findUnique({ where: { email } });
    if (existingEmail) return res.status(400).json({ message: "이미 사용 중인 이메일입니다." });
    const hashedPassword = await bcrypt.hash(password, 10);
    const member = await prisma.member.create({ data: { name, userid, password: hashedPassword, email } });
    const teacherLetterResult = await assignRandomTeacherLetterToMember(member.id);
    if (!teacherLetterResult.sent) {
      console.warn("signup teacher letter not sent:", { memberId: member.id, reason: teacherLetterResult.reason });
    }
    res.status(201).json({ message: "회원가입 성공!" });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "이미 사용 중인 아이디 또는 이메일입니다." });
    console.error("register error:", err);
    res.status(400).json({ message: "회원가입 실패" });
  }
});

// 3. 로그인
app.post("/login", authLimiter, async (req, res) => {
  const userid = String(req.body.userid || "").trim();
  const password = String(req.body.password || "");
  const invalidLoginMessage = "아이디 또는 비밀번호가 올바르지 않습니다.";
  if (!userid || !password) return res.status(400).json({ message: "아이디와 비밀번호를 입력해주세요." });
  if (userid.length > USERID_MAX_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return res.status(401).json({ message: invalidLoginMessage });
  }
  try {
    const member = await prisma.member.findUnique({ where: { userid } });
    if (!member) return res.status(401).json({ message: invalidLoginMessage });
    const isMatch = await bcrypt.compare(password, member.password);
    if (!isMatch) return res.status(401).json({ message: invalidLoginMessage });
    await prisma.member.update({ where: { id: member.id }, data: { lastLoginAt: new Date() } });
    req.session.regenerate(err => {
      if (err) {
        console.error("session regenerate error:", err);
        return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다." });
      }

      req.session.user = { id: member.id, userid: member.userid, name: member.name, email: member.email || "" };
      req.session.save(saveErr => {
        if (saveErr) {
          console.error("session save error:", saveErr);
          return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다." });
        }
        res.status(200).json({ message: "로그인 성공", name: member.name });
      });
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 4. 유저 정보 (이름 + 이메일)
app.get("/get-user-info", (req, res) => {
  setNoStoreHeaders(res);
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });
  res.json({
    userid: req.session.user.userid,
    name: req.session.user.name,
    email: req.session.user.email || "",
    isAdmin: isAdminUser(req.session.user),
    isDeveloper: isDeveloperUser(req.session.user),
  });
});

app.get("/support-info", (_req, res) => {
  res.json({ developerEmail });
});

app.post("/support-messages", writeLimiter, async (req, res) => {
  const sessionUser = req.session.user || {};
  const content = normalizePublicText(req.body.content || "");

  if (!content) return res.status(400).json({ message: "남기고 싶은 마음을 입력해주세요." });
  if (content.length > SUPPORT_MESSAGE_CONTENT_MAX_LENGTH) {
    return res.status(400).json({ message: `남길 수 있는 글은 ${SUPPORT_MESSAGE_CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.` });
  }

  try {
    const message = await prisma.supportMessage.create({
      data: {
        name: sessionUser?.name || null,
        userid: sessionUser?.userid || null,
        email: sessionUser?.email || null,
        content,
      },
      select: {
        id: true,
        name: true,
        content: true,
        createdAt: true,
      },
    });
    res.status(201).json(message);
  } catch (err) {
    console.error("support message create error:", err);
    res.status(500).json({ message: "마음을 저장하지 못했습니다." });
  }
});

app.get("/developer/support-messages", requireDeveloper, async (_req, res) => {
  try {
    const messages = await prisma.supportMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        userid: true,
        email: true,
        content: true,
        createdAt: true,
      },
    });
    res.json(messages);
  } catch (err) {
    console.error("support message list error:", err);
    res.status(500).json({ message: "도착한 마음을 불러오지 못했습니다." });
  }
});

// 5. 로그아웃
app.get("/logout", (req, res) => {
  setNoStoreHeaders(res);
  req.session.destroy(() => {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    });
    res.redirect("/");
  });
});

// 6. 이메일 변경
app.put("/update-email", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ message: "이메일을 입력해주세요." });
  if (!isValidEmail(email)) return res.status(400).json({ message: "이메일 형식이 올바르지 않습니다." });
  try {
    const existingEmail = await prisma.member.findUnique({ where: { email } });
    if (existingEmail && existingEmail.id !== req.session.user.id) return res.status(400).json({ message: "이미 사용 중인 이메일입니다." });
    await prisma.member.update({ where: { id: req.session.user.id }, data: { email } });
    req.session.user.email = email;
    req.session.save(() => res.json({ message: "이메일이 변경되었습니다." }));
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "이미 사용 중인 이메일입니다." });
    res.status(500).json({ message: "서버 오류" });
  }
});

// 6-1. 이름/이메일 변경
app.put("/update-profile", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();

  if (!name) return res.status(400).json({ message: "이름을 입력해주세요." });
  if (name.length > NAME_MAX_LENGTH) return res.status(400).json({ message: `이름은 ${NAME_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ message: "이메일 형식이 올바르지 않습니다." });
  }

  try {
    if (email) {
      const existingEmail = await prisma.member.findUnique({ where: { email } });
      if (existingEmail && existingEmail.id !== req.session.user.id) return res.status(400).json({ message: "이미 사용 중인 이메일입니다." });
    }
    const updated = await prisma.member.update({
      where: { id: req.session.user.id },
      data: { name, email: email || null },
    });
    req.session.user.name = updated.name;
    req.session.user.email = updated.email || "";
    req.session.save(() => res.json({ message: "프로필이 변경되었습니다.", name: updated.name, email: updated.email || "" }));
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ message: "이미 사용 중인 이메일입니다." });
    res.status(500).json({ message: "서버 오류" });
  }
});

app.put("/change-password", authLimiter, async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });
  const currentPassword = String(req.body.currentPassword || "");
  const nextPassword = String(req.body.nextPassword || "");
  const nextPasswordConfirm = String(req.body.nextPasswordConfirm || "");
  if (!currentPassword || !nextPassword || !nextPasswordConfirm) return res.status(400).json({ message: "현재 비밀번호와 새 비밀번호를 입력해주세요." });
  if (nextPassword !== nextPasswordConfirm) return res.status(400).json({ message: "새 비밀번호가 서로 일치하지 않습니다." });
  if (currentPassword.length > PASSWORD_MAX_LENGTH) return res.status(400).json({ message: "현재 비밀번호가 올바르지 않습니다." });
  const passwordError = validatePassword(nextPassword);
  if (passwordError) return res.status(400).json({ message: passwordError });

  try {
    const member = await prisma.member.findUnique({ where: { id: req.session.user.id } });
    if (!member) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    const isMatch = await bcrypt.compare(currentPassword, member.password);
    if (!isMatch) return res.status(400).json({ message: "현재 비밀번호가 틀렸습니다." });
    if (currentPassword === nextPassword) return res.status(400).json({ message: "새 비밀번호는 현재 비밀번호와 다르게 입력해주세요." });

    const hashedPassword = await bcrypt.hash(nextPassword, 10);
    await prisma.member.update({ where: { id: member.id }, data: { password: hashedPassword } });
    res.json({ message: "비밀번호가 변경되었습니다." });
  } catch (err) {
    console.error("change password error:", err);
    res.status(500).json({ message: "비밀번호 변경에 실패했습니다." });
  }
});

// 7. 영상 업로드 presigned URL
app.get("/get-upload-url", uploadLimiter, async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인이 필요합니다." });
  if (!r2BucketName || !r2PublicBaseUrl || !r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey) {
    return res.status(500).json({ message: "업로드 설정이 완료되지 않았습니다." });
  }
  const fileName = makeObjectKey("videos", req.session.user.id, "webm");
  const command = new PutObjectCommand({ Bucket: r2BucketName, Key: fileName, ContentType: "video/webm" });
  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    res.json({ uploadUrl, publicUrl: publicAssetUrl(fileName) });
  } catch (err) { console.error(err); res.status(500).json({ message: "URL 발급 실패" }); }
});

// 8. 이미지 업로드 presigned URL
app.get("/get-image-upload-url", uploadLimiter, async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인이 필요합니다." });
  if (!r2BucketName || !r2PublicBaseUrl || !r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey) {
    return res.status(500).json({ message: "업로드 설정이 완료되지 않았습니다." });
  }
  const ext = String(req.query.ext || "jpg").toLowerCase();
  const contentType = IMAGE_CONTENT_TYPES[ext];
  if (!contentType) return res.status(400).json({ message: "지원하지 않는 이미지 형식입니다." });
  const fileName = makeObjectKey("images", req.session.user.id, ext);
  const command = new PutObjectCommand({ Bucket: r2BucketName, Key: fileName, ContentType: contentType });
  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    res.json({ uploadUrl, publicUrl: publicAssetUrl(fileName) });
  } catch (err) { console.error(err); res.status(500).json({ message: "URL 발급 실패" }); }
});

app.post("/public-image-upload-url", publicUploadLimiter, async (req, res) => {
  if (!r2BucketName || !r2PublicBaseUrl || !r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey) {
    return res.status(500).json({ message: "업로드 설정이 완료되지 않았습니다." });
  }
  const ext = String(req.body.ext || req.query.ext || "jpg").toLowerCase();
  const contentType = IMAGE_CONTENT_TYPES[ext];
  if (!contentType) return res.status(400).json({ message: "지원하지 않는 이미지 형식입니다." });
  const fileName = makeObjectKey("public-letters", "open", ext);
  const command = new PutObjectCommand({ Bucket: r2BucketName, Key: fileName, ContentType: contentType });
  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    res.json({ uploadUrl, publicUrl: publicAssetUrl(fileName) });
  } catch (err) {
    console.error("public image upload url error:", err);
    res.status(500).json({ message: "URL 발급 실패" });
  }
});

app.get("/public-letters", async (req, res) => {
  const requestedPage = Math.max(0, Number.parseInt(String(req.query.page || "0"), 10) || 0);
  try {
    const total = await prisma.publicLetter.count({ where: { visible: true } });
    const totalPages = Math.max(1, Math.ceil(total / PUBLIC_LETTER_PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages - 1);
    const skip = page * PUBLIC_LETTER_PAGE_SIZE;
    const letters = await prisma.publicLetter.findMany({
      where: { visible: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: PUBLIC_LETTER_PAGE_SIZE,
      select: {
        id: true,
        nickname: true,
        type: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ letters, total, page, pageSize: PUBLIC_LETTER_PAGE_SIZE });
  } catch (err) {
    console.error("public letter list error:", err);
    res.status(500).json({ message: "열린 편지를 불러오지 못했습니다." });
  }
});

app.post("/public-letters", publicLetterLimiter, async (req, res) => {
  const nickname = normalizePublicText(req.body.nickname || "");
  const type = String(req.body.type || "text").trim().toLowerCase();
  const content = normalizePublicText(req.body.content || "");
  const pin = String(req.body.pin || "");

  if (!nickname || nickname.length > PUBLIC_LETTER_NICKNAME_MAX_LENGTH) {
    return res.status(400).json({ message: `닉네임은 1-${PUBLIC_LETTER_NICKNAME_MAX_LENGTH}자로 입력해주세요.` });
  }
  if (!validatePublicLetterPin(pin)) {
    return res.status(400).json({ message: "수정/삭제에 사용할 4자리 PIN을 입력해주세요." });
  }
  if (!ALLOWED_PUBLIC_LETTER_TYPES.has(type)) {
    return res.status(400).json({ message: "지원하지 않는 열린 편지 형식입니다." });
  }
  if (content.length > PUBLIC_LETTER_CONTENT_MAX_LENGTH) {
    return res.status(400).json({ message: `내용은 ${PUBLIC_LETTER_CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.` });
  }
  if (type === "text" && !content) {
    return res.status(400).json({ message: "내용을 입력해주세요." });
  }

  const moderationError = validatePublicLetterText({ nickname, content });
  if (moderationError) return res.status(400).json({ message: moderationError });

  const imageUrl = type === "draw" || type === "photo" ? normalizePublicAssetUrl(req.body.imageUrl) : null;
  if ((type === "draw" || type === "photo") && !imageUrl) {
    return res.status(400).json({ message: "업로드된 이미지를 확인할 수 없습니다." });
  }

  try {
    const pinHash = await bcrypt.hash(pin, 10);
    const letter = await prisma.publicLetter.create({
      data: {
        nickname,
        type,
        content: content || null,
        imageUrl,
        pinHash,
      },
      select: {
        id: true,
        nickname: true,
        type: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.status(201).json(letter);
  } catch (err) {
    console.error("public letter create error:", err);
    res.status(500).json({ message: "열린 편지를 저장하지 못했습니다." });
  }
});

app.put("/public-letters/:id", publicLetterLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const nickname = normalizePublicText(req.body.nickname || "");
  const content = normalizePublicText(req.body.content || "");
  const pin = String(req.body.pin || "");

  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "잘못된 열린 편지입니다." });
  if (!nickname || nickname.length > PUBLIC_LETTER_NICKNAME_MAX_LENGTH) {
    return res.status(400).json({ message: `닉네임은 1-${PUBLIC_LETTER_NICKNAME_MAX_LENGTH}자로 입력해주세요.` });
  }
  if (!validatePublicLetterPin(pin)) return res.status(400).json({ message: "4자리 PIN을 입력해주세요." });
  if (content.length > PUBLIC_LETTER_CONTENT_MAX_LENGTH) {
    return res.status(400).json({ message: `내용은 ${PUBLIC_LETTER_CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.` });
  }

  const moderationError = validatePublicLetterText({ nickname, content });
  if (moderationError) return res.status(400).json({ message: moderationError });

  try {
    const existing = await prisma.publicLetter.findFirst({
      where: { id, visible: true },
      select: { id: true, type: true, pinHash: true },
    });
    if (!existing) return res.status(404).json({ message: "열린 편지를 찾을 수 없습니다." });
    if (!existing.pinHash) return res.status(403).json({ message: "이 편지는 PIN이 없어 관리자만 수정할 수 있습니다." });
    if (existing.type === "text" && !content) return res.status(400).json({ message: "내용을 입력해주세요." });

    const pinMatches = await bcrypt.compare(pin, existing.pinHash);
    if (!pinMatches) return res.status(403).json({ message: "PIN이 올바르지 않습니다." });

    const data = { nickname };
    if (existing.type === "text") {
      data.content = content;
    } else {
      data.content = null;
    }
    if (existing.type === "draw" && req.body.imageUrl !== undefined) {
      const imageUrl = normalizePublicAssetUrl(req.body.imageUrl);
      if (!imageUrl) return res.status(400).json({ message: "수정할 그림 이미지를 확인할 수 없습니다." });
      data.imageUrl = imageUrl;
    }

    const letter = await prisma.publicLetter.update({
      where: { id },
      data,
      select: {
        id: true,
        nickname: true,
        type: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(letter);
  } catch (err) {
    console.error("public letter update error:", err);
    res.status(500).json({ message: "열린 편지를 수정하지 못했습니다." });
  }
});

app.delete("/public-letters/:id", publicLetterLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const pin = String(req.body.pin || "");

  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "잘못된 열린 편지입니다." });
  if (!validatePublicLetterPin(pin)) return res.status(400).json({ message: "4자리 PIN을 입력해주세요." });

  try {
    const existing = await prisma.publicLetter.findFirst({
      where: { id, visible: true },
      select: { id: true, pinHash: true },
    });
    if (!existing) return res.status(404).json({ message: "열린 편지를 찾을 수 없습니다." });
    if (!existing.pinHash) return res.status(403).json({ message: "이 편지는 PIN이 없어 관리자만 삭제할 수 있습니다." });

    const pinMatches = await bcrypt.compare(pin, existing.pinHash);
    if (!pinMatches) return res.status(403).json({ message: "PIN이 올바르지 않습니다." });

    await prisma.publicLetter.update({ where: { id }, data: { visible: false } });
    res.json({ message: "열린 편지를 삭제했습니다." });
  } catch (err) {
    console.error("public letter delete error:", err);
    res.status(500).json({ message: "열린 편지를 삭제하지 못했습니다." });
  }
});

app.get("/letter-draft", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인이 필요합니다." });

  try {
    const draft = await prisma.letterDraft.findUnique({
      where: { authorId: req.session.user.id },
      select: {
        id: true,
        type: true,
        content: true,
        videoUrl: true,
        imageUrl: true,
        signatureData: true,
        deliveryEmail: true,
        emailSubject: true,
        emailTheme: true,
        recipientEmail: true,
        recipientName: true,
        toOther: true,
        openDate: true,
        updatedAt: true,
      },
    });
    res.json({ draft });
  } catch (err) {
    console.error("letter draft get error:", err);
    res.status(500).json({ message: "임시저장을 불러오지 못했습니다." });
  }
});

app.put("/letter-draft", writeLimiter, async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인이 필요합니다." });

  const type = String(req.body.type || "text").trim().toLowerCase();
  const content = typeof req.body.content === "string" ? req.body.content : "";
  const recipientEmail = String(req.body.recipientEmail || "").trim().toLowerCase();
  const recipientName = String(req.body.recipientName || "").trim();
  const emailSubject = normalizeEmailSubject(req.body.emailSubject);
  const emailTheme = normalizeEmailTheme(req.body.emailTheme);
  const toOther = Boolean(req.body.toOther);
  const parsedOpenDate = req.body.openDate ? parseOpenDate(req.body.openDate) : null;

  if (!ALLOWED_LETTER_TYPES.has(type)) return res.status(400).json({ message: "지원하지 않는 편지 형식입니다." });
  if (content.length > LETTER_CONTENT_MAX_LENGTH) return res.status(400).json({ message: `내용은 ${LETTER_CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (recipientEmail && !isValidEmail(recipientEmail)) return res.status(400).json({ message: "받는 사람 이메일 형식이 올바르지 않습니다." });
  if (recipientName.length > RECIPIENT_NAME_MAX_LENGTH) return res.status(400).json({ message: `받는 사람 이름은 ${RECIPIENT_NAME_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (emailSubject.length > LETTER_EMAIL_SUBJECT_MAX_LENGTH) return res.status(400).json({ message: `메일 제목은 ${LETTER_EMAIL_SUBJECT_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (req.body.openDate && !parsedOpenDate) return res.status(400).json({ message: "개봉일 형식이 올바르지 않습니다." });

  const videoUrl = req.body.videoUrl ? normalizePublicAssetUrl(req.body.videoUrl) : null;
  const imageUrl = req.body.imageUrl ? normalizePublicAssetUrl(req.body.imageUrl) : null;
  const signatureData = typeof req.body.signatureData === "string" ? req.body.signatureData : null;

  if (req.body.videoUrl && !videoUrl) return res.status(400).json({ message: "영상 URL을 확인할 수 없습니다." });
  if (req.body.imageUrl && !imageUrl) return res.status(400).json({ message: "이미지 URL을 확인할 수 없습니다." });
  if (signatureData && signatureData.length > 600000) return res.status(400).json({ message: "서명 데이터가 너무 큽니다." });

  try {
    const member = await prisma.member.findUnique({
      where: { id: req.session.user.id },
      select: { email: true },
    });
    const accountEmail = String(member?.email || req.session.user.email || "").trim().toLowerCase();
    const draftDeliveryEmail = toOther ? null : (accountEmail || null);

    const draft = await prisma.letterDraft.upsert({
      where: { authorId: req.session.user.id },
      create: {
        authorId: req.session.user.id,
        type,
        content: content || null,
        videoUrl,
        imageUrl,
        signatureData,
        deliveryEmail: draftDeliveryEmail,
        emailSubject: emailSubject || null,
        emailTheme,
        recipientEmail: toOther ? (recipientEmail || null) : null,
        recipientName: toOther ? (recipientName || null) : null,
        toOther,
        openDate: parsedOpenDate,
      },
      update: {
        type,
        content: content || null,
        videoUrl,
        imageUrl,
        signatureData,
        deliveryEmail: draftDeliveryEmail,
        emailSubject: emailSubject || null,
        emailTheme,
        recipientEmail: toOther ? (recipientEmail || null) : null,
        recipientName: toOther ? (recipientName || null) : null,
        toOther,
        openDate: parsedOpenDate,
      },
      select: {
        id: true,
        type: true,
        content: true,
        videoUrl: true,
        imageUrl: true,
        signatureData: true,
        deliveryEmail: true,
        emailSubject: true,
        emailTheme: true,
        recipientEmail: true,
        recipientName: true,
        toOther: true,
        openDate: true,
        updatedAt: true,
      },
    });
    res.json({ message: "임시저장했습니다.", draft });
  } catch (err) {
    console.error("letter draft save error:", err);
    res.status(500).json({ message: "임시저장에 실패했습니다." });
  }
});

app.delete("/letter-draft", writeLimiter, async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인이 필요합니다." });

  try {
    await prisma.letterDraft.deleteMany({ where: { authorId: req.session.user.id } });
    res.json({ message: "임시저장을 삭제했습니다." });
  } catch (err) {
    console.error("letter draft delete error:", err);
    res.status(500).json({ message: "임시저장을 삭제하지 못했습니다." });
  }
});

// 9. 편지 저장
app.post("/write-letter", writeLimiter, async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인이 필요합니다." });
  const type = String(req.body.type || "text");
  const content = typeof req.body.content === "string" ? req.body.content : "";
  const openDate = req.body.openDate;
  const recipientEmail = String(req.body.recipientEmail || "").trim().toLowerCase();
  const recipientName = String(req.body.recipientName || "").trim();
  const emailSubject = normalizeEmailSubject(req.body.emailSubject);
  const emailTheme = normalizeEmailTheme(req.body.emailTheme);
  const authorId = req.session.user.id;
  if (!ALLOWED_LETTER_TYPES.has(type)) return res.status(400).json({ message: "지원하지 않는 편지 형식입니다." });
  if (type === "text" && !content.trim()) return res.status(400).json({ message: "내용을 입력해주세요." });
  if (content.length > LETTER_CONTENT_MAX_LENGTH) return res.status(400).json({ message: `내용은 ${LETTER_CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.` });

  const cleanVideoUrl = type === "video" ? normalizePublicAssetUrl(req.body.videoUrl) : null;
  const cleanImageUrl = type === "draw" || (type === "text" && req.body.imageUrl)
    ? normalizePublicAssetUrl(req.body.imageUrl)
    : null;
  const cleanSignatureUrl = type === "text" && req.body.signatureData
    ? normalizePublicAssetUrl(req.body.signatureData)
    : null;

  if (type === "video" && !cleanVideoUrl) return res.status(400).json({ message: "업로드된 영상 URL을 확인할 수 없습니다." });
  if (type === "draw" && !cleanImageUrl) return res.status(400).json({ message: "업로드된 그림 URL을 확인할 수 없습니다." });
  if (type === "text" && req.body.imageUrl && !cleanImageUrl) return res.status(400).json({ message: "첨부 이미지 URL을 확인할 수 없습니다." });
  if (type === "text" && req.body.signatureData && !cleanSignatureUrl) return res.status(400).json({ message: "서명 이미지 URL을 확인할 수 없습니다." });

  const parsedOpenDate = parseOpenDate(openDate);
  if (!parsedOpenDate) return res.status(400).json({ message: "개봉일을 선택해주세요." });
  const maxOpenDate = new Date();
  maxOpenDate.setFullYear(maxOpenDate.getFullYear() + 100);
  if (parsedOpenDate > maxOpenDate) return res.status(400).json({ message: "개봉일은 100년 이내로 선택해주세요." });

  if (recipientName.length > RECIPIENT_NAME_MAX_LENGTH) return res.status(400).json({ message: `받는 사람 이름은 ${RECIPIENT_NAME_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (emailSubject.length > LETTER_EMAIL_SUBJECT_MAX_LENGTH) return res.status(400).json({ message: `메일 제목은 ${LETTER_EMAIL_SUBJECT_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (recipientName && !recipientEmail) return res.status(400).json({ message: "받는 사람 이메일을 입력해주세요." });
  if (recipientEmail && !isValidEmail(recipientEmail)) return res.status(400).json({ message: "받는 사람 이메일 형식이 올바르지 않습니다." });

  try {
    const member = await prisma.member.findUnique({
      where: { id: authorId },
      select: { email: true },
    });
    const accountEmail = String(member?.email || req.session.user.email || "").trim().toLowerCase();

    const letter = await prisma.letter.create({
      data: {
        type,
        content: type === "text" ? content : null,
        videoUrl: cleanVideoUrl,
        imageUrl: cleanImageUrl,
        signatureData: cleanSignatureUrl,
        deliveryEmail: recipientEmail || accountEmail || null,
        emailSubject: emailSubject || null,
        recipientEmail: recipientEmail || null,
        recipientName: recipientName || null,
        emailTheme,
        openDate: parsedOpenDate,
        authorId,
      }
    });
    await prisma.letterDraft.deleteMany({ where: { authorId } }).catch(err => {
      console.warn("letter draft cleanup failed:", err.message);
    });

    // 이미 개봉 가능한 날짜라면 현재 사용자의 편지만 즉시 발송한다.
    let delivery = null;
    if (parsedOpenDate <= new Date()) {
      delivery = await sendDueLetters({ letterId: letter.id, force: true });
      delivery.message = deliveryResultMessage(delivery);
    }
    res.status(201).json({ message: "편지 저장 성공!", delivery });
  } catch (err) {
    console.error("편지 저장 에러:", err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 10. 내 편지 목록
app.get("/my-letters", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });
  try {
    const now = new Date();
    const letters = await prisma.letter.findMany({
      where: { authorId: req.session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, type: true, content: true, videoUrl: true,
        imageUrl: true, signatureData: true,
        callReplyVideoUrl: true, callCompositeVideoUrl: true, callReplyEmail: true, callReplySentAt: true,
        recipientEmail: true, recipientName: true,
        emailTheme: true,
        favorite: true,
        openDate: true, createdAt: true,
      },
    });
    res.json(letters.map(letter => {
      const unlocked = new Date(letter.openDate) <= now;
      if (unlocked) return { ...letter, locked: false };
      return {
        ...letter,
        locked: true,
        content: null,
        videoUrl: null,
        imageUrl: null,
        signatureData: null,
        callReplyVideoUrl: null,
        callCompositeVideoUrl: null,
        callReplyEmail: null,
        callReplySentAt: null,
      };
    }));
  } catch { res.status(500).json({ message: "서버 오류" }); }
});

app.get("/received-letters", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });

  try {
    const member = await prisma.member.findUnique({
      where: { id: req.session.user.id },
      select: { email: true },
    });
    const recipientEmail = String(member?.email || req.session.user.email || "").trim().toLowerCase();
    if (recipientEmail && req.session.user.email !== recipientEmail) req.session.user.email = recipientEmail;
    if (!recipientEmail) return res.json([]);

    const now = new Date();
    const letters = await prisma.letter.findMany({
      where: {
        authorId: { not: req.session.user.id },
        type: { not: "call" },
        openDate: { lte: now },
        OR: [
          { recipientEmail },
          { deliveryEmail: recipientEmail },
        ],
      },
      orderBy: [
        { openDate: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true, type: true, content: true, videoUrl: true,
        imageUrl: true, signatureData: true,
        recipientEmail: true, recipientName: true, deliveryEmail: true,
        emailTheme: true,
        openDate: true, createdAt: true, sentAt: true,
        author: { select: { name: true } },
      },
    });

    res.json(letters.map(letter => {
      const unlocked = new Date(letter.openDate) <= now;
      const senderName = letter.author?.name || "누군가";
      const payload = {
        id: letter.id,
        type: letter.type,
        content: letter.content,
        videoUrl: letter.videoUrl,
        imageUrl: letter.imageUrl,
        signatureData: letter.signatureData,
        recipientEmail: letter.recipientEmail,
        recipientName: letter.recipientName,
        emailTheme: letter.emailTheme,
        openDate: letter.openDate,
        createdAt: letter.createdAt,
        sentAt: letter.sentAt,
        arrivedAt: letter.sentAt || letter.openDate,
        senderName,
        mailbox: "received",
        favorite: false,
      };

      if (unlocked) return { ...payload, locked: false };
      return {
        ...payload,
        locked: true,
        content: null,
        videoUrl: null,
        imageUrl: null,
        signatureData: null,
      };
    }));
  } catch (err) {
    console.error("received letters error:", err);
    res.status(500).json({ message: "받은 편지를 불러오지 못했습니다." });
  }
});

app.patch("/letters/:id/favorite", writeLimiter, async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });
  const id = Number(req.params.id);
  const favorite = Boolean(req.body.favorite);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "잘못된 편지입니다." });

  try {
    const letter = await prisma.letter.findUnique({ where: { id }, select: { id: true, authorId: true } });
    if (!letter) return res.status(404).json({ message: "편지를 찾을 수 없습니다." });
    if (letter.authorId !== req.session.user.id) return res.status(403).json({ message: "권한이 없습니다." });

    const updated = await prisma.letter.update({
      where: { id },
      data: { favorite },
      select: { id: true, favorite: true },
    });
    res.json(updated);
  } catch (err) {
    console.error("letter favorite error:", err);
    res.status(500).json({ message: "즐겨찾기를 변경하지 못했습니다." });
  }
});

// 11. 편지 삭제 (개봉 전 편지만)
app.delete("/delete-letter/:id", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "잘못된 요청" });
  try {
    const letter = await prisma.letter.findUnique({ where: { id } });
    if (!letter) return res.status(404).json({ message: "편지를 찾을 수 없습니다." });
    if (letter.authorId !== req.session.user.id) return res.status(403).json({ message: "권한이 없습니다." });
    if (new Date(letter.openDate) <= new Date()) return res.status(400).json({ message: "이미 개봉된 편지는 삭제할 수 없습니다." });
    await prisma.letter.delete({ where: { id } });
    res.json({ message: "편지가 삭제되었습니다." });
  } catch { res.status(500).json({ message: "서버 오류" }); }
});

// 개봉일 편지 즉시 발송 (테스트용)
app.post("/trigger-send", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });
  const result = await sendDueLetters({ authorId: req.session.user.id });
  res.json({ message: deliveryResultMessage(result) || "발송 요청이 접수되었습니다.", ...result });
});

app.post("/teacher-letters", requireAdmin, async (req, res) => {
  const title = String(req.body.title || "").trim();
  const teacherName = String(req.body.teacherName || "").trim();
  const content = String(req.body.content || "").trim();
  if (!content) return res.status(400).json({ message: "Teacher letter content is required" });
  if (title.length > TEACHER_TITLE_MAX_LENGTH) return res.status(400).json({ message: `제목은 ${TEACHER_TITLE_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (teacherName.length > NAME_MAX_LENGTH) return res.status(400).json({ message: `선생님 이름은 ${NAME_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (content.length > TEACHER_CONTENT_MAX_LENGTH) return res.status(400).json({ message: `편지 내용은 ${TEACHER_CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.` });

  try {
    const teacherLetter = await prisma.teacherLetter.create({
      data: {
        title: title || null,
        teacherName: teacherName || req.session.user.name,
        content,
        authorId: req.session.user.id,
      },
    });
    res.status(201).json(teacherLetter);
  } catch (err) {
    console.error("teacher letter create error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/teacher-letters", requireAdmin, async (req, res) => {

  try {
    const teacherLetters = await prisma.teacherLetter.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, userid: true } },
        _count: { select: { deliveries: true } },
      },
    });
    res.json(teacherLetters);
  } catch (err) {
    console.error("teacher letter list error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/teacher-letters/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const title = String(req.body.title || "").trim();
  const teacherName = String(req.body.teacherName || "").trim();
  const content = String(req.body.content || "").trim();

  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid teacher letter id" });
  if (!content) return res.status(400).json({ message: "Teacher letter content is required" });
  if (title.length > TEACHER_TITLE_MAX_LENGTH) return res.status(400).json({ message: `제목은 ${TEACHER_TITLE_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (teacherName.length > NAME_MAX_LENGTH) return res.status(400).json({ message: `선생님 이름은 ${NAME_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (content.length > TEACHER_CONTENT_MAX_LENGTH) return res.status(400).json({ message: `편지 내용은 ${TEACHER_CONTENT_MAX_LENGTH}자를 넘을 수 없습니다.` });

  try {
    const teacherLetter = await prisma.teacherLetter.update({
      where: { id },
      data: {
        title: title || null,
        teacherName: teacherName || req.session.user.name,
        content,
      },
      include: {
        author: { select: { id: true, name: true, userid: true } },
        _count: { select: { deliveries: true } },
      },
    });
    res.json(teacherLetter);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ message: "Teacher letter not found" });
    console.error("teacher letter update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/teacher-letters/:id/test-send", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid teacher letter id" });
  if (!isValidEmail(TEACHER_TEST_EMAIL)) return res.status(500).json({ message: "테스트 이메일 설정이 올바르지 않습니다." });

  try {
    const teacherLetter = await prisma.teacherLetter.findUnique({ where: { id } });
    if (!teacherLetter) return res.status(404).json({ message: "Teacher letter not found" });

    const testName = String(req.session.user?.name || TEACHER_TEST_NAME).trim() || TEACHER_TEST_NAME;
    const personalizedTeacherLetter = personalizeTeacherLetterForMember(teacherLetter, testName);
    const teacherIntro = `${teacherLetter.teacherName}의 편지가 도착했습니다`;

    await sendMail({
      from: emailFromHeader,
      replyTo: emailReplyTo,
      to: TEACHER_TEST_EMAIL,
      subject: mailHeader(`[테스트] ${teacherIntro}`),
      text: `[테스트 발송]\n받는 사람: ${testName} <${TEACHER_TEST_EMAIL}>\n\n${teacherIntro}\n\n${personalizedTeacherLetter.content}`,
      html: buildTeacherLetterEmail(testName, personalizedTeacherLetter),
    });

    res.json({ message: `테스트 이메일을 ${TEACHER_TEST_EMAIL}로 보냈습니다.`, email: TEACHER_TEST_EMAIL });
  } catch (err) {
    console.error("teacher letter test email error:", {
      teacherLetterId: id,
      to: TEACHER_TEST_EMAIL,
      ...serializeMailError(err),
    });
    res.status(500).json({ message: err.message || "테스트 이메일 발송 실패" });
  }
});

app.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await prisma.member.findMany({
      orderBy: { id: "desc" },
      select: {
        id: true,
        userid: true,
        name: true,
        email: true,
        lastLoginAt: true,
        _count: { select: { letters: true, teacherLetters: true } },
      },
    });
    res.json(users.map(user => ({ ...user, isCurrentUser: user.id === req.session.user.id })));
  } catch (err) {
    console.error("admin user list error:", err);
    res.status(500).json({ message: "사용자 목록을 불러오지 못했습니다." });
  }
});

app.get("/admin/public-letters", requireAdmin, async (req, res) => {
  try {
    const letters = await prisma.publicLetter.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        nickname: true,
        type: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        visible: true,
      },
    });
    res.json(letters);
  } catch (err) {
    console.error("admin public letter list error:", err);
    res.status(500).json({ message: "열린 편지함 목록을 불러오지 못했습니다." });
  }
});

app.patch("/admin/public-letters/:id/visible", adminLimiter, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const visible = Boolean(req.body.visible);
  if (!Number.isInteger(id)) return res.status(400).json({ message: "잘못된 열린 편지입니다." });

  try {
    const letter = await prisma.publicLetter.update({
      where: { id },
      data: { visible },
      select: {
        id: true,
        nickname: true,
        type: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        visible: true,
      },
    });
    res.json(letter);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ message: "열린 편지를 찾을 수 없습니다." });
    console.error("admin public letter visible error:", err);
    res.status(500).json({ message: "열린 편지 상태를 바꾸지 못했습니다." });
  }
});

app.delete("/admin/public-letters/:id", adminLimiter, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: "잘못된 열린 편지입니다." });

  try {
    await prisma.publicLetter.delete({ where: { id } });
    res.json({ message: "열린 편지를 삭제했습니다." });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ message: "열린 편지를 찾을 수 없습니다." });
    console.error("admin public letter delete error:", err);
    res.status(500).json({ message: "열린 편지를 삭제하지 못했습니다." });
  }
});

app.delete("/admin/users/:id", adminLimiter, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: "잘못된 사용자입니다." });
  if (id === req.session.user.id) return res.status(400).json({ message: "현재 로그인한 관리자 계정은 삭제할 수 없습니다." });

  try {
    const user = await prisma.member.findUnique({ where: { id }, select: { id: true, userid: true } });
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    await prisma.$transaction(async tx => {
      const authoredTeacherLetters = await tx.teacherLetter.findMany({
        where: { authorId: id },
        select: { id: true },
      });
      const authoredTeacherLetterIds = authoredTeacherLetters.map(letter => letter.id);

      if (authoredTeacherLetterIds.length > 0) {
        await tx.teacherLetterDelivery.deleteMany({
          where: { teacherLetterId: { in: authoredTeacherLetterIds } },
        });
        await tx.teacherLetter.deleteMany({ where: { id: { in: authoredTeacherLetterIds } } });
      }

      await tx.teacherLetterDelivery.deleteMany({ where: { memberId: id } });
      await tx.letter.deleteMany({ where: { authorId: id } });
      await tx.member.delete({ where: { id } });
    });

    res.json({ message: "사용자 계정을 삭제했습니다." });
  } catch (err) {
    console.error("admin user delete error:", err);
    res.status(500).json({ message: "사용자 삭제에 실패했습니다." });
  }
});

app.patch("/admin/users/:id/password", adminLimiter, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const nextPassword = String(req.body.nextPassword || "");
  if (!Number.isInteger(id)) return res.status(400).json({ message: "잘못된 사용자입니다." });
  if (id === req.session.user.id) return res.status(400).json({ message: "현재 로그인한 관리자 비밀번호는 여기서 변경할 수 없습니다." });
  if (!nextPassword) return res.status(400).json({ message: "새 비밀번호를 입력해주세요." });
  const passwordError = validatePassword(nextPassword);
  if (passwordError) return res.status(400).json({ message: passwordError });

  try {
    const user = await prisma.member.findUnique({ where: { id }, select: { id: true } });
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });

    const hashedPassword = await bcrypt.hash(nextPassword, 10);
    await prisma.member.update({ where: { id }, data: { password: hashedPassword } });
    res.json({ message: "사용자 비밀번호를 변경했습니다." });
  } catch (err) {
    console.error("admin password update error:", err);
    res.status(500).json({ message: "비밀번호 변경에 실패했습니다." });
  }
});

app.get("/admin/letters", requireAdmin, async (req, res) => {
  try {
    const letters = await prisma.letter.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        recipientName: true,
        recipientEmail: true,
        deliveryEmail: true,
        sentToEmail: true,
        emailTheme: true,
        openDate: true,
        createdAt: true,
        sentAt: true,
        author: { select: { id: true, userid: true, name: true, email: true } },
      },
    });
    res.json(letters);
  } catch (err) {
    console.error("admin letter list error:", err);
    res.status(500).json({ message: "편지 목록을 불러오지 못했습니다." });
  }
});

app.patch("/admin/letters/:id/open-date", adminLimiter, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { openDate } = req.body;
  if (!Number.isInteger(id)) return res.status(400).json({ message: "잘못된 편지입니다." });
  if (!openDate) return res.status(400).json({ message: "날짜를 입력해주세요." });

  const nextDate = new Date(openDate);
  if (Number.isNaN(nextDate.getTime())) return res.status(400).json({ message: "날짜 형식이 올바르지 않습니다." });

  try {
    const letter = await prisma.letter.update({
      where: { id },
      data: {
        openDate: nextDate,
        sentAt: null,
        sentToEmail: null,
      },
      select: {
        id: true,
        openDate: true,
        sentAt: true,
        sentToEmail: true,
      },
    });
    res.json({ message: "편지 날짜를 수정했습니다.", letter });
  } catch (err) {
    console.error("admin letter date update error:", err);
    res.status(500).json({ message: "편지 날짜 수정에 실패했습니다." });
  }
});

app.patch("/admin/letters/:id/delivery-email", adminLimiter, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const deliveryEmail = String(req.body.deliveryEmail || "").trim().toLowerCase();
  if (!Number.isInteger(id)) return res.status(400).json({ message: "잘못된 편지입니다." });
  if (deliveryEmail && !isValidEmail(deliveryEmail)) {
    return res.status(400).json({ message: "발송 이메일 형식이 올바르지 않습니다." });
  }

  try {
    const letter = await prisma.letter.update({
      where: { id },
      data: { deliveryEmail: deliveryEmail || null },
      select: {
        id: true,
        recipientEmail: true,
        deliveryEmail: true,
        sentToEmail: true,
        author: { select: { email: true } },
      },
    });
    res.json({ message: deliveryEmail ? "발송 이메일을 저장했습니다." : "발송 이메일 지정을 해제했습니다.", letter });
  } catch (err) {
    console.error("admin letter delivery email update error:", err);
    if (err.code === "P2025") return res.status(404).json({ message: "편지를 찾을 수 없습니다." });
    res.status(500).json({ message: "발송 이메일 저장에 실패했습니다." });
  }
});

app.post("/admin/letters/send-due", adminLimiter, requireAdmin, async (req, res) => {
  try {
    const result = await sendDueLetters();
    res.json({ message: deliveryResultMessage(result) || "개봉일이 지난 편지 발송 요청을 실행했습니다.", ...result });
  } catch (err) {
    console.error("admin due letter send error:", err);
    res.status(500).json({ message: "편지 발송에 실패했습니다." });
  }
});

app.post("/admin/letters/:id/send", adminLimiter, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: "잘못된 편지입니다." });

  try {
    const letter = await prisma.letter.findUnique({
      where: { id },
      select: { id: true, type: true, openDate: true, sentAt: true },
    });
    if (!letter) return res.status(404).json({ message: "편지를 찾을 수 없습니다." });
    if (letter.type === "call") return res.status(400).json({ message: "통화 편지는 메일 발송 대상이 아닙니다." });
    if (letter.sentAt) return res.status(400).json({ message: "이미 발송된 편지입니다." });
    const sendAt = new Date();
    if (letter.openDate > sendAt) {
      await prisma.letter.update({
        where: { id },
        data: { openDate: sendAt },
      });
    }

    const result = await sendDueLetters({ letterId: id });
    if (result.sent > 0) {
      return res.json({ message: deliveryResultMessage(result) || "편지 발송 요청이 접수되었습니다.", ...result });
    }
    const status = result.failed > 0 ? 500 : 400;
    res.status(status).json({ message: "발송할 수 있는 편지가 없거나 이메일이 없습니다.", ...result });
  } catch (err) {
    console.error("admin single letter send error:", err);
    res.status(500).json({ message: "편지 발송에 실패했습니다." });
  }
});

app.post("/teacher-letters/random-send", requireAdmin, async (req, res) => {

  try {
    const result = await sendRandomTeacherLetters();
    const status = result.ok ? 200 : 400;
    res.status(status).json(result);
  } catch (err) {
    console.error("teacher random send error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/teacher-letters/resend-all", requireAdmin, async (req, res) => {
  try {
    const result = await resendTeacherLetters();
    res.json(result);
  } catch (err) {
    console.error("teacher resend error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/my-teacher-letter", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Login required" });

  try {
    const delivery = await prisma.teacherLetterDelivery.findUnique({
      where: { memberId: req.session.user.id },
      include: { teacherLetter: true },
    });
    const personalizedDelivery = delivery
      ? {
          ...delivery,
          teacherLetter: personalizeTeacherLetterForMember(delivery.teacherLetter, req.session.user.name),
        }
      : null;
    res.json({ delivery: personalizedDelivery });
  } catch (err) {
    console.error("my teacher letter error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// SPA 라우팅
app.get("/{*splat}", (req, res) => {
  setNoStoreHeaders(res);
  res.sendFile(path.resolve("client/dist/index.html"));
});

ensureDefaultTeacherLetter()
  .catch(err => console.error("default teacher letter setup failed:", err))
  .finally(() => {
    app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
  });
