import { BinanceSDK } from '../../src/index';
import axios from 'axios';
import { MarketSymbols } from '../../src/types/output.type';
import WebSocket from 'isomorphic-ws';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('isomorphic-ws', () => {
  return jest.fn().mockImplementation(() => {
    return {
      onmessage: null,
      onopen: null,
      onerror: null,
      onclose: null,
      close: jest.fn(),
      terminate: jest.fn(),
      readyState: 1, // OPEN
    };
  });
});

describe('BinanceSDK', () => {
  it('should instantiate with default config', () => {
    const sdk = new BinanceSDK();
    expect(sdk).toBeInstanceOf(BinanceSDK);
  });

  describe('fetchMarketSymbols', () => {
    it('should fetch and transform market symbols', async () => {
      const mockApiResponse = {
        timezone: "UTC",
        serverTime: 1565246363776,
        rateLimits: [],
        exchangeFilters: [],
        symbols: [
          {
            symbol: "ETHBTC",
            status: "TRADING",
            baseAsset: "ETH",
            baseAssetPrecision: 8,
            quoteAsset: "BTC",
            quotePrecision: 8,
            quoteAssetPrecision: 8,
            baseCommissionPrecision: 8,
            quoteCommissionPrecision: 8,
            orderTypes: [
              "LIMIT",
              "LIMIT_MAKER",
              "MARKET",
              "STOP_LOSS",
              "STOP_LOSS_LIMIT",
              "TAKE_PROFIT",
              "TAKE_PROFIT_LIMIT"
            ],
            icebergAllowed: true,
            ocoAllowed: true,
            otoAllowed: true,
            quoteOrderQtyMarketAllowed: true,
            allowTrailingStop: false,
            cancelReplaceAllowed: false,
            allowAmend: false,
            isSpotTradingAllowed: true,
            isMarginTradingAllowed: true,
            filters: [],
            permissions: [],
            permissionSets: [["SPOT", "MARGIN"]],
            defaultSelfTradePreventionMode: "NONE",
            allowedSelfTradePreventionModes: ["NONE"]
          },
          {
            symbol: "BTCUSDT",
            status: "TRADING",
            baseAsset: "BTC",
            baseAssetPrecision: 8,
            quoteAsset: "USDT",
            quotePrecision: 8,
            quoteAssetPrecision: 8,
            baseCommissionPrecision: 8,
            quoteCommissionPrecision: 8,
            orderTypes: [
              "LIMIT",
              "LIMIT_MAKER",
              "MARKET",
              "STOP_LOSS",
              "STOP_LOSS_LIMIT",
              "TAKE_PROFIT",
              "TAKE_PROFIT_LIMIT"
            ],
            icebergAllowed: true,
            ocoAllowed: true,
            otoAllowed: true,
            quoteOrderQtyMarketAllowed: true,
            allowTrailingStop: false,
            cancelReplaceAllowed: false,
            allowAmend: false,
            isSpotTradingAllowed: true,
            isMarginTradingAllowed: true,
            filters: [],
            permissions: [],
            permissionSets: [["SPOT", "MARGIN"]],
            defaultSelfTradePreventionMode: "NONE",
            allowedSelfTradePreventionModes: ["NONE"]
          }
        ],
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockApiResponse });

      const sdk = new BinanceSDK();
      const result = await sdk.fetchMarketSymbols();

      const expected: MarketSymbols = {
        ETH_BTC: {
          id: 0,
          symbol: "ETH_BTC",
          info: JSON.stringify(mockApiResponse.symbols[0]),
        },
        BTC_USDT: {
          id: 1,
          symbol: "BTC_USDT",
          info: JSON.stringify(mockApiResponse.symbols[1]),
        },
      };
      expect(result).toEqual(expected);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/exchangeInfo?symbolStatus=TRADING&showPermissionSets=false'
      );
    });

    it('should throw an error if the request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
      const sdk = new BinanceSDK();
      await expect(sdk.fetchMarketSymbols()).rejects.toThrow('Failed to fetch market symbols');
    });
  });

  describe('fetchOrderBooks', () => {
    it('should fetch order book for a single symbol', async () => {
      const mockApiResponse = {
        lastUpdateId: 123456,
        bids: [["10000.00", "0.09975"]],
        asks: [["10001.00", "0.08888"]],
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockApiResponse });
      const sdk = new BinanceSDK();
      const result = await sdk.fetchOrderBooks(["BTC_USDT"]);
      expect(result).toEqual({
        BTC_USDT: {
          bids: [{ price: 10000, amount: 0.09975 }],
          asks: [{ price: 10001, amount: 0.08888 }],
        },
      });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/depth',
        { params: { symbol: 'BTCUSDT' } }
      );
    });

    it('should fetch order books for multiple symbols', async () => {
      const mockApiResponse1 = {
        lastUpdateId: 123457,
        bids: [["20000.00", "0.025"]],
        asks: [["20001.00", "0.024"]],
      };
      const mockApiResponse2 = {
        lastUpdateId: 123458,
        bids: [["30000.00", "0.00833"]],
        asks: [["30001.00", "0.00800"]],
      };
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockApiResponse1 })
        .mockResolvedValueOnce({ data: mockApiResponse2 });
      const sdk = new BinanceSDK();
      const result = await sdk.fetchOrderBooks(["BTC_USDT", "ETH_USDT"]);
      expect(result).toEqual({
        BTC_USDT: {
          bids: [{ price: 20000, amount: 0.025 }],
          asks: [{ price: 20001, amount: 0.024 }],
        },
        ETH_USDT: {
          bids: [{ price: 30000, amount: 0.00833 }],
          asks: [{ price: 30001, amount: 0.008 }],
        },
      });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/depth',
        { params: { symbol: 'BTCUSDT' } }
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/depth',
        { params: { symbol: 'ETHUSDT' } }
      );
    });

    it('should pass the limit parameter if provided', async () => {
      const mockApiResponse = {
        lastUpdateId: 123459,
        bids: [["40000.00", "0.01"]],
        asks: [["40001.00", "0.02"]],
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockApiResponse });
      const sdk = new BinanceSDK();
      await sdk.fetchOrderBooks(["BTC_USDT"], 50);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/depth',
        { params: { symbol: 'BTCUSDT', limit: 50 } }
      );
    });

    it('should throw an error if the request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
      const sdk = new BinanceSDK();
      await expect(sdk.fetchOrderBooks(["BTC_USDT"])).rejects.toThrow('Failed to fetch order books');
    });
  });

  describe('subscribeOrderBooks', () => {
    let sdk: BinanceSDK;
    let mockWsInstances: any[];
    let originalWs: any;

    beforeEach(() => {
      sdk = new BinanceSDK();
      mockWsInstances = [];
      // Patch the mock to collect instances
      ((WebSocket as unknown) as jest.Mock).mockImplementation(() => {
        const ws = {
          on: jest.fn(),
          close: jest.fn(),
          terminate: jest.fn(),
          readyState: 1, // OPEN
        };
        mockWsInstances.push(ws);
        return ws;
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call callback with updated order book after applying depthUpdate events', async () => {
      // 1. Mock the REST API snapshot response
      const snapshot = {
        lastUpdateId: 100,
        bids: [["0.0024", "5"], ["0.0023", "3"]],
        asks: [["0.0026", "8"], ["0.0027", "2"]],
      };
      mockedAxios.get.mockResolvedValueOnce({ data: snapshot });

      // 2. Prepare callback and subscribe
      const callback = jest.fn();
      const promise = sdk.subscribeOrderBooks(["BNB_BTC"], callback);
      const subId = await promise;
      expect(subId).toMatch(/^sub_/);

      // 3. Simulate a depthUpdate event (should be buffered until snapshot is received)
      const ws = mockWsInstances[0];
      // This event's U/u are after the snapshot's lastUpdateId, so it should be applied
      const depthUpdateMsg = JSON.stringify({
        e: "depthUpdate",
        E: 1672515782136,
        s: "BNBBTC",
        U: 101,
        u: 102,
        b: [["0.0024", "10"], ["0.0022", "1"]], // update 0.0024, add 0.0022
        a: [["0.0026", "0"], ["0.0028", "4"]],   // remove 0.0026, add 0.0028
      });
      ws.onmessage({ data: depthUpdateMsg });

      // 4. Check the callback is called with the correct updated order book
      expect(callback).toHaveBeenCalledWith({
        BNB_BTC: {
          bids: [
            { price: 0.0024, amount: 10 }, // updated
            { price: 0.0023, amount: 3 },  // unchanged
            { price: 0.0022, amount: 1 },  // new
          ],
          asks: [
            { price: 0.0027, amount: 2 },  // unchanged
            { price: 0.0028, amount: 4 },  // new
          ],
        },
      });
    });
  });
});