import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $orders } from '@/lib/stores';
import { MAX_ORDERS } from '@/lib/orders';
import { fromOrder, simulate } from '@/lib/simulation';
import { formatCzk } from '@/lib/money';
import { useInit } from './hooks';

const date = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const LABEL = { running: 'Probíhá', done: 'Doručeno: nic', cancelled: 'Zrušeno' } as const;

export default function OrderHistory() {
  const ready = useInit();
  const { orders } = useStore($orders);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  if (!ready)
    return (
      <p class="muted" aria-busy="true">
        Načítám historii…
      </p>
    );
  if (!orders.length)
    return (
      <div class="empty" data-testid="history-empty">
        <h2>Zatím žádná neobjednávka</h2>
        <p>Jakmile si něco objednáš nanečisto, najdeš to tady. Historie se ukládá jen v tomto prohlížeči.</p>
        <a class="btn" href="/restaurace/">
          Vybrat jídlo
        </a>
      </div>
    );
  return (
    <>
      <ul class="stack" data-testid="history">
        {orders.map((o) => {
          const status = simulate(fromOrder(o), now).status;
          return (
            <li class="panel" key={o.id} data-testid="history-item">
              <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:start">
                <div>
                  <h2 style="margin:0;font-size:1.125rem">{o.restaurant.name}</h2>
                  <p class="muted small" style="margin:2px 0 0">
                    #{o.id} · {date.format(o.createdAt)} · {o.city}
                  </p>
                </div>
                <span class={`tag ${status === 'running' ? 'tag--red' : ''}`}>{LABEL[status]}</span>
              </div>
              <p style="margin:10px 0">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</p>
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
                <span>
                  Simulovaná hodnota <strong class="num">{formatCzk(o.totals.total)}</strong>, zaplaceno 0 Kč
                </span>
                <a class="btn btn--ghost btn--sm" href={`/objednavka/#${o.id}`}>
                  {status === 'running' ? 'Sledovat kurýra' : 'Zobrazit'}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <p class="muted small" style="margin-top:16px">
        Ukládá se nejvýš {MAX_ORDERS} posledních objednávek, jen v tomto prohlížeči, a po 90 dnech se mažou samy.
      </p>
    </>
  );
}
