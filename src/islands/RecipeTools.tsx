import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import type { IngredientInfo, RecipeLite } from '@/lib/types';
import { compare, recipeCost } from '@/lib/costs';
import { SERVICE_FEE } from '@/lib/cart';
import { formatCzk, roundToCrown } from '@/lib/money';
import { formatAmount, scaleAmount } from '@/lib/units';
import { MAX_SERVINGS, addRecipe } from '@/lib/shopping';
import { $shopping } from '@/lib/stores';
import { useInit } from './hooks';
import { Icon } from './icons';

export interface DishRef {
  name: string;
  slug: string;
  /** Simulated price of one portion, haléře. */
  price: number;
  restaurant: string;
  deliveryFee: number;
}

interface Props {
  recipe: RecipeLite;
  info: Record<string, IngredientInfo>;
  /** The simulated dish this recipe stands in for, if any. */
  dish: DishRef | null;
  /** Server-rendered extras placed right under the buttons (the partner call to action). */
  children?: ComponentChildren;
}

/** Portion switcher, ingredient list, the three cost figures and the shopping-list button. */
export default function RecipeTools({ recipe, info, dish, children }: Props) {
  useInit();
  const shopping = useStore($shopping);
  const [servings, setServings] = useState(recipe.servings);
  const [added, setAdded] = useState(false);
  const cost = recipeCost(recipe.ingredients, recipe.servings, servings, info);
  const cmp = dish ? compare(dish.price, servings, dish.deliveryFee, SERVICE_FEE, cost.consumed) : null;
  const inList = shopping.recipes.some((r) => r.slug === recipe.slug);

  const groups: { name: string; items: RecipeLite['ingredients'] }[] = [];
  for (const ing of recipe.ingredients) {
    const name = ing.group ?? '';
    const g = groups.find((x) => x.name === name);
    if (g) g.items.push(ing);
    else groups.push({ name, items: [ing] });
  }

  return (
    <div class="ingr" data-testid="recipe-tools">
      <div class="servings">
        <h2 id="suroviny">Suroviny</h2>
        <div class="qty no-print" role="group" aria-label="Počet porcí">
          <button type="button" onClick={() => setServings((s) => Math.max(1, s - 1))} disabled={servings <= 1} aria-label="Méně porcí">
            <Icon name="minus" size={18} />
          </button>
          <output data-testid="servings" aria-live="polite">
            {servings}
          </output>
          <button type="button" onClick={() => setServings((s) => Math.min(MAX_SERVINGS, s + 1))} disabled={servings >= MAX_SERVINGS} aria-label="Více porcí">
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>
      <p class="muted small" style="margin:0">
        Množství pro {servings} {servings === 1 ? 'porci' : servings < 5 ? 'porce' : 'porcí'}
        {servings !== recipe.servings && ` (recept je psaný na ${recipe.servings}, časy se mohou lišit)`}.
      </p>
      {groups.map((g) => (
        <div key={g.name}>
          {g.name && <h3>{g.name}</h3>}
          <ul>
            {g.items.map((ing, i) => {
              const item = info[ing.ingredient];
              return (
                <li key={`${ing.ingredient}-${i}`} data-ingredient={ing.ingredient}>
                  <b>{formatAmount(scaleAmount(ing.amount, ing.unit, recipe.servings, servings), ing.unit)}</b>
                  <span>
                    {item?.name ?? ing.ingredient}
                    {ing.note && <small>{ing.note}</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div class="toolbar no-print">
        <button
          type="button"
          class="btn"
          data-testid="add-to-list"
          onClick={() => {
            $shopping.set(addRecipe($shopping.get(), recipe.slug, servings));
            setAdded(true);
          }}
        >
          <Icon name="list" /> {inList ? 'Aktualizovat v nákupním seznamu' : 'Přidat do nákupního seznamu'}
        </button>
        <button type="button" class="btn btn--ghost" onClick={() => window.print()}>
          <Icon name="printer" /> Vytisknout
        </button>
      </div>
      {added && (
        <p class="added no-print" role="status">
          <Icon name="check" /> V seznamu pro {servings} {servings === 1 ? 'porci' : servings < 5 ? 'porce' : 'porcí'}
          <a href="/nakupni-seznam/">Otevřít seznam</a>
        </p>
      )}
      {children}

      <section class="costbox" aria-labelledby="naklady" data-testid="costs">
        <h3 id="naklady">Odhad nákladů</h3>
        <dl class="compare">
          <div>
            <dt>Spotřebované suroviny ({servings} {servings === 1 ? 'porce' : servings < 5 ? 'porce' : 'porcí'})</dt>
            <dd data-testid="cost-consumed">≈ {formatCzk(roundToCrown(cost.consumed))}</dd>
          </div>
          <div>
            <dt>Na jednu porci</dt>
            <dd data-testid="cost-per-serving">≈ {formatCzk(roundToCrown(cost.consumed / servings))}</dd>
          </div>
          <div>
            <dt>Nákup celých balení, když doma není nic</dt>
            <dd data-testid="cost-packs">≈ {formatCzk(cost.packs)}</dd>
          </div>
          {cmp && dish && (
            <>
              <div class="is-diff">
                <dt>
                  Simulovaný rozvoz: {servings}× <a href={`/jidla/${dish.slug}/`}>{dish.name}</a>, doprava a poplatek jednou
                </dt>
                <dd data-testid="cost-delivery">{formatCzk(cmp.delivery)}</dd>
              </div>
              <div>
                <dt>{cmp.difference >= 0 ? 'Potenciální úspora při těchto předpokladech' : 'Doma vychází dráž o'}</dt>
                <dd class={cmp.difference >= 0 ? 'pos' : 'neg'} data-testid="cost-diff">
                  ≈ {formatCzk(roundToCrown(Math.abs(cmp.difference)))}
                </dd>
              </div>
            </>
          )}
        </dl>
        <p>
          Ceny surovin jsou ilustrační odhady, ne aktuální ceny žádného obchodu. „Spotřebované suroviny“ počítají jen použitou část balení, „celá
          balení“ to, co bys zaplatil u pokladny. Nezahrnuto: energie a tvůj čas.
          {cmp && ' Rozvoz je smyšlený a jeho cena simulovaná, takže rozdíl je jen orientační porovnání dvou odhadů.'}
          {cost.unpriced.length > 0 && ' Některé suroviny se nepodařilo ocenit a v součtu chybí.'}
        </p>
      </section>
    </div>
  );
}
