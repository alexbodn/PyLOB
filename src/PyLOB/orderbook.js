
function objectUpdate(dest, src) {
	for (let [k, v] of Object.entries(src)) {
		dest[k] = v;
	}
	return dest;
}
/*
let d = {a: 1, b: 2};
objectUpdate(d, {c: 3, d: 4});
log(d);
*/

function prepKeys(obj, label) {
	let ret = obj;
	if (false) warn(label);
	if (Array.isArray(obj)) {
		return obj;
	}
	if (typeof(obj) == 'object') {
		ret = {};
		for (let [key, val] of Object.entries(obj)) {
			ret[':' + key] = val;
		}
	}
	return ret;
}

class OrderBook {
	valid_types = ['market', 'limit'];
	valid_sides = ['ask', 'bid'];
	query_names = [
		'active_orders',
		'best_quotes',
		'best_quotes_order',
		'cancel_order',
		'find_order',
		'insert_order',
		'insert_trade',
		'limit1',
		'matches',
		'modify_order',
		'select_trades',
		'set_lastprice',
		'get_lastprice',
		'volume_at_price',
		'commission_test',
	];
	 
	constructor(location, file_loader, db, tick_size=0.0001) {
		this.lastTick = null;
		this.lastPrice = {};
		this.lastTimestamp = 0;
		this.tickSize = tick_size
		this.rounder = Math.floor(Math.log10(1 / this.tickSize));
		this.time = 0;
		this.nextQuoteID = 0;
		this.db = db;
		this.location = location;
		this.file_loader = file_loader;
	}
	
	async init() {
		let result = new Promise((resolve, reject) => {
		let query_promises = Array();
		let obj = this;
		for (let query of this.query_names) {
			let promise = this.file_loader(query, this.location + '/sql/' + query + '.sql');
			query_promises.push(promise);
		}
		let allDone = Promise.allSettled(query_promises);
		allDone.then(
			values => {
				for (let one of values) {
					if (one.status != 'fulfilled') {
						reject(`could not open {one.value[0]}`);
					}
					obj[one.value[0]] = '--<' + one.value[0] +'>--\n' + one.value[1];
				}
				obj.best_quotes_order_asc = 
					obj.best_quotes_order.replaceAll(':direction', 'asc');
				obj.best_quotes_order_desc = 
					obj.best_quotes_order.replaceAll(':direction', 'desc');
				obj.best_quotes_order_map = {
					desc: obj.best_quotes_order_desc,
					asc: obj.best_quotes_order_asc,
				};
				delete obj.best_quotes_order;
				resolve('init done');
			}
		);
		});
		return result;
	}
	
	clipPrice(price) {
		// Clips the price according to the ticksize
		return Math.round(price * this.rounder) / this.rounder;
	}
	
	updateTime() {
		this.time++;
	}
	
	processOrder(quote, fromData, verbose) {
		if (fromData) {
			this.time = quote.timestamp;
		}
		else {
			this.updateTime();
			quote.timestamp = this.time;
			this.nextQuoteID += 1;
			quote.idNum = this.nextQuoteID;
		}
		
		if (quote.qty <= 0) {
			throw new Error('processOrder() given order of qty <= 0');
		}

		if (!this.valid_types.includes(quote.type)) {
			throw new Error(`processOrder() given ${quote.type}, not in ${this.valid_types}`);
		}
		if (!this.valid_sides.includes(quote.side)) {
			throw new Error(`processOrder() given ${quote.side}, not in ${this.valid_sides}`);
		}

		if (quote.price) {
			quote.price = this.clipPrice(quote.price);
		}
		else {
			quote.price = null;
		}
		let ret = null;
		let obj = this;
		this.db.transaction(
			D => {
				D.exec({
					sql: obj.insert_order,
					bind: prepKeys(quote),
				});
				D.exec({
					sql: "select max(rowid) from trade_order;",
					nodeMode: 'array',
					callback: res => {
						quote.order_id = res[0];
						ret = obj.processMatchesDB(quote, D, verbose);
					}
				});
			}
		);
		
		return ret;
	}

	processMatchesDB(quote, db, verbose) {
		let instrument = quote.instrument;
		quote.lastprice = this.getLastPrice(instrument, db);
		let trades = [];
		let qtyToExec = quote.qty;
		let sql_matches = this.matches + this.best_quotes_order_asc;
		let matches = [];
		db.exec({
			sql: sql_matches, 
			bind: prepKeys({
				instrument: quote.instrument,
				side: quote.side,
				price: quote.price,
				lastprice: quote.lastprice,
				tid: quote.tid,
			}),
			rowMode: 'array',
			callback: match => {
				if (qtyToExec > 0) {
					let [order_id, counterparty, price, available] = match;
					let bid_order = quote.side == 'bid' ? quote.order_id : order_id;
					let ask_order = quote.side == 'ask' ? quote.order_id : order_id;
					let qty = Math.min(available, qtyToExec);
					qtyToExec -= qty;
					let trade = [bid_order, ask_order, this.time, price, qty];
					trades.push(trade);
					db.exec({
						sql: this.insert_trade, 
						bind: prepKeys(trade)
					});
					this.setLastPrice(instrument, price, db);
					if (verbose) {
						log(`>>> TRADE \nt=${this.time} ${price} n=${qty} p1=${counterparty} p2=${quote.tid}`);
					}
				}
			}
		});
		
		return [trades, quote];
	}
	
	cancelOrder(side, idNum, time=null) {
		if (time) {
			this.time = time;
		}
		else {
			this.updateTime();
		}
		
		this.db.transaction(
			D => {
				D.exec({
					sql: this.cancel_order, 
					bind: prepKeys({cancel: 1, idNum: idNum, side: side})
				});
			}
		);
	}

	// return whether comparedPrice has better matching chance than price
	betterPrice(side, price, comparedPrice) {
		if (price === null && comparedPrice !== null) {
			return false;
		}
		if (price !== null && comparedPrice === null) {
			return true;
		}
		if (side == 'bid') {
			return (price < comparedPrice);
		}
		else if (side == 'ask') {
			return (price > comparedPrice);
		}
		else {
			throw new Error('betterPrice() given neither bid nor ask');
		}
	}

	orderGetSide(idNum) {
		ret = null;
		// SHOULD BE SYNCHRONOUS
		this.db.exec({
			sql: this.find_order, 
			bind: prepKeys([idNum]),
			rowMode: 'array',
			callback: row => {ret = row[0]}
		});
		return ret;
	}

	modifyOrder(idNum, orderUpdate, time=null, verbose=false) {
		if (time) {
			this.time = time;
		}
		else {
			this.updateTime();
		}
		let side = orderUpdate.side;
		orderUpdate.idNum = idNum;
		orderUpdate.timestamp = this.time;

		let ret = [[], orderUpdate];
		this.db.transaction(
			D => {
				D.exec({
					sql: this.find_order,
					bind: prepKeys([idNum]),
					nodeMode: 'array',
					callback: row => {
						let [side, instrument, price, qty, fulfilled, cancel, order_id, order_type] = row;
						objectUpdate(orderUpdate, {
							type: order_type,
							order_id: order_id,
							instrument: instrument,
						});
						if (orderUpdate.price) {
							orderUpdate.price = this.clipPrice(orderUpdate.price);
						}
						D.exec({
							sql: this.modify_order,
							bind: prepKeys({
								price: orderUpdate.price,
								qty: orderUpdate.qty,
								timestamp: orderUpdate.timestamp,
								idNum: orderUpdate.idNum,
								side: orderUpdate.side,
								tid: orderUpdate.tid,
							})
						});
						if (this.betterPrice(side, price, orderUpdate.price)) {
							ret = this.processMatchesDB(orderUpdate, D, verbose);
						}
					}
				});
			}
		);
		return ret;
	}
	
	setLastPrice(instrument, price, db) {
		this.lastPrice[instrument] = price;
		db.exec({
			sql: this.set_lastprice, 
			bind: prepKeys({instrument: instrument, lastprice: price})
		});
	}
	
	getLastPrice(instrument, db) {
		let price = this.lastPrice[instrument] || null;
		if (price === null) {
			db.exec({
				sql: this.get_lastprice, 
				bind: prepKeys({instrument: instrument}),
				rowMode: 'array',
				callback: row => {
					price = row[0];
				}
			});
		}
		return price;
	}
	
	getVolumeAtPrice(instrument, side, price) {
		// how much can i buy / sell for this price 
		// should include all matching prices.
		price = this.clipPrice(price);
		let params = {instrument: instrument, side: side, price: price};
		let ret = null;
		this.db.exec({
			sql: this.volume_at_price, 
			bind: prepKeys(params),
			rowMode: 'array',
			callback: row => {
				ret = row[0];
			}
		});
		return ret;
	}

	getPrice(instrument, side, direction='asc') {
		let sql_active_orders = 
			this.active_orders + this.best_quotes_order_map[direction] + this.limit1;
		let ret = null;
		this.db.exec({
			sql: sql_active_orders,
			bind: prepKeys({instrument: instrument, side: side}),
			rowMode: 'object',
			callback: row => {ret = row.price}
		});
		return ret;
	}
	
	getBestBid(instrument) {
		return this.getPrice(instrument, 'bid', 'asc');
	}
	getWorstBid(instrument) {
		return this.getPrice(instrument, 'bid', 'desc');
	}
	getBestAsk(instrument) {
		return this.getPrice(instrument, 'ask', 'asc');
	}
	getWorstAsk(instrument) {
		return this.getPrice(instrument, 'ask', 'desc');
	}
	
	print(instrument) {
		let sql_active_orders = 
			this.active_orders + this.best_quotes_order_asc;

		let fileStr = [];
		function bidask(row) {
			let [idNum, qty, fulfilled, price, event_dt, instrument] = row;
			fileStr.push(`${idNum})${qty}-${fulfilled} @ ${price} t=${event_dt}`);
		}
		fileStr.push("------ Bids -------");
		this.db.exec({
			sql: sql_active_orders,
			bind: prepKeys({instrument: instrument, side: 'bid'}),
			rowMode: 'array',
			callback: bidask,
		});
		fileStr.push("");
		fileStr.push("------ Asks -------");
		this.db.exec({
			sql: sql_active_orders,
			bind: prepKeys({instrument: instrument, side: 'ask'}),
			rowMode: 'array',
			callback: bidask,
		});
		fileStr.push("");
		fileStr.push("------ Trades ------");
		this.db.exec({
			sql: this.select_trades, 
			bind: prepKeys({instrument: instrument}),
			rowMode: 'array',
			callback: trade => {
				fileStr.push(JSON.stringify(trade));
			}
		});
		fileStr.push("");
		
		this.db.exec({
			sql: this.commission_test, 
			rowMode: 'object',
			callback: commission => {
				fileStr.push(JSON.stringify(commission));
			}
		});
		fileStr.push("");
		
		fileStr.push(`volume bid if i ask 98: ${this.getVolumeAtPrice(instrument, 'bid', 98)}`);
		fileStr.push(`volume ask if i bid 101: ${this.getVolumeAtPrice(instrument, 'ask', 101)}`);
		fileStr.push(`best bid: ${this.getBestBid(instrument)}`);
		fileStr.push(`worst bid: ${this.getWorstBid(instrument)}`);
		fileStr.push(`best ask: ${this.getBestAsk(instrument)}`);
		fileStr.push(`worst ask: ${this.getWorstAsk(instrument)}`);
		
		let value = fileStr.join('\n');
		log(value);
		return value;
	}
};
