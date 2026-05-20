export function formatDate(d) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}
export function daysUntil(d) {
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}
export function daysSince(d) {
  return Math.floor((new Date() - new Date(d)) / 86400000);
}
