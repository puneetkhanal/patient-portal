import * as converter from 'nepali-date-converter';

type DateFn = (y: number, m: number, d: number) => { year: number; month: number; day: number };

const resolveFn = (names: string[]): DateFn | undefined => {
  const sources = [converter as Record<string, unknown>, (converter as { default?: unknown }).default as Record<string, unknown>];
  for (const source of sources) {
    if (!source) continue;
    for (const name of names) {
      const candidate = source[name];
      if (typeof candidate === 'function') {
        return candidate as DateFn;
      }
    }
  }
  return undefined;
};

const adToBsFn = resolveFn(['adToBs', 'ad2bs', 'adToBS', 'ADToBS', 'toBs', 'toBS']);
const bsToAdFn = resolveFn(['bsToAd', 'bs2ad', 'bsToAD', 'BSToAD', 'toAd', 'toAD']);

const pad = (value: number) => value.toString().padStart(2, '0');

export const adIsoToBs = (adIso?: string | null) => {
  if (!adIso) return '';
  const [year, month, day] = adIso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  if (!adToBsFn) return '';
  const bs = adToBsFn(year, month, day);
  console.debug('[calendar] AD->BS', { adIso, input: { year, month, day }, output: bs });
  return `${bs.year}-${pad(bs.month)}-${pad(bs.day)}`;
};

export const bsToAdIso = (bsDate?: string | null) => {
  if (!bsDate) return '';
  const [year, month, day] = bsDate.split('-').map(Number);
  if (!year || !month || !day) return '';
  if (!bsToAdFn) return '';
  const ad = bsToAdFn(year, month, day);
  console.debug('[calendar] BS->AD', { bsDate, input: { year, month, day }, output: ad });
  return `${ad.year}-${pad(ad.month)}-${pad(ad.day)}`;
};

export const getTodayBs = () => {
  const adToday = new Date().toISOString().split('T')[0];
  return adIsoToBs(adToday) || adToday;
};
