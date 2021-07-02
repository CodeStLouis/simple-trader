const Binanceus = require('node-binance-us-api');
const binanceUS = new Binanceus().options({
    APIKEY: 'EvAfOIdc9XQjAKljZrzCVKoGXVtTxpd5nAjmJVQnKy6jsAUDlgRbvLATdTMJbqxo',
    APISECRET: 'ijDMxrLhpPeD3LrV4Sockgcq9g9tCxaUqIkR3vhpRQ1mxUHdCV93J8VttXvIklCO',
    useServerTime: true,
    recvWindow: 60000, // Set a higher recvWindow to increase response timeout
    verbose: true,
});
global.ticker = {};
global.balance = {};
global.minimums = {};
const { in$, $ } = require('moneysafe');
const crypto = ['BTC', 'LINK', 'SOL', 'ENJ', 'ALGO', 'ONE', 'XLM']
class BinanceBalanceExchangeData {
    constructor() {

    }
    exchangeInfo = () =>{
        binanceUS.exchangeInfo((error, data) => {
            if (error) console.error(error);
            let minimums = {};
            for (let obj of data.symbols) {
                let filters = {status: obj.status};
                for (let filter of obj.filters) {
                    if (filter.filterType === "MIN_NOTIONAL") {
                        filters.minNotional = filter.minNotional;
                    } else if (filter.filterType === "PRICE_FILTER") {
                        filters.minPrice = filter.minPrice;
                        filters.maxPrice = filter.maxPrice;
                        filters.tickSize = filter.tickSize;
                    } else if (filter.filterType === "LOT_SIZE") {
                        filters.stepSize = filter.stepSize;
                        filters.minQty = filter.minQty;
                        filters.maxQty = filter.maxQty;
                    }
                }
//filters.baseAssetPrecision = obj.baseAssetPrecision;
//filters.quoteAssetPrecision = obj.quoteAssetPrecision;
                filters.orderTypes = obj.orderTypes;
                filters.icebergAllowed = obj.icebergAllowed;
                minimums[obj.symbol] = filters;
                global.minimums = minimums;
            }
        })
    }

//console.log(minimums);

//fs.writeFile("json/minimums.json", JSON.stringify(minimums, null, 4), (err)=>{});

// Get ticker prices

    prices = () => {
        binanceUS.prices((error, ticker) => {
            if (error) console.error(error);
            for (let symbol in ticker) {
                global.ticker[symbol] = parseFloat(ticker[symbol]);
            }
            // Get balance on a timer every 5 seconds


        })
    }
// Get exchangeInfo on startup
//minNotional = minimum order value (price * quantity)
async getBuyingPower(){
         await binanceUS.balance((error, balances) =>{
          let money = balances['USD'];
          let obj = $.of(money)
          obj.available = money.available
          obj.onOrder = money.onOrder
          obj.total = obj.available + obj.onOrder
            console.log(obj.available)
            this.global.myBalances.buyingPower = obj.available
            return obj
        })
    }
async getAssetBalance(asset){
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
}

// Get your balances
    balance = () => {
        binanceUS.balance((error, balances) => {
            if (error) console.error(error);
            for (let asset in balances) {
                if(asset){
                    let money = balances[asset];
                    let obj= $.of(money)
                    obj.available = money.available
                    obj.onOrder = money.onOrder
                    obj.total = obj.available + obj.onOrder
                    let objNumber = $(obj).toNumber()
                  //  global.balance[asset] = obj.total;
                    if(asset === 'USD'){
                        global.myBalance.globalBuyingPower = obj.available
                    }else {

                        return obj.available

                    }
                }

            }
            let balance = JSON.stringify(global.balance, null, 0)
           // return obj.available
            //fs.writeFile("json/balance.json", JSON.stringify(global.balance, null, 4), (err)=>{});
        });
    }
}
module.exports = BinanceBalanceExchangeData;
