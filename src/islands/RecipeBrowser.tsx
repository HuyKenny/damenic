import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  COST_STEPS,
  DIET_FACETS,
  DIFFICULTIES,
  EMPTY_RECIPE_FILTERS,
  FAMILY_LABELS,
  MEAL_LABELS,
  METHOD_FACETS,
  RECIPE_SORTS,
  TIME_STEPS,
  applyRecipeFilters,
  countBy,
  foldText,
  haveMatch,
  parseRecipeQuery,
  recipeFilterCount,
  recipeFiltersToQuery,
  type DietKey,
  type MethodKey,
  type RecipeFilters,
  type RecipeSort,
  type RecipeSummary,
} from '@/lib/recipe-facets';
import { formatDuration } from '@/lib/units';
import { Dialog } from './Dialog';
import { Icon } from './icons';

interface Props {
  /** Cuisine chips (id + label) and occasion chips, prepared by the page. */
  categories: { id: string; label: string }[];
  occasions: { id: string; label: string }[];
  total: number;
}

interface Index {
  recipes: RecipeSummary[];
  ingredients: { id: string; name: string }[];
}

const PAGE = 24;
const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const cz = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

/**
 * Recipe filters over a static JSON index (fetched on first use). State is mirrored to the query string so a filtered
 * view can be shared, but the canonical URL stays /recepty/ and no filter combination is indexed. While no filter is
 * active the server-rendered category sections stay visible (they are what search engines read); once a filter,
 * search or "all recipes" is on, they are hidden and this island shows the results.
 */
export default function RecipeBrowser({ categories, occasions, total }: Props) {
  const [f, setF] = useState<RecipeFilters>(EMPTY_RECIPE_FILTERS);
  const [idx, setIdx] = useState<Index | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pick, setPick] = useState('');
  const [ready, setReady] = useState(false);

  const n = recipeFilterCount(f);
  const active = n > 0 || showAll;

  useEffect(() => {
    const parsed = parseRecipeQuery(location.search);
    setF(parsed);
    setShowAll(location.search.includes('vse'));
    setReady(true);
  }, []);

  // the index is fetched only when somebody uses the filters
  useEffect(() => {
    if (!active || idx || failed) return;
    fetch('/data/recipes.json')
      .then((r) => (r.ok ? (r.json() as Promise<Index>) : Promise.reject(new Error(String(r.status)))))
      .then(setIdx)
      .catch(() => setFailed(true));
  }, [active, idx, failed]);

  useEffect(() => {
    const el = document.getElementById('recipe-static');
    if (el) el.hidden = active;
  }, [active]);

  useEffect(() => {
    if (!ready) return;
    const q = recipeFiltersToQuery(f);
    const full = q || (showAll ? '?vse' : '');
    const next = showAll && q ? `${q}&vse` : full;
    if (next !== location.search) history.replaceState(null, '', `${location.pathname}${next}${location.hash}`);
  }, [f, showAll, ready]);

  useEffect(() => setPage(1), [f]);

  const set = (patch: Partial<RecipeFilters>) => setF((prev) => ({ ...prev, ...patch }));
  const list = useMemo(() => (idx ? applyRecipeFilters(idx.recipes, f, new Date()) : []), [idx, f]);
  const counts = useMemo(() => {
    const all = idx?.recipes ?? [];
    return {
      meal: countBy(all, (r) => r.meal),
      family: countBy(all, (r) => r.family),
      category: countBy(all, (r) => r.category),
      occasion: countBy(all, (r) => r.occasions),
    };
  }, [idx]);
  const names = useMemo(() => new Map((idx?.ingredients ?? []).map((i) => [i.id, i.name])), [idx]);
  const suggestions = useMemo(() => {
    const w = foldText(pick.trim());
    if (w.length < 2 || !idx) return [];
    return idx.ingredients.filter((i) => !f.have.includes(i.id) && foldText(i.name).includes(w)).slice(0, 8);
  }, [pick, idx, f.have]);

  const reset = () => {
    setF({ ...EMPTY_RECIPE_FILTERS, sort: f.sort });
    setShowAll(false);
  };
  const chip = (label: string, on: boolean, flip: () => void, extra?: string) => (
    <button type="button" class={`fchip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={flip} key={label}>
      {label}
      {extra ? <small> {extra}</small> : null}
    </button>
  );

  const quick = [
    chip('Do 30 minut', f.maxMin === 30, () => set({ maxMin: f.maxMin === 30 ? null : 30 })),
    chip('Bez masa', f.diets.includes('veg'), () => set({ diets: toggle<DietKey>(f.diets, 'veg') })),
    chip('Veganské', f.diets.includes('vegan'), () => set({ diets: toggle<DietKey>(f.diets, 'vegan') })),
    chip('Bez lepku', f.diets.includes('gf'), () => set({ diets: toggle<DietKey>(f.diets, 'gf') })),
    chip('Levné do 30 Kč', f.maxCost === 30, () => set({ maxCost: f.maxCost === 30 ? null : 30 })),
  ];
  const shown = list.slice(0, page * PAGE);

  return (
    <div class="browser rbrowser" data-testid="recipe-browser">
      <label class="search__field" style="max-width:720px">
        <span class="sr-only">Hledat recept</span>
        <input
          type="search"
          value={f.q}
          maxLength={80}
          onInput={(e) => set({ q: e.currentTarget.value })}
          placeholder="Svíčková, vánoční cukroví, mojito, bez lepku…"
          data-testid="recipe-search"
        />
      </label>

      <ul class="fpanel__chips rbrowser__meals" aria-label="Typ jídla" style="margin-top:12px">
        {Object.entries(MEAL_LABELS).map(([id, label]) => (
          <li key={id}>{chip(label, f.meals.includes(id), () => set({ meals: toggle(f.meals, id) }))}</li>
        ))}
      </ul>

      <div class="filterbar">
        <button type="button" class={`fchip fchip--main ${n ? 'is-on' : ''}`} onClick={() => setOpen(true)} data-testid="open-recipe-filters">
          <Icon name="list" size={18} /> Všechny filtry{n ? ` (${n})` : ''}
        </button>
        {quick}
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

      {!active && (
        <p class="browser__count">
          <button type="button" class="btn btn--ghost" onClick={() => setShowAll(true)} data-testid="show-all-recipes">
            Zobrazit všech {total} receptů
          </button>
        </p>
      )}

      {active && (
        <>
          <p class="browser__count" role="status" aria-live="polite" data-testid="recipe-count">
            {idx ? `${list.length} ${cz(list.length, 'recept', 'recepty', 'receptů')}` : failed ? 'Recepty se nepodařilo načíst.' : 'Načítám recepty…'}
            <button type="button" class="link-btn small" onClick={reset}>
              {n ? 'Zrušit filtry' : 'Zpět na kategorie'}
            </button>
          </p>
          <h2 class="sr-only">Nalezené recepty</h2>
          {idx && shown.length > 0 && (
            <div class="grid grid--dishes" data-testid="recipe-results">
              {shown.map((r, i) => (
                <Tile r={r} have={f.have} eager={i < 3} key={r.id} />
              ))}
            </div>
          )}
          {idx && list.length > shown.length && (
            <p style="text-align:center;margin-top:20px">
              <button type="button" class="btn btn--ghost" onClick={() => setPage((p) => p + 1)} data-testid="more-recipes">
                Zobrazit dalších {Math.min(PAGE, list.length - shown.length)}
              </button>
            </p>
          )}
          {idx && list.length === 0 && (
            <div class="empty" data-testid="recipe-empty">
              <h2>Tohle jsme ještě neuvařili. Ani nanečisto.</h2>
              <p>Zkus ubrat některý filtr, nebo hledej jedním slovem. Recepty přibývají každý týden.</p>
              <button type="button" class="btn" onClick={reset}>
                Zrušit filtry
              </button>
            </div>
          )}
        </>
      )}

      <Dialog open={open} title="Filtry receptů" onClose={() => setOpen(false)} variant="sheet">
        <div class="fpanel">
          <fieldset>
            <legend>Typ jídla</legend>
            <div class="fpanel__chips">
              {Object.entries(MEAL_LABELS).map(([id, label]) => chip(label, f.meals.includes(id), () => set({ meals: toggle(f.meals, id) }), String(counts.meal.get(id) ?? '')))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Hlavní surovina</legend>
            <div class="fpanel__chips">
              {Object.entries(FAMILY_LABELS).map(([id, label]) => chip(label, f.families.includes(id), () => set({ families: toggle(f.families, id) }), String(counts.family.get(id) ?? '')))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Strava a alergeny</legend>
            <div class="fpanel__chips">{DIET_FACETS.map((d) => chip(d.label, f.diets.includes(d.key), () => set({ diets: toggle<DietKey>(f.diets, d.key) })))}</div>
            <p class="small muted">Odvozeno ze surovin receptu. U alergenů vždy čti složení zakoupených surovin: výrobci mění receptury.</p>
          </fieldset>
          <fieldset>
            <legend>Celkový čas (včetně čekání)</legend>
            <div class="fpanel__chips">
              {TIME_STEPS.map((m) => chip(m < 60 ? `Do ${m} min` : `Do ${m / 60} h`, f.maxMin === m, () => set({ maxMin: f.maxMin === m ? null : m })))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Vlastní práce</legend>
            <div class="fpanel__chips">{[10, 20, 30].map((m) => chip(`Do ${m} min`, f.maxAct === m, () => set({ maxAct: f.maxAct === m ? null : m })))}</div>
          </fieldset>
          <fieldset>
            <legend>Obtížnost</legend>
            <div class="fpanel__chips">{DIFFICULTIES.map((d) => chip(d[0]!.toUpperCase() + d.slice(1), f.difficulties.includes(d), () => set({ difficulties: toggle(f.difficulties, d) })))}</div>
          </fieldset>
          <fieldset>
            <legend>Způsob přípravy</legend>
            <div class="fpanel__chips">{METHOD_FACETS.map((m) => chip(m.label, f.methods.includes(m.key), () => set({ methods: toggle<MethodKey>(f.methods, m.key) })))}</div>
          </fieldset>
          <fieldset>
            <legend>Cena na porci (ilustrační)</legend>
            <div class="fpanel__chips">{COST_STEPS.map((c) => chip(`Do ${c} Kč`, f.maxCost === c, () => set({ maxCost: f.maxCost === c ? null : c })))}</div>
          </fieldset>
          <fieldset>
            <legend>Kuchyně</legend>
            <div class="fpanel__chips">{categories.map((c) => chip(c.label, f.categories.includes(c.id), () => set({ categories: toggle(f.categories, c.id) }), String(counts.category.get(c.id) ?? '')))}</div>
          </fieldset>
          <fieldset>
            <legend>Svátky a oslavy</legend>
            <div class="fpanel__chips">{occasions.map((o) => chip(o.label, f.occasions.includes(o.id), () => set({ occasions: toggle(f.occasions, o.id) }), String(counts.occasion.get(o.id) ?? '')))}</div>
          </fieldset>
          <fieldset>
            <legend>Alkohol (jen pro 18+)</legend>
            <div class="fpanel__chips">
              {chip('Bez alkoholu', f.alcohol === 'no', () => set({ alcohol: f.alcohol === 'no' ? 'any' : 'no' }))}
              {chip('Jen s alkoholem', f.alcohol === 'only', () => set({ alcohol: f.alcohol === 'only' ? 'any' : 'only' }))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Co mám doma</legend>
            <label class="search__field">
              <span class="sr-only">Surovina, kterou máš doma</span>
              <input type="search" value={pick} onInput={(e) => setPick(e.currentTarget.value)} placeholder="Napiš surovinu: vejce, mouka, kuřecí…" data-testid="have-input" />
            </label>
            {suggestions.length > 0 && (
              <div class="fpanel__chips" style="margin-top:8px">
                {suggestions.map((s) => (
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
              <div class="fpanel__chips" style="margin-top:8px">
                {f.have.map((id) => chip(`${names.get(id) ?? id} ×`, true, () => set({ have: f.have.filter((x) => x !== id) })))}
              </div>
            )}
            <p class="small muted">Recepty se seřadí podle toho, kolik surovin ti chybí. Sůl, olej a voda se nepočítají.</p>
          </fieldset>
          <div class="dlg__actions">
            <button type="button" class="btn btn--ghost" onClick={reset}>
              Zrušit vše
            </button>
            <button type="button" class="btn" onClick={() => setOpen(false)} data-testid="apply-recipe-filters">
              {idx ? `Zobrazit ${list.length} ${cz(list.length, 'recept', 'recepty', 'receptů')}` : 'Zobrazit recepty'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function Tile({ r, have, eager }: { r: RecipeSummary; have: string[]; eager: boolean }) {
  const m = have.length ? haveMatch(r, have) : null;
  return (
    <article class="card">
      <div class="card__media">
        {r.img ? (
          <img
            src={r.img.src}
            srcset={r.img.srcset}
            sizes="(min-width: 1000px) 300px, (min-width: 560px) 50vw, 100vw"
            alt={r.img.alt}
            width="420"
            height="262"
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
          />
        ) : (
          <div class="photo--empty" role="img" aria-label="Fotografie se připravuje" />
        )}
        <div class="card__badges">
          {r.diets.includes('veg') && <span class="tag tag--veg">Bez masa</span>}
          {r.alcohol && <span class="tag tag--adult">18+</span>}
        </div>
      </div>
      <div class="card__body">
        <h3 class="card__title">
          <a href={`/recepty/${r.id}/`}>{r.title}</a>
        </h3>
        <ul class="card__meta">
          <li>
            <span>
              <Icon name="clock" size={16} />
              {formatDuration(r.min)}
            </span>
          </li>
          <li>
            <span>
              <Icon name="wallet" size={16} />
              {r.cost} Kč / porce
            </span>
          </li>
          <li>
            <span>
              <Icon name="chef" size={16} />
              {r.difficulty}
            </span>
          </li>
        </ul>
        {m && (
          <p class="small muted" style="margin-top:6px">
            {m.got === m.total ? 'Máš všechno doma' : `Máš ${m.got} z ${m.total} surovin`}
          </p>
        )}
      </div>
    </article>
  );
}
