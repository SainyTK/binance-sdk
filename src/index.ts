import axios from "axios";
import { MarketSymbols, OrderBook, OrderBookEntry } from "./types/output.type";
import {
  BinanceExchangeInfoResponse,
  OrderBookResponse,
  ResponseOrderBookEntry,
} from "./types/response.type";
import { LocalOrderBook, OrderBookSide } from "./types/local.type";
import WebSocket from "isomorphic-ws";

export interface BinanceSDKConfig {
  baseUrl?: string;
  baseWsUrl?: string;
  apiKey?: string;
  apiSecret?: string;
}

export class BinanceSDK {
  private baseUrl: string;
  private baseWsUrl: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  // Store active WebSocket connections by subscription ID
  private _orderBookWsSubs: Record<string, Record<string, WebSocket>> = {};

  constructor(config: BinanceSDKConfig = {}) {
    this.baseUrl = config.baseUrl || "https://api.binance.com";
    this.baseWsUrl = config.baseWsUrl || "wss://stream.binance.com:9443/ws";
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  async fetchMarketSymbols(): Promise<MarketSymbols> {
    try {
      const response = await axios.get<BinanceExchangeInfoResponse>(`${this.baseUrl}/api/v3/exchangeInfo?symbolStatus=TRADING&showPermissionSets=false`);
      const rawSymbols = response.data.symbols;

      const transformed: MarketSymbols = {};
      for (let i = 0; i < rawSymbols.length; i++) {
        const item = rawSymbols[i];
        if (item.status !== "TRADING") continue;
        const base = item.baseAsset;
        const quote = item.quoteAsset;
        const formattedSymbol = `${base}_${quote}`;
        transformed[formattedSymbol] = {
          id: i, // Use index as id (Binance does not provide a unique id)
          symbol: formattedSymbol,
          info: JSON.stringify(item),
        };
      }
      return transformed;
    } catch (error) {
      throw new Error(`Failed to fetch market symbols: ${error}`);
    }
  }

  async fetchOrderBooks(
    syms: string[],
    lmt?: number
  ): Promise<Record<string, OrderBook>> {
    try {
      const results = await Promise.all(
        syms.map(async (sym) => {
          const apiSym = this.transformSymbol(sym);
          const params: { symbol: string; limit?: number } = { symbol: apiSym };
          if (lmt !== undefined) params.limit = lmt;
          const response = await axios.get(
            `${this.baseUrl}/api/v3/depth`,
            { params }
          );
          const { bids, asks } = response.data;
          // Transform bids and asks to OrderBookEntry[]
          const transform = (entries: [string, string][]) =>
            entries.map(([price, amount]) => ({
              price: Number(price),
              amount: Number(amount),
            }));
          return [
            sym,
            { bids: transform(bids), asks: transform(asks) },
          ] as const;
        })
      );
      return Object.fromEntries(results);
    } catch (error) {
      throw new Error(`Failed to fetch order books: ${error}`);
    }
  }

  private transformSymbol(sym: string): string {
    // Convert BTC_USDT to BTCUSDT
    return sym.replace("_", "");
  }

  /**
   * Subscribe to real-time order book updates for given symbols.
   * @param syms Array of market symbols (e.g., ['BTC_THB'])
   * @param callback Callback to receive the latest order book for each symbol
   * @returns Subscription ID
   */
  public async subscribeOrderBooks(
    syms: string[],
    callback: (result: Record<string, OrderBook>) => void
  ): Promise<string> {
    // Step 1: Fetch market symbols to map symbol -> id
    const marketSymbols = await this.fetchMarketSymbols();
    const symbolToId: Record<string, number> = {};
    for (const sym of syms) {
      const info = marketSymbols[sym];
      if (!info) throw new Error(`Symbol not found: ${sym}`);
      symbolToId[sym] = info.id;
    }

    // Step 2: State for each symbol
    const orderBooks: Record<string, LocalOrderBook> = {};
    const wsMap: Record<string, WebSocket> = {};
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Step 3: Private utils
    const arrayToMap = <T>(
      arr: T[][],
      priceIdx: number,
      amountIdx: number
    ): OrderBookSide => {
      const map = new Map<number, number>();
      for (const entry of arr) {
        const price = Number(entry[priceIdx]);
        const amount = Number(entry[amountIdx]);
        if (amount > 0) map.set(price, amount);
      }
      return map;
    };
    const mapToSortedArray = (
      map: OrderBookSide,
      desc: boolean
    ): OrderBookEntry[] => {
      const arr = Array.from(map.entries()).map(([price, amount]) => ({
        price,
        amount,
      }));
      arr.sort((a, b) => (desc ? b.price - a.price : a.price - b.price));
      return arr;
    };

    // Step 4: WebSocket logic per symbol
    for (const sym of syms) {
      const id = symbolToId[sym];
      const wsUrl = `${this.baseWsUrl}/orderbook/${id}`;
      const ws = new WebSocket(wsUrl);
      wsMap[sym] = ws;

      // Attach event listeners (isomorphic-ws supports both .on and addEventListener)
      ws.onopen = () => {
        // Optionally handle open
      };
      ws.onmessage = (event: any) => {
        try {
          // event.data is always a string or Buffer
          const data = typeof event.data === "string" ? event.data : event.data.toString();
          const msg = JSON.parse(data) as {
            data: unknown;
            event: string;
            pairing_id: number;
          };
          if (msg.event === "tradeschanged") {
            const [, /*trades*/ bidsArr, asksArr] = msg.data as unknown[][][];
            orderBooks[sym] = {
              bids: arrayToMap(bidsArr, 1, 2),
              asks: arrayToMap(asksArr, 1, 2),
            };
          } else if (msg.event === "bidschanged") {
            const bidsArr = msg.data as unknown[][];
            if (!orderBooks[sym]) return;
            orderBooks[sym].bids = arrayToMap(bidsArr, 1, 2);
          } else if (msg.event === "askschanged") {
            const asksArr = msg.data as unknown[][];
            if (!orderBooks[sym]) return;
            orderBooks[sym].asks = arrayToMap(asksArr, 1, 2);
          } else {
            return;
          }
          const result: Record<string, OrderBook> = {};
          for (const s of syms) {
            if (!orderBooks[s]) continue;
            result[s] = {
              bids: mapToSortedArray(orderBooks[s].bids, true),
              asks: mapToSortedArray(orderBooks[s].asks, false),
            };
          }
          callback(result);
        } catch (err) {
          // Optionally handle parse errors
        }
      };
      ws.onerror = (event: any) => {
        // Optionally handle errors
      };
      ws.onclose = () => {
        // Optionally handle reconnect or cleanup
      };
    }

    // Store wsMap for this subscription
    this._orderBookWsSubs[subscriptionId] = wsMap;
    // Return subscription ID (for future unsubscribe)
    return subscriptionId;
  }

  /**
   * Unsubscribe from real-time order book updates for a given subscription ID.
   * Closes all WebSocket connections tied to the subscription.
   */
  public unsubscribeOrderBooks(subscriptionId: string): void {
    const wsMap = this._orderBookWsSubs[subscriptionId];
    if (!wsMap) return;
    for (const ws of Object.values(wsMap)) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    delete this._orderBookWsSubs[subscriptionId];
  }
}
