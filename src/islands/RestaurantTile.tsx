// One restaurant card, rendered statically by Astro and inside the filter island.
import type { RestaurantSummary } from '@/lib/filters';
import { etaRange, isOpen } from '@/lib/hours';
import { formatCzk } from '@/lib/money';

const PRICE = ['', 'Kč', 'Kč Kč', 'Kč Kč Kč'];

/** WCAG relative luminance of #rrggbb. */
function luminance(hex: string) {
  const lin = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}
/** White or ink, whichever reads better on the brand colour (the data's `ink` hint is not trusted for contrast). */
function inkFor(bg: string) {
  const l = luminance(bg);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (luminance('#1f1f23') + 0.05);
  return onWhite >= onInk ? '#fff' : '#1f1f23';
}

export function Monogram({ logo, size = 44 }: { logo: RestaurantSummary['logo']; size?: number }) {
  return (
    <span
      class="mono"
      aria-hidden="true"
      style={{ width: `${size}px`, height: `${size}px`, background: logo.color, color: inkFor(logo.color), fontSize: `${Math.round(size * (logo.text.length > 2 ? 0.3 : 0.38))}px` }}
    >
      {logo.text}
    </span>
  );
}

export function RestaurantTile({ r, now, eager = false }: { r: RestaurantSummary; now: number | null; eager?: boolean }) {
  // `now` is null during the static build: opening state is only shown in the browser.
  const open = now === null ? true : isOpen(r.hours, now);
  return (
    <article class={`rcard ${open ? '' : 'is-closed'}`} data-testid="restaurant-card" data-id={r.id}>
      <div class="rcard__media">
        {r.img ? (
          <img
            src={r.img.src}
            srcset={r.img.srcset}
            sizes="(min-width: 1100px) 300px, (min-width: 640px) 45vw, 92vw"
            width={r.img.width}
            height={r.img.height}
            alt={r.img.alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            {...(eager ? { fetchpriority: 'high' } : {})}
          />
        ) : (
          <span class="rcard__ph" aria-hidden="true" />
        )}
        <div class="rcard__badges">
          {r.promoLabel && <span class="sticker">{r.promoLabel}</span>}
          {r.isNew && <span class="sticker sticker--pink">Nové</span>}
        </div>
        {!open && <span class="rcard__closed">Zavřeno · otevírá v {r.hours.open.replace(/^0/, '')}</span>}
      </div>
      <div class="rcard__body">
        <Monogram logo={r.logo} />
        <div class="rcard__text">
          <h3 class="rcard__name">
            <a href={`/restaurace/${r.id}/`}>{r.name}</a>
          </h3>
          <p class="rcard__sub">
            {r.cuisine} · {PRICE[r.priceLevel]}
          </p>
          <ul class="rcard__meta" aria-label="Simulované údaje">
            <li>{etaRange(r.etaMinutes)}</li>
            <li class={r.freeDelivery ? 'is-free' : ''}>{r.freeDelivery ? 'Dopravné 0 Kč' : `Dopravné ${formatCzk(r.deliveryFee)}`}</li>
            {r.minOrder > 0 && <li>Min. {formatCzk(r.minOrder)}</li>}
          </ul>
        </div>
      </div>
    </article>
  );
}
