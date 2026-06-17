export const ALLOWED_EMAIL_MESSAGE = '이메일 형식을 확인해 주세요. 예: name@example.com';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAllowedEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}
