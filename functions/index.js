const functions = require("firebase-functions");

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
const admin = require('firebase-admin');
const express = require("express");
require('dotenv').config()
const dotenv = require('dotenv')
const app = express();
const { $, gt } = require('moneysafe');
const { $$, subtractPercent, addPercent } = require('moneysafe/ledger');
const Bottleneck = require("bottleneck");
const cors = require("cors");
const binanceGlobalInfo = require('./common/binance-balance-exchange-data')
const streamBitstampService = require('./common/bitstamp-stream')
const bitStampTrader = require('./common/bitstamp-trader')
const binanceTrader = require('./common/binanceTrader')
app.use(cors());
app.options('*', cors());
const Binanceus = require('node-binance-us-api');
const binanceUS = new Binanceus().options({
    APIKEY: 'EvAfOIdc9XQjAKljZrzCVKoGXVtTxpd5nAjmJVQnKy6jsAUDlgRbvLATdTMJbqxo',
    APISECRET: 'ijDMxrLhpPeD3LrV4Sockgcq9g9tCxaUqIkR3vhpRQ1mxUHdCV93J8VttXvIklCO',
    useServerTime: true,
    recvWindow: 60000, // Set a higher recvWindow to increase response timeout
    verbose: true,
});

const {BitstampStream, Bitstamp, CURRENCY} = require("node-bitstamp");
const key = process.env.key;
const secret = process.env.secret;
const clientId = process.env.clientId
const bitstamp = new Bitstamp({
    key,
    secret,
    clientId,
    timeout: 5000,
    rateLimit: true //turned on by default
});
/**
 *
 * Asset values for Bitstamp
 * @type {string[]}
 */
const crypto = [
    'ETH',
    'LINK',
    'LTC',

]
const binanceAssets = [
    'ADA',
    'NANO',
    'UNI',
    'EGLD',
    'ETC',
    'SOL',
    'WAVES'
]
const intervals = ['5m']
const fetch = require('node-fetch');
const events = require("events");
const trader = require("./common/bitstamp-trader"); // new
const ema = require('trading-indicator').ema
const ichimokuCloud = require('trading-indicator').ichimokuCloud
const rsi = require('trading-indicator').rsi
const sma = require('trading-indicator').sma
const alerts = require('trading-indicator').alerts
let t = new Date
const rawUtcTimeNow = (Math.floor(t.getTime()))
const bitstampStream = new BitstampStream();

const eventEmitter = new events.EventEmitter();
const limiter = new Bottleneck({
    maxConcurrent: 10,
    minTime: 500
});

async function getSMANine(s, i){
//9 day Moving average
    let usableSymbol = s + '/USDT'
    let smaData = await limiter.schedule(() => sma(9, "close", "binance", usableSymbol, i, true))
    let lastSMANinecandle = smaData[smaData.length - 1]
   //  console.log(s, lastSMANinecandle)
    return lastSMANinecandle

}
async function getSMAFive(s, i){
    // 5 Dya moving average
    // console.log(s, 'in sma')
    let usableSymbol = s + '/USDT'
    let smaData = await limiter.schedule(() => sma(5, "close", "binance", usableSymbol, i, false))
    let lastSMAFiveCandle = smaData[smaData.length - 1]
    //console.log(s, lastSMAFiveCandle)
    return lastSMAFiveCandle

}
async function getSMATwentyFive(s, i){
    // 5 Dya moving average
    console.log(s, 'in sma 25')
    let usableSymbol = s + '/USDT'
    let smaData = await limiter.schedule(() => sma(25, "close", "binance", usableSymbol, i, false))
    let lastSMATwentyFiveCandle = smaData[smaData.length - 1]
    //console.log(s, lastSMAFiveCandle)
    return lastSMATwentyFiveCandle

}
global.symbol = {} // < -- Global variables
global.buyingPower = {}
global.binancBuyingPwer = {}
global.binancAssetBalance = []
global.balance = {}
global.assetQuantities = []
global.volume = {}
global.inTrade = false
for (let i of intervals){
    global.interval = i
}
// global trade data
global.tradeData ={
    symbolInTrade: {},
    amount: {},
    price: {},
    lastClose:{},
    daily_order: false,
    haseTradedThisInterval:{},
    orderType: {},
    isConsolidated : false
}
async function getBuyingPowerOnBinance(){
    await binanceUS.balance((error, balances) =>{
        let money = balances['USD'];
        let obj = $.of(money)
        obj.available = money.available
        obj.onOrder = money.onOrder
        obj.total = obj.available + obj.onOrder
        console.log('buying power on binance', money.available)

        return JSON.stringify(obj.available)
    })
}
async function getAssetBalanceOnBinance(asset){
    return binanceUS.balance((error, balances) =>{
        let money = balances[`${asset}`];
        let obj = $.of(money)
        obj.available = money.available
        obj.onOrder = money.onOrder
        obj.total = obj.available + obj.onOrder
        let objNumber = $(obj).toNumber()
        console.log(asset,' balance on binance in function', money.available)
        return JSON.stringify(obj.available)

    })
}
async function isConsolidated(asset){
    // if sma 5 is less than nine its consolidated = true
    await getSMAFive(asset, '15m').then(sma5 =>{
       getSMANine(asset, '15m').then(sma9 =>{
           if (sma5 < sma9){
               console.log(asset, 'is consolidated not a break out candles', global.tradeData.isConslidated = true)
               global.tradeData.isConslidated = true
               return global.tradeData.isConslidated
           }
       })

    })

}
async function getAllBitstampBalances(){
    const balance = await bitstamp.balance().then(({body:data}) => data);
    console.log('balances', balance)
}
async function getBitstampBalance(assetSymbol){
    let assetToLowercase = assetSymbol.toLowerCase()
    let assetInAvailableFormat = assetToLowercase + '_available'
    const balance = await bitstamp.balance().then(({body:data}) => data);
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
async function getBitstampBuyingPower(){
    const balance = await limiter.schedule(() => bitstamp.balance().then(({body:data}) => data));
    const UsdBalance = balance.usd_balance
    global.buyingPower = $(UsdBalance).toNumber()
    console.log('getting buying power', UsdBalance, global.buyingPower)
    return UsdBalance
}
async function cancelAllOrders(){
    global.inTrade = false
  let ordersCanceled = await bitstamp.cancelOrdersAll();
    console.log('canceled orders', ordersCanceled.body)
    return ordersCanceled.body
}
async function getOpenOrders(){
    let openOrders = await bitstamp.openOrdersAll()
    console.log('open orders', openOrders.body)
    return openOrders.body
}
let balanceArray = []
setInterval(function() {
    // todo make a boolean made entry made exit this interval so wait until next candle close changes if close still equals close wait until next close
    if (global.assetQuantities.length === 0){
        for(let i of crypto){
            getBitstampBalance(i).then(b=>{
                balanceArray.push(b)
                console.log(b.assetQuantity, 'new balance for', i)
            })

        }

    }
    getBitstampBuyingPower().then(resp =>{
        console.log('first buying power call line 233 for bitstamp')
    })
    getOpenOrders().then(open =>{
       // console.log('open orders', open)
    })
    getAllBitstampBalances().then(b =>{
        //console.log('balance call in interval', b)
    })
    console.log('Fredrick you better work this time NEW INTERVAL!!!!!!!! are we in trade? what is trade data? MASTER BOT AT 5m interval', global.inTrade, global.tradeData)
    if(global.inTrade === true){
        if(global.tradeData.orderType === 'buy'){
            getBitstampBuyingPower().then(p =>{
                let symbol = global.tradeData.symbolInTrade
                const orderBook = new streamBitstampService()
                let orderType = global.tradeData.orderType
                let price = global.tradeData.price
                let orderAmount = global.buyingPower / price
                isConsolidated(symbol).then(c =>{
                    console.log('seems to be in consolidating ', i)
                })
                orderBook.turnOnOrderBook(symbol, orderType , orderAmount, 0).then(resp =>{
                    console.log('fredrick restart in trade', symbol, orderType, orderAmount, price)
                })
            })
        }
        if (global.inTrade === true && global.tradeData.orderType === 'sell'){
            let symbol = global.tradeData.symbolInTrade
            getBitstampBalance(symbol).then(b =>{
                console.log(symbol ,'in restart in trade method')
                const orderBook = new streamBitstampService()
                let orderType = global.tradeData.orderType
                 let orderAmount = b.assetQuantity
                let price = 0
                orderBook.turnOnOrderBook(symbol, orderType, orderAmount, price).then(resp =>{
                    console.log('fredrick restart in trade', symbol, orderType, orderAmount, price)
                })
            })
        }
    }
    if(global.inTrade === false){
        const orderBook = new streamBitstampService()
        orderBook.disconnectOrderBook().then(resp =>{
            console.log('turned off order book')
        })
    }
    cancelAllOrders().then(b =>{
        global.inTrade = false
    })

//todo call buying power on binance
    // reset balances
    console.log('global symbols length', global.assetQuantities.length)
    if (global.assetQuantities.length > 20){
        global.purchasedSymbols = []
    }
     for(let c of crypto) {
         if(global.inTrade === false){
           //  getSMATwentyFive(c, '5m').then()
             getCandlesLastTick(c).then(resp =>{
                 //console.log('response from candles', resp)
             }

         )
         }
     }
}, 30000)

async function getCandlesLastTick(c){
    let useAbleSymbol = c + 'USD'
    for (let i of intervals){
        await limiter.schedule(() => binanceUS.candlesticks(useAbleSymbol, i, (error, ticks, symbol) => {
            // console.info("candlesticks()", i);
            let last_tick = ticks[ticks.length - 1];
            let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = last_tick;
            // console.info(symbol+" last close: "+close);
            //  const binanceService = new binanceGlobalInfo()
            //  binanceService.balance()
            getSMATwentyFive(c, i).then(smaTwentyFiveData => {
                console.log(c, '25', smaTwentyFiveData, 'close', close)
                if (smaTwentyFiveData < close ) {
                    console.log(c, 'sma 25 lower than close, ', i, ' if you have buying power and volume is there ', global.buyingPower, 'volume=', volume)
                    if (global.buyingPower < 20) {
                        const noBuyingPower = 'no buying power'
                        return noBuyingPower
                    } else {
                        // start live order book
                        global.inTrade = true
                        const stream = new streamBitstampService()
                        let orderType = global.tradeData.orderType = 'buy'
                        global.tradeData.symbolInTrade = c
                        global.tradeData.lastClose = close
                        let amount = global.tradeData.amount = global.buyingPower / $(close).toNumber()
                        console.log('amount in buy sma greater than close line 328', amount)
                        return stream.turnOnOrderBook(c, orderType, amount, close )

                    }


                }
            })
            getSMANine(c, i).then(smaNineData => {
                console.log(c, '9', smaNineData, 'close', close)
                if (smaNineData < close ) {

                    if (global.buyingPower < 20) {
                        // start live order book
                        const noBuyingPower = 'no buying power'
                        return noBuyingPower
                    } else {
                        console.log(c, 'sma 9 lower than close, ', i, ' if you have buying power',global.buyingPower, ' and volume is there volume=', volume)
                        global.inTrade = true
                        const stream = new streamBitstampService()
                        let orderType = global.tradeData.orderType = 'buy'
                        global.tradeData.symbolInTrade = c
                        let amount = global.tradeData.amount = global.buyingPower / $(close).toNumber()
                         return stream.turnOnOrderBook(c, orderType, amount, close ).then(b =>{
                             console.log('turned on order book in candles to place buy', c, orderType, amount, close)
                         })

                    }


                }
            })
            getSMAFive(c, i).then(smaFiveData => {
                console.log(c, '5', smaFiveData, 'close =', close, 'at interval', i)
                let sellAsset = (smaFiveData > close)
                if (sellAsset === true) {
                    // do we own it
                    getBitstampBalance(c).then(b =>{
                        if(b !== undefined){
                            console.log(c, 'balance in sma 5 sell asset', b)
                            console.log(c, 'sma 5 greater than close', close, 'at', i, ' sell if you own it')
                            if(b.assetQuantity > 0){
                                let orderType = global.tradeData.orderType = 'sell'
                                global.tradeData.symbolInTrade = c
                                const stream = new streamBitstampService()
                                stream.turnOnOrderBook(c, orderType, b.assetQuantity, 0)
                            }
                            } else {
                                    console.log(c, 'dont own it')
                                    return 'dont own it'
                                }
                            })
                }

            })

        }, {limit: 1000, endTime: rawUtcTimeNow}));
    }
}

exports.binanceSmaAnalytics = functions.https.onRequest(app);
