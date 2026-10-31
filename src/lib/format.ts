const nf = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });

export const money = (n: number) => (n < 0 ? '−$' : '$') + nf.format(Math.abs(Math.round(n)));
export const signedMoney = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + '$' + nf.format(Math.abs(Math.round(n)));
export const num = (n: number) => nf2.format(n);
export const pct = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + nf.format(Math.abs(Math.round(n))) + '%';

/** "15к" → 15000, "1.2кк" / "1.2m" → 1 200 000, "137 227" → 137227 */
export function parseAmount(raw: string): number {
  const s = raw.trim().toLowerCase().replace(/\s| |\$/g, '').replace(',', '.');
  const m = s.match(/^(\d*\.?\d+)(кк|kk|м|m|к|k)?$/);
  if (!m) return NaN;
  const base = parseFloat(m[1]);
  const mult = m[2] === 'кк' || m[2] === 'kk' || m[2] === 'м' || m[2] === 'm' ? 1e6 : m[2] ? 1e3 : 1;
  return Math.round(base * mult * 100) / 100;
}

const dtf = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const df = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' });
export const dateTime = (ts: number) => dtf.format(ts);
export const dateLong = (ts: number) => df.format(ts);

export function ago(ts: number): string {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'щойно';
  if (d < 3600) return `${Math.floor(d / 60)} хв тому`;
  if (d < 86400) return `${Math.floor(d / 3600)} год тому`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)} дн тому`;
  return df.format(ts);
}

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
