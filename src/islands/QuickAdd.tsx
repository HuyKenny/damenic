import { useState } from 'preact/hooks';
import type { CatalogDish } from '@/lib/types';
import AddToCart from './AddToCart';
import { Conflict } from './Conflict';
import { Dialog } from './Dialog';
import { restaurantName, tryAdd, useInit } from './hooks';
import { Icon } from './icons';

interface Props {
  dish: CatalogDish;
  restaurant: string;
}

/** Round "+" on menu rows. Items with options open the configuration dialog; plain items are added directly. */
export default function QuickAdd({ dish, restaurant }: Props) {
  useInit();
  const [open, setOpen] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const hasOptions = dish.optionGroups.length > 0;

  function add(replace = false) {
    const result = tryAdd(dish, {}, 1, replace);
    if (result.ok) {
      setConflict(null);
      flash();
    } else if (result.reason === 'other-restaurant') setConflict(restaurantName(result.currentRestaurantId));
  }
  function flash() {
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  }

  return (
    <>
      <button type="button" class="addround" onClick={() => (hasOptions ? setOpen(true) : add())} aria-label={`Přidat do košíku: ${dish.name}`}>
        <Icon name={done ? 'check' : 'plus'} size={22} />
      </button>
      <span class="sr-only" role="status">
        {done ? `${dish.name} přidáno do košíku` : ''}
      </span>
      {hasOptions && (
        <Dialog open={open} title={dish.name} onClose={() => setOpen(false)}>
          <AddToCart
            dish={dish}
            restaurant={restaurant}
            onDone={() => {
              setOpen(false);
              flash();
            }}
          />
        </Dialog>
      )}
      <Conflict open={conflict !== null} current={conflict ?? ''} next={restaurant} onKeep={() => setConflict(null)} onReplace={() => add(true)} />
    </>
  );
}
