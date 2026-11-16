// Affiliate call to action for Wolt, a real delivery service outside the simulation. Static markup, no script of its own.
// The link is the short path /go/wolt (302 in public/_redirects); it stays labelled "Reklama" and rel=sponsored.
const COPY = {
  waiting: {
    title: 'Hlad nečeká. Nic mu nestačí.',
    text: 'Zatímco restaurace chystá nic, někdo jiný ti může přivézt něco. Doopravdy, horké a v tašce.',
    cta: 'Chci jídlo, které existuje',
  },
  finale: {
    title: 'Dopamin dorazil. Teď ještě večeře.',
    text: 'Tohle byla zkouška nanečisto. Jestli máš hlad na ostro, Wolt ti ho pomůže uklidnit skutečným jídlem.',
    cta: 'Najít jídlo, které dorazí',
  },
} as const;

export function WoltCta({ variant }: { variant: keyof typeof COPY }) {
  const c = COPY[variant];
  return (
    <aside class="partner no-print" aria-labelledby={`partner-wolt-${variant}`} data-testid="partner-wolt">
      <div class="partner__tags">
        <span class="tag tag--ad">Reklama</span>
        <span class="tag">Skutečná služba, mimo simulaci</span>
      </div>
      <h3 id={`partner-wolt-${variant}`}>{c.title}</h3>
      <p>{c.text}</p>
      <a class="btn btn--sun btn--block" href="/go/wolt" rel="sponsored nofollow noopener" target="_blank" data-testid="partner-wolt-link">
        {c.cta}
        <span class="sr-only"> (Wolt, otevře se v novém okně)</span>
      </a>
      <p class="small muted partner__note">
        Reklamní odkaz: když si přes něj objednáš, DámeNic může dostat provizi, tebe to nic nestojí. S Woltem nemáme nic společného, objednávka z DámeNic se do něj
        nepřenáší a naše smyšlené restaurace tam nenajdeš. Rozvoz funguje jen tam, kde ho Wolt nabízí.
      </p>
    </aside>
  );
}
