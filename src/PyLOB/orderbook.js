
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
if (label == 1) {
console.log(obj, ret, query);
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
		'find_active_order',
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
		'orderbook'
	];
	queries = {};
	initialized = false;
	tickGap = 10;
	
	debug = false;

	//@isAuthonomous will set last price by the executed orders
	constructor(oo, tick_size=0.0001, verbose=false, isAuthonomous=true) {
		this.tickSize = tick_size;
		this.decimalDigits = Math.log10(1 / this.tickSize);
		this.rounder = Math.pow(10, (Math.floor(this.decimalDigits)));
		this.time = 0;
		this.nextQuoteID = 0;
		
		this.oo = oo;
		// isolation_level: null
		this.db = new oo.DB('file:orderbook?mode=memory', 'c');

		this.location = new URL('./PyLOB', window.location.href).toString();
		this.file_loader = fetchText;
		this.verbose = verbose;
		this.isAuthonomous = isAuthonomous;
		this.instrument_cache = {};
	}
	
	async init() {
		let result = new Promise((resolve, reject) => {
			this.init_queries(this.query_names, this.queries).then(() => {
				this.db.exec(this.queries.orderbook);
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
			});
		});
		return result;
	}
	
	async init_queries(query_names, queries, subdir) {
		let result = new Promise((resolve, reject) => {
		let query_promises = [];
		for (let query of query_names) {
			let promise = this.file_loader(
				query, `${this.location}${subdir || ''}/sql/${query}.sql`);
			query_promises.push(promise);
		}
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
	
	findOrder(idNum, db) {
		let ret;
		(db || this.db).exec({
			sql: this.queries.find_order,
			bind: prepKeys(
				{idNum},
				this.queries.find_order),
			rowMode: 'object',
			callback: row => {
				ret = row;
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
	
	getTime() {
		return this.time;
	}
	
	createInstrument(
		symbol, currency, {modification_fee=0, execution_credit=0}={})
	{
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
	
	createTrader(name, tid, currency, commission_data,
		allow_self_matching=0)
	{
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
		return ret;
	}
	
	traderCashWithdraw(trader, currency, amount) {
		return this.traderCashDeposit(trader, currency, -amount);
	}
	
	traderCashDeposit(trader, currency, amount) {
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
	}
	
	traderFundWithdraw(trader, instrument, amount) {
		return this.traderFundDeposit(trader, instrument, -amount);
	}
	
	traderFundDeposit(trader, instrument, amount) {
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
	}
	
	traderBalance({trader, instrument, amount, lastprice, value, liquidation, time, extra}) {
		//to be overriden
		/*if (this.verbose) {
			this.logobj({instrument, amount, lastprice, value, liquidation});
		}*/
	}
	
	traderGetBalance(trader, instrument, extra) {
		// if !instrument, then all
		const traderBalance =
			(ob, info) => {
				ob.traderBalance(info);
			};
		this.db.exec({
			sql: this.queries.trader_balance,
			bind: prepKeys({
				trader: trader,
				symbol: instrument || null,
			}, this.queries.trader_balance),
			rowMode: 'object',
			callback: row => {
				let info = {...row, time: this.getTime(), extra};
				this.traderBalance(info);
				/*setTimeout(
					traderBalance,
					this.tickGap,
					this, info,
				);*/
			}
		});
	}
	
	traderNLV({trader, nlv, extra}) {
		//to be overriden
		/*if (this.verbose) {
			this.logobj({trader, nlv});
		}*/
	}
	
	traderGetNLV(trader, extra) {
		const traderNLV =
			(ob, info) => {
				ob.traderNLV(info);
			};
		this.db.exec({
			sql: this.queries.trader_nlv,
			bind: prepKeys({
				trader: trader,
			}, this.queries.trader_nlv),
			rowMode: 'object',
			callback: row => {
				let info = {...row, time: this.getTime(), extra}
				setTimeout(
					traderNLV,
					0*this.tickGap,
					this, info,
				);
			}
		});
	}
	
	traderFundsReset(trader, instrument) {
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
	}
	
	traderCashReset(trader, currency) {
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
	
	processOrder(quote, fromData, verbose=false, isPrivate=false, {comment=null}={}) {
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
							this.printQuote(quote, D), D);
						/*this.order_log(
							this.time, res.lastorder, 'order_detail',
							this.printOrder(quote.idNum, 'id: {order_id}', D), D);
							*/
						this.orderBalance(
							quote.order_id, quote.order_id, quote.tid,
							quote.tid, quote.instrument, undefined, D);
						ret = this.processMatchesDB(quote, false, D, verbose);
					}
				});
			}
		);
		if (quote.price && !isPrivate) {
			this.setInstrument(
				quote.instrument, this.db, 'last'+quote.side, quote.price);
		}
		if (ret != null) {
			this.orderSent(
				quote.idNum,
				Object.assign({status: 'sent'}, quote)
			);
			let [trades, trade_fulfills, balance_updates] = ret;
			this.matchesEvents(trades, trade_fulfills, balance_updates, quote, comment);
			return [trades, quote];
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
	
	processMatchesDB(quote, justquery, db, verbose) {
		let instrument = quote.instrument;
		quote.lastprice = this.getLastPrice(instrument, db);
		let qtyToExec = quote.qty;
		let sql_matches = this.queries.matches +
			this.queries.best_quotes_order_asc;
		
		let trades = [];
		let fulfills = [];
		let balance_updates = [];
		let totalprice = 0;
		
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
				if (this.debug) {
					this.logobj(qtyToExec, match.available, match);
				}
				if (qtyToExec <= 0) {
					//stop the loop
					return false;
				}
				let {order_id, idNum, counterparty, price, available, currency} = match;
				let qty = Math.min(available, qtyToExec);
				qtyToExec -= qty;
				if (justquery) {
					totalprice += qty * price;
					return;
				}
				let bid_order = quote.side == 'bid' ? quote.order_id : order_id;
				let ask_order = quote.side == 'ask' ? quote.order_id : order_id;
				let trade = this.tradeExecute(
					bid_order, ask_order, price, qty, instrument, db, verbose);
				trade.bid_trader = quote.side == 'bid' ? quote.tid : counterparty;
				trade.ask_trader = quote.side == 'ask' ? quote.tid : counterparty;
				trade.bid_idNum = quote.side == 'bid' ? quote.idNum : idNum;
				trade.ask_idNum = quote.side == 'ask' ? quote.idNum : idNum;
				trades.push(trade);
				db.exec({
					sql: this.queries.trade_fulfills,
					bind: prepKeys({
						bid_order,
						ask_order,
					}, this.queries.trade_fulfills),
					rowMode: 'object',
					callback: row => {
						fulfills.push(row);
						let color = row.side == 'ask' ? 'red' : 'mediumblue';
						this.order_log(
							this.time, row.order_id, 'fulfill_order',
							`<u style="color: ${color}">FULFILL</u> ${row.fulfilled} / ${row.qty} @${price}. fee: ${row.commission}`, db
						);
					}
				});
				balance_updates = this.orderBalance(
					quote.order_id, order_id, quote.tid, counterparty, instrument, currency, db);
			}
		});
		if (justquery) {
			let volume = quote.qty - qtyToExec;
			return [volume, totalprice];
		}
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
					`<u>BALANCE</u> of ${row.instrument} amt:${formatRounder(row.amount)}`, db
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
		if (this.isAuthonomous) {
			this.setLastPrice(instrument, price, db);
		}
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
			if (false && this.verbose) {
				this.traderGetBalance(update.trader, update.instrument);
			}
			//error(JSON.stringify(update));
		}
	}
	
	/*
	def openOrder(self, orderId: OrderId, contract: Contract, order: Order, orderState: OrderState):
		print(f"openOrder. orderId: {orderId}, contract: {contract}, order: {order}")
	*/
	//openOrder on IB
	//todo should provide order_id
	orderSent(idNum, quote) {
		// to be overriden
	}
	
	/*
	def orderStatus(self, orderId: OrderId, status: str, filled: Decimal, remaining: Decimal, avgFillPrice: float, permId: int, parentId: int, lastFillPrice: float, clientId: int, whyHeld: str, mktCapPrice: float):
		print(f"orderId: {orderId}, status: {status}, filled: {filled}, remaining: {remaining}, avgFillPrice: {avgFillPrice}, permId: {permId}, parentId: {parentId}, lastFillPrice: {lastFillPrice}, clientId: {clientId}, whyHeld: {whyHeld}, mktCapPrice: {mktCapPrice}")
	*/
	orderRejected(idNum, why) {
		// to be overriden
	}
	
	//the following two may be orderStatus/completedOrder on IB
	orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice) {
		// to be overriden
	}
	
	orderExecuted(idNum, trader, time, qty, price) {
		// to be overriden
	}
	
	cancelOrder(idNum, time, {comment=null}={}) {
		time = this.updateTime(time);
		let _trader = null;
		this.db.transaction(
			D => {
				D.exec({
					sql: this.queries.find_active_order,
					bind: prepKeys(
						{idNum},
						this.queries.find_active_order),
					rowMode: 'object',
					callback: row => {
						let {order_id, trader} = row;
						D.exec({
							sql: this.queries.cancel_order,
							bind: prepKeys({
								order_id,
								cancel: 1,
							}, this.queries.cancel_order)
						});
						_trader = trader;
						this.order_log(time, order_id, 'cancel_order', '<u>CANCEL</u> <s>@@order@@</s>', D);
					}
				});
			}
		);
		if (_trader) {
			this.orderCancelled(idNum, _trader, time);
		}
	}

	orderCancelled(idNum, trader, time) {
		// to be overriden
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
				{idNum},
				this.queries.find_order),
			rowMode: 'object',
			callback: row => {ret = row.side}
		});
		return ret;
	}

	modifyOrder(idNum, orderUpdate, time, verbose=false, isPrivate=false, {comment=null}={}) {
		let ret = null;
		let updateSide, updatePrice;
		this.db.transaction(
			D => {
				D.exec({
					sql: this.queries.find_active_order,
					bind: prepKeys(
						{idNum},
						this.queries.find_active_order),
					rowMode: 'object',
					callback: row => {
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
							updatePrice = orderUpdate.price = this.clipPrice(
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
						D.exec({
							sql: this.queries.modify_order,
							bind: prepKeys(
								orderUpdate,
								this.queries.modify_order)
						});
						this.order_log(this.time, order_id, 'modify_order', this.printQuote(orderUpdate, D), D);
						this.order_log(this.time, order_id, 'modify_detail', `${loginfo}`, D);
						if (this.betterPrice(side, price, orderUpdate.price)) {
							ret = this.processMatchesDB(orderUpdate, false, D, verbose);
						}
					}
				});
			}
		);
		if (updatePrice && !isPrivate) {
			this.setInstrument(
				orderUpdate.instrument, this.db, 'last'+updateSide, updatePrice);
		}
		if (updateSide) {
			this.orderSent(idNum, orderUpdate);
		}
		else {
			this.orderRejected(idNum, 'tryed to modify inactive order');
		}
		if (ret != null) {
//console.log('modified', orderUpdate);
			let [trades, fulfills, balance_updates] = ret;
			this.matchesEvents(trades, fulfills, balance_updates, orderUpdate, comment);
			return [trades, orderUpdate];
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
		if (!(instrument in this.instrument_cache)) {
			this.instrument_cache[instrument] = {};
		}
		this.instrument_cache[instrument][field] = value;
		if (value && ['lastask', 'lastbid'].includes(field)) {
			let other = field === 'lastask' ?
				this.getLastBid(instrument, db) : this.getLastAsk(instrument, db);
			if (other) {
				let midPoint = (value + other) / 2;
				if (midPoint != this.instrument_cache[instrument].midpoint) {
					this.instrument_cache[instrument].midpoint = midPoint
					this.tickMidPoint(instrument, midPoint);
				}
			}
		}
	}
	
	setLastPrice(instrument, lastprice, db) {
		//this.logobj({instrument, lastprice, db})
		this.setInstrument(
			instrument, db, 'lastprice', lastprice);
		//this.logobj(this.getLastPrice(instrument, db));
	}
	
	setLastBid(instrument, lastbid, db) {
		this.setInstrument(
			instrument, db, 'lastbid', lastbid);
	}
	
	setLastAsk(instrument, lastask, db) {
		this.setInstrument(
			instrument, db, 'lastask', lastask);
	}
	
	tickMidPoint(instrument, midPoint) {
		// to be overloaded
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
	
	getLiquidationPrice(instrument, side, qty, forWhom) {
		let quote = this.createQuote(forWhom, instrument, side, qty);
		return this.processMatchesDB(quote, true, this.db);
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
	
	order_log(event_dt, order_id, label, info, db) {
		let [dolog, data] = this.order_log_filter(order_id, label, db);
		if (!dolog) {
			return;
		}
		if (this.verbose) {
			info = info.replace('@@order@@', this.printQuote(data, db));
			log(`id:${data.idNum}${data.order_label ? '/' + data.order_label : ''}(tid:${data.trader})@${this.dtFormat(event_dt)} => ${info}`);
		}
		db.exec({
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
	}
	
	printQuote(quote, db) {
		let side = quote.side.toUpperCase();
		let price = quote.order_type == 'limit' ? 'LMT ' + this.clipPrice(quote.instrument, quote.price, db) : 'MKT';
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
