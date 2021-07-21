const {BitstampStream, Bitstamp, CURRENCY} = require("node-bitstamp");
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
class bitstampSellStream{
    constructor() {}
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
          return {asset: assetSymbol,  assetQuantity: assetConvertedAmount}
        } else {
            const dontOwn = 0
            return dontOwn
        }

    }
    async placeSellOrderOnBitstamp(amount, price, symbol){
        const tradeSymbol = symbol.toLowerCase() + 'usd'
        this.turnOnOrderBook(symbol, null).then()
        return orderBitstamp.sellLimitOrder(amount, price, tradeSymbol, null, false).then(resp =>{
            console.log(resp, 'placed sell order ', amount, price, tradeSymbol, null, false)
            global.intrade = false
        }).then(resp =>{
            return this.turnOffOrderBook()
        }).catch(err =>{
            console.log(err, 'in sell stream method line 85', global.tradeData)
        })

    }
    async sellPromise(amount, price, tradeSymbol){
        return new Promise((resolve, reject)=>{
            this.placeSellOrderOnBitstamp(amount, price, tradeSymbol).then(data =>{
                if(data === 200){
                    resolve(data)
                }else{
                    reject(data)
                }
            })
        })
    }
    async turnOnOrderBook(symbol, amount){
        if(amount !== null){
            const streamSymbol = symbol + '_USD'
            const bitstampStream = new BitstampStream()
            bitstampStream.on("connected", () =>{
                const inTradeSellStream = bitstampStream.subscribe(bitstampStream.CHANNEL_ORDER_BOOK, CURRENCY[`${streamSymbol}`]);
                bitstampStream.on(inTradeSellStream, ({ data, event}) =>{
                    console.log(streamSymbol, 'in order book line 58, getting price in selling order book', $.of(data.bids[0][0]).valueOf())
                    let orderWithQuantityOfOne = $.of(data.bids[0][1]).valueOf()
                    if(orderWithQuantityOfOne > 1){
                        global.tradeData.price = $.of(data.bids[0][0]).valueOf()
                        console.log('in sell order book line 62', global.tradeData.amount, global.tradeData.price, global.tradeData.symbolInTrade)
                        this.sellPromise(global.tradeData.amount, global.tradeData.price, global.tradeData.symbolInTrade).then(resp =>{
                            console.log('selling lin 65 in sell stream', global.tradeData)
                            this.turnOffOrderBook()
                        }).catch(err =>{
                            console.log(err, 'selling sell stream line 67')
                        })
                    }
                })
            })
        }


    }

    async turnOffOrderBook(){
        const bitstampStream = new BitstampStream();
        bitstampStream.close()
    }
}
module.exports = bitstampSellStream
