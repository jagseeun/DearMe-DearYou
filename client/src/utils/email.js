export const ALLOWED_EMAIL_MESSAGE = '이메일 형식을 확인해 주세요.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCOUNT_EMAIL_DOMAIN = 'e-mirim.hs.kr';
const COMMON_EMAIL_DOMAINS = [
  { domain: 'gmail.com', label: 'gmail', suffix: '.com', first: 'g' },
  { domain: 'naver.com', label: 'naver', suffix: '.com', first: 'n' },
  { domain: ACCOUNT_EMAIL_DOMAIN, label: 'e-mirim', suffix: '.hs.kr', first: 'e' },
];
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
  'e-mririm.hs.kr',
  'e-mirim.hskr',
  'e-mirim.hs.com',
  'e-mirim.kr',
]);

function getEmailDomain(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  const atIndex = email.lastIndexOf('@');
  return email.slice(atIndex + 1);
}

function damerauLevenshteinDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }

  return rows[a.length][b.length];
}

function isLikelyCommonDomainTypo(domain) {
  if (KNOWN_EMAIL_DOMAIN_TYPOS.has(domain)) return true;

  return COMMON_EMAIL_DOMAINS.some(target => {
    if (domain === target.domain || domain[0] !== target.first) return false;
    if (damerauLevenshteinDistance(domain, target.domain) <= 1) return true;
    if (!domain.endsWith(target.suffix)) return false;
    const label = domain.slice(0, -target.suffix.length);
    return label !== target.label && damerauLevenshteinDistance(label, target.label) <= 1;
  });
}

function isLikelyMirimSchoolEmailDomainTypo(domain) {
  if (domain === ACCOUNT_EMAIL_DOMAIN) return false;
  if (KNOWN_EMAIL_DOMAIN_TYPOS.has(domain)) return true;
  if (!domain.endsWith('.hs.kr')) return false;

  const schoolLabel = domain.slice(0, -'.hs.kr'.length);
  if (schoolLabel === 'mirim') return true;
  return (
    damerauLevenshteinDistance(schoolLabel, 'e-mirim') <= 2 ||
    damerauLevenshteinDistance(schoolLabel, 'mirim') <= 1
  );
}

export function isAllowedEmail(value) {
  const domain = getEmailDomain(value);
  if (!domain) return false;
  if (isLikelyMirimSchoolEmailDomainTypo(domain)) return false;
  return !isLikelyCommonDomainTypo(domain);
}
