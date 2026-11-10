import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Icon } from './icons';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * Native <dialog>: the browser traps focus, closes on Escape and returns focus to the opener.
 */
export function Dialog({ open, title, onClose, children }: Props) {
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
      class="dlg"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      {open && (
        <div class="dlg__in">
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
