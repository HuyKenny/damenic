// Recipe hub pages: one per cuisine plus "quick" and "meat-free". Each has its own intro text; hubs with fewer than
// MIN_RECIPES recipes are not generated, so no thin pages exist.
import { allRecipes, totalMinutes, type Recipe } from './content';
import { CATEGORY_LABELS } from './site';

export const MIN_RECIPES = 3;

export interface Hub {
  slug: string;
  path: string;
  h1: string;
  title: string;
  description: string;
  intro: string[];
  recipes: Recipe[];
}

const INTRO: Record<string, string[]> = {
  pizza: [
    'Domácí pizza stojí na těstě, které má čas vykynout, a na troubě rozpálené na maximum. Recepty počítají s běžnou troubou a plechem, ne s pecí na dřevo.',
    'Začni základním těstem, pak zkus Margheritu, pálivou Diavolu nebo čtyři sýry. U každého receptu najdeš poctivě rozepsaný čas kynutí.',
  ],
  burgery: [
    'Burger z domácí kuchyně je hlavně o mletém mase s dostatkem tuku, rozpálené pánvi a bulce, která se krátce opeče. Recepty jsou na čtyři kusy.',
    'K burgerům patří i přílohy: domácí hranolky, cibulové kroužky a coleslaw mají vlastní recepty.',
  ],
  ceska: [
    'Česká kuchyně je o omáčkách, polévkách a trpělivosti. Svíčková, guláš, kulajda nebo bramboráky se nedají uspěchat, a tak u nich přesně píšeme, kolik času zabere vaření a kolik vlastní práce.',
    'Recepty počítají se surovinami z běžného obchodu a s množstvím pro rodinu. Porce si přepočítáš jedním tlačítkem a suroviny pošleš do nákupního seznamu.',
  ],
  asijska: [
    'Ramen, pho, jarní závitky nebo bibimbap: asijská jídla, která se dají uvařit v obyčejné kuchyni. Většinu surovin seženeš v supermarketu, zbytek v asijské večerce.',
    'U vývarů počítej s časem na pomalé vaření, u jídel z woku naopak s rychlou prací. Obojí v receptech rozlišujeme.',
  ],
  sushi: [
    'Domácí sushi začíná u správně uvařené a ochucené rýže. Teprve pak přijdou na řadu nori, ryba a ostrý nůž.',
    'Rybu na syrovou konzumaci kupuj jen tam, kde je k tomu určená. Recepty uvádějí i varianty bez syrové ryby.',
  ],
  thajska: [
    'Thajská kuchyně stojí na rovnováze slaného, sladkého, kyselého a pálivého. Rybí omáčka, limetka, cukr a chilli se přidávají postupně a ochutnávají.',
    'Pad thai, kari s kokosovým mlékem i polévky tom yum a tom kha se dají připravit za méně než hodinu.',
  ],
  indicka: [
    'Indická jídla vyžadují hlavně koření a čas na jeho opražení. Butter chicken, tikka masala, chana masala nebo dal uvaříš v jednom hrnci.',
    'K omáčkám patří rýže basmati nebo placky naan, které se dají upéct na pánvi.',
  ],
  mexicka: [
    'Tortilly, fazole, avokádo a chilli: z několika základních surovin vznikne chilli con carne, tacos, burrito i quesadilla.',
    'Guacamole a salsa se dělají za pár minut, chilli con carne naopak potřebuje hodinu pomalého vaření.',
  ],
  kebab: [
    'Kebab doma nevznikne na rožni, ale z marinovaného masa upečeného v troubě nebo na pánvi. K němu patří pita, zelí a omáčky.',
    'Tzatziki, hummus a pita chléb mají vlastní recepty a hodí se i samostatně.',
  ],
  italska: [
    'Lasagne, rizoto, gnocchi, boloňská omáčka nebo tiramisu: italská klasika, kterou zvládneš s běžnými surovinami.',
    'U těstovin rozhoduje voda z vaření a načasování, u lasagní a tiramisu čas v troubě a v lednici. Obojí v receptech uvádíme zvlášť.',
  ],
  vegetarianska: [
    'Jídla bez masa, u kterých nikdo nebude hledat, co chybí: kari s cizrnou, pečený lilek, tofu na pánvi nebo zeleninové lasagne.',
    'Recepty označené jako veganské neobsahují žádné živočišné suroviny.',
  ],
  poke: [
    'Poke bowl je miska rýže s rybou, tofu nebo kuřetem a spoustou zeleniny. Většinu práce dá krájení, vaří se jen rýže.',
    'Syrovou rybu kupuj jen určenou ke konzumaci za syrova, nebo ji nahraď pečeným lososem či tofu.',
  ],
  palacinky: [
    'Palačinky, lívance i americké pancakes se dělají z podobných surovin, liší se hustotou těsta a kypřením.',
    'Recepty počítají s běžnou pánví a radí, jak na tenké palačinky, které se netrhají, a nadýchané lívance.',
  ],
  dezerty: [
    'Perník, bábovka, muffiny, brownies nebo cheesecake: dezerty s přesnou teplotou trouby, velikostí formy a zkouškou, jak poznat, že jsou hotové.',
    'Čas pečení a čas chladnutí uvádíme odděleně, protože u cheesecaku nebo panna cotty je čekání delší než práce.',
  ],
  snidane: [
    'Ovesná kaše, granola, vejce Benedikt, french toast nebo shakshuka. Snídaně, které stihneš ráno, i ty na víkend.',
    'U každého receptu je vidět, kolik minut zabere práce a kolik vaření.',
  ],
};

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
      h1: id === 'ceska' ? 'Recepty české kuchyně' : id === 'palacinky' ? 'Recepty na palačinky a lívance' : `${c.label}: recepty`,
      title: id === 'ceska' ? 'Recepty české kuchyně krok za krokem' : `${c.label} – recepty na doma`,
      description: `${list.length} receptů (${name}) s poctivými časy, přepočtem porcí, odhadem nákladů a nákupním seznamem. ${c.lead}`,
      intro: INTRO[id] ?? [c.lead],
      recipes: list,
    });
  }
  const quick = recipes.filter((r) => totalMinutes(r) <= 30);
  if (quick.length >= MIN_RECIPES)
    hubs.push({
      slug: 'rychle',
      path: '/recepty/rychle/',
      h1: 'Rychlé recepty do 30 minut',
      title: 'Rychlé recepty do 30 minut včetně vaření',
      description: `${quick.length} receptů, které jsou hotové do 30 minut včetně vaření a čekání. S nákupním seznamem a přepočtem porcí.`,
      intro: [
        'Sem patří jen recepty, u kterých je celkový čas včetně vaření a čekání nejvýš 30 minut. Kynutí ani marinování přes noc tu nenajdeš.',
        'Čas počítáme od chvíle, kdy máš suroviny na lince. Nákup do něj nepatří, na ten je nákupní seznam.',
      ],
      recipes: quick.sort((a, b) => totalMinutes(a) - totalMinutes(b)),
    });
  const veg = recipes.filter((r) => r.data.vegetarian);
  if (veg.length >= MIN_RECIPES)
    hubs.push({
      slug: 'bez-masa',
      path: '/recepty/bez-masa/',
      h1: 'Recepty bez masa',
      title: 'Recepty bez masa – vegetariánská jídla na doma',
      description: `${veg.length} vegetariánských receptů napříč kuchyněmi: pizza, těstoviny, kari, bowly, palačinky i dezerty.`,
      intro: [
        'Všechny recepty bez masa a ryb na jednom místě, napříč kuchyněmi. Některé obsahují sýr, vejce nebo máslo, veganské jsou označené zvlášť.',
        'Parmazán a některé další tvrdé sýry se vyrábějí se syřidlem živočišného původu. Kdo to řeší, najde v receptech náhrady.',
      ],
      recipes: veg,
    });
  return hubs;
}
