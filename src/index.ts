import axios from "axios";
import { MarketSymbols, OrderBook, OrderBookEntry } from "./types/output.type";
import {
  BinanceExchangeInfoResponse,
  OrderBookResponse,
  ResponseOrderBookEntry,
  DepthUpdateEvent,
  BinanceAPIDepth,
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

  private async fetchOrderBookSnapshot(symbol: string, limit?: number): Promise<BinanceAPIDepth> {
    const apiSym = this.transformSymbol(symbol);
    const params: { symbol: string; limit?: number } = { symbol: apiSym };
    if (limit !== undefined) params.limit = limit;
    const response = await axios.get<BinanceAPIDepth>(`${this.baseUrl}/api/v3/depth`, {
      params,
    });
    return response.data;
  }

  async fetchOrderBooks(
    syms: string[],
    lmt?: number
  ): Promise<Record<string, OrderBook>> {
    try {
      const results = await Promise.all(
        syms.map(async (sym) => {
          const { bids, asks } = await this.fetchOrderBookSnapshot(sym, lmt);
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
   * Subscribe to real-time order book updates for given symbols (Binance official method).
   * @param syms Array of market symbols (e.g., ['BTC_USDT'])
   * @param callback Callback to receive the latest order book for each symbol
   * @returns Subscription ID
   */
  public async subscribeOrderBooks(
    syms: string[],
    callback: (result: Record<string, OrderBook>) => void
  ): Promise<string> {
    // Step 1: State for each symbol
    const orderBooks: Record<string, LocalOrderBook> = {};
    const wsMap: Record<string, WebSocket> = {};
    const eventBuffers: Record<string, DepthUpdateEvent[]> = {};
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const active = { value: true };

    // Step 2: Utility functions
    const arrayToMap = (
      arr: [string, string][],
    ): OrderBookSide => {
      const map = new Map<number, number>();
      for (const [price, amount] of arr) {
        const p = Number(price);
        const a = Number(amount);
        if (a > 0) map.set(p, a);
      }
      return map;
    };
    const mapToSortedArray = (
      map: OrderBookSide,
      desc: boolean
    ): OrderBookEntry[] => {
      const arr = Array.from(map.entries()).map(([price, amount]) => ({ price, amount }));
      arr.sort((a, b) => (desc ? b.price - a.price : a.price - b.price));
      return arr;
    };
    const applyEvent = (
      ob: LocalOrderBook,
      event: DepthUpdateEvent
    ) => {
      // Update bids
      for (const [price, qty] of event.b) {
        const p = Number(price);
        const q = Number(qty);
        if (q === 0) ob.bids.delete(p);
        else ob.bids.set(p, q);
      }
      // Update asks
      for (const [price, qty] of event.a) {
        const p = Number(price);
        const q = Number(qty);
        if (q === 0) ob.asks.delete(p);
        else ob.asks.set(p, q);
      }
      ob.updateId = event.u;
    };

    // Step 3: For each symbol, setup WebSocket and snapshot sync
    await Promise.all(syms.map(async (sym) => {
      const apiSym = this.transformSymbol(sym);
      const wsUrl = `${this.baseWsUrl}/${apiSym.toLowerCase()}@depth@100ms`;
      const ws = new WebSocket(wsUrl);
      wsMap[sym] = ws;
      eventBuffers[sym] = [];
      let snapshotFetched = false;
      let syncing = false;

      // 1. Buffer events until snapshot is fetched
      ws.onmessage = (event: WebSocket.MessageEvent) => {
        if (!active.value) return;
        try {
          const data = typeof event.data === "string" ? event.data : event.data.toString();
          const msg = JSON.parse(data) as DepthUpdateEvent;
          if (msg.e !== "depthUpdate") return;
          eventBuffers[sym].push(msg);
          if (snapshotFetched) {
            // If snapshot already fetched, process events
            processBuffer();
          }
        } catch (err) {
          // Optionally handle parse errors
        }
      };
      ws.onerror = (event: WebSocket.ErrorEvent) => {
        // Optionally handle errors
      };
      ws.onclose = () => {
        // Optionally handle reconnect or cleanup
      };

      // 2. Fetch snapshot
      const fetchSnapshot = async () => {
        syncing = true;
        try {
          const { lastUpdateId, bids, asks } = await this.fetchOrderBookSnapshot(sym, 1000);
          orderBooks[sym] = {
            bids: arrayToMap(bids),
            asks: arrayToMap(asks),
            updateId: lastUpdateId,
          };
          snapshotFetched = true;
          // Fire callback with the latest snapshot for all symbols
          const result: Record<string, OrderBook> = {};
          for (const s of syms) {
            if (!orderBooks[s]) continue;
            result[s] = {
              bids: mapToSortedArray(orderBooks[s].bids, true),
              asks: mapToSortedArray(orderBooks[s].asks, false),
            };
          }
          callback(result);
          processBuffer();
        } catch (err) {
          // Optionally handle errors
        }
        syncing = false;
      };

      // 3. Process buffer and apply events
      const processBuffer = () => {
        if (!orderBooks[sym] || !snapshotFetched) return;
        let ob = orderBooks[sym];
        // Discard events where u <= lastUpdateId
        let buffer = eventBuffers[sym];
        buffer = buffer.filter((ev) => ev.u > ob.updateId);
        // Find the first event where U <= lastUpdateId+1 <= u
        let startIdx = buffer.findIndex(ev => ev.U <= ob.updateId + 1 && ob.updateId + 1 <= ev.u);
        if (startIdx === -1) {
          // Not in sync, need to refetch snapshot
          if (!syncing) fetchSnapshot();
          return;
        }
        // Discard events before startIdx
        buffer = buffer.slice(startIdx);
        // Apply all events
        for (const ev of buffer) {
          if (ev.u < ob.updateId) continue; // Ignore old event
          if (ev.U > ob.updateId + 1) {
            // Out of sync, resync
            if (!syncing) fetchSnapshot();
            return;
          }
          applyEvent(ob, ev);
        }
        eventBuffers[sym] = [];
        // After applying all events
        const result: Record<string, OrderBook> = {};
        for (const s of syms) {
          if (!orderBooks[s]) continue;
          result[s] = {
            bids: mapToSortedArray(orderBooks[s].bids, true),
            asks: mapToSortedArray(orderBooks[s].asks, false),
          };
        }
        callback(result);
      };

      // Start by fetching snapshot
      fetchSnapshot();
    }));

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
