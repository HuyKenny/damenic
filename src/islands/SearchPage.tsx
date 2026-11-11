import { useEffect, useState } from 'preact/hooks';
import { searchEntries, type SearchEntry } from '@/lib/search';

const TYPE_LABEL: Record<SearchEntry['type'], string> = { restaurace: 'Restaurace', jidlo: 'Jídlo', recept: 'Recept' };

/** Full search page (/hledat/?q=…), the target of the site's SearchAction. Never indexed. */
export default function SearchPage() {
  const [q, setQ] = useState('');
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  useEffect(() => {
    setQ(new URLSearchParams(location.search).get('q') ?? '');
    fetch('/data/search.json')
      .then((r) => (r.ok ? r.json() : []))
      .then(setIndex)
      .catch(() => setIndex([]));
  }, []);
  useEffect(() => {
    const url = q ? `?q=${encodeURIComponent(q)}` : location.pathname;
    history.replaceState(null, '', url);
  }, [q]);
  const results = index && q.trim().length >= 2 ? searchEntries(index, q, 60) : [];
  const groups = (['restaurace', 'jidlo', 'recept'] as const).map((t) => ({ t, items: results.filter((r) => r.type === t) })).filter((g) => g.items.length);
  return (
    <div data-testid="search-page">
      <label class="search__field" style="max-width:640px">
        <span class="sr-only">Hledat</span>
        <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="Pizza, svíčková, sushi…" autofocus />
      </label>
      {q.trim().length >= 2 && index && !results.length && <p class="muted" style="margin-top:16px">Na „{q.trim()}“ nemáme nic. Zkus jiné slovo.</p>}
      {groups.map((g) => (
        <section key={g.t} style="margin-top:20px">
          <h2 style="font-size:1.125rem">{TYPE_LABEL[g.t]}</h2>
          <ul class="stack" style="gap:6px;margin-top:8px">
            {g.items.map((r) => (
              <li key={r.url + r.title}>
                <a class="search__item" href={r.url}>
                  <span>
                    {r.title}
                    <small>{r.sub}</small>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
