# Binance SDK

[![npm version](https://img.shields.io/npm/v/@arbit-x/binance-sdk.svg)](https://www.npmjs.com/package/@arbit-x/binance-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

A modern TypeScript SDK for the Binance Exchange API, providing both REST and WebSocket interfaces for cryptocurrency trading and market data.

A TypeScript SDK for the Binance Exchange API, providing both REST and WebSocket interfaces for cryptocurrency trading and market data.

---

## Release Notes
- 0.1.2 - Change API v3 to v1 for supporting Binance TH connection
- 0.1.1 - Hot fix, order book subscription
- 0.1.0 - First implementation with fetch orderbook and order book subscription functions

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Development](#development)
- [Next Steps](#next-steps)
- [Known Issues](#known-issues)
- [Future Considerations](#future-considerations)
- [Notes](#notes)
- [License](#license)

---

## Overview

**Binance SDK** is a TypeScript SDK that simplifies interaction with the Binance exchange API. It provides easy-to-use methods for both REST and WebSocket endpoints, enabling developers to access market data and trading features with minimal setup.

---

## Features

- Fetch available market symbols
- Basic error handling
- TypeScript type definitions
- Configurable API and WebSocket URLs
- Support for authenticated requests (API key/secret)
- Order book, ticker, trading history, real-time data, trading actions

---

## Installation
```bash
npm install @arbit-x/binance-sdk
```

---

## Usage

```typescript
import { BinanceSDK } from '@arbit-x/binance-sdk';

// Initialize SDK (API key/secret are optional for public endpoints)
const binanceSDK = new BinanceSDK({
  baseUrl: 'https://api.binance.com',
  baseWsUrl: 'wss://stream.binance.com:9443/ws',
  // apiKey: 'your-api-key',
  // apiSecret: 'your-api-secret',
});

// --- REST Example: Fetch market symbols ---
const marketSymbols = await binanceSDK.fetchMarketSymbols();
console.log('Market symbols:', marketSymbols);

// --- REST Example: Fetch order books for symbols ---
const orderBooks = await binanceSDK.fetchOrderBooks(['BTC_USDT', 'ETH_USDT']);
const btcOrderBook = orderBooks['BTC_USDT']
const ethOrderBook = orderBooks['ETH_USDT']
console.log('Order books:', orderBooks);

// --- WebSocket Example: Subscribe to real-time order book updates ---
const subscriptionId = await binanceSDK.subscribeOrderBooks(['BTC_USDT'], (orderBooks) => {
    const { bids, asks } = orderBooks['BTC_USDT']
    console.log('Live order book update:', bids, asks);
});

// ...later, to unsubscribe from updates:
binanceSDK.unsubscribeOrderBooks(subscriptionId);
```

---

## License

MIT

## Author
SainyTK
Creator and maintainer of @arbit-x/binance-sdk
Feel free to reach out for questions, suggestions, or contributions!

