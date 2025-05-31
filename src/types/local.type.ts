export type OrderBookSide = Map<number, number>; // price -> amount
export interface LocalOrderBook {
  bids: OrderBookSide;
  asks: OrderBookSide;
}
