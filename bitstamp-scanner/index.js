const express = require("express");
const app = express();

/*const Binanceus = require('node-binance-us-api');
const Binance = require('node-binance-api');
const amqp = require('amqplib/callback_api');*/
const Bottleneck = require("bottleneck");
const limiter = new Bottleneck({
    maxConcurrent: 3,
    minTime: 1000
});
/*const binanceUS = new Binanceus().options({
    APIKEY: 'EvAfOIdc9XQjAKljZrzCVKoGXVtTxpd5nAjmJVQnKy6jsAUDlgRbvLATdTMJbqxo',
    APISECRET: 'ijDMxrLhpPeD3LrV4Sockgcq9g9tCxaUqIkR3vhpRQ1mxUHdCV93J8VttXvIklCO',
    useServerTime: true,
    recvWindow: 60000, // Set a higher recvWindow to increase response timeout
    verbose: true,
})*/
const intervals =['5m','15m','1h']
const assets = [
    'ETH',
    'LINK',
    'LTC',
    'OMG',
    'ADA',
    'NANO',
    'UNI',
    'ETC'
]

global.smaData = {
    symbol: [],
    isAbove: false
}
global.interval = {}
for(let i of intervals){
    global.interval = i
}
async function placeOrderOnBinance(symbol, side, quantity, price){
    return await binanceUS.order({
        symbol: symbol,
        side: side,
        quantity: quantity,
        price: price
    }).then(resp =>{
        console.log('placed order on Binance')
    })
}
const sma = require('trading-indicator').sma
async function getSMANine(s, i){

    let usableSymbol = s + '/USDT'
    let smaData = await limiter.schedule(() => sma(9, "close", "binance", usableSymbol, i, true))
    let lastSMANinecandle = smaData[smaData.length - 1]
    //  console.log(s, lastSMANinecandle)
    return lastSMANinecandle

}
async function getSMAFive(s, i){
    // console.log(s, 'in sma')
    let usableSymbol = s + '/USDT'
    let smaData = await limiter.schedule(() => sma(5, "close", "binance", usableSymbol, i, false))
    let lastSMAFiveCandle = smaData[smaData.length - 1]
    //console.log(s, lastSMAFiveCandle)
    return lastSMAFiveCandle

}
/*async function getBuyingPower(){
    await binanceUS.balance((error, balances) =>{
        let money = balances['USD'];
        let obj = $.of(money)
        obj.available = money.available
        obj.onOrder = money.onOrder
        obj.total = obj.available + obj.onOrder
        console.log(obj.available)

        return obj.available
    })
}
async function getAssetBalance(asset){
    return binanceUS.balance((error, balances) =>{
        let money = balances[`${asset}`];
        let obj = $.of(money)
        obj.available = money.available
        obj.onOrder = money.onOrder
        obj.total = obj.available + obj.onOrder
        let objNumber = $(obj).toNumber()
        //  global.balance[asset] = obj.total;
        return obj.available

    })
}*/
async function findSymbolsSmaFiveHigherThanNine(i) {

    for (let a of assets) {

        console.log('currently scanning', a, 'at interval', i)
        await getSMANine(a, i).then(smaNineData => {
            getSMAFive(a, i).then(smaFiveData => {
              //  console.log(a, 'sma 9 = ', smaNineData, 'sma 5 =', smaFiveData, 'at interval', i)
                if (smaFiveData > smaNineData) {
                    console.log(a, 'sma 9 = ', smaNineData, 'sma 5 =', smaFiveData, 'at interval', i)
                    global.smaData.symbol.push({symbol: a, interval: i})
                }
            })
        })
    }

    console.log('Crossed on the hour', global.smaData.symbol)

}
    setInterval(function () {
for(let i of intervals){
    findSymbolsSmaFiveHigherThanNine(i).then(resp => {
        console.log('scanning sma')
    })
}
getBuyingPower().then()
        for (let a of assets){
            getAssetBalance(a).then()
        }

        if (global.smaData.symbol.length > 10) {
            global.smaData.symbol = []
        }
    }, 20000)

app.listen(5001);
