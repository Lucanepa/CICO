import {
  Apple,
  Banana,
  Beef,
  Beer,
  Cake,
  Candy,
  Carrot,
  Cherry,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Donut,
  Drumstick,
  Egg,
  EggFried,
  Fish,
  Grape,
  IceCream,
  Martini,
  Milk,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  Wheat,
  Wine,
  type LucideIcon,
} from 'lucide-react'

// Match order matters: more specific first.
const RULES: Array<{ pattern: RegExp; icon: LucideIcon }> = [
  // Drinks
  { pattern: /(beer|lager|ale|pils|ipa)/i, icon: Beer },
  { pattern: /(wine|prosecco|champagne|chianti)/i, icon: Wine },
  { pattern: /(cocktail|gin|vodka|rum|whisky|tequila|martini|aperol)/i, icon: Martini },
  { pattern: /(coffee|espresso|cappuccino|latte|americano|mocha)/i, icon: Coffee },
  { pattern: /(soda|cola|sprite|fanta|pepsi|lemonade|tonic|juice|smoothie)/i, icon: CupSoda },
  // Dairy
  { pattern: /(milk|latte intero|whole milk|skim milk|joghurt|yogurt|yoghurt|kefir|cream|panna|cheese|formaggio|fromage|käse|mozzarella|parmig|gouda|cheddar|brie|camembert|feta|ricotta|burrata)/i, icon: Milk },
  // Eggs
  { pattern: /(egg fried|huevo frito|fried egg|uovo fritto|spiegelei)/i, icon: EggFried },
  { pattern: /(egg|uovo|huevo|œuf|ei\b)/i, icon: Egg },
  // Meats
  { pattern: /(chicken|pollo|poulet|hähnchen|huhn|drumstick|wing)/i, icon: Drumstick },
  { pattern: /(beef|manzo|bœuf|rind|steak|burger|hamburger|meatball|polpett)/i, icon: Beef },
  { pattern: /(fish|salmon|tuna|tonno|cod|merluzz|trout|trota|sardin|anchov|herring|mackerel)/i, icon: Fish },
  // Carbs / mains
  { pattern: /(pizza)/i, icon: Pizza },
  { pattern: /(sandwich|panino|toast|baguette|sub|wrap)/i, icon: Sandwich },
  { pattern: /(salad|insalata|salade|salat)/i, icon: Salad },
  { pattern: /(soup|zuppa|minestra|brodo|ramen|broth|suppe)/i, icon: Soup },
  { pattern: /(croissant|brioche|cornetto)/i, icon: Croissant },
  // Sweets
  { pattern: /(donut|doughnut|berliner|krapfen|ciambell)/i, icon: Donut },
  { pattern: /(cake|torta|tarte|kuchen|cheesecake|tiramis)/i, icon: Cake },
  { pattern: /(cookie|biscotto|biscuit|keks)/i, icon: Cookie },
  { pattern: /(ice ?cream|gelato|sorbet|sorbetto|popsicle|magnum)/i, icon: IceCream },
  { pattern: /(candy|caramel|chocolate|cioccolat|schokolad|nougat|haribo|gummy|gummi)/i, icon: Candy },
  { pattern: /(popcorn|chips|crisps|pretzel|brezel)/i, icon: Popcorn },
  // Fruit
  { pattern: /(apple|mela|pomme|apfel)/i, icon: Apple },
  { pattern: /(banana|banane)/i, icon: Banana },
  { pattern: /(cherry|cilieg|kirsche)/i, icon: Cherry },
  { pattern: /(grape|uva|raisin|uvetta)/i, icon: Grape },
  { pattern: /(orange|lemon|lime|limon|citrus|agrumi|mandarin|grapefruit|pomelo)/i, icon: Citrus },
  // Veg & grains
  { pattern: /(carrot|carot|möhre|karotte)/i, icon: Carrot },
  { pattern: /(bread|pane|brot|pain|wheat|farro|grano|getreide|cereal|müesli|muesli|granola|oats|avena|haferfl|pasta|spaghetti|penne|fusilli|rigatoni|tagliatelle|gnocchi|risotto|rice|riso|reis)/i, icon: Wheat },
]

const CATEGORY_RULES: Array<{ tag: string; icon: LucideIcon }> = [
  { tag: 'beverages', icon: CupSoda },
  { tag: 'alcoholic-beverages', icon: Wine },
  { tag: 'dairies', icon: Milk },
  { tag: 'cheeses', icon: Milk },
  { tag: 'yogurts', icon: Milk },
  { tag: 'meats', icon: Beef },
  { tag: 'poultry', icon: Drumstick },
  { tag: 'fishes', icon: Fish },
  { tag: 'seafood', icon: Fish },
  { tag: 'eggs', icon: Egg },
  { tag: 'fruits', icon: Apple },
  { tag: 'vegetables', icon: Carrot },
  { tag: 'pizzas', icon: Pizza },
  { tag: 'sandwiches', icon: Sandwich },
  { tag: 'snacks-sweet', icon: Candy },
  { tag: 'chocolates', icon: Candy },
  { tag: 'biscuits', icon: Cookie },
  { tag: 'ice-creams', icon: IceCream },
  { tag: 'breakfasts', icon: Croissant },
  { tag: 'breads', icon: Wheat },
  { tag: 'cereals', icon: Wheat },
  { tag: 'pastas', icon: Wheat },
  { tag: 'rices', icon: Wheat },
  { tag: 'soups', icon: Soup },
  { tag: 'salads', icon: Salad },
  { tag: 'coffees', icon: Coffee },
  { tag: 'beers', icon: Beer },
  { tag: 'wines', icon: Wine },
]

export function foodIcon(name: string, categories?: string[] | null): LucideIcon {
  for (const { pattern, icon } of RULES) {
    if (pattern.test(name)) return icon
  }
  if (categories?.length) {
    const joined = categories.join(' ').toLowerCase()
    for (const { tag, icon } of CATEGORY_RULES) {
      if (joined.includes(tag)) return icon
    }
  }
  return UtensilsCrossed
}
