export type Stock = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sector: string;
  marketCap: string;
  volume: string;
};

export type NewsItem = {
  id: number;
  title: string;
  date: string;
  summary: string;
  category: string;
  readTime: string;
};

export type IndexQuote = {
  name: string;
  value: number;
  change: number;
};

export type CommodityQuote = {
  name: string;
  symbol: string;
  price: number;
  change: number;
  icon: string;
};

export const stocks: Stock[] = [
  { symbol: "AAPL", name: "Apple", price: 232.47, change: 3.12, changePercent: 1.36, sector: "Technologie", marketCap: "3 520 Md CHF", volume: "58,2 M" },
  { symbol: "MSFT", name: "Microsoft", price: 428.9, change: -1.84, changePercent: -0.43, sector: "Technologie", marketCap: "3 190 Md CHF", volume: "22,7 M" },
  { symbol: "GOOGL", name: "Alphabet", price: 178.32, change: 2.45, changePercent: 1.39, sector: "Technologie", marketCap: "2 210 Md CHF", volume: "28,4 M" },
  { symbol: "AMZN", name: "Amazon", price: 201.16, change: -0.97, changePercent: -0.48, sector: "Consommation", marketCap: "2 100 Md CHF", volume: "40,1 M" },
  { symbol: "TSLA", name: "Tesla", price: 246.71, change: -5.2, changePercent: -2.06, sector: "Automobile", marketCap: "790 Md CHF", volume: "95,6 M" },
  { symbol: "NFLX", name: "Netflix", price: 689.24, change: 8.9, changePercent: 1.31, sector: "Médias", marketCap: "295 Md CHF", volume: "3,4 M" },
  { symbol: "NVDA", name: "NVIDIA", price: 138.25, change: 4.05, changePercent: 3.02, sector: "Semi-conducteurs", marketCap: "3 380 Md CHF", volume: "212,9 M" },
  { symbol: "META", name: "Meta Platforms", price: 566.58, change: 6.34, changePercent: 1.13, sector: "Technologie", marketCap: "1 430 Md CHF", volume: "15,8 M" },
  { symbol: "BNP", name: "BNP Paribas", price: 71.82, change: 0.44, changePercent: 0.62, sector: "Banque", marketCap: "82 Md CHF", volume: "4,9 M" },
  { symbol: "AIR", name: "Airbus", price: 159.34, change: -1.12, changePercent: -0.7, sector: "Aéronautique", marketCap: "125 Md CHF", volume: "2,1 M" },
  { symbol: "MC", name: "LVMH", price: 612.5, change: 4.9, changePercent: 0.81, sector: "Luxe", marketCap: "306 Md CHF", volume: "1,8 M" },
  { symbol: "OR", name: "L'Oréal", price: 391.2, change: -2.4, changePercent: -0.61, sector: "Cosmétique", marketCap: "207 Md CHF", volume: "1,2 M" },
  { symbol: "SAN", name: "Sanofi", price: 98.74, change: 1.15, changePercent: 1.18, sector: "Santé", marketCap: "123 Md CHF", volume: "2,6 M" },
  { symbol: "TTE", name: "TotalEnergies", price: 58.32, change: -0.76, changePercent: -1.29, sector: "Énergie", marketCap: "138 Md CHF", volume: "6,4 M" },
  { symbol: "RMS", name: "Hermès", price: 2_312.0, change: 28.4, changePercent: 1.24, sector: "Luxe", marketCap: "242 Md CHF", volume: "0,4 M" },
  { symbol: "EL", name: "EssilorLuxottica", price: 208.45, change: 1.9, changePercent: 0.92, sector: "Optique", marketCap: "94 Md CHF", volume: "1,1 M" },
];

export const indices: IndexQuote[] = [
  { name: "CAC 40", value: 7_842.35, change: 0.62 },
  { name: "Dow Jones", value: 44_312.1, change: 0.44 },
  { name: "Nasdaq", value: 19_845.77, change: -0.18 },
  { name: "S&P 500", value: 6_123.9, change: 0.25 },
  { name: "DAX 40", value: 21_487.64, change: 0.31 },
  { name: "FTSE 100", value: 8_712.28, change: -0.12 },
  { name: "Euro Stoxx 50", value: 5_318.72, change: 0.47 },
  { name: "Nikkei 225", value: 40_285.1, change: 0.84 },
];

export const commodities: CommodityQuote[] = [
  { name: "Or", symbol: "XAU", price: 2_894.5, change: 1.21, icon: "🥇" },
  { name: "Argent", symbol: "XAG", price: 32.18, change: 0.65, icon: "🥈" },
  { name: "Pétrole Brent", symbol: "BRENT", price: 82.41, change: -0.83, icon: "🛢️" },
  { name: "Gaz naturel", symbol: "NG", price: 3.21, change: -1.38, icon: "🔥" },
  { name: "Blé", symbol: "WHEAT", price: 236.5, change: 0.42, icon: "🌾" },
  { name: "Bitcoin", symbol: "BTC", price: 96_480, change: 2.42, icon: "₿" },
  { name: "Ethereum", symbol: "ETH", price: 3_420, change: 1.76, icon: "Ξ" },
  { name: "EURO", symbol: "EUR", price: 1.0942, change: 0.15, icon: "💶" },
];

export const news: NewsItem[] = [
  {
    id: 1,
    title: "La Fed maintient ses taux, les marchés respirent",
    date: "11 août 2026",
    category: "Banques centrales",
    readTime: "4 min",
    summary:
      "La Réserve fédérale américaine a décidé de maintenir ses taux directeurs, rassurant les investisseurs sur les marchés européens et américains.",
  },
  {
    id: 2,
    title: "Les valeurs technologiques portent la hausse du CAC 40",
    date: "10 août 2026",
    category: "Marchés",
    readTime: "3 min",
    summary:
      "Porté par les géants de la tech, le CAC 40 a clôturé en hausse de 0,8%, les investisseurs restant optimistes sur la saison des résultats.",
  },
  {
    id: 3,
    title: "Pétrole : l'OPEP+ annonce une réduction de la production",
    date: "9 août 2026",
    category: "Énergie",
    readTime: "5 min",
    summary:
      "L'annonce d'une baisse de la production pétrolière a fait grimper le baril de 2,3%, soutenant les valeurs énergétiques.",
  },
  {
    id: 4,
    title: "L'or au plus haut depuis un an face aux incertitudes",
    date: "8 août 2026",
    category: "Matières premières",
    readTime: "4 min",
    summary:
      "Le métal jaune profite des incertitudes économiques et atteint son plus haut niveau depuis douze mois, les investisseurs cherchant une valeur refuge.",
  },
  {
    id: 5,
    title: "La BCE détaille sa nouvelle politique monétaire",
    date: "7 août 2026",
    category: "Banques centrales",
    readTime: "6 min",
    summary:
      "La Banque centrale européenne a présenté les grandes lignes de sa politique pour les prochains trimestres, saluée par les analystes.",
  },
  {
    id: 6,
    title: "NVIDIA dévoile sa nouvelle génération de puces IA",
    date: "6 août 2026",
    category: "Technologie",
    readTime: "3 min",
    summary:
      "Le géant des semi-conducteurs a présenté une gamme de processeurs plus performants, tirant le titre vers de nouveaux sommets.",
  },
  {
    id: 7,
    title: "Immobilier : les taux de crédit au plus bas depuis 2022",
    date: "5 août 2026",
    category: "Économie",
    readTime: "4 min",
    summary:
      "La baisse des taux directeurs se traduit par un allègement des mensualités, redonnant du pouvoir d'achat aux acquéreurs.",
  },
  {
    id: 8,
    title: "Le luxe français enregistre une croissance record en Asie",
    date: "4 août 2026",
    category: "Luxe",
    readTime: "5 min",
    summary:
      "LVMH, Hermès et Kering affichent des ventes soutenues portées par la demande asiatique, confortant la cote parisienne.",
  },
  {
    id: 9,
    title: "Le marché de l'art : une valeur refuge qui séduit les investisseurs",
    date: "3 août 2026",
    category: "Art & Investissement",
    readTime: "7 min",
    summary:
      "Face à la volatilité boursière, de plus en plus d'investisseurs se tournent vers les œuvres d'art comme placement alternatif.",
  },
];
