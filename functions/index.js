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
const streamBitstampBuyService = require('./common/bitstamp-buy-stream')
const bitstampSellStream = require('./common/bitstamp-sell-stream')
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
    'WAVES',
    'LINK'
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
async function resetGlobalTradeData(){
    global.tradeData ={
        symbolInTrade: {},
        amount: {},
        price: {},
        lastClose:{},
        daily_order: false,
        haseTradedThisInterval:false,
        orderType: {},
        isConsolidated : false,

    }
}
global.tradeData = {
    symbolInTrade: {},
    amount: {},
    price: {},
    lastClose: {},
    daily_order: false,
    haseTradedThisInterval: false,
    orderType: {},
    inTrade:{},
    isConsolidated: false,
}
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
// global trade data

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
        global.tradeData.amount = global.assetQuantities.quantity
        // const ticker = await bitstamp.ticker(CURRENCY.XLM_USD).then(({status, headers, body}) => console.log('ticker body', body));
            return {asset: assetSymbol,  assetQuantity: assetConvertedAmount}

    } else {
        const dontOwn = 0
        return dontOwn
    }

}
getAllBitstampBalances().then()
async function getBitstampBuyingPower(){
    const balance = await limiter.schedule(() => bitstamp.balance().then(({body:data}) => data));
    const UsdBalance = balance.usd_balance
    global.buyingPower = $(UsdBalance).toNumber()
    console.log('getting buying power', global.buyingPower)
    return UsdBalance
}

getBitstampBuyingPower().then()
async function cancelAllOrders(){
    global.inTrade = false
  let ordersCanceled = await bitstamp.cancelOrdersAll();
    console.log('canceled orders', ordersCanceled.body)
    return ordersCanceled.body
}
cancelAllOrders().then()
async function getOpenOrders(){
    let openOrders = await bitstamp.openOrdersAll()
    console.log('open orders', openOrders.body)
    return openOrders.body
}
async function getSellingPrice(asset){
    const stream = new bitstampSellStream()
    stream.turnOnOrderBook(asset, null).then(stop =>{
        stream.turnOffOrderBook()
    })
}
function getPricing(asset){
    return new Promise((resolve, reject)=>{
        getSellingPrice(asset).then(data =>{
            if(data){
                resolve(data)
            } else {
                reject(data)
            }
        })
    })
}


getOpenOrders().then(data =>{
    console.log('calling open orders')
})
setInterval(function() {
    // todo make a boolean made entry made exit this interval so wait until next candle close changes if close still equals close wait until next close
    if (global.assetQuantities.length === 0){
        for(let i of crypto){
            getBitstampBalance(i).then(b=>{
                console.log(b, 'new balance for', i)
            })

        }

    }
    getBitstampBuyingPower().then()
    console.log('Fredrick you better work this time NEW INTERVAL!!!!!!!! are we in trade? what is trade data? MASTER BOT AT 5m interval', global.inTrade)
    if(global.intrade === true){
        getBitstampBalance(global.tradeData.symbolInTrade).then(data =>{
            console.log('balance in restart and in trade', data)
            const sellStream = new bitstampSellStream()
            sellStream.turnOnOrderBook(global.tradeData.symbolInTrade, data).then(resp =>{
                console.log('order book turned on')
            }).catch(err =>{
                console.log(err, 'error in oder book after restart')
            })
        })

    }

    cancelAllOrders().then(b =>{
        global.inTrade = false
    })
 /*   resetGlobalTradeData().then(data =>{
        console.log('reset trade data', global.tradeData)
    })*/
//todo call buying power on binance
    // reset balances
    console.log('global symbols length', global.assetQuantities.length)
    if (global.assetQuantities.length > 20){
        global.purchasedSymbols = []
    }
     for(let c of crypto) {
         if(global.inTrade === false){
           //  getSMATwentyFive(c, '5m').then()
             const i = '5m'
             getCandlesLastTick(c, i).then(resp =>{
                 console.log(c, 'call candles at', i)
             }).then(fifteen =>{
                 const i = '15m'
                 getCandlesLastTick(c, i).then(resp =>{
                     console.log(c, 'checking fifteen minute time frame', i)
                 })
             })

         }
     }
}, 30000)
async function placeSellOrderOnBitstamp(amount, price, tradeSymbol){
    const sellTradeSymbol = tradeSymbol.toLowerCase() + 'usd'
    if(amount === undefined || null || price === undefined || null && tradeSymbol !== undefined || null){
        console.log(tradeSymbol, 'do not make incorrect calls line 319 index')
        getCandlesLastTick(tradeSymbol, '1m').then()
        return 'trade data incomplete'
    } else {
        console.log(sellTradeSymbol, 'trade dat complete', global.tradeData)
        return bitstamp.sellLimitOrder(amount, price, sellTradeSymbol, null, false).then(resp =>{
            console.log(resp, 'placed sell order ', amount, price, tradeSymbol, null, false)
            global.intrade = false
        }).then(resp =>{
            return this.turnOffOrderBook()
        }).catch(err =>{
            console.log(err, 'in sell method index line 324', amount, price, sellTradeSymbol)
        })
    }


}
async function sellBitstampPromise(amount, price, tradeSymbol){
    return new Promise((resolve, reject)=>{
        placeSellOrderOnBitstamp(amount, price, tradeSymbol).then(resp =>{
            console.log(resp , 'response from sell index line 335')
        }).catch(err =>{
            console.log(err, 'in sell promise index line 333')
        })
    })
}
async function turnOffOrderBook(){
    const bitstampStream = new BitstampStream();
    bitstampStream.close()
}
async function getCandlesLastTick(c, i){
    console.log('symbol coming in candles', c)
    let useAbleSymbol = c + 'USD'
        await binanceUS.candlesticks(useAbleSymbol, i, (error, ticks, symbol) => {
            // console.info("candlesticks()", i);
            let last_tick = ticks[ticks.length - 1];
            let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = last_tick;
            // console.info(symbol+" last close: "+close);
            //  const binanceService = new binanceGlobalInfo()
            //  binanceService.balance()
           /* getSMATwentyFive(c, i).then(smaTwentyFiveData => {
                console.log(c, '25', smaTwentyFiveData, 'close', close, 'at interval ', i)
                if (smaTwentyFiveData < close ) {
                    console.log(c, 'sma 25 lower than close, ', i, ' if you have buying power and volume is there ', global.buyingPower, 'volume=', volume)
                    if (global.buyingPower < 20) {
                        const noBuyingPower = 'no buying power'
                        return noBuyingPower
                    } else {
                        // start live order book
                        global.inTrade = true
                        const streamBuyOrderBook = new streamBitstampBuyService()
                        return streamBuyOrderBook.turnOnOrderBook(c).then(data =>{
                            console.log('sma 25 greater than close turned order book on')
                        }).then(data =>{
                            global.inTrade = false
                            streamBuyOrderBook.disconnectOrderBook()
                        }).catch(err =>{
                            console.log(err,' buying at 25 sma in candles line 331')
                        })

                    }


                }
            })*/
            getSMANine(c, i).then(smaNineData => {
                console.log(c, '9', smaNineData, 'close', close, 'at interval ', i)
                if (smaNineData < close ) {
                    if (global.buyingPower < 20) {
                        // start live order book
                        const noBuyingPower = 'no buying power'
                        return noBuyingPower
                    } else {
                        console.log(c, 'sma 9 lower than close, ', i, ' if you have buying power', global.buyingPower, ' and volume is there volume=', volume)
                        global.inTrade = true
                        const streamBuyOrderBook = new streamBitstampBuyService()
                         return streamBuyOrderBook.turnOnOrderBook(c).then(b =>{
                             console.log('turned on order book in candles sma 9 to place buy', c)
                         }).then(resp =>{
                             global.inTrade = false
                             streamBuyOrderBook.disconnectOrderBook()
                         }).catch(err =>{
                             console.log(err, 'in sma 9 buy error')
                         })

                    }


                }
            })
            getSMAFive(c, i).then(smaFiveData => {
                console.log(c, '5', smaFiveData, 'close =', close, 'at interval', i)
                let sellAsset = (smaFiveData > close)
                if (sellAsset === true) {
                    // do we own it
                    getBitstampBalance(c)
                    console.log(c, 'sma 5 greater than close', close, 'at', i, ' sell if you own it', assetQuantities)
                    for(let a of assetQuantities){
                        if(a.asset === c){
                            global.inTrade = true
                            global.tradeData.orderType = 'sell'
                            console.log(a.asset, 'balance in sma 5 sell asset',a.quantity)
                            global.tradeData.symbolInTrade = a.asset
                            global.tradeData.amount = a.quantity
                            global.tradeData.inTrade = true
                            getSellingPrice(a.asset)
                            sellBitstampPromise(a.quantity, global.tradeData.price, global.tradeData.symbolInTrade)
                            const streamSymbol = symbol + '_USD'
                            const bitstampStream = new BitstampStream()
                            bitstampStream.on("connected", () =>{
                                const inTradeSellStream = bitstampStream.subscribe(bitstampStream.CHANNEL_ORDER_BOOK, CURRENCY[`${streamSymbol}`]);
                                bitstampStream.on(inTradeSellStream, ({ data, event}) =>{
                                    console.log(streamSymbol, 'in order book index line 413 getting price', $.of(data.bids[0][0]).valueOf())
                                    let orderWithQuantityOfOne = $.of(data.bids[0][1]).valueOf()
                                    if(orderWithQuantityOfOne > 1){
                                        global.tradeData.price = $.of(data.bids[0][0]).valueOf()
                                        sellBitstampPromise(global.tradeData.amount, global.tradeData.price, global.tradeData.symbolInTrade).then(resp=>{
                                            console.log(resp, 'called promise to sell')
                                            bitstampStream.close();
                                        }).catch(err =>{
                                            console.log(err, 'in candles selling shit')
                                        })

                                    }
                                })
                            })
                        } else {
                            console.log(c, 'What do we own??? it appears we should be selling it', assetQuantities, global.tradeData)
                            global.tradeData.symbolInTrade = assetQuantities.asset
                            global.tradeData.amount = assetQuantities.quantity
                            getPricing(c)
                            // todo get price and amount !!!!!!!!!!!!!!!!!!!
                            getSellingPrice(c).then(price =>{
                                console.log('getting selling price after sma 5 sell signal index line 428')
                                getBitstampBalance(c).then(data =>{
                                    sellBitstampPromise(assetQuantities.quantity, global.tradeData.price, c)
                                })

                            })
                            return 'What do we own???'
                        }
                    }
                }

            })

        }, {limit: 100, endTime: rawUtcTimeNow});


}

exports.binanceSmaAnalytics = functions.https.onRequest(app);
