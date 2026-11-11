import { useEffect, useMemo, useState } from 'preact/hooks';
import { DIET_TAGS, EMPTY_FILTERS, ETA_STEPS, SORTS, activeCount, applyFilters, parseQuery, toQuery, type FilterState, type RestaurantSummary } from '@/lib/filters';
import { RestaurantTile } from './RestaurantTile';
import { Dialog } from './Dialog';
import { Icon } from './icons';

export interface CategoryChip {
  id: string;
  label: string;
  src: string;
  count: number;
}

interface Props {
  restaurants: RestaurantSummary[];
  categories: CategoryChip[];
  /** Compact = home page: no URL sync, only the quick chips. */
  compact?: boolean;
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Filters and sorting run in the browser over a small static list. The state is mirrored to the query string so a
 * filtered view can be shared, but the page's canonical URL stays /restaurace/ and no filter combination is indexed.
 */
export default function RestaurantBrowser({ restaurants, categories, compact = false }: Props) {
  const [f, setF] = useState<FilterState>(EMPTY_FILTERS);
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    if (!compact) setF(parseQuery(location.search));
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, [compact]);

  useEffect(() => {
    if (compact || now === null) return;
    const q = toQuery(f);
    if (q !== location.search) history.replaceState(null, '', `${location.pathname}${q}${location.hash}`);
  }, [f, compact, now]);

  const list = useMemo(() => applyFilters(restaurants, f, now ?? 0), [restaurants, f, now]);
  const set = (patch: Partial<FilterState>) => setF((prev) => ({ ...prev, ...patch }));
  const n = activeCount(f);
  const shown = now === null ? restaurants.slice().sort((a, b) => a.order - b.order) : list;

  const quick: { label: string; on: boolean; flip: () => void }[] = [
    { label: 'Dopravné 0 Kč', on: f.freeDelivery, flip: () => set({ freeDelivery: !f.freeDelivery }) },
    { label: 'Akce', on: f.promo, flip: () => set({ promo: !f.promo }) },
    { label: 'Otevřeno teď', on: f.openNow, flip: () => set({ openNow: !f.openNow }) },
    { label: 'Do 30 min', on: f.maxEta === 30, flip: () => set({ maxEta: f.maxEta === 30 ? null : 30 }) },
    { label: 'Bez masa', on: f.tags.includes('bez masa'), flip: () => set({ tags: toggle(f.tags, 'bez masa') }) },
    { label: 'Osobní odběr', on: f.pickup, flip: () => set({ pickup: !f.pickup }) },
    { label: 'Nové', on: f.isNew, flip: () => set({ isNew: !f.isNew }) },
  ];

  return (
    <div class="browser" data-testid="browser">
      <ul class="catstrip" aria-label="Kuchyně">
        {categories.map((c) => {
          const on = f.categories.includes(c.id);
          return (
            <li key={c.id}>
              <button type="button" class={`cat ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => set({ categories: toggle(f.categories, c.id) })} data-testid={`cat-${c.id}`}>
                <img src={c.src} alt="" width="56" height="56" loading="lazy" decoding="async" />
                <span>{c.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div class="filterbar">
        <button type="button" class={`fchip fchip--main ${n ? 'is-on' : ''}`} onClick={() => setOpen(true)} data-testid="open-filters">
          <Icon name="list" size={18} /> Filtry{n ? ` (${n})` : ''}
        </button>
        {quick.map((q) => (
          <button type="button" key={q.label} class={`fchip ${q.on ? 'is-on' : ''}`} aria-pressed={q.on} onClick={q.flip}>
            {q.label}
          </button>
        ))}
        {!compact && (
          <label class="sortsel">
            <span class="sr-only">Řazení</span>
            <select value={f.sort} onChange={(e) => set({ sort: e.currentTarget.value as FilterState['sort'] })} data-testid="sort">
              {SORTS.map((s) => (
                <option value={s.key} key={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p class="browser__count" role="status" aria-live="polite" data-testid="result-count">
        {now === null ? `${restaurants.length} fiktivních restaurací` : `${shown.length} ${shown.length === 1 ? 'restaurace' : shown.length < 5 && shown.length > 0 ? 'restaurace' : 'restaurací'}`}
        {n > 0 && (
          <button type="button" class="link-btn small" onClick={() => setF({ ...EMPTY_FILTERS, sort: f.sort })}>
            Zrušit filtry
          </button>
        )}
      </p>

      {shown.length ? (
        <div class="rgrid">
          {shown.map((r, i) => (
            <RestaurantTile r={r} now={now} key={r.id} eager={i < 2} />
          ))}
        </div>
      ) : (
        <div class="empty" data-testid="browser-empty">
          <h2>Tohle nevaří nikdo. Ani nanečisto.</h2>
          <p>Zkus ubrat některý filtr. Nebo si to rovnou uvař, recepty máme pořád.</p>
          <div class="hero__cta" style="justify-content:center">
            <button type="button" class="btn" onClick={() => setF(EMPTY_FILTERS)}>
              Zrušit filtry
            </button>
            <a class="btn btn--ghost" href="/recepty/">
              Recepty
            </a>
          </div>
        </div>
      )}

      <Dialog open={open} title="Filtry" onClose={() => setOpen(false)}>
        <div class="fpanel">
          <fieldset>
            <legend>Kuchyně</legend>
            <div class="fpanel__chips">
              {categories.map((c) => (
                <button type="button" key={c.id} class={`fchip ${f.categories.includes(c.id) ? 'is-on' : ''}`} aria-pressed={f.categories.includes(c.id)} onClick={() => set({ categories: toggle(f.categories, c.id) })}>
                  {c.label} <small>{c.count}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Doba doručení (simulovaná)</legend>
            <div class="fpanel__chips">
              {ETA_STEPS.map((m) => (
                <button type="button" key={m} class={`fchip ${f.maxEta === m ? 'is-on' : ''}`} aria-pressed={f.maxEta === m} onClick={() => set({ maxEta: f.maxEta === m ? null : m })}>
                  Do {m} min
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Cenová hladina</legend>
            <div class="fpanel__chips">
              {[1, 2, 3].map((p) => (
                <button type="button" key={p} class={`fchip ${f.priceLevels.includes(p) ? 'is-on' : ''}`} aria-pressed={f.priceLevels.includes(p)} onClick={() => set({ priceLevels: toggle(f.priceLevels, p) })}>
                  {'Kč '.repeat(p).trim()}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Strava</legend>
            <div class="fpanel__chips">
              {DIET_TAGS.map((t) => (
                <button type="button" key={t} class={`fchip ${f.tags.includes(t) ? 'is-on' : ''}`} aria-pressed={f.tags.includes(t)} onClick={() => set({ tags: toggle(f.tags, t) })}>
                  {t[0]!.toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Ostatní</legend>
            <div class="fpanel__chips">
              {quick
                .filter((q) => !['Bez masa', 'Do 30 min'].includes(q.label))
                .map((q) => (
                  <button type="button" key={q.label} class={`fchip ${q.on ? 'is-on' : ''}`} aria-pressed={q.on} onClick={q.flip}>
                    {q.label}
                  </button>
                ))}
              <button type="button" class={`fchip ${f.noMinimum ? 'is-on' : ''}`} aria-pressed={f.noMinimum} onClick={() => set({ noMinimum: !f.noMinimum })}>
                Bez minimální objednávky
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Řazení</legend>
            <div class="fpanel__chips">
              {SORTS.map((s) => (
                <button type="button" key={s.key} class={`fchip ${f.sort === s.key ? 'is-on' : ''}`} aria-pressed={f.sort === s.key} onClick={() => set({ sort: s.key })}>
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          <p class="small muted">Hodnocení restaurací tu nenajdeš: restaurace jsou smyšlené, takže žádná skutečná hodnocení nemají.</p>
          <div class="dlg__actions">
            <button type="button" class="btn btn--ghost" onClick={() => setF({ ...EMPTY_FILTERS })}>
              Zrušit vše
            </button>
            <button type="button" class="btn" onClick={() => setOpen(false)} data-testid="apply-filters">
              Zobrazit {list.length} {list.length === 1 ? 'restauraci' : list.length < 5 && list.length > 0 ? 'restaurace' : 'restaurací'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
