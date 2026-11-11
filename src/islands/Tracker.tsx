import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $orders, $shopping } from '@/lib/stores';
import { cancelOrder, findOrder, openDoor, skipOrder } from '@/lib/orders';
import { STAGES, clock, fromOrder, realDurationMs, simulate, stageMessage, stageTimes, stageTitle, type StageId } from '@/lib/simulation';
import { addRecipe } from '@/lib/shopping';
import { formatCzk, roundToCrown } from '@/lib/money';
import type { OrderSnapshot } from '@/lib/types';
import { CourierMap } from './CourierMap';
import { Dialog } from './Dialog';
import { useInit } from './hooks';
import { Icon } from './icons';
import { CONTACT_EMAIL, mailto } from '@/lib/contact';

export interface RecipeCostInfo {
  title: string;
  servings: number;
  /** Estimated cost of consumed ingredients per serving, haléře (illustrative prices). */
  perServing: number;
}

interface Props {
  recipes: Record<string, RecipeCostInfo>;
  /** Courier illustration (Canva), already optimised. */
  courierImg?: string;
}

// Fictional couriers: pun names, so nobody mistakes them for real people. `acc` is the accusative for "Vytáčím …".
const COURIERS = [
  { name: 'Prokop Prázdný', acc: 'Prokopa Prázdného', vehicle: 'kolo, taška lehká jako slib', motto: 'Vozím nic už od roku nikdy.' },
  { name: 'Nikola Nicová', acc: 'Nikolu Nicovou', vehicle: 'skútr, náklad 0 kg', motto: 'Nejrychlejší kurýrka ve městě. Nic mi nikdy nevystydne.' },
  { name: 'Vojta Vzduch', acc: 'Vojtu Vzducha', vehicle: 'elektrokolo, taška plná vzduchu', motto: 'Vozím jen čerstvý vzduch. Hodně čerstvý.' },
  { name: 'Ema Éterová', acc: 'Emu Éterovou', vehicle: 'koloběžka, nulová zátěž', motto: 'Lehčí náklad jsem ještě nevezla.' },
];
/** What the courier is doing right now, per stage. */
const DOING: Partial<Record<StageId, string>> = {
  accepted: 'Dopíjí kafe a čeká na signál.',
  preparing: 'Čeká u výdeje a kouká do prázdna. Do tvojí objednávky.',
  packed: 'Kontroluje tašku. Pořád nic, sedí to.',
  pickedUp: 'Zapíná tašku, aby nic nevypadlo.',
  onTheWay: 'Šlape. S ničím na zádech se jede skvěle.',
  nearby: 'Hledá tvoje číslo popisné.',
  atDoor: 'Zvoní. A zvoní.',
};
/** The courier's only replies in the chat: pre-written, like the courier. */
const CHAT: Partial<Record<StageId, string>> = {
  accepted: 'Ahoj! Objednávku mám. Teda nemám, ale vím o ní.',
  preparing: 'Čekám u výdeje. Kuchař říká, že nic bude za chvilku.',
  packed: 'Taška je zabalená. Lehoučká.',
  pickedUp: 'Mám to! Vyrážím.',
  onTheWay: 'Jedu! Za chvíli jsem u tebe s ničím.',
  nearby: 'Jsem za rohem. Máš na zvonku jméno?',
  atDoor: 'Stojím venku, zvoním dvakrát.',
};
const courierFor = (id: string) => COURIERS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COURIERS.length]!;
const hashId = () => (typeof location === 'undefined' ? '' : decodeURIComponent(location.hash.replace(/^#/, '')));
const hhmm = (t: number) => new Date(t).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
/** Illustrative route length for the "km away" label; the map is a drawing, not a real place. */
const ROUTE_KM = 2.4;

// ---------- doorbell: generated tone, no audio file; never plays in a hidden tab ----------
const BELL_KEY = 'damenic:bell:v1';
const bellOn = () => {
  try {
    return localStorage.getItem(BELL_KEY) !== 'off';
  } catch {
    return true;
  }
};
let audio: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  try {
    audio ??= new AudioContext();
    return audio;
  } catch {
    return null;
  }
}
function ring() {
  const ctx = audioCtx();
  if (ctx) {
    void ctx.resume().catch(() => undefined);
    // "Ding-dong": two soft sine tones. If the browser still blocks audio (no click on this page yet), it stays silent.
    [
      [659, 0],
      [523, 0.45],
    ].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + delay!;
      osc.type = 'sine';
      osc.frequency.value = freq!;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1);
    });
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* not supported */
  }
}
/** Rings once per order per browser tab session, so a refresh does not ring again. */
function ringOnce(id: string) {
  const key = `damenic:rang:${id}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    /* blocked storage: ring anyway */
  }
  if (bellOn()) ring();
}

export default function Tracker({ recipes, courierImg }: Props) {
  const ready = useInit();
  const orders = useStore($orders);
  const [id, setId] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [askCancel, setAskCancel] = useState(false);
  const [contact, setContact] = useState<'call' | 'chat' | null>(null);
  const [doorOpen, setDoorOpen] = useState(true);
  const [bell, setBell] = useState(true);
  const baseTitle = useRef('');

  useEffect(() => {
    const read = () => setId(hashId());
    read();
    setBell(bellOn());
    baseTitle.current = document.title;
    window.addEventListener('hashchange', read);
    return () => {
      window.removeEventListener('hashchange', read);
      document.title = baseTitle.current;
    };
  }, []);

  const order = id ? findOrder(orders, id) : undefined;
  const sim = order ? simulate(fromOrder(order), now) : null;
  const running = sim?.status === 'running';
  const atDoor = sim?.status === 'atDoor';
  const pickup = order?.mode === 'pickup';
  const scheduled = order !== undefined && running && now < order.createdAt;

  // The clock drives the countdown. State is always recomputed from the stored timestamps, so a refresh or a
  // return from a hidden tab lands on the right stage. Nothing is written per tick.
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

  // Countdown in the tab title, so it keeps going while people browse elsewhere.
  useEffect(() => {
    if (!sim || !order || !baseTitle.current) return;
    if (running && !scheduled) document.title = `(${clock(sim.remainingMs)}) ${stageTitle(sim.stage, pickup)} · DámeNic`;
    else if (atDoor) document.title = pickup ? '🛍 Objednávka je připravená · DámeNic' : '🔔 Kurýr je u dveří · DámeNic';
    else document.title = baseTitle.current;
  });

  // Doorbell: once, when the courier arrives and the tab is visible (or as soon as it becomes visible).
  useEffect(() => {
    if (!atDoor || !order || pickup) return;
    const tryRing = () => {
      if (!document.hidden) ringOnce(order.id);
    };
    tryRing();
    document.addEventListener('visibilitychange', tryRing);
    return () => document.removeEventListener('visibilitychange', tryRing);
  }, [atDoor, order?.id, pickup]);

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

  if (scheduled) {
    const at = new Date(order.createdAt + realDurationMs(order.restaurant.etaMinutes, order.speed));
    return (
      <div class="empty" data-testid="scheduled">
        <span class="sticker">Naplánováno</span>
        <h1 style="margin-top:12px;font-size:1.8rem">Doručení nanečisto v {hhmm(at.getTime())}</h1>
        <p>Simulace začne {hhmm(order.createdAt)}. Do té doby restaurace připravuje přesně tolik, kolik vždycky: nic.</p>
        <button type="button" class="btn" onClick={() => {
          const t0 = Date.now();
          $orders.set(skipOrder($orders.get(), order.id, t0));
          setNow(t0);
        }}>Přeskočit čekání</button>
      </div>
    );
  }

  const courier = courierFor(order.id);
  const recipeLines = order.lines.filter((l) => l.recipe && recipes[l.recipe]);
  const times = stageTimes(fromOrder(order));
  const timeOf = (stageId: string) => times.find((t) => t.stage.id === stageId)?.at;
  const onRoute = sim.stage.id === 'onTheWay' || sim.stage.id === 'nearby';
  const km = ((1 - sim.routeProgress) * ROUTE_KM).toLocaleString('cs-CZ', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const realTime = order.speed === 1;

  const open = () => {
    const at = Date.now();
    void audioCtx()?.resume().catch(() => undefined);
    $orders.set(openDoor($orders.get(), order.id, at));
    setNow(at);
    window.scrollTo({ top: 0 }); // the finale starts at the top, not where the door button was
  };
  const toggleBell = () => {
    const next = !bell;
    setBell(next);
    try {
      localStorage.setItem(BELL_KEY, next ? 'on' : 'off');
    } catch {
      /* blocked storage: the toggle still works for this page */
    }
    if (next) void audioCtx()?.resume().catch(() => undefined); // the click unlocks audio for the doorbell later
  };

  return (
    <div data-testid="tracker" data-stage={sim.stage.id} data-status={sim.status}>
      <div class="pagehead">
        <p class="small muted" style="margin:0 0 6px">
          Simulovaná objednávka <span class="num">#{order.id}</span> · {order.restaurant.name}
        </p>
        <h1>{sim.status === 'cancelled' ? 'Simulace zrušena' : stageTitle(sim.stage, pickup)}</h1>
      </div>
      <div class="track">
        <div class="stack">
          <CourierMap
            getProgress={getProgress}
            running={running}
            restaurant={order.restaurant.name}
            destination={order.dropPoint}
            pickup={pickup}
            near={sim.stage.id === 'nearby' || atDoor}
          />
          <section class={`track__status ${atDoor ? 'is-door' : ''}`}>
            {sim.status === 'cancelled' ? (
              <>
                <p class="track__msg">Zrušili jsme doručení ničeho. Výsledek je stejný.</p>
                <p class="muted">Nic se neplatilo, takže se nic nevrací.</p>
                <div class="toolbar">
                  <a class="btn" href="/restaurace/">
                    Dát ničemu druhou šanci
                  </a>
                  <a class="btn btn--ghost" href="/recepty/">
                    Radši si uvařím
                  </a>
                </div>
              </>
            ) : atDoor ? (
              <>
                <div class="track__eta">
                  <span class="doorbell" aria-hidden="true">
                    <Icon name={pickup ? 'bag' : 'bell'} size={34} />
                  </span>
                  <div>
                    <strong class="track__now">{pickup ? 'Připraveno' : 'Je tady!'}</strong>
                    <div class="small muted">{pickup ? `od ${hhmm(sim.arrivalAt)}` : `u dveří od ${hhmm(sim.arrivalAt)}`}</div>
                  </div>
                </div>
                <p class="track__msg" role="status" aria-live="assertive" data-testid="stage-message">
                  {stageMessage(sim.stage, pickup)}
                </p>
                <div class="toolbar">
                  <button type="button" class="btn btn--lg" onClick={open} data-testid="open-door">
                    <Icon name={pickup ? 'bag' : 'door'} /> {pickup ? 'Vyzvednout' : 'Otevřít dveře'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div class="track__eta">
                  <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#f1ebe4" stroke-width="12" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#d92e32" stroke-width="12" stroke-linecap="round" stroke-dasharray={`${(sim.progress * 326.7).toFixed(1)} 326.7`} transform="rotate(-90 60 60)" />
                  </svg>
                  <div>
                    {realTime ? (
                      <strong data-testid="eta" class="num" aria-label={`Zbývá ${sim.remainingMinutes} min`}>
                        {clock(sim.remainingMs)}
                      </strong>
                    ) : (
                      <strong data-testid="eta">{sim.remainingMinutes} min</strong>
                    )}
                    <div class="small muted">
                      {pickup ? 'Vyzvednutí' : 'Doručení'} kolem <span class="num">{hhmm(sim.arrivalAt)}</span>
                    </div>
                  </div>
                  <span class="tag tag--sim">{realTime ? 'Skutečné minuty · smyšlené jídlo' : `Zrychlená simulace ${order.speed}×`}</span>
                </div>
                <div class="bar" role="progressbar" aria-label="Průběh simulace" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sim.progress * 100)}>
                  <i style={{ width: `${(sim.progress * 100).toFixed(1)}%` }} />
                </div>
                {/* Announced only when the stage changes, not every second. */}
                <p class="track__msg" role="status" aria-live="polite" data-testid="stage-message">
                  {stageMessage(sim.stage, pickup)}
                </p>
                {onRoute && (
                  <p class="small" style="margin:0" data-testid="distance">
                    {pickup ? 'Do restaurace' : 'Kurýr je od tebe'} ještě <strong class="num">{km} km</strong> <span class="muted">(ilustračně)</span>
                  </p>
                )}
                <p class="muted small" style="margin:6px 0 0">
                  {realTime ? 'Minuty jsou skutečné, všechno ostatní je nanečisto. Nechceš čekat? Přeskoč to.' : 'Kurýr i jídlo jsou smyšlené. Čekání můžeš kdykoli přeskočit.'}
                </p>
                <div class="toolbar">
                  <button type="button" class="btn btn--dark" onClick={() => {
                      const at = Date.now();
                      $orders.set(skipOrder($orders.get(), order.id, at));
                      setNow(at); // re-render now, not on the next tick
                    }} data-testid="skip">
                    Přeskočit čekání
                  </button>
                  <button type="button" class="btn btn--ghost" onClick={() => setAskCancel(true)} data-testid="cancel">
                    Zrušit simulaci
                  </button>
                  {!pickup && (
                    <button type="button" class="btn btn--ghost btn--sm" onClick={toggleBell} aria-pressed={bell} data-testid="bell-toggle">
                      <Icon name={bell ? 'bell' : 'bellOff'} size={18} /> {bell ? 'Zvonek zapnutý' : 'Zvonek vypnutý'}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
          {recipeLines.length > 0 && (sim.status === 'running' || atDoor) && (
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
              {STAGES.filter((st) => st.id !== 'done').map((stage, i) => {
                const state = sim.status === 'cancelled' ? (i <= sim.stageIndex ? 'is-done' : 'is-todo') : i < sim.stageIndex ? 'is-done' : i === sim.stageIndex ? 'is-now' : 'is-todo';
                const at = timeOf(stage.id);
                return (
                  <li class={state} key={stage.id} aria-current={state === 'is-now' ? 'step' : undefined}>
                    <span class="timeline__dot">{state === 'is-done' && <Icon name="check" size={16} />}</span>
                    <span>
                      <strong>
                        {state !== 'is-todo' && at !== undefined && <span class="timeline__time num">{hhmm(at)}</span>}
                        {stageTitle(stage, pickup)}
                      </strong>
                      {state !== 'is-todo' && <span class="small muted">{stageMessage(stage, pickup)}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
          {!pickup && (
            <section class="panel">
              <h2 class="courier__head">
                Tvůj kurýr <span class="tag tag--sim">smyšlená postava</span>
              </h2>
              <div class="courier" data-testid="courier">
                <span class="courier__avatar">{courierImg ? <img src={courierImg} alt="" width="52" height="52" /> : <Icon name="bike" size={26} />}</span>
                <div>
                  <strong>{courier.name}</strong>
                  <div class="muted small">{courier.vehicle}</div>
                  <div class="courier__motto small">„{courier.motto}“</div>
                </div>
              </div>
              {sim.status !== 'cancelled' && DOING[sim.stage.id] && (
                <p class="courier__now small">
                  <strong>Právě teď:</strong> {DOING[sim.stage.id]}
                </p>
              )}
              <div class="toolbar">
                <button type="button" class="btn btn--ghost btn--sm" onClick={() => setContact('call')} data-testid="call-courier">
                  <Icon name="phone" size={18} /> Zavolat
                </button>
                <button type="button" class="btn btn--ghost btn--sm" onClick={() => setContact('chat')} data-testid="chat-courier">
                  <Icon name="message" size={18} /> Napsat
                </button>
              </div>
            </section>
          )}
          <OrderSummary order={order} />
        </div>
      </div>
      <Dialog open={atDoor && doorOpen && !pickup} title="Crrr! Někdo zvoní" onClose={() => setDoorOpen(false)}>
        <div class="doorcall" data-testid="door-dialog">
          <span class="doorcall__avatar" aria-hidden="true">
            {courierImg ? <img src={courierImg} alt="" width="104" height="104" /> : <Icon name="bike" size={48} />}
          </span>
          <p class="doorcall__lead">{courier.name} stojí před dveřmi.</p>
          <p class="muted">V ruce drží tašku. Podle váhy je v ní přesně to, co sis objednal.</p>
        </div>
        <div class="dlg__actions">
          <button type="button" class="btn btn--ghost" onClick={() => setDoorOpen(false)}>
            Ještě chvíli
          </button>
          <button type="button" class="btn" onClick={open} data-testid="door-dialog-open">
            <Icon name="door" /> Otevřít dveře
          </button>
        </div>
      </Dialog>
      <Dialog open={contact !== null} title={contact === 'call' ? `Vytáčím ${courier.acc}…` : 'Chat s kurýrem'} onClose={() => setContact(null)}>
        {contact === 'call' ? (
          <>
            <p>Tůů… tůů… Volané číslo neexistuje. Stejně jako kurýr, jídlo a tvoje útrata.</p>
            <p class="small muted">Nikam se nevolá.</p>
          </>
        ) : (
          <div class="chat" data-testid="courier-chat">
            <p class="chat__bubble">
              <span class="chat__who">{courier.name}</span>
              {sim.status === 'cancelled' ? 'Otáčím to. Nic vezu zpátky.' : (CHAT[sim.stage.id] ?? 'Jedu!')}
            </p>
          </div>
        )}
        <div class="feedback" data-testid="feedback">
          <p class="feedback__lead">Kurýr odpovídá jen předepsanými větami. My jsme skuteční.</p>
          <p>Pochvala, nápad, chyba nebo jídlo, které v menu chybí? Napiš nám, čteme všechno.</p>
          <a class="btn btn--block" href={mailto(`DámeNic: vzkaz z objednávky #${order.id}`)} data-testid="feedback-mail">
            <Icon name="mail" /> Napsat na {CONTACT_EMAIL}
          </a>
          <p class="small muted" style="margin:8px 0 0">Web nic neodesílá. Otevře se tvoje e-mailová aplikace.</p>
        </div>
        <div class="dlg__actions">
          <button type="button" class="btn btn--ghost" onClick={() => setContact(null)}>
            Zpátky ke sledování
          </button>
        </div>
      </Dialog>
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
              const at = Date.now();
              $orders.set(cancelOrder($orders.get(), order.id, at));
              setNow(at);
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
          <p>{order.mode === 'pickup' ? 'Taška je vyzvednutá a prázdná.' : 'Otevřel jsi dveře a taška je prázdná.'} Hotovo. Zaplaceno nanečisto. Z účtu neodešlo nic. Jestli máš hlad doopravdy, všechno z objednávky si můžeš uvařit.</p>
        </div>
        <svg class="finale__bag" viewBox="0 0 240 220" aria-hidden="true" style="width:180px">
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
              Nic mi chutnalo. Ještě jednou!
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
