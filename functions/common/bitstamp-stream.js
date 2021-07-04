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
    async getBitstampBalance(assetSymbol){
        let assetToLowercase = assetSymbol.toLowerCase()
        let assetInAvailableFormat = assetToLowercase + '_available'
        const balance = await limiter.schedule(() => orderBitstamp.balance().then(({body:data}) => data));
        const assetBalance = balance[`${assetInAvailableFormat}`]
        //  console.debug('usd balance =', UsdBalance, asset_balance,' Balance =', assetBalance)
        let assetConvertedAmount = $.of(assetBalance).valueOf();
        // console.log(assetConvertedAmount,'converted')

        let assetGreaterThanZero = gt($(assetConvertedAmount), $(0))
        // let usdGreaterThanTwenty = gt($(buyingPower), $(20))
        // console.debug('I have ', assetInAvailableFormat, assetGreaterThanZero, 'or usd amount', buyingPower)
        if (assetGreaterThanZero){
            //  console.log('asset greater than 0', assetSymbol)
            global.purchasedSymbols.push({asset: assetSymbol, quantity: assetConvertedAmount })
            console.log('global variables assigned', global.purchasedSymbols)
            // const ticker = await bitstamp.ticker(CURRENCY.XLM_USD).then(({status, headers, body}) => console.log('ticker body', body));
            if(assetGreaterThanZero){
                return {asset: assetSymbol,  assetQuantity: assetConvertedAmount}
            }

        } else {
            const dontOwn = `You dont own ${assetSymbol}`
            return dontOwn
        }

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
     global.tradeData.price = priceToNumb
     global.tradeData.amount = global.buyingPower / priceToNumb
     console.log('price converted', priceToNumb);
    bitstampStream.on("connected", () => {
        const btcEurOrderBookChannel = bitstampStream.subscribe(bitstampStream.CHANNEL_ORDER_BOOK, CURRENCY[`${streamingSymbol}`]);
        bitstampStream.on(btcEurOrderBookChannel, ({ data, event }) => {
           // console.log(symbol, data);
            //todo when selling, sell to highest bids first
            let convertedHighestBidQty = $.of(data.bids[0][1]).valueOf()
            if(convertedHighestBidQty >= 1){
                // sell to highest bid
                if (orderType === 'sell' && global.tradeData.symbolInTrade !== 'fredrick' && global.inTrade !== false){
                    // todo add min order!!!!!!!!!!!!!!!!!!!!!
                    let limit_price = $.of(data.bids[0][0]).toNumber()
                    let amountNumb = $(amount).toNumber()
                   // global.tradeData.price = $.of(data.bids[0][0]).valueOf()
                   // let price = $.of(data.bids[0][0]).valueOf()
                    let symbol = tradingSymbol.toLowerCase()
                  console.log('sell limit order in stream no limiter line 130', amountNumb, limit_price, symbol, null, false)
                    return orderBitstamp.sellLimitOrder(amountNumb, limit_price, symbol, null, false).then(resp =>{
                       console.log(resp.body, 'Sold!!!!! line 132',amountNumb, limit_price, symbol, null, false)
                        global.tradeData.symbolInTrade = 'fredrick'
                        global.tradeData.price = 0
                        global.tradeData.amount = 0
                        global.tradeData.daily_order = false
                        global.inTrade = false
                        this.disconnectOrderBook()
                    }).catch(err =>{
                        let symbol = global.tradeData.symbolInTrade
                        let symbolPlusUsd = symbol + 'usd'
                        let newTradeSymbol = symbolPlusUsd.toLowerCase()
                        this.getBitstampBalance(symbol).then(b =>{
                            let numberAmount = $(b).toNumber()
                            if (numberAmount > 0){
                                console.log('err when selling in stream', err,amountNumb, limit_price, newTradeSymbol, null, false)
                                return orderBitstamp.sellLimitOrder(numberAmount, limit_price, newTradeSymbol, null, false ).then(resp =>{
                                    console.log('err trying to sell again after new balance', err,amountNumb, limit_price, newTradeSymbol, null, false)
                                    global.tradeData.symbolInTrade = 'fredrick'
                                    global.tradeData.price = 0
                                    global.tradeData.amount = 0
                                    global.tradeData.daily_order = false
                                    global.inTrade = false
                                    this.disconnectOrderBook()
                                })
                            } else {
                                global.inTrade = false
                                this.disconnectOrderBook()
                                return 'sold no balance to sell'
                            }

                        })

                    })
                } else {
                    return 'trade over'
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
            console.log('intrade in order book?', global.inTrade, 'symbol', global.tradeData.symbolInTrade)
           // global.tradeData.price = $.of(data.asks[0][0]).valueOf()
            let buyAmount = global.buyingPower / price
            let amountNumber = $(buyAmount).toNumber();
            let eightyPercentOfBuyingPower = +$$(
                $(amountNumber),
                subtractPercent(20)
            ).toNumber()
                console.log(global.tradeData.symbolInTrade, '80% of buying power', Number((amountNumber).toFixed(6)) , Number((eightyPercentOfBuyingPower).toFixed(8)))
                let amount = Number((amountNumber).toFixed(6))
                let quantity = Number(( eightyPercentOfBuyingPower).toFixed(6))
               // let quantityNum = quantity.toNumber()
                let tradeSymbolAllLowercase = symbol.toLowerCase() + 'usd'
                console.log('Spot Trade buy line 180', quantity, priceToNumb, tradeSymbolAllLowercase, null, false)
                return orderBitstamp.buyLimitOrder(quantity, priceToNumb, tradeSymbolAllLowercase, null, false).then(resp => {
                    console.log(symbol, 'line 182 BOUGHT from the lowest asker!!!', price)
                    global.inTrade = false
                    global.purchasedSymbols.push({asset: symbol, quantity: quantity, price: price})
                    this.disconnectOrderBook()
                }).catch(err => {
                    this.getBitstampBuyingPower().then(p =>{
                        console.log('getting buying ang global trade data after failed buy limit', p, global.tradeData)
                        let buyingPower = $(p).toNumber()
                        let newQuantity = buyingPower / price
                        let amount = Number((newQuantity).toFixed(6))
                        let symbol = global.tradeData.symbolInTrade
                        let symbolUsd = symbol + 'usd'
                        let newPrice = Number((global.tradeData.price).toFixed(2))
                        let tradeSymbol = symbolUsd.toLowerCase()
                        console.log(err, 'Spot trade new quantity line 198', amount , newPrice, tradeSymbol, null, false)
                        return orderBitstamp.buyLimitOrder(amount , newPrice, tradeSymbol, null, false).then(resp =>{
                            global.tradeData.symbolInTrade = 'fredrick'
                            global.tradeData.price = 0
                            global.tradeData.amount = 0
                            global.tradeData.daily_order = false
                            global.inTrade = false
                            this.disconnectOrderBook()
                        }).catch(err =>{
                            global.tradeData.symbolInTrade = 'fredrick'
                            global.tradeData.price = 0
                            global.tradeData.amount = 0
                            global.tradeData.daily_order = false
                            global.inTrade = false
                            let quantity = $(newQuantity).toNumber()
                            console.log('error when buying in stream after catch err lin 206', err, amount, newPrice, tradeSymbol, null, false)
                            this.disconnectOrderBook()
                        })
                    })
                })
                } else {
                return 'trade done'
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
