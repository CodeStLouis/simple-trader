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
    'UNI',
    'ENJ',
    'DASH'
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
    setInterval(function (){
        scanMarket().then(resp =>{
            console.log('in interval', global.tradingData, 'balances',global.myBalances,'buying power', global.myBalances.buyingPower)
            getFormattedDate()
            console.log('new interval!!!!!!!!',)
        })

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
}
async function getAssetsOwned(asset, price){
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
        let tradeAvailableValue = currency.available * price
       // let convertedTAV = $.of(tradeAvailableValue)
        //console.log(asset, 'worth in balance', tradeAvailableValue)
        if(tradeAvailableValue > 10){
            if(asset !== null || true){
                global.myBalances.assets.push({symbol: asset, quantity: currency.available, tradeValueInUSD: tradeAvailableValue})
                console.log('inside binance balance function',global.myBalances)
            }

            /*if(global.myBalances.assets.length > 5){
                console.log('resetting balances')
                global.myBalances = []
                for(let a of assets){
                    this.getAssetBalance(asset).then(data =>{
                        global.myBalances.push({symbol: a, quantity: data})
                    })
                }

            }*/
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
        const i = '5m'
        //getAssetsOwned(binanceSymbol).then()
        limiter.schedule(() => binanceUS.prices(binanceSymbol, (error, ticker)=>{
            if ( error ) console.error(error);
            binanceUS.candlesticks(`${binanceSymbol}`, "5m", (error, ticks, symbol) => {
                // console.info("candlesticks()", ticks);
                let last_tick = ticks[ticks.length - 1];
                let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = last_tick;
                console.log(binanceSymbol, 'buy base volume?', buyBaseVolume,'buy Asset Volume?', buyAssetVolume)
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
                            let makeItNumbers = fixedFloatPrice.toFixed(8)
                            global.tradingData.amount = +$$(
                                $(makeItNumbers),
                                subtractPercent(20)).toNumber().toFixed(6)
                            let tradeValue = global.tradingData.amount * global.tradingData.price
                            console.log('Last Trading Data in 9 = ', global.tradingData,'buying power =', global.myBalances.buyingPower, 'trade value =',tradeValue)
                            if (tradeValue > 10){
                                console.log('symbol right before buy', JSON.stringify(binanceSymbol))
                                buyOrderPromise(binanceSymbol, global.tradingData.amount, global.tradingData.price)
                            }
                        }
                    }

                })
                sma5Promise(a,i).then(data =>{
                   // console.log(a, data, ' sma 5 data in scan', close)
                    if(close < data){
                        getAssetsOwned(a, close)
                        console.log(a, 'sell it if own it', global.myBalances[assets].symbol)
                        console.log('selling', binanceSymbol, global.myBalances[a].assetAvailable, global.tradingData.price, null, null)
                        /*const orderSymbol = global.
                        orderPromise()*/
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
