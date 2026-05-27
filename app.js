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
const LETTER_CONTENT_MAX_LENGTH = 5000;
const TEACHER_TITLE_MAX_LENGTH = 120;
const TEACHER_CONTENT_MAX_LENGTH = 10000;
const URL_MAX_LENGTH = 2048;
const ALLOWED_LETTER_TYPES = new Set(["text", "video", "draw"]);
const IMAGE_CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

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

// 이메일 전송 설정 (Gmail SMTP)
const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});
const emailFromAddress = process.env.EMAIL_FROM || process.env.GMAIL_USER;
const emailReplyTo = process.env.EMAIL_REPLY_TO || emailFromAddress;
const emailFromHeader = `"Dear Me; Dear You" <${emailFromAddress}>`;

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

function mailHeader(value, maxLength = 180) {
  return String(value || "").replace(/[\r\n]+/g, " ").slice(0, maxLength);
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
async function sendDueLetters({ authorId } = {}) {
  const now = new Date();
  const stats = { sent: 0, failed: 0, skippedNoEmail: 0 };

  try {
    const letters = await prisma.letter.findMany({
      where: {
        ...(authorId ? { authorId } : {}),
        type: { not: "call" },
        sentAt: null,
        openDate: { lte: now },
      },
      include: { author: true },
    });

    for (const letter of letters) {
      // 타인에게 보내는 편지면 recipientEmail, 아니면 author.email
      const email = letter.recipientEmail || letter.author.email;
      if (!isValidEmail(email)) {
        stats.skippedNoEmail += 1;
        continue;
      }

      const recipientName = letter.recipientName || letter.author.name;
      const senderName = letter.author.name;
      const isToOther = !!letter.recipientEmail;
      const isVideo = letter.type === "video";
      const isDraw = letter.type === "draw";

      const html = isVideo
        ? buildVideoEmail(recipientName, senderName, letter.videoUrl, letter.openDate, isToOther)
        : isDraw
          ? buildDrawEmail(recipientName, senderName, letter.imageUrl, letter.openDate, isToOther)
          : buildTextEmail(recipientName, senderName, letter.content, letter.openDate, isToOther, letter.imageUrl, letter.signatureData);

      const text = isVideo
        ? `안녕, ${recipientName}.\n${isToOther ? senderName + '이(가) 보낸' : '과거의 네가 보낸'} 영상 편지야.\n\n영상 보기: ${letter.videoUrl}`
        : isDraw
          ? `안녕, ${recipientName}.\n${isToOther ? senderName + '이(가) 보낸' : '과거의 네가 보낸'} 그림 편지야.\n\n그림 보기: ${letter.imageUrl}`
          : `안녕, ${recipientName}.\n${isToOther ? senderName + '이(가) 보낸' : '과거의 네가 보낸'} 편지야.\n\n${letter.content}`;

      try {
        // 수신자에게 발송
        await mailer.sendMail({
          from: emailFromHeader,
          replyTo: emailReplyTo,
          to: email,
          subject: mailHeader(isToOther
            ? `${senderName}이(가) 보낸 편지가 도착했어요`
            : "과거의 내가 보낸 편지가 도착했어요"),
          text,
          html,
        });

        // 타인에게 보내는 편지라면 발신자에게도 발송 알림
        if (isToOther && isValidEmail(letter.author.email)) {
          const senderHtml = buildSenderNotifyEmail(senderName, recipientName, letter.openDate);
          await mailer.sendMail({
            from: emailFromHeader,
            replyTo: emailReplyTo,
            to: letter.author.email,
            subject: mailHeader(`${recipientName}에게 보낸 편지가 전달되었어요`),
            text: `안녕, ${senderName}.\n네가 ${recipientName}에게 보낸 편지가 오늘 전달되었어.`,
            html: senderHtml,
          });
        }

        await prisma.letter.update({
          where: { id: letter.id },
          data: { sentAt: new Date() },
        });

        stats.sent += 1;
        console.log(`✉ 발송 완료: ${email} (편지 #${letter.id})`);
      } catch (err) {
        stats.failed += 1;
        console.error(`✉ 발송 실패: ${email}`, err.message);
      }
    }
  } catch (err) {
    console.error("sendDueLetters 오류:", err);
    stats.failed += 1;
  }

  return stats;
}

function buildSenderNotifyEmail(senderName, recipientName, openDate) {
  const safeSenderName = escapeHtml(senderName);
  const safeRecipientName = escapeHtml(recipientName);
  return `
  <div style="max-width:600px;margin:0 auto;background:#151f2e;color:#f0ebe0;font-family:sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a3a4d,#3d4b5a);padding:40px;text-align:center">
      <div style="font-size:13px;letter-spacing:3px;color:rgba(255,252,223,0.5);margin-bottom:10px">DEAR ME; DEAR YOU</div>
      <div style="font-size:26px;font-weight:300;color:#e9dcc6">편지가 전달되었어요 ✉</div>
    </div>
    <div style="padding:36px 40px">
      <p style="font-size:16px;line-height:1.9;color:#d9cfc0">
        안녕, <strong>${safeSenderName}</strong>.<br><br>
        네가 <strong>${safeRecipientName}</strong>에게 보낸 편지가 오늘 잘 전달되었어.<br>
        소중한 마음이 닿았길 바라.
      </p>
    </div>
    <div style="padding:20px 40px 36px;text-align:center;color:rgba(255,252,223,0.3);font-size:12px">
      Dear Me; Dear You
    </div>
  </div>`;
}

function buildTextEmail(recipientName, senderName, content, openDate, isToOther, imageUrl, signatureData) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeContent = escapeHtml(content || "");
  const safeImageUrl = normalizePublicAssetUrl(imageUrl);
  const safeSignatureUrl = normalizePublicAssetUrl(signatureData);
  const headerMsg = isToOther
    ? `<strong>${safeSenderName}</strong>이(가) 보낸 편지야.`
    : `과거의 네가 보낸 편지야.`;
  return `
  <div style="max-width:600px;margin:0 auto;background:#151f2e;color:#f0ebe0;font-family:sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a3a4d,#3d4b5a);padding:40px;text-align:center">
      <div style="font-size:28px;font-weight:300;color:#cd9a63">Dear Me<span style="color:#fff;margin:0 8px">;</span><span style="color:#f0ebe0">Dear You</span></div>
      <div style="margin-top:8px;color:rgba(255,252,223,0.6);font-size:14px">${new Date(openDate).toLocaleDateString("ko-KR")} 개봉</div>
    </div>
    <div style="padding:40px">
      <p style="font-size:18px;color:#e9dcc6;margin-bottom:24px">안녕, <strong>${safeRecipientName}</strong>.<br>${headerMsg}</p>
      <div style="background:rgba(140,130,115,0.2);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:28px;font-size:16px;line-height:1.8;color:#fffcdf;white-space:pre-wrap">${safeContent}</div>
      ${safeImageUrl ? `<div style="margin-top:20px;text-align:center"><img src="${escapeHtml(safeImageUrl)}" style="max-width:100%;border-radius:10px" /></div>` : ''}
      ${safeSignatureUrl ? `<div style="margin-top:20px;text-align:right"><img src="${escapeHtml(safeSignatureUrl)}" style="max-height:80px" /></div>` : ''}
    </div>
    <div style="padding:20px 40px 40px;text-align:center;color:rgba(255,252,223,0.4);font-size:12px">Dear Me; Dear You</div>
  </div>`;
}

function buildDrawEmail(recipientName, senderName, imageUrl, openDate, isToOther) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeImageUrl = normalizePublicAssetUrl(imageUrl);
  const headerMsg = isToOther
    ? `<strong>${safeSenderName}</strong>이(가) 보낸 그림 편지야.`
    : `과거의 네가 그린 그림 편지야.`;
  return `
  <div style="max-width:600px;margin:0 auto;background:#151f2e;color:#f0ebe0;font-family:sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a3a4d,#3d4b5a);padding:40px;text-align:center">
      <div style="font-size:28px;font-weight:300;color:#cd9a63">Dear Me<span style="color:#fff;margin:0 8px">;</span><span style="color:#f0ebe0">Dear You</span></div>
      <div style="margin-top:8px;color:rgba(255,252,223,0.6);font-size:14px">${new Date(openDate).toLocaleDateString("ko-KR")} 개봉</div>
    </div>
    <div style="padding:40px">
      <p style="font-size:18px;color:#e9dcc6;margin-bottom:24px">안녕, <strong>${safeRecipientName}</strong>.<br>${headerMsg}</p>
      <div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
        ${safeImageUrl ? `<img src="${escapeHtml(safeImageUrl)}" style="width:100%;display:block" />` : `<div style="padding:24px;text-align:center;color:rgba(255,252,223,0.55)">그림 URL을 확인할 수 없습니다.</div>`}
      </div>
    </div>
    <div style="padding:20px 40px 40px;text-align:center;color:rgba(255,252,223,0.4);font-size:12px">Dear Me; Dear You</div>
  </div>`;
}

function buildVideoEmail(recipientName, senderName, videoUrl, openDate, isToOther) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeVideoUrl = normalizePublicAssetUrl(videoUrl);
  const headerMsg = isToOther
    ? `<strong>${safeSenderName}</strong>이(가) 보낸 영상 편지야.`
    : `과거의 네가 보낸 영상 편지야.`;
  return `
  <div style="max-width:600px;margin:0 auto;background:#151f2e;color:#f0ebe0;font-family:sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a3a4d,#3d4b5a);padding:40px;text-align:center">
      <div style="font-size:28px;font-weight:300;color:#cd9a63">Dear Me<span style="color:#fff;margin:0 8px">;</span><span style="color:#f0ebe0">Dear You</span></div>
      <div style="margin-top:8px;color:rgba(255,252,223,0.6);font-size:14px">${new Date(openDate).toLocaleDateString("ko-KR")} 개봉</div>
    </div>
    <div style="padding:40px;text-align:center">
      <p style="font-size:18px;color:#e9dcc6;margin-bottom:28px">안녕, <strong>${safeRecipientName}</strong>.<br>${headerMsg}</p>
      ${safeVideoUrl ? `<a href="${escapeHtml(safeVideoUrl)}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#e7cfa1,#cfa874);color:#2b1e10;border-radius:50px;text-decoration:none;font-size:18px;font-weight:600">영상 보기</a>
      <p style="margin-top:20px;color:rgba(255,252,223,0.4);font-size:12px">버튼이 작동하지 않으면: ${escapeHtml(safeVideoUrl)}</p>` : `<p style="color:rgba(255,252,223,0.55)">영상 URL을 확인할 수 없습니다.</p>`}
    </div>
    <div style="padding:20px 40px 40px;text-align:center;color:rgba(255,252,223,0.4);font-size:12px">Dear Me; Dear You</div>
  </div>`;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildTeacherLetterEmail(memberName, teacherLetter) {
  const teacherName = escapeHtml(teacherLetter.teacherName);
  const title = teacherLetter.title ? escapeHtml(teacherLetter.title) : `${escapeHtml(memberName)}님을 응원하는 ${teacherName}께서 편지를 보냈습니다!`;
  const content = escapeHtml(teacherLetter.content);
  const safeMemberName = escapeHtml(memberName);
  const intro = `${safeMemberName}님을 응원하는 ${teacherName}께서 편지를 보냈습니다!`;

  return `
  <div style="max-width:600px;margin:0 auto;background:#151f2e;color:#f0ebe0;font-family:sans-serif;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a3a4d,#3d4b5a);padding:40px;text-align:center">
      <div style="font-size:13px;letter-spacing:3px;color:rgba(255,252,223,0.5);margin-bottom:10px">DEAR ME; DEAR YOU</div>
      <div style="font-size:26px;font-weight:300;color:#e9dcc6">${title}</div>
      <div style="margin-top:10px;color:rgba(255,252,223,0.6);font-size:14px">${teacherName}</div>
    </div>
    <div style="padding:40px">
      <p style="font-size:18px;color:#e9dcc6;margin-bottom:24px">${intro}</p>
      <div style="background:rgba(140,130,115,0.2);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:28px;font-size:16px;line-height:1.8;color:#fffcdf;white-space:pre-wrap">${content}</div>
    </div>
    <div style="padding:20px 40px 40px;text-align:center;color:rgba(255,252,223,0.4);font-size:12px">Dear Me; Dear You</div>
  </div>`;
}

async function sendTeacherDelivery(delivery) {
  const member = delivery.member;
  const teacherLetter = delivery.teacherLetter;

  if (!isValidEmail(member.email)) {
    await prisma.teacherLetterDelivery.update({
      where: { id: delivery.id },
      data: { lastError: "member has no valid email" },
    });
    return { sent: false, error: "member has no valid email" };
  }

  try {
    const teacherIntro = `${member.name}님을 응원하는 ${teacherLetter.teacherName}께서 편지를 보냈습니다!`;
    await mailer.sendMail({
      from: emailFromHeader,
      replyTo: emailReplyTo,
      to: member.email,
      subject: mailHeader(teacherIntro),
      text: `${teacherIntro}\n\n${teacherLetter.content}`,
      html: buildTeacherLetterEmail(member.name, teacherLetter),
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

  const teacherLetters = await prisma.teacherLetter.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (teacherLetters.length === 0) return { created: false, sent: false, reason: "no active teacher letters" };

  const teacherLetter = pickRandom(teacherLetters);
  const delivery = await prisma.teacherLetterDelivery.create({
    data: {
      memberId,
      teacherLetterId: teacherLetter.id,
    },
    include: { member: true, teacherLetter: true },
  });

  const result = await sendTeacherDelivery(delivery);
  return { created: true, sent: result.sent, reason: result.error || null };
}

async function sendRandomTeacherLetters() {
  const teacherLetters = await prisma.teacherLetter.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (teacherLetters.length === 0) {
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
    const teacherLetter = pickRandom(teacherLetters);
    try {
      const delivery = await prisma.teacherLetterDelivery.create({
        data: {
          memberId: member.id,
          teacherLetterId: teacherLetter.id,
        },
        include: { member: true, teacherLetter: true },
      });
      newDeliveries.push(delivery);
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

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith(".html")) {
    res.set("Cache-Control", "no-store");
  }
  next();
});
app.use(express.static(path.resolve("client/dist"), {
  setHeaders(res, filePath) {
    if (filePath.endsWith("index.html")) {
      res.set("Cache-Control", "no-store");
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

const adminUserids = new Set(
  (process.env.ADMIN_USERIDS || process.env.ADMIN_USERID || "")
    .split(",")
    .map(userid => userid.trim())
    .filter(Boolean)
);

function isAdminUser(user) {
  return !!user && adminUserids.has(user.userid);
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Login required" });
  if (!isAdminUser(req.session.user)) return res.status(403).json({ message: "Admin only" });
  next();
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
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });
  res.json({ name: req.session.user.name, email: req.session.user.email || "", isAdmin: isAdminUser(req.session.user) });
});

// 5. 로그아웃
app.get("/logout", (req, res) => {
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
  if (!currentPassword || !nextPassword) return res.status(400).json({ message: "현재 비밀번호와 새 비밀번호를 입력해주세요." });
  if (currentPassword.length > PASSWORD_MAX_LENGTH) return res.status(400).json({ message: "현재 비밀번호가 올바르지 않습니다." });
  const passwordError = validatePassword(nextPassword);
  if (passwordError) return res.status(400).json({ message: passwordError });

  try {
    const member = await prisma.member.findUnique({ where: { id: req.session.user.id } });
    if (!member) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    const isMatch = await bcrypt.compare(currentPassword, member.password);
    if (!isMatch) return res.status(400).json({ message: "현재 비밀번호가 틀렸습니다." });

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

// 9. 편지 저장
app.post("/write-letter", writeLimiter, async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인이 필요합니다." });
  const type = String(req.body.type || "text");
  const content = typeof req.body.content === "string" ? req.body.content : "";
  const openDate = req.body.openDate;
  const email = String(req.body.email || "").trim().toLowerCase();
  const recipientEmail = String(req.body.recipientEmail || "").trim().toLowerCase();
  const recipientName = String(req.body.recipientName || "").trim();
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

  if (email && !isValidEmail(email)) return res.status(400).json({ message: "이메일 형식이 올바르지 않습니다." });
  if (recipientName.length > RECIPIENT_NAME_MAX_LENGTH) return res.status(400).json({ message: `받는 사람 이름은 ${RECIPIENT_NAME_MAX_LENGTH}자를 넘을 수 없습니다.` });
  if (recipientName && !recipientEmail) return res.status(400).json({ message: "받는 사람 이메일을 입력해주세요." });
  if (recipientEmail && !isValidEmail(recipientEmail)) return res.status(400).json({ message: "받는 사람 이메일 형식이 올바르지 않습니다." });

  try {
    if (email) {
      await prisma.member.update({ where: { id: authorId }, data: { email } });
      req.session.user.email = email;
    }

    await prisma.letter.create({
      data: {
        type,
        content: type === "text" ? content : null,
        videoUrl: cleanVideoUrl,
        imageUrl: cleanImageUrl,
        signatureData: cleanSignatureUrl,
        recipientEmail: recipientEmail || null,
        recipientName: recipientName || null,
        openDate: parsedOpenDate,
        authorId,
      }
    });

    // 이미 개봉 가능한 날짜라면 현재 사용자의 편지만 즉시 발송한다.
    if (parsedOpenDate <= new Date()) {
      sendDueLetters({ authorId });
    }

    res.status(201).json({ message: "편지 저장 성공!" });
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
  res.json({ message: "발송 완료", ...result });
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
      },
      select: {
        id: true,
        openDate: true,
        sentAt: true,
      },
    });
    res.json({ message: "편지 날짜를 수정했습니다.", letter });
  } catch (err) {
    console.error("admin letter date update error:", err);
    res.status(500).json({ message: "편지 날짜 수정에 실패했습니다." });
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
    res.json({ delivery });
  } catch (err) {
    console.error("my teacher letter error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// SPA 라우팅
app.get("/{*splat}", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.resolve("client/dist/index.html"));
});

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
