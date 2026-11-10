import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $city } from '@/lib/stores';
import { CITIES } from '@/lib/cities';
import { useInit } from './hooks';
import { Icon } from './icons';

/** The city only sets the scene. No geolocation, no address check, no claim of real coverage. */
export default function CityPicker() {
  useInit();
  const city = useStore($city);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div class="city" ref={root}>
      <button ref={button} type="button" class="city__btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="pin" size={18} />
        <span>
          <span class="sr-only">Ukázková lokalita: </span>
          {city}
        </span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div class="city__list" role="radiogroup" aria-label="Ukázková lokalita">
          <p>Lokalita je jen kulisa simulace. Nikam se nic neveze.</p>
          {CITIES.map((c) => (
            <button
              type="button"
              role="radio"
              aria-checked={c === city}
              key={c}
              onClick={() => {
                $city.set(c);
                setOpen(false);
                button.current?.focus();
              }}
            >
              {c}
              {c === city && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
