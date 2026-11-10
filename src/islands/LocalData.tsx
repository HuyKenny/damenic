import { useState } from 'preact/hooks';
import { wipeLocalData } from '@/lib/stores';
import { Dialog } from './Dialog';
import { useInit } from './hooks';

/** Deletes everything this site keeps in the browser: cart, simulated orders, shopping list, chosen city. */
export default function LocalData() {
  useInit();
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <>
      <button type="button" class="btn btn--ghost" onClick={() => setAsk(true)} data-testid="wipe">
        Smazat moje data z tohoto prohlížeče
      </button>
      {done && (
        <p class="added" role="status" style="max-width:420px">
          Smazáno. V prohlížeči po nás nezůstalo nic.
        </p>
      )}
      <Dialog open={ask} title="Smazat lokální data?" onClose={() => setAsk(false)}>
        <p>Smaže se košík, historie simulovaných objednávek, nákupní seznam a zvolená lokalita. Nejde to vrátit.</p>
        <div class="dlg__actions">
          <button type="button" class="btn btn--ghost" onClick={() => setAsk(false)}>
            Nechat být
          </button>
          <button
            type="button"
            class="btn"
            data-testid="wipe-confirm"
            onClick={() => {
              wipeLocalData();
              setAsk(false);
              setDone(true);
            }}
          >
            Smazat
          </button>
        </div>
      </Dialog>
    </>
  );
}
