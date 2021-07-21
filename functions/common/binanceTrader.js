const Binanceus = require('node-binance-us-api');
const binanceUS = new Binanceus().options({
    APIKEY: 'EvAfOIdc9XQjAKljZrzCVKoGXVtTxpd5nAjmJVQnKy6jsAUDlgRbvLATdTMJbqxo',
    APISECRET: 'ijDMxrLhpPeD3LrV4Sockgcq9g9tCxaUqIkR3vhpRQ1mxUHdCV93J8VttXvIklCO',
    useServerTime: true,
    recvWindow: 60000, // Set a higher recvWindow to increase response timeout
    verbose: true,
});
global.binanceTradeData ={
    symbolInTrade: {},
    amount: {},
    price: {},
    orderType:{},
}
class BinanceTrader{
    constructor() {
    }

async streamBinanceCandles(){
    await binanceUS.websockets.candlesticks(['BNBBTC'], "1m", (candlesticks) => {
        let { e:eventType, E:eventTime, s:symbol, k:ticks } = candlesticks;
        let { o:open, h:high, l:low, c:close, v:volume, n:trades, i:interval, x:isFinal, q:quoteVolume, V:buyVolume, Q:quoteBuyVolume } = ticks;
        console.info(symbol+" "+interval+" candlestick update");
        console.info("open: "+open);
        console.info("high: "+high);
        console.info("low: "+low);
        console.info("close: "+close);
        console.info("volume: "+volume);
        console.info("isFinal: "+isFinal);
    });
}
async placeBuyOrderOnBinance(){
    await binanceUS.buy("BNBETH", quantity, price, {type:'LIMIT'}, (error, response) => {
        console.info("Limit Buy response", response);
        console.info("order id: " + response.orderId);
    });
}
async placeSellOrderOnBinance(){
    await binanceUS.sell("BNBETH", quantity, price, {type:'LIMIT'}, (error, response) => {
        console.info("Limit Buy response", response);
        console.info("order id: " + response.orderId);
    });
}
}
module.exports = BinanceTrader
