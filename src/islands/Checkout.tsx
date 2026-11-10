import { useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $cart, $catalog, $city, $orders } from '@/lib/stores';
import { emptyCart, optionNames, totals, unitPrice } from '@/lib/cart';
import { createOrder, newOrderId } from '@/lib/orders';
import { dropPoint } from '@/lib/cities';
import { formatCzk } from '@/lib/money';
import { SPEED, realMinutesLabel } from '@/lib/simulation';
import { useInit } from './hooks';
import { Icon } from './icons';

export default function Checkout() {
  const ready = useInit();
  const cart = useStore($cart);
  const catalog = useStore($catalog);
  const city = useStore($city);
  // One id per visit to the checkout: repeated submits can only ever create one order.
  const orderId = useRef(newOrderId());
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready || !catalog)
    return (
      <p class="muted" aria-busy="true">
        Načítám pokladnu…
      </p>
    );
  const restaurant = cart.restaurantId ? catalog.restaurants[cart.restaurantId] : undefined;
  if (!cart.items.length || !restaurant) {
    if (busy) return <p class="muted">Přesměrovávám na sledování objednávky…</p>;
    return (
      <div class="empty" data-testid="checkout-empty">
        <h2>Není co objednat nanečisto</h2>
        <p>Košík je prázdný. Nejdřív si vyber něco, co ti pak nepřivezeme.</p>
        <a class="btn" href="/restaurace/">
          Vybrat jídlo
        </a>
      </div>
    );
  }
  const t = totals(cart, catalog);
  const point = dropPoint(city);

  function confirm() {
    if (locked.current) return; // double click / double Enter
    locked.current = true;
    setBusy(true);
    setError(null);
    window.setTimeout(() => {
      const result = createOrder($orders.get(), { id: orderId.current, cart: $cart.get(), catalog: catalog!, city, dropPoint: point, now: Date.now() });
      if (!result) {
        locked.current = false;
        setBusy(false);
        setError('Objednávku se nepodařilo vytvořit. Zkontroluj košík a zkus to znovu.');
        return;
      }
      $orders.set(result.state);
      $cart.set(emptyCart());
      location.assign(`/objednavka/#${result.order.id}`);
    }, 1100);
  }

  return (
    <div class="cols">
      <div class="stack">
        <section class="panel" aria-labelledby="h-misto">
          <h2 id="h-misto">Kam to nepřivezeme</h2>
          <div class="kv">
            <Icon name="pin" />
            <div>
              <p>
                <strong data-testid="drop-point">{point}</strong>
              </p>
              <p class="muted small">Ukázková lokalita {city} a smyšlený doručovací bod. Skutečnou adresu, jméno ani telefon nechceme a nikam je nezadávej.</p>
            </div>
          </div>
        </section>
        <section class="panel" aria-labelledby="h-platba">
          <h2 id="h-platba">Platba nanečisto</h2>
          <div class="kv" style="margin-bottom:14px">
            <Icon name="wallet" />
            <div>
              <p>
                <strong>Demo peněženka DámeNic</strong>
              </p>
              <p class="muted small">Jediná platební metoda. Nejde do ní nic vložit a nic z ní neodejde. Žádná karta, žádná banka, žádné údaje.</p>
            </div>
          </div>
          <div class="democard" aria-hidden="true">
            <strong>DámeNic</strong>
            <span class="democard__num">0000 0000 0000 0000</span>
            <span class="small">Zůstatek: nic · platnost: nikdy</span>
            <span class="democard__demo">DEMO</span>
          </div>
        </section>
        <section class="panel" aria-labelledby="h-prubeh">
          <h2 id="h-prubeh">Co se stane potom</h2>
          <p style="margin:0">
            Spustí se sledování objednávky se smyšleným kurýrem. Simulace běží {SPEED}× rychleji než čas, který ukazuje: {restaurant.etaMinutes} minut uběhne
            asi za {realMinutesLabel(restaurant.etaMinutes)}. Na konci nepřijede nic, ale dostaneš recept.
          </p>
        </section>
      </div>
      <aside class="panel" aria-labelledby="h-souhrn">
        <h2 id="h-souhrn">Souhrn neobjednávky</h2>
        <p class="muted small" style="margin:0 0 8px">
          {restaurant.name} · fiktivní restaurace
        </p>
        <ul class="cartlines">
          {cart.items.map((item) => {
            const dish = catalog.dishes[item.dishId];
            if (!dish) return null;
            const names = optionNames(dish, item.choices);
            return (
              <li class="cartline cartline--compact" key={item.key}>
                <div>
                  <div class="cartline__name">
                    {item.qty}× {dish.name}
                  </div>
                  {names.length > 0 && <div class="cartline__opts">{names.join(', ')}</div>}
                </div>
                <div class="cartline__price">{formatCzk(unitPrice(dish, item.choices) * item.qty)}</div>
              </li>
            );
          })}
        </ul>
        <dl class="sums">
          <div>
            <dt>Jídlo</dt>
            <dd>{formatCzk(t.subtotal)}</dd>
          </div>
          <div>
            <dt>Simulované dopravné</dt>
            <dd>{formatCzk(t.delivery)}</dd>
          </div>
          <div>
            <dt>Poplatek za prázdnou tašku</dt>
            <dd>{formatCzk(t.fee)}</dd>
          </div>
          <div class="sums__total">
            <dt>Simulovaná hodnota objednávky</dt>
            <dd data-testid="checkout-total">{formatCzk(t.total)}</dd>
          </div>
          <div class="sums__real">
            <dt>Skutečně zaplatíš</dt>
            <dd data-testid="checkout-real">0 Kč</dd>
          </div>
        </dl>
        <div class="note" style="margin:14px 0">
          <Icon name="info" />
          <p>Objednávka je pouze simulovaná. Nic neplatíš a žádné jídlo nebude doručeno.</p>
        </div>
        {error && (
          <p class="opts__error" role="alert">
            {error}
          </p>
        )}
        <button type="button" class="btn btn--block" onClick={confirm} aria-disabled={busy} data-testid="confirm-order">
          {busy ? (
            <>
              <span class="spin" aria-hidden="true" /> Platíme nanečisto…
            </>
          ) : (
            'Objednat nanečisto za 0 Kč'
          )}
        </button>
        <p class="small muted" style="margin:10px 0 0;text-align:center">
          <a href="/kosik/">Zpět do košíku</a>
        </p>
      </aside>
    </div>
  );
}
