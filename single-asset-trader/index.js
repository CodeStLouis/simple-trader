const express = require('express');
const app = express();
require('dotenv').config()
const dotenv = require('dotenv')
const Bottleneck = require("bottleneck");
const Binanceus = require('node-binance-us-api');
const { $, gt, multiply, in$, add } = require('moneysafe');
const { $$, subtractPercent, addPercent } = require('moneysafe/ledger');
const Promise = require('promise');
const Utils = require("./common/utils");
const binanceUS = new Binanceus().options({
    APIKEY: process.env.APIKEY,
    APISECRET: process.env.APISECRET,
    useServerTime: true,
    recvWindow: 60000, // Set a higher recvWindow to increase response timeout
    verbose: true,
});
const limiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 1000
});
global.tradingData ={
    symbol:{},
    price:{},
    closed:{},
    amount:{},
    balance:{},
    orderType:{},
    tradeId:{}
}
global.myBalances ={
    buyingPower: {},
    balance:{}
}
let t = new Date
const appUtils = new Utils()
appUtils.getFormattedDate()
const rawUtcTimeNow = (Math.floor(t.getTime()))
const intervals =['1m']
const asset = process.env.SYMBOL
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
getBuyingPower().then(p =>{
    console.log('Buying power', global.myBalances.buyingPower)

})
async function cancelAllOpenOrders(){
    let binanceSymbol = asset + 'USD'
    await binanceUS.cancelOrders(`${binanceSymbol}`, (error, response, symbol) => {
        console.info(symbol+" cancel response:", response);
    });
}
async function getAllBinanceBalances(){
    await binanceUS.balance((error, balances) => {
        if ( error ) return console.error(error, 'in balance why?', );
        console.info("balances()", balances);
        console.info(asset ," balance: ", balances.ETH.available);
        let currency = balances[`${asset}`]
        let amount = +$$(
            $(balances.ETH.available),
            subtractPercent(10)).toNumber().toFixed(2)
        console.log(asset, 'amount after subtract 10% and dropped decimal to 2 places', amount, balances.ETH.available)
        return amount
    });
}
getAllBinanceBalances()
const sma = require('trading-indicator').sma
async function getSMANine(s, i){
      console.log(s, 'in sma 9')
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
       console.log(s, 'in sma 5')
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
async function getBalanceAndSellAsset(asset, price){
    let binanceSymbol = asset + 'USD'
    await binanceUS.balance((error, balances) => {
        if ( error ) return console.error(error, 'in balance why?', );
        console.info("balances()", balances);
        console.info(asset ," balance: ", balances.ETH.available);
        let currency = balances[`${asset}`]
        let amount = +$$(
            $(balances.ETH.available),
            subtractPercent(10)).toNumber().toFixed(2)
        let value = price * amount
        if(value > 10){
            sellOrderPromise(binanceSymbol, amount, price)
        }

        console.log(asset, 'amount after subtract 10% and dropped decimal to 2 places because binance are cheaters', amount, 'value of trade', value)
        return amount
    });
}
async function scanMarket(asset) {
    let binanceSymbol = asset + 'USD'
    const i = '1m'
    //getAssetsOwned(binanceSymbol).then()
    limiter.schedule(() => binanceUS.prices(binanceSymbol, (error, ticker) => {
        if (error) console.error(error);
        binanceUS.websockets.candlesticks([`${binanceSymbol}`], "1m", (candlesticks) => {
            let {e: eventType, E: eventTime, s: symbol, k: ticks} = candlesticks;
            let {
                o: open,
                h: high,
                l: low,
                c: close,
                v: volume,
                n: trades,
                i: interval,
                x: isFinal,
                q: quoteVolume,
                V: buyVolume,
                Q: quoteBuyVolume
            } = ticks;
            console.info(symbol + " " + interval + " candlestick update", eventTime, 'vs', rawUtcTimeNow);
        /*    console.info("open: " + open);
            console.info("high: " + high);
            console.info("low: " + low);
            console.info("close: " + close);
            console.info("volume: " + volume);
            console.info("isFinal: " + isFinal);*/
            sma9Promise(asset, i).then(data => {
                let price = parseFloat(ticker[binanceSymbol])
                 console.log(asset, data,'sma 9 data inside scan close', close, 'price',price)
                const buy = (close > data)
                console.log('buy?', asset, '?', buy)
                if (close > data && global.myBalances.buyingPower < 10) {
                    return 'no buying power'
                } else {
                    if (buy) {
                        console.log(asset, close, 'greater than sma 9', data)
                        global.tradingData.symbol = asset
                        // console.info(symbol+" last close: "+close);
                        global.tradingData.price = parseFloat(ticker[binanceSymbol]);
                        global.tradingData.closed = +close
                        global.tradingData.orderType = 'buy'
                        let fixedFloatAmount = global.myBalances.buyingPower / price
                        let makeItNumbers = fixedFloatAmount.toFixed(4)
                        global.tradingData.amount = +$$(
                            $(makeItNumbers),
                            subtractPercent(5)).toNumber().toFixed(6)
                        let tradeValue = global.tradingData.amount * global.tradingData.price
                        console.log('Last Trading Data in 9 = ', global.tradingData, 'buying power =', global.myBalances.buyingPower, 'trade value =', tradeValue)
                        if (global.myBalances.buyingPower > 15) {
                            console.log('symbol right before buy', JSON.stringify(binanceSymbol))
                            buyOrderPromise(binanceSymbol, global.tradingData.amount, global.tradingData.price).then(resp =>{
                                console.log(resp, 'placing buy order on binance')
                            }).catch(err =>{
                                console.log(err, 'placing buy on binance')
                            })
                        }
                    }
                }

            }).catch(err =>{
                console.log(err, 'getting sma 9')
            })
            sma5Promise(asset, i).then(data => {
                const sell = (close < data)
                console.log(asset, data, ' sma 5 data in scan', close, 'sell', sell)
                if (close < data) {
                    let sellPrice = parseFloat(ticker[binanceSymbol]);
                    global.tradingData.orderType = 'sell'
                    console.log(asset, 'sell it if own it')
                   getBalanceAndSellAsset(asset, sellPrice)

                }
            }).catch(err =>{
                console.log(err, 'getting sma 5')
            })
        });

    }))
}
getAllBinanceBalances().then(data=>{
    setInterval(function (){
    scanMarket(process.env.SYMBOL).then(data =>{
        const utils = new Utils()
        cancelAllOpenOrders().then()
        getBuyingPower().then()
        getAllBinanceBalances().then()
        utils.getFormattedDate()
        console.log('in interval', global.tradingData, 'balances',global.myBalances,'buying power', global.myBalances.buyingPower)
    })
}, 20000)
})




console.log('im alive trading asset=', asset)
app.listen(3000);
