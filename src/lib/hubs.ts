// Recipe hub pages: one per cuisine, one per occasion (holidays) plus "quick" and "meat-free". Each has its own intro text; hubs with fewer than
// MIN_RECIPES recipes are not generated, so no thin pages exist.
import { allRecipes, recipeIndex, totalMinutes, type Recipe } from './content';
import { DIET_FACETS, FAMILY_LABELS, MEAL_LABELS } from './recipe-facets';
import { CATEGORY_LABELS } from './site';
import { OCCASION_IDS, OCCASIONS, occasionsInSeason, type OccasionId } from './occasions';

export const MIN_RECIPES = 3;

export interface Hub {
  slug: string;
  path: string;
  h1: string;
  /** Short name for chips and links between hubs (the h1 is too long for a chip). */
  label: string;
  title: string;
  description: string;
  intro: string[];
  recipes: Recipe[];
  /** Query string for /recepty/ that reproduces this hub with the filters ('Doladit filtry'). */
  filterQuery?: string;
  /** Visible questions and answers (also emitted as FAQPage data). */
  faq?: { q: string; a: string }[];
  /** One call to action under the intro. */
  cta?: { href: string; label: string };
}

const INTRO: Record<string, string[]> = {
  pizza: [
    'Dobrá pizza je z poloviny trpělivost: těsto potřebuje čas vykynout a trouba musí být rozpálená na maximum. Recepty počítají s běžnou troubou a plechem, ne s pecí na dřevo.',
    'Začni základním těstem, pak zkus Margheritu, pálivou Diavolu nebo čtyři sýry. Čas kynutí je u každého receptu rozepsaný, aby tě nepřekvapilo, že pizza nevznikne za deset minut.',
  ],
  burgery: [
    'Burger stojí na třech věcech: mleté maso s dostatkem tuku, pánev rozpálená do běla a bulka, která se krátce opeče. Recepty jsou na čtyři kusy.',
    'Burger nechodí sám. Domácí hranolky, cibulové kroužky a coleslaw mají vlastní recepty.',
  ],
  ceska: [
    'Česká kuchyně je o omáčkách, polévkách a trpělivosti. Svíčková, guláš, kulajda nebo bramboráky se nedají uspěchat, a proto u nich píšeme, kolik času zabere vaření a kolik tvoje vlastní práce.',
    'Recepty počítají se surovinami z běžného obchodu a s množstvím pro rodinu. Porce si přepočítáš jedním tlačítkem a suroviny pošleš do nákupního seznamu.',
  ],
  asijska: [
    'Ramen, pho, jarní závitky nebo bibimbap zvládneš i v obyčejné kuchyni. Většinu surovin seženeš v supermarketu, zbytek v asijské večerce, kde se vyplatí ptát.',
    'U vývarů počítej s časem na pomalé vaření, u jídel z woku naopak s rychlou prací. Obojí v receptech rozlišujeme.',
  ],
  sushi: [
    'Sushi se rozhoduje u rýže: musí být správně uvařená a ochucená. Teprve pak přijdou na řadu nori, ryba a ostrý nůž.',
    'Rybu na syrovou konzumaci kupuj jen tam, kde je k tomu určená. Recepty uvádějí i varianty bez syrové ryby.',
  ],
  thajska: [
    'Thajská kuchyně je vyvažování na laně mezi slaným, sladkým, kyselým a pálivým. Rybí omáčka, limetka, cukr a chilli se přidávají postupně a hlavně se ochutnávají.',
    'Pad thai, kari s kokosovým mlékem i polévky tom yum a tom kha se dají připravit za méně než hodinu.',
  ],
  indicka: [
    'U indických jídel rozhoduje koření a minuta, kdy se v oleji opraží a rozvoní celou kuchyň. Butter chicken, tikka masala, chana masala nebo dal uvaříš v jednom hrnci.',
    'K omáčkám patří rýže basmati nebo placky naan, které se dají upéct na pánvi.',
  ],
  mexicka: [
    'Tortilly, fazole, avokádo a chilli: z pár základních surovin vznikne chilli con carne, tacos, burrito i quesadilla.',
    'Guacamole a salsa se dělají za pár minut, chilli con carne naopak potřebuje hodinu pomalého vaření.',
  ],
  kebab: [
    'Rožeň doma nemáš a nevadí to. Kebab vznikne z marinovaného masa upečeného v troubě nebo na pánvi. K němu patří pita, zelí a omáčky.',
    'Tzatziki, hummus a pita chléb mají vlastní recepty a hodí se i samostatně.',
  ],
  italska: [
    'Lasagne, rizoto, gnocchi, boloňská omáčka nebo tiramisu: italská klasika, kterou zvládneš s běžnými surovinami a lepším rozpoložením.',
    'U těstovin rozhoduje voda z vaření a načasování, u lasagní a tiramisu čas v troubě a v lednici. Obojí v receptech uvádíme zvlášť.',
  ],
  vegetarianska: [
    'Jídla bez masa, u kterých nikdo nehledá, co chybí: kari s cizrnou, pečený lilek, tofu na pánvi nebo zeleninové lasagne.',
    'Recepty označené jako veganské neobsahují žádné živočišné suroviny.',
  ],
  poke: [
    'Poke bowl je miska rýže s rybou, tofu nebo kuřetem a spoustou zeleniny. Největší část práce je krájení, vaří se jen rýže.',
    'Syrovou rybu kupuj jen určenou ke konzumaci za syrova, nebo ji nahraď pečeným lososem či tofu.',
  ],
  palacinky: [
    'Palačinky, lívance i americké pancakes se dělají z podobných surovin, liší se hustotou těsta a kypřením.',
    'Recepty počítají s běžnou pánví a radí, jak na tenké palačinky, které se netrhají, a nadýchané lívance.',
  ],
  dezerty: [
    'Perník, bábovka, muffiny, brownies nebo cheesecake: dezerty, kde záleží na teplotě trouby, velikosti formy a zkoušce, jak poznat, že jsou hotové.',
    'Čas pečení a čas chladnutí uvádíme odděleně, protože u cheesecaku nebo panna cotty je čekání delší než práce.',
  ],
  snidane: [
    'Ovesná kaše, granola, vejce Benedikt, french toast nebo shakshuka. Snídaně na pracovní ráno i na lenivý víkend.',
    'U každého receptu je vidět, kolik minut zabere práce a kolik vaření.',
  ],
  kavarna: [
    'Dobrá káva doma stojí na třech věcech: čerstvě namleté zrno, správný poměr vody a trpělivost. Ledová káva, flat white nebo cold brew se dají udělat bez profesionálního kávovaru.',
    'U každého receptu píšeme, kolik kávy a vody použít, jak dlouho extrahovat a čím nahradit mléko, když ho doma nemáš.',
  ],
  matcha: [
    'Matcha latte, ledová matcha, chai nebo bubble tea. Nápoje, které v kavárnách stojí hodně a doma vyjdou na zlomek, když znáš správnou teplotu vody a poměr mléka.',
    'Matchu nikdy nezalévej vroucí vodou: zhořkne. U každého receptu najdeš teplotu, poměry a varianty bez mléka.',
  ],
  pekarna: [
    'Croissanty, focaccia, jablečný koláč nebo skořicové rolky. Pečivo a koláče, u kterých rozhoduje čas kynutí, teplota másla a správně rozpálená trouba.',
    'Čas práce, pečení a kynutí uvádíme odděleně, abys věděl, kdy u těsta opravdu stát a kdy si můžeš číst.',
  ],
  zmrzlina: [
    'Domácí zmrzlina nemusí potřebovat zmrzlinovač. Stačí smetana, ovoce nebo čokoláda, mrazák a občasné promíchání, aby se netvořily krystaly.',
    'U každého receptu je vidět, kolik času zabere příprava a kolik čekání v mrazáku, protože tahle část trvá nejdéle.',
  ],
  napoje: [
    'Okurková, bezinková nebo zázvorová limonáda, domácí sirupy, smoothie a ledový čaj. Osvěžení, které si namícháš za pár minut a nemá v sobě pytel cukru navíc.',
    'Sirupy se dají uchovat v lednici několik týdnů, limonády se míchají těsně před podáváním. U každého receptu to píšeme výslovně.',
  ],
  kure: [
    'Křidélka na medu, buffalo wings nebo korejské smažené kuře: křupavá kůže se rodí z dobře osušeného masa, správné teploty trouby a trochy trpělivosti.',
    'Drůbež musí být uvnitř propečená (75 °C). U každého receptu najdeš čas v troubě i alternativu na pánvi či fritéze.',
  ],
  steak: [
    'Dobrý steak je o kvalitním kusu masa, rozpálené pánvi a odpočinku po vytažení. Pečení trvá minuty, rozdíl dělá načasování a teplota uvnitř.',
    'U každého receptu uvádíme čas pro medium rare až well done, a také omáčky, které se k masu hodí.',
  ],
  salaty: [
    'Caesar salát, řecký salát, ovesné kaše přes noc nebo avokádový toast. Lehká jídla, která zasytí a dají se připravit za pár minut.',
    'Dresinky děláme ze surovin, které máš doma. Hotové jsou za pět minut a chutnají lépe než ty z lahve.',
  ],
  polevky: [
    'Dýňová, čočková, bramboračka, zelňačka nebo kulajda. Polévky jsou nejlevnější způsob, jak nasytit celou rodinu, a většina se dá uvařit na dva dny dopředu.',
    'U každého receptu píšeme, kolik se uvaří na kolik porcí, jak dlouho vydrží v lednici a co přidat, aby byla hustší nebo lehčí.',
  ],
  sendvice: [
    'Vajíčková pomazánka, škvarková pomazánka, wrapy, bagety nebo hot dogy. Svačiny, které se dělají rychle a vydrží cestu do práce.',
    'U pomazánek píšeme, jak dlouho vydrží v lednici a co je dobré přidat, když máš chuť na trochu jiné.',
  ],
  koktejly: [
    'Mojito, Aperol Spritz, piña colada, svařák nebo punč: míchané drinky s přesným množstvím v mililitrech, protože od oka se dělá jen kocovina. Ke každému drinku je nealko varianta.',
    'Recepty s alkoholem jsou jen pro dospělé. Kdo řídí, je těhotná nebo prostě nechce, najde u každého koktejlu verzi bez alkoholu, která chutná jako drink, ne jako omluva.',
  ],
  dorty: [
    'Narozeninový, čokoládový, ořechový nebo nepečený dort, větrníky, kremrole a řezy. U dortů rozhoduje korpus, krém, který drží tvar, a čas v lednici, a proto ho píšeme zvlášť.',
    'Velikost formy je u každého receptu uvedená. Kdo peče do jiné, přepočítá suroviny tlačítkem porcí a čas pečení si ohlídá špejlí.',
  ],
};

/** Hub headings and titles for the newer categories, written around the phrase people actually search. */
const HEADS: Record<string, { h1: string; title: string }> = {
  kavarna: { h1: 'Recepty na kávu a kavárenské nápoje', title: 'Recepty na kávu: ledová káva, flat white, cold brew' },
  matcha: { h1: 'Matcha a čaj: recepty na matcha latte a bubble tea', title: 'Matcha latte a bubble tea: recepty na doma' },
  pekarna: { h1: 'Recepty na pečivo, koláče a kynuté dobroty', title: 'Recepty na pečivo a koláče z pekárny' },
  zmrzlina: { h1: 'Domácí zmrzlina a ledové dezerty: recepty', title: 'Domácí zmrzlina – recepty bez zmrzlinovače' },
  napoje: { h1: 'Recepty na limonády, sirupy a smoothie', title: 'Domácí limonády, sirupy a smoothie – recepty' },
  kure: { h1: 'Kuřecí křidélka a smažené kuře: recepty', title: 'Kuřecí křidélka – recepty na křupavé wings' },
  steak: { h1: 'Steaky: jak připravit hovězí steak doma', title: 'Jak udělat steak doma – recepty a teploty' },
  salaty: { h1: 'Saláty a fit recepty na každý den', title: 'Saláty a fit recepty – rychlé a zdravé' },
  polevky: { h1: 'Recepty na polévky: české i světové', title: 'Recepty na polévky – dýňová, čočková, zelňačka' },
  sendvice: { h1: 'Pomazánky, sendviče a wrapy: recepty', title: 'Recepty na pomazánky, wrapy a sendviče' },
  koktejly: { h1: 'Koktejly a míchané drinky: recepty', title: 'Koktejly recepty – mojito, spritz, svařák, nealko' },
  dorty: { h1: 'Dorty a zákusky: recepty krok za krokem', title: 'Recepty na dorty a zákusky – narozeninový i nepečený' },
};


// Facet hubs: one per meal type, main ingredient and diet. Same recipes as the filters, but with their own URL, text and title.
const MEAL_HUBS: Record<string, { h1: string; title: string; intro: string[] }> = {
  snidane: { h1: 'Recepty na snídani', title: 'Snídaně – recepty na rychlé i lenivé ráno', intro: ['Kaše, vejce, palačinky, toasty i granola. Snídaně na pracovní ráno za deset minut i na víkend, kdy se nikam nespěchá.', 'U každého receptu je rozepsané, kolik zabere práce a kolik čekání, ať víš, jestli se stihneš najíst před odchodem.'] },
  predkrm: { h1: 'Předkrmy, pomazánky a občerstvení', title: 'Předkrmy a pomazánky – recepty na oslavu i večer', intro: ['Pomazánky na chleba, chlebíčky, jednohubky, dipy a drobné občerstvení pro hosty. Většina se dá připravit den předem.', 'Pozor na majonézu a vejce: v teple na stole nenechávej nic déle než dvě hodiny.'] },
  polevka: { h1: 'Recepty na polévky', title: 'Polévky – recepty české i světové', intro: ['Od bramboračky a kulajdy po ramen a tom yum. Polévky, které se vaří z obyčejných surovin a zahřejí líp než topení.', 'U vývarů počítej s pomalým vařením, u krémových polévek s mixérem. Čas je v každém receptu rozdělený na práci a vaření.'] },
  salat: { h1: 'Recepty na saláty', title: 'Saláty – recepty na lehkou večeři i k masu', intro: ['Saláty jako samostatné jídlo i jako příloha: bramborový, těstovinový, řecký, zelný nebo s kuřecím masem.', 'U dresinků píšeme poměry, protože o salátu rozhoduje zálivka, ne zelenina.'] },
  hlavni: { h1: 'Hlavní jídla: recepty na oběd a večeři', title: 'Hlavní jídla – recepty na oběd a večeři', intro: ['Maso, ryby, těstoviny, rýže i bezmasá jídla. Hlavní chody od svíčkové po kari, každý s poctivými časy a přepočtem porcí.', 'Spěcháš? Zúži výběr filtrem na jídla do 30 minut. Máš chuť na konkrétní surovinu? Vyber ji v hlavní surovině.'] },
  priloha: { h1: 'Přílohy: knedlíky, brambory, rýže a zelenina', title: 'Přílohy – knedlíky, brambory, rýže, zelenina', intro: ['Knedlíky, bramborová kaše, hranolky, rýže, dušená zelenina a zelí. Přílohy, které dělají z masa oběd.', 'Mnoho příloh se dá uvařit s předstihem a ohřát, takže na hlavní jídlo zbyde klid.'] },
  omacka: { h1: 'Omáčky, dipy a dresinky', title: 'Omáčky, dipy a dresinky – recepty krok za krokem', intro: ['Rajská, houbová, koprová, pesto, bešamel i dresinky na salát. Omáčka často rozhoduje o tom, jestli je jídlo dobré.', 'Většinu uvaříš za 20 minut a dá se zamrazit nebo odložit do lednice.'] },
  pecivo: { h1: 'Pečivo, chleby a koláče', title: 'Pečivo a koláče – kynuté, drobenkové i chleba', intro: ['Chléb, rohlíky, focaccia, koláče a buchty z kynutého i hrnkového těsta. Pečení, kde záleží na teplotě a trpělivosti.', 'Čas kynutí je v receptech vždy uvedený zvlášť, aby tě nepřekvapilo, že chleba nevznikne za hodinu.'] },
  dezert: { h1: 'Dezerty a cukroví', title: 'Dezerty a cukroví – recepty na sladké', intro: ['Sušenky, cukroví, pudinky, zmrzliny, palačinky a lehké dezerty do skleničky. Sladké, které zvládneš i bez zkušeností.', 'U cukroví píšeme počet kusů, odpočinek těsta a skladování.'] },
  dort: { h1: 'Dorty a zákusky', title: 'Dorty a zákusky – narozeninové i nepečené', intro: ['Dorty, řezy, větrníky, kremrole a zákusky z cukrárny. U každého je průměr formy a čas v lednici.', 'Dort se nejlépe krájí den po složení. Kdo peče na poslední chvíli, najde i nepečené varianty.'] },
  napoj: { h1: 'Nápoje: limonády, káva, čaj a koktejly', title: 'Nápoje – káva, limonády, smoothie a koktejly', intro: ['Domácí limonády, ledová káva, smoothie, svařák a koktejly. Recepty s alkoholem jsou jen pro dospělé a mají nealko variantu.', 'Přesné množství v mililitrech je v každém receptu, protože o nápoji rozhodují poměry.'] },
};
const FAMILY_HUBS: Record<string, { h1: string; title: string; lead: string }> = {
  kure: { h1: 'Kuřecí recepty', title: 'Kuřecí recepty – prsa, stehna, křidélka, kari', lead: 'Kuřecí prsa, stehna, křidélka i celé kuře. Drůbež vždy propeč na 75 °C uvnitř.' },
  veprove: { h1: 'Vepřové recepty', title: 'Vepřové recepty – řízek, pečeně, guláš', lead: 'Řízky, pečeně, guláše i uzeniny. Vepřové propeč aspoň na 70 °C uvnitř.' },
  hovezi: { h1: 'Hovězí recepty', title: 'Hovězí recepty – guláš, svíčková, steak', lead: 'Guláše, svíčková, steaky i hovězí vývar. U steaku najdeš teploty pro každý stupeň propečení.' },
  'husa-kachna': { h1: 'Husa a kachna: recepty', title: 'Husa a kachna – pečené s knedlíky a zelím', lead: 'Pečená husa a kachna s červeným zelím. Pomalé pečení, výpek a teploty.' },
  ryba: { h1: 'Recepty z ryb', title: 'Recepty z ryb – losos, kapr, treska, pstruh', lead: 'Losos, kapr, treska, pstruh i tuňák. U ryb hlídej teplotu uvnitř, 63 °C stačí.' },
  'morske-plody': { h1: 'Mořské plody: recepty', title: 'Mořské plody – krevety a další recepty', lead: 'Krevety a další mořské plody, které se hotoví za pár minut.' },
  vejce: { h1: 'Recepty s vejci', title: 'Recepty s vejci – snídaně, omelety, pomazánky', lead: 'Míchaná vejce, omelety, pomazánky a pečení, kde vejce drží celé jídlo pohromadě.' },
  'syr-tvaroh': { h1: 'Recepty se sýrem a tvarohem', title: 'Recepty se sýrem a tvarohem – zapékané i sladké', lead: 'Zapečené těstoviny, sýrové omáčky, tvarohové koláče a pomazánky.' },
  lusteniny: { h1: 'Recepty z luštěnin a tofu', title: 'Recepty z luštěnin a tofu – čočka, cizrna, fazole', lead: 'Čočka, cizrna, fazole, hrách a tofu. Sytá jídla, která vyjdou levně.' },
  testoviny: { h1: 'Těstoviny: recepty', title: 'Těstoviny – recepty od carbonary po zapékané', lead: 'Špagety, zapékané těstoviny, lasagne, noky a nudle ze světových kuchyní.' },
  'ryze-obiloviny': { h1: 'Rýže a obiloviny: recepty', title: 'Recepty z rýže a obilovin – rizoto, bulgur, kroupy', lead: 'Rizoto, smažená rýže, bulgur, kuskus a kroupy.' },
  brambory: { h1: 'Bramborové recepty', title: 'Bramborové recepty – bramboráky, kaše, hranolky', lead: 'Bramboráky, kaše, hranolky, knedlíky a zapékané brambory.' },
  houby: { h1: 'Houbové recepty', title: 'Houbové recepty – polévky, omáčky, kuba', lead: 'Houbová polévka, omáčka, kuba i smažené žampiony.' },
  zelenina: { h1: 'Recepty ze zeleniny', title: 'Recepty ze zeleniny – pečená, dušená, zapékaná', lead: 'Zelenina pečená, dušená, zapékaná i v salátech.' },
  ovoce: { h1: 'Recepty s ovocem', title: 'Recepty s ovocem – koláče, smoothie, dezerty', lead: 'Koláče, smoothie, limonády a dezerty z ovoce.' },
  orechy: { h1: 'Recepty s ořechy', title: 'Recepty s ořechy – cukroví, dorty, řezy', lead: 'Ořechové cukroví, dorty a řezy. Pozor na alergeny: ořechy jsou v receptech vždy vidět.' },
  'testo-pecivo': { h1: 'Recepty z těsta a pečiva', title: 'Recepty z těsta – chleba, koláče, pizza', lead: 'Chleba, pizza, koláče, buchty a těsta, která se hodí na vše.' },
};
const DIET_HUBS: Record<string, { key: string; h1: string; title: string; intro: string[] }> = {
  veganske: { key: 'vegan', h1: 'Veganské recepty', title: 'Veganské recepty – bez masa, vajec i mléka', intro: ['Recepty bez jakýchkoli živočišných surovin. Označení se počítá ze surovin, ne z odhadu, takže v receptu nenajdeš máslo ani vejce.', 'Recepty s alkoholem veganské neoznačujeme: víno a pivo se někdy čistí živočišnými látkami.'] },
  'bez-lepku': { key: 'gf', h1: 'Bezlepkové recepty', title: 'Bezlepkové recepty – jídla bez pšenice a mouky', intro: ['Jídla, ve kterých není pšenice, žito, ječmen ani jiné suroviny s lepkem. Označení se počítá ze surovin receptu.', 'U každé suroviny ale čti obal: výrobci mění receptury a lepek se někdy přidává do omáček a koření. Při celiakii je to nutnost.'] },
  'bez-laktozy': { key: 'lf', h1: 'Recepty bez mléka a laktózy', title: 'Recepty bez mléka a laktózy – jídla i dezerty', intro: ['Jídla bez mléka, smetany, másla a sýrů. Označení se počítá ze surovin receptu.', 'Pokud máš alergii na mléčnou bílkovinu, čti i složení zakoupených surovin: stopy mléka bývají v pečivu a uzeninách.'] },
};

function pushFacetHubs(hubs: Hub[], recipes: Recipe[], meta: Map<string, { meal: string; family: string | null; diets: string[] }>) {
  const add = (slug: string, label: string, h1: string, title: string, intro: string[], list: Recipe[], filterQuery: string) => {
    if (list.length < MIN_RECIPES) return;
    hubs.push({
      slug,
      path: `/recepty/${slug}/`,
      label,
      h1,
      title,
      description: `${list.length} receptů: ${label.toLowerCase()}. S poctivými časy, přepočtem porcí, odhadem nákladů a nákupním seznamem.`,
      intro,
      recipes: list,
      filterQuery,
    });
  };
  for (const [id, h] of Object.entries(MEAL_HUBS)) add(`typ/${id}`, MEAL_LABELS[id] ?? id, h.h1, h.title, h.intro, recipes.filter((r) => meta.get(r.id)?.meal === id), `?typ=${id}`);
  for (const [id, h] of Object.entries(FAMILY_HUBS)) {
    add(`surovina/${id}`, FAMILY_LABELS[id] ?? id, h.h1, h.title, [h.lead, 'Recepty jsou seřazené podle toho, co se nejvíc hodí k obědu a večeři. Filtry vlevo zúží výběr podle času, stravy nebo obtížnosti.'], recipes.filter((r) => meta.get(r.id)?.family === id), `?surovina=${id}`);
  }
  for (const [slug, h] of Object.entries(DIET_HUBS)) {
    const label = DIET_FACETS.find((d) => d.key === h.key)?.label ?? h.h1;
    add(`dieta/${slug}`, label, h.h1, h.title, h.intro, recipes.filter((r) => meta.get(r.id)?.diets.includes(h.key)), `?dieta=${h.key}`);
  }
}

export async function RECIPE_HUBS(): Promise<Hub[]> {
  const recipes = await allRecipes();
  const hubs: Hub[] = [];
  for (const [id, c] of Object.entries(CATEGORY_LABELS)) {
    const list = recipes.filter((r) => r.data.category === id);
    if (list.length < MIN_RECIPES) continue;
    const name = c.label.toLowerCase();
    hubs.push({
      slug: `kuchyne/${id}`,
      path: `/recepty/kuchyne/${id}/`,
      label: c.label,
      h1: HEADS[id]?.h1 ?? (id === 'ceska' ? 'Recepty české kuchyně' : id === 'palacinky' ? 'Recepty na palačinky a lívance' : `${c.label}: recepty`),
      title: HEADS[id]?.title ?? (id === 'ceska' ? 'Recepty české kuchyně krok za krokem' : `${c.label} – recepty na doma`),
      description: `${list.length} receptů (${name}) s poctivými časy, přepočtem porcí, odhadem nákladů a nákupním seznamem. ${c.lead}`,
      intro: INTRO[id] ?? [c.lead],
      recipes: list,
      filterQuery: `?kuchyne=${id}`,
    });
  }
  for (const id of OCCASION_IDS) {
    const o = OCCASIONS[id];
    const list = recipes.filter((r) => r.data.occasions.includes(id));
    if (list.length < MIN_RECIPES) continue;
    hubs.push({
      slug: `prilezitosti/${id}`,
      path: `/recepty/prilezitosti/${id}/`,
      label: o.label,
      h1: o.h1,
      title: o.title,
      description: `${list.length} receptů (${o.label.toLowerCase()}) s poctivými časy, přepočtem porcí, odhadem nákladů a nákupním seznamem.`,
      intro: o.intro,
      recipes: list,
      filterQuery: `?svatek=${id}`,
    });
  }
  const meta = new Map((await recipeIndex()).recipes.map((r) => [r.id, { meal: r.meal, family: r.family, diets: r.diets as string[] }]));
  pushFacetHubs(hubs, recipes, meta);
  const quick = recipes.filter((r) => totalMinutes(r) <= 30);
  if (quick.length >= MIN_RECIPES)
    hubs.push({
      slug: 'rychle',
      path: '/recepty/rychle/',
      label: 'Rychlé recepty',
      h1: 'Rychlé recepty do 30 minut',
      title: 'Rychlé recepty do 30 minut včetně vaření',
      description: `${quick.length} receptů, které jsou hotové do 30 minut včetně vaření a čekání. S nákupním seznamem a přepočtem porcí.`,
      intro: [
        'Sem patří jen recepty, které jsou hotové nejpozději za 30 minut včetně vaření a čekání. Kynutí ani marinování přes noc tu nenajdeš, to je jiná liga trpělivosti.',
        'Čas počítáme od chvíle, kdy máš suroviny na lince. Nákup do něj nepatří, na ten je nákupní seznam.',
      ],
      recipes: quick.sort((a, b) => totalMinutes(a) - totalMinutes(b)),
    });
  const veg = recipes.filter((r) => r.data.vegetarian);
  if (veg.length >= MIN_RECIPES)
    hubs.push({
      slug: 'bez-masa',
      path: '/recepty/bez-masa/',
      label: 'Bez masa',
      h1: 'Recepty bez masa',
      title: 'Recepty bez masa – vegetariánská jídla na doma',
      description: `${veg.length} vegetariánských receptů napříč kuchyněmi: pizza, těstoviny, kari, bowly, palačinky i dezerty.`,
      intro: [
        'Všechny recepty bez masa a ryb na jednom místě, napříč kuchyněmi. Některé obsahují sýr, vejce nebo máslo, veganské jsou označené zvlášť, ať nikdo nehádá.',
        'Parmazán a některé další tvrdé sýry se vyrábějí se syřidlem živočišného původu. Kdo to řeší, najde v receptech náhrady.',
      ],
      recipes: veg,
    });
  return hubs;
}

/** Occasion hubs, the ones in season on `now` first (then the fixed order of OCCASION_IDS). */
export async function occasionHubs(now: Date): Promise<Hub[]> {
  const hubs = (await RECIPE_HUBS()).filter((h) => h.slug.startsWith('prilezitosti/'));
  const ids = hubs.map((h) => h.slug.slice('prilezitosti/'.length));
  const live = occasionsInSeason(now, ids);
  const rank = (h: Hub) => {
    const i = live.indexOf(h.slug.slice('prilezitosti/'.length) as OccasionId);
    return i === -1 ? 100 + OCCASION_IDS.indexOf(h.slug.slice('prilezitosti/'.length) as OccasionId) : i;
  };
  return hubs.sort((a, b) => rank(a) - rank(b));
}

/** The hub to feature on the home page and /recepty/ right now, if any occasion is in season. */
export async function seasonalHub(now: Date): Promise<{ hub: Hub; rail: string; note: string } | null> {
  const hubs = await occasionHubs(now);
  const ids = hubs.map((h) => h.slug.slice('prilezitosti/'.length));
  const [first] = occasionsInSeason(now, ids);
  if (!first) return null;
  const hub = hubs.find((h) => h.slug === `prilezitosti/${first}`)!;
  return { hub, rail: OCCASIONS[first].rail, note: OCCASIONS[first].railNote };
}


// ---------- "What to cook" landing pages: they answer what people type (co k večeři, co na oběd, nápady na večeři, co dnes vařit) ----------

/** ISO week number, so the weekly pick changes every Monday after the scheduled rebuild. */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export async function ideaHubs(now = new Date()): Promise<Hub[]> {
  const entries = new Map((await allRecipes()).map((r) => [r.id, r]));
  const idx = (await recipeIndex()).recipes.filter((r) => !r.alcohol);
  const pick = (list: typeof idx, n: number) => list.slice(0, n).map((r) => entries.get(r.id)).filter((r): r is Recipe => !!r);
  const byQuality = (a: (typeof idx)[number], b: (typeof idx)[number]) => b.w - a.w || a.title.localeCompare(b.title, 'cs');
  const week = isoWeek(now);
  const cta = { href: '/restaurace/', label: 'Nejdřív si objednej nanečisto' };

  const dinner = idx.filter((r) => ['hlavni', 'polevka', 'salat'].includes(r.meal) && r.min <= 60).sort(byQuality);
  const lunch = idx.filter((r) => ['hlavni', 'polevka'].includes(r.meal) && r.min <= 90 && r.cost <= 70).sort((a, b) => a.cost - b.cost || byQuality(a, b));
  const ideas = idx.filter((r) => ['hlavni', 'salat', 'predkrm', 'snidane'].includes(r.meal) && r.min <= 30).sort((a, b) => a.act - b.act || byQuality(a, b));
  const poolToday = idx.filter((r) => r.meal === 'hlavni').sort(byQuality).slice(0, 60);
  const today = [...poolToday].sort((a, b) => hash(`${week}${a.id}`) - hash(`${week}${b.id}`));

  const make = (slug: string, h1: string, title: string, description: string, intro: string[], list: typeof idx, faq: { q: string; a: string }[]): Hub => ({
    slug: `napady/${slug}`,
    path: `/${slug}/`,
    label: h1.split(':')[0]!,
    h1,
    title,
    description,
    intro,
    recipes: pick(list, slug === 'co-dnes-varit' ? 12 : 24),
    faq,
    cta,
  });
  return [
    make(
      'co-k-veceri',
      'Co k večeři: nápady, které zvládneš dnes',
      'Co k večeři? Nápady na dnešní večeři s recepty',
      'Co k večeři? 24 receptů na hlavní jídla, polévky a saláty do hodiny, s časem práce, cenou na porci a nákupním seznamem.',
      ['Hlad už je tady, nápad ne. Tyhle recepty jsou vybrané tak, aby večeře stála na stole do hodiny: hlavní jídla, polévky a saláty s přesnými časy.', 'Nemůžeš se rozhodnout? Nejdřív si objednej nanečisto, ať se rozhodneš očima. Potom si jídlo uvař doopravdy.'],
      dinner,
      [
        { q: 'Co k večeři, když nemám moc času?', a: 'Vyber recepty do 30 minut: omelety, těstoviny nebo jídla z jedné pánve. U každého receptu je zvlášť čas vlastní práce a celkový čas, takže víš, kolik se u sporáku opravdu strávíš.' },
        { q: 'Jak vybrat levnou večeři?', a: 'Na stránce receptů seřaď výsledky podle ceny na porci. Cena je ilustrační odhad ze surovin, ne nabídka obchodu, ale k porovnání jídel stačí.' },
        { q: 'Dá se večeře připravit dopředu?', a: 'Polévky, omáčky a zapékaná jídla se dají připravit den předem a ohřát. Hotové jídlo dej do lednice nejpozději do dvou hodin po uvaření a ohřívej ho důkladně.' },
      ],
    ),
    make(
      'co-na-obed',
      'Co na oběd: levné a sytící nápady',
      'Co na oběd? Levné nápady na oběd s recepty',
      'Co na oběd? Levná a sytá jídla a polévky s receptem, cenou na porci a nákupním seznamem. Vyber si podle ceny a času.',
      ['Oběd má být sytý, hotový včas a nemá rozbít rozpočet. Tyhle recepty jsou seřazené od nejlevnějších a mají odhad ceny na porci.', 'U polévek a omáček se vyplatí uvařit víc: druhý den je oběd hotový za pět minut.'],
      lunch,
      [
        { q: 'Co na oběd, když chci něco levného?', a: 'Hledej luštěniny, brambory, těstoviny a polévky. Cena na porci je u každého receptu vidět hned na kartě.' },
        { q: 'Co na oběd do práce?', a: 'Dobře se vozí gulášové polévky, těstovinové saláty a zapékané těstoviny. Do krabičky je dej až vychladlé a v kanceláři je důkladně ohřej.' },
        { q: 'Kolik obědů z jednoho vaření vyjde?', a: 'U většiny receptů je počet porcí nahoře a jde přepočítat jedním tlačítkem. Pro dva dny vař na čtyři porce.' },
      ],
    ),
    make(
      'napady-na-veceri',
      'Nápady na večeři: hotovo do půl hodiny',
      'Nápady na večeři do 30 minut – recepty krok za krokem',
      'Nápady na večeři, které jsou hotové do 30 minut včetně vaření. Rychlé recepty s časem práce, cenou na porci a nákupním seznamem.',
      ['Večeře na poslední chvíli: vše, co je hotové do půl hodiny včetně vaření. Řazeno od receptů s nejmíň práce.', 'Čas počítáme od chvíle, kdy máš suroviny na lince. Nákup do něj nepatří, na ten je nákupní seznam.'],
      ideas,
      [
        { q: 'Jaká večeře je opravdu rychlá?', a: 'Taková, kde se nic nemarinuje ani nekyne. Tady jsou jen recepty, jejichž práce, vaření i čekání dohromady nepřesáhnou 30 minut.' },
        { q: 'Dá se rychlá večeře udělat bez masa?', a: 'Ano. Zúž výběr filtrem „Bez masa“ na stránce receptů, najdeš těstoviny, vejce, placky i saláty.' },
        { q: 'Jak ušetřit čas při vaření?', a: 'Nejdřív si přečti celý recept, nachystej suroviny a pak teprve zapni sporák. Většina zdržení vzniká hledáním a krájením za pochodu.' },
      ],
    ),
    make(
      'co-dnes-varit',
      'Co dnes vařit: tip na tento týden',
      'Co dnes vařit? Tip na tento týden s recepty',
      'Co dnes vařit? Dvanáct hlavních jídel vybraných na tento týden. Každé pondělí se výběr změní, recepty jsou krok za krokem.',
      ['Nechce se ti rozhodovat? Tady je dvanáct hlavních jídel na tento týden, která vybírá náhoda z těch nejpropracovanějších receptů. Každé pondělí se výběr promíchá.', 'Líbí se ti něco? Objednej si to nejdřív nanečisto, ať zjistíš, jestli na to máš chuť.'],
      today.slice(0, 12),
      [
        { q: 'Jak se vybírá tip na tento týden?', a: 'Z hlavních jídel s nejpropracovanějším receptem a pak náhodně. Výběr se mění každé pondělí.' },
        { q: 'Co dnes vařit, když doma nic není?', a: 'Zkus na stránce receptů volbu „Mám doma“: zadáš, co v lednici máš, a recepty se seřadí podle toho, kolik surovin ti chybí.' },
        { q: 'Je to doporučení, nebo reklama?', a: 'Je to náhodný výběr z našich receptů. Žádný z nich není placená reklama, partnerský odkaz na Rohlik.cz je u receptů vždy označený.' },
      ],
    ),
  ];
}
