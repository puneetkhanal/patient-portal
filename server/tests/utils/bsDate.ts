import { adDateToBsString } from '../../src/utils/bsDate.js';

export const toBs = (adIso: string) => {
  const [year, month, day] = adIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const bs = adDateToBsString(date);
  return bs || adIso;
};
