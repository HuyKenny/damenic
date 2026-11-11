import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Icon } from './icons';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  /** "sheet" slides up from the bottom on phones, "drawer" slides in from the right. */
  variant?: 'center' | 'sheet' | 'drawer';
  /** Optional media shown edge to edge above the title (dish photo). */
  media?: ComponentChildren;
}

/**
 * Native <dialog>: the browser traps focus, closes on Escape and returns focus to the opener.
 */
export function Dialog({ open, title, onClose, children, variant = 'center', media }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      class={`dlg dlg--${variant}`}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      {open && (
        <div class="dlg__in">
          {media && <div class="dlg__media">{media}</div>}
          <div class="dlg__head">
            <h2>{title}</h2>
            <button type="button" class="icon-btn" onClick={onClose} aria-label="Zavřít">
              <Icon name="x" />
            </button>
          </div>
          <div class="dlg__body">{children}</div>
        </div>
      )}
    </dialog>
  );
}
