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

function showNLV(snlv, nlvColor) {
	let element = document.querySelector('#nlv');
	element.textContent = '';
	element.insertAdjacentHTML(
		'beforeend',
		`<div style="color: ${nlvColor}">${snlv}</div>`
	);
}

function clearTableField(tableId, field) {
	let selector = `#${tableId} tr`;
	if (field) {
		selector += `.${field}`;
	}
	const rows = document.querySelectorAll(selector);
	rows.forEach(row => {
		row.remove();
	});
}

function setTableField(tableId, field, ...value) {
	clearTableField(tableId, field);
	const table = document.querySelector(`#${tableId}`);
	const valueCols = value.map(one => `<td>${one}</td>`);
	let row =
		`<tr class="${field}">
			<th>${field}</th>${valueCols}
		</tr>`;
	table.insertAdjacentHTML('beforeend', row);
}

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
	
	strategyLoadReq(reqId, ...args) {
		this.strategyLoad(...args)
		.then(() => {
			this.receiver.strategyLoadResp(reqId, this.config);
		})
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
		let chain = Promise.resolve();
		chain = chain.then(value => this.strategy.hook_afterInit());
		return chain;
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
	
	loadTicks() {
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
					this.receiver.chartInit(simu.chartLabel, simu.prevLabel, tick.timestamp);
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
	console.log(order);
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
	constructor() {
		super();
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
	constructor(sender) {
		super();
		this.sender = sender;
	}
	forward(method, ...args) {
		this.sender(method, ...args);
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
	chartInit(chartLabel, prevLabel, firstTime) {
		this.forward('chartInit', chartLabel, prevLabel, firstTime);
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

class SimuConsole extends SimuReceiver {
	
	titleLabel = 'title';
	
	title_branch = ['title'];
	price_branch = ['price'];
	balance_branch = ['nlv'];
	executions_branch = ['bought', 'sold'];
	market_orders = ['ask', 'bid'];
	
	// an index to the datasets
	chartIndex = {};
	chartBuffer = {};
	charts = {};
	
	updateGroups = {
		sum: 'sum',
	};
	updateFrequency = {
		default: 10,
		sum: 20,
		balance: 1,
		executions: 1,
	};
	
	static scatterTooltip = {
		callbacks: {
			label: ({parsed, formattedValue, dataset}) => {
				return `${dataset.emoji} ${parsed.branch || dataset.label} ${parsed.label.text}: ${formattedValue}`;
			},
		}
	};
	
	chartStyle = {
		price: {
			borderColor: 'green',
			pointStyle: 'cross',
			pointRadius: 0,
		},
		midpoint: {
			borderColor: 'orange',
			pointStyle: 'star',
		},
		title: {
			borderColor: 'green',
			pointStyle: false,
			yAxisID: 'yDate',
			//xAxisID: 'x',
			updateGroup: null,
			datalabels: {
				color: 'black',
				backgroundColor: 'yellow',
				align: 'right',
			},
		},
		nlv: {
			borderColor: 'gold',
			pointStyle: 'star',
			yAxisID: 'yNLV',
			//xAxisID: 'xHidden',
			//hidden: true,
			updateGroup: 'balance',
		},
		bought: {
			borderColor: 'blue',
			pointStyle: 'star',
			type: 'scatter',
			datalabels: {
				/*
				align: 135,
				offset: 15,
				*/
				anchor: 'center',
				color: 'white',
				backgroundColor: 'blue',
			},
			emoji: '🤝',
			tooltip: this.constructor.scatterTooltip,
			updateGroup: 'executions',
		},
		sold: {
			borderColor: 'red',
			pointStyle: 'star',
			type: 'scatter',
			datalabels: {
				/*
				align: 45,
				offset: 15,
				*/
				anchor: 'center',
				color: 'white',
				backgroundColor: 'red',
			},
			emoji: '🤝',
			tooltip: this.constructor.scatterTooltip,
			updateGroup: 'executions',
		},
		ask: {
			borderColor: 'red',
		},
		bid: {
			borderColor: 'blue',
		},
	};
	
	request_promises = {};
	reqIds = {};
	reqIdsLocked = false;
	
	constructor(oo, thisLocation) {
		super();
		this.loading = document.querySelector('#loading');
		this.paused = document.querySelector('#paused');
		this.location = thisLocation;
		const sqlite3Dir = '/node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm';
		this.worker_url = `${this.location}/simu_worker.js?sqlite3.dir=${sqlite3Dir}`;
		this.lobClient = new SimuClient(this.worker_url, this, null/*dtFormat*/);
		
		if (this.isAuthonomous) {
			this.price_branch.push('midpoint');
		}
		this.data_branches = [
			...this.title_branch,
			...this.price_branch,
			...this.market_orders,
		];
		this.core_branches = [
			...this.data_branches,
			...this.executions_branch,
			...this.balance_branch,
		];
		this.order_branches = this.market_orders;
	}
	
	async init(strategy, config) {
		this.strategy = strategy;
		return this.lobClient.init()
		.then(() => this.lobClient.strategyLoad(strategy, config))
		.then(config => {
			this.config = config;
			return Promise.resolve();
		});
	}
	
	run(dates) {
		this.lobClient.run(dates);
	}
	
	chartConfig(maximumFractionDigits) {
		return {
			type: 'line',
			plugins: [
				ChartDataLabels,
				bgPlugin,
			],
			options: {
				animation: false,
				responsive: true,
				normalized: true,
				parsing: false,
				interaction: {
					mode: 'point',
					axis: 'xy',
					includeInvisible: true,
				},
				ticks: {
					format: {
						maximumFractionDigits: maximumFractionDigits,
					},
				},
				/*elements: {
					point: {
						radius: 10,
					}
				},*/
				plugins: {
					custom_canvas_background_color: {
						color: 'white',
					},
					datalabels: {
						backgroundColor: function(context) {
							return labelattr(context, 'backgroundColor') ||
								context.dataset.backgroundColor;
						},
						borderRadius: 4,
						color: function(context) {
							return labelattr(context, 'color');
						},
						//color: 'white',
						font: {
							//weight: 'bold',
							size: '8px',
						},
						formatter: function(value, context) {
							//return value;
							return labelattr(context, 'text');
						},
						anchor: function(context) {
							return labelattr(context, 'anchor');
						},
						align: function(context) {
							return labelattr(context, 'align');
						},
						padding: 1
					},
					title: {
						display: true,
						text: 'initial title',
						fontSize: 14,
						fontFamily: 'Roboto',
						fontColor: '#474747',
					},
					legend: {
						title: {
							display: true,
							text: 'Datasets',
							fontSize: 14,
							fontFamily: 'Roboto',
							fontColor: '#474747',
						},
						display: true,
						position: 'bottom',
						labels: {
							//fontColor: '#333',
							usePointStyle: true,
							boxWidth: 9,
							fontColor: '#474747',
							fontFamily: '6px Montserrat',
							filter: (item, chart) => {
								return (item.text !== 'hidden');
							}
						}
					},
					tooltip: {
						itemSort: (a, b) => {
							return ((a.raw.x > b.raw.x) - (a.raw.x < b.raw.x));
						},
						/*callbacks: {
							label: function(tooltipItem, data) {
								console.log('labeling', tooltipItem, data);
								return "Daily Ticket Sales: $ " + tooltipItem.yLabel;
							},
						},*/
					},
					//zoom: zoomOptions,
				},
				scales: {
					x: {
						type: 'time',
						time: {
							unit: "minute",
							tooltipFormat: "HH:mm:ss.SSS",
							tooltipFormat0: "x",
							displayFormats: {
								millisecond: 'HH:mm:ss.SSS',
								second: 'HH:mm:ss',
								minute: 'HH:mm:ss',
								millisecond0: 'x',
								second0: 'x',
								minute0: 'x',
								/*'hour': 'HH:mm:ss',
								'day': 'HH:mm:ss',
								'week': 'HH:mm:ss',
								'month': 'HH:mm:ss',
								'quarter': 'HH:mm:ss',
								'year': 'HH:mm:ss',*/
							},
						},
						adapters: {
							date: {
								zone: 'America/New_York',
							},
						},
						ticks: {
							source: 'data',
							/*callback: function(value, index, ticks) {
								//unformatted value for showing
								if (ticks.at(index).label) {
									console.log(ticks.at(index).label);
								}
								return this.getLabelForValue(value);
							},*/
						},
						/*title: {
							display: true,
							text: 'minutes'
						}*/
					},
					/*xHidden: {
						display: false,
					},*/
					yNLV: {
						type: 'linear',
						position: 'left',
						stack: 'data',
						display: 'auto',
						stackWeight: 0.5,
						weight: -300,
						title: {
							text: 'nlv',
							display: true,
						},
						ticks: {
							source: 'data',
							//display: false,
						},
						offset: true,
						//order: 3,
					},
					yBalance: {
						type: 'linear',
						position: 'left',
						stack: 'data',
						display: 'auto',
						stackWeight: 0.5,
						weight: -200,
						title: {
							text: 'balance',
							display: true,
						},
						ticks: {
							source: 'data',
						},
						offset: true,
						//order: 4,
					},
					yPrices: {
						type: 'linear',
						position: 'left',
						stack: 'data',
						stackWeight: 3,
						weight: -100,
						title: {
							text: 'prices',
							display: true,
						},
						ticks: {
							source: 'data',
						},
						border: {
							display: true,
							color: 'green',
						},
						offset: true,
						//order: 2,
					},
					yDate: {
						type: 'linear',
						position: 'left',
						stack: 'data',
						display: true,
						stackWeight: 0.2,
						weight: 0,
						title: {
							text: 'day',
							display: true,
						},
						ticks: {
							source: 'data',
							display: false,
						},
						offset: true,
						//order: 1,
					},
				},
			},
			/*data: {
				datasets: []
			},*/
		};
	}
	
	getReqExtra(subject, reqId) {
		let promise = null, extra = null;
		try {
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
		this.reqIdsLock();
		if (!(subject in this.reqIds)) {
			this.reqIds[subject] = 0;
		}
		if (!reqId) {
			reqId = ++this.reqIds[subject];
		}
		this.reqIdsLock(false);
		if (withPromise) {
			const promise = Promise.withResolvers();
			this.request_promises[reqId] = promise;
			return [reqId, promise.promise];
		}
		return reqId;
	}
	
	reqIdsLock(lock=true) {
		if (lock) {
			let checkInterval = setInterval(
				() => {
				if (!this.reqIdsLocked) {
					this.reqIdsLocked = true;
					clearInterval(checkInterval);
				}
			}, 1);
		}
		else {
			this.reqIdsLocked = false;
		}
	}
	
	studySide(side, chartLabel) {
		let labels =
			this.market_orders
				.filter(label => label != side)
			.concat(
				this.config.trader_orders
					.filter(label => label.slice(0, 3) == side)
			);
		labels.push('title', (side == 'bid' ? 'bought' : 'sold'));
		let info = this.getChartInfo(chartLabel);
		for (let label of this.branches) {
			let ix = this.chartIndex[label].dataset;
			if (labels.includes(label)) {
				info.chart.show(ix);
			}
			else {
				info.chart.hide(ix);
			}
		}
		info.chart.update();
	}
	
	pause(value=true) {
		if (this.loading) {
			this.loading.style.display = value ? 'none' : 'block';
		}
		if (this.paused) {
			this.paused.style.display = value ? 'block' : 'none';
		}
	}
	
	close() {
		for (let label of Object.keys(this.charts)) {
			this.chartDestroy(label);
		}
		this.lobClient.close();
	}
	
	setUpdateFrequency(frequencies) {
		objectUpdate(this.updateFrequency, frequencies);
	}
	
	chartCopy(chartLabel) {
		let info = this.getChartInfo(chartLabel);
		let config = this.chartConfig(this.decimalDigits);
		let data = info.chart.config.data;
		data.datasets = data.datasets.filter(
			(ds, i) => info.chart.isDatasetVisible(i))
			;
		data.datasets.forEach(ds => {
			ds.data = ds.data.slice(0, 100);
		});
		config.plugins = config.plugins.filter(plugin => plugin.id != "datalabels");
		let snippet = `
			<script src="https://cdn.jsdelivr.net/npm/chart.js@^4"></script>
			<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@^2"></script>
			<script src="https://cdn.jsdelivr.net/npm/luxon@^2"></script>
			<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@^1"></script>
			
			<div class="chart" style="height:100vh; width:100vw">
				<canvas id="myChart"></canvas>
			</div>
			<script>
			const data = ${JSON.stringify(data)};
			
			function labelattr(context, attr)
			{
				let label = context.dataset.data[context.dataIndex].label;
				if (label) {
					return label[attr];
				}
				return null;
			}
			const config = ${objectStringify(config, '\t')};
			config.plugins.push(ChartDataLabels);
			config.data = data;
			
			const ctx = document.getElementById('myChart');
			chart = new Chart(
				ctx,
				config,
			);
			</script>
		`;
		navigator.clipboard.writeText(snippet)
			.then(() => {
				//alert('clipboard successfully set');
			})
			.catch(error => {
				alert('clipboard write failed', error);
			});
	}
	
	chartDestroy(chartLabel) {
		let chart = this.getChartInfo(chartLabel);
		if (chart.chart) {
			chart.chart.clear();
			chart.chart.destroy();
		}
	}
	
	chartSetTitle(title, chartLabel) {
		let info = this.getChartInfo(chartLabel);
		if (info.chart) {
			info.chart.options.plugins.title.text = title;
		}
	}
	
	chartGetTitle(chartLabel) {
		let info = this.getChartInfo(chartLabel);
		if (info.chart) {
			return info.chart.options.plugins.title.text;
		}
	}
	
	chartUpdate(chartLabel, method) {
		let info = this.getChartInfo(chartLabel || this.chartLabel);
		if (info.chart) {
			info.chart.update(method);
		}
	}
	
	manualQuote() {
		const str = prompt('please enter a quote string', `bid 10 ${this.instrument} lmt 50`);
		this.lobClient.manualQuote(str);
	}
	
	chartBuildDataset() {
		let datasets = [];
		for (let branch of this.core_branches) {
			let order_branch = this.market_orders.includes(branch);
			let dataset = {
				type: 'line',
				isQuote: order_branch,
				label: branch,
				beginAtZero: false,
				yAxisID: 'yPrices',
				//xAxisID: 'xHidden',
				stepped: order_branch,
				spanGaps: false,
				hidden: 0&&!order_branch,
			};
			objectUpdate(dataset, this.chartStyle[branch] || {});
			datasets.push(dataset);
		}
		this.lobClient.strategy_hook_chartBuildDataset()
		.then((ds_strategy) => {
		const strategy = SimuStrategy.getStrategy(this.strategy);
		for (let ds of ds_strategy) {
			if (ds.tooltip) {
				ds.tooltip = strategy[ds.tooltip];
			}
		}
		datasets = datasets.concat(ds_strategy);
		let branches = [];
		let order_branches = [];
		let chartIndex = {};
		for (let branch_ix in datasets) {
			let dataset = datasets[branch_ix];
			let label = dataset.label;
			dataset.id = `id_${label}`;
			dataset.data = [];
			dataset.animation = false;
			if (dataset.isQuote) {
				order_branches.push(label);
				delete dataset.isQuote;
			}
			branches.push(label);
			if ('updateGroup' in dataset) {
				this.updateGroups[label] = dataset.updateGroup;
				delete dataset.updateGroup;
			}
			else {
				this.updateGroups[label] = 'default';
			}
			chartIndex[label] = {dataset: branch_ix};
		}
		this.branches = branches;
		this.order_branches = order_branches;
		this.chartIndex = chartIndex;
		});
		return datasets;
	}
	
	getChartInfo(chartLabel) {
		return this.charts[chartLabel || this.chartLabel] || {};
	}
	
	chartLoadBuffer(chartLabel) {
		for (let [label, ds] of Object.entries(this.chartBuffer[chartLabel] || {})) {
			let ticks = ds.data || [];
			while (ticks.length) {
				let tick = ticks.shift();
				this.chartPushTicks(label, tick);
			}
		}
	}
	
	chartDataset(label, chartLabel) {
		if (!chartLabel) {
			chartLabel = this.chartLabel;
		}
		if (!chartLabel) {
			return;
		}
		let chart = this.charts[chartLabel];
		if (chart?.chart) {
			let ix = this.chartIndex[label]?.dataset;
			if (typeof ix === 'undefined') {
				return;
			}
			return chart.chart.data.datasets[ix];
		}
		if (!this.chartBuffer[chartLabel]) {
			this.chartBuffer[chartLabel] = {};
		}
		if (!this.chartBuffer[chartLabel][label]) {
			this.chartBuffer[chartLabel][label] = {data: []};
		}
		return this.chartBuffer[chartLabel][label];
	}
	
	chartDatasets(chartLabel) {
		let chart = this.getChartInfo(chartLabel);
		let ret = chart.chart.data.datasets.map(ds => ds.label);
		return ret;
	}
	
	chartData(label, chartLabel) {
		let ds = this.chartDataset(label, chartLabel);
		return ds ? ds.data : null;
	}
	
	chartDoUpdate(chartInfo) {
		chartInfo.updating = true;
		chartInfo.chart.update('none');
	}
	
	chartDataUpdate = (label, ticks, chartLabel) => {
		let chartInfo = this.getChartInfo(chartLabel);
		if (!chartInfo || !chartInfo.initialized) {
			setTimeout(
				this.chartDataUpdate,
				300, label, ticks, chartLabel
			);
			return;
		}
		let updateGroup = this.updateGroups[label];
		//update the counter for the group and instrument
		let groups = [updateGroup, 'sum'];
		let shouldUpdate = false;
		for (let group of groups) {
			chartInfo.updateCounters[group] += ticks.length;
			if (chartInfo.updateCounters[group] >= this.updateFrequency[group]) {
				shouldUpdate = true;
			}
		}
		if (chartInfo.updating) {
			return;
		}
		if (shouldUpdate) {
			this.chartDoUpdate(chartInfo);
		}
		else {
			if (chartInfo.updateTimeout) {
				clearTimeout(chartInfo.updateTimeout);
				chartInfo.updateTimeout = 0;
			}
			chartInfo.updateTimeout = setTimeout(
				this.chartDoUpdate,
				2000, chartInfo
			);
		}
	}
	
	chartPushTicks(label, ...ticks) {
		this._chartPushTicks(label, this.chartLabel, ...ticks);
	}
	
	_chartPushTicks(label, chartLabel, ...ticks) {
		if (!chartLabel) {
			chartLabel = this.chartLabel;
		}
		let chartInfo = this.getChartInfo(chartLabel);
		if (chartInfo.prevLabel) {
			let prevTicks = [], currentTicks = [];
			for (let tick of ticks) {
				((tick.x < chartInfo.firstTime - 1000 && !tick.timeInPast) ?
				prevTicks : currentTicks).push(tick);
			}
			if (prevTicks.length) {
				this._chartPushTicks(label, chartInfo.prevLabel, ...prevTicks);
			}
			ticks = currentTicks;
		}
		let data = this.chartData(label, chartLabel);
		if (data && ticks.length) {
			if (data.length && data.at(-1).sentinel) {
				data.pop();
			}
			data.push(...ticks);
			if (this.titleLabel && label != this.titleLabel) {
				let titleData = this.chartData(this.titleLabel, chartLabel);
				if (titleData) {
					let titleTicks = ticks.map(tick => Object.assign({}, tick, {y: null}));
					titleData.push(...titleTicks);
				}
			}
			this.chartDataUpdate(label, ticks, chartLabel);
		}
	}
	
	chartSetTicks(label, ticks, chartLabel) {
		let ds = this.chartDataset(label, chartLabel);
		if (ds) {
			ds.data = ticks;
			this.chartDataUpdate(label, ticks, chartLabel);
		}
	}
	
	chartBackupTicks(label, chartLabel) {
		let ds = this.chartDataset(label, chartLabel);
		if (ds) {
			ds.dataBackup = ds.data;
		}
	}
	
	chartHasBackup(label, chartLabel) {
		let ds = this.chartDataset(label, chartLabel);
		return !!ds?.dataBackup;
	}
	
	chartRestoreTicks(label, chartLabel) {
		let ds = this.chartDataset(label, chartLabel);
		if (ds?.dataBackup) {
			ds.data = ds.dataBackup;
			delete ds.dataBackup;
		}
	}
	
	chartBackupRestore(chartLabel) {
		const labels = this.chartDatasets(chartLabel);
		for (let label of labels) {
			this.chartRestoreTicks(label, chartLabel);
		}
		this.chartUpdate(chartLabel);
	}
	
	chartAction(chartLabel, {action, data, status}) {
		if (action == 'data_set') {
			for (let ds in data) {
				this.chartRestoreTicks(ds, chartLabel);
			}
			for (let [ds, ticks] of Object.entries(data)) {
				if (this.chartHasBackup(ds, chartLabel)) {
					continue;
				}
				this.chartBackupTicks(ds, chartLabel);
				this.chartSetTicks(ds, ticks, chartLabel);
			}
			this.chartUpdate(chartLabel);
			for (const [field, value] of Object.entries(status)) {
				this.setTableField('status', field, value);
			}
		}
	}
	
	clearTableField(tableId, field) {
		clearTableField(tableId, field);
	}
	
	setTableField(tableId, field, ...value) {
		setTableField(tableId, field, ...value);
	}
	
	showNLV(snlv, nlvColor) {
		showNLV(snlv, nlvColor);
	}
	
	chartInit = (chartLabel, prevLabel, firstTime) => {
		let timeLabel = `chartInit ${chartLabel}`;
		console.time(timeLabel);
		this.chartLabel = chartLabel;
	this.chartLabel = chartLabel;
	this.prevLabel = prevLabel;
	this.firstTime = firstTime;
		this.charts[chartLabel] = {
			label: chartLabel,
			prevLabel,
			firstTime,
			dataBuffer: {},
			updateCounters:
				Object.keys(this.updateFrequency)
					.reduce((a, b) => {a[b] = 0; return a;}, {}),
			initialized: false,
		};
		let chartInfo = this.charts[chartLabel];
		let additionalPlugins = {
			afterInit: (chart, args, options) => {
				if (!chartInfo.initialized) {
					const pointValue = (point) => {
						return chart.data.datasets[point.datasetIndex].data[point.index];
					};
					chart.ctx.canvas.onclick = (evt) => {
						let points = chart.getElementsAtEventForMode(evt, 'point', { intersect: true }, true)
							.map(pointValue)
							.filter(point => {return 'onclick' in point;});
						points.forEach(point => {
							this.chartAction(chartLabel, point.onclick);
						});
					};
					Object.assign(
						chartInfo,
						{
							chart,
							id: chart.id,
							initialized: true,
						},
					);
					console.timeEnd(timeLabel);
					this.lobClient.quoteGetAll(this.config.trader_tid, this.config.instrument, null, 'sent')
					.then(quotes => {
						for (let [label, quote] of Object.entries(quotes)) {
							if (!quote) {
								continue;
							}
							this._chartPushTicks(
								label,
								chartLabel,
								{x: firstTime, y: quote.price},
								{x: firstTime + 1, y: quote.price, sentinel: true},
							);
						}
					});
				}
				// todo: do this independently
				this._chartPushTicks(
					'title',
					chartLabel,
					{
						x: firstTime,
						y: 0,
						label: {
							text: chartLabel,
						},
					},
				);
				this.chartLoadBuffer(chartLabel);
			},
			beforeUpdate: (chart, args, options) => {
				this.lobClient.strategy_hook_beforeUpdateChart(chartLabel)
				.then(data => {
					let chartInfo = this.getChartInfo(chartLabel);
					let sentinelTime = chartInfo.lastTime || data.now;
					chart.data.datasets.forEach(
						ds => {
							if (ds.data && ds.data.length && ds.data.at(-1).y) {
								let last = ds.data.at(-1);
								if (last.sentinel) {
									last.x = sentinelTime;
								}
							}
						}
					);
					let counters = chartInfo.updateCounters;
					Object.keys(counters)
						.map(key => {counters[key] = 0;});
				});
				return true;
			},
			afterUpdate: (chart, args, options) => {
				chartInfo.updating = false;
				return true;
			}
		};
		
		const tabLabel = `${this.strategy}/${chartLabel}`;
		let tab = sqlConsole.tabSearch(tabLabel);
		let tabInfo = sqlConsole.tabInfo(tab);
		if (!tabInfo) {
			[tab, tabInfo] = sqlConsole.createTab(
				chartLabel, `
				<div class="query-container">
					<div style="height: 90%;">
						<canvas class="chart-${chartLabel}" height="100%"></canvas>
					</div>
					<div class="buttons" style="height: 10%;">
						<button class="manual-quote">manual quote</button>
						<button class="study-bid">🧐 bid</button>
						<button class="study-ask">🧐 ask</button>
						<button class="backup-restore">🔁 restore</button>
						<button class="chart-copy">📈 copy</button>
					</div>
				</div>`, {
					withClose: true,
					searchTag: tabLabel,
				}
			);
			const buttonsDiv = tabInfo.querySelector('div.buttons');
			this.lobClient.strategy_getButtons()
			.then(buttons => {
				for (const [key, info] of Object.entries(buttons)) {
					buttonsDiv.insertAdjacentHTML(
						'beforeend',
						`<button class="${key}">${info.label}</button>`
					);
					tabInfo.querySelector('button.' + key).addEventListener(
						'click',
						e => {
							const strategy = SimuStrategy.getStrategy(this.strategy);
							const listener = strategy[info.listener];
							listener(e, this, chartLabel);
						}
					);
				}
			});
			tabInfo.querySelector('button.study-bid').addEventListener(
				'click',
				e => {this.studySide('bid', chartLabel);}
			);
			tabInfo.querySelector('button.study-ask').addEventListener(
				'click',
				e => {this.studySide('ask', chartLabel);}
			);
			tabInfo.querySelector('button.backup-restore').addEventListener(
				'click',
				e => {this.chartBackupRestore(chartLabel);}
			);
			tabInfo.querySelector('button.chart-copy').addEventListener(
				'click',
				e => {this.chartCopy(chartLabel);}
			);
			tabInfo.querySelector('button.manual-quote').addEventListener(
				'click',
				e => {this.manualQuote();}
			);
			sqlConsole.tabActivate(tab);
 		}
		let canvas = tabInfo?.querySelector('canvas');
		const observer = new ResizeObserver((entries) => {
			canvas.width = canvas.clientWidth;
			canvas.height = canvas.clientHeight;
		});
		observer.observe(canvas);
		let chartConfig = this.chartConfig(this.decimalDigits);
		chartConfig.data = {
			datasets: this.chartBuildDataset()};
		chartConfig.plugins.push(additionalPlugins);
		chartConfig.options.plugins.title.text = chartLabel;
		new Chart(canvas.getContext("2d"), chartConfig);
	}
	
	afterTicks(chartLabel, lastTime) {
console.log('afterTicks', chartLabel, lastTime);
		let chartInfo = this.getChartInfo(chartLabel);
		chartInfo.lastTime = lastTime;
		for (let label of Object.keys(this.chartIndex)) {
			let data = this.chartData(label, chartLabel);
			if (data && data.length) {
				data.at(-1).sentinel = undefined;
			}
		}
		if (this.loading) {
			this.loading.style.display = 'none';
		}
		if (this.paused) {
			this.paused.style.display = 'none';
		}
	}
	
	logHtml({cssClass, args}) {
		return logHtml(cssClass, args);
	}
};
