export const ALLOWED_EMAIL_DOMAINS = ['gmail.com', 'naver.com', 'e-mirim.hs.kr'];

export const ALLOWED_EMAIL_MESSAGE = '이메일은 gmail.com, naver.com, e-mirim.hs.kr 주소만 사용할 수 있습니다.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAllowedEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return false;
  const domain = email.split('@').pop();
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

