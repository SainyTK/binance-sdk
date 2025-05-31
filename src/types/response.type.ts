// Type for a single symbol in Binance's /api/v3/exchangeInfo response
export interface BinanceExchangeInfoSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  otoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  allowAmend: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: any[];
  permissions: string[];
  permissionSets: string[][];
  defaultSelfTradePreventionMode: string;
  allowedSelfTradePreventionModes: string[];
}

// Type for the full /api/v3/exchangeInfo response
export interface BinanceExchangeInfoResponse {
  timezone: string;
  serverTime: number;
  rateLimits: any[];
  exchangeFilters: any[];
  symbols: BinanceExchangeInfoSymbol[];
  sors?: any[];
}

export type ResponseOrderBookEntry = [
  string, // order id
  number, // timestamp
  number, // volume
  number, // rate
  number, // amount
];

export interface ResponseOrderBookResult {
  bids: ResponseOrderBookEntry[];
  asks: ResponseOrderBookEntry[];
}

export interface OrderBookResponse {
  error: number;
  result: ResponseOrderBookResult;
}

export interface DepthUpdateEvent {
  e: "depthUpdate";
  E: number; // Event time
  s: string; // Symbol
  U: number; // First update ID in event
  u: number; // Final update ID in event
  b: [string, string][]; // Bids to be updated
  a: [string, string][]; // Asks to be updated
}

export interface BinanceAPIDepth {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}
