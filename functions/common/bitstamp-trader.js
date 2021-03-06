const {BitstampStream, Bitstamp, CURRENCY} = require("node-bitstamp");
const { $, gt } = require('moneysafe');
const { $$, subtractPercent, addPercent } = require('moneysafe/ledger');
const streamBitstampService = require('./bitstamp-buy-stream')
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
class bitstampTrader {
    limit_price;

    constructor() {
    }

    async getBalance(assetSymbol) {
        let assetToLowercase = assetSymbol.toLowerCase()
        let assetInAvailableFormat = assetToLowercase + '_available'
        const balance = await limiter.schedule(() => orderBitstamp.balance().then(({body: data}) => data));
        const assetBalance = balance[`${assetInAvailableFormat}`]
        const UsdBalance = balance.usd_balance
        //  console.debug('usd balance =', UsdBalance, asset_balance,' Balance =', assetBalance)
        let assetConvertedAmount = $.of(assetBalance).valueOf();
        // console.log(assetConvertedAmount,'converted')
        let buyingPower = $.of(UsdBalance).valueOf();
        let assetGreaterThanZero = gt($(assetConvertedAmount), $(0))
        let usdGreaterThanTwenty = gt($(buyingPower), $(20))
        // console.debug('I have ', assetInAvailableFormat, assetGreaterThanZero, 'or usd amount', buyingPower)
        if (assetGreaterThanZero) {
            //  console.log('asset greater than 0', assetSymbol)
            global.balance = assetConvertedAmount
            global.assetQuantities.push({asset: assetSymbol, qty: assetConvertedAmount})
            console.log('owned assets', global.assetQuantities)
            // const ticker = await bitstamp.ticker(CURRENCY.XLM_USD).then(({status, headers, body}) => console.log('ticker body', body));
            return assetConvertedAmount
        } else {
            const dontOwn = `you dont own ${assetSymbol}`

        }
        if (usdGreaterThanTwenty) {
            global.buyingPower = buyingPower
        } else {
            global.buyingPower = 0
        }

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

                global.assetQuantities.push({asset: asset, quantity: quantityFixed, price: price})
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


    async sellBitstamp(amount, price, currency, limit_price, daily_order) {
        console.log('currency passed in sell function', currency)
        if (amount > 0 && global.inTrade === true) {
            let pricedFixed = $(price).toNumber()
            let sellAsset = currency.toLowerCase()
            console.log('selling', amount, pricedFixed, currency, null, false)
            return  await limiter.schedule(() =>  orderBitstamp.sellLimitOrder(amount, pricedFixed, currency, null, false).then(resp => {
                console.log(resp, 'SOLD!!', currency)
                global.inTrade = false
                global.purchasedSymbols = []
                const stream = new streamBitstampService()
                let balanceSymbol = currency.replace('usd', '')
                this.getBitstampBalance(balanceSymbol)
                //stream.disconnectOrderBook()
            }).catch(err => {
                let balanceSymbol = currency.replace('usd', '')
                this.getBitstampBalance(balanceSymbol)
                global.inTrade = false
                console.log('selling error', err, amount, pricedFixed, sellAsset)
            }))

        }

    }
}
module.exports = bitstampTrader
