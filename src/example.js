
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
	let someOrders = [{'type' : 'limit', 
					 'side' : 'ask', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 101.0,
					'tid' : 100},
					 {'type' : 'limit', 
					'side' : 'ask', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 103.0,
					'tid' : 101},
					 {'type' : 'limit', 
					'side' : 'ask', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 101.0,
					'tid' : 102},
					 {'type' : 'limit', 
					'side' : 'ask', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 101.0,
					'tid' : 103},
					 {'type' : 'limit', 
					'side' : 'bid', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 99.0,
					'tid' : 100},
					 {'type' : 'limit', 
					'side' : 'bid', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 98.0,
					'tid' : 101},
					 {'type' : 'limit', 
					'side' : 'bid', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 99.0,
					'tid' : 102},
					 {'type' : 'limit', 
					'side' : 'bid', 
					'instrument': instrument,
					'qty' : 5, 
					'price' : 97.0,
					'tid' : 103},
					 ];
	
	//# Add orders to LOB
	for (let order of someOrders) {
		//let [trades, idNum] = 
		lob.processOrder(order, false, false);
		//lob.print(trades, idNum);
	}
	//# The current book may be viewed using a print
	lob.print(instrument);
	
	//# Submitting a limit order that crosses the opposing best price will 
	//# result in a trade.
	warn("Trade occurs as incoming bid limit crosses best ask..");
	let crossingLimitOrder = {'type' : 'limit', 
							'side' : 'bid', 
							'instrument': instrument,
							'qty' : 2, 
							'price' : 102.0,
							'tid' : 109};

	//let [trades, orderInBook] = 
	lob.processOrder(crossingLimitOrder, false, false);
	lob.print(instrument);
	
	//# If a limit order crosses but is only partially matched, the remaining 
	//# volume will be placed in the book as an outstanding order
	warn("Large incoming bid limit crosses best ask. Remaining volume is placed in the book..");
	let bigCrossingLimitOrder = {'type' : 'limit', 
							 'side' : 'bid', 
							 'instrument': instrument,
							 'qty' : 50, 
							 'price' : 102.0,
							 'tid' : 110};
	//let [trades, orderInBook] = 
	lob.processOrder(bigCrossingLimitOrder, false, false);
	lob.print(instrument);
	
	//############# Market Orders ##############
	
	//# Market orders only require that the user specifies a side (bid
	//# or ask), a quantity and their unique tid.
	warn("A market order takes the specified volume from the inside of the book, regardless of price");
	warn("A market ask for 40 results in..");
	let marketOrder = {'type' : 'market', 
					 'side' : 'ask', 
					 'instrument': instrument,
					 'qty' : 40, 
					 'tid' : 111};
	//let [trades, idNum] = 
	lob.processOrder(marketOrder, false, false);
	lob.print(instrument);
	
	//############ Cancelling Orders #############
	
	//# Order can be cancelled simply by submitting an order idNum
	warn("cancelling bid for 5 @ 97..");
	lob.cancelOrder(8);
	lob.print(instrument);
	
	//########### Modifying Orders #############
	
	//# Orders can be modified by submitting a new order with an old idNum
	warn("Book after decrease amount. Will not move");
	let decreaseOrder5 = {'side' : 'bid', 
					'qty' : 4, 
					'tid' : 100};
	lob.modifyOrder(5, decreaseOrder5);
	lob.print(instrument);
	
	warn("Book after increase amount. Will be put as end of queue");
	let increaseOrder5 = {'side' : 'bid', 
					'qty' : 14, 
					'tid' : 100};
	lob.modifyOrder(5, increaseOrder5);
	lob.print(instrument);
	
	warn("Book after improve bid price. Will process the order");
	let improveOrder5 = {'side' : 'bid', 
					'price' : 103.2,
					'tid' : 100};
	lob.modifyOrder(5, improveOrder5);
	lob.print(instrument);

	//############# Outstanding Market Orders ##############
	warn("A market ask for 40 should take all the bids and keep the remainder in the book");
	let marketOrder2 = {'type' : 'market', 
					 'side' : 'ask', 
					 'instrument': instrument,
					 'qty' : 40, 
					 'tid' : 111};
	//let [trades, idNum] = 
	lob.processOrder(marketOrder2, false, false);
	lob.print(instrument);
	
	//lob.order_log_show();
}
