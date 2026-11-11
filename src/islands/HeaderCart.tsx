import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $cart, $catalog, $checkout, $orders } from '@/lib/stores';
import { fromOrder, simulate } from '@/lib/simulation';
import { countItems, totals } from '@/lib/cart';
import { formatCzk } from '@/lib/money';
import CartView from './CartView';
import { Dialog } from './Dialog';
import { useInit } from './hooks';
import { Icon } from './icons';

const NO_BAR = ['/kosik/', '/pokladna/', '/objednavka/'];

/**
 * The newest order whose courier is still on the way or waiting at the door, for the floating "courier arrives in"
 * pill on every page. Real-time orders take half an hour, so people browse in the meantime.
 */
function ActiveOrder({ path }: { path: string }) {
  const { orders } = useStore($orders);
  const [now, setNow] = useState(() => Date.now());
  const active = orders
    .map((o) => ({ o, s: simulate(fromOrder(o), now) }))
    .find(({ o, s }) => (s.status === 'running' && now >= o.createdAt) || s.status === 'atDoor');
  const live = active?.s.status === 'running';
  useEffect(() => {
    if (!live) return;
    let timer = 0;
    const start = () => {
      window.clearInterval(timer);
      setNow(Date.now());
      if (!document.hidden) timer = window.setInterval(() => setNow(Date.now()), 15_000);
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', start);
    };
  }, [live, active?.o.id]);
  const show = !!active && path !== '/objednavka/';
  useEffect(() => {
    document.body.classList.toggle('has-orderbar', show);
  }, [show]);
  if (!show || !active) return null;
  const { o, s } = active;
  const pickup = o.mode === 'pickup';
  const text =
    s.status === 'atDoor'
      ? pickup
        ? 'Objednávka je připravená'
        : 'Kurýr je u dveří!'
      : `${pickup ? 'Připraveno' : 'Kurýr dorazí'} za ${s.remainingMinutes} min`;
  return (
    <div class={`orderbar ${s.status === 'atDoor' ? 'is-door' : ''}`}>
      <a href={`/objednavka/#${o.id}`} data-testid="orderbar">
        <Icon name={s.status === 'atDoor' ? 'bag' : 'bike'} size={20} />
        <span>{text}</span>
        <span class="orderbar__go">Sledovat</span>
      </a>
    </div>
  );
}

/** Header cart button + slide-in cart drawer + floating cart pill on mobile. */
export default function HeaderCart() {
  const ready = useInit();
  const cart = useStore($cart);
  const catalog = useStore($catalog);
  const opts = useStore($checkout);
  const [open, setOpen] = useState(false);
  const count = ready ? countItems(cart) : 0;
  const path = typeof location === 'undefined' ? '' : location.pathname;
  const showBar = count > 0 && !NO_BAR.includes(path);
  const total = catalog && count ? formatCzk(totals(cart, catalog, opts).subtotal) : '';

  useEffect(() => {
    document.body.classList.toggle('has-cartbar', showBar);
  }, [showBar]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('damenic:open-cart', onOpen);
    return () => window.removeEventListener('damenic:open-cart', onOpen);
  }, []);

  const openDrawer = (e: MouseEvent) => {
    if (NO_BAR.includes(path)) return; // on the cart and checkout pages the link just works
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <a class="cartbtn" href="/kosik/" onClick={openDrawer} data-testid="cart-button" aria-label={`Košík, položek: ${count}`}>
        <Icon name="bag" />
        <span class="cartbtn__count num" data-testid="cart-count">
          {count}
        </span>
        {total && <span class="cartbtn__total num">{total}</span>}
      </a>
      {showBar && (
        <div class="cartbar">
          <a href="/kosik/" onClick={openDrawer}>
            <span class="cartbar__n num">{count}</span>
            <span>Zobrazit košík</span>
            <span class="num">{total}</span>
          </a>
        </div>
      )}
      {ready && <ActiveOrder path={path} />}
      <Dialog open={open} title="Košík" onClose={() => setOpen(false)} variant="drawer">
        <CartView variant="drawer" />
      </Dialog>
    </>
  );
}
