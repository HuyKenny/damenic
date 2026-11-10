import { useCallback, useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $orders, $shopping } from '@/lib/stores';
import { cancelOrder, findOrder, skipOrder } from '@/lib/orders';
import { SPEED, STAGES, fromOrder, simulate } from '@/lib/simulation';
import { addRecipe } from '@/lib/shopping';
import { formatCzk, roundToCrown } from '@/lib/money';
import type { OrderSnapshot } from '@/lib/types';
import { CourierMap } from './CourierMap';
import { Dialog } from './Dialog';
import { useInit } from './hooks';
import { Icon } from './icons';

export interface RecipeCostInfo {
  title: string;
  servings: number;
  /** Estimated cost of consumed ingredients per serving, haléře (illustrative prices). */
  perServing: number;
}

interface Props {
  recipes: Record<string, RecipeCostInfo>;
}

const COURIERS = [
  { name: 'Kurýr Nikdo', vehicle: 'kolo s prázdnou taškou' },
  { name: 'Kurýrka Žádná', vehicle: 'skútr bez nákladu' },
  { name: 'Kurýr Nula', vehicle: 'elektrokolo, taška naprázdno' },
];
const courierFor = (id: string) => COURIERS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COURIERS.length]!;
const hashId = () => (typeof location === 'undefined' ? '' : decodeURIComponent(location.hash.replace(/^#/, '')));

export default function Tracker({ recipes }: Props) {
  const ready = useInit();
  const orders = useStore($orders);
  const [id, setId] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [askCancel, setAskCancel] = useState(false);

  useEffect(() => {
    const read = () => setId(hashId());
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const order = id ? findOrder(orders, id) : undefined;
  const sim = order ? simulate(fromOrder(order), now) : null;
  const running = sim?.status === 'running';

  // The clock only drives the countdown text. State is always recomputed from the stored creation time,
  // so a refresh or a return from a hidden tab lands on the right stage. Nothing is written per tick.
  useEffect(() => {
    if (!running) return;
    let timer = 0;
    const tick = () => setNow(Date.now());
    const start = () => {
      window.clearInterval(timer);
      tick();
      if (!document.hidden) timer = window.setInterval(tick, 1000);
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', start);
    };
  }, [running, order?.id]);

  const getProgress = useCallback(() => (order ? simulate(fromOrder(order), Date.now()).routeProgress : 0), [order]);

  if (!ready)
    return (
      <p class="muted" aria-busy="true">
        Hledám objednávku…
      </p>
    );

  if (!order || !sim)
    return (
      <div class="empty" data-testid="order-missing">
        <h1 style="font-size:1.6rem">{id ? 'Tuhle objednávku tady nevidíme' : 'Žádná objednávka k sledování'}</h1>
        <p>
          {id
            ? 'Objednávky se ukládají jen v prohlížeči, ve kterém vznikly. Tahle tu není: mohla vzniknout jinde, nebo už byla smazána.'
            : 'Nejdřív si něco objednej nanečisto. Pak tady uvidíš kurýra, který nic neveze.'}
        </p>
        <div class="hero__cta" style="justify-content:center">
          <a class="btn" href="/restaurace/">
            Vybrat jídlo
          </a>
          <a class="btn btn--ghost" href="/moje-objednavky/">
            Moje objednávky
          </a>
        </div>
      </div>
    );

  if (sim.status === 'done') return <Finale order={order} recipes={recipes} />;

  const courier = courierFor(order.id);
  const recipeLines = order.lines.filter((l) => l.recipe && recipes[l.recipe]);

  return (
    <div data-testid="tracker" data-stage={sim.stage.id} data-status={sim.status}>
      <div class="pagehead">
        <p class="small muted" style="margin:0 0 6px">
          Simulovaná objednávka <span class="num">#{order.id}</span> · {order.restaurant.name}
        </p>
        <h1>{sim.status === 'cancelled' ? 'Simulace zrušena' : sim.stage.title}</h1>
      </div>
      <div class="track">
        <div class="stack">
          <CourierMap getProgress={getProgress} running={running} restaurant={order.restaurant.name} destination={order.dropPoint} />
          <section class="track__status">
            {sim.status === 'cancelled' ? (
              <>
                <p class="track__msg">Zrušili jsme doručení ničeho. Výsledek je stejný.</p>
                <p class="muted">Nic se neplatilo, takže se nic nevrací.</p>
                <div class="toolbar">
                  <a class="btn" href="/restaurace/">
                    Objednat nanečisto znovu
                  </a>
                  <a class="btn btn--ghost" href="/recepty/">
                    Radši si uvařím
                  </a>
                </div>
              </>
            ) : (
              <>
                <div class="track__eta">
                  <strong data-testid="eta">{sim.remainingMinutes} min</strong>
                  <span class="tag tag--sim">Zrychlená simulace {SPEED}×</span>
                </div>
                <div class="bar" role="progressbar" aria-label="Průběh simulace" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sim.progress * 100)}>
                  <i style={{ width: `${(sim.progress * 100).toFixed(1)}%` }} />
                </div>
                {/* Announced only when the stage changes, not every second. */}
                <p class="track__msg" role="status" aria-live="polite" data-testid="stage-message">
                  {sim.stage.message}
                </p>
                <p class="muted small" style="margin:0">
                  Odpočet ukazuje simulovaný čas. Ve skutečnosti zbývá asi {Math.max(1, Math.ceil(sim.remainingMs / 1000))} s.
                </p>
                <div class="toolbar">
                  <button type="button" class="btn btn--dark" onClick={() => $orders.set(skipOrder($orders.get(), order.id, Date.now()))} data-testid="skip">
                    Přeskočit čekání
                  </button>
                  <button type="button" class="btn btn--ghost" onClick={() => setAskCancel(true)} data-testid="cancel">
                    Zrušit simulaci
                  </button>
                </div>
              </>
            )}
          </section>
          {recipeLines.length > 0 && sim.status === 'running' && (
            <section class="panel">
              <h2>Mezitím se dá vařit doopravdy</h2>
              <p class="muted" style="margin:0 0 10px">
                Recept můžeš otevřít hned. Simulace poběží dál.
              </p>
              <ul class="stack" style="gap:8px">
                {recipeLines.map((l) => (
                  <li key={l.dishId}>
                    <a class="btn btn--ghost btn--sm" href={`/recepty/${l.recipe}/`}>
                      <Icon name="chef" size={18} /> Recept: {recipes[l.recipe!]!.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div class="stack">
          <section class="panel">
            <h2>Průběh</h2>
            <ol class="timeline">
              {STAGES.map((stage, i) => {
                const state = sim.status === 'cancelled' ? (i <= sim.stageIndex ? 'is-done' : 'is-todo') : i < sim.stageIndex ? 'is-done' : i === sim.stageIndex ? 'is-now' : 'is-todo';
                return (
                  <li class={state} key={stage.id} aria-current={state === 'is-now' ? 'step' : undefined}>
                    <span class="timeline__dot">{state === 'is-done' && <Icon name="check" size={16} />}</span>
                    <span>
                      <strong>{stage.title}</strong>
                      {state !== 'is-todo' && <span class="small muted">{stage.message}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
          <section class="panel">
            <h2>Smyšlený kurýr</h2>
            <div class="courier">
              <span class="courier__avatar">
                <Icon name="bike" size={26} />
              </span>
              <div>
                <strong>{courier.name}</strong>
                <div class="muted small">{courier.vehicle}</div>
                <div class="muted small">Kurýr neexistuje. Nedá se mu volat ani psát.</div>
              </div>
            </div>
          </section>
          <OrderSummary order={order} />
        </div>
      </div>
      <Dialog open={askCancel} title="Zrušit simulaci?" onClose={() => setAskCancel(false)}>
        <p>Kurýr se otočí a neodveze nic zpátky. Objednávka zůstane v historii jako zrušená.</p>
        <div class="dlg__actions">
          <button type="button" class="btn btn--ghost" onClick={() => setAskCancel(false)}>
            Nechat běžet
          </button>
          <button
            type="button"
            class="btn"
            data-testid="cancel-confirm"
            onClick={() => {
              $orders.set(cancelOrder($orders.get(), order.id, Date.now()));
              setAskCancel(false);
            }}
          >
            Zrušit simulaci
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function OrderSummary({ order }: { order: OrderSnapshot }) {
  return (
    <section class="panel">
      <h2>Co nepřijede</h2>
      <ul class="cartlines" style="margin-top:0">
        {order.lines.map((l, i) => (
          <li class="cartline cartline--compact" key={i}>
            <div>
              <div class="cartline__name">
                {l.qty}× {l.name}
              </div>
              {l.options.length > 0 && <div class="cartline__opts">{l.options.join(', ')}</div>}
            </div>
            <div class="cartline__price">{formatCzk(l.unitPrice * l.qty)}</div>
          </li>
        ))}
      </ul>
      <dl class="sums">
        <div class="sums__total" style="border-top:0;margin:0;padding:0">
          <dt>Simulovaná hodnota</dt>
          <dd>{formatCzk(order.totals.total)}</dd>
        </div>
        <div class="sums__real">
          <dt>Zaplaceno doopravdy</dt>
          <dd>0 Kč</dd>
        </div>
      </dl>
      <p class="small muted" style="margin:10px 0 0">
        Cíl: {order.dropPoint}
      </p>
    </section>
  );
}

function Finale({ order, recipes }: { order: OrderSnapshot; recipes: Record<string, RecipeCostInfo> }) {
  const withRecipe = order.lines.filter((l) => l.recipe && recipes[l.recipe]);
  // Same number of portions on both sides; delivery and the fee are counted once.
  const simulated = withRecipe.reduce((s, l) => s + l.unitPrice * l.qty, 0) + order.totals.delivery + order.totals.fee;
  const home = withRecipe.reduce((s, l) => s + recipes[l.recipe!]!.perServing * l.qty, 0);
  const diff = simulated - home;

  function toShoppingList() {
    // Idempotent: opening the finished order again and clicking twice never duplicates recipes.
    let state = $shopping.get();
    for (const l of withRecipe) state = addRecipe(state, l.recipe!, Math.max(recipes[l.recipe!]!.servings, l.qty));
    $shopping.set(state);
    location.assign('/nakupni-seznam/');
  }

  return (
    <div data-testid="finale" data-status="done">
      <div class="finale on-red">
        <div>
          <span class="tag" style="background:#fff;color:#b3191f">
            Simulovaná objednávka #{order.id}
          </span>
          <h1 style="margin-top:12px">DámeNic doručilo přesně to, co slíbilo. Nic.</h1>
          <p>Hotovo. Zaplaceno nanečisto. Z účtu neodešlo nic. Jestli máš hlad doopravdy, všechno z objednávky si můžeš uvařit.</p>
        </div>
        <svg viewBox="0 0 240 220" aria-hidden="true" style="width:180px">
          <path d="M52 70h136l14 122a8 8 0 0 1-8 9H46a8 8 0 0 1-8-9z" fill="#fff" stroke="#8f1418" stroke-width="4" stroke-linejoin="round" />
          <path d="M92 70V52c0-22 56-22 56 0v18" fill="none" stroke="#8f1418" stroke-width="4" stroke-linecap="round" />
          <circle cx="120" cy="140" r="26" fill="none" stroke="#8f1418" stroke-width="4" stroke-dasharray="7 7" />
        </svg>
      </div>
      <div class="cols" style="margin-top:24px">
        <section class="panel">
          <h2>Co sis objednal nanečisto</h2>
          <ul>
            {order.lines.map((l, i) => {
              const r = l.recipe ? recipes[l.recipe] : undefined;
              return (
                <li class="orderline" key={i}>
                  {l.image ? (
                    <img src={l.image} alt="" width="64" height="64" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                  ) : (
                    <span />
                  )}
                  <div>
                    <strong>
                      {l.qty}× {l.name}
                    </strong>
                    {l.options.length > 0 && <div class="muted small">{l.options.join(', ')}</div>}
                    <dl class="compare">
                      <div>
                        <dt>Simulovaná cena</dt>
                        <dd>{formatCzk(l.unitPrice * l.qty)}</dd>
                      </div>
                      {r && (
                        <div>
                          <dt>Odhad surovin na doma ({l.qty} {l.qty === 1 ? 'porce' : l.qty < 5 ? 'porce' : 'porcí'})</dt>
                          <dd>≈ {formatCzk(roundToCrown(r.perServing * l.qty))}</dd>
                        </div>
                      )}
                    </dl>
                    {r && (
                      <div class="orderline__actions">
                        <a class="btn btn--sm" href={`/recepty/${l.recipe}/`}>
                          Uvařit si to doma
                        </a>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <aside class="stack">
          {withRecipe.length > 0 && (
            <section class="panel" data-testid="finale-compare">
              <h2>Odhadovaný rozdíl v nákladech</h2>
              <dl class="compare">
                <div>
                  <dt>Simulovaný rozvoz (jídla s receptem, doprava a poplatek jednou)</dt>
                  <dd>{formatCzk(simulated)}</dd>
                </div>
                <div>
                  <dt>Suroviny na stejný počet porcí</dt>
                  <dd>≈ {formatCzk(roundToCrown(home))}</dd>
                </div>
                <div class="is-diff">
                  <dt>{diff >= 0 ? 'Potenciální úspora při těchto předpokladech' : 'Doma by to vyšlo dráž o'}</dt>
                  <dd class={diff >= 0 ? 'pos' : 'neg'}>≈ {formatCzk(roundToCrown(Math.abs(diff)))}</dd>
                </div>
              </dl>
              <p class="small muted" style="margin:10px 0 0">
                Nic jsi neutratil, takže jsi ani nic skutečně neušetřil: jde o porovnání dvou odhadů. Ceny surovin jsou ilustrační, počítá se jen spotřebované
                množství, bez energie a tvého času.
              </p>
            </section>
          )}
          <section class="panel">
            <h2>Vařit doopravdy</h2>
            {withRecipe.length > 0 ? (
              <button type="button" class="btn btn--block" onClick={toShoppingList} data-testid="to-shopping">
                <Icon name="list" /> Připravit nákupní seznam
              </button>
            ) : (
              <p class="muted">K položkám z této objednávky recept nemáme. Vyber si z ostatních.</p>
            )}
            <a class="btn btn--ghost btn--block" href="/recepty/" style="margin-top:10px">
              Všechny recepty
            </a>
            <a class="btn btn--ghost btn--block" href={`/restaurace/${order.restaurant.slug}/`} style="margin-top:10px">
              Objednat nanečisto znovu
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
