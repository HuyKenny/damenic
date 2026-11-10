import { useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $cart, $catalog } from '@/lib/stores';
import { MAX_QTY, emptyCart, optionNames, removeItem, setQty, totals, unitPrice } from '@/lib/cart';
import { formatCzk } from '@/lib/money';
import type { CartItem, CatalogDish } from '@/lib/types';
import AddToCart from './AddToCart';
import { Dialog } from './Dialog';
import { useInit } from './hooks';
import { Icon } from './icons';

interface Props {
  /** "side" = compact panel next to a menu; "page" = full cart page. */
  variant: 'page' | 'side';
}

function EmptyBagArt() {
  return (
    <svg viewBox="0 0 240 220" aria-hidden="true">
      <path d="M52 70h136l14 122a8 8 0 0 1-8 9H46a8 8 0 0 1-8-9z" fill="#fdeceb" stroke="#b3191f" stroke-width="4" stroke-linejoin="round" />
      <path d="M92 70V52c0-22 56-22 56 0v18" fill="none" stroke="#b3191f" stroke-width="4" stroke-linecap="round" />
      <circle cx="120" cy="140" r="26" fill="none" stroke="#b3191f" stroke-width="4" stroke-dasharray="7 7" />
    </svg>
  );
}

export default function CartView({ variant }: Props) {
  const ready = useInit();
  const cart = useStore($cart);
  const catalog = useStore($catalog);
  const [editing, setEditing] = useState<{ item: CartItem; dish: CatalogDish } | null>(null);
  const side = variant === 'side';

  if (!ready || !catalog)
    return (
      <div class="cartbox" aria-busy="true">
        <h2>Košík</h2>
        <p class="muted">Načítám košík…</p>
      </div>
    );

  const restaurant = cart.restaurantId ? catalog.restaurants[cart.restaurantId] : undefined;
  if (!cart.items.length || !restaurant)
    return side ? (
      <div class="cartbox">
        <h2>Košík</h2>
        <p class="muted" style="margin:6px 0 0">
          Zatím prázdný. Přidej jídlo tlačítkem plus, nic se ti nestane.
        </p>
      </div>
    ) : (
      <div class="empty" data-testid="cart-empty">
        <EmptyBagArt />
        <h2>Košík je prázdný</h2>
        <p>Což je vlastně náš obvyklý stav po doručení. Vyber si jídlo a objednej ho nanečisto.</p>
        <a class="btn" href="/restaurace/">
          Vybrat jídlo
        </a>
      </div>
    );

  const t = totals(cart, catalog);

  return (
    <div class="cartbox" data-testid="cart">
      <h2>{side ? 'Košík' : 'Tvoje neobjednávka'}</h2>
      <p class="muted small" style="margin:0">
        <a href={`/restaurace/${restaurant.slug}/`}>{restaurant.name}</a> · fiktivní restaurace
      </p>
      <ul class="cartlines">
        {cart.items.map((item) => {
          const dish = catalog.dishes[item.dishId];
          if (!dish) return null;
          const names = optionNames(dish, item.choices);
          return (
            <li class={`cartline ${side ? 'cartline--compact' : ''}`} key={item.key} data-testid="cart-line">
              {!side && (dish.image ? <img class="cartline__img" src={dish.image} alt="" width="56" height="56" loading="lazy" /> : <span class="cartline__img" />)}
              <div>
                <div class="cartline__name">{dish.name}</div>
                <div class="cartline__opts">{names.length ? names.join(', ') : 'Bez úprav'}</div>
                <div class="cartline__tools">
                  <div class="qty" role="group" aria-label={`Počet: ${dish.name}`}>
                    <button type="button" onClick={() => $cart.set(setQty(cart, item.key, item.qty - 1))} aria-label={item.qty === 1 ? 'Odebrat položku' : 'Ubrat kus'}>
                      <Icon name={item.qty === 1 ? 'trash' : 'minus'} size={18} />
                    </button>
                    <output data-testid="line-qty">{item.qty}</output>
                    <button type="button" onClick={() => $cart.set(setQty(cart, item.key, item.qty + 1))} disabled={item.qty >= MAX_QTY} aria-label="Přidat kus">
                      <Icon name="plus" size={18} />
                    </button>
                  </div>
                  {dish.optionGroups.length > 0 && (
                    <button type="button" class="link-btn small" onClick={() => setEditing({ item, dish })}>
                      Upravit
                    </button>
                  )}
                  {!side && (
                    <button type="button" class="link-btn small" onClick={() => $cart.set(removeItem(cart, item.key))}>
                      Odstranit
                    </button>
                  )}
                </div>
              </div>
              <div class="cartline__price" data-testid="line-price">
                {formatCzk(unitPrice(dish, item.choices) * item.qty)}
              </div>
            </li>
          );
        })}
      </ul>
      <dl class="sums">
        <div>
          <dt>Jídlo</dt>
          <dd data-testid="sum-subtotal">{formatCzk(t.subtotal)}</dd>
        </div>
        <div>
          <dt>Simulované dopravné</dt>
          <dd data-testid="sum-delivery">{formatCzk(t.delivery)}</dd>
        </div>
        <div>
          <dt>Poplatek za prázdnou tašku</dt>
          <dd>{formatCzk(t.fee)}</dd>
        </div>
        <div class="sums__total">
          <dt>Simulovaná hodnota</dt>
          <dd data-testid="sum-total">{formatCzk(t.total)}</dd>
        </div>
        <div class="sums__real">
          <dt>Skutečně zaplatíš</dt>
          <dd>0 Kč</dd>
        </div>
      </dl>
      <a class="btn btn--block" href="/pokladna/" style="margin-top:14px">
        Pokračovat k pokladně
      </a>
      {!side && (
        <p style="margin:12px 0 0;text-align:center">
          <button type="button" class="link-btn small" onClick={() => $cart.set(emptyCart())}>
            Vyprázdnit košík
          </button>
        </p>
      )}
      <Dialog open={editing !== null} title={editing ? `Upravit: ${editing.dish.name}` : ''} onClose={() => setEditing(null)}>
        {editing && (
          <AddToCart dish={editing.dish} restaurant={restaurant.name} editKey={editing.item.key} initial={editing.item.choices} onDone={() => setEditing(null)} />
        )}
      </Dialog>
    </div>
  );
}
