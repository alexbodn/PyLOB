
'use strict';

function range(start, end, step=1) {
	if (typeof end === 'undefined') {
		end = start, start = 0;
	}
	let len = Math.round((end - start) / step);
	let arr = [];
	while ( len-- ) {
		arr[len] = start + (len * step);
	}
	return arr;
}

let strcmp = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'}).compare;

function cmp(a, b) {
	if (typeof a === 'string' || a instanceof String) {
		return strcmp(a, b);
	}
	if (a instanceof Array) {
		return arrayCmp(a, b);
	}
	if (a instanceof Object) {
		return objCmp(a, b);
	}
	// elegant: (a > b) - (a < b),
	if (a > b) return 1;
	if (a < b) return -1;
	return 0;
}

function objCmp(a, b, fields) {
	if (!fields) {
		fields = Object.keys(a);
	}
	for (let field of fields) {
		let ret = cmp(a[field], b[field]);
		if (ret !== 0) {
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
			if (ret !== 0) {
				return ret;
			}
		}
	}
	return ret;
}

let format10 = Math.pow(10, 10); // calc once
function formatRounder(number) {
	return Math.round(number * format10) / format10;
}

async function fetchText(name, url) {
	// to be called in a browser
	let ret = fetch(url)
		.then(
			reply => {
				return reply.text()
					.then(
						data => [name, data]
						);
			});
	return ret;
}

const init_queries = async (query_names, queries, thisLocation) => {
	let result = new Promise((resolve, reject) => {
		let query_promises = query_names.map(query => fetchText(
			query,
			new URL(`${query}.sql`, thisLocation)
		));
		let allDone = Promise.allSettled(query_promises);
		allDone.then(
			values => {
				for (let one of values) {
					if (one.status !== 'fulfilled') {
						reject(`could not open ${one.value[0]}`);
					}
					let [name, text] = one.value;
					queries[name] =
						`--<${name}>--
						${text}
						--</${name}>--
						`;
				}
				resolve('init_queries done');
			}
		);
	});
	return result;
}
	
const format = function () {
	let args = arguments;
	return args[0].replace(/{(\d+)}/g, function (match, number) {
		return typeof args[number + 1] !== "undefined" ? args[number + 1] : match;
	});
};

const formats = function (fmt, args) {
	return fmt.replace(/{([a-z_A-Z][a-z_A-Z0-9]*)}/g, function (match, text) {
		return typeof args[text] !== "undefined" ? args[text] : text;
	});
};

function syntaxHighlight(json, withCss=true, tag='pre', jsonClass='json') {
	if (typeof document === 'undefined') {
		return json;
	}
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

function stringify(arg, replacer, spacer, inPre, jsonClass='json', highlight=true) {
	let tag = inPre ? 'pre' : 'span';
	let json = JSON.stringify(arg, replacer, spacer);
	json = json.replace(/,\s*/g, ', ');
	if (highlight) {
		json = syntaxHighlight(json, true, tag);
	}
	json = `<${tag} class="${jsonClass}">${json}</${tag}>`;
	return json;
}

function logReplacer(key, value) {
	if (typeof value === "number") {
		value = formatRounder(value);
	}
	return value;
}

function logobj(...args) {
	log.apply(this, args.map(
		arg => (typeof arg === 'undefined') ? 'undefined' : stringify(arg, logReplacer)));
}

function objectUpdate(dest, src) {
	return Object.assign(dest, src);
}

function uncomment(text) {
	let commentRe = /(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(\/\/.*)|(--.*)/g;
	return text.replaceAll(commentRe, '');
}

function prepKeys(obj, query, label) {
	let ret = obj;
	if (false) warn(label);
	if (Array.isArray(obj)) {
		return obj;
	}
	let paramRe = /:[a-z_A-Z][a-z_A-Z0-9]*/g;
	if (typeof(obj) === 'object') {
		ret = {};
		let paramRe = /:([a-z_A-Z][a-z_A-Z0-9]*)/g;
		query = uncomment(query);
		let param;
		while ((param = paramRe.exec(query))) {
			let val = obj[param[1]];
			if (typeof(val) === 'undefined') {
				throw new Error(`parameter ${param[1]} not defined for ${label}.`);
			}
			ret[param[0]] = val;
		}
	}
	return ret;
}

class OrderBook {
	static valid_types = ['market', 'limit'];
	static valid_sides = ['ask', 'bid'];
	query_names = [
		'active_orders',
		'best_quotes',
		'best_quotes_order',
		'cancel_order',
		'find_order',
		'find_active_order',
		'check_active_order',
		'insert_order',
		'order_info',
		'trader_insert',
		'trader_transfer',
		'trader_balance',
		'trader_nlv',
		'lastorder',
		'lasttrader',
		'instrument_insert',
		'insert_trade',
		'limit1',
		'order_by_dt',
		'matches',
		'trade_balance',
		'balance_reset',
		'cash_reset',
		'cash_deposit',
		'fund_deposit',
		'modify_order',
		'trade_fulfills',
		'select_trades',
		'instrument_get',
		'instrument_set',
		'volume_at_price',
		'commission_calc',
		'commission_data',
		'modification_fee_test',
		'modification_fee_test2',
		'balance_test',
		'modifications_charge',
		'insert_order_log',
		'select_order_log',
		'orderbook',
	];
	queries = {};
	initialized = false;
	tickGap = 10;
	
	debug = false;
	order_log_filters = {};
	
	//@isAuthonomous will set last price by the executed orders
	constructor(oo, tick_size=0.0001, verbose=false, thisLocation, isAuthonomous=true, receiver) {
		this.tickSize = tick_size;
		this.decimalDigits = Math.log10(1 / this.tickSize);
		this.rounder = 1 / this.tickSize;
		this.time = 0;
		this.nextQuoteID = 0;
		this.receiver = receiver || new LOBReceiver();
		
		this.oo = oo;
		// isolation_level: null
		this.db = new oo.DB('file:orderbook?mode=memory', 'c');

		this.OrderBookLocation = thisLocation;
		this.verbose = verbose;
		this.isAuthonomous = isAuthonomous;
		this.instrument_cache = {};
	}
	
	async init() {
		let result = new Promise((resolve, reject) => {
			init_queries(this.query_names, this.queries, `${this.OrderBookLocation}sql/`)
			.then(() => this.db.exec(this.queries.orderbook))
			.then(() => {
				this.queries.best_quotes_order_asc =
					this.queries.best_quotes_order.replaceAll(':direction', 'asc');
				this.queries.best_quotes_order_desc =
					this.queries.best_quotes_order.replaceAll(':direction', 'desc');
				this.queries.best_quotes_order_map = {
					desc: this.queries.best_quotes_order_desc,
					asc: this.queries.best_quotes_order_asc,
				};
				delete this.queries.best_quotes_order;
				this.initialized = true;
				resolve('init done');
			})
		});
		return result;
	}
	
	isInitialized() {
		return this.initialized;
	}

	// rounder is 10**decimalDigits, for direct use in js
	setRounder(rounder) {
		this.decimalDigits = Math.log10(rounder);
		this.rounder = rounder;
		this.tickSize = 1 / this.rounder;
	}

	close() {
		this.db &&
		this.db.close();
	}
	
	printOrder (idNum, fmt, db) {
		let ret;
		(db || this.db).exec({
			sql: this.queries.find_order,
			bind: prepKeys(
				{idNum},
				this.queries.find_order),
			rowMode: 'object',
			callback: row => {
				ret = formats(fmt, row);
			}
		});
		return ret;
	}
	
	async findOrderReq(reqId, idNum) {
		let ret = await this.findOrder(idNum);
		this.receiver.findOrderResp(reqId, ret);
	}
	
	async findOrder(idNum, db) {
		let found = await (db || this.db).exec({
			sql: this.queries.find_order,
			bind: prepKeys(
				{idNum},
				this.queries.find_order),
			rowMode: 'object',
		});
		return found && found.length ? found[0] : null;
	}
	
	async clipPrice(instrument, price, db) {
		// Clips the price according to the ticksize
		let rounder = await this.getRounder(instrument, db);
		return Math.round(price * rounder) / rounder;
	}
	
	updateTime(timestamp) {
		// ensure unique timestamps
		if (!timestamp || timestamp <= this.time) {
			timestamp = this.time + 1;
		}
		this.time = timestamp;
	//console.log('o', timestamp);
	//console.trace();
		return timestamp;
	}
	
	getTime() {
		return this.time;
	}
	
	createInstrumentReq(reqId, ...args) {
		this.createInstrument(...args);
		return this.receiver.createInstrumentResp(reqId);
	}
	
	createInstrument(symbol, currency, {modification_fee=0, execution_credit=0}={}) {
		this.db.exec({
			sql: this.queries.instrument_insert,
			bind: prepKeys({
				symbol,
				currency,
				modification_fee,
				execution_credit,
			}, this.queries.instrument_insert)
		});
	}
	
	createTraderReq(reqId, ...args) {
		this.createTrader(...args)
		.then(tid => {this.receiver.createTraderResp(reqId, tid);});
	}
	
	async createTrader(name, tid, currency, commission_data, allow_self_matching=0) {
		let ret = null;
		let {commission_per_unit, commission_min, commission_max_percnt} = commission_data;
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
		return Promise.resolve(ret);
	}
	
	async traderCashWithdraw(trader, currency, amount) {
		return this.traderCashDeposit(trader, currency, -amount);
	}
	
	async traderCashDeposit(trader, currency, amount) {
		this.db.transaction(
			D => {
				D.exec({
					sql: this.queries.cash_deposit,
					bind: prepKeys({
						trader: trader,
						currency: currency,
						amount: amount,
					}, this.queries.cash_deposit),
				});
			}
		);
		return Promise.resolve();
	}
	
	async traderFundWithdraw(trader, instrument, amount) {
		return this.traderFundsDeposit(trader, instrument, -amount);
	}
	
	async traderFundsDeposit(trader, instrument, amount) {
		// transfer amount from cash to fund or viceversa
		this.db.transaction(
			D => {
				D.exec({
					sql: this.queries.cash_deposit,
					bind: prepKeys({
						trader: trader,
						currency: instrument,
						amount: -(amount),
					}, this.queries.cash_deposit),
				});
				D.exec({
					sql: this.queries.fund_deposit,
					bind: prepKeys({
						trader: trader,
						instrument: instrument,
						amount: amount,
					}, this.queries.fund_deposit),
				});
			}
		);
		return Promise.resolve();
	}
	
	traderBalance(...args) { //to be overridden
		/*if (this.verbose) {
			this.logobj({instrument, amount, lastprice, value, liquidation});
		}*/
	}
	
	traderGetBalance(trader, instrument, extra) {
		return this.traderGetBalanceReq(null, trader, instrument, extra);
	}
	
	traderGetBalanceReq(reqId, trader, instrument, extra) {
		// if !instrument, then all
		const traderBalance =
			(ob, info) => {ob.traderBalance(extra, info);};
		this.db.exec({
			sql: this.queries.trader_balance,
			bind: prepKeys({
				trader: trader,
				symbol: instrument || null,
			}, this.queries.trader_balance),
			rowMode: 'object',
			callback: row => {
				let info = {...row, time: this.getTime()};
				if (!reqId) {
					/*setTimeout(
						traderBalance,
						this.tickGap,
						this, info,
					);*/
					queueMicrotask(() => {traderBalance(this, info);});
				}
				else {
					ob.receiver.traderBalanceResp(reqId, info);
				}
			}
		});
	}
	
	traderNLV(...args) {
		/*if (this.verbose) {
			this.logobj({trader, nlv});
		}*/
	}
	
	traderGetNLV(trader, extra) {
		return this.traderGetNLVReq(null, trader, extra);
	}
	
	traderGetNLVReq(reqId, trader, extra) {
		const traderNLV =
			(ob, info) => {ob.traderNLV(extra, info);};
		this.db.exec({
			sql: this.queries.trader_nlv,
			bind: prepKeys({
				trader: trader,
			}, this.queries.trader_nlv),
			rowMode: 'object',
			callback: row => {
				let info = {...row, time: this.getTime()};
				if (!reqId) {
					/*setTimeout(
						traderNLV,
						this.tickGap,
						this, info,
					);*/
					queueMicrotask(() => {traderNLV(this, info);});
				}
				else {
					ob.receiver.traderNLVResp(reqId, info);
				}
			}
		});
	}
	
	async traderFundsReset(trader, instrument) {
		this.db.transaction(
			D => {
				D.exec({
					sql: this.queries.balance_reset,
					bind: prepKeys({
						trader: trader,
						instrument: instrument,
					}, this.queries.balance_reset),
				});
			}
		);
		return Promise.resolve();
	}
	
	async traderCashReset(trader, currency) {
		this.db.transaction(
			D => {
				D.exec({
					sql: this.queries.cash_reset,
					bind: prepKeys({
						trader: trader,
						currency: currency,
					}, this.queries.cash_reset),
				});
			}
		);
		return Promise.resolve();
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
		return quote;
	}
	
	async processOrder(quote, fromData, verbose=false, isPrivate=false, {comment=null}={}) {
		//todo implement condition as event, and fire at event
		quote = {
			...quote,
			timestamp: this.updateTime(quote.timestamp),
		};
		if (!fromData) {
			quote.idNum = this.quoteNum();
		}
		if (!quote.instrument) {
			throw new Error(`processOrder(${quote.idNum}) no instrument given`);
		}
		if (quote.qty <= 0) {
			throw new Error(`processOrder(${quote.idNum}) given order of qty <= 0`);
		}
		if (!this.constructor.valid_types.includes(quote.order_type)) {
			throw new Error(`processOrder(${quote.idNum}) given ${quote.order_type}, not in ${this.constructor.valid_types}`);
		}
		if (!this.constructor.valid_sides.includes(quote.side)) {
			throw new Error(`processOrder(${quote.idNum}) given ${quote.side}, not in ${this.constructor.valid_sides}`);
		}
		
		let matches = [];
		await this.db.transaction(
			async D => {
				if (quote.price) {
					quote.price = await this.clipPrice(quote.instrument, quote.price, D);
				}
				else {
					quote.price = null;
				}
				await D.exec({
					sql: this.queries.insert_order,
					bind: prepKeys(
						quote, this.queries.insert_order),
				});
				let last = await D.exec({
					sql: this.queries.lastorder,
					rowMode: 'object',
				});
				for (let res of last) {
					quote.order_id = res.lastorder;
					let sQuote = await this.printQuote(quote, D);
					await this.order_log(
						this.time, res.lastorder, 'create_order',
						sQuote, D);
					/*await this.order_log(
						this.time, res.lastorder, 'order_detail',
						this.printOrder(quote.idNum, 'id: {order_id}', D), D);
						*/
					await this.orderBalance(
						quote.order_id, quote.order_id, quote.tid,
						quote.tid, quote.instrument, undefined, D);
					let processed = await this.processMatches(quote, false, D, verbose);
					matches.push(...processed);
				}
			}
		);
		if (quote.price && !isPrivate) {
			this.setInstrument(
				quote.instrument, this.db, 'last'+quote.side, quote.price);
		}
		queueMicrotask(() => {
			this.orderSent(
				quote.idNum,
				Object.assign({status: 'sent'}, quote)
			);
		});
		if (matches.some(match => match.length > 0)) {
			this.matchesEvents(...matches, quote, comment);
			return [matches[0], quote];
		}
		return [[], quote];
	}
	
	commissionCalc(trader, qty, price, currency, db) {
		let ret = null;
		(db || this.db).exec({
			sql: this.queries.commission_calc,
			bind: prepKeys({
				trader: trader,
				qty: qty,
				price: price || null,
				currency: currency || null,
			}, this.queries.commission_calc),
			rowMode: 'object',
			callback: row => {ret = row.commission}
		});
		return ret;
	}
	
	commissionData(trader, currency, db) {
		let ret = null;
		(db || this.db).exec({
			sql: this.queries.commission_data,
			bind: prepKeys({
				trader: trader,
				currency: currency || null,
			}, this.queries.commission_data),
			rowMode: 'object',
			callback: row => {
				ret = {...row};
			}
		});
		return ret;
	}
	
	async processMatches(quote, justquery, db, verbose) {
		let instrument = quote.instrument;
		quote.lastprice = this.getLastPrice(instrument, db);
		let qtyToExec = quote.qty;
		let sql_matches = this.queries.matches +
			this.queries.best_quotes_order_asc;
		
		let trades = [];
		let fulfills = [];
		let balance_updates = [];
		let totalprice = 0;
		
		if (!justquery) {
			let active = await db.exec({
				sql: this.queries.check_active_order,
				bind: prepKeys(
					{order_id: quote.order_id},
					this.queries.check_active_order),
				rowMode: 'object',
			});
			if (!active.length) {
				return [];
			}
		}
		let matches = await db.exec({
			sql: sql_matches,
			bind: prepKeys({
				instrument: quote.instrument,
				side: quote.side,
				price: quote.price,
				lastprice: quote.lastprice,
				tid: quote.tid,
			}, sql_matches),
			rowMode: 'object',
		});
		for (let match of matches) {
			if (this.debug) {
				this.logobj(qtyToExec, match.available, match);
			}
			if (qtyToExec <= 0) {
				//stop the loop
				break;
			}
			let {order_id, idNum, counterparty, price, available, currency} = match;
			let qty = Math.min(available, qtyToExec);
			qtyToExec -= qty;
			if (justquery) {
				totalprice += qty * price;
				continue;
			}
			let bid_quote = quote.side == 'bid';
			let bid_order = bid_quote ? quote.order_id : order_id;
			let ask_order = bid_quote ? order_id : quote.order_id;
			let trade = await this.tradeExecute(
				bid_order, ask_order, price, qty, instrument, db, verbose);
			trade.bid_trader = bid_quote ? quote.tid : counterparty;
			trade.ask_trader = bid_quote ? counterparty : quote.tid;
			trade.bid_idNum = bid_quote ? quote.idNum : idNum;
			trade.ask_idNum = bid_quote ? idNum : quote.idNum;
			trades.push(trade);
			let trade_fulfills = await db.exec({
				sql: this.queries.trade_fulfills,
				bind: prepKeys({
					bid_order,
					ask_order,
				}, this.queries.trade_fulfills),
				rowMode: 'object',
			});
			for (let row of trade_fulfills) {
				fulfills.push(row);
				let color = row.side == 'ask' ? 'red' : 'mediumblue';
				await this.order_log(
					this.time, row.order_id, 'fulfill_order',
					`<u style="color: ${color}">FULFILL</u> ${row.fulfilled} / ${row.qty} @${price}. fee: ${row.commission}`, db
				);
			}
			let trade_balance_updates = await this.orderBalance(
				quote.order_id, order_id, quote.tid, counterparty, instrument, currency, db);
			balance_updates.push(...trade_balance_updates);
		}
		if (justquery) {
			let volume = quote.qty - qtyToExec;
			return [volume, totalprice];
		}
		return [trades, fulfills, balance_updates];
	}
	
	async orderBalance(order_id, counter_order, trader, counterparty, instrument, currency, db) {
		if (!db) {
			db = this.db;
		}
		if (!currency) {
			currency = this.getCurrency(instrument, db);
		}
		let balance_updates = await db.exec({
			sql: this.queries.trade_balance,
			bind: prepKeys({
				trader: trader,
				counterparty: counterparty,
				symbol: instrument,
				currency: currency
			}, this.queries.trade_balance),
			rowMode: 'object',
		});
		for (let row of balance_updates) {
			await this.order_log(
				this.time, row.trader == trader ? order_id : counter_order, 'balance_update',
				`<u>BALANCE</u> of ${row.instrument} amt:${formatRounder(row.amount)}`, db
			);
		}
		return balance_updates;
	}
	
	async tradeExecute(bid_order, ask_order, price, qty, instrument, db, verbose) {
		let trade = {
			bid_order: bid_order,
			ask_order: ask_order,
			time: this.getTime(),
			price: price,
			qty: qty
		};
		await db.exec({
			sql: this.queries.insert_trade,
			bind: prepKeys(
				trade, this.queries.insert_trade)
		});
		//await this.order_log(this.time, ask_order, 'execute_order', `<u>SOLD</u> ${qty} @ ${price}`, db);
		//await this.order_log(this.time, bid_order, 'execute_order', `<u>BOUGHT</u> ${qty} @ ${price}`, db);
		if (this.isAuthonomous) {
			this.setLastPrice(instrument, price, this.getTime(), db);
		}
		if (verbose) {
			log(`>>> TRADE \nt=${this.getTime()} ${price} n=${qty} p1=${counterparty} p2=${quote.tid}`);
		}
		return trade;
	}
	
	async matchesEvents(trades, fulfills, balance_updates, quote, comment) {
		if (comment) {
			await this.order_log(quote.timestamp, quote.order_id, comment);
		}
		queueMicrotask(() => {
		for (let trade of trades) {
			this.orderExecuted(trade.ask_idNum, trade.ask_trader, trade.time, trade.qty, trade.price);
			this.orderExecuted(trade.bid_idNum, trade.bid_trader, trade.time, trade.qty, trade.price);
		}
		for (let fulfill of fulfills) {
			this.orderFulfill(
				fulfill.idNum, fulfill.trader,
				fulfill.qty, fulfill.fulfilled,
				fulfill.commission,
				//this.clipPrice(currency, price)
				formatRounder(fulfill.fulfill_price / fulfill.fulfilled));
		}
		for (let update of balance_updates) {
			if (update.instrument == quote.instrument) {
				// update position event
			}
			else {
				// update balance
			}
			//todo: that's probably the way to go
//			if (false && this.verbose) {
				this.traderGetBalance(update.trader, update.instrument);
//			}
			//error(JSON.stringify(update));
		}
		});
	}
	
	/*
	def openOrder(self, orderId: OrderId, contract: Contract, order: Order, orderState: OrderState):
		print(f"openOrder. orderId: {orderId}, contract: {contract}, order: {order}")
	*/
	//openOrder on IB
	//todo should provide order_id
	orderSent(idNum, quote) {
		return this.receiver.orderSent(idNum, quote);
	}
	
	/*
	def orderStatus(self, orderId: OrderId, status: str, filled: Decimal, remaining: Decimal, avgFillPrice: float, permId: int, parentId: int, lastFillPrice: float, clientId: int, whyHeld: str, mktCapPrice: float):
		print(f"orderId: {orderId}, status: {status}, filled: {filled}, remaining: {remaining}, avgFillPrice: {avgFillPrice}, permId: {permId}, parentId: {parentId}, lastFillPrice: {lastFillPrice}, clientId: {clientId}, whyHeld: {whyHeld}, mktCapPrice: {mktCapPrice}")
	*/
	orderRejected(idNum, why) {
		return this.receiver.orderRejected(idNum, why);
	}
	
	//the following two may be orderStatus/completedOrder on IB
	orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice) {
		this.receiver.orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice);
	}
	
	orderExecuted(idNum, trader, time, qty, price) {
		this.receiver.orderExecuted(idNum, trader, time, qty, price);
	}
	
	async cancelOrder(idNum, time, {comment=null}={}) {
		time = this.updateTime(time);
		let _trader = null;
		await this.db.transaction(
			async D => {
				let active = await D.exec({
					sql: this.queries.find_active_order,
					bind: prepKeys(
						{idNum},
						this.queries.find_active_order),
					rowMode: 'object',
				});
				for (let row of active) {
					let {order_id, trader} = row;
					D.exec({
						sql: this.queries.cancel_order,
						bind: prepKeys({
							order_id,
							cancel: 1,
						}, this.queries.cancel_order)
					});
					_trader = trader;
					await this.order_log(time, order_id, 'cancel_order', '<u>CANCEL</u> <s>@@order@@</s>', D);
				}
			}
		);
		if (_trader) {
			queueMicrotask(() => {
				this.orderCancelled(idNum, _trader, time);
			});
		}
	}

	orderCancelled(idNum, trader, time) {
		return this.receiver.orderCancelled(idNum, trader, this.time);
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

	orderGetSideReq(reqId, idNum) {
		let side = this.orderGetSide(idNum);
		this.receiver.orderGetSideResp(reqId, side);
	}
	
	orderGetSide(idNum, db) {
		let side = null;
		(db || this.db).exec({
			sql: this.queries.find_order,
			bind: prepKeys(
				{idNum},
				this.queries.find_order),
			rowMode: 'object',
			callback: row => {side = row.side}
		});
		return side;
	}

	async modifyOrder(idNum, orderUpdate, time, verbose=false, isPrivate=false, {comment=null}={}) {
		let matches = [];
		let updateSide, updatePrice;
		await this.db.transaction(
			async D => {
				let active = await D.exec({
					sql: this.queries.find_active_order,
					bind: prepKeys(
						{idNum},
						this.queries.find_active_order),
					rowMode: 'object',
				});
				for (let row of active) {
					let {side, instrument, price, qty, fulfilled, cancel, order_id, order_type, trader} = row;
					updateSide = side;
					orderUpdate = {
						...orderUpdate,
						idNum,
						timestamp: this.updateTime(time),
						order_type,
						order_id,
						instrument,
						side,
						tid: trader,
					};
					let loginfo = '<u>MODIFY</u>';
					if (orderUpdate.price) {
						let logprice = formatRounder(orderUpdate.price);
						loginfo += ` price: ${logprice};`;
						updatePrice = orderUpdate.price = await this.clipPrice(
							instrument, orderUpdate.price, D);
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
					await D.exec({
						sql: this.queries.modify_order,
						bind: prepKeys(
							orderUpdate,
							this.queries.modify_order)
					});
					let sQuote = await this.printQuote(orderUpdate, D);
					await this.order_log(this.time, order_id, 'modify_order', sQuote, D);
					await this.order_log(this.time, order_id, 'modify_detail', `${loginfo}`, D);
					if (this.betterPrice(side, price, orderUpdate.price)) {
						let processed = await this.processMatches(orderUpdate, false, D, verbose);
						matches.push(...processed);
					}
				}
			}
		);
		if (updatePrice && !isPrivate) {
			this.setInstrument(
				orderUpdate.instrument, this.db, 'last'+updateSide, updatePrice);
		}
		if (updateSide) {
			queueMicrotask(() => {
				this.orderSent(idNum, orderUpdate);
			});
			if (matches.some(match => match.length > 0)) {
				//console.log('modified', orderUpdate);
				this.matchesEvents(...matches, orderUpdate, comment);
				return [matches[0], orderUpdate];
			}
		}
		else {
			this.orderRejected(idNum, 'tryed to modify inactive order');
		}
		return [[], orderUpdate];
	}
	
	modificationsCharge() {
		//todo test again
		this.db.transaction(
			D => {
				D.exec({
					sql: this.queries.modifications_charge,
					bind: prepKeys(
						{},
						this.queries.modifications_charge),
				});
			}
		);
	}
	
	//@todo: trigger instrument price event
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
		if (typeof db === 'undefined') {
			this.db.transaction(
				D => {
					D.exec(query);
				}
			);
		}
		else {
			db.exec(query);
		}
//console.log(instrument, this.instrument_cache[instrument]);
		if (!(instrument in this.instrument_cache)) {
			this.instrument_cache[instrument] = {};
			this.getInstrument(instrument, db, true);
		}
		this.instrument_cache[instrument][field] = value;
		if (this.isAuthonomous && value && ['lastask', 'lastbid'].includes(field)) {
			let other = field === 'lastask' ?
				this.getLastBid(instrument, db) : this.getLastAsk(instrument, db);
			if (other) {
				let midPoint = (value + other) / 2;
				if (midPoint != this.instrument_cache[instrument].midpoint) {
					this.instrument_cache[instrument].midpoint = midPoint
					this.tickMidPoint(instrument, midPoint, this.time);
				}
			}
		}
	}
	
	tickMidPoint(instrument, midPoint, time) {
		return this.receiver.tickMidPoint(instrument, midPoint, time);
	}
	
	setLastPrice(instrument, lastprice, time, db) {
		time = this.updateTime(time);
		this.setInstrument(instrument, db, 'lastprice', lastprice);
		return this.tickLastPrice(instrument, lastprice, time);
	}
	
	tickLastPrice(instrument, lastprice, time) {
		return this.receiver.tickLastPrice(instrument, lastprice, time);
	}
	
	setLastBid(instrument, lastbid, db) {
		this.setInstrument(instrument, db, 'lastbid', lastbid);
		return this.tickLastBid(instrument, lastbid, this.time);
	}
	
	tickLastBid(instrument, lastbid, time) {
		return this.receiver.tickLastBid(instrument, lastbid, time);
	}
	
	setLastAsk(instrument, lastask, db) {
		this.setInstrument(instrument, db, 'lastask', lastask);
		return this.tickLastAsk(instrument, lastask, this.time);
	}
	
	tickLastAsk(instrument, lastask, time) {
		return this.receiver.tickLastAsk(instrument, lastask, time);
	}
	
	getInstrument(instrument, db, force) {
		if (!(instrument in this.instrument_cache) || force) {
			(db || this.db).exec({
				sql: this.queries.instrument_get,
				bind: prepKeys({
					instrument: instrument
				}, this.queries.instrument_get),
				rowMode: 'object',
				callback: row => {
					row.rounder = Math.pow(10, row.rounder);
					this.instrument_cache[instrument] = row;
				}
			});
		}
		return this.instrument_cache[instrument];
	}
	
	getRounderReq(reqId, instrument) {
		this.getRounder(instrument)
		.then(rounder => {this.receiver.getRounderResp(reqId, rounder);});
	}
	
	async getRounder(instrument, db) {
		let cache = this.getInstrument(instrument, db);
		let rounder = (cache ? cache.rounder : null) || this.rounder;
		return Promise.resolve(rounder);
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
	
	getMidPoint(instrument, db) {
		let cache = this.getInstrument(instrument, db);
		return cache ? cache.midpoint : null;
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
	
	async getLiquidationPrice(instrument, side, qty, forWhom) {
		let quote = this.createQuote(forWhom, instrument, side, qty);
		return await this.processMatches(quote, true, this.db);
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
	
	dtFormat(value, fmt) {
		return value.toString();
	}
	
	order_log_addFilter(field, value) {
		this.order_log_filters[field] = value;
	}
	
	async order_log(event_dt, order_id, label, info, db) {
		let [dolog, data] = this.order_log_filter(order_id, label, db);
		for (let [field, value] of Object.entries(this.order_log_filters)) {
			if (field in data && data[field] != this.order_log_filters[field]) {
				return;
			}
		}
		if (!dolog) {
			return;
		}
		if (this.verbose) {
			let order = await this.printQuote(data, db);
			info = info.replace('@@order@@', order);
			log(`id:${data.idNum}${data.order_label ? '/' + data.order_label : ''}(tid:${data.trader})@${this.dtFormat(event_dt)} => ${info}`);
		}
		await db.exec({
			sql: this.queries.insert_order_log,
			bind: prepKeys({
				event_dt,
				order_id,
				label,
				info
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
	
	sql(query, params={}) {
		let ret = [];
		this.db.exec({
			sql: query,
			bind: prepKeys(
				params,
				query),
			rowMode: 'object',
			callback: row => {
				ret.push(row);
			}
		});
		return ret;
	}
	
	logobj(...args) {
		return this.receiver.logobj(...args);
		/*
		log.apply(this, args.map(
			arg => arg == undefined ? 'undefined' : stringify(arg, this.logReplacer)));
		*/
	}
	
	async printQuote(quote, db) {
		let side = quote.side.toUpperCase();
		let price = await this.clipPrice(quote.instrument, quote.price, db);
		price = (quote.order_type == 'limit' && price) ? `LMT ${price}` : 'MKT';
		let ret = `<u>${side}</u> ${quote.qty} ${quote.instrument} @${price}`;
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
		obj.balance_test = this.sql(
			this.queries.balance_test,
			{instrument});
		obj.fee = this.sql(
			this.queries.modification_fee_test,
			{instrument});
		obj.fee2 = this.sql(
			this.queries.modification_fee_test2,
			{instrument});
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
			balance_test,
			fee,
			fee2,
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
		let lists = {bids, asks, balance_test, fee, fee2};
		for (let [name, list] of Object.entries(lists)) {
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
		
		fileStr.push(`volume bid if i ask ${obj.priceAsk}: ${obj.volumeBid}`);
		fileStr.push(`volume ask if i bid ${obj.priceBid}: ${obj.volumeAsk}`);
		fileStr.push(`best bid: ${obj.bestBid}`);
		fileStr.push(`worst bid: ${obj.worstBid}`);
		fileStr.push(`best ask: ${obj.bestAsk}`);
		fileStr.push(`worst ask: ${obj.worstAsk}`);
		
		fileStr.push("");
		
		let value = fileStr.join('\n');
		log(value);
		
		if (obj.fee.length) {
			console.log('modification fees');
			console.table(obj.fee);
		}
		
		if (obj.fee2.length) {
			console.log('modification fees2');
			console.table(obj.fee2);
		}
		
		return obj;
	}
	
	printBalance(trader, symbol) {
		let ret = [];
		this.db.exec({
			sql: this.queries.trader_balance,
			bind: prepKeys({
				trader: trader || null,
				symbol: symbol || null,
			}, this.queries.trader_balance),
			rowMode: 'object',
			callback: row => {
				ret.push(row);
			}
		});
		console.table(ret);
	}
	
	setDebug(value=true) {
		this.debug = value;
	}
};

/*
export {
  OrderBook
};
*/

class LOBReceiver extends WorkerReceiver {
	constructor({defaultCallback=null, receipts={}, defaultForwarder=null, forwards={}}={}) {
		super({
			defaultCallback,
			receipts: Object.assign({}, {
				traderBalanceResp: 'traderBalance',
				traderNLVResp: 'traderNLV',
				findOrderResp: null,
				quoteGetAllResp: null,
				orderGetSideResp: null,
				createInstrumentResp: null,
				createTraderResp: null,
				getRounderResp: null,
				traderCashDepositResp: null,
				traderFundsDepositResp: null,
				traderCashResetResp: null,
				traderFundsResetResp: null,
			}, receipts),
			defaultForwarder,
			forwards
		});
	}
	traderBalance(extra, {trader, instrument, amount, lastprice, value, liquidation, time}) {}
	traderNLV(extra, {trader, nlv}) {}
	orderSent(idNum, quote) {}
	orderRejected(idNum, why) {}
	orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice) {}
	orderExecuted(idNum, trader, time, qty, price) {}
	orderCancelled(idNum, trader, time) {}
	tickMidPoint(instrument, midPoint, time) {}
	tickLastPrice(instrument, lastprice, time) {}
	tickLastBid(instrument, lastbid, time) {}
	tickLastAsk(instrument, lastask, time) {}
	doUpdateTime(timestamp) {}
	logobj(...args) {logobj(...args);}
};

class LOBForwarder extends WorkerReceiver {
	constructor({defaultCallback=null, receipts={}, defaultForwarder=null, forwards={}}={}) {
		super({
			defaultForwarder,
			forwards: Object.assign({}, {
				findOrderResp: null,
				orderGetSideResp: null,
				traderBalanceResp: null,
				traderNLVResp: null,
				createInstrumentResp: null,
				createTraderResp: null,
				getRounderResp: null,
				traderBalance: null,
				traderNLV: null,
				orderSent: null,
				orderRejected: null,
				orderFulfill: null,
				orderExecuted: null,
				orderCancelled: null,
				tickMidPoint: null,
				tickLastPrice: null,
				tickLastBid: null,
				tickLastAsk: null,
				doUpdateTime: null,
				logobj: null,
			}, forwards),
			defaultCallback,
			receipts,
		});
		this.filters = {};
	}
	addFilter(field, value) {
		this.filters[field] = value;
	}
};

class LOBClient extends WorkerClient {
	constructor(worker_url, receiver, {destinations}) {
		const myDestinations = {
			setRounder: destinationTypes.REGULAR,
			close: destinationTypes.REGULAR,
			doUpdateTime: destinationTypes.REGULAR,
			getTime: destinationTypes.REGULAR,
			
			createInstrument: destinationTypes.REGISTERED,
			createTrader: destinationTypes.REGISTERED,
			
			traderCashDeposit: destinationTypes.REGISTERED,
			traderFundsDeposit: destinationTypes.REGISTERED,
			traderCashReset: destinationTypes.REGISTERED,
			traderFundsReset: destinationTypes.REGISTERED,
			
			traderGetBalance: destinationTypes.REGISTERED_EXTRA,
			traderGetNLV: destinationTypes.REGISTERED_EXTRA,
			findOrder: destinationTypes.REGISTERED,
			orderGetSide: destinationTypes.REGISTERED,
			createQuote: destinationTypes.REGULAR,
			processOrder: destinationTypes.REGULAR,
			cancelOrder: destinationTypes.REGULAR,
			modifyOrder: destinationTypes.REGULAR,
			modificationsCharge: destinationTypes.REGULAR,
			setLastPrice: destinationTypes.REGULAR,
			getRounder: destinationTypes.REGISTERED,
			order_log_filter: destinationTypes.REGULAR,
			order_log_show: destinationTypes.REGULAR,
		};
		super(worker_url, receiver, {
			destinations: Object.assign({}, myDestinations, destinations)
		});
	}
	/*
	async init() {return super.init();}
	setRounder(rounder) {return this.sendQuery('setRounder', rounder);}
	close() {return this.sendQuery('close');}
	doUpdateTime(timestamp) {return this.sendQuery('doUpdateTime', timestamp);}
	getTime() {return this.sendQuery('getTime');}
	async createInstrument(symbol, currency, {modification_fee=0, execution_credit=0}={}) {
		return this.sendRegistered(
			'createInstrumentReq', null, symbol, currency, {modification_fee, execution_credit});
	}
	async createTrader(name, tid, currency, commission_data, allow_self_matching=0) {
		return this.sendRegistered(
			'createTraderReq', null, name, tid, currency, commission_data, allow_self_matching);
	}
	traderCashDeposit(trader, currency, amount) {
		return this.sendQuery('traderCashDeposit', trader, currency, amount);
	}
	traderFundsDeposit(trader, instrument, amount) {
		return this.sendQuery('traderFundsDeposit', trader, instrument, amount);
	}
	traderFundsReset(trader, instrument) {
		return this.sendQuery('traderFundsReset', trader, instrument);
	}
	traderCashReset(trader, currency) {
		return this.sendQuery('traderCashReset', trader, currency);
	}
	async traderGetBalance(trader, instrument, extra) {
		return this.sendRegistered('traderGetBalanceReq', extra, trader, instrument);
	}
	async traderGetNLV(trader, extra) {
		return this.sendRegistered('traderGetNLVReq', extra, trader);
	}
	async findOrder(idNum) {
		return this.sendRegistered('findOrderReq', null, idNum);
	}
	async orderGetSide(idNum) {
		return this.sendRegistered('orderGetSideReq', null, idNum);
	}
	createQuote(tid, instrument, side, qty, price=null) {
		return this.sendQuery('createQuote', tid, instrument, side, qty, price);
	}
	processOrder(quote, fromData, verbose=false, isPrivate=false, {comment=null}={}) {
		return this.sendQuery('processOrder', quote, fromData, verbose, isPrivate, {comment});
	}
	cancelOrder(idNum, time, {comment=null}={}) {
		return this.sendQuery('cancelOrder', idNum, time, {comment});
	}
	modifyOrder(idNum, orderUpdate, time, verbose=false, isPrivate=false, {comment=null}={}) {
		return this.sendQuery('modifyOrder', idNum, orderUpdate, time, verbose, isPrivate, {comment});
	}
	modificationsCharge() {
		return this.sendQuery('modificationsCharge', );
	}
	setLastPrice(instrument, lastprice, time) {
		return this.sendQuery('setLastPrice', instrument, lastprice, time);
	}
	async getRounder(instrument) {
		return this.sendRegistered('getRounderReq', null, instrument);
	}
	order_log_filter(order_id, label) {
		return this.sendQuery('order_log_filter', order_id, label);
	}
	order_log_show(callback) {
		return this.sendQuery('order_log_show', );
	}
	*/
	dtFormat(value, fmt) {
		return value.toString();
	}
	
	logReplacer = (key, value) => {
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
	
	logobj(...args) {
		log.apply(this, args.map(
			arg => arg == undefined ? 'undefined' : stringify(arg, this.logReplacer)));
	//	return this.receiver('logobj', ...args);
	}
};
