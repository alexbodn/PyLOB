//console.log(1123);
var mincom = 2;
var unitcom = 0.01;
var maxperc = 1;

function commission_calc(qty, price=null)
{
	var com = Math.max(mincom, qty * unitcom);
	if (price) {
		com = Math.min(com, maxperc * qty * price / 100);
	}
	return com;
}

var optqty = mincom / unitcom;
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

function significant_delta(capital, price, minprofit) {
	var qty = capital / price;
	var commission = commission_calc(qty, price);
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
