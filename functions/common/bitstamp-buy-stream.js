const {BitstampStream, Bitstamp, CURRENCY} = require("node-bitstamp");
const bitStampTrader = require('./bitstamp-trader')
require('dotenv').config()
const dotenv = require('dotenv')
const { $, gt, gte, divide } = require('moneysafe');
const { $$, subtractPercent, addPercent } = require('moneysafe/ledger');
const Bottleneck = require("bottleneck");
const key = process.env.key;
const secret = process.env.secret;
const clientId = process.env.clientId
const orderBitstamp = new Bitstamp({
    key,
    secret,
    clientId,
    timeout: 5000,
    rateLimit: true //turned on by default
});


const limiter = new Bottleneck({
    maxConcurrent: 3,
    minTime: 1000
});
class bitstampStreamService{
constructor(){}

turnOnLiveTradeStream = (currency) =>{
    const bitstampStream = new BitstampStream();
    const trader = new bitStampTrader()
    const testCurrency = 'BTC_USD'
    bitstampStream.on("connected", () => {
        const ethEurTickerChannel = bitstampStream.subscribe(bitstampStream.CHANNEL_LIVE_TRADES, CURRENCY[`${testCurrency}`]);
        bitstampStream.on(ethEurTickerChannel, ({ data, event }) => {

        });
    });
    bitstampStream.on("disconnected", () => {});
    bitstampStream.on("error", (e) => console.error(e));
}
turnOffTradeStream = () =>{
    const bitstampStream = new BitstampStream();
    bitstampStream.close();

}

    async getBitstampBuyingPower(){
        const balance = await limiter.schedule(() => orderBitstamp.balance().then(({body:data}) => data));
        const UsdBalance = balance.usd_balance
        global.buyingPower = $(UsdBalance).toNumber
        console.log('getting buying power', global.buyingPower, UsdBalance)
        return UsdBalance
    }
 async turnOnOrderBook(symbol){
     global.tradeData.symbolInTrade = symbol
     global.tradeData.orderType = 'buy'
     let streamingSymbol = global.tradeData.symbolInTrade + '_USD'
     const bitstampStream = new BitstampStream();
     bitstampStream.on("connected", () => {
        const inTradeBuyStream = bitstampStream.subscribe(bitstampStream.CHANNEL_ORDER_BOOK, CURRENCY[`${streamingSymbol}`]);
        bitstampStream.on(inTradeBuyStream, ({ data, event }) => {
            console.log(symbol, 'in buying order book');
            let convertedLowestAskQty = $.of(data.asks[0][1]).valueOf()
            if(convertedLowestAskQty >= 1) {
                let limit_price = $.of(data.asks[0][0]).toNumber()
                this.getBitstampBuyingPower().then(data => {
                    const eightyPercentOfBuyingPower = +$$(
                        $(data),
                        subtractPercent(20)).toNumber().toFixed(6)
                    console.log(data, 'calling buying power in buy stream turned to 80%', eightyPercentOfBuyingPower)
                    global.tradeData.amount = eightyPercentOfBuyingPower / limit_price
                    global.tradeData.price = limit_price
                    if (eightyPercentOfBuyingPower > 20) {
                        console.log('placed buy order in stream lin 73', global.tradeData.amount, global.tradeData.price, global.tradeData.symbolInTrade)
                        return this.placeBuyOrderOnBitstamp(global.tradeData.amount, global.tradeData.price, global.tradeData.symbolInTrade).then(resp => {
                            console.log('placed buy order in stream lin 74')
                        }).then(resp => {
                            this.disconnectOrderBook()
                        }).catch(err => {
                            console.log(err, 'in buying stream')
                        })
                    }
                })
            }
                 else {
                return global.inTrade = false
            }
        });
    });

    bitstampStream.on("disconnected", () => {});
    bitstampStream.on("error", (e) => console.error(e));
}
    async placeBuyOrderOnBitstamp(amount, price, symbol){
        const tradeSymbol = symbol.toLowerCase() + 'usd';
        return orderBitstamp.buyLimitOrder(amount, price, tradeSymbol, null, false).then(resp =>{
            console.log(resp, 'response from buy order', amount, price, tradeSymbol, null, false)
        }).then(resp =>{
            this.disconnectOrderBook()
        }).catch(err =>{
            console.log(err, 'err in buy stream')
        })
    }
    async disconnectOrderBook(){
        const bitstampStream = new BitstampStream();
        await bitstampStream.close()

    }
}

module.exports = bitstampStreamService
