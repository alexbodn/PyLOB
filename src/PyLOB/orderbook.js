
'use strict';

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
		'trader_insert',
		'trader_transfer',
		'trader_balance',
		'lastorder',
		'lasttrader',
		'instrument_insert',
		'insert_trade',
		'limit1',
		'order_by_dt',
		'matches',
		'trade_balance',
		'modify_order',
		'trade_fulfills',
		'select_trades',
		'set_lastprice',
		'get_lastprice',
		'volume_at_price',
		'commission_test',
		'insert_order_log',
		'select_order_log',
	];
	 
	constructor(location, file_loader, db, tick_size=0.0001, verbose=false) {
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
		this.verbose = verbose;
	}
	
	async init() {
		let result = new Promise((resolve, reject) => {
		let query_promises = [];
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
					this[one.value[0]] = '--<' + one.value[0] +'>--\n' + one.value[1];
				}
				this.best_quotes_order_asc = 
					this.best_quotes_order.replaceAll(':direction', 'asc');
				this.best_quotes_order_desc = 
					this.best_quotes_order.replaceAll(':direction', 'desc');
				this.best_quotes_order_map = {
					desc: this.best_quotes_order_desc,
					asc: this.best_quotes_order_asc,
				};
				delete this.best_quotes_order;
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
	
	updateTime(timestamp) {
		if (timestamp === undefined) {
			timestamp = this.time + 1;
		}
		this.time = timestamp;
	}
	
	createInstrument(symbol, currency) {
		this.db.exec({
			sql: this.instrument_insert,
			bind: prepKeys({
				symbol: symbol,
				currency: currency,
			})
		});
	}
	
	createTrader(name, tid, currency, 
		commission_per_unit, commission_min, commission_max_percnt, 
		allow_self_matching=0)
	{
		let ret = null;
		this.db.transaction(
			D => {
				D.exec({
					sql: this.trader_insert,
					bind: prepKeys({
						tid: tid,
						name: name,
						currency: currency,
						commission_min: commission_min,
						commission_max_percnt: commission_max_percnt,
						commission_per_unit: commission_per_unit,
						allow_self_matching: allow_self_matching
					}),
				});
				D.exec({
					sql: this.lasttrader,
					nodeMode: 0,
					callback: res => {
						ret = res;
					}
				});
			}
		);
		return ret;
	}
	
	traderTransfer(trader, instrument, amount) {
		// deposit/withdrawal by the sign of amount
		this.db.transaction(
			D => {
				D.exec({
					sql: this.trader_transfer,
					bind: prepKeys({
						trader: trader,
						instrument: instrument,
						amount: amount,
					}),
				});
			}
		);
	}
	
	traderGetBalance(trader, instrument) {
		// if !instrument, return an object for all
		let balance = [];
		this.db.exec({
			sql: this.trader_balance,
			bind: prepKeys({
				trader: quote.tid, 
				symbol: instrument,
			}),
			rowMode: 'object',
			callback: row => {
				balance.push(row);
			}
		});
		return balance;
	}
	
	processOrder(quote, fromData, verbose=false, comment) {
		this.updateTime(quote.timestamp);
		if (!fromData) {
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
		this.db.transaction(
			D => {
				D.exec({
					sql: this.insert_order,
					bind: prepKeys(quote),
				});
				D.exec({
					sql: this.lastorder,
					nodeMode: 'array',
					callback: res => {
						quote.order_id = res[0];
						this.order_log_insert(this.time, res[0], this.printQuote(quote), D);
						ret = this.processMatchesDB(quote, D, verbose);
					}
				});
			}
		);
		if (ret) {
			let [trades, trade_fulfills, balance_updates] = ret;
			this.matchesEvents(trades, trade_fulfills, balance_updates, quote, comment);
			return [trades, quote];
		}
		return [[], quote];
	}

	processMatchesDB(quote, db, verbose) {
		let instrument = quote.instrument;
		quote.lastprice = this.getLastPrice(instrument, db);
		let trades = [];
		let qtyToExec = quote.qty;
		let sql_matches = this.matches + this.best_quotes_order_asc;
		let fulfills = [];
		let balance_updates = [];
		//let obj = this;
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
				if (qtyToExec <= 0) {
					return;
				}
				let [order_id, counterparty, price, available, currency] = match;
				let bid_order = quote.side == 'bid' ? quote.order_id : order_id;
				let ask_order = quote.side == 'ask' ? quote.order_id : order_id;
				let qty = Math.min(available, qtyToExec);
				qtyToExec -= qty;
				let trade = this.tradeExecute(
					bid_order, ask_order, price, qty, instrument, db, verbose);
				trades.push(trade);
				db.exec({
					sql: this.trade_fulfills, 
					bind: prepKeys({
						bid_order: bid_order, 
						ask_order: ask_order,
					}),
					rowMode: 'object',
					callback: row => {
						fulfills.push(row);
						this.order_log_insert(this.time, row.order_id, `FULFILLED ${row.fulfilled} / ${row.qty}`, db);
					}
				});
				db.exec({
					sql: this.trade_balance,
					bind: prepKeys({
						trader: quote.tid, 
						counterparty: counterparty,
						symbol: instrument,
						currency: currency
					}),
					rowMode: 'object',
					callback: row => {
						balance_updates.push(row);
					}
				});
			}
		});
		return [trades, fulfills, balance_updates];
	}
	
	tradeExecute(bid_order, ask_order, price, qty, instrument, db, verbose) {
		let trade = {
			bid_order: bid_order,
			ask_order: ask_order,
			time: this.time,
			price: price,
			qty: qty
		};
		db.exec({
			sql: this.insert_trade, 
			bind: prepKeys(trade)
		});
		this.order_log_insert(this.time, ask_order, `SOLD ${qty} @ ${price}`, db);
		this.order_log_insert(this.time, bid_order, `BOUGHT ${qty} @ ${price}`, db);
		this.setLastPrice(instrument, price, db);
		if (verbose) {
			log(`>>> TRADE \nt=${this.time} ${price} n=${qty} p1=${counterparty} p2=${quote.tid}`);
		}
		return trade;
	}
	
	matchesEvents(trades, fulfills, balance_updates, quote, comment) {
		if (comment) {
			this.order_log_insert(quote.timestamp, quote.order_id, comment);
		}
		for (let trade of trades) {
		}
		for (let fulfill of fulfills) {
			// send execution event mentioning qty ramaining
		}
		for (let update of balance_updates) {
			if (update.instrument == quote.instrument) {
				// update position event
			}
			else {
				// update balance
			}
			//error(JSON.stringify(update));
		}
	}
	
	cancelOrder(idNum, time, comment) {
		this.updateTime(time);
		
		this.db.transaction(
			D => {
				D.exec({
					sql: this.find_order,
					bind: prepKeys([idNum]),
					nodeMode: 'array',
					callback: row => {
						let [side, instrument, price, qty, fulfilled, cancel, order_id, order_type] = row;
						D.exec({
							sql: this.cancel_order, 
							bind: prepKeys({
								cancel: 1, 
								order_id: order_id, 
								//side: side
							})
						});
						this.order_log_insert(this.time, order_id, '<u>CANCEL ORDER</u>', D);
					}
				});
			}
		);
	}

	betterPrice(side, price, comparedPrice) {
		// return whether comparedPrice has better matching chance than price
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
		this.db.exec({
			sql: this.find_order, 
			bind: prepKeys([idNum]),
			rowMode: 0,
			callback: row => {ret = row}
		});
		return ret;
	}

	modifyOrder(idNum, orderUpdate, time, verbose=false, comment) {
		this.updateTime(time);
		let side = orderUpdate.side;
		orderUpdate.idNum = idNum;
		orderUpdate.timestamp = this.time;

		let ret = null;
		this.db.transaction(
			D => {
				D.exec({
					sql: this.find_order,
					bind: prepKeys([idNum]),
					rowMode: 'array',
					callback: row => {
						let [side, instrument, price, qty, fulfilled, cancel, order_id, order_type] = row;
						objectUpdate(orderUpdate, {
							type: order_type,
							order_id: order_id,
							instrument: instrument,
						});
						let loginfo = 'MODIFY';
						if ('price' in orderUpdate) {
							orderUpdate.price = this.clipPrice(orderUpdate.price);
							loginfo += ' price: ' + orderUpdate.price + ';';
						}
						else {
							orderUpdate.price = price;
						}
						if ('qty' in orderUpdate) {
							loginfo += ' qty: ' + orderUpdate.qty + ';';
						}
						else {
							orderUpdate.qty = qty;
						}
						D.exec({
							sql: this.modify_order,
							bind: prepKeys({
								price: orderUpdate.price,
								qty: orderUpdate.qty,
								timestamp: orderUpdate.timestamp,
								order_id: orderUpdate.order_id,
								//side: orderUpdate.side,
								//tid: orderUpdate.tid,
							})
						});
						this.order_log_insert(this.time, order_id, `<u>${loginfo}</u>`, D);
						if (this.betterPrice(side, price, orderUpdate.price)) {
							ret = this.processMatchesDB(orderUpdate, D, verbose);
						}
					}
				});
			}
		);
		if (ret) {
			let [trades, fulfills, balance_updates] = ret;
			this.matchesEvents(trades, fulfills, balance_updates, orderUpdate, comment);
			return [trades, orderUpdate];
		}
		return [[], orderUpdate];
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
					this.lastPrice[instrument] = price;
				}
			});
		}
		return price;
	}
	
	getVolumeAtPrice(instrument, side, price) {
		// how much can i buy / sell for this price 
		// should include all matching prices.
		let params = {
			instrument: instrument, 
			side: side, 
			price: this.clipPrice(price)
		};
		let ret = null;
		this.db.exec({
			sql: this.volume_at_price, 
			bind: prepKeys(params),
			rowMode: 0,
			callback: row => {
				ret = row;
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
	
	order_log_insert(event_dt, order_id, info, db) {
		if (this.verbose) {
			log(`${event_dt}:${order_id}:<b>${info}</b>`);
		}
		db.exec({
			sql: this.insert_order_log, 
			bind: prepKeys({
				event_dt: event_dt,
				order_id: order_id,
				info: info
			})
		});
	}
	
	order_log_show() {
		this.db.exec({
			sql: this.select_order_log,
			rowMode: 'object',
			callback: row => {
				warn(JSON.stringify(row));
			}
		});
	}
	
	printQuote(quote) {
		let action = quote.side == 'ask' ? 'SELL' : 'BUY';
		let order_type = quote.type == 'limit' ? 'LMT' : 'MKT';
		let price = quote.type == 'limit' ? ' ' + quote.price : '';
		let ret = `<u>${action} ${quote.qty} ${quote.instrument} @${order_type} ${price}</u>`;
		return ret;
	}
	
	print(instrument) {
		let sql_active_orders = 
			this.active_orders + this.best_quotes_order_asc;

		let fileStr = [];
		fileStr.push(`<b>limit order book for ${instrument}</b>`);
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
		/*fileStr.push("------ Trades ------");
		this.db.exec({
			sql: this.select_trades + this.order_by_dt, 
			bind: prepKeys({instrument: instrument}),
			rowMode: 'array',
			callback: trade => {
				fileStr.push(JSON.stringify(trade));
			}
		});
		fileStr.push("");*/
		
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
		
		fileStr.push("");
		
		let value = fileStr.join('\n');
		log(value);
		return value;
	}
};
