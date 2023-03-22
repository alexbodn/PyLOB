

function test_init(db, instrument) {
	let insert_traders = '';
	for (let tid=100; tid<112; ++tid) {
		let name = tid.toString();
		let one_trader = `
			insert into trader (tid, name)
			values (${tid}, '${name}') 
			on conflict do nothing;`;
		insert_traders += one_trader;
	}
	let create_traders = `
		begin transaction;
		PRAGMA foreign_keys=1;
		${insert_traders}
		update trader 
		set 
			commission_min=2.5,
			commission_max_percnt=1,
			commission_per_unit=0.01
		;
		insert into instrument (symbol, currency) 
		values ('${instrument}', 'USD')
		on conflict do nothing;
		commit;`;
	db.exec(create_traders);
}

function test_perform(lob, instrument) {
	
	//########### Limit Orders #############
	
	//# Create some limit orders
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
	let crossingLimitOrder = {'type' : 'limit', 
							'side' : 'bid', 
							'instrument': instrument,
							'qty' : 2, 
							'price' : 102.0,
							'tid' : 109};

	//let [trades, orderInBook] = 
	lob.processOrder(crossingLimitOrder, false, false);
	warn("Trade occurs as incoming bid limit crosses best ask..", JSON.stringify(crossingLimitOrder, null, '\t'));
	lob.print(instrument);
	
	//# If a limit order crosses but is only partially matched, the remaining 
	//# volume will be placed in the book as an outstanding order
	let bigCrossingLimitOrder = {'type' : 'limit', 
							 'side' : 'bid', 
							 'instrument': instrument,
							 'qty' : 50, 
							 'price' : 102.0,
							 'tid' : 110};
	//let [trades, orderInBook] = 
	lob.processOrder(bigCrossingLimitOrder, false, false);
	warn("Large incoming bid limit crosses best ask. Remaining volume is placed in the book..", JSON.stringify(bigCrossingLimitOrder, null, '\t'));
	lob.print(instrument);
	
	//############# Market Orders ##############
	
	//# Market orders only require that the user specifies a side (bid
	//# or ask), a quantity and their unique tid.
	let marketOrder = {'type' : 'market', 
					 'side' : 'ask', 
					 'instrument': instrument,
					 'qty' : 40, 
					 'tid' : 111};
	//let [trades, idNum] = 
	lob.processOrder(marketOrder, false, false);
	warn("A market order takes the specified volume from the inside of the book, regardless of price");
	warn("A market ask for 40 results in..", JSON.stringify(marketOrder, null, '\t'));
	lob.print(instrument);
	
	//############ Cancelling Orders #############
	
	//# Order can be cancelled simply by submitting an order idNum and a side
	warn("cancelling bid for 5 @ 97..");
	lob.cancelOrder('bid', 8);
	lob.print(instrument);
	
	//########### Modifying Orders #############
	
	//# Orders can be modified by submitting a new order with an old idNum
	let modifyOrder5 = {'side' : 'bid', 
					'qty' : 14, 
					'price' : 99.0,
					'tid' : 100};
	lob.modifyOrder(5, modifyOrder5);
	warn(`Book after increase amount. 
	Will be put as end of queue`);
	
	lob.print(instrument);
	
	modifyOrder5 = {'side' : 'bid', 
					'qty' : 14, 
					'price' : 103.2,
					'tid' : 100};
	lob.modifyOrder(5, modifyOrder5);
	warn("Book after improve bid price. Will process the order");
	
	lob.print(instrument);

	//############# Outstanding Market Orders ##############
	//# this loops forever in the compatibility mode.
	//# though after my patches it works ok, i didn't find the bug.
	//# my next version will use a db, for more extensive activity.
	let marketOrder2 = {'type' : 'market', 
					 'side' : 'ask', 
					 'instrument': instrument,
					 'qty' : 40, 
					 'tid' : 111};
	//let [trades, idNum] = 
	lob.processOrder(marketOrder2, false, false);
	warn("A market ask for 40 should take all the bids and keep the remainder in the book", JSON.stringify(marketOrder2, null, '\t'));
	lob.print(instrument);
}
