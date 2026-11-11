import { useState } from 'preact/hooks';
import type { CatalogDish } from '@/lib/types';
import { formatCzk } from '@/lib/money';
import AddToCart from './AddToCart';
import { Conflict } from './Conflict';
import { Dialog } from './Dialog';
import { restaurantName, tryAdd, useInit } from './hooks';
import { Icon } from './icons';

const ALLERGENS = ['', 'lepek', 'korýši', 'vejce', 'ryby', 'arašídy', 'sója', 'mléko', 'skořápkové plody', 'celer', 'hořčice', 'sezam', 'oxid siřičitý', 'vlčí bob', 'měkkýši'];

interface Props {
  dish: CatalogDish;
  restaurant: string;
  /** Large photo for the sheet header (already optimised). */
  photo?: { src: string; srcset: string } | null;
  description: string;
  allergens: number[];
  recipeUrl: string | null;
  pageUrl: string | null;
}

/**
 * The round "+" on a menu row and the whole row open the dish sheet, like delivery apps do.
 * Items without any option are added straight away.
 */
export default function QuickAdd({ dish, restaurant, photo, description, allergens, recipeUrl, pageUrl }: Props) {
  useInit();
  const [open, setOpen] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const hasOptions = dish.optionGroups.length > 0;

  function flash() {
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  }
  function add(replace = false) {
    const result = tryAdd(dish, {}, 1, replace);
    if (result.ok) {
      setConflict(null);
      flash();
    } else if (result.reason === 'other-restaurant') setConflict(restaurantName(result.currentRestaurantId));
  }

  return (
    <>
      <button type="button" class="menuitem__hit" onClick={() => setOpen(true)} aria-label={`Zobrazit: ${dish.name}`} data-testid="open-dish" />
      <button type="button" class={`addround ${done ? 'is-done' : ''}`} onClick={() => (hasOptions ? setOpen(true) : add())} aria-label={`Přidat do košíku: ${dish.name}`}>
        <Icon name={done ? 'check' : 'plus'} size={22} />
      </button>
      <span class="sr-only" role="status">
        {done ? `${dish.name} přidáno do košíku` : ''}
      </span>
      <Dialog
        open={open}
        title={dish.name}
        onClose={() => setOpen(false)}
        variant="sheet"
        media={photo ? <img src={photo.src} srcset={photo.srcset} sizes="(min-width: 640px) 560px, 100vw" alt="" width="560" height="315" /> : undefined}
      >
        <p class="sheet__desc">{description}</p>
        <p class="sheet__price">
          <span class="num">{formatCzk(dish.price)}</span> <span class="tag tag--sim">simulovaná cena</span>
        </p>
        {allergens.length > 0 && (
          <p class="sheet__allergens small muted">
            Alergeny: {allergens.map((a) => `${a} ${ALLERGENS[a]}`).join(', ')}
          </p>
        )}
        {(recipeUrl || pageUrl) && (
          <p class="sheet__links">
            {recipeUrl && (
              <a class="chiplink" href={recipeUrl}>
                <Icon name="chef" size={16} /> Uvařit doma podle receptu
              </a>
            )}
            {pageUrl && (
              <a class="chiplink" href={pageUrl}>
                Více o jídle
              </a>
            )}
          </p>
        )}
        <AddToCart
          dish={dish}
          restaurant={restaurant}
          onDone={() => {
            setOpen(false);
            flash();
          }}
        />
      </Dialog>
      <Conflict open={conflict !== null} current={conflict ?? ''} next={restaurant} onKeep={() => setConflict(null)} onReplace={() => add(true)} />
    </>
  );
}
