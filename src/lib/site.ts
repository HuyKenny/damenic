export const SITE = {
  name: 'DámeNic',
  domain: 'damenic.cz',
  url: 'https://damenic.cz',
  claim: 'Objednej si na chuť. Uvař si doopravdy.',
  simNotice: 'Simulace rozvozu. Žádné skutečné platby ani doručení.',
  description:
    'Rozvoz jídla, který nic nepřiveze: smyšlené restaurace, objednávka nanečisto za 0 Kč a kurýr s prázdnou taškou. A skutečné recepty, ať nezůstaneš o hladu.',
} as const;

export const CATEGORY_LABELS: Record<string, { label: string; lead: string }> = {
  pizza: { label: 'Pizza', lead: 'Kynuté těsto, rajčata a horká trouba.' },
  burgery: { label: 'Burgery', lead: 'Mleté hovězí, bulka a pánev.' },
  ceska: { label: 'Česká kuchyně', lead: 'Omáčky, polévky, knedlíky a nedělní obědy.' },
  asijska: { label: 'Asijská', lead: 'Ramen, pho, wok a jarní závitky.' },
  sushi: { label: 'Sushi', lead: 'Rýže, nori, ryba a ostrý nůž.' },
  thajska: { label: 'Thajská', lead: 'Kari pasty, limetka, rybí omáčka a kokos.' },
  indicka: { label: 'Indická', lead: 'Koření, ghí, rýže a placky z pánve.' },
  mexicka: { label: 'Mexická', lead: 'Tortilly, fazole, avokádo a chilli.' },
  kebab: { label: 'Kebab', lead: 'Marinované maso, placka, zelí a omáčky.' },
  italska: { label: 'Italská', lead: 'Těstoviny, rizoto a dezerty z lednice.' },
  vegetarianska: { label: 'Vegetariánská', lead: 'Zelenina, luštěniny, sýr a tofu.' },
  poke: { label: 'Poke a bowly', lead: 'Rýže, syrová ryba nebo tofu a hodně zeleniny.' },
  palacinky: { label: 'Palačinky', lead: 'Palačinky, lívance a americké pancakes.' },
  dezerty: { label: 'Dezerty', lead: 'Koláče, bábovky, brownies a krémy.' },
  snidane: { label: 'Snídaně', lead: 'Vejce, kaše, granola a toasty.' },
};

/** Shortens meta text to `max` characters at a word boundary, with an ellipsis (search results cut around 155). */
export function clip(text: string, max = 155): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/[\s,.;:–-]+\S*$/, '') + '…';
}
