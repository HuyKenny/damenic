import { useEffect, useRef, useState } from 'preact/hooks';
import { searchEntries, type SearchEntry } from '@/lib/search';
import { Icon } from './icons';

const TYPE_LABEL: Record<SearchEntry['type'], string> = { restaurace: 'Restaurace', jidlo: 'Jídlo', recept: 'Recept' };
let indexPromise: Promise<SearchEntry[]> | null = null;
const loadIndex = () => (indexPromise ??= fetch('/data/search.json').then((r) => (r.ok ? r.json() : [])).catch(() => []));

/** Client-side search over a small static index. Diacritics are optional ("svickova"). */
export default function Search() {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const results = index && query.trim().length >= 2 ? searchEntries(index, query) : [];
  const showPanel = open && query.trim().length >= 2;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && showPanel && results[active]) {
      e.preventDefault();
      location.href = results[active].url;
    }
  }

  return (
    <div class="search" ref={root} role="search">
      <label class="search__field">
        <Icon name="search" size={18} />
        <span class="sr-only">Hledat restauraci, jídlo nebo kuchyni</span>
        <input
          type="search"
          placeholder="Hledat jídlo nebo restauraci"
          autocomplete="off"
          enterkeyhint="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="vysledky-hledani"
          aria-activedescendant={showPanel && results[active] ? `vysledek-${active}` : undefined}
          value={query}
          onFocus={() => {
            setOpen(true);
            void loadIndex().then(setIndex);
          }}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKey}
        />
      </label>
      {showPanel && (
        <div class="search__panel" id="vysledky-hledani" role="listbox" aria-label="Výsledky hledání">
          {index === null && <p class="search__empty">Načítám…</p>}
          {index !== null && results.length === 0 && (
            <p class="search__empty" role="status">
              Na „{query.trim()}“ nemáme nic. Což je u nás vlastně běžný stav. Zkus jiné slovo, třeba <a href="/restaurace/">projít restaurace</a>.
            </p>
          )}
          {results.map((r, i) => (
            <a class="search__item" id={`vysledek-${i}`} role="option" aria-selected={i === active} href={r.url} key={r.url + r.title} onMouseEnter={() => setActive(i)}>
              <span class="tag">{TYPE_LABEL[r.type]}</span>
              <span>
                {r.title}
                <small>{r.sub}</small>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
