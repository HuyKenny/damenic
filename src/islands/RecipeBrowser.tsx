import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  ACT_STEPS,
  COST_STEPS,
  DIET_FACETS,
  DIFFICULTIES,
  EMPTY_RECIPE_FILTERS,
  FAMILY_LABELS,
  MEAL_LABELS,
  METHOD_FACETS,
  RECIPE_SORTS,
  TIME_STEPS,
  activeFilters,
  applyRecipeFilters,
  facetCounts,
  haveMatch,
  pagerItems,
  parsePageParam,
  parseRecipeQuery,
  recipeFilterCount,
  recipeFiltersToQuery,
  removalSuggestions,
  suggestTitles,
  type DietKey,
  type FacetCounts,
  type MethodKey,
  type RecipeFilters,
  type RecipeSort,
  type RecipeSummary,
} from '@/lib/recipe-facets';
import { occasionsInSeason } from '@/lib/occasions';
import { formatDuration } from '@/lib/units';
import { Dialog } from './Dialog';
import { Icon, type IconName } from './icons';

interface Props {
  categories: { id: string; label: string }[];
  occasions: { id: string; label: string }[];
  total: number;
  /** First page in the default order, rendered on the server so the page is never empty and nothing jumps. */
  initial: RecipeSummary[];
  /** Counts for the unfiltered list, so the filters show numbers before the index arrives. */
  initialCounts: FacetCounts;
}

interface Index {
  recipes: RecipeSummary[];
  ingredients: { id: string; name: string }[];
}

const PAGE = 18;
const STORE = 'damenic:recipes:v1';
const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const cz = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
const recipesWord = (n: number) => `${n} ${cz(n, 'recept', 'recepty', 'receptů')}`;

interface Preset {
  id: string;
  label: string;
  patch: Partial<RecipeFilters>;
}

/** Shown filters are "on" when every field a preset sets has exactly that value. */
const sameValue = (a: unknown, b: unknown) => JSON.stringify(Array.isArray(a) ? [...a].sort() : a) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b);
const presetOn = (f: RecipeFilters, p: Preset) => (Object.keys(p.patch) as (keyof RecipeFilters)[]).every((k) => sameValue(f[k], p.patch[k]));
const presetOff = (f: RecipeFilters, p: Preset): RecipeFilters => {
  const next = { ...f } as Record<string, unknown>;
  for (const k of Object.keys(p.patch)) next[k] = (EMPTY_RECIPE_FILTERS as unknown as Record<string, unknown>)[k];
  return next as unknown as RecipeFilters;
};

function readSaved(): { search: string; y: number } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE) ?? 'null') as { search?: unknown; y?: unknown; t?: unknown } | null;
    if (!v || typeof v.search !== 'string' || typeof v.y !== 'number' || typeof v.t !== 'number') return null;
    if (Date.now() - v.t > 30 * 60_000 || v.y < 0 || v.y > 200_000) return null;
    return { search: v.search, y: v.y };
  } catch {
    return null;
  }
}

/**
 * Recipe browser: results first, faceted counts, active-filter chips, a dead-end helper and remembered scroll.
 * State lives in the query string (shareable) but the canonical URL stays /recepty/ and no filter combination is indexed.
 */
export default function RecipeBrowser({ categories, occasions, total, initial, initialCounts }: Props) {
  const [f, setF] = useState<RecipeFilters>(EMPTY_RECIPE_FILTERS);
  const [idx, setIdx] = useState<Index | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [haveOpen, setHaveOpen] = useState(false);
  const [pick, setPick] = useState('');
  const [typing, setTyping] = useState(false);
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const restored = useRef(false);
  const prevKey = useRef<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const n = recipeFilterCount(f);
  const labels = useMemo(
    () => ({
      categories: Object.fromEntries(categories.map((c) => [c.id, c.label])),
      occasions: Object.fromEntries(occasions.map((o) => [o.id, o.label])),
      ingredients: Object.fromEntries((idx?.ingredients ?? []).map((i) => [i.id, i.name])),
    }),
    [categories, occasions, idx],
  );

  // state from the URL, then the index in the background
  useEffect(() => {
    const parsed = parseRecipeQuery(location.search);
    prevKey.current = recipeFiltersToQuery(parsed);
    setF(parsed);
    setPage(parsePageParam(location.search));
    setNow(new Date());
    setReady(true);
    const load = () =>
      fetch('/data/recipes.json')
        .then((r) => (r.ok ? (r.json() as Promise<Index>) : Promise.reject(new Error(String(r.status)))))
        .then(setIdx)
        .catch(() => setFailed(true));
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(load, { timeout: 2500 });
    else window.setTimeout(load, 600);
  }, []);

  // URL mirrors the filters (debounced: typing should not spam history calls)
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      const q = recipeFiltersToQuery(f, page);
      if (q !== location.search) history.replaceState(null, '', `${location.pathname}${q}${location.hash}`);
    }, 250);
    return () => window.clearTimeout(t);
  }, [f, page, ready]);

  // a changed filter or sort starts again from page 1 (the first run after the URL was read does not count)
  useEffect(() => {
    if (!ready) return;
    const key = recipeFiltersToQuery(f);
    if (key !== prevKey.current) {
      prevKey.current = key;
      setPage(1);
    }
  }, [f, ready]);

  const filtered = n > 0 || f.sort !== 'doporucene';
  const list = useMemo(() => (idx && now ? applyRecipeFilters(idx.recipes, f, now) : null), [idx, f, now]);
  const counts = useMemo<FacetCounts>(() => (idx ? facetCounts(idx.recipes, f) : initialCounts), [idx, f, initialCounts]);
  const pageCount = Math.max(1, Math.ceil((list ? list.length : total) / PAGE));
  const current = Math.min(page, pageCount);
  const shown = list ? list.slice((current - 1) * PAGE, current * PAGE) : filtered ? [] : initial;
  const loading = !list && filtered;
  const resultCount = list ? list.length : filtered ? null : total;

  // remembered position when coming back from a recipe
  useEffect(() => {
    if (!idx || restored.current) return;
    restored.current = true;
    const s = readSaved();
    if (s && s.search === location.search) window.requestAnimationFrame(() => window.scrollTo(0, s.y));
  }, [idx]);
  useEffect(() => {
    const save = () => {
      try {
        sessionStorage.setItem(STORE, JSON.stringify({ search: location.search, y: Math.round(window.scrollY), t: Date.now() }));
      } catch {
        /* private mode: nothing to remember */
      }
    };
    const onClick = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('.rb__results a')) save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const goPage = (n: number) => {
    setPage(n);
    window.requestAnimationFrame(() => {
      const y = (top.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 150;
      window.scrollTo({ top: Math.max(0, y) });
    });
  };

  const set = (patch: Partial<RecipeFilters>) => setF((prev) => ({ ...prev, ...patch }));
  const reset = () => setF({ ...EMPTY_RECIPE_FILTERS, sort: f.sort });

  const seasonIds = useMemo(() => (now ? occasionsInSeason(now, occasions.map((o) => o.id)) : []), [now, occasions]);
  const presets: Preset[] = [
    { id: 'dnes', label: 'Co dnes uvařit', patch: { meals: ['hlavni'], maxMin: 45 } },
    { id: '30', label: 'Do 30 minut', patch: { maxMin: 30 } },
    { id: 'veg', label: 'Bez masa', patch: { diets: ['veg'] } },
    { id: 'vegan', label: 'Veganské', patch: { diets: ['vegan'] } },
    { id: 'gf', label: 'Bez lepku', patch: { diets: ['gf'] } },
    { id: 'levne', label: 'Levně', patch: { maxCost: 40 } },
    ...(seasonIds.length ? [{ id: 'sezona', label: 'Svátky teď', patch: { occasions: seasonIds } }] : []),
  ];

  const suggestions = useMemo(() => (idx && typing ? suggestTitles(idx.recipes, f.q) : []), [idx, typing, f.q]);
  const ingSuggestions = useMemo(() => {
    const w = pick.trim().toLowerCase();
    if (w.length < 2 || !idx) return [];
    return idx.ingredients.filter((i) => !f.have.includes(i.id) && i.name.toLowerCase().includes(w)).slice(0, 8);
  }, [pick, idx, f.have]);
  const actives = useMemo(() => activeFilters(f, labels), [f, labels]);
  const help = useMemo(() => (idx && now && list && list.length === 0 && n > 0 ? removalSuggestions(idx.recipes, f, labels, now) : []), [idx, now, list, n, f, labels]);

  const panel = () => <FilterGroups f={f} set={set} counts={counts} categories={categories} occasions={occasions} />;
  const presetIcon: Record<string, IconName> = { dnes: 'utensils', '30': 'timer', veg: 'leaf', vegan: 'leaf', gf: 'wheatOff', levne: 'piggy', sezona: 'sparkles' };

  return (
    <div class="rb" data-testid="recipe-browser">
      <div class="rb__layout">
        <aside class="rb__side" aria-label="Filtry receptů">
          <div class="rb__sidehead">
            <h2>Filtry</h2>
            {n > 0 && (
              <button type="button" class="link-btn small" onClick={reset}>
                Zrušit vše
              </button>
            )}
          </div>
          {panel()}
        </aside>

        <div class="rb__main" ref={top}>
          <div class="rb__bar">
            <div class="rb__row">
              <div class="rb__search">
                <Icon name="search" size={20} />
                <input
                  type="search"
                  value={f.q}
                  maxLength={80}
                  autocomplete="off"
                  aria-label="Hledat recept nebo surovinu"
                  onInput={(e) => {
                    set({ q: e.currentTarget.value });
                    setTyping(true);
                  }}
                  onFocus={() => setTyping(true)}
                  onBlur={() => window.setTimeout(() => setTyping(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setTyping(false);
                  }}
                  placeholder="Najdi recept nebo surovinu: svíčková, kuře, mojito…"
                  data-testid="recipe-search"
                />
                {f.q && (
                  <button type="button" class="rb__clear" aria-label="Smazat hledání" onClick={() => set({ q: '' })}>
                    <Icon name="x" size={16} />
                  </button>
                )}
                {suggestions.length > 0 && (
                  <ul class="rb__suggest" aria-label="Návrhy">
                    {suggestions.map((r) => (
                      <li key={r.id}>
                        <a href={`/recepty/${r.id}/`}>
                          <span>{r.title}</span>
                          <small>{r.categoryLabel}</small>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" class="rb__filterbtn" onClick={() => setSheet(true)} data-testid="open-recipe-filters" aria-label={n ? `Filtry, aktivních ${n}` : 'Filtry'}>
                <Icon name="sliders" size={20} /> Filtry{n ? <b>{n}</b> : null}
              </button>
            </div>
            <div class="rb__quick" role="group" aria-label="Rychlé volby">
              {presets.map((p) => {
                const on = presetOn(f, p);
                return (
                  <button type="button" key={p.id} class={`fchip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setF(on ? presetOff(f, p) : { ...f, ...p.patch })}>
                    <Icon name={presetIcon[p.id] ?? 'tag'} size={16} />
                    {p.label}
                  </button>
                );
              })}
              <button type="button" class={`fchip ${haveOpen || f.have.length ? 'is-on' : ''}`} aria-expanded={haveOpen} onClick={() => setHaveOpen(!haveOpen)} data-testid="have-toggle">
                <Icon name="fridge" size={16} />
                Mám doma{f.have.length ? ` (${f.have.length})` : ''}
              </button>
            </div>
          </div>

          {haveOpen && (
            <section class="rb__have" aria-label="Co mám doma">
              <label class="search__field">
                <span class="sr-only">Surovina, kterou máš doma</span>
                <input type="search" value={pick} onInput={(e) => setPick(e.currentTarget.value)} placeholder="Napiš surovinu: vejce, mouka, kuřecí…" data-testid="have-input" />
              </label>
              {ingSuggestions.length > 0 && (
                <div class="fpanel__chips">
                  {ingSuggestions.map((s) => (
                    <button
                      type="button"
                      class="fchip"
                      key={s.id}
                      onClick={() => {
                        set({ have: [...f.have, s.id] });
                        setPick('');
                      }}
                    >
                      + {s.name}
                    </button>
                  ))}
                </div>
              )}
              {f.have.length > 0 && (
                <div class="fpanel__chips">
                  {f.have.map((id) => (
                    <button type="button" class="fchip is-on" key={id} onClick={() => set({ have: f.have.filter((x) => x !== id), maxMissing: f.have.length === 1 ? null : f.maxMissing })}>
                      {labels.ingredients[id] ?? id} <Icon name="x" size={14} />
                    </button>
                  ))}
                  {[0, 2].map((m) => (
                    <button type="button" class={`fchip ${f.maxMissing === m ? 'is-on' : ''}`} key={m} aria-pressed={f.maxMissing === m} onClick={() => set({ maxMissing: f.maxMissing === m ? null : m })}>
                      {m === 0 ? 'Mám všechno' : 'Chybí max 2'}
                    </button>
                  ))}
                </div>
              )}
              <p class="small muted" style="margin:0">Recepty se seřadí podle toho, kolik surovin ti chybí. Sůl, olej a voda se nepočítají.</p>
            </section>
          )}

          <div class="rb__status">
            <p role="status" aria-live="polite" data-testid="recipe-count" class="rb__count">
              {resultCount === null ? 'Hledám…' : failed && !idx && filtered ? 'Recepty se nepodařilo načíst.' : recipesWord(resultCount)}
            </p>
            {actives.length > 0 ? (
              <ul class="rb__active" aria-label="Aktivní filtry">
                {actives.map((a) => (
                  <li key={a.id}>
                    <button type="button" class="fchip" onClick={() => setF(a.without(f))} aria-label={`Odebrat filtr ${a.label}`}>
                      {a.label} <Icon name="x" size={14} />
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" class="link-btn small" onClick={reset}>
                    Zrušit vše
                  </button>
                </li>
              </ul>
            ) : (
              <span class="rb__active" />
            )}
            <label class="sortsel">
              <span class="sr-only">Řazení</span>
              <select value={f.sort} onChange={(e) => set({ sort: e.currentTarget.value as RecipeSort })} data-testid="recipe-sort">
                {RECIPE_SORTS.map((s) => (
                  <option value={s.key} key={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <h2 class="sr-only">Nalezené recepty</h2>
          {loading && (
            <div class="grid grid--dishes" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div class="rb__skel" key={i} />
              ))}
            </div>
          )}
          {!loading && shown.length > 0 && (
            <div class="grid grid--dishes rb__results" data-testid="recipe-results">
              {shown.map((r, i) => (
                <Tile r={r} have={f.have} names={labels.ingredients} eager={i < 3} key={r.id} />
              ))}
            </div>
          )}
          {list && pageCount > 1 && (
            <nav class="rb__pager" aria-label="Stránkování" data-testid="recipe-pager">
              <button type="button" class="fchip" disabled={current <= 1} onClick={() => goPage(current - 1)}>
                ‹ Předchozí
              </button>
              <ul>
                {pagerItems(current, pageCount).map((n, i) => (
                  <li key={`${n}-${i}`}>
                    {n === 0 ? (
                      <span aria-hidden="true">…</span>
                    ) : (
                      <button type="button" class={`fchip ${n === current ? 'is-on' : ''}`} aria-current={n === current ? 'page' : undefined} aria-label={`Strana ${n}`} onClick={() => goPage(n)}>
                        {n}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" class="fchip" disabled={current >= pageCount} onClick={() => goPage(current + 1)} data-testid="next-page">
                Další ›
              </button>
            </nav>
          )}
          {list && list.length === 0 && (
            <div class="empty" data-testid="recipe-empty">
              <h2>Tohle jsme ještě neuvařili. Ani nanečisto.</h2>
              {help.length > 0 ? (
                <>
                  <p>S jedním filtrem méně by se něco našlo:</p>
                  <div class="fpanel__chips" style="justify-content:center">
                    {help.map((h) => (
                      <button type="button" class="fchip" key={h.filter.id} onClick={() => setF(h.filter.without(f))}>
                        Odebrat „{h.filter.label}“ <small>(+{h.count})</small>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p>Zkus hledat jedním slovem. Recepty přibývají každý týden.</p>
              )}
              <button type="button" class="btn" onClick={reset} style="margin-top:12px">
                Zrušit filtry
              </button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={sheet} title="Filtry receptů" onClose={() => setSheet(false)} variant="sheet">
        <div class="fpanel">
          {panel()}
          <div class="dlg__actions">
            <button type="button" class="btn btn--ghost" onClick={reset}>
              Zrušit vše
            </button>
            <button type="button" class="btn" onClick={() => setSheet(false)} data-testid="apply-recipe-filters">
              Zobrazit {resultCount === null ? 'recepty' : recipesWord(resultCount)}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function Group({ title, open, children }: { title: string; open?: boolean; children: ComponentChildren }) {
  return (
    <details class="rb__group" open={open}>
      <summary>{title}</summary>
      <div class="rb__opts">{children}</div>
    </details>
  );
}

function Opt({ label, on, count, flip }: { label: string; on: boolean; count?: number; flip: () => void }) {
  const dead = count === 0 && !on;
  return (
    <button type="button" class="rb__opt" aria-pressed={on} disabled={dead} onClick={flip}>
      <span class="rb__box" aria-hidden="true" />
      <span>{label}</span>
      {count !== undefined ? <small>{count}</small> : null}
    </button>
  );
}

interface GroupProps {
  f: RecipeFilters;
  set: (patch: Partial<RecipeFilters>) => void;
  counts: FacetCounts;
  categories: { id: string; label: string }[];
  occasions: { id: string; label: string }[];
}

/** Every filter group, shared by the desktop side panel and the phone sheet. Counts already respect the other filters. */
function FilterGroups({ f, set, counts, categories, occasions }: GroupProps) {
  return (
    <>
      <Group title="Typ jídla" open>
        {Object.entries(MEAL_LABELS).map(([id, label]) => (
          <Opt key={id} label={label} on={f.meals.includes(id)} count={counts.meal[id] ?? 0} flip={() => set({ meals: toggle(f.meals, id) })} />
        ))}
      </Group>
      <Group title="Strava a alergeny" open>
        {DIET_FACETS.map((d) => (
          <Opt key={d.key} label={d.label} on={f.diets.includes(d.key)} count={counts.diet[d.key] ?? 0} flip={() => set({ diets: toggle<DietKey>(f.diets, d.key) })} />
        ))}
        <p class="small muted rb__note">Odvozeno ze surovin receptu. U alergenů vždy čti složení zakoupených surovin: výrobci mění receptury.</p>
      </Group>
      <Group title="Čas" open>
        {TIME_STEPS.map((m) => (
          <Opt key={m} label={m < 60 ? `Do ${m} min` : `Do ${m / 60} h`} on={f.maxMin === m} count={counts.time[m] ?? 0} flip={() => set({ maxMin: f.maxMin === m ? null : m })} />
        ))}
        {ACT_STEPS.map((m) => (
          <Opt key={`a${m}`} label={`Práce do ${m} min`} on={f.maxAct === m} count={counts.act[m] ?? 0} flip={() => set({ maxAct: f.maxAct === m ? null : m })} />
        ))}
      </Group>
      <Group title="Hlavní surovina">
        {Object.entries(FAMILY_LABELS).map(([id, label]) => (
          <Opt key={id} label={label} on={f.families.includes(id)} count={counts.family[id] ?? 0} flip={() => set({ families: toggle(f.families, id) })} />
        ))}
      </Group>
      <Group title="Kuchyně">
        {categories.map((c) => (
          <Opt key={c.id} label={c.label} on={f.categories.includes(c.id)} count={counts.category[c.id] ?? 0} flip={() => set({ categories: toggle(f.categories, c.id) })} />
        ))}
      </Group>
      <Group title="Svátky a oslavy">
        {occasions.map((o) => (
          <Opt key={o.id} label={o.label} on={f.occasions.includes(o.id)} count={counts.occasion[o.id] ?? 0} flip={() => set({ occasions: toggle(f.occasions, o.id) })} />
        ))}
      </Group>
      <Group title="Způsob přípravy">
        {METHOD_FACETS.map((m) => (
          <Opt key={m.key} label={m.label} on={f.methods.includes(m.key)} count={counts.method[m.key] ?? 0} flip={() => set({ methods: toggle<MethodKey>(f.methods, m.key) })} />
        ))}
      </Group>
      <Group title="Obtížnost">
        {DIFFICULTIES.map((d) => (
          <Opt key={d} label={d[0]!.toUpperCase() + d.slice(1)} on={f.difficulties.includes(d)} count={counts.difficulty[d] ?? 0} flip={() => set({ difficulties: toggle(f.difficulties, d) })} />
        ))}
      </Group>
      <Group title="Cena na porci (ilustrační)">
        {COST_STEPS.map((c) => (
          <Opt key={c} label={`Do ${c} Kč`} on={f.maxCost === c} count={counts.cost[c] ?? 0} flip={() => set({ maxCost: f.maxCost === c ? null : c })} />
        ))}
      </Group>
      <Group title="Alkohol (jen pro 18+)">
        <Opt label="Bez alkoholu" on={f.alcohol === 'no'} count={counts.alcohol.no} flip={() => set({ alcohol: f.alcohol === 'no' ? 'any' : 'no' })} />
        <Opt label="Jen s alkoholem" on={f.alcohol === 'only'} count={counts.alcohol.only} flip={() => set({ alcohol: f.alcohol === 'only' ? 'any' : 'only' })} />
      </Group>
    </>
  );
}

function Tile({ r, have, names, eager }: { r: RecipeSummary; have: string[]; names: Record<string, string>; eager: boolean }) {
  const m = have.length ? haveMatch(r, have) : null;
  const missing = m ? r.ing.filter((i) => !have.includes(i)).slice(0, 3) : [];
  return (
    <article class="card">
      <div class="card__media">
        {r.img ? (
          <img
            src={r.img.src}
            srcset={r.img.srcset}
            sizes="(min-width: 1000px) 230px, (min-width: 560px) 45vw, 100vw"
            alt={r.img.alt}
            width="420"
            height="262"
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          <div class="photo--empty" role="img" aria-label="Fotografie se připravuje" />
        )}
        {(r.alcohol || r.diets.includes('vegan')) && (
          <div class="card__badges">
            {r.diets.includes('vegan') && <span class="tag tag--veg">Veganské</span>}
            {r.alcohol && <span class="tag tag--adult">18+</span>}
          </div>
        )}
      </div>
      <div class="card__body">
        <h3 class="card__title">
          <a href={`/recepty/${r.id}/`}>{r.title}</a>
        </h3>
        <ul class="rb__meta">
          <li>
            <Icon name="clock" size={15} />
            {formatDuration(r.min)}
          </li>
          <li>
            <Icon name="wallet" size={15} />
            {r.cost} Kč / porce
          </li>
        </ul>
        <p class="rb__sub">
          {r.categoryLabel} · {r.difficulty}
        </p>
        {m && (
          <p class="small muted" style="margin:6px 0 0">
            {m.got === m.total ? 'Máš všechno doma' : `Máš ${m.got} z ${m.total} surovin, chybí: ${missing.map((i) => names[i] ?? i).join(', ')}${m.total - m.got > 3 ? '…' : ''}`}
          </p>
        )}
      </div>
    </article>
  );
}
