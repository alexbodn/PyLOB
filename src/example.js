
'use strict';

let commission_params = {
	commission_min: 2.5,
	commission_per_unit: 0.01,
	commission_max_percnt: 1,
	decimals: 4
};

let instrument_info = {
	FAKE: {
		modification_fee: 0.01, 
		execution_credit: 0.25,
	},
	FAKE2: {
		modification_fee: 0.01, 
		execution_credit: 0.25,
	},
};

function test_perform(lob) {
	// Initialize
	let currency = 'USD';
	for (let tid=100; tid<112; ++tid) {
		lob.createTrader(
			tid.toString(), tid, 
			currency, commission_params);
	}
	for (let [instrument, info] of Object.entries(instrument_info)) {
		lob.createInstrument(instrument, currency, info);
		test_lob(lob, instrument, currency);
	}
	lob.printBalance();
	lob.modificationsCharge();
	lob.printBalance();
}

function test_lob(lob, instrument, currency) {
	let test_label = 'test ' + instrument;
	console.time(test_label);
	let expected, nerrors = 0;
	let forWhom=null, priceAsk=98, priceBid=101;
	let firstIdNum = lob.nextQuoteID;
	let firstTime = lob.getTime();
	//########### Limit Orders #############
	
	//# Create some limit orders
	warn("Create some limit orders");
	let someOrders = [
		{order_type: 'limit', side: 'ask', instrument, qty: 5, price: 101.0, tid: 100},
		{order_type: 'limit', side: 'ask', instrument, qty: 5, price: 103.0, tid: 101},
		{order_type: 'limit', side: 'ask', instrument, qty: 5, price: 101.0, tid: 102},
		{order_type: 'limit', side: 'ask', instrument, qty: 5, price: 101.0, tid: 103},
		{order_type: 'limit', side: 'bid', instrument, qty: 5, price: 99.0, tid: 100},
		{order_type: 'limit', side: 'bid', instrument, qty: 5, price: 98.0, tid: 101},
		{order_type: 'limit', side: 'bid', instrument, qty: 5, price: 99.0, tid: 102},
		{order_type: 'limit', side: 'bid', instrument, qty: 5, price: 97.0, tid: 103},
	];
	//# Add orders to LOB
	//someOrders = someOrders.slice(0, 4);
	for (let order of someOrders) {
		//let [trades, idNum] = 
		lob.processOrder(order, false, false);
		//lob.print(trades, idNum);
	}
	//# The current book may be viewed using a print
	lob.print(instrument);
	
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": firstIdNum + 5, "trader": 100, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 5
		}, {
			"idNum": firstIdNum + 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 7
		}, {
			"idNum": firstIdNum + 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": firstTime + 6
		}, {
			"idNum": firstIdNum + 8, "trader": 103, "qty": 5, "fulfilled": 0, "price": 97, "event_dt": firstTime + 8
		}], 
		"asks": [{
			"idNum": firstIdNum + 1, "trader": 100, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": firstTime + 1
		}, {
			"idNum": firstIdNum + 3, "trader": 102, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": firstTime + 3
		}, {
			"idNum": firstIdNum + 4, "trader": 103, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": firstTime + 4
		}, {
			"idNum": firstIdNum + 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": firstTime + 2
		}], 
		"volumeBid": 15, "volumeAsk": 15, "bestBid": 99, "worstBid": 97, "bestAsk": 101, "worstAsk": 103, 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}

	//# Submitting a limit order that crosses the opposing best price will 
	//# result in a trade.
	warn("Trade occurs as incoming bid limit crosses best ask..");
	let crossingLimitOrder = {order_type: 'limit', 
							side: 'bid', 
							instrument,
							qty: 2, 
							price: 102.0,
							tid: 109};

	//let [trades, orderInBook] = 
	lob.processOrder(crossingLimitOrder, false, false);
	lob.print(instrument);
	
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": firstIdNum + 5, "trader": 100, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 5
		}, {
			"idNum": firstIdNum + 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 7
		}, {
			"idNum": firstIdNum + 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": firstTime + 6
		}, {
			"idNum": firstIdNum + 8, "trader": 103, "qty": 5, "fulfilled": 0, "price": 97, "event_dt": firstTime + 8
		}], 
		"asks": [{
			"idNum": firstIdNum + 1, "trader": 100, "qty": 5, "fulfilled": 2, "price": 101, "event_dt": firstTime + 1
		}, {
			"idNum": firstIdNum + 3, "trader": 102, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": firstTime + 3
		}, {
			"idNum": firstIdNum + 4, "trader": 103, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": firstTime + 4
		}, {
			"idNum": firstIdNum + 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": firstTime + 2
		}], 
		"volumeBid": 15, "volumeAsk": 13, "bestBid": 99, "worstBid": 97, "bestAsk": 101, "worstAsk": 103, 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}
	
	//# If a limit order crosses but is only partially matched, the remaining 
	//# volume will be placed in the book as an outstanding order
	warn("Large incoming bid limit crosses best ask. Remaining volume is placed in the book..");
	let bigCrossingLimitOrder = {order_type: 'limit', 
							 side: 'bid', 
							 instrument,
							 qty: 50, 
							 price: 102.0,
							 tid: 110};
	//let [trades, orderInBook] = 
	lob.processOrder(bigCrossingLimitOrder, false, false);
	lob.print(instrument);
	
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": firstIdNum + 10, "trader": 110, "qty": 50, "fulfilled": 13, "price": 102, "event_dt": firstTime + 10
		}, {
			"idNum": firstIdNum + 5, "trader": 100, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 5
		}, {
			"idNum": firstIdNum + 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 7
		}, {
			"idNum": firstIdNum + 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": firstTime + 6
		}, {
			"idNum": firstIdNum + 8, "trader": 103, "qty": 5, "fulfilled": 0, "price": 97, "event_dt": firstTime + 8
		}], 
		"asks": [{
			"idNum": firstIdNum + 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": firstTime + 2
		}], 
		"volumeBid": 52, "volumeAsk": 0, "bestBid": 102, "worstBid": 97, "bestAsk": 103, "worstAsk": 103, 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}
	
	//############# Market Orders ##############
	
	//# Market orders only require that the user specifies a side (bid
	//# or ask), a quantity and their unique tid.
	warn("A market order takes the specified volume from the inside of the book, regardless of price");
	warn("A market ask for 40 results in..");
	let marketOrder = {order_type: 'market', 
					 side: 'ask', 
					 instrument,
					 qty: 40, 
					 tid: 111};
	//let [trades, idNum] = 
	lob.processOrder(marketOrder, false, false);
	lob.print(instrument);
	expected = 	{
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": firstIdNum + 5, "trader": 100, "qty": 5, "fulfilled": 3, "price": 99, "event_dt": firstTime + 5
		}, {
			"idNum": firstIdNum + 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 7
		}, {
			"idNum": firstIdNum + 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": firstTime + 6
		}, {
			"idNum": firstIdNum + 8, "trader": 103, "qty": 5, "fulfilled": 0, "price": 97, "event_dt": firstTime + 8
		}], "asks": [{
			"idNum": firstIdNum + 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": firstTime + 2
		}], "volumeBid": 12, "volumeAsk": 0, "bestBid": 99, "worstBid": 97, "bestAsk": 103, "worstAsk": 103, 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}
	
	//############ Cancelling Orders #############
	
	//# Order can be cancelled simply by submitting an order idNum
	warn("cancelling bid for 5 @ 97..");
	lob.cancelOrder(firstIdNum + 8);
	lob.print(instrument);
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": firstIdNum + 5, "trader": 100, "qty": 5, "fulfilled": 3, "price": 99, "event_dt": firstTime + 5
		}, {
			"idNum": firstIdNum + 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 7
		}, {
			"idNum": firstIdNum + 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": firstTime + 6
		}], 
		"asks": [{
			"idNum": firstIdNum + 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": firstTime + 2
		}], 
		"volumeBid": 12, "volumeAsk": 0, "bestBid": 99, "worstBid": 98, "bestAsk": 103, "worstAsk": 103, 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}
	
	//########### Modifying Orders #############
	
	//# Orders can be modified by submitting a new order with an old idNum
	warn("Book after decrease amount. Will not move");
	let decreaseOrder5 = {
					qty: 4, 
					};
	lob.modifyOrder(firstIdNum + 5, decreaseOrder5);
	lob.print(instrument);
	expected = 	{
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": firstIdNum + 5, "trader": 100, "qty": 4, "fulfilled": 3, "price": 99, "event_dt": firstTime + 5
		}, {
			"idNum": firstIdNum + 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 7
		}, {
			"idNum": firstIdNum + 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": firstTime + 6
		}], "asks": [{
			"idNum": firstIdNum + 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": firstTime + 2
		}], "volumeBid": 11, "volumeAsk": 0, "bestBid": 99, "worstBid": 98, "bestAsk": 103, "worstAsk": 103, 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}
	
	warn("Book after increase amount. Will be put as end of queue");
	let increaseOrder5 = { 
					qty: 14, 
					};
	lob.modifyOrder(firstIdNum + 5, increaseOrder5);
	lob.print(instrument);
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": firstIdNum + 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 7
		}, {
			"idNum": firstIdNum + 5, "trader": 100, "qty": 14, "fulfilled": 3, "price": 99, "event_dt": firstTime + 14
		}, {
			"idNum": firstIdNum + 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": firstTime + 6
		}], 
		"asks": [{
			"idNum": firstIdNum + 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": firstTime + 2
		}], 
		"volumeBid": 21, "volumeAsk": 0, "bestBid": 99, "worstBid": 98, "bestAsk": 103, "worstAsk": 103, 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}
	
	warn("Book after improve bid price. Will process the order");
	let improveOrder5 = {
					price: 103.2,
					};
	lob.modifyOrder(firstIdNum + 5, improveOrder5);
	lob.print(instrument);
	
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": firstIdNum + 5, "trader": 100, "qty": 14, "fulfilled": 8, "price": 103.2, "event_dt": firstTime + 14
		}, {
			"idNum": firstIdNum + 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 7
		}, {
			"idNum": firstIdNum + 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": firstTime + 6
		}], 
		"asks": [], 
		"volumeBid": 16, "volumeAsk": 0, "bestBid": 103.2, "worstBid": 98, "bestAsk": null, "worstAsk": null, 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}
	
	//############# best rated Market Orders ##############
	warn("A market bid should be the best one.");
	let marketOrder2 = {order_type: 'market', 
					 side: 'bid', 
					 instrument,
					 qty: 10, 
					 tid: 103};
	//let [trades, idNum] = 
	lob.processOrder(marketOrder2, false, false);
	lob.print(instrument);
	
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": firstIdNum + 12, "trader": 103, "qty": 10, "fulfilled": 0, "price": null, "event_dt": firstTime + 16
		}, {
			"idNum": firstIdNum + 5, "trader": 100, "qty": 14, "fulfilled": 8, "price": 103.2, "event_dt": firstTime + 14
		}, {
			"idNum": firstIdNum + 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": firstTime + 7
		}, {
			"idNum": firstIdNum + 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": firstTime + 6
		}], 
		"asks": [], 
		"volumeBid": 26, "volumeAsk": 0, "bestBid": "MKT", "worstBid": 98, "bestAsk": null, "worstAsk": null, 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}
	
	//############# Outstanding Market Orders ##############
	warn("A market ask for 40 should fulfill all the bids and keep the remainder in the book");
	let marketOrder3 = {order_type: 'market', 
					 side: 'ask', 
					 instrument,
					 qty: 40, 
					 tid: 111};
	//let [trades, idNum] = 
	//lob.setDebug();
	lob.processOrder(marketOrder3, false, false);
	//lob.setDebug(false);
	lob.print(instrument);
	
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [], 
		"asks": [{
			"idNum": firstIdNum + 13, "trader": 111, "qty": 40, "fulfilled": 26, "price": null, "event_dt": firstTime + 17
		}], 
		"volumeBid": 0, "volumeAsk": 14, "bestBid": null, "worstBid": null, "bestAsk": "MKT", "worstAsk": "MKT", 
		"balance_test": [{"instrument": instrument, "amount": 0}, {"instrument": currency, "amount": 0}], 
		"fee": [], "fee2": []
	};
	if (lob.dumpCmp(expected)) {
		++nerrors;
	}
	console.log(`${nerrors} errors for ${instrument}`);
	//lob.order_log_show();
	console.timeEnd(test_label);
}
