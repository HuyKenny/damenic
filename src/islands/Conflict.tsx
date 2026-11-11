import { Dialog } from './Dialog';

interface Props {
  open: boolean;
  current: string;
  next: string;
  onKeep: () => void;
  onReplace: () => void;
}

/** One restaurant per order: the existing cart is only replaced after an explicit confirmation. */
export function Conflict({ open, current, next, onKeep, onReplace }: Props) {
  return (
    <Dialog open={open} title="Začít nový košík?" onClose={onKeep}>
      <p>
        V košíku už čeká jídlo z restaurace <strong>{current}</strong>. Kurýr s jednou taškou stihne jen jednu restauraci.
      </p>
      <p>
        Když budeš pokračovat, košík se vyprázdní a přidá se položka z restaurace <strong>{next}</strong>.
      </p>
      <div class="dlg__actions">
        <button type="button" class="btn btn--ghost" onClick={onKeep}>
          Nechat původní košík
        </button>
        <button type="button" class="btn" onClick={onReplace}>
          Vyprázdnit a přidat
        </button>
      </div>
    </Dialog>
  );
}
