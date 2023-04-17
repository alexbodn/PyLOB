
'use strict';

function test_perform(lob) {
	// Initialize
	let instrument = 'FAKE';
	lob.createInstrument(instrument, 'USD');
	for (let tid=100; tid<112; ++tid) {
		lob.createTrader(
			tid.toString(), tid, 
			'USD', 0.01, 2.5, 1);
	}
	//########### Limit Orders #############
	
	//# Create some limit orders
	warn("Create some limit orders");
	let someOrders = [{'order_type' : 'limit', 
					 'side' : 'ask', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 101.0,
					'tid' : 100},
					 {'order_type' : 'limit', 
					'side' : 'ask', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 103.0,
					'tid' : 101},
					 {'order_type' : 'limit', 
					'side' : 'ask', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 101.0,
					'tid' : 102},
					 {'order_type' : 'limit', 
					'side' : 'ask', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 101.0,
					'tid' : 103},
					 {'order_type' : 'limit', 
					'side' : 'bid', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 99.0,
					'tid' : 100},
					 {'order_type' : 'limit', 
					'side' : 'bid', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 98.0,
					'tid' : 101},
					 {'order_type' : 'limit', 
					'side' : 'bid', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 99.0,
					'tid' : 102},
					 {'order_type' : 'limit', 
					'side' : 'bid', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 97.0,
					'tid' : 103},
					 ];
	let dump, expected, compare;
	let forWhom=null, priceAsk=98, priceBid=101;
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
			"idNum": 5, "trader": 100, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 5, "instrument": "FAKE"
		}, {
			"idNum": 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 7, "instrument": "FAKE"
		}, {
			"idNum": 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": 6, "instrument": "FAKE"
		}, {
			"idNum": 8, "trader": 103, "qty": 5, "fulfilled": 0, "price": 97, "event_dt": 8, "instrument": "FAKE"
		}], 
		"asks": [{
			"idNum": 1, "trader": 100, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": 1, "instrument": "FAKE"
		}, {
			"idNum": 3, "trader": 102, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": 3, "instrument": "FAKE"
		}, {
			"idNum": 4, "trader": 103, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": 4, "instrument": "FAKE"
		}, {
			"idNum": 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": 2, "instrument": "FAKE"
		}], 
		"volumeBid": 15, "volumeAsk": 15, "bestBid": 99, "worstBid": 97, "bestAsk": 101, "worstAsk": 103, "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);

	//# Submitting a limit order that crosses the opposing best price will 
	//# result in a trade.
	warn("Trade occurs as incoming bid limit crosses best ask..");
	let crossingLimitOrder = {'order_type' : 'limit', 
							'side' : 'bid', 
							'instrument': instrument,
							'qty' : 2, 
							'price' : 102.0,
							'tid' : 109};

	//let [trades, orderInBook] = 
	lob.processOrder(crossingLimitOrder, false, false);
	lob.print(instrument);
	
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": 5, "trader": 100, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 5, "instrument": "FAKE"
		}, {
			"idNum": 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 7, "instrument": "FAKE"
		}, {
			"idNum": 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": 6, "instrument": "FAKE"
		}, {
			"idNum": 8, "trader": 103, "qty": 5, "fulfilled": 0, "price": 97, "event_dt": 8, "instrument": "FAKE"
		}], 
		"asks": [{
			"idNum": 1, "trader": 100, "qty": 5, "fulfilled": 2, "price": 101, "event_dt": 1, "instrument": "FAKE"
		}, {
			"idNum": 3, "trader": 102, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": 3, "instrument": "FAKE"
		}, {
			"idNum": 4, "trader": 103, "qty": 5, "fulfilled": 0, "price": 101, "event_dt": 4, "instrument": "FAKE"
		}, {
			"idNum": 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": 2, "instrument": "FAKE"
		}], 
		"volumeBid": 15, "volumeAsk": 13, "bestBid": 99, "worstBid": 97, "bestAsk": 101, "worstAsk": 103, "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);
	
	//# If a limit order crosses but is only partially matched, the remaining 
	//# volume will be placed in the book as an outstanding order
	warn("Large incoming bid limit crosses best ask. Remaining volume is placed in the book..");
	let bigCrossingLimitOrder = {'order_type' : 'limit', 
							 'side' : 'bid', 
							 'instrument': instrument,
							 'qty' : 50, 
							 'price' : 102.0,
							 'tid' : 110};
	//let [trades, orderInBook] = 
	lob.processOrder(bigCrossingLimitOrder, false, false);
	lob.print(instrument);
	
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": 10, "trader": 110, "qty": 50, "fulfilled": 13, "price": 102, "event_dt": 10, "instrument": "FAKE"
		}, {
			"idNum": 5, "trader": 100, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 5, "instrument": "FAKE"
		}, {
			"idNum": 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 7, "instrument": "FAKE"
		}, {
			"idNum": 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": 6, "instrument": "FAKE"
		}, {
			"idNum": 8, "trader": 103, "qty": 5, "fulfilled": 0, "price": 97, "event_dt": 8, "instrument": "FAKE"
		}], 
		"asks": [{
			"idNum": 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": 2, "instrument": "FAKE"
		}], 
		"volumeBid": 52, "volumeAsk": 0, "bestBid": 102, "worstBid": 97, "bestAsk": 103, "worstAsk": 103, "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);
	
	//############# Market Orders ##############
	
	//# Market orders only require that the user specifies a side (bid
	//# or ask), a quantity and their unique tid.
	warn("A market order takes the specified volume from the inside of the book, regardless of price");
	warn("A market ask for 40 results in..");
	let marketOrder = {'order_type' : 'market', 
					 'side' : 'ask', 
					 'instrument': instrument,
					 'qty' : 40, 
					 'tid' : 111};
	//let [trades, idNum] = 
	lob.processOrder(marketOrder, false, false);
	lob.print(instrument);
	expected = 	{
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, "bids": [{
			"idNum": 5, "trader": 100, "qty": 5, "fulfilled": 3, "price": 99, "event_dt": 5, "instrument": "FAKE"
		}, {
			"idNum": 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 7, "instrument": "FAKE"
		}, {
			"idNum": 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": 6, "instrument": "FAKE"
		}, {
			"idNum": 8, "trader": 103, "qty": 5, "fulfilled": 0, "price": 97, "event_dt": 8, "instrument": "FAKE"
		}], "asks": [{
			"idNum": 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": 2, "instrument": "FAKE"
		}], "volumeBid": 12, "volumeAsk": 0, "bestBid": 99, "worstBid": 97, "bestAsk": 103, "worstAsk": 103, "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);
	
	//############ Cancelling Orders #############
	
	//# Order can be cancelled simply by submitting an order idNum
	warn("cancelling bid for 5 @ 97..");
	lob.cancelOrder(8);
	lob.print(instrument);
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": 5, "trader": 100, "qty": 5, "fulfilled": 3, "price": 99, "event_dt": 5, "instrument": "FAKE"
		}, {
			"idNum": 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 7, "instrument": "FAKE"
		}, {
			"idNum": 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": 6, "instrument": "FAKE"
		}], 
		"asks": [{
			"idNum": 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": 2, "instrument": "FAKE"
		}], 
		"volumeBid": 12, "volumeAsk": 0, "bestBid": 99, "worstBid": 98, "bestAsk": 103, "worstAsk": 103, "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);
	
	//########### Modifying Orders #############
	
	//# Orders can be modified by submitting a new order with an old idNum
	warn("Book after decrease amount. Will not move");
	let decreaseOrder5 = {
					'qty' : 4, 
					};
	lob.modifyOrder(5, decreaseOrder5);
	lob.print(instrument);
	expected = 	{
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, "bids": [{
			"idNum": 5, "trader": 100, "qty": 4, "fulfilled": 3, "price": 99, "event_dt": 5, "instrument": "FAKE"
		}, {
			"idNum": 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 7, "instrument": "FAKE"
		}, {
			"idNum": 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": 6, "instrument": "FAKE"
		}], "asks": [{
			"idNum": 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": 2, "instrument": "FAKE"
		}], "volumeBid": 11, "volumeAsk": 0, "bestBid": 99, "worstBid": 98, "bestAsk": 103, "worstAsk": 103, "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);
	
	warn("Book after increase amount. Will be put as end of queue");
	let increaseOrder5 = { 
					'qty' : 14, 
					};
	lob.modifyOrder(5, increaseOrder5);
	lob.print(instrument);
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 7, "instrument": "FAKE"
		}, {
			"idNum": 5, "trader": 100, "qty": 14, "fulfilled": 3, "price": 99, "event_dt": 14, "instrument": "FAKE"
		}, {
			"idNum": 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": 6, "instrument": "FAKE"
		}], 
		"asks": [{
			"idNum": 2, "trader": 101, "qty": 5, "fulfilled": 0, "price": 103, "event_dt": 2, "instrument": "FAKE"
		}], 
		"volumeBid": 21, "volumeAsk": 0, "bestBid": 99, "worstBid": 98, "bestAsk": 103, "worstAsk": 103, "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);
	
	warn("Book after improve bid price. Will process the order");
	let improveOrder5 = {
					'price' : 103.2,
					};
	lob.modifyOrder(5, improveOrder5);
	lob.print(instrument);
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": 5, "trader": 100, "qty": 14, "fulfilled": 8, "price": 103.2, "event_dt": 14, "instrument": "FAKE"
		}, {
			"idNum": 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 7, "instrument": "FAKE"
		}, {
			"idNum": 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": 6, "instrument": "FAKE"
		}], 
		"asks": [], 
		"volumeBid": 16, "volumeAsk": 0, "bestBid": 103.2, "worstBid": 98, "bestAsk": null, "worstAsk": null, "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);
	
	//############# best rated Market Orders ##############
	warn("A market bid should be the best one.");
	let marketOrder2 = {'order_type' : 'market', 
					 'side' : 'bid', 
					 'instrument': instrument,
					 'qty' : 10, 
					 'tid' : 103};
	//let [trades, idNum] = 
	lob.processOrder(marketOrder2, false, false);
	lob.print(instrument);
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [{
			"idNum": 12, "trader": 103, "qty": 10, "fulfilled": 0, "price": null, "event_dt": 16, "instrument": "FAKE"
		}, {
			"idNum": 5, "trader": 100, "qty": 14, "fulfilled": 8, "price": 103.2, "event_dt": 14, "instrument": "FAKE"
		}, {
			"idNum": 7, "trader": 102, "qty": 5, "fulfilled": 0, "price": 99, "event_dt": 7, "instrument": "FAKE"
		}, {
			"idNum": 6, "trader": 101, "qty": 5, "fulfilled": 0, "price": 98, "event_dt": 6, "instrument": "FAKE"
		}], 
		"asks": [], 
		"volumeBid": 26, "volumeAsk": 0, "bestBid": "MKT", "worstBid": 98, "bestAsk": null, "worstAsk": null, "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);
	
	//############# Outstanding Market Orders ##############
	warn("A market ask for 40 should take all the bids and keep the remainder in the book");
	let marketOrder3 = {'order_type' : 'market', 
					 'side' : 'ask', 
					 'instrument': instrument,
					 'qty' : 40, 
					 'tid' : 111};
	//let [trades, idNum] = 
	lob.processOrder(marketOrder3, false, false);
	lob.print(instrument);
	expected = {
		"instrument": instrument, "forWhom": forWhom, "priceAsk": priceAsk, "priceBid": priceBid, 
		"bids": [], 
		"asks": [{
			"idNum": 13, "trader": 111, "qty": 40, "fulfilled": 26, "price": null, "event_dt": 17, "instrument": "FAKE"
		}], 
		"volumeBid": 0, "volumeAsk": 14, "bestBid": null, "worstBid": null, "bestAsk": "MKT", "worstAsk": "MKT", "commission_balance": 0
	};
	compare = lob.dumpCmp(expected);
	
	//lob.order_log_show();
}
