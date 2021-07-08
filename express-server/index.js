const express = require('express');
const app = express();
const Bottleneck = require("bottleneck");
const Binanceus = require('node-binance-us-api');
const { $, gt, multiply, in$, add } = require('moneysafe');
const { $$, subtractPercent, addPercent } = require('moneysafe/ledger');
const Promise = require('promise');
const binanceFunctions = require('./common/binance-balance-exchange-data')
const res = require("express");
const binanceUS = new Binanceus().options({
    APIKEY: 'EvAfOIdc9XQjAKljZrzCVKoGXVtTxpd5nAjmJVQnKy6jsAUDlgRbvLATdTMJbqxo',
    APISECRET: 'ijDMxrLhpPeD3LrV4Sockgcq9g9tCxaUqIkR3vhpRQ1mxUHdCV93J8VttXvIklCO',
    useServerTime: true,
    recvWindow: 60000, // Set a higher recvWindow to increase response timeout
    verbose: true,
});
const limiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 500
});

let t = new Date
const rawUtcTimeNow = (Math.floor(t.getTime()))
const intervals =['5m']
const assets = [
    'ETH',
    'SOL',
    'LINK',
    'LTC',
    'UNI'
]
global.tradingData ={
    symbol:{},
    price:{},
    closed:{},
    amount:{},
    orderType:{},
    tradeId:{}
}
global.technicalIndicators = {
    symbol:{},
    sma9:{},
    sma5:{},
}
global.myBalances ={
    buyingPower: {},
    assets: []
}
// todo get buying power
const binanceBalances = new binanceFunctions()
getBuyingPower().then(p =>{
    setInterval(function (){
        scanMarket().then(resp =>{
            console.log('in interval', global.tradingData)
        })

    }, 20000)
})
async function getBuyingPower() {
    if (global.tradingData.symbol !== null) {
        await binanceUS.balance((error, balances) => {
            let money = balances['USD'];
            let obj = $.of(money)
            obj.available = money.available
            obj.onOrder = money.onOrder
            obj.total = obj.available + obj.onOrder
            console.log(obj.available)
            global.myBalances.buyingPower = parseFloat(obj.available)
            return obj
        })

    }
}
async function getAssetsOwned(asset, price){
    let balanceSymbol = asset.replace('USD', '')
    await binanceUS.balance((error, balances) =>{
        let currency = balances[`${balanceSymbol}`];
        let obj = $.of(currency)
        obj.available = currency.available
        obj.onOrder = currency.onOrder
        obj.total = add($(obj.available),$(obj.onOrder)).toString()
        let objNumber = $(obj).toNumber()
        //  global.balance[asset] = obj.total;
        let tradeAvailableValue = currency.available * price
       // let convertedTAV = $.of(tradeAvailableValue)
        //console.log(asset, 'worth in balance', tradeAvailableValue)
        if(tradeAvailableValue > 10){
            if(asset !== null){
                global.myBalances.assets.push({symbol: asset, assetAvailable: tradeAvailableValue})
                console.log(global.myBalances)
            }

            if(global.myBalances.assets.length > 5){
                console.log('reseting balances')
                global.myBalances = []
            }
            console.log(asset, 'trade available in USD value as of last close $', tradeAvailableValue)
        }
        /*
            let assetValue = multiply($(assetAmount),$(global.tradingData.price)).toString()
            global.myBalances.assets.push({symbol: asset, value: assetValue})*/

    })
}
for(let a of assets){
    getAssetsOwned(a).then(resp=>{
        console.log('getting balances')
    })
}
//sellAssetOnBinance(asset)
const sma = require('trading-indicator').sma
async function getSMANine(s, i){
  //  console.log(s, 'in sma 9')
        let usableSymbol = s + '/USDT'
        let smaData = await limiter.schedule(() => sma(9, "close", "binance", usableSymbol, i, false))
        let lastSMANinecandle = smaData[smaData.length - 1]
      //  global.technicalIndicators.sma9 = smaData[smaData.length - 1]
       // global.tradingData.sma9 = lastSMANinecandle
        return lastSMANinecandle
}
function sma9Promise(asset, i){
    return new Promise((resolve, reject)=>{
        getSMANine(asset, i).then(data =>{
            //console.log(data)
            if(data){
                resolve(data)
            }else{
                reject('you suck')
            }
        })
    })
}
async function getSMAFive(s, i){
 //   console.log(s, 'in sma 5')
    let usableSymbol = s + '/USDT'
    let smaData = await limiter.schedule(() => sma(9, "close", "binance", usableSymbol, i, false))
    let lastSmaFiveCandle = smaData[smaData.length - 1]
  //  global.technicalIndicators.sma5 = smaData[smaData.length - 1]
    // global.tradingData.sma9 =
    return lastSmaFiveCandle
}
function sma5Promise(asset, i){
    return new Promise((resolve, reject)=>{
        getSMAFive(asset, i).then(data =>{
            if(data){
                resolve(data)
            }else{
                reject('you suck')
            }
        })
    })
}

async function getLastCandleClosed(asset, i){
   await binanceUS.candlesticks(`${asset}`, "5m", (error, ticks, symbol) => {
       // console.info("candlesticks()", ticks);
        let last_tick = ticks[ticks.length - 1];
        let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = last_tick;
       // console.info(symbol+" last close: "+close);
        let closed = close
        res.json(close)
        return ({close: closed})
    }, {limit: 500, endTime: rawUtcTimeNow});
}
async function sellAssetOnBinance(symbol, side, quantity, price){
    return await binanceUS.order({
        symbol: symbol,
        side: side,
        quantity: quantity,
        price: price
    }).then(resp =>{
        console.log('placed order on Binance')
    })
}
function orderPromise(symbol, side, quantity, price){
    return new Promise((resolve, reject) =>{
        sellAssetOnBinance(symbol, side, quantity, price).then(data =>{
            if(data === 200){
                resolve(data)
            }else{
                reject(data)
            }
        })
    })
}
async function scanMarket(){
    for (let a of assets){
        let binanceSymbol = a + 'USD'
        let usableSymbol = a + '/USDT'
        const i = '5m'
        //getAssetsOwned(binanceSymbol).then()
        limiter.schedule(() => binanceUS.prices(binanceSymbol, (error, ticker)=>{
            if ( error ) console.error(error);
            binanceUS.candlesticks(`${binanceSymbol}`, "5m", (error, ticks, symbol) => {
                // console.info("candlesticks()", ticks);
                let last_tick = ticks[ticks.length - 1];
                let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = last_tick;
                sma9Promise(a, i).then(data =>{
                   // console.log(a, data,'sma 9 data inside scan close', close)
                    if(close > data){
                        console.log(a , close, 'greater than sma', data)
                        global.tradingData.symbol = a
                        // console.info(symbol+" last close: "+close);
                        global.tradingData.price = parseFloat(ticker[binanceSymbol]);
                        global.tradingData.closed = +close
                        global.tradingData.orderType = 'buy'
                        let fixedFloatPrice = global.myBalances.buyingPower / global.tradingData.price
                        global.tradingData.amount = Number(fixedFloatPrice).toFixed(8)
                        console.log('Last Trading Data in 9 = ', global.tradingData,'buying power =', global.myBalances.buyingPower)
                    }
                })
                sma5Promise(a,i).then(data =>{
                   // console.log(a, data, ' sma 5 data in scan', close)
                    if(close < data){
                        getAssetsOwned(a, close)
                        console.log(a, 'sell it if own it', global.myBalances.assets.keys())
                        console.log('selling', binanceSymbol, global.myBalances[assets].assetAvailable, global.tradingData.price, null, null)
                        //binanceUS.sell(binanceSymbol, global.myBalances[assets].assetAvailable, global.tradingData.price, undefined, undefined)
                    }
                })

            }, {limit: 100, endTime: rawUtcTimeNow});

        }))
        //todo get technical indicator data


    }
}
scanMarket().then(r =>{
    if(global.technicalIndicators.symbol === global.technicalIndicators.symbol && global.technicalIndicators.sma9 > global.tradingData.closed){
        console.log('Time to trade do we have the data???', global.tradingData, global.myBalances, global.technicalIndicators)

    }
})

console.log('im alive')
app.listen(3005);
