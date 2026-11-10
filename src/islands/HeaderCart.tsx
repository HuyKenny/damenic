import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $cart, $catalog } from '@/lib/stores';
import { countItems, totals } from '@/lib/cart';
import { formatCzk } from '@/lib/money';
import { useInit } from './hooks';
import { Icon } from './icons';

const NO_BAR = ['/kosik/', '/pokladna/', '/objednavka/'];

export default function HeaderCart() {
  const ready = useInit();
  const cart = useStore($cart);
  const catalog = useStore($catalog);
  const count = ready ? countItems(cart) : 0;
  const showBar = count > 0 && typeof location !== 'undefined' && !NO_BAR.includes(location.pathname);

  useEffect(() => {
    document.body.classList.toggle('has-cartbar', showBar);
  }, [showBar]);

  return (
    <>
      <a class="cartbtn" href="/kosik/" data-testid="cart-button" aria-label={`Košík, položek: ${count}`}>
        <Icon name="bag" />
        <span class="cartbtn__label">Košík</span>
        <span class="cartbtn__count num" data-testid="cart-count">
          {count}
        </span>
      </a>
      {showBar && (
        <div class="cartbar">
          <a href="/kosik/">
            <span>
              Zobrazit košík · {count} {count === 1 ? 'položka' : count < 5 ? 'položky' : 'položek'}
            </span>
            <span class="num">{catalog ? formatCzk(totals(cart, catalog).subtotal) : ''}</span>
          </a>
        </div>
      )}
    </>
  );
}
