import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  stocks as seedStocks,
  indices as seedIndices,
  commodities as seedCommodities,
  news as seedNews,
  Stock,
  IndexQuote,
  CommodityQuote,
  NewsItem,
} from "@/data/market";
import { seededRandom, stepIndexQuote, stepQuote } from "@/lib/market";

export const MARKET_TICK_MS = 3000;

type MarketContextType = {
  stocks: Stock[];
  indices: IndexQuote[];
  commodities: CommodityQuote[];
  news: NewsItem[];
  lastUpdate: Date | null;
};

const MarketContext = createContext<MarketContextType>({
  stocks: seedStocks,
  indices: seedIndices,
  commodities: seedCommodities,
  news: seedNews,
  lastUpdate: null,
});

export function MarketProvider({ children }: { children: ReactNode }) {
  const [stocks, setStocks] = useState<Stock[]>(seedStocks);
  const [indices, setIndices] = useState<IndexQuote[]>(seedIndices);
  const [commodities, setCommodities] = useState<CommodityQuote[]>(seedCommodities);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const rng = seededRandom(Math.floor(Date.now() / 1000));
    const interval = setInterval(() => {
      setStocks((prev) => prev.map((s) => stepQuote(s, rng)));
      setIndices((prev) => prev.map((i) => stepIndexQuote(i, rng)));
      setCommodities((prev) => prev.map((c) => stepQuote(c, rng)));
      setLastUpdate(new Date());
    }, MARKET_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <MarketContext.Provider
      value={{ stocks, indices, commodities, news: seedNews, lastUpdate }}
    >
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  return useContext(MarketContext);
}
