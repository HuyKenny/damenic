export const SITE = {
  name: 'DámeNic',
  domain: 'damenic.cz',
  url: 'https://damenic.cz',
  claim: 'Objednej si na chuť. Uvař si doopravdy.',
  simNotice: 'Simulace rozvozu. Žádné skutečné platby ani doručení.',
  description:
    'DámeNic je simulátor rozvozu jídla: vybereš si, objednáš nanečisto a sleduješ kurýra, který nic nepřiveze. K tomu skutečné recepty a nákupní seznam.',
} as const;

export const CATEGORY_LABELS: Record<string, { label: string; lead: string }> = {
  pizza: { label: 'Pizza', lead: 'Kynuté těsto, rajčata a horká trouba.' },
  burgery: { label: 'Burgery', lead: 'Mleté hovězí, bulka a pánev.' },
  'ceska-kuchyne': { label: 'Česká kuchyně', lead: 'Omáčky, knedlíky a nedělní obědy.' },
  asie: { label: 'Asie', lead: 'Wok, rýže, nudle a rychlý oheň.' },
  kebab: { label: 'Kebab', lead: 'Marinované maso, placka a zelí.' },
  vegetarianske: { label: 'Vegetariánské', lead: 'Zelenina, luštěniny a sýr.' },
};
