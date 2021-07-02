const express = require('express');
const app = express();
const binanceFunctions = require('../express-server/common/binance-balance-exchange-data')
//TODO the scanner app

const Binanceus = require('node-binance-us-api');
const Binance = require('node-binance-api');

const Bottleneck = require("bottleneck");
const limiter = new Bottleneck({
     maxConcurrent: 3,
     minTime: 1000
});
const binanceUS = new Binanceus().options({
     APIKEY: 'EvAfOIdc9XQjAKljZrzCVKoGXVtTxpd5nAjmJVQnKy6jsAUDlgRbvLATdTMJbqxo',
     APISECRET: 'ijDMxrLhpPeD3LrV4Sockgcq9g9tCxaUqIkR3vhpRQ1mxUHdCV93J8VttXvIklCO',
     useServerTime: true,
     recvWindow: 60000, // Set a higher recvWindow to increase response timeout
     verbose: true,
})
const intervals = ["1m", "5m", "15m"]
const binanceSymbolArray = [ 'HNTUSD','OMGUSD','ETHUSD', 'DOGEUSD', 'MKRUSD', 'SOLUSD', 'BTCUSD', 'XLMUSD','MATICUSD','ADAUSD', 'ZENUSD', 'UNIUSD']
const asset = [
     'LINK',
     'LTC',
     'OMG',
     'ADA',
     'NANO',
     'UNI',
    'EGLD'
]
global.SellingTradeData ={
     symbol: {},
     price: {},
     quantity: {},
     side: 'sell',
     orderFilled: false
}
global.BuyingTradeData ={
     symbol: {},
     price: {},
     quantity: {},
     side: 'buy',
     orderFilled: false
}
global.scanStatistics ={
     currentSymbol: {},
     currentClose: {},
     currentSmaNine: {},
     currentSmaFive: {},
     currentInterval: {},
     currentPrice: {},
     closeAboveNine: false

}
global.myBalance ={
     asset: {},
     globalBuyingPower: {},
     assetBalance: {}
}
global.inTrade = false;
global.tickerInt = ['5m', '15m', '1h']
global.hot = []

const sma = require('trading-indicator').sma
async function getSMANine(s, i){
  //   console.log(s, 'in sma')
     let usableSymbol = s + '/USDT'
     let smaData = await limiter.schedule(() => sma(9, "close", "binance", usableSymbol, i, true))
     let lastSMANinecandle = smaData[smaData.length - 1]
     //  console.log(s, lastSMANinecandle)
     global.scanStatistics.currentSmaNine = lastSMANinecandle
     return lastSMANinecandle

}
async function getSMAFive(s, i){
 //    console.log(s, 'in sma')
     let usableSymbol = s + '/USDT'
     let smaData = await limiter.schedule(() => sma(5, "close", "binance", usableSymbol, i, false))
     let lastSMAFiveCandle = smaData[smaData.length - 1]
     //console.log(s, lastSMAFiveCandle)
     global.scanStatistics.currentSmaFive = lastSMAFiveCandle
     return lastSMAFiveCandle

}
const binance = Binance()
/*async function stream(){
     for(let symbol of asset){
          if(symbol){
               let binanceSymbol = symbol + 'USD'
          binanceUS.websockets.depth([`${binanceSymbol}`], (depth) => {
               let {e: eventType, E: eventTime, s: symbol, u: updateId, b: bidDepth, a: askDepth} = depth;
               const value = 'MATIC/USDT'
             //  console.info(symbol + " market depth update", bidDepth[0][1]);
               const bidQtyGreaterThanZero = bidDepth[0][1] > 0
               const askQtyGreaterThanZero = askDepth[0][1] > 0
             //  console.log('is bid qty larger than 0', bidQtyGreaterThanZero)
               if (bidQtyGreaterThanZero && askQtyGreaterThanZero) {
                    /!*    engulfinPatterHappened(value).then(data =>{
                            console.log('engulfing data', data)
                        })*!/

                   // console.log('asset balances', global.balance, assetBalance)
                    const highestBidPrice = bidDepth[0]
                    const highestBidQty = bidDepth[0][1]
                  //  console.log('bids:', bidDepth, 'asks:', askDepth) //highestBidQty)
                  //  console.log('highest buyer buying price:', highestBidPrice, 'Qty of buyers:', highestBidQty) //highestBidQty)
                    const lowestAskingPrice = askDepth[0]
                    const lowestAskingPriceQty = askDepth[0][1]
                 //   console.log('lowest seller asking price =:', lowestAskingPrice, 'Qty sellers:', lowestAskingPriceQty) // lowestAskingPriceQty)

               }
          })
     }
     }

}*/
async function getPurchaseQuantity(){
     let quantity = global.myBalance.globalBuyingPower / global.BuyingTradeData.price
     console.log('purchase Quantity', quantity)
     return quantity
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
async function streamCandles(asset){
         await binanceUS.websockets.candlesticks(`${asset}`, '5m', candle =>{
               console.log(`${asset}`,'the candles', candle.k.c)
              global.scanStatistics.currentClose = candle.k.c

          })
}
async function smaFiveGreaterThanNineFive(){
     for(let a of asset){
          let i = '5m'
            getSMANine(a, i).then(smaNineData => {
               getSMAFive(a, i).then(smaFiveData => {
                    if (smaFiveData > smaNineData) {
                         console.log(a, 'sma 9 = ', smaNineData, 'sma 5 =', smaFiveData, 'at interval', i)
                         global.hot.push({symbol: a, interval: i})

                    }
               })
          })
     }
}
async function closePriceGreaterThanClose(){
     for(let a of asset){
          let i = '5m'
          if(global.scanStatistics.currentSmaNine > global.scanStatistics.currentClose){
               return a
          }else {
               return 'no its not closed above sma 9'
          }
     }
}

setInterval(function(){
     if(global.hot.length > 20){
          global.hot = []
     }
     //TODO load global symbol stats for one symbol at a time
     if(global.inTrade === false){
          for(let a of asset){
               global.scanStatistics.currentSymbol = a
               getSMANine(global.scanStatistics.currentSymbol).then()
               getSMAFive(global.scanStatistics.currentSymbol).then()
               streamCandles(global.scanStatistics.currentSymbol).then()
          }
     }

     const balance = new binanceFunctions()
     balance.getBuyingPower('USD').then(usd =>{
          global.myBalance.globalBuyingPower = usd
     })
     for(let a of asset){
          balance.getAssetBalance(a).then(b =>{
               console.log(a, 'asset balance =', b)
          })
     }

     console.log('im alive my buying power is', global.myBalance.globalBuyingPower, 'and I own', global.myBalance.assetBalance)
     /*stream().then(resp =>{
      console.log('stream starting')
     })*/
}, 30000)

app.listen(3000);
