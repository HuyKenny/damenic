import { useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import type { IngredientInfo, RecipeLite } from '@/lib/types';
import { MAX_SERVINGS, buildShoppingList, emptyShopping, removeRecipe, setServings, toggleChecked, toggleHave } from '@/lib/shopping';
import { formatCzk } from '@/lib/money';
import { formatAmount } from '@/lib/units';
import { $shopping } from '@/lib/stores';
import { useInit } from './hooks';
import { Icon } from './icons';

interface Props {
  recipes: Record<string, RecipeLite>;
  info: Record<string, IngredientInfo>;
}

export default function ShoppingList({ recipes, info }: Props) {
  const ready = useInit();
  const state = useStore($shopping);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  if (!ready)
    return (
      <p class="muted" aria-busy="true">
        Načítám seznam…
      </p>
    );
  const known = state.recipes.filter((r) => recipes[r.slug]);
  if (!known.length)
    return (
      <div class="empty" data-testid="list-empty">
        <h2>Seznam je prázdný</h2>
        <p>Seznam je prázdný jako taška kurýra. Otevři recept, nastav počet porcí a přidej ho. Stejné suroviny z více receptů se sečtou.</p>
        <a class="btn" href="/recepty/">
          Vybrat recept
        </a>
      </div>
    );

  const list = buildShoppingList(state, recipes, info);

  async function copy() {
    const lines: string[] = ['Nákupní seznam (DámeNic)'];
    for (const g of list.groups) {
      const items = g.lines.filter((l) => !l.have);
      if (!items.length) continue;
      lines.push('', g.department);
      for (const l of items) lines.push(`- ${l.name}: ${formatAmount(Math.round(l.amount), l.baseUnit)}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  }

  return (
    <div class="cols" data-testid="shopping">
      <div>
        {list.groups.map((g) => (
          <section class="shop__dept" key={g.department}>
            <h2>{g.department}</h2>
            <ul>
              {g.lines.map((l) => (
                <li class={`shopline ${l.checked ? 'is-checked' : ''} ${l.have ? 'is-have' : ''}`} key={l.ingredientId} data-testid="shop-line" data-ingredient={l.ingredientId}>
                  <input type="checkbox" id={`sl-${l.ingredientId}`} checked={l.checked} onChange={() => $shopping.set(toggleChecked($shopping.get(), l.ingredientId))} class="no-print" />
                  <label for={`sl-${l.ingredientId}`}>
                    <span class="shopline__name">{l.name}</span> <span class="num" data-testid="shop-amount">{formatAmount(Math.round(l.amount), l.baseUnit)}</span>
                    <small>
                      {l.have ? 'Mám doma, nekupuju' : `Koupit: ${l.packs}× ${l.packLabel}`} · {l.recipes.join(', ')}
                    </small>
                  </label>
                  <div class="shopline__side">
                    <span class="num" data-testid="shop-cost">
                      {l.have ? '0 Kč' : `≈ ${formatCzk(l.packsCost)}`}
                    </span>
                    <button type="button" class="toggle no-print" aria-pressed={l.have} onClick={() => $shopping.set(toggleHave($shopping.get(), l.ingredientId))} data-testid="have">
                      Mám doma
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {list.skipped.length > 0 && <p class="note" style="margin-top:16px">Tyto suroviny se nepodařilo sečíst kvůli jednotkám: {list.skipped.join(', ')}.</p>}
      </div>
      <aside class="stack">
        <section class="panel">
          <h2>Recepty v seznamu</h2>
          {known.map((r) => (
            <div class="recipepick" key={r.slug} data-testid="list-recipe">
              <div>
                <a href={`/recepty/${r.slug}/`}>
                  <strong>{recipes[r.slug]!.title}</strong>
                </a>
                <div>
                  <button type="button" class="link-btn small no-print" style="min-height:32px" onClick={() => $shopping.set(removeRecipe($shopping.get(), r.slug))}>
                    Odebrat
                  </button>
                </div>
              </div>
              <div class="qty" role="group" aria-label={`Porce: ${recipes[r.slug]!.title}`}>
                <button type="button" onClick={() => $shopping.set(setServings($shopping.get(), r.slug, r.servings - 1))} disabled={r.servings <= 1} aria-label="Méně porcí">
                  <Icon name="minus" size={18} />
                </button>
                <output>{r.servings}</output>
                <button type="button" onClick={() => $shopping.set(setServings($shopping.get(), r.slug, r.servings + 1))} disabled={r.servings >= MAX_SERVINGS} aria-label="Více porcí">
                  <Icon name="plus" size={18} />
                </button>
              </div>
            </div>
          ))}
        </section>
        <section class="panel" data-testid="list-totals">
          <h2>Orientační součet</h2>
          <dl class="compare">
            <div>
              <dt>K nákupu (celá balení, bez toho, co máš doma)</dt>
              <dd data-testid="list-to-buy">≈ {formatCzk(list.toBuy)}</dd>
            </div>
            <div>
              <dt>Hodnota všeho, co se spotřebuje</dt>
              <dd data-testid="list-consumed">≈ {formatCzk(list.consumed)}</dd>
            </div>
          </dl>
          <p class="small muted" style="margin:10px 0 0">
            Ilustrační ceny, ne nabídka žádného obchodu. „Mám doma“ sníží nákup, ale surovina, kterou spotřebuješ, má pořád svou hodnotu, proto ve
            druhém řádku zůstává.
          </p>
        </section>
        <section class="panel no-print">
          <h2>Seznam s sebou</h2>
          <div class="stack" style="gap:10px">
            <button type="button" class="btn btn--block" onClick={copy} data-testid="copy-list">
              <Icon name="copy" /> Zkopírovat do schránky
            </button>
            <button type="button" class="btn btn--ghost btn--block" onClick={() => window.print()}>
              <Icon name="printer" /> Vytisknout
            </button>
            <button type="button" class="link-btn small" onClick={() => $shopping.set(emptyShopping())}>
              Vymazat celý seznam
            </button>
          </div>
          {copied && (
            <p class="added" role="status">
              {copied === 'ok' ? 'Zkopírováno. Vlož to do poznámek nebo zprávy.' : 'Kopírování prohlížeč nepovolil. Použij tisk.'}
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
