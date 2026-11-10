// Icons for islands: the same Lucide family as components/Icon.astro.
import bag from 'lucide-static/icons/shopping-bag.svg?raw';
import search from 'lucide-static/icons/search.svg?raw';
import pin from 'lucide-static/icons/map-pin.svg?raw';
import plus from 'lucide-static/icons/plus.svg?raw';
import minus from 'lucide-static/icons/minus.svg?raw';
import trash from 'lucide-static/icons/trash-2.svg?raw';
import x from 'lucide-static/icons/x.svg?raw';
import check from 'lucide-static/icons/check.svg?raw';
import pencil from 'lucide-static/icons/pencil.svg?raw';
import printer from 'lucide-static/icons/printer.svg?raw';
import copy from 'lucide-static/icons/copy.svg?raw';
import bike from 'lucide-static/icons/bike.svg?raw';
import chef from 'lucide-static/icons/chef-hat.svg?raw';
import info from 'lucide-static/icons/info.svg?raw';
import wallet from 'lucide-static/icons/wallet.svg?raw';
import list from 'lucide-static/icons/list-checks.svg?raw';
import chevron from 'lucide-static/icons/chevron-down.svg?raw';
import store from 'lucide-static/icons/store.svg?raw';
import utensils from 'lucide-static/icons/utensils.svg?raw';

const ICONS = { bag, search, pin, plus, minus, trash, x, check, pencil, printer, copy, bike, chef, info, wallet, list, chevron, store, utensils };
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <span
      class="icon"
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
