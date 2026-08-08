// Display names for the ISO-2 country codes jobs are tagged with (matches
// the codes used by the Adzuna source integration - see backend
// config/env.js ADZUNA_COUNTRIES). Limited to the major job markets Adzuna
// actually covers well; anything else falls back to its raw code.
export const COUNTRY_NAMES = {
  in: 'India',
  us: 'United States',
  gb: 'United Kingdom',
  ca: 'Canada',
  au: 'Australia',
  de: 'Germany',
  fr: 'France',
  sg: 'Singapore',
};

export function countryLabel(code) {
  if (!code) return code;
  return COUNTRY_NAMES[code.toLowerCase()] || code.toUpperCase();
}