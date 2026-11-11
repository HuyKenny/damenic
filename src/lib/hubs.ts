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
