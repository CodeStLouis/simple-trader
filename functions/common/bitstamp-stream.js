const {BitstampStream, Bitstamp, CURRENCY} = require("node-bitstamp");
const bitStampTrader = require('./bitstamp-trader')
const { $, gt, gte, divide } = require('moneysafe');
const { $$, subtractPercent, addPercent } = require('moneysafe/ledger');
const Bottleneck = require("bottleneck");
const key = "08n2v39ePpdjEEXNVqlbr0RZf6TYIjDU";
const secret = "UNskrLDTqV34RxzzJG5nlolK982f7nuV";
const clientId = "fele2065";
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
        global.buyingPower = UsdBalance
        console.log('getting buying power', UsdBalance, global.buyingPower)
        return UsdBalance
    }

    async buyBitstamp(quantity, price, asset, daily_order) {
        if (quantity > 0 && global.inTrade === true) {
            // let addUSD = tradSymbolAllLowercase + 'usd';
            let quantityFixed = $(quantity).toNumber()
            global.tradeData.amount = quantityFixed
            console.log('buying', quantityFixed, price, asset, null, false)
            return await limiter.schedule(() => orderBitstamp.buyLimitOrder(quantityFixed, global.tradeData.price, asset, null, false).then(resp => {
                console.log(asset, 'BOUGHT from the lowest asker!!!', resp)
                global.inTrade = false
                const stream = new streamBitstampService()

                global.purchasedSymbols.push({asset: asset, quantity: quantityFixed, price: price})
                //  return stream.disconnectOrderBook()
            }).catch(err => {
                this.getBitstampBuyingPower().then(p =>{
                    global.buyingPower = p
                    console.log('line 111 in trader error,  wrong buying power, re-adjust buying power', global.buyingPower)
                    console.log('buy error params', err, quantityFixed, price, asset, false)

                })
            }))
        }
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
     let priceToNumb = $(price).toNumber()
     console.log('price converted', priceToNumb);
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
                   return trader.sellBitstamp(amount, price, symbol, null, false).then(resp =>{
                        this.disconnectOrderBook()
                    })
                }
                //TODO make sure we are actually getting highest bid

                // console.log('bid is greater')
               // console.log('converted bid highest', convertedHighestBidQty)
              // console.log(data.bids[0],'HIGHEST or last tick BIDS == last tick qty = one highest?',  data.bids[last_tick])
             // console.log('HIGHEST bid', data.bids[last_tick])
            }
            //TODO when buying, get smallest asks first
            if(orderType === 'buy' && global.inTrade === true){
            let lastAsk_tick = data.asks.length -1
            let convertedLowestAskQty = $.of(data.asks[lastAsk_tick][1]).valueOf()
            console.log('intrade in order book?', global.inTrade)
           // global.tradeData.price = $.of(data.asks[0][0]).valueOf()
            let buyAmount = global.buyingPower / price
            let amountNumber = $(buyAmount).toNumber();
            let eightyPercentOfBuyingPower = +$$(
                $(amountNumber),
                subtractPercent(20)
            )
                console.log('80% of buying power', eightyPercentOfBuyingPower.toFixed(8))
                const trader = new bitStampTrader()
                console.log('divided buying power by price', amountNumber.toFixed(6))
             //   let amount = eightyPercentOfBuyingPower.toFixed(6)
                let quantity = eightyPercentOfBuyingPower.toFixed(6)
               // let quantityNum = quantity.toNumber()
                let tradeSymbolAllLowercase = symbol.toLowerCase() + 'usd'
             //   console.log('buying in order book', quantity, global.tradeData.price, tradSymbolAllLowercase, global.tradeData.daily_order)
                return limiter.schedule(() => orderBitstamp.buyLimitOrder($(eightyPercentOfBuyingPower).toNumber().toFixed(8), priceToNumb, tradeSymbolAllLowercase, null, false).then(resp => {
                    console.log(symbol, 'BOUGHT from the lowest asker!!!', price)
                    global.inTrade = false
                    global.purchasedSymbols.push({asset: symbol, quantity: quantity, price: price})
                    this.disconnectOrderBook()
                }).catch(err => {
                    this.getBitstampBuyingPower().then(p =>{
                        global.buyingPower = p
                        console.log('streaming spot trade', global.buyingPower)
                        console.log('buy error params', err, $(eightyPercentOfBuyingPower).toNumber().toFixed(8), priceToNumb, tradeSymbolAllLowercase, null, false)
                        this.disconnectOrderBook()

                    })
                }))
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
