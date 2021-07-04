const {BitstampStream, Bitstamp, CURRENCY} = require("node-bitstamp");
const bitStampTrader = require('./bitstamp-trader')
const { $, gt, gte, divide } = require('moneysafe');
const { $$, subtractPercent, addPercent } = require('moneysafe/ledger');
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
 async turnOnOrderBook(symbol, orderType, amount, price){
    global.inTrade = true
    console.log('symbol=', symbol,  'order type= ',orderType, 'buying power=', global.buyingPower, 'price=', price)
     global.tradeData.symbolInTrade = symbol
     global.tradeData.orderType = orderType
   //  global.tradeData.amount = global.buyingPower / price
    let tradingSymbol = symbol + 'usd'
    let streamingSymbol = symbol + '_USD'
    const bitstampStream = new BitstampStream();
    const trader = new bitStampTrader()
    bitstampStream.on("connected", () => {
        const btcEurOrderBookChannel = bitstampStream.subscribe(bitstampStream.CHANNEL_ORDER_BOOK, CURRENCY[`${streamingSymbol}`]);
        bitstampStream.on(btcEurOrderBookChannel, ({ data, event }) => {
           // console.log(symbol, data);
            //todo when selling, sell to highest bids first
            let convertedHighestBidQty = $.of(data.bids[0][1]).valueOf()
            if(convertedHighestBidQty >= 1){
                // sell to highest bid
                if (orderType === 'sell'){
                    // todo add min order!!!!!!!!!!!!!!!!!!!!!
                    let limit_price = $.of(data.bids[0][0]).valueOf()

                   // global.tradeData.price = $.of(data.bids[0][0]).valueOf()
                   // let price = $.of(data.bids[0][0]).valueOf()
                    let symbol = tradingSymbol.toLowerCase()
                  //  console.log('all lowercase no underscores', symbol, 'price', price)
                 //   console.log('selling in order book', amount, price, symbol, false)
                    console.log('selling trade data line 53 bitstream', amount, price, symbol)
                    trader.sellBitstamp(amount, price, symbol, null, false)
                }
                //TODO make sure we are actually getting highest bid

                // console.log('bid is greater')
               // console.log('converted bid highest', convertedHighestBidQty)
              // console.log(data.bids[0],'HIGHEST or last tick BIDS == last tick qty = one highest?',  data.bids[last_tick])
             // console.log('HIGHEST bid', data.bids[last_tick])
            }
            //TODO when buying, get smallest asks first
            if(orderType === 'buy'){
            let lastAsk_tick = data.asks.length -1
            let convertedLowestAskQty = $.of(data.asks[lastAsk_tick][1]).valueOf()
           // console.log('ask qty', convertedLowestAskQty)
            global.tradeData.price = $.of(data.asks[0][0]).valueOf()
            let buyAmount = global.buyingPower / price
            let amountNumber = $(buyAmount).toNumber();
            let eightyPercentOfBuyingPower = +$$(
                $(amountNumber),
                subtractPercent(20)
            )
                console.log('80% of buying power', eightyPercentOfBuyingPower)
                const trader = new bitStampTrader()
                console.log('divided buying power by price', amountNumber)
                global.tradeData.amount = eightyPercentOfBuyingPower.toFixed(6)
                let quantity = eightyPercentOfBuyingPower.toFixed(5)
                let tradSymbolAllLowercase = symbol.toLowerCase() + 'usd'
             //   console.log('buying in order book', quantity, global.tradeData.price, tradSymbolAllLowercase, global.tradeData.daily_order)
                return trader.buyBitstamp(quantity, price, tradSymbolAllLowercase, false )
                }
        });
    });
    bitstampStream.on("disconnected", () => {});
    bitstampStream.on("error", (e) => console.error(e));
}
    async disconnectOrderBook(){
        const bitstampStream = new BitstampStream();
        bitstampStream.on("disconnected", () => {});
        bitstampStream.close()
    }
}

module.exports = bitstampStreamService
