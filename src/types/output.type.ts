export interface MarketSymbol {
  id: number;
  symbol: string; // e.g., "BTC_USDT"
  info: string;
}

export type MarketSymbols = Record<string, MarketSymbol>

export interface OrderBookEntry {
  price: number;
  amount: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}
