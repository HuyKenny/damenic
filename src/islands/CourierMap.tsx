import { useEffect, useRef } from 'preact/hooks';

// Schematic street grid drawn by hand. It is an illustration, not a map of any real place.
const ROUTE = 'M92 318 H232 V232 H372 V148 H468 V84 H556';
const BLOCKS: [number, number, number, number][] = [
  [20, 20, 190, 96], [250, 20, 200, 44], [486, 20, 134, 44], [250, 102, 104, 110], [20, 154, 190, 60],
  [390, 166, 60, 150], [486, 102, 134, 214], [20, 252, 190, 46], [250, 250, 104, 130], [20, 338, 190, 42], [390, 336, 230, 44],
];

interface Props {
  /** Returns 0..1 along the route for the current moment. */
  getProgress: () => number;
  running: boolean;
  restaurant: string;
  destination: string;
}

export function CourierMap({ getProgress, running, restaurant, destination }: Props) {
  const path = useRef<SVGPathElement>(null);
  const done = useRef<SVGPathElement>(null);
  const marker = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = path.current;
    if (!el || !marker.current) return;
    const length = el.getTotalLength();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let timer = 0;
    const place = () => {
      const p = Math.min(1, Math.max(0, getProgress()));
      const pt = el.getPointAtLength(p * length);
      marker.current?.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      done.current?.setAttribute('stroke-dasharray', `${(p * length).toFixed(1)} ${length.toFixed(1)}`);
    };
    const loop = () => {
      place();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
    const start = () => {
      stop();
      place();
      if (!running || document.hidden) return; // nothing animates in a hidden tab
      if (reduce) timer = window.setInterval(place, 2000); // jumps instead of smooth motion
      else raf = requestAnimationFrame(loop);
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', start);
    };
  }, [getProgress, running]);

  return (
    <figure class="map" style="margin:0">
      <svg viewBox="0 0 640 400" role="img" aria-label={`Ilustrační mapa: trasa smyšleného kurýra od restaurace ${restaurant} k bodu ${destination}`}>
        <rect width="640" height="400" fill="#eef0e9" />
        {BLOCKS.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="8" fill={i % 4 === 1 ? '#d9e6cf' : '#e2e0d8'} />
        ))}
        <path ref={path} d={ROUTE} fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
        <path d={ROUTE} fill="none" stroke="#c9c5ba" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round" stroke-linejoin="round" />
        <path ref={done} d={ROUTE} fill="none" stroke="#d92e32" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0 2000" />
        <g transform="translate(92 318)">
          <circle r="17" fill="#202124" />
          <path d="M-7 -6h14l-1.5 12h-11zM-4 -6c0-5 8-5 8 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" />
        </g>
        <text x="92" y="356" text-anchor="middle" font-size="13" font-weight="700" fill="#202124">
          Restaurace
        </text>
        <g transform="translate(556 84)">
          <circle r="17" fill="#fff" stroke="#202124" stroke-width="3" />
          <circle r="6" fill="#202124" />
        </g>
        <text x="556" y="58" text-anchor="middle" font-size="13" font-weight="700" fill="#202124">
          Nikde 0
        </text>
        <g ref={marker} transform="translate(92 318)" data-testid="courier-marker">
          <circle r="15" fill="#d92e32" stroke="#fff" stroke-width="3" />
          <path d="M-7 3a3 3 0 1 0 0.01 0M7 3a3 3 0 1 0 0.01 0M-7 3l3-7h5l3 7M-1 -4l-1-3h-3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </svg>
      <figcaption class="map__label tag tag--sim">Ilustrační mapa</figcaption>
    </figure>
  );
}
