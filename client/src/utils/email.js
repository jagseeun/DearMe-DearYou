export const ALLOWED_EMAIL_MESSAGE = '이메일 형식을 확인해 주세요. gmail.com/naver.com/e-mirim.hs.kr 도메인은 오타 없이 입력하고, 미림 이메일은 s24/s25/s26 또는 d24/d25/d26으로 시작해야 해요.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KNOWN_EMAIL_DOMAIN_TYPOS = new Set([
  'gamil.com',
  'gmial.com',
  'gmai.com',
  'gnail.com',
  'gmail.co',
  'gmail.con',
  'gmail.cm',
  'navre.com',
  'nvaer.com',
  'naver.co',
  'naver.con',
  'naver.cpm',
  'naver.comm',
  'emirim.hs.kr',
  'e-mrim.hs.kr',
  'e-mirim.hskr',
  'e-mirim.hs.com',
  'e-mirim.kr',
]);

export function isAllowedEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return false;
  const atIndex = email.lastIndexOf('@');
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (KNOWN_EMAIL_DOMAIN_TYPOS.has(domain)) return false;
  if (domain === 'e-mirim.hs.kr') return /^[sd](24|25|26)/.test(local);
  return true;
}
