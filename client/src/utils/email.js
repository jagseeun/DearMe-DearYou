export const ALLOWED_EMAIL_DOMAINS = ['gmail.com', 'naver.com', 'e-mirim.hs.kr'];

export const ALLOWED_EMAIL_MESSAGE = '이메일 형식은 gmail.com, naver.com, e-mirim.hs.kr만 가능합니다.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAllowedEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return false;
  const domain = email.split('@').pop();
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}
