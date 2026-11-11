import { useEffect, useState } from 'preact/hooks';
import { KEYS, readRaw, writeRaw } from '@/lib/storage';
import { GTM_ID } from '@/lib/site';

// Analytics only with consent. Nothing from Google is requested before the visitor clicks "Povolit" (or has done so earlier).
// Declining is as easy as accepting, and the choice can be changed at any time (footer, privacy page).
type Choice = 'granted' | 'denied';
type Win = Window & { dataLayer?: unknown[]; __gtmLoaded?: boolean };

function loadGtm() {
  const w = window as Win;
  if (w.__gtmLoaded) return;
  w.__gtmLoaded = true;
  w.dataLayer = w.dataLayer || [];
  // Consent Mode v2 defaults: analytics only after the click, no advertising signals at all.
  const gtag = function (..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(s);
}

function dropGoogleCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]!.trim();
    if (name.startsWith('_ga') || name.startsWith('_gid') || name.startsWith('_gat')) {
      for (const domain of [location.hostname, `.${location.hostname.replace(/^www\./, '')}`]) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

export default function Consent() {
  const [choice, setChoice] = useState<Choice | null | undefined>(undefined); // undefined = not read yet
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raw = readRaw(KEYS.consent);
    const c: Choice | null = raw === 'granted' || raw === 'denied' ? raw : null;
    setChoice(c);
    if (c === 'granted') loadGtm();
    if (c === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener('damenic:consent-open', reopen);
    return () => window.removeEventListener('damenic:consent-open', reopen);
  }, []);

  const decide = (next: Choice) => {
    const was = choice;
    writeRaw(KEYS.consent, next);
    setChoice(next);
    setOpen(false);
    if (next === 'granted') loadGtm();
    else if (was === 'granted') {
      dropGoogleCookies();
      if ((window as Win).__gtmLoaded) location.reload(); // the already loaded container cannot be unloaded
    }
  };

  if (!open) return null;
  return (
    <aside class="consent" role="dialog" aria-labelledby="consent-title" aria-modal="false" data-testid="consent">
      <h2 id="consent-title">Můžeme měřit, co tě baví?</h2>
      <p>
        Chceme vědět, které recepty a restaurace lidi opravdu zajímají. K tomu používáme Google Tag Manager a analytické cookies, ale jen když to dovolíš.
        Web funguje stejně, ať řekneš cokoli. <a href="/soukromi/">Podrobnosti</a>
      </p>
      <div class="consent__actions">
        <button type="button" class="btn btn--ghost" onClick={() => decide('denied')} data-testid="consent-deny">
          Nepovolit
        </button>
        <button type="button" class="btn" onClick={() => decide('granted')} data-testid="consent-accept">
          Povolit
        </button>
      </div>
    </aside>
  );
}
