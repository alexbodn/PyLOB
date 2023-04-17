
'use strict';

let strcmp = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'}).compare;

function cmp(a, b) {
	if (typeof a === 'string' || a instanceof String) {
		return strcmp(a, b);
	}
	// also try: (str1 > str2) - (str1 < str2),
	if (a > b) return 1;
	if (a < b) return -1;
	return 0;
}

function objCmp(a, b, fields) {
	for (let field of fields) {
		let ret = cmp(a[field], b[field]);
		if (ret != 0) {
			return ret;
		}
	}
	return 0;
}

function arrayCmp(a, b) {
	let ret = cmp(a.length, b.length);
	if (!ret) {
		for (let ix in a) {
			ret = cmp(a[ix], b[ix]);
			if (ret != 0) {
				return ret;
			}
		}
	}
	return ret;
}

let format10 = 10**10; // calc once
function formatRounder(number) {
	return Math.round(number * format10) / format10;
}

async function fetchText(name, url) {
	// to be called in a browser
	let ret = fetch(url).then(function(response) {
		return response.text().then(data => [name, data]);
	});
	return ret;
}

const format = function () {
  var args = arguments;
  return args[0].replace(/{(\d+)}/g, function (match, number) {
    return typeof args[number + 1] != "undefined" ? args[number + 1] : match;
  });
};

const formats = function (fmt, args) {
  return fmt.replace(/{([a-z_A-Z][a-z_A-Z0-9]*)}/g, function (match, text) {
  	console.warn(text);
    return typeof args[text] != "undefined" ? args[text] : text;
  });
};

function createHTMLNode(htmlCode, tooltip) {
	// create html node
	let htmlNode = document.createElement('span');
	htmlNode.innerHTML = htmlCode;
	//htmlNode.className = 'treehtml';
	if (tooltip) {
		htmlNode.setAttribute('title', tooltip);
	}
	return htmlNode;
}

function syntaxHighlight(json, withCss=true, tag='pre', jsonClass='json') {
	let styleId = 'json-syntaxHighlight';
	if (withCss && !document.getElementById(styleId)) {
		const style = `
			<style id=${styleId}>
				${tag}.z${jsonClass} {outline: 1px solid #ccc; padding: 5px; margin: 5px; }
				${tag}.${jsonClass} .string { color: green; }
				${tag}.${jsonClass} .number { color: darkorange; }
				${tag}.${jsonClass} .boolean { color: blue; }
				${tag}.${jsonClass} .null { color: magenta; }
				${tag}.${jsonClass} .key { color: red; }
			</style>
			`;
		document.head.insertAdjacentHTML('beforeend', style);
	}
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
                match += ' ';
            } else {
                cls = 'string';
            }
            match = match
            	.replaceAll(',', '&comma;')
            	.replaceAll('\\n', '<br />')
            	.replaceAll('\\t', '&nbsp;&nbsp;')
            	;
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function stringify(arg, replacer, spacer, inPre, jsonClass='json') {
	let tag = inPre ? 'pre' : 'span';
	let json = syntaxHighlight(JSON.stringify(arg, replacer, spacer).replaceAll(/,\s*/g, ', '), true, tag);
	json = `<${tag} class="${jsonClass}">${json}</${tag}>`;
	return json;
}

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

function prepKeys(obj, query, label) {
	let ret = obj;
	if (false) warn(label);
	if (Array.isArray(obj)) {
		return obj;
	}
	let paramRe = /:[a-z_A-Z][a-z_A-Z0-9]*/g;
	if (typeof(obj) == 'object') {
		ret = {};
		for (let [key, val] of Object.entries(obj)) {
			ret[':' + key] = val;
		}
		let params = paramRe.exec(query);
		for (let param of params) {
			if (!(param in ret)) {
				throw new Error(`parameter ${param} not defined for ${label}`);
			}
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
		'order_info',
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
		'instrument_get',
		'instrument_set',
		'volume_at_price',
		'commission_calc',
		'commission_data',
		'commission_test',
		'insert_order_log',
		'select_order_log',
	];
	queries = {};
	 
	constructor(location, file_loader, db, tick_size=0.0001, verbose=false) {
		this.tickSize = tick_size
		this.rounder = 10**(Math.floor(Math.log10(1 / this.tickSize)));
		this.time = 0;
		this.nextQuoteID = 0;
		this.db = db;
		this.location = location;
		this.file_loader = file_loader;
		this.verbose = verbose;
		this.instrument_cache = {};
	}
	
	async init() {
		let result = new Promise((resolve, reject) => {
		let query_promises = [];
		for (let query of this.query_names) {
			let promise = this.file_loader(
				query, this.location + '/sql/' + query + '.sql');
			query_promises.push(promise);
		}
		let allDone = Promise.allSettled(query_promises);
		allDone.then(
			values => {
				for (let one of values) {
					if (one.status != 'fulfilled') {
						reject(`could not open {one.value[0]}`);
					}
					let [name, text] = one.value;
					this.queries[name] =
						'--<' + name +'>--\n' +
						text + '\n' +
						'--</' + name +'>--\n'
						;
				}
				this.queries.best_quotes_order_asc = 
					this.queries.best_quotes_order.replaceAll(':direction', 'asc');
				this.queries.best_quotes_order_desc = 
					this.queries.best_quotes_order.replaceAll(':direction', 'desc');
				this.queries.best_quotes_order_map = {
					desc: this.queries.best_quotes_order_desc,
					asc: this.queries.best_quotes_order_asc,
				};
				delete this.queries.best_quotes_order;
				resolve('init done');
			}
		);
		});
		return result;
	}
	
	printOrder (idNum, fmt, db) {
		let ret;
		(db || this.db).exec({
			sql: this.queries.find_order,
			bind: prepKeys(
				{idNum: idNum},
				this.queries.find_order),
			rowMode: 'object',
			callback: row => {
				ret = formats(fmt, row);
			}
		});
		return ret;
	}
	
	clipPrice(instrument, price, db) {
		// Clips the price according to the ticksize
		let rounder = this.getRounder(instrument, db);
		return Math.round(price * rounder) / rounder;
	}
	
	updateTime(timestamp) {
		if (timestamp <= this.time || timestamp === undefined) {
			timestamp = this.time + 1;
		}
		this.time = timestamp;
		return this.time;
	}
	
	createInstrument(symbol, currency) {
		this.db.exec({
			sql: this.queries.instrument_insert,
			bind: prepKeys({
				symbol: symbol,
				currency: currency,
			}, this.queries.instrument_insert)
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
					sql: this.queries.trader_insert,
					bind: prepKeys({
						tid: tid,
						name: name,
						currency: currency,
						commission_min: commission_min,
						commission_max_percnt: commission_max_percnt,
						commission_per_unit: commission_per_unit,
						allow_self_matching: allow_self_matching
					}, this.queries.trader_insert),
				});
				D.exec({
					sql: this.queries.lasttrader,
					rowMode: 'object',
					callback: res => {
						ret = res.lasttrader;
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
					sql: this.queries.trader_transfer,
					bind: prepKeys({
						trader: trader,
						instrument: instrument,
						amount: amount,
					}, this.queries.trader_transfer),
				});
			}
		);
	}
	
	traderBalance(instrument, amount, amount_promised, lastprice, value, liquidation) {
		//to be overriden
		/*if (this.verbose) {
			this.logobj({instrument, amount, amount_promised, lastprice, value, liquidation});
		}*/
	}
	
	traderGetBalance(trader, instrument) {
		// if !instrument, then all
		this.db.exec({
			sql: this.queries.trader_balance,
			bind: prepKeys({
				trader: trader,
				symbol: instrument,
			}, this.queries.trader_balance),
			rowMode: 'object',
			callback: row => {
				this.traderBalance(
					row.instrument,
					row.amount,
					row.amount_promised,
					row.lastprice,
					row.value,
					row.liquidation);
			}
		});
	}
	
	quoteNum(idNum) {
		if (!idNum) {
			this.nextQuoteID += 1;
			idNum = this.nextQuoteID;
		}
		return idNum;
	}
	
	createQuote(tid, instrument, side, qty, price=null) {
		let quote = {
			tid: tid,
			instrument: instrument,
			side: side, 
			qty: qty, 
			price: price,
			order_type: price ? 'limit' : 'market', 
			idNum: this.quoteNum(),
			timestamp: this.updateTime(),
		};
		return [quote.idNum, quote];
	}
	
	processOrder(quote, fromData, verbose=false, comment) {
		quote.timestamp = this.updateTime(quote.timestamp);
		if (!fromData) {
			quote.idNum = this.quoteNum();
		}
		if (!quote.instrument) {
			throw new Error(`processOrder(${quote.idNum}) no instrument given`);
		}
		if (quote.qty <= 0) {
			throw new Error(`processOrder(${quote.idNum}) given order of qty <= 0`);
		}
		if (!this.valid_types.includes(quote.order_type)) {
			throw new Error(`processOrder(${quote.idNum}) given ${quote.order_type}, not in ${this.valid_types}`);
		}
		if (!this.valid_sides.includes(quote.side)) {
			throw new Error(`processOrder(${quote.idNum}) given ${quote.side}, not in ${this.valid_sides}`);
		}
		
		let ret = null;
		this.db.transaction(
			D => {
				if (quote.price) {
					quote.price = this.clipPrice(quote.instrument, quote.price, D);
					this.setInstrument(
						quote.instrument, D, 'last'+quote.side, quote.price);
				}
				else {
					quote.price = null;
				}
				D.exec({
					sql: this.queries.insert_order,
					bind: prepKeys(
						quote, this.queries.insert_order),
				});
				D.exec({
					sql: this.queries.lastorder,
					rowMode: 'object',
					callback: res => {
						quote.order_id = res.lastorder;
						this.order_log(
							this.time, res.lastorder, 'create_order',
							this.printQuote(quote), D);
						/*this.order_log(
							this.time, res.lastorder, 'order_detail',
							this.printOrder(quote.idNum, 'id: {order_id}, promise_price: {promise_price}', D), D);
							*/
						this.orderBalance(
							quote.order_id, quote.order_id, quote.tid,
							quote.tid, quote.instrument, undefined, D);
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
	
	commissionCalc(trader, instrument, qty, db) {
		let ret = null;
		(db || this.db).exec({
			sql: this.queries.commission_calc, 
			bind: prepKeys({
				trader: trader,
				instrument: instrument,
				qty: qty,
				price: null,
			}, this.queries.commission_calc),
			rowMode: 'object',
			callback: row => {ret = row.commission}
		});
		return ret;
	}
	
	commissionData(trader, instrument, db) {
		let ret = null;
		(db || this.db).exec({
			sql: this.queries.commission_data, 
			bind: prepKeys({
				trader: trader,
				instrument: instrument,
			}, this.queries.commission_data),
			rowMode: 'object',
			callback: row => {
				ret = Object.assign({}, row);
			}
		});
		return ret;
	}
	
	processMatchesDB(quote, db, verbose) {
		let instrument = quote.instrument;
		quote.lastprice = this.getLastPrice(instrument, db);
		let qtyToExec = quote.qty;
		let sql_matches = this.queries.matches +
			this.queries.best_quotes_order_asc;
		
		let trades = [];
		let fulfills = [];
		let balance_updates = [];
		
		db.exec({
			sql: sql_matches, 
			bind: prepKeys({
				instrument: quote.instrument,
				side: quote.side,
				price: quote.price,
				lastprice: quote.lastprice,
				tid: quote.tid,
			}, sql_matches),
			rowMode: 'object',
			callback: match => {
				if (qtyToExec <= 0) {
					return;
				}
				let {order_id, counterparty, price, available, currency} = match;
				let bid_order = quote.side == 'bid' ? quote.order_id : order_id;
				let ask_order = quote.side == 'ask' ? quote.order_id : order_id;
				let qty = Math.min(available, qtyToExec);
				qtyToExec -= qty;
				let trade = this.tradeExecute(
					bid_order, ask_order, price, qty, instrument, db, verbose);
				trades.push(trade);
				db.exec({
					sql: this.queries.trade_fulfills, 
					bind: prepKeys({
						bid_order: bid_order,
						ask_order: ask_order,
					}, this.queries.trade_fulfills),
					rowMode: 'object',
					callback: row => {
						fulfills.push(row);
						this.order_log(
							this.time, row.order_id, 'fulfill_order',
							`<u>FULFILL</u> ${row.fulfilled} / ${row.qty} @${price}. fee: ${row.commission}`, db
						);
					}
				});
				balance_updates = this.orderBalance(
					quote.order_id, order_id, quote.tid, counterparty, instrument, currency, db);
			}
		});
		return [trades, fulfills, balance_updates];
	}
	
	orderBalance(order_id, counter_order, trader, counterparty, instrument, currency, db) {
		let balance_updates = [];
		if (!db) {
			db = this.db;
		}
		if (!currency) {
			currency = this.getCurrency(instrument, db);
		}
		db.exec({
			sql: this.queries.trade_balance,
			bind: prepKeys({
				trader: trader, 
				counterparty: counterparty,
				symbol: instrument,
				currency: currency
			}, this.queries.trade_balance),
			rowMode: 'object',
			callback: row => {
				balance_updates.push(row);
				this.order_log(
					this.time, row.trader == trader ? order_id : counter_order, 'balance_update',
					`<u>BALANCE_UPD</u> of ${row.instrument} amt:${formatRounder(row.amount)} promised:${formatRounder(row.amount_promised)}`, db
				);
			}
		});
		return balance_updates;
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
			sql: this.queries.insert_trade, 
			bind: prepKeys(
				trade, this.queries.insert_trade)
		});
		//this.order_log(this.time, ask_order, 'execute_order', `<u>SOLD</u> ${qty} @ ${price}`, db);
		//this.order_log(this.time, bid_order, 'execute_order', `<u>BOUGHT</u> ${qty} @ ${price}`, db);
		///this.setLastPrice(instrument, price, db);
		if (verbose) {
			log(`>>> TRADE \nt=${this.time} ${price} n=${qty} p1=${counterparty} p2=${quote.tid}`);
		}
		return trade;
	}
	
	matchesEvents(trades, fulfills, balance_updates, quote, comment) {
		if (comment) {
			this.order_log(quote.timestamp, quote.order_id, comment);
		}
		for (let trade of trades) {
		}
		for (let fulfill of fulfills) {
			this.orderFulfill(
				fulfill.idNum, fulfill.trader,
				fulfill.qty, fulfill.fulfilled,
				fulfill.commission,
				formatRounder(fulfill.fulfill_price / fulfill.qty));
		}
		for (let update of balance_updates) {
			if (update.instrument == quote.instrument) {
				// update position event
			}
			else {
				// update balance
			}
			if (false && this.verbose) {
				this.traderGetBalance(update.trader, update.instrument);
			}
			//error(JSON.stringify(update));
		}
	}
	
	orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice) {
		// to be overriden
	}
	
	cancelOrder(idNum, time, comment) {
		this.updateTime(time);
		
		this.db.transaction(
			D => {
				D.exec({
					sql: this.queries.find_order,
					bind: prepKeys(
						{idNum: idNum},
						this.queries.find_order),
					rowMode: 'object',
					callback: row => {
						let {order_id} = row;
						D.exec({
							sql: this.queries.cancel_order, 
							bind: prepKeys({
								cancel: 1, 
								order_id: order_id, 
							}, this.queries.cancel_order)
						});
						this.order_log(this.time, order_id, 'cancel_order', '<u>CANCEL ORDER</u>', D);
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

	orderGetSide(idNum, db) {
		let ret = null;
		(db || this.db).exec({
			sql: this.queries.find_order, 
			bind: prepKeys(
				{idNum: idNum},
				this.queries.find_order),
			rowMode: 'object',
			callback: row => {ret = row.side}
		});
		return ret;
	}

	modifyOrder(idNum, orderUpdate, time, verbose=false, comment) {
		orderUpdate.idNum = idNum;
		orderUpdate.timestamp = this.updateTime(time);

		let ret = null;
		this.db.transaction(
			D => {
				D.exec({
					sql: this.queries.find_order,
					bind: prepKeys(
						{idNum: idNum},
						this.queries.find_order),
					rowMode: 'object',
					callback: row => {
						let {side, instrument, price, qty, fulfilled, cancel, order_id, order_type, trader} = row;
						objectUpdate(orderUpdate, {
							order_type: order_type,
							order_id: order_id,
							instrument: instrument,
							side: side,
							tid: trader,
						});
						let loginfo = '<u>MODIFY</u>';
						if (orderUpdate.price) {
							let logprice = formatRounder(orderUpdate.price);
							loginfo += ` price: ${logprice};`;
							orderUpdate.price = this.clipPrice(instrument, orderUpdate.price, D);
							//this.setInstrument(
							//	instrument, D, 'last'+side, orderUpdate.price);
						}
						else {
							orderUpdate.price = price;
						}
						if (orderUpdate.qty) {
							loginfo += ` qty: ${orderUpdate.qty};`;
						}
						else {
							orderUpdate.qty = qty;
						}
						D.exec({
							sql: this.queries.modify_order,
							bind: prepKeys({
								price: orderUpdate.price,
								qty: orderUpdate.qty,
								timestamp: orderUpdate.timestamp,
								order_id: orderUpdate.order_id,
							}, this.queries.modify_order)
						});
						this.order_log(this.time, order_id, 'modify_order', `${loginfo}`, D);
						this.orderBalance(
							order_id, order_id, trader, trader,
							instrument, undefined, D);
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
	
	setInstrument(instrument, db, field, value) {
		let sql = this.queries.instrument_set
			.replaceAll(':field', field);
		let query = {
			sql: sql, 
			bind: prepKeys({
				instrument: instrument,
				value: value
			}, sql),
		};
		if (db === undefined) {
			this.db.transaction(
				D => {
					D.exec(query);
				}
			);
		}
		else {
			db.exec(query);
		}
		if (!(instrument in this.instrument_cache)) {
			this.instrument_cache[instrument] = {};
		}
		this.instrument_cache[instrument][field] = value;
	}
	
	setLastPrice(instrument, lastprice, db) {
		//this.logobj({instrument, lastprice, db})
		if (db) {
			let a= 1/0;
		}
		this.setInstrument(
			instrument, db, 'lastprice', lastprice);
	}
	
	setLastBid(instrument, lastbid, db) {
		this.setInstrument(
			instrument, db, 'lastbid', lastbid);
	}
	
	setLastAsk(instrument, lastask, db) {
		this.setInstrument(
			instrument, db, 'lastask', lastask);
	}
	
	getInstrument(instrument, db, force) {
		if (!this.instrument_cache[instrument] || force) {
			(db || this.db).exec({
				sql: this.queries.instrument_get, 
				bind: prepKeys({
					instrument: instrument
				}, this.queries.instrument_get),
				rowMode: 'object',
				callback: row => {
					row.rounder = 10**row.rounder;
					this.instrument_cache[instrument] = row;
				}
			});
		}
		return this.instrument_cache[instrument];
	}
	
	getRounder(instrument, db) {
		let cache = this.getInstrument(instrument, db);
		return (cache ? cache.rounder : null) || this.rounder;
	}
	
	getCurrency(instrument, db) {
		let cache = this.getInstrument(instrument, db);
		return cache ? cache.currency : null;
	}
	
	getLastPrice(instrument, db) {
		let cache = this.getInstrument(instrument, db);
		return cache ? cache.lastprice : null;
	}
	
	getLastBid(instrument, db) {
		let cache = this.getInstrument(instrument, db);
		return cache ? cache.lastbid : null;
	}
	
	getLastAsk(instrument, db) {
		let cache = this.getInstrument(instrument, db);
		return cache ? cache.lastask : null;
	}
	
	getVolumeAtPrice(instrument, side, price) {
		// how much can i buy / sell for this price 
		// should include all matching prices.
		let params = {
			instrument: instrument, 
			side: side, 
			price: this.clipPrice(instrument, price)
		};
		let ret = null;
		this.db.exec({
			sql: this.queries.volume_at_price, 
			bind: prepKeys(
				params, this.queries.volume_at_price),
			rowMode: 'object',
			callback: row => {
				ret = row.volume;
			}
		});
		return ret;
	}

	getPrice(instrument, side, direction='asc', forWhom=null) {
		let sql_active_orders = 
			this.queries.active_orders + 
			this.queries.best_quotes_order_map[direction] + 
			this.queries.limit1;
		let ret = null;
		this.db.exec({
			sql: sql_active_orders,
			bind: prepKeys({
				instrument: instrument, 
				side: side,
				forWhom: forWhom
			}, sql_active_orders),
			rowMode: 'object',
			callback: row => {ret = row.price || 'MKT'}
		});
		return ret;
	}
	
	getBestBid(instrument, forWhom=null) {
		return this.getPrice(instrument, 'bid', 'asc', forWhom);
	}
	getWorstBid(instrument, forWhom=null) {
		return this.getPrice(instrument, 'bid', 'desc', forWhom);
	}
	getBestAsk(instrument, forWhom=null) {
		return this.getPrice(instrument, 'ask', 'asc', forWhom);
	}
	getWorstAsk(instrument, forWhom=null) {
		return this.getPrice(instrument, 'ask', 'desc', forWhom);
	}
	
	order_log_filter(order_id, label, db) {
		let dolog = true;
		let data = null;
		db.exec({
			sql: this.queries.order_info, 
			bind: prepKeys({
				order_id: order_id,
			}, this.queries.order_info),
			rowMode: 'object',
			callback: row => {
				data = row;
			}
		});
		if (label == 'execute_order') {
			//dolog = false; //test
		}
		return [dolog, data];
	}
	
	dtFormat(value) {
		return value.toString();
	}
	
	order_log(event_dt, order_id, label, info, db) {
		let [dolog, data] = this.order_log_filter(order_id, label, db);
		if (!dolog) {
			return;
		}
		if (this.verbose) {
			log(`id:${data.idNum}(tid:${data.trader})@${this.dtFormat(event_dt)} => ${info}`);
		}
		db.exec({
			sql: this.queries.insert_order_log, 
			bind: prepKeys({
				event_dt: event_dt,
				order_id: order_id,
				label: label,
				info: info
			}, this.queries.insert_order_log)
		});
	}
	
	order_log_show(callback) {
		if (!callback) {
			callback = row => {
				this.logobj(row);
			};
		}
		this.db.exec({
			sql: this.queries.select_order_log,
			rowMode: 'object',
			callback: callback,
		});
	}
	
	logReplacer(key, value) {
		if (key === 'event_dt') {
			return this.dtFormat(value);
		}
		else if (key === 'info') {
			value = value.replace(/<.*?>/g, '');
		}
		else if (typeof value === "number") {
			value = formatRounder(value);
		}
		return value;
	}
	
	logobj(args) {
		//if (!Array.isArray(args)) {
			args = [args];
		//}
		log(args.map(arg => stringify(arg, this.logReplacer)));
	}
	
	printQuote(quote) {
		let action = quote.side.toUpperCase();
		let order_type = quote.order_type == 'limit' ? 'LMT' : 'MKT';
		let price = quote.order_type == 'limit' ? ' ' + formatRounder(quote.price) : '';
		let ret = `<u>${action}</u> ${quote.qty} ${quote.instrument} @${order_type}${price}`;
		return ret;
	}
	
	dump({instrument, forWhom, priceAsk, priceBid}) {
		function side_activeOrders(lob, side) {
			let sql_active_orders = 
				lob.queries.active_orders +
				lob.queries.best_quotes_order_asc;
			let rows = [];
			lob.db.exec({
				sql: sql_active_orders,
				bind: prepKeys({
					instrument: instrument,
					side: side,
					forWhom: forWhom
				}, sql_active_orders),
				rowMode: 'object',
				callback: row => {
					rows.push(row);
				},
			});
			return rows;
		}
		let obj = {
			instrument: instrument,
			forWhom: forWhom,
			priceAsk: priceAsk,
			priceBid: priceBid,
			bids: side_activeOrders(this, 'bid'),
			asks: side_activeOrders(this, 'ask'),
			volumeBid: this.getVolumeAtPrice(instrument, 'bid', priceAsk),
			volumeAsk: this.getVolumeAtPrice(instrument, 'ask', priceBid),
			bestBid: this.getBestBid(instrument),
			worstBid: this.getWorstBid(instrument),
			bestAsk: this.getBestAsk(instrument),
			worstAsk: this.getWorstAsk(instrument),
		};
		this.db.exec({
			sql: this.queries.commission_test, 
			rowMode: 'object',
			callback: commission => {
				obj.commission_balance = commission.commission_balance;
			}
		});
		return obj;
	}
	
	dumpCmp(
		{
			instrument,
			forWhom,
			priceAsk,
			priceBid,
			bids,
			asks,
			volumeBid,
			volumeAsk,
			bestBid,
			worstBid,
			bestAsk,
			worstAsk,
		}
	) {
		let ret = 0;
		let scalars = {
			volumeBid,
			volumeAsk,
			bestBid,
			worstBid,
			bestAsk,
			worstAsk,
		};
		let dumpParams = {
			instrument,
			forWhom,
			priceAsk,
			priceBid,
		};
		let dmp = this.dump(dumpParams);
		for (let [key, value] of Object.entries(scalars)) {
			ret = cmp(dmp[key], value);
			if (ret) {
				break;
			}
		}
		let quoteLists = {bids, asks};
		for (let [name, list] of Object.entries(quoteLists)) {
			if (ret) {
				break;
			}
			for (let ix in list) {
				ret = objCmp(dmp[name][ix], list[ix], Object.keys(list[ix]));
				if (ret) {
					break;
				}
			}
		}
		if (!ret) {
			log('cmp ok');
		}
		else {
			log(stringify(dmp));
		}
		return ret;
	}
	
	print(instrument, forWhom=null, priceAsk=98, priceBid=101) {
		let obj = this.dump({instrument, forWhom, priceAsk, priceBid});
		let fileStr = [];
		fileStr.push(`<b>limit order book for ${obj.instrument}</b>`);
		fileStr.push("------ Bids -------");
		for (let row of obj.bids) {
			let {idNum, trader, qty, fulfilled, price, event_dt, instrument} = row;
			fileStr.push(`${idNum} of ${trader})${qty}-${fulfilled} @ ${price} t=${event_dt}`);
		}
		fileStr.push("");
		fileStr.push("------ Asks -------");
		for (let row of obj.asks) {
			let {idNum, trader, qty, fulfilled, price, event_dt, instrument} = row;
			fileStr.push(`${idNum} of ${trader})${qty}-${fulfilled} @ ${price} t=${event_dt}`);
		}
		fileStr.push("");
		fileStr.push(`commission_balance: ${obj.commission_balance}`);
		fileStr.push("");
		
		fileStr.push(`volume bid if i ask ${obj.priceAsk}: ${obj.volumeBid}`);
		fileStr.push(`volume ask if i bid ${obj.priceBid}: ${obj.volumeAsk}`);
		fileStr.push(`best bid: ${obj.bestBid}`);
		fileStr.push(`worst bid: ${obj.worstBid}`);
		fileStr.push(`best ask: ${obj.bestAsk}`);
		fileStr.push(`worst ask: ${obj.worstAsk}`);
		
		fileStr.push("");
		
		let value = fileStr.join('\n');
		log(value);
		return obj;
	}
};
