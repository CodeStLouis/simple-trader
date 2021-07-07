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
        global.buyingPower = UsdBalance
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
 async turnOnOrderBook(symbol, orderType){
    global.inTrade = true
    let tradingSymbol = symbol + 'usd'
    let streamingSymbol = global.tradeData.symbolInTrade + '_USD'
    const bitstampStream = new BitstampStream();
    const trader = new bitStampTrader()
    bitstampStream.on("connected", () => {
        const btcEurOrderBookChannel = bitstampStream.subscribe(bitstampStream.CHANNEL_ORDER_BOOK, CURRENCY[`${streamingSymbol}`]);
        bitstampStream.on(btcEurOrderBookChannel, ({ data, event }) => {
            console.log(symbol, 'in order book');
            console.log('symbol=', symbol, 'order type=',orderType)
            //  global.tradeData.amount = global.buyingPower
                console.log('in order book line 113 trade data', global.tradeData)
                if (orderType === 'sell' && global.inTrade !== false && symbol === global.tradeData.symbolInTrade) {
                    // todo add min order!!!!!!!!!!!!!!!!!!!!!
                    //todo when selling, sell to highest bids first
                    let convertedHighestBidQty = $.of(data.bids[0][1]).valueOf()
                    console.log(convertedHighestBidQty, 'converted bid quantity');
                    if (convertedHighestBidQty >= 1) {
                        global.tradeData.price = $.of(data.bids[0][0]).toNumber()
                        let limit_price = $.of(data.bids[0][0]).toNumber()
                        // global.tradeData.price = $.of(data.bids[0][0]).valueOf()
                        // let price = $.of(data.bids[0][0]).valueOf()
                        return limit_price
                    }
                }
            //TODO when buying, get smallest asks first
            if(orderType === 'buy' && global.inTrade === true && symbol === global.tradeData.symbolInTrade){
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
                global.tradeData.amount = eightyPercentOfBuyingPower
               // let quantityNum = quantity.toNumber()
                let tradeSymbolAllLowercase = global.tradeData.symbolInTrade.toLowerCase() + 'usd'
                let price = Number(global.tradeData.price).toFixed(2)
                return ({amount: eightyPercentOfBuyingPower, price: testPrice})
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
        bitstampStream.close()

    }
}

module.exports = bitstampStreamService
