export type OrderBookSide = Map<number, number>; // price -> amount
export interface LocalOrderBook {
  updateId: number;
  bids: OrderBookSide;
  asks: OrderBookSide;
}
