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
            global.assetQuantities.push({asset: assetSymbol, quantity: assetConvertedAmount })
            console.log('global variables assigned', global.assetQuantities)
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
        global.buyingPower = $(UsdBalance).toNumber()
        console.log('getting buying power', UsdBalance, global.buyingPower)
        return UsdBalance
    }

  /*  async buyBitstamp(quantity, price, asset, daily_order) {
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
                    console.log('line 93 in trader error,  wrong buying power, re-adjust buying power', global.buyingPower)
                    console.log('buy error params', err, quantityFixed, price, asset, false)

                })
            }))
        }
    }*/
 async turnOnOrderBook(symbol, orderType, amount, price){
    global.inTrade = true
    console.log(
        'symbol=', symbol,
        'order type=',orderType,
        'amount', amount,
        'buying power=',
        global.buyingPower,
        'price=', price,
        'global trade data', global.tradeData
    )
     global.tradeData.symbolInTrade = symbol
     global.tradeData.orderType = orderType
   //  global.tradeData.amount = global.buyingPower / price
    let tradingSymbol = symbol + 'usd'
    let streamingSymbol = symbol + '_USD'
     console.log('streaming symbol', streamingSymbol)
    const bitstampStream = new BitstampStream();
        bitstampStream.on("connected", () => {
        const btcEurOrderBookChannel = bitstampStream.subscribe(bitstampStream.CHANNEL_ORDER_BOOK, CURRENCY.LINK_USD);
        bitstampStream.on(btcEurOrderBookChannel, ({ data, event }) => {
            console.log(streamingSymbol, 'in order book', global.tradeData);
            //todo when selling, sell to highest bids first
            let convertedHighestBidQty = $.of(data.bids[0][1]).valueOf()
            if(convertedHighestBidQty >= 1){
                // sell to highest bid
                let globalStreamSymbol = global.tradeData.symbolInTrade + '_USD'
                console.log('stream symbol and global symbol', globalStreamSymbol, streamingSymbol)
                if (orderType === 'sell' && global.inTrade !== false && streamingSymbol === globalStreamSymbol){
                    // todo add min order!!!!!!!!!!!!!!!!!!!!!
                    let limit_price = $.of(data.bids[0][0]).toNumber()
                    let amountNumb = $(amount).toNumber()
                   // global.tradeData.price = $.of(data.bids[0][0]).valueOf()
                   // let price = $.of(data.bids[0][0]).valueOf()
                  console.log(symbol, 'sell limit order in stream no limiter line 141', amountNumb, limit_price, tradingSymbol, null, false)
                    return orderBitstamp.sellLimitOrder(amountNumb, limit_price, tradingSymbol, null, false).then(resp =>{
                       console.log(resp.body, 'Sold!!!!! line 132',amountNumb, limit_price, symbol, null, false)
                        global.inTrade = false
                        global.tradeData.haseTradedThisInterval = true
                        }).then(d=>{
                        this.disconnectOrderBook().then(sold =>{
                            console.log('disconnected order book after sell placed stream line 146')
                        })
                    }).catch(err =>{
                        let symbol = global.tradeData.symbolInTrade
                        let symbolPlusUsd = symbol + 'usd'
                        let newTradeSymbol = symbolPlusUsd.toLowerCase()
                        this.getBitstampBalance(symbol).then(b =>{
                            let numberAmount = $(b).toNumber()
                            if (numberAmount > 0){
                                console.log('err when selling in stream line 1542', err ,numberAmount, limit_price, newTradeSymbol, null, false)
                                return orderBitstamp.sellLimitOrder(numberAmount, limit_price, newTradeSymbol, null, false ).then(resp =>{
                                    console.log(resp.body, 'err trying to sell again after new balance', err,amountNumb, limit_price, newTradeSymbol, null, false)
                                    global.inTrade = false
                                    global.tradeData.haseTradedThisInterval = true
                                }).then(o =>{
                                    this.disconnectOrderBook().then(o =>{
                                        console.log('disconnected order book line 63')
                                    })
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
            }
            //TODO when buying, get smallest asks first
            if(orderType === 'buy' && global.inTrade === true && streamingSymbol === global.tradeData.symbolInTrade + '_USD'){
            let convertedLowestAskQty = $.of(data.asks[0][1]).valueOf()
                if(convertedLowestAskQty > 1){
                    global.tradeData.price = $.of(data.asks[0][0]).valueOf()
                }
            console.log('in trade in order book? line 183', global.inTrade, 'trade data', global.tradeData)
            let testPrice = $.of(data.asks[0][0]).valueOf()
            console.log('test price from order book line 185', testPrice)
            let buyAmount = global.buyingPower / global.tradeData.price
            let amountNumber = $(buyAmount).toNumber();
            let eightyPercentOfBuyingPower = +$$(
                $(amountNumber),
                subtractPercent(20)).toNumber().toFixed(6)
                console.log(global.tradeData.symbolInTrade, 'Trade amount 80% =', eightyPercentOfBuyingPower)
                let quantity = eightyPercentOfBuyingPower
               // let quantityNum = quantity.toNumber()
                let tradeSymbolAllLowercase = global.tradeData.symbolInTrade.toLowerCase() + 'usd'
                let price = Number(global.tradeData.price).toFixed(2)
                console.log('Spot Trade buy line 197 seems to be correct =>', quantity, testPrice, tradeSymbolAllLowercase, null, false)
                return orderBitstamp.buyLimitOrder(quantity, testPrice, tradeSymbolAllLowercase, null, false).then(resp => {
                    console.log(symbol, 'line 199 placed order at $!!!', testPrice, resp.body)
                    global.inTrade = false
                    }).then(o =>{
                    this.disconnectOrderBook().then(buy =>{
                        global.tradeData.haseTradedThisInterval = true
                        console.log('disconnected order book after buy')
                    })
                }).catch(err => {
                    this.getBitstampBuyingPower().then(p =>{
                        if ($(p).toNumber() > 0) {
                            console.log('getting buying and global trade data after failed buy limit buy', p, global.tradeData)
                            orderBitstamp.cancelOrdersAll()
                            let buyingPower = $(p).toNumber()
                            let newQuantity = buyingPower / global.tradeData.price
                            let amount = Number((newQuantity).toFixed(6))
                            let lesserAmount = +$$(
                                $(amount),
                                subtractPercent(10)).toNumber()
                            let symbol = global.tradeData.symbolInTrade
                            let symbolUsd = symbol + 'usd'
                            let newPrice = Number((global.tradeData.price).toFixed(2))
                            let tradeSymbol = symbolUsd.toLowerCase()
                            console.log(err, 'Spot trade new quantity line 206', lesserAmount, newPrice, tradeSymbol, null, false)
                            return orderBitstamp.buyLimitOrder(lesserAmount, newPrice, tradeSymbol, null, false).then(resp => {
                                console.log('second attempt to buy response line 209', resp.body)
                                global.inTrade = false
                                global.tradeData.haseTradedThisInterval = true
                            }).then(stop =>{
                                this.disconnectOrderBook()
                            }).catch(err => {
                                console.log('third attempt to buy response line 214', err)
                                this.getBitstampBuyingPower().finally(buy => {
                                    let symbol = global.tradeData.symbolInTrade.toLowerCase() + 'usd'
                                    return orderBitstamp.buyLimitOrder(global.tradeData.amount, global.tradeData.price, symbol, null, false).then(resp => {
                                        console.log('last attempt to buy', resp.body)
                                    }).finally(resp => {
                                        let symbol = global.tradeData.symbolInTrade.toLowerCase() + 'usd'
                                        return orderBitstamp.buyLimitOrder(global.tradeData.amount, global.tradeData.price, symbol, null, false).then(resp => {
                                            console.log('last attempt to buy 22', resp.body)
                                        }).then(d =>{
                                            this.disconnectOrderBook()
                                        })
                                    })
                                })
                            })
                        }
                    })
                })

                } else {
                return 'trade done'
            }
        });
    });
    bitstampStream.on("error", (e) => console.error(e));
}
    async disconnectOrderBook(){
        const bitstampStream = new BitstampStream();
        bitstampStream.close()

    }
}

module.exports = bitstampStreamService
