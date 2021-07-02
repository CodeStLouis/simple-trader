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
const key = "057BuyrqfEknuBvM6vxvNB91XUDQrqrg";
const secret = "1bAuC8n9kjfjjS7l4JT3X2B0KNKaAcDC";
const clientId = "fele2065";
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
    'OMG',
    'ADA',
    'NANO',
    'UNI',
    'EGLD',
    'ETC',
    'SOL',
    'WAVES'
]
const intervals = ['5m']

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
    maxConcurrent: 3,
    minTime: 1000
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
global.purchasedSymbols = []
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
    daily_order: false,
    orderType: {}
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
async function getBitstampBalance(assetSymbol){
    let assetToLowercase = assetSymbol.toLowerCase()
    let assetInAvailableFormat = assetToLowercase + '_available'
    const balance = await limiter.schedule(() => bitstamp.balance().then(({body:data}) => data));
    const assetBalance = balance[`${assetInAvailableFormat}`]
    //  console.debug('usd balance =', UsdBalance, asset_balance,' Balance =', assetBalance)
    let assetConvertedAmount = $.of(assetBalance).valueOf();
    // console.log(assetConvertedAmount,'converted')

    let assetGreaterThanZero = gt($(assetConvertedAmount), $(0))
    // let usdGreaterThanTwenty = gt($(buyingPower), $(20))
    // console.debug('I have ', assetInAvailableFormat, assetGreaterThanZero, 'or usd amount', buyingPower)
    if (assetGreaterThanZero){
      //  console.log('asset greater than 0', assetSymbol)
        global.purchasedSymbols.push({asset: assetSymbol, qty: assetConvertedAmount})
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
async function getBuyingPower(){
    const balance = await limiter.schedule(() => bitstamp.balance().then(({body:data}) => data));
    const UsdBalance = balance.usd_balance
    global.buyingPower = UsdBalance
    console.log('getting buying power', UsdBalance, global.buyingPower)
    return UsdBalance
}
async function cancelAllOrders(){
    global.inTrade = false
    await bitstamp.cancelOrdersAll();
}
let smaFiveAboveNine = []
setInterval(function() {
    if (global.purchasedSymbols.length === 0){
        for(let i of crypto){
            getBitstampBalance(i).then(b=>{
                global.tradeData.amount = b.assetQuantity
                console.log(b.assetQuantity, 'new balance for', i)
            })
        }

    }
    getBuyingPower().then(resp =>{
        console.log('first buying power call line 203')
    })
    console.log('NEW INTERVAL!!!!!!!! are we in trade? what is trade data? MASTER BOT AT 5m interval', global.inTrade, global.tradeData)
    if(global.inTrade === true){
        getBuyingPower().then(p =>{
        const orderBook = new streamBitstampService()
        let orderType = global.tradeData.orderType
        let symbol = global.tradeData.symbolInTrade
        getBitstampBalance(symbol).then(q => {
            //TURN ON LIVE ORDER BOOK
            let sellAmount = q.assetQuantity
            orderBook.turnOnOrderBook(symbol, orderType, sellAmount, null).then(trade => {
                console.log('in trade method asset', symbol)

            })
        })
    })
    }
    cancelAllOrders().then(b =>{
        global.inTrade = false
        console.log('canceled orders')
    })
    if(smaFiveAboveNine.length > 10){
        smaFiveAboveNine = []
    }
//todo call buying power on binance
    // reset balances
    console.log('global symbols length', global.purchasedSymbols.length)
    if (global.purchasedSymbols.length > 6){
        global.purchasedSymbols = []
    }
     for(let c of crypto) {
         if(global.inTrade === false){
             getSMATwentyFive(c, '5m').then()
             getCandlesLastTick(c).then(resp =>{
                 //console.log('response from candles', resp)
             }

         )
         }
     }
}, 120000)

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
            getSMANine(c, i).then(smaNineData => {
                console.log(c, '9', smaNineData, 'close', close)
                getSMAFive(c, i).then(smaFIVE =>{
                    if(smaFIVE > smaNineData){
                        smaFiveAboveNine.push({symbol: c, closed: close, interval: i})
                      //  console.log('SMA 5 above Nine Assets', smaFiveAboveNine)
                    }
                })
                if (smaNineData < close ) {
                    console.log(c, 'sma lower than close, ', i, ' if you have buying power and volume is there ', global.buyingPower, 'volume=', volume)
                    if (global.buyingPower > 20) {
                        // start live order book
                        global.inTrade = true
                        const stream = new streamBitstampService()
                        let orderType = global.tradeData.orderType = 'buy'
                        global.inTrade = true
                        global.tradeData.symbolInTrade = c
                        global.tradeData.amount = global.buyingPower / $(close).toNumber()
                        stream.turnOnOrderBook(c, orderType, null, close )
                    } else {
                        const noBuyingPower = 'no buying power'
                        return noBuyingPower
                    }


                }
            })
            getSMAFive(c, i).then(smaFiveData => {
                console.log(c, '5', smaFiveData, 'close =', close, 'at interval', i)
                let smaConverted = $.of(smaFiveData).valueOf()
                let convertedClose = $.of(close).valueOf()
                let sellAsset = (smaFiveData > close)
                if (sellAsset === true) {
                    // do we own it
                    getBitstampBalance(c).then(b =>{
                        if(b !== undefined){
                            console.log(c, 'balance in sma 5 sell asset', b)
                            console.log(c, 'sma 5 greater than close', close, 'at', i, ' sell if you own it')
                            for (let s of global.purchasedSymbols) {
                                if (s.asset === c) {
                                    console.log(c, 'trying to sell', s.asset, s.qty, close)
                                    global.inTrade = true
                                    let orderType = global.tradeData.orderType = 'sell'
                                    global.tradeData.price = close
                                    //TODO turn on stream and sell something
                                    const stream = new streamBitstampService()
                                    global.tradeData.symbolInTrade = s.asset
                                    stream.turnOnOrderBook(s.asset, orderType, s.qty, close)
                                }
                        }
                    } else {
                            return 'dont own it'
                        }
                    })


                }

            })


        }, {limit: 60000, endTime: rawUtcTimeNow}));
    }


}

async function buyBitstamp(amount, price, currency, daily_order){
  //  purchasedArray.push(currency)
    await bitstamp.buyLimitOrder(amount, price, currency, daily_order).then(

    )

}
async function sellBitstamp(amount, price, currency, limit_price, daily_order){
    await bitstamp.sellLimitOrder(amount, price, currency, limit_price, daily_order);
}


exports.binanceSmaAnalytics = functions.https.onRequest(app);
