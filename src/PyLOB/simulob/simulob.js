'use strict';

// stringify with methods
function objectStringify(obj, sep) {
	var placeholder = '____PLACEHOLDER____';
	var fns = [];
	var json = JSON.stringify(obj, function(key, value) {
		if (typeof value === 'function') {
			fns.push(value);
			return placeholder;
		}
		return value;
	}, sep);
	json = json.replace(new RegExp('"' + placeholder + '"', 'g'), function(_) {
		return fns.shift();
	});
	return json;
};

async function jsLoad(src, module=false) {
	if (!src) {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		let s = document.createElement('script');
		s.src = src;
		if (module) {
			s.type='module';
		}
		s.async = false;
		s.onload = resolve;
		s.onerror = reject;
		document.head.append(s);
	});
}

function labelattr(context, attr)
{
	let label = context.dataset.data[context.dataIndex].label;
	if (label) {
		return label[attr];
	}
	return null;
}

function parseDate(dt) {
	let lx = luxon.DateTime.fromISO(
		dt, {
				zone: 'America/New_York',
				setZone: true,
			}
		);
	return lx.toMillis();
}

function formatDate(millis, fmt='HH:mm:ss.SSS') {
	let options = {
		zone: 'America/New_York',
		setZone: true,
	};
	let dt = luxon.DateTime.fromMillis(
		millis, options);
	return dt.toFormat(fmt, options);
}

const zoomOptions = {
	limits: {
		x: {min: -200, max: 200, minRange: 50},
		y: {min: -200, max: 200, minRange: 50}
	},
	pan: {
		enabled: true,
		mode: 'xy',
	},
	zoom: {
		wheel: {
			enabled: true,
		},
		pinch: {
			enabled: true
		},
		mode: 'xy',
		onZoomComplete({chart}) {
			// This update is needed to display up to date zoom level in the title.
			// Without this, previous zoom level is displayed.
			// The reason is: title uses the same beforeUpdate hook, and is evaluated before zoom.
			chart.update('none');
		}
	}
};

const bgPlugin = {
	id: 'custom_canvas_background_color',
	beforeDraw: (chart, args, options) => {
		const {ctx} = chart;
		ctx.save();
		ctx.globalCompositeOperation = 'destination-over';
		ctx.fillStyle = options.color;
		ctx.fillRect(0, 0, chart.width, chart.height);
		ctx.restore();
	},
	defaults: {
		color: 'lightGreen'
	}
};

class SimuLOB extends OrderBook {
	
	simu_initialized = false;
	derailedLabels = {};
	quotesQueue = [];
	quotesQueueLocked = false;
	
	config = {
		market_tid: undefined,
		trader_tid: undefined,
		instrument: undefined,
		currency: undefined,
		trader_orders: [],
	};
	
	simu_query_names = [
		'simulob',
		'quote_dismiss',
		'quote_get',
		'quote_getall',
		'quote_getbynum',
		'quote_getkeys',
		'quote_getnum',
		'quote_insert',
		'quote_update',
		'request_insert',
		'request_fetch',
		'request_delete',
		'lastrequest',
	];
	
	defaultSubject = 'any';
	request_promises = {};
	
	constructor(oo, thisLocation, receiver) {
		let lobLocation = new URL('../', thisLocation);
		let verbose = true;
		const isAuthonomous = false;
		super(oo, undefined, verbose, lobLocation, isAuthonomous, receiver);
		this.location = thisLocation;
		this.lobLocation = lobLocation;
		this.valid_sides = OrderBook.valid_sides;

		this.simu_queries = {};
		// move these to local db
		this.trader_quotes = {};
		this.order_names = {};
	}
	
	async strategyLoadReq(reqId, ...args) {
		await this.strategyLoad(...args);
		this.receiver.strategyLoadResp(reqId, this.config);
	}
	
	strategy_hook_chartBuildDatasetReq(reqId) {
		let ds = this.strategy.hook_chartBuildDataset();
		this.receiver.strategy_hook_chartBuildDatasetResp(reqId, ds);
	}
	
	strategy_hook_beforeUpdateChartReq(reqId, chartLabel) {
		let data = this.strategy.hook_beforeUpdateChart(chartLabel) || {};
		data.now = this.getTime();
		this.receiver.strategy_hook_beforeUpdateChartResp(reqId, data);
	}
	
	strategy_getButtonsReq(reqId) {
		let buttons = this.strategy.getButtons();
		this.receiver.strategyGetButtonsResp(reqId, buttons);
	}
	
	clearTableField(tableId, field) {
		this.receiver.clearTableField(tableId, field);
	}
	
	setTableField(tableId, field, ...value) {
		this.receiver.setTableField(tableId, field, ...value);
	}
	
	showNLV(snlv, nlvColor) {
		this.receiver.showNLV(snlv, nlvColor);
	}
	
	setUpdateFrequency(frequencies) {
		this.receiver.setUpdateFrequency(frequencies);
	}
	
	async strategyLoad(name, defaults) {
		const strategyClass = SimuStrategy.getStrategy(name);
		this.strategy = new strategyClass(this, JSON.parse(defaults));
		this.ticks = [];
		this.config = {};
		await this.strategy.hook_afterInit();
	}
	
	async init() {
		let result = new Promise((resolve, reject) => {
			super.init()
			.then(() => {
				// isolation_level: null
				this.simu_db = new oo.DB('file:simulob?mode=memory', 'c');
				return init_queries(this.simu_query_names, this.simu_queries, `${this.location}/sql/`);
			})
			.then(() => this.simu_db.exec(this.simu_queries.simulob))
			.then(value => fetchPricesZIP(this, this.lobLocation))
			.then(value => {
				this.simu_initialized = true;
				resolve();
			})
		;
		});
		return result;
	}
	
	isInitialized() {
		return this.simu_initialized;
	}
	
	addFilter(field, value) {
		//this.sendQuery('addFilter', field, value);
		this.order_log_addFilter(field, value);
	}
	
	quoteNum(idNum=null) {
		return this.getReqId('quote', idNum);
	}
	
	chartPushTicks(label, ...ticks) {
		this.receiver.chartPushTicks(label, ...ticks);
	}
	
	_chartPushTicks(label, chartLabel, ...ticks) {
		this.receiver._chartPushTicks(label, chartLabel, ...ticks);
	}
	
	chartSetTicks(label, ticks, chartLabel) {
		this.receiver.chartSetTicks(label, ticks, chartLabel);
	}
	
	done = doneFunc;
	
	getReqExtra(subject, reqId, db) {
		let promise = null, extra = null;
		if (!db) {
			db = this.simu_db;
		}
		try {
			db.exec({
				sql: this.simu_queries.request_fetch,
				rowMode: 'object',
				bind: prepKeys(
					{subject, reqId},
					this.simu_queries.request_fetch),
				callback: res => {
					extra = JSON.parse(res.extra);
				}
			});
			db.exec({
				sql: this.simu_queries.request_delete,
				rowMode: 'object',
				bind: prepKeys(
					{subject, reqId},
					this.simu_queries.request_delete),
			});
			if (reqId in this.request_promises) {
				promise = this.request_promises[reqId];
				delete this.request_promises[reqId];
			}
		}
		catch(error) {
			console.log('getReqExtra', error);
		}
		return [promise, extra];
	}
	
	getReqId = (subject, reqId=null, {extra=null, withPromise=false}={}) => {
		if (!subject) {
			subject = this.defaultSubject;
		}
		this.simu_db.transaction(
			D => {
				D.exec({
					sql: this.simu_queries.request_insert,
					bind: prepKeys(
						{
							subject,
							reqId,
							extra: JSON.stringify(extra),
						}
						, this.simu_queries.request_insert),
				});
				D.exec({
					sql: this.simu_queries.lastrequest,
					rowMode: 'object',
					bind: prepKeys(
						{subject},
						this.simu_queries.lastrequest),
					callback: res => {
						reqId = res.reqId;
					}
				});
			}
		);
		if (withPromise) {
			const promise = Promise.withResolvers();
			this.request_promises[reqId] = promise;
			return [reqId, promise.promise];
		}
		return reqId;
	}
	
	traderGetBalance(trader, instrument, extra) {
		let reqId = this.getReqId(null, null, {extra});
		return this.traderGetBalanceReq(reqId, trader, instrument);
	}
	
	traderGetNLV(trader, extra) {
		let reqId = this.getReqId(null, null, {extra});
		return this.traderGetNLVReq(reqId, trader);
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
	
	pause(value=true) {
		this.receiver.pause(value);
		this.dopause = value;
	}
	
	close() {
		this.pause();
		setTimeout(() => {
			super.close();
			//this.receiver.close();
		}, 10 * this.tickGap);
	}
	
	afterTicks(chartLabel) {
		let lastTime = this.getTime();
		this.receiver.afterTicks(chartLabel, lastTime);
		this.strategy.hook_afterTicks(chartLabel, lastTime);
	}
	
	async endOfDay(chartLabel) {
		this.modificationsCharge();
		this.afterTicks(chartLabel); //should move to newchartstart
	}
	
	run(dates) {
		this.dataComing = true;
		this.loadTicks();
		let chain = Promise.resolve();
		for (let day of dates) {
			chain = chain.then(
				msg => {
					if (msg) {
						console.error(msg);
					}
					return csvExtract(this, day);
					//return csvLoad(this, day);
				}
			);
		}
		chain = chain.then(
			msg => {
				if (msg) {
					console.error(msg);
				}
			}
		);
	}
	
	async chartInit(chartLabel, prevLabel, firstTime) {
		let [reqId, promise] = this.getReqId(null, null, {withPromise: true});
		this.receiver.chartInit(reqId, chartLabel, prevLabel, firstTime);
		return promise;
	}
	
	async loadTicks() {
		console.time('data process');
		let sent = 0;
		let simu = this;
		simu.dopause = false;
		simu.newChartStart = false;
		simu.firstTickFollows = false;
		let tickInterval = setInterval (async (simu) => {
			if (simu.dopause) {
				return;
			}
			let label, price, quote;
			if (this.quotesQueue.length) {
				this.quotesQueueLock();
				quote = this.quotesQueue.shift();
				this.quotesQueueLock(false);
				label = quote.label;
				let instrument = quote.instrument;
				if (label in this.derailedLabels[instrument]) {
					return;
				}
				simu.processQuote(quote);
			}
			else if (this.ticks.length) {
				let tick = this.ticks.shift();
				if (tick.label == 'chartReset') { //todo should trigger explicitly
					//if (!simu.chartLabel) {
					simu.newChartStart = true;
					simu.prevLabel = simu.chartLabel;
					simu.chartLabel = tick.title;
					//}
					simu.firstTickFollows = true;
					return;
				}
				if (tick.label == 'endOfDay') {
					await this.endOfDay(tick.title);
					return;
				}
				tick.timestamp = simu.updateTime(tick.timestamp);
				if (simu.newChartStart) {
					simu.newChartStart = false;
					await this.chartInit(simu.chartLabel, simu.prevLabel, tick.timestamp);
					///this.chart.options.scales.x.min = tick.timestamp;
					this.strategy.hook_newChartStart();
				}
				if (simu.firstTickFollows) {
					simu.firstTickFollows = false;
					simu.firstTime = tick.timestamp;
				}
				if (tick.label == 'price') {
					simu.setLastPrice(tick.instrument, tick.price, tick.timestamp);
				}
				else if (simu.valid_sides.includes(tick.label)) {
					quote = {
						...tick,
						trader: simu.config.market_tid,
						qty: 1000000,
					};
					simu.processQuote(quote);
				}
			}
			else if (this.dataComing) {
				//console.log('dataComing');
			}
			else {
				clearInterval(tickInterval);
				tickInterval = 0;
				error('sent:', sent);
				console.timeEnd('data process');
				return;
			}
			
			++sent;
		}
		, 5/*simu.tickGap*/, simu);
	}
	
	pushTick(tick) {
		this.ticks.push(tick);
	}
	
	quoteSave(label, quote, status='created', db) {
		(db || this.simu_db).exec({
			sql: this.simu_queries.quote_insert,
			bind: prepKeys(
				{
					trader: quote.tid,
					instrument: quote.instrument,
					side: quote.side,
					label,
					quote: JSON.stringify(quote),
					price: quote.price,
					qty: quote.qty,
					fulfilled: quote.fulfilled || 0,
					idNum: quote.idNum,
					order_id: quote.order_id || null,
					status,
				},
				this.simu_queries.quote_insert)
		});
	}

	quoteGet(trader, instrument, label, status=null, db) {
		let ret = null;
		(db || this.simu_db).exec({
			sql: this.simu_queries.quote_get,
			bind: prepKeys(
				{
					trader,
					instrument,
					label,
					status,
				},
				this.simu_queries.quote_get),
			rowMode: 'object',
			callback: row => {
				ret = JSON.parse(row.quote);
			}
		});
		return ret;
	}

	quoteGetNum(trader, instrument, label, db) {
		let ret = null;
		(db || this.simu_db).exec({
			sql: this.simu_queries.quote_getnum,
			bind: prepKeys(
				{
					trader,
					instrument,
					label,
				},
				this.simu_queries.quote_getnum),
			rowMode: 'object',
			callback: row => {
				ret = row.idNum;
			}
		});
		return ret;
	}

	quoteGetAllReq(reqId, trader, instrument, side=null, status=null) {
		let quotes = this.quoteGetAll(trader, instrument, side=null, status=null);
		this.receiver.quoteGetAllResp(reqId, quotes);
	}
	
	quoteGetAll(trader, instrument, side=null, status=null, db) {
		let ret = {};
		(db || this.simu_db).exec({
			sql: this.simu_queries.quote_getall,
			bind: prepKeys(
				{
					trader,
					instrument,
					side,
					status,
				},
				this.simu_queries.quote_getall),
			rowMode: 'object',
			callback: row => {
				//console.log(row);
				ret[row.label] = JSON.parse(row.quote);
			}
		});
		return ret;
	}

	quoteGetKeys(trader, instrument, side=null, db) {
		let ret = [];
		(db || this.simu_db).exec({
			sql: this.simu_queries.quote_getkeys,
			bind: prepKeys(
				{
					trader,
					instrument,
					side,
				},
				this.simu_queries.quote_getkeys),
			rowMode: 'object',
			callback: row => {
				ret.push(row);
			}
		});
		return ret;
	}

	quoteGetByNum(idNum, db) {
		let ret = null;
		(db || this.simu_db).exec({
			sql: this.simu_queries.quote_getbynum,
			bind: prepKeys(
				{
					idNum,
				},
				this.simu_queries.quote_getbynum),
			rowMode: 'object',
			callback: row => {
				row.quote = JSON.parse(row.quote);
				ret = row;
			}
		});
		return ret;
	}

	quoteUpdate(quote, db) {
		(db || this.simu_db).exec({
			sql: this.simu_queries.quote_update,
			bind: prepKeys(
				{
					idNum: quote.idNum,
					quote: JSON.stringify(quote),
					price: quote.price,
					qty: quote.qty,
					fulfilled: quote.fulfilled || 0,
					order_id: quote.order_id || null,
					status: quote.status || null,
				},
				this.simu_queries.quote_update
			),
		});
	}

	quoteDismiss(idNum, db) {
		(db || this.simu_db).exec({
			sql: this.simu_queries.quote_dismiss,
			bind: prepKeys(
				{idNum},
				this.simu_queries.quote_dismiss
			),
		});
	}
	
	static quoteRe = /^\s*(?<side>ask|bid|sell|buy)\s+(?<qty>\d+)(\s+(?<instrument>([A-Za-z]{1,5})(-[A-Za-z]{1,2})?))?(\s+(limit|lmt)\s*(?<price>(\d+\.?\d*))|mkt|market)?\s*$/;
	
	//'buy 10 AAPL lmt 123',
	parseQuote(str) {
		const quote = this.constructor.quoteRe.exec(str).groups;
		quote.trader = this.config.trader_tid;
		quote.instrument = quote.instrument || this.config.instrument;
		quote.side = (quote.side || '').toLowerCase();
		quote.side = ['bid', 'buy'].includes(quote.side) ? 'bid' : 'ask';
		quote.label = 'manual';
		quote.qty = parseInt(quote.qty);
		quote.price = quote.price ? parseFloat(quote.price) : null;
		return quote;
	}
	
	processQuote({trader, instrument, label, side, qty, price=null, isPrivate=false, cancelQuote=false}) {
		let quote = this.quoteGet(trader, instrument, label, 'sent');
		if (!quote) {
			if (!side) {
				side = label.slice(0, 3);
			}
			quote = this.createQuote(
				trader, instrument, side, qty, price);
			this.quoteSave(label, quote, 'saved'); //todo is this needed?
			///quote.fulfilled = 0;
			this.processOrder(quote, true, false, isPrivate);
		}
		else if (cancelQuote) {
			super.cancelOrder(quote.idNum);
			return quote.idNum;
		}
		else {
			let update = {
				price,
				qty,
			};
			let verbose = false;
			this.quoteSave(label, quote, 'quoted');
			this.modifyOrder(quote.idNum, update, quote.timestamp, verbose, isPrivate);
			quote = Object.assign(quote, update);
		}
		return quote.idNum;
	}
	
	cancelQuote(trader, instrument, label) {
		let idNum = this.quoteGetNum(trader, instrument, label);
		if (idNum !== null) {
			super.cancelOrder(idNum);
		}
	}
	
	cancelAllQuotes(trader, instrument, side=null) {
		let quotes = this.quoteGetKeys(trader, instrument, side);
		for (let quote of quotes) {
			this.cancelQuote(quote.trader, quote.instrument, quote.label);
		}
	}
	
	manualQuote(str) {
		const quote = this.parseQuote(str);
		this.processQuote(quote);
	}
	
	//todo take and subsequently use order_id
	orderSent(idNum, quote) {
		let instrument, label;
		let order = this.quoteGetByNum(idNum);
		if (!order) {
			if (quote?.tid == this.config.trader_tid) {
				this.findOrder(idNum).then((info) => {
					console.error('sent order not found', idNum, quote, info);
				});
				return;
			}
			instrument = quote.instrument;
			label = quote.label;
		}
		else {
			instrument = order.instrument;
			label = order.label || order.side;
		}
		quote.status = 'sent';
		this.quoteUpdate(quote);
		this.chartPushTicks(
			label,
			{x: quote.timestamp, y: quote.price},
			{x: quote.timestamp + 1, y: quote.price, sentinel: true},
		);
		if (quote.tid != this.config.trader_tid) {
			return;
		}
	//console.log(order);
		this.strategy.hook_orderSent(quote.tid, instrument, label, quote.price);
	}
	
	//todo use order_id
	dismissQuote(idNum) {
		this.simu_db.transaction(D => {
		//let D;
			let order = this.quoteGetByNum(idNum, D);
			if (!order) {
				this.findOrder(idNum).then((info) => {
					console.error('dismissed order not found', idNum, info);
				});
				return;
			}
			let {label, quote} = order;
				this.quoteDismiss(idNum, D);
			this.chartPushTicks(
				label,
				{
					x: this.updateTime(),
					y: quote.price,
				},
				{
					x: this.updateTime(),
					y: null,
				}
			);
		});
	}
	
	setLastPrice(instrument, price, time) {
		super.setLastPrice(instrument, price, time);
	}
	
	tickLastPrice(instrument, price, time) {
		let thinTick = {x: time, y: price};
		this.chartPushTicks('price', thinTick);
		this.strategy.hook_tickLastPrice(instrument, price, time);
	}
	
	tickMidPoint(instrument, midPoint, time) {
		this.strategy.hook_tickMidPoint(instrument, midPoint, time);
		let tick = {
			x: time,
			y: midPoint,
		};
		this.chartPushTicks('midpoint', tick);
	}
	
	orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice) {
		if (trader != this.config.trader_tid) {
			return;
		}
		let order = this.quoteGetByNum(idNum);
		if (!order) {
			this.findOrder(idNum).then((info) => {
				console.error('fulfilled order not found', idNum, info);
			});
			return;
		}
		let {instrument, label, quote} = order;
		quote.fulfilled = fulfilled;
		this.quoteUpdate(quote);
		if (fulfilled == qty) {
			this.dismissQuote(idNum);
		}
		this.strategy.hook_orderFulfill(
			instrument, label, trader, qty, fulfilled, commission, avgPrice);
	}
	
	orderExecuted(idNum, trader, time, qty, price) {
		if (trader != this.config.trader_tid) {
			return;
		}
		let order = this.quoteGetByNum(idNum);
		if (!order) {
			this.findOrder(idNum).then((info) => {
				console.error('executed order not found', idNum, info);
			});
			return;
		}
		let {instrument, label} = order;
		this.strategy.hook_orderExecuted(instrument, label, trader, time, qty, price);
		let side = this.orderGetSide(idNum);
		let tick = {
			x: time,
			y: price,
			label: {
				text: `${qty}`,
//				color: 'white',
			},
			branch: label,
		};
		this.chartPushTicks(side == 'ask' ? 'sold' : 'bought', tick);
	}
	
	orderCancelled(idNum, trader, time) {
		if (trader != this.config.trader_tid) {
			return;
		}
		let order = this.quoteGetByNum(idNum);
		if (!order) {
			this.findOrder(idNum).then((info) => {
				console.error('canceled order not found', idNum, info);
			});
			return;
		}
		let {instrument, label} = order;
		this.dismissQuote(idNum);
		//why
		//this.derailedLabels[instrument][label] = true;
		//this?
		this.strategy.hook_orderCancelled(instrument, label, trader, time);
	}
	
	orderRejected(idNum, why) {
		console.log('rejected order', idNum, why);
		this.quoteDismiss(idNum);
	}
	
	traderBalance({
		trader, instrument, amount, rounder, lastprice, value, 
		liquidation, modification_debit, execution_credit, time, reqId
	}) {
		if (trader != this.config.trader_tid) {
			return;
		}
		let [promise, extra] = this.getReqExtra('any', reqId);
		const info = {
			trader, instrument, amount, rounder, lastprice, value,
			liquidation, modification_debit, execution_credit, time, extra
		};
		if (promise) {
			promise.resolve(info);
		}
		this.strategy.hook_traderBalance(
			trader, instrument, amount, lastprice, value, liquidation, time, extra);
	}
	
	traderNLV({trader, nlv, reqId}) {
		if (trader != this.config.trader_tid) {
			return;
		}
		let [promise, extra] = this.getReqExtra('any', reqId);
		const info = {trader, nlv, extra};
		if (promise) {
			promise.resolve(info);
		}
		this.strategy.hook_traderNLV(trader, nlv, extra);
	}
	
	dtFormat(millis, fmt='HH:mm:ss.SSS') {
		return formatDate(millis, fmt);
	}
	
	order_log_filter(order_id, label, db) {
		let [dolog, data] = super.order_log_filter(order_id, label, db);
		dolog = (data.trader == this.config.trader_tid);
		if (['balance_update', 'modify_detail'].includes(label)) {
			dolog = false;
		}
		if (data.idNum in this.order_names) {
			let [instrument, order_label] = this.order_names[data.idNum];
			data.order_label = order_label;
			data.event_dt = this.dtFormat(data.event_dt);
		}
		return [dolog, data];
	}
	
	quotesQueueLock(lock=true) {
		if (lock) {
			let checkInterval = setInterval(
				() => {
				if (!this.quotesQueueLocked) {
					this.quotesQueueLocked = true;
					clearInterval(checkInterval);
				}
			}, 1);
		}
		else {
			this.quotesQueueLocked = false;
		}
	}
};

// this is an interface
class SimuReceiver extends LOBReceiver {
	constructor(forwarder) {
		super(forwarder);
	}
	strategyLoadResp(reqId, config) {
		let [promise, extra] = this.getReqExtra('any', reqId);
		if (promise) {
			promise.resolve(config);
		}
	}
	strategy_hook_chartBuildDatasetResp(reqId, ds) {
		let [promise, extra] = this.getReqExtra('any', reqId);
		if (promise) {
			promise.resolve(ds);
		}
	}
	strategy_hook_beforeUpdateChartResp(reqId, data) {
		let [promise, extra] = this.getReqExtra('any', reqId);
		if (promise) {
			promise.resolve(data);
		}
	}
	quoteGetAllResp(reqId, quotes) {
		let [promise, extra] = this.getReqExtra('any', reqId);
		if (promise) {
			promise.resolve(quotes);
		}
	}
	strategyGetButtonsResp(reqId, buttons) {
		let [promise, extra] = this.getReqExtra('any', reqId);
		if (promise) {
			promise.resolve(buttons);
		}
	}
};

class SimuForwarder extends SimuReceiver {
	constructor(forwarder) {
		super(forwarder);
	}
	strategyLoadResp(...args) {
		this.forward('strategyLoadResp', ...args);
	}
	strategyGetButtonsResp(...args) {
		this.forward('strategyGetButtonsResp', ...args);
	}
	strategy_hook_chartBuildDatasetResp(...args) {
		this.forward('strategy_hook_chartBuildDatasetResp', ...args);
	}
	strategy_hook_beforeUpdateChartResp(...args) {
		this.forward('strategy_hook_beforeUpdateChartResp', ...args);
	}
	setUpdateFrequency(frequencies) {
		this.forward('setUpdateFrequency', frequencies);
	}
	chartPushTicks(...args) {
		this.forward('chartPushTicks', ...args);
	}
	_chartPushTicks(...args) {
		this.forward('_chartPushTicks', ...args);
	}
	chartSetTicks(...args) {
		this.forward('chartSetTicks', ...args);
	}
	afterTicks(...args) {
		this.forward('afterTicks', ...args);
	}
	pause(...args) {
		this.forward('pause', ...args);
	}
	clearTableField(...args) {
		this.forward('clearTableField', ...args);
	}
	setTableField(...args) {
		this.forward("setTableField", ...args);
	}
	showNLV(...args) {
		this.forward("showNLV", ...args);
	}
	chartInit(reqId, chartLabel, prevLabel, firstTime) {
		this.forward('chartInit', reqId, chartLabel, prevLabel, firstTime);
	}
	quoteGetAllResp(reqId, quotes) {
		this.forward('quoteGetAllResp', quotes);
	}
};

class SimuClient extends LOBClient {
	constructor(worker_url, receiver, dtFormat) {
		super(worker_url, receiver, dtFormat);
	}
	async init() {return super.init();}
	async strategyLoad(name, defaults) {
		return this.sendRegistered('strategyLoadReq', null, name, defaults);
	}
	async strategy_getButtons() {
		return this.sendRegistered('strategy_getButtonsReq');
	}
	strategy_hook_chartBuildDataset() {
		return this.sendRegistered('strategy_hook_chartBuildDatasetReq');
	}
	strategy_hook_beforeUpdateChart(chartLabel) {
		return this.sendRegistered('strategy_hook_beforeUpdateChartReq', null, chartLabel);
	}
	run(dates) {
		this.sendQuery('run', dates);
	}
	quoteGetAll(...args) {
		return this.sendRegistered('quoteGetAllReq', null, ...args);
	}
};

