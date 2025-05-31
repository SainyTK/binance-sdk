import { BinanceSDK } from '../../src/index';
import { logIfEnabled } from '../helpers/log';

describe('BinanceSDK Integration', () => {
  let sdk: BinanceSDK;

  beforeAll(() => {
    sdk = new BinanceSDK();
  });

  it('fetchMarketSymbols should return a non-empty object', async () => {
    const result = await sdk.fetchMarketSymbols();
    logIfEnabled(result);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(Object.keys(result).length).toBeGreaterThan(0);
    // Check a known symbol exists (may change over time)
    expect(result).toHaveProperty('BTC_USDT');
  });

  it('fetchOrderBooks should return order book for BTC_USDT', async () => {
    const result = await sdk.fetchOrderBooks(['BTC_USDT']);
    logIfEnabled(result);
    expect(result).toBeDefined();
    expect(result.BTC_USDT).toBeDefined();
    expect(Array.isArray(result.BTC_USDT.bids)).toBe(true);
    expect(Array.isArray(result.BTC_USDT.asks)).toBe(true);
    expect(result.BTC_USDT.bids.length).toBeGreaterThan(0);
    expect(result.BTC_USDT.asks.length).toBeGreaterThan(0);
  });

  it('fetchOrderBooks should return order books for multiple symbols', async () => {
    const result = await sdk.fetchOrderBooks(['BTC_USDT', 'ETH_USDT']);
    logIfEnabled(result);
    expect(result).toBeDefined();
    expect(result.BTC_USDT).toBeDefined();
    expect(result.ETH_USDT).toBeDefined();
    expect(Array.isArray(result.BTC_USDT.bids)).toBe(true);
    expect(Array.isArray(result.ETH_USDT.asks)).toBe(true);
  });

  // Optional: Integration test for subscribeOrderBooks (may be flaky due to network)
  it('subscribeOrderBooks should receive updates for BTC_USDT', async () => {
    // This test will wait for a single update and then unsubscribe
    const updates: any[] = [];
    const callback = (data: any) => {
      updates.push(data);
      logIfEnabled(data);
    };
    const subId = await sdk.subscribeOrderBooks(['BTC_USDT'], callback);
    // Wait for a few seconds to receive at least one update
    await new Promise((resolve) => setTimeout(resolve, 5000));
    // There should be at least one update
    expect(updates.length).toBeGreaterThan(0);
    // Optionally, check the structure of the update
    expect(updates[0]).toHaveProperty('BTC_USDT');
    // Unsubscribe/cleanup if your SDK supports it (not shown here)
  }, 10000); // Increase timeout for websocket
});