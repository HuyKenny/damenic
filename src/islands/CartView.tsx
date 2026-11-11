import { useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $cart, $catalog, $checkout } from '@/lib/stores';
import { MAX_QTY, emptyCart, optionNames, removeItem, setQty, totals, unitPrice } from '@/lib/cart';
import { formatCzk } from '@/lib/money';
import type { CartItem, CatalogDish, Totals } from '@/lib/types';
import AddToCart from './AddToCart';
import { Dialog } from './Dialog';
import { tryAdd, useInit } from './hooks';
import { Icon } from './icons';

interface Props {
  /** "side" = sticky panel next to a menu, "drawer" = slide-in panel, "page" = /kosik/. */
  variant: 'page' | 'side' | 'drawer';
}

function EmptyBagArt() {
  return (
    <svg viewBox="0 0 240 220" aria-hidden="true">
      <path d="M52 70h136l14 122a8 8 0 0 1-8 9H46a8 8 0 0 1-8-9z" fill="#ffe9ea" stroke="#1f1f23" stroke-width="5" stroke-linejoin="round" />
      <path d="M92 70V52c0-22 56-22 56 0v18" fill="none" stroke="#1f1f23" stroke-width="5" stroke-linecap="round" />
      <path d="M96 128c8 14 40 14 48 0" fill="none" stroke="#d92e32" stroke-width="6" stroke-linecap="round" />
      <circle cx="102" cy="108" r="6" fill="#1f1f23" />
      <circle cx="138" cy="108" r="6" fill="#1f1f23" />
    </svg>
  );
}

export function Sums({ t, pickup }: { t: Totals; pickup: boolean }) {
  return (
    <dl class="sums">
      <div>
        <dt>Jídlo</dt>
        <dd data-testid="sum-subtotal">{formatCzk(t.subtotal)}</dd>
      </div>
      <div>
        <dt>{pickup ? 'Osobní odběr' : 'Simulované dopravné'}</dt>
        <dd data-testid="sum-delivery">{formatCzk(t.delivery)}</dd>
      </div>
      <div>
        <dt>Servisní poplatek</dt>
        <dd>{formatCzk(t.fee)}</dd>
      </div>
      {t.tip > 0 && (
        <div>
          <dt>Spropitné kurýrovi</dt>
          <dd data-testid="sum-tip">{formatCzk(t.tip)}</dd>
        </div>
      )}
      {t.discount > 0 && (
        <div class="sums__discount">
          <dt>Sleva ({t.applied.filter((a) => !a.startsWith('Dopravné')).join(', ') || 'akce'})</dt>
          <dd data-testid="sum-discount">− {formatCzk(t.discount)}</dd>
        </div>
      )}
      {t.applied.some((a) => a.startsWith('Dopravné')) && (
        <div class="sums__discount">
          <dt>Akce restaurace</dt>
          <dd>Dopravné 0 Kč</dd>
        </div>
      )}
      <div class="sums__total">
        <dt>Simulovaná hodnota</dt>
        <dd data-testid="sum-total">{formatCzk(t.total)}</dd>
      </div>
      <div class="sums__real">
        <dt>Skutečně zaplatíš</dt>
        <dd>0 Kč</dd>
      </div>
    </dl>
  );
}

export function ModeSwitch({ canPickup }: { canPickup: boolean }) {
  const opts = useStore($checkout);
  return (
    <div class="seg" role="radiogroup" aria-label="Způsob převzetí">
      <button type="button" role="radio" aria-checked={opts.mode === 'delivery'} onClick={() => $checkout.set({ ...opts, mode: 'delivery' })}>
        <Icon name="bike" size={18} /> Doručení
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={opts.mode === 'pickup'}
        disabled={!canPickup}
        onClick={() => $checkout.set({ ...opts, mode: 'pickup' })}
        data-testid="mode-pickup"
      >
        <Icon name="walk" size={18} /> Osobní odběr
      </button>
    </div>
  );
}

export default function CartView({ variant }: Props) {
  const ready = useInit();
  const cart = useStore($cart);
  const catalog = useStore($catalog);
  const opts = useStore($checkout);
  const [editing, setEditing] = useState<{ item: CartItem; dish: CatalogDish } | null>(null);
  const compact = variant !== 'page';

  if (!ready || !catalog)
    return (
      <div class={variant === 'drawer' ? '' : 'cartbox'} aria-busy="true">
        <p class="muted">Načítám košík…</p>
      </div>
    );

  const restaurant = cart.restaurantId ? catalog.restaurants[cart.restaurantId] : undefined;
  if (!cart.items.length || !restaurant)
    return variant === 'side' ? (
      <div class="cartbox cartbox--empty">
        <EmptyBagArt />
        <h2>Košík je prázdný</h2>
        <p class="muted">Přidej jídlo plusem u položky. Nic se ti nestane, ani kdybys přidal všechno.</p>
      </div>
    ) : (
      <div class="empty" data-testid="cart-empty">
        <EmptyBagArt />
        <h2>Košík je prázdný</h2>
        <p>Taška je lehká jako slib. Vyber si jídlo a objednej ho nanečisto.</p>
        <a class="btn" href="/restaurace/">
          Vybrat jídlo
        </a>
      </div>
    );

  const t = totals(cart, catalog, opts);
  const pickup = opts.mode === 'pickup' && restaurant.pickup;
  const upsell = Object.values(catalog.dishes)
    .filter((d) => d.restaurantId === restaurant.id && !d.page && !cart.items.some((i) => i.dishId === d.id))
    .slice(0, 4);
  const progress = restaurant.minOrder ? Math.min(1, t.subtotal / restaurant.minOrder) : 1;

  return (
    <div class={variant === 'drawer' ? 'cartdrawer' : 'cartbox'} data-testid="cart">
      {variant !== 'drawer' && <h2>{compact ? 'Košík' : 'Tvoje neobjednávka'}</h2>}
      <p class="muted small" style="margin:0 0 10px">
        <a href={`/restaurace/${restaurant.slug}/`}>{restaurant.name}</a> · fiktivní restaurace
      </p>
      <ModeSwitch canPickup={restaurant.pickup} />
      <ul class="cartlines">
        {cart.items.map((item) => {
          const dish = catalog.dishes[item.dishId];
          if (!dish) return null;
          const names = optionNames(dish, item.choices);
          return (
            <li class="cartline" key={item.key} data-testid="cart-line">
              {dish.image ? <img class="cartline__img" src={dish.image} alt="" width="56" height="56" loading="lazy" /> : <span class="cartline__img" />}
              <div>
                <div class="cartline__name">{dish.name}</div>
                <div class="cartline__opts">{names.length ? names.join(', ') : 'Bez úprav'}</div>
                <div class="cartline__tools">
                  <div class="qty qty--sm" role="group" aria-label={`Počet: ${dish.name}`}>
                    <button type="button" onClick={() => $cart.set(setQty(cart, item.key, item.qty - 1))} aria-label={item.qty === 1 ? 'Odebrat položku' : 'Ubrat kus'}>
                      <Icon name={item.qty === 1 ? 'trash' : 'minus'} size={16} />
                    </button>
                    <output data-testid="line-qty">{item.qty}</output>
                    <button type="button" onClick={() => $cart.set(setQty(cart, item.key, item.qty + 1))} disabled={item.qty >= MAX_QTY} aria-label="Přidat kus">
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                  {dish.optionGroups.length > 0 && (
                    <button type="button" class="link-btn small" onClick={() => setEditing({ item, dish })}>
                      Upravit
                    </button>
                  )}
                  {!compact && (
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

      {upsell.length > 0 && (
        <section class="upsell" aria-label="K tomu se hodí">
          <h3>K tomu se hodí</h3>
          <ul>
            {upsell.map((d) => (
              <li key={d.id}>
                {d.image ? <img src={d.image} alt="" width="56" height="56" loading="lazy" /> : <span class="upsell__ph" />}
                <span class="upsell__name">{d.name}</span>
                <span class="upsell__price num">{formatCzk(d.price)}</span>
                <button
                  type="button"
                  class="addround addround--sm"
                  aria-label={`Přidat: ${d.name}`}
                  onClick={() => (d.optionGroups.some((g) => g.required) ? setEditing({ item: { key: '', dishId: d.id, qty: 1, choices: {} }, dish: d }) : tryAdd(d, {}, 1))}
                >
                  <Icon name="plus" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {t.missingToMin > 0 && (
        <div class="minorder" data-testid="min-order">
          <div class="bar" aria-hidden="true">
            <i style={{ width: `${(progress * 100).toFixed(0)}%` }} />
          </div>
          <p>
            Do minimální objednávky {formatCzk(restaurant.minOrder)} chybí <strong>{formatCzk(t.missingToMin)}</strong>.
          </p>
        </div>
      )}

      <Sums t={t} pickup={pickup} />
      {t.missingToMin > 0 ? (
        <button type="button" class="btn btn--block" disabled style="margin-top:14px" data-testid="to-checkout">
          Přidej ještě za {formatCzk(t.missingToMin)}
        </button>
      ) : (
        <a class="btn btn--block" href="/pokladna/" style="margin-top:14px" data-testid="to-checkout">
          Pokračovat k pokladně · {formatCzk(t.total)}
        </a>
      )}
      {!compact && (
        <p style="margin:12px 0 0;text-align:center">
          <button type="button" class="link-btn small" onClick={() => $cart.set(emptyCart())}>
            Vyprázdnit košík
          </button>
        </p>
      )}
      <Dialog open={editing !== null} title={editing ? (editing.item.key ? `Upravit: ${editing.dish.name}` : editing.dish.name) : ''} onClose={() => setEditing(null)} variant="sheet">
        {editing && (
          <AddToCart
            dish={editing.dish}
            restaurant={restaurant.name}
            {...(editing.item.key ? { editKey: editing.item.key, initial: editing.item.choices } : {})}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
