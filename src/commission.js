
let commission_params = {
	commission_min: 0.35,
	commission_per_unit: 0.01,
	commission_max_percnt: 1,
	decimals: 4
};

let instrument_execution = {
	IVE: {
		modification_fee: 0.01, 
		execution_credit: 0.25,
	}
};

function commission_calc(qty, price=null, params)
{
	let rounder = 10 ** params.decimals;
	let com = Math.max(params.commission_min, qty * params.commission_per_unit);
	if (price) {
		com = Math.min(com, params.commission_max_percnt * qty * price / 100);
	}
	return Math.round(com * rounder) / rounder;
}

var optqty = commission_params.commission_min / commission_params.commission_per_unit;
//console.log('optqty:', optqty);

var middelta = 0.5;
var midqty = 0.5;
var minprofit = 10;

/*
+-----high: sell all
|
+-----midhigh: sell midqty
|
+-----mid
|
+-----midlow: buy midqty
|
+-----low: buy all
delta = high - low
delta * middelta = midhigh - midlow
delta = (midhigh - midlow) / middelta
minprofit = (midhigh - midlow) * midqty  * qty - commission
commission = commission_calc(midqty * qty) * 2;
midhigh - midlow = (minprofit + commission) / (midqty  * qty);
delta * middelta = (minprofit + commission) / (midqty  * qty);
delta = (minprofit + commission) / (midqty  * qty) / middelta;
+++++++++
*/

function significant_delta(capital, price, minprofit, commission_params) {
	let qty = Math.floor(capital / price);
	let commission = commission_calc(qty, price, commission_params);
	//delta * middelta * qty * midqty = commission + minprofit
	return (commission + minprofit) / (middelta * qty * midqty);
}

/*
var qty = 100;
var price = 176.0;

var capital = 22000;
var optprice = capital / optqty;
console.log('optprice:', optprice);

var delta = significant_delta(capital, price, minprofit);
console.log('delta:', delta);
*/
