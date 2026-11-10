import { useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import type { CatalogDish, Choices } from '@/lib/types';
import { MAX_QTY, normalizeChoices, unitPrice, updateChoices, validateChoices } from '@/lib/cart';
import { formatCzk, formatDelta } from '@/lib/money';
import { $cart } from '@/lib/stores';
import { restaurantName, tryAdd, useInit } from './hooks';
import { Conflict } from './Conflict';
import { Icon } from './icons';

interface Props {
  dish: CatalogDish;
  restaurant: string;
  /** Editing an existing cart line instead of adding a new one. */
  editKey?: string;
  initial?: Choices;
  onDone?: () => void;
}

export default function AddToCart({ dish, restaurant, editKey, initial, onDone }: Props) {
  useInit();
  useStore($cart);
  const [choices, setChoices] = useState<Choices>(initial ?? {});
  const [qty, setQty] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);
  const [added, setAdded] = useState(0);
  const price = unitPrice(dish, normalizeChoices(dish, choices));
  const editing = editKey !== undefined;

  function pick(groupId: string, optionId: string, type: 'single' | 'multi', checked: boolean) {
    setErrors([]);
    setAdded(0);
    setChoices((prev) => {
      const current = prev[groupId] ?? [];
      const next = type === 'single' ? [optionId] : checked ? [...current, optionId] : current.filter((id) => id !== optionId);
      return { ...prev, [groupId]: next };
    });
  }

  function submit(replace = false) {
    const problems = validateChoices(dish, normalizeChoices(dish, choices));
    if (problems.length) {
      setErrors(problems);
      return;
    }
    if (editing) {
      const result = updateChoices($cart.get(), editKey, dish, choices);
      if (result.ok) $cart.set(result.cart);
      onDone?.();
      return;
    }
    const result = tryAdd(dish, choices, qty, replace);
    if (result.ok) {
      setConflict(null);
      setAdded(qty);
      setQty(1);
      onDone?.();
    } else if (result.reason === 'other-restaurant') setConflict(restaurantName(result.currentRestaurantId));
    else setErrors(result.errors);
  }

  return (
    <form
      class="opts"
      data-testid="add-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {dish.optionGroups.map((group) => {
        const picked = choices[group.id] ?? [];
        const full = group.type === 'multi' && group.max !== undefined && picked.length >= group.max;
        return (
          <fieldset key={group.id}>
            <legend>
              <span>{group.name}</span>
              <span class={`tag ${group.required ? 'tag--red' : ''}`}>
                {group.required ? 'Povinné' : group.max ? `Volitelné, max. ${group.max}` : 'Volitelné'}
              </span>
            </legend>
            {group.options.map((o) => {
              const checked = picked.includes(o.id);
              return (
                <label class="opt" key={o.id}>
                  <input
                    type={group.type === 'single' ? 'radio' : 'checkbox'}
                    name={`${dish.id}-${group.id}`}
                    value={o.id}
                    checked={checked}
                    disabled={!checked && full}
                    onChange={(e) => pick(group.id, o.id, group.type, e.currentTarget.checked)}
                  />
                  <span>{o.name}</span>
                  <em>{formatDelta(o.priceDelta)}</em>
                </label>
              );
            })}
          </fieldset>
        );
      })}
      {errors.length > 0 && (
        <p class="opts__error" role="alert">
          {errors.join('. ')}.
        </p>
      )}
      <div class="addrow">
        {!editing && (
          <div class="qty" role="group" aria-label="Počet kusů">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Ubrat kus">
              <Icon name="minus" size={18} />
            </button>
            <output aria-live="polite">{qty}</output>
            <button type="button" onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))} disabled={qty >= MAX_QTY} aria-label="Přidat kus">
              <Icon name="plus" size={18} />
            </button>
          </div>
        )}
        <button type="submit" class="btn">
          {editing ? 'Uložit změny' : 'Do košíku'} · <span class="num nowrap">{formatCzk(price * (editing ? 1 : qty))}</span>
        </button>
      </div>
      <p class="small muted" style="margin:10px 0 0">
        Simulovaná cena. Ve skutečnosti nezaplatíš nic.
      </p>
      {added > 0 && (
        <p class="added" role="status">
          <Icon name="check" /> Přidáno do košíku ({added}×)
          <a href="/kosik/">Zobrazit košík</a>
        </p>
      )}
      <Conflict open={conflict !== null} current={conflict ?? ''} next={restaurant} onKeep={() => setConflict(null)} onReplace={() => submit(true)} />
    </form>
  );
}
