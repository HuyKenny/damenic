// Sample localities give the simulation a setting. They do not mean any real delivery coverage.
export const CITIES = ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'České Budějovice', 'Hradec Králové'] as const;
export const DEFAULT_CITY = 'Praha';

export function dropPoint(city: string): string {
  return `Výdejní bod Nikde 0, ${city}`;
}

export function parseCity(raw: unknown): string | null {
  return typeof raw === 'string' && (CITIES as readonly string[]).includes(raw) ? raw : null;
}
