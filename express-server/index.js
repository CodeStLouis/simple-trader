const express = require('express');
const app = express();
const Bottleneck = require("bottleneck");
const Binanceus = require('node-binance-us-api');
const { $, gt, multiply, in$, add } = require('moneysafe');
const { $$, subtractPercent, addPercent } = require('moneysafe/ledger');
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
    maxConcurrent: 3,
    minTime: 1000
});

let t = new Date
const rawUtcTimeNow = (Math.floor(t.getTime()))
const intervals =['5m']
const assets = [
    'ETH',
    'LINK',
    'LTC',
    'OMG',
    'ADA',
    'NANO',
    'UNI'
]
global.tradingData ={
    symbol:{},
    price:{},
    closed:{}
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
    console.log('buying power =',p, global.myBalances.buyingPower)
    setInterval(function (){
        scanMarket().then(resp =>{
            console.log('in interval')
            getSMANine(s, '15m')
            getSMAFive(s, '15m')
        })
        let s = global.tradingData.symbol

    }, 60000)
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
}async function getAssetsOwned(asset){
    let balanceSymbol = asset.replace('USD', '')
    await binanceUS.balance((error, balances) =>{
        let currency = balances[`${balanceSymbol}`];
        let obj = $.of(currency)
        obj.available = currency.available
        obj.onOrder = currency.onOrder
        obj.total = add($(obj.available),$(obj.onOrder)).toString()
        let objNumber = $(obj).toNumber()
        //  global.balance[asset] = obj.total;
        let tradeAvailableValue = currency.available * global.tradingData.price
       // let convertedTAV = $.of(tradeAvailableValue)
        if(tradeAvailableValue > 10){
            global.myBalances.assets.push({symbol: asset, assetAvailable: tradeAvailableValue})
            console.log(asset, 'trade available in USD value $', tradeAvailableValue, 'trading price', global.tradingData.price)
        }
        /*
            let assetValue = multiply($(assetAmount),$(global.tradingData.price)).toString()
            global.myBalances.assets.push({symbol: asset, value: assetValue})*/

    })
}
getAssetsOwned(global.tradingData.symbol).then(resp=>{
    console.log('getting balances')
})
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
let asset = global.tradingData.symbol
let side = 'sell'
let price = global.tradingData.price
let quantity = global.myBalances.assets[1] /global.tradingData.price
//sellAssetOnBinance(asset)
const sma = require('trading-indicator').sma
async function getSMANine(s, i){
        let usableSymbol = s.replace('USD', '/USDT')
        let smaData = await limiter.schedule(() => sma(9, "close", "binance", usableSymbol, i, true))
        let lastSMANinecandle = smaData[smaData.length - 1]
        global.technicalIndicators.sma9 = smaData[smaData.length - 1]
        global.tradingData.sma9 = lastSMANinecandle
        return lastSMANinecandle
}
async function getSMAFive(s, i){
    let usableSymbol = s.replace('USD', '/USDT')
    let smaData = await limiter.schedule(() => sma(5, "close", "binance", usableSymbol, i, false))
    let lastSMAFiveCandle = smaData[smaData.length - 1]
    global.technicalIndicators.sma5 = smaData[smaData.length - 1]
    console.log(s, 'in sma')
    //console.log(s, lastSMAFiveCandle)
    return lastSMAFiveCandle
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
async function scanMarket(){
    for (let a of assets){
        let binanceSymbol = a + 'USD'
        let usableSymbol = a + '/USDT'
        //getAssetsOwned(binanceSymbol).then()
        limiter.schedule(() => binanceUS.prices(binanceSymbol, (error, ticker)=>{
            if ( error ) console.error(error);
            binanceUS.websockets.candlesticks(`${binanceSymbol}`, "5m", function (error, ticks, symbol) {
                // console.info("candlesticks()", ticks);
                let last_tick = ticks[ticks.length - 1];
                let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = last_tick;
                global.tradingData.symbol = symbol
               // console.info(symbol+" last close: "+close);
                global.tradingData.price = parseFloat(ticker[binanceSymbol]);
                global.tradingData.closed = +close
                /* let smaNine =
                 global.tradingData.sma9 = smaNine[smaNine.length - 1]
                 let smaFive = sma(5, "close", "binance", usableSymbol, '15m', true)
                 global.tradingData.sma5 = smaFive[smaFive.length - 1]*/

                    console.log('Last Trading Data = ', global.tradingData,'balances=', global.myBalances,'technical indicators=', global.technicalIndicators)

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
