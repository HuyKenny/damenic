export interface SearchEntry {
  type: 'restaurace' | 'jidlo' | 'recept';
  title: string;
  sub: string;
  url: string;
  /** Extra searchable words (cuisine, tags). */
  keywords: string;
}

/** Lower-case and strip diacritics so "svickova" finds "Svíčková". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function searchEntries(entries: SearchEntry[], query: string, limit = 12): SearchEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const title = fold(entry.title);
    const rest = fold(`${entry.sub} ${entry.keywords}`);
    let score = 0;
    let all = true;
    for (const w of words) {
      if (title.startsWith(w)) score += 6;
      else if (title.split(/\s+/).some((t) => t.startsWith(w))) score += 4;
      else if (title.includes(w)) score += 3;
      else if (rest.includes(w)) score += 1;
      else {
        all = false;
        break;
      }
    }
    if (all) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'cs'))
    .slice(0, limit)
    .map((s) => s.entry);
}
