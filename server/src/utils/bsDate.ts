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

export const isValidBsDate = (value?: string | null) => {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
};

export const normalizeToBsDate = (value?: string | Date | null) => {
  if (!value) return '';
  if (value instanceof Date) {
    return adDateToBsString(value);
  }
  if (typeof value !== 'string') return '';
  if (isValidBsDate(value)) return value;
  const isoMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (!isoMatch) return '';
  const [year, month, day] = isoMatch[0].split('-').map(Number);
  const adDate = new Date(Date.UTC(year, month - 1, day));
  return adDateToBsString(adDate);
};

export const adDateToBsString = (date: Date) => {
  if (!adToBsFn) return date.toISOString().slice(0, 10);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const bs = adToBsFn(year, month, day);
  return `${bs.year}-${pad(bs.month)}-${pad(bs.day)}`;
};

export const bsToAdDate = (bsDate?: string | null) => {
  if (!bsDate || !isValidBsDate(bsDate)) return null;
  if (!bsToAdFn || !adToBsFn) {
    const [year, month, day] = bsDate.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const [year, month, day] = bsDate.split('-').map(Number);
  const ad = bsToAdFn(year, month, day);
  return new Date(Date.UTC(ad.year, ad.month - 1, ad.day));
};
