import { describe, expect, it } from 'vitest';
import { easterSunday, occasionsInSeason, OCCASION_IDS, OCCASIONS } from '@/lib/occasions';

const at = (iso: string) => new Date(`${iso}T12:00:00+01:00`);

describe('occasions', () => {
  it('computes Easter Sunday', () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
  });
  it('puts Christmas cookies first in mid November', () => {
    expect(occasionsInSeason(at('2026-11-13'))[0]).toBe('vanocni-cukrovi');
    expect(occasionsInSeason(at('2026-12-20'))).toEqual(['vanocni-cukrovi', 'vanoce']);
    expect(occasionsInSeason(at('2026-12-30'))).toEqual(['silvestr']);
  });
  it('follows the movable Easter date', () => {
    expect(occasionsInSeason(at('2027-03-20'))).toContain('velikonoce');
    expect(occasionsInSeason(at('2026-03-20'))).toContain('velikonoce');
    expect(occasionsInSeason(at('2026-04-25'))).not.toContain('velikonoce');
    // Shrovetide ends on Ash Wednesday: 18 February 2026, 10 February 2027.
    expect(occasionsInSeason(at('2026-02-17'))).toContain('masopust');
    expect(occasionsInSeason(at('2027-02-17'))).not.toContain('masopust');
  });
  it('only offers occasions that have a hub', () => {
    expect(occasionsInSeason(at('2026-11-13'), ['vanoce'])).toEqual([]);
    expect(occasionsInSeason(at('2026-12-01'), ['vanoce'])).toEqual(['vanoce']);
  });
  it('keeps hub titles short enough for search results', () => {
    for (const id of OCCASION_IDS) expect(OCCASIONS[id].title.length, id).toBeLessThanOrEqual(60);
  });
});
