import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $cart, $catalog, $checkout, $city, $orders } from '@/lib/stores';
import { PROMO_CODES, TIPS, emptyCart, normalizeCode, optionNames, totals, unitPrice } from '@/lib/cart';
import { createOrder, newOrderId } from '@/lib/orders';
import { dropPoint } from '@/lib/cities';
import { etaRange, isOpen, slots } from '@/lib/hours';
import { formatCzk } from '@/lib/money';
import { ModeSwitch, Sums } from './CartView';
import { useInit } from './hooks';
import { Icon, type IconName } from './icons';

const PAYMENTS: { id: string; label: string; note: string; icon: IconName }[] = [
  { id: 'wallet', label: 'Demo peněženka DámeNic', note: 'Zůstatek: nic. Platnost: nikdy.', icon: 'wallet' },
  { id: 'card', label: 'Demo karta', note: 'Neinteraktivní ukázka, žádné číslo se nezadává.', icon: 'card' },
  { id: 'phone', label: 'Platba telefonem (demo)', note: 'Napodobenina, žádná skutečná peněženka.', icon: 'smartphone' },
  { id: 'cash', label: 'Hotově nanečisto', note: 'Kurýr nepřijede, takže ani nevrací.', icon: 'banknote' },
];
const NOTES = ['Zazvonit', 'Nechat u dveří', 'Nevolat', 'Mám psa, ale hodného'];

export default function Checkout() {
  const ready = useInit();
  const cart = useStore($cart);
  const catalog = useStore($catalog);
  const city = useStore($city);
  const opts = useStore($checkout);
  // One id per visit: repeated submits can only ever create one order.
  const orderId = useRef(newOrderId());
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState(PAYMENTS[0]!.id);
  const [note, setNote] = useState<string | null>(null);
  const [when, setWhen] = useState<'asap' | number>('asap');
  const [codeInput, setCodeInput] = useState(opts.code ?? '');
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

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
  const t = totals(cart, catalog, opts);
  const pickup = opts.mode === 'pickup' && restaurant.pickup;
  const point = pickup ? `${restaurant.name}, výdejní okénko (smyšlené)` : dropPoint(city);
  const open = isOpen(restaurant.hours, now);
  const slotList = slots(restaurant.hours, restaurant.etaMinutes, now);
  const blocked = t.missingToMin > 0;
  const mustSchedule = !open;

  function applyCode(e: Event) {
    e.preventDefault();
    const c = normalizeCode(codeInput);
    if (!codeInput.trim()) {
      $checkout.set({ ...opts, code: null });
      setCodeMsg(null);
      return;
    }
    if (!c) {
      setCodeMsg('Tenhle kód neznáme. Zkus třeba NIC.');
      return;
    }
    $checkout.set({ ...opts, code: c });
    setCodeMsg(`Kód ${c} uplatněn: −${formatCzk(PROMO_CODES[c]!.amount)} z ceny, kterou stejně neplatíš.`);
  }

  function confirm() {
    if (locked.current || blocked) return; // double click / double Enter
    if (mustSchedule && when === 'asap') {
      setError('Restaurace má teď zavřeno. Vyber čas doručení.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    window.setTimeout(() => {
      const result = createOrder($orders.get(), {
        id: orderId.current,
        cart: $cart.get(),
        catalog: catalog!,
        city,
        dropPoint: point,
        now: Date.now(),
        opts: $checkout.get(),
        payment: PAYMENTS.find((p) => p.id === payment)!.label,
        courierNote: pickup ? null : note,
        scheduledFor: when === 'asap' ? null : when,
      });
      if (!result) {
        locked.current = false;
        setBusy(false);
        setError('Objednávku se nepodařilo vytvořit. Zkontroluj košík a zkus to znovu.');
        return;
      }
      $orders.set(result.state);
      $cart.set(emptyCart());
      $checkout.set({ ...$checkout.get(), code: null, tip: 0 });
      location.assign(`/objednavka/#${result.order.id}`);
    }, 1100);
  }

  return (
    <div class="cols">
      <div class="stack">
        <section class="panel" aria-labelledby="h-zpusob">
          <h2 id="h-zpusob">Jak to (ne)převezmeš</h2>
          <ModeSwitch canPickup={restaurant.pickup} />
          <div class="kv" style="margin-top:14px">
            <Icon name={pickup ? 'walk' : 'pin'} />
            <div>
              <p>
                <strong data-testid="drop-point">{point}</strong>
              </p>
              <p class="muted small">
                {pickup
                  ? 'Osobní odběr bez dopravného a bez kurýra. Vyzvedávat není co.'
                  : `Ukázková lokalita ${city} a smyšlený doručovací bod. Skutečnou adresu, jméno ani telefon nechceme.`}
              </p>
            </div>
          </div>
        </section>

        <section class="panel" aria-labelledby="h-cas">
          <h2 id="h-cas">Kdy</h2>
          <div class="fpanel__chips" role="radiogroup" aria-label="Čas doručení">
            <button type="button" role="radio" aria-checked={when === 'asap'} class={`fchip ${when === 'asap' ? 'is-on' : ''}`} disabled={mustSchedule} onClick={() => setWhen('asap')}>
              <Icon name="clock" size={16} /> Co nejdřív · {etaRange(restaurant.etaMinutes)}
            </button>
            {slotList.map((s) => (
              <button type="button" role="radio" key={s.at} aria-checked={when === s.at} class={`fchip ${when === s.at ? 'is-on' : ''}`} onClick={() => setWhen(s.at)}>
                {s.label}
              </button>
            ))}
          </div>
          {mustSchedule && <p class="small muted">Restaurace má teď (smyšleně) zavřeno, otevírá v {restaurant.hours.open}. Objednávku si můžeš naplánovat.</p>}
          {!slotList.length && mustSchedule && <p class="small muted">Dnes už žádné časy nezbyly.</p>}
        </section>

        {!pickup && (
          <section class="panel" aria-labelledby="h-kuryr">
            <h2 id="h-kuryr">Pro kurýra</h2>
            <p class="small muted" style="margin:0 0 8px">
              Poznámka (jen předvolby, žádný volný text):
            </p>
            <div class="fpanel__chips">
              {NOTES.map((n) => (
                <button type="button" key={n} class={`fchip ${note === n ? 'is-on' : ''}`} aria-pressed={note === n} onClick={() => setNote(note === n ? null : n)}>
                  {n}
                </button>
              ))}
            </div>
            <p class="small muted" style="margin:14px 0 8px">
              Spropitné (simulované, kurýr neexistuje):
            </p>
            <div class="fpanel__chips" role="radiogroup" aria-label="Spropitné">
              {TIPS.map((tip) => (
                <button type="button" role="radio" key={tip} aria-checked={opts.tip === tip} class={`fchip ${opts.tip === tip ? 'is-on' : ''}`} onClick={() => $checkout.set({ ...opts, tip })} data-testid={`tip-${tip / 100}`}>
                  {tip ? formatCzk(tip) : 'Bez spropitného'}
                </button>
              ))}
            </div>
          </section>
        )}

        <section class="panel" aria-labelledby="h-platba">
          <h2 id="h-platba">Platba nanečisto</h2>
          <div class="paytiles" role="radiogroup" aria-label="Platební metoda">
            {PAYMENTS.map((p) => (
              <button type="button" role="radio" key={p.id} aria-checked={payment === p.id} class={`paytile ${payment === p.id ? 'is-on' : ''}`} onClick={() => setPayment(p.id)}>
                <Icon name={p.icon} size={22} />
                <span>
                  <strong>{p.label}</strong>
                  <small>{p.note}</small>
                </span>
              </button>
            ))}
          </div>
          {payment === 'card' && (
            <div class="democard" aria-hidden="true" style="margin-top:14px">
              <strong>DámeNic</strong>
              <span class="democard__num">0000 0000 0000 0000</span>
              <span class="small">Zůstatek: nic · platnost: nikdy</span>
              <span class="democard__demo">DEMO</span>
            </div>
          )}
          <form class="promo" onSubmit={applyCode}>
            <label for="promo-code" class="small">
              Promo kód (simulovaný)
            </label>
            <div class="promo__row">
              <input id="promo-code" name="promo" value={codeInput} onInput={(e) => setCodeInput(e.currentTarget.value)} autocomplete="off" spellcheck={false} maxLength={20} placeholder="např. NIC" data-testid="promo-input" />
              <button type="submit" class="btn btn--ghost btn--sm" data-testid="promo-apply">
                Použít
              </button>
            </div>
            {codeMsg && (
              <p class="small" role="status">
                {codeMsg}
              </p>
            )}
          </form>
        </section>

        <section class="panel" aria-labelledby="h-prubeh">
          <h2 id="h-prubeh">Co se stane potom</h2>
          <p style="margin:0">
            Spustí se sledování objednávky se smyšleným kurýrem v reálném čase: {restaurant.etaMinutes} minut jsou skutečné minuty. Mezitím můžeš brouzdat
            dál, odpočet uvidíš dole na každé stránce. Kurýr nakonec zazvoní u dveří s prázdnou taškou a dostaneš recept. Čekání jde kdykoli přeskočit.
          </p>
        </section>
      </div>
      <aside class="panel checkout__summary" aria-labelledby="h-souhrn">
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
        <Sums t={t} pickup={pickup} />
        <div class="note" style="margin:14px 0">
          <Icon name="info" />
          <p>Objednávka je pouze simulovaná. Nic neplatíš a žádné jídlo nebude doručeno.</p>
        </div>
        {blocked && (
          <p class="opts__error" role="alert">
            Do minimální objednávky chybí {formatCzk(t.missingToMin)}. <a href={`/restaurace/${restaurant.slug}/`}>Přidat jídlo</a>
          </p>
        )}
        {error && (
          <p class="opts__error" role="alert">
            {error}
          </p>
        )}
        <span class="sr-only" data-testid="checkout-total">
          {formatCzk(t.total)}
        </span>
        <button type="button" class="btn btn--block btn--lg" onClick={confirm} aria-disabled={busy || blocked} disabled={blocked} data-testid="confirm-order">
          {busy ? (
            <>
              <span class="spin" aria-hidden="true" /> Platíme nanečisto…
            </>
          ) : (
            'Objednat nanečisto za 0 Kč'
          )}
        </button>
        <p class="small muted" style="margin:10px 0 0;text-align:center" data-testid="checkout-real">
          Skutečně zaplatíš: 0 Kč
        </p>
        <p class="small muted" style="margin:4px 0 0;text-align:center">
          <a href="/kosik/">Zpět do košíku</a>
        </p>
      </aside>
    </div>
  );
}
