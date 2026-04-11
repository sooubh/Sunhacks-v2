export const CITY_OPTIONS = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'] as const;
export const OVERALL_CITY_OPTION = 'Overall' as const;

export type CityScope = (typeof CITY_OPTIONS)[number];
export type CitySelection = CityScope | typeof OVERALL_CITY_OPTION;

export const CITY_SELECTION_OPTIONS: readonly CitySelection[] = [OVERALL_CITY_OPTION, ...CITY_OPTIONS];

export const CITY_COORDS: Record<CityScope, { lat: number; lng: number }> = {
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.6139, lng: 77.2090 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
};

const CITY_ALIAS_TO_SCOPE: Record<string, CityScope> = {
  mumbai: 'Mumbai',
  bombay: 'Mumbai',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  ncr: 'Delhi',
  bangalore: 'Bangalore',
  bengaluru: 'Bangalore',
  bengalore: 'Bangalore',
  hyderabad: 'Hyderabad',
  chennai: 'Chennai',
  madras: 'Chennai',
};

export function normalizeCityScope(value: string | null | undefined): CityScope | null {
  if (!value) return null;
  return CITY_ALIAS_TO_SCOPE[value.trim().toLowerCase()] ?? null;
}

export function isOverallCitySelection(value: string | null | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === OVERALL_CITY_OPTION.toLowerCase();
}

export function getCityFromLocation(location: string): CityScope | null {
  const normalized = location.trim().toLowerCase();
  for (const [alias, city] of Object.entries(CITY_ALIAS_TO_SCOPE)) {
    if (normalized.includes(alias)) return city;
  }

  const leadToken = location.split(',')[0]?.trim();
  return normalizeCityScope(leadToken ?? null);
}
