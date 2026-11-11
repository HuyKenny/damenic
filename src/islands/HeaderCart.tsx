import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $cart, $catalog, $checkout } from '@/lib/stores';
import { countItems, totals } from '@/lib/cart';
import { formatCzk } from '@/lib/money';
import CartView from './CartView';
import { Dialog } from './Dialog';
import { useInit } from './hooks';
import { Icon } from './icons';

const NO_BAR = ['/kosik/', '/pokladna/', '/objednavka/'];

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
      <Dialog open={open} title="Košík" onClose={() => setOpen(false)} variant="drawer">
        <CartView variant="drawer" />
      </Dialog>
    </>
  );
}
