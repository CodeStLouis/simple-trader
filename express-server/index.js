const express = require('express');
const app = express();
require('dotenv').config()
const dotenv = require('dotenv')
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
    maxConcurrent: 3,
    minTime: 1000
});

let t = new Date
const rawUtcTimeNow = (Math.floor(t.getTime()))
const intervals =['1m']
const assets = [
    'ETH',
    'SOL',
    'LINK',
    'DASH',
    'UNI',
    'LTC',
    'REP'
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
function getFormattedDate() {
    var date = new Date();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    month = (month < 10 ? "0" : "") + month;
    day = (day < 10 ? "0" : "") + day;
    hour = (hour < 10 ? "0" : "") + hour;
    min = (min < 10 ? "0" : "") + min;
    sec = (sec < 10 ? "0" : "") + sec;
    var str = date.getFullYear() + "-" + month + "-" + day + "_" +  hour + ":" + min + ":" + sec;
   console.log(str);
    return str;
}
getFormattedDate()
// todo get buying power
const binanceBalances = new binanceFunctions()
getBuyingPower().then(p =>{
    console.log('env var', process.env.SYMBOL)
    setInterval(function (){
        scanMarket().then(resp =>{
            getAllBinanceBalances().then()
            getBuyingPower().then()
           // cancelAllOpenOrders().then()
            console.log('in interval', global.tradingData, 'balances',global.myBalances,'buying power', global.myBalances.buyingPower)
            getFormattedDate()
            resetGlobalvars().then()
            console.log('new interval!!!!!!!! reset globals',)
        })

    }, 20000)
})
async function resetGlobalvars(){
    global.tradingData ={
        symbol:{},
        price:{},
        closed:{},
        amount:{},
        orderType:{},
        tradeId:{}
    }
    global.myBalances ={
        buyingPower: {},
        assets: []
    }
}
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
async function cancelAllOpenOrders(){
   await binanceUS.cancelOrders("XMRBTC", (error, response, symbol) => {
        console.info(symbol+" cancel response:", response);
    });
}
async function getAllBinanceBalances(){
    await binanceUS.balance((error, balances) => {
        if ( error ) return console.error(error);
        console.info("balances()", balances);
        console.info("ETH balance: ", balances.ETH.available);

    });
}
async function getAssetsOwnedAndSell(asset, price){
    console.log('symbol entering getAssetsOwned -- index line 102', asset)
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
            if(asset !== null || true && global.tradingData.orderType === 'sell'){
                global.myBalances.assets.push({symbol: asset, quantity: currency.available, tradeValueInUSD: tradeAvailableValue})
                console.log(asset, 'inside binance sell balance function', currency.available, obj.available)
                global.tradingData.symbol = asset +'USD'
                let amount = +$$(
                    $(currency.available),
                    subtractPercent(10)).toNumber().toFixed(2)
                global.tradingData.amount = parseFloat(currency.available).toFixed(2)
                console.log(global.tradingData.symbol, 'inside binance sell balance function!!!!!!!!!!!!!!!!!!!!!!!!!!$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$',amount,  global.tradingData.amount, 'price=', price)
                sellOrderPromise(global.tradingData.symbol, amount, price)
                return  global.tradingData.amount
            }
            console.log(asset, 'trade available in USD value as of last close $', tradeAvailableValue)
        } else {
            return 'you dont own it'
        }
        /*
            let assetValue = multiply($(assetAmount),$(global.tradingData.price)).toString()
            global.myBalances.assets.push({symbol: asset, value: assetValue})*/

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
async function sellAssetOnBinance(symbol, quantity, price){
    return await binanceUS.sell(symbol, quantity, price).then(resp =>{
        console.log('placed order on Binance', resp)
    }).catch(err =>{
        console.log(err, 'placed sell order')
    })
}
async function buyAssetOnBinance(symbol, quantity, price){
    return await binanceUS.buy(symbol, quantity, price).then(resp =>{
        console.log('placed order on Binance', resp)
    }).catch(err =>{
        console.log(err, ' buying on binance')
    })
}
function sellOrderPromise(symbol, quantity, price){
    return new Promise((resolve, reject) =>{
        sellAssetOnBinance(symbol, quantity, price).then(data =>{
            if(data === 200){
                console.log('returned order data =', data)
                resolve(data)
            }else{
                reject(data)
            }
        })
    })
}
function buyOrderPromise(symbol, quantity, price){
    console.log('inside buy order function =',symbol, quantity, price)
    return new Promise((resolve, reject) =>{
        buyAssetOnBinance( symbol, quantity, price).then(data =>{
            if(data === 200){
                console.log('returned order data =', data)
                resolve(data)
            }else{
                reject(data)
            }
        }).catch(err =>{
            console.log('fucking buying error!!!', err)
        })
    })
}
async function scanMarket(){
    for (let a of assets){
        let binanceSymbol = a + 'USD'
        let usableSymbol = a + '/USDT'
        const i = '1m'
        //getAssetsOwned(binanceSymbol).then()
        limiter.schedule(() => binanceUS.prices(binanceSymbol, (error, ticker)=>{
            if ( error ) console.error(error);
            binanceUS.candlesticks(`${binanceSymbol}`, "5m", (error, ticks, symbol) => {
                // console.info("candlesticks()", ticks);
                let last_tick = ticks[ticks.length - 1];
                let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = last_tick;
                console.log(binanceSymbol, 'buy base volume?', buyBaseVolume,'buy Asset Volume?', buyAssetVolume, 'timestamp =', closeTime, 'vs raw time', rawUtcTimeNow)
                sma9Promise(a, i).then(data =>{
                   // console.log(a, data,'sma 9 data inside scan close', close)
                    const buy = (close > data)
                    console.log('buy?', buy, 'asset', a)
                    if(close > data && global.myBalances.buyingPower < 10) {
                        return 'no buying power'
                    } else {
                        if(buy){
                            console.log(a , close, 'greater than sma 9', data)
                            global.tradingData.symbol = a
                            // console.info(symbol+" last close: "+close);
                            global.tradingData.price = parseFloat(ticker[binanceSymbol]);
                            global.tradingData.closed = +close
                            global.tradingData.orderType = 'buy'
                            let fixedFloatPrice = global.myBalances.buyingPower / global.tradingData.price
                            let makeItNumbers = fixedFloatPrice.toFixed(4)
                            global.tradingData.amount = +$$(
                                $(makeItNumbers),
                                subtractPercent(15)).toNumber().toFixed(2)
                            let tradeValue = global.tradingData.amount * global.tradingData.price
                            console.log('Last Trading Data in 9 = ', global.tradingData,'buying power =', global.myBalances.buyingPower, 'trade value =',tradeValue)
                            if ( global.myBalances.buyingPower > 15){
                                console.log('symbol right before buy', JSON.stringify(binanceSymbol))
                                buyOrderPromise(binanceSymbol, global.tradingData.amount, global.tradingData.price)
                            }
                        }
                    }

                })
                sma5Promise(a,i).then(data =>{
                    const sell = (close < data)
                    console.log(a, data, ' sma 5 data in scan', close, 'sell', sell)
                    if(close < data){
                        global.tradingData.symbol = a
                        global.tradingData.price = parseFloat(ticker[binanceSymbol]);
                        console.log(a, 'sell it if own it')
                        getAssetsOwnedAndSell(global.tradingData.symbol, global.tradingData.price).then(b =>{
                            console.log('selling', global.tradingData.symbol, global.tradingData.price)
                            //sellOrderPromise(binanceSymbol, global.myBalances.assets.quantity)
                        })
                    }
                })

            }, {limit: 100, endTime: rawUtcTimeNow});

        }))
        //todo get technical indicator data


    }
}


console.log('im alive')
app.listen(3005);
