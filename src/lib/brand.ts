// The brand claim in one place: "dopaminové objednávání". Nobody searches this phrase yet (Marketing Miner, 14. 11. 2026),
// so the site names the category itself and ties it to what people do search for (co k večeři, co na oběd, recepty).
export const BRAND = {
  /** Category name: what DámeNic does. */
  category: 'dopaminové objednávání',
  /** The better-known word for the same thing; always appears next to the category name in copy. */
  familiar: 'dopaminové nakupování',
  /** One line for hero, OG and press. */
  line: 'Dopaminové objednávání. Všechno se děje, jen nic nedorazí.',
  short: 'Dopaminové objednávání bez následků',
  shareText: 'Objednal jsem nanečisto. Dopamin dorazil, jídlo ne.',
  manifestPath: '/dopaminove-objednavani/',
  /** Spelling without diacritics and with a space, for entity matching of the brand name. */
  alternateNames: ['Damenic', 'Dáme Nic'],
} as const;
