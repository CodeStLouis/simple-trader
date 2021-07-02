const Binanceus = require('node-binance-us-api');
const binance = new Binanceus()
class OrderBook{
    constructor() {
    }
    getOrderBook(symbol){

        binance.websockets.depthCache([`${symbol}`], (symbol, depth) => {
            let bids = binance.sortBids(depth.bids);
            let asks = binance.sortAsks(depth.asks);
            console.info(symbol+" depth cache update");
            let bestBid = +binance.first(bids);
            let bestAsk = +binance.first(asks)
            console.info("last updated: " + new Date(depth.eventTime));
            return ({bid: bestBid, asks: bestAsk})
        });
    }
}

