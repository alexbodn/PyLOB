
'use strict';

let simuDefaults = {
	capital: 22000,
	bidPercent: [
			'percent of capital to be spent',
			'70%',
		],
	minProfit: [ //todo use change percent
			'minimum profit for a trade',
			10,
		],
	minProfitTolerance: [
			'percent of minProfit to be accepted',
			'80%'
		],
	evForPriceAvg: [
			'number of ev for price average',
			1
		],
	evForPriceDelta: [
			'number of ev for price delta',
			2
		],
	priceDeltaMultiplier: [
		'multiplies the calculated priceDelta',
		1
	],
	ignoreOffTime: [
			'ignore time diff while offtime',
			1
		],
	nSteps: 6,
	//percent of the previous avg
	avgChangeThreshold: [
			'avg change needed to change quote (in chips)',
			10,
		],
	quoteModifyThreshold: [
			'percent of template change to justify quote modification (todo)',
			0.1,
		],
	fulfillRecycle: [
		//todo fulfill should approve opposite
			'recycle fulfilled quote if no other plan',
			0,
		],
	//percent of qty
	qtyChangeTolerance: [
			'qty change toleration if needed for position',
			0.1,
		],
	deltaIsMedianStep: [
			'calculate delta as the median step',
			'yes*'
		],
	stepsInDelta: [
			'ratio of the ev delta to one step',
			2,
		],
	steepTime: [
			'do nothing with evt closer than',
			//0,
			2 * 60 * 1000,
		],
	staleTime: [
			'ignore older ev',
			//0,
			2 * 3600 * 1000,
		],
	balanceTTL: [
			'use cache before it elapses',
			//todo: should check if implemented
			2 * 60 * 1000,
		],
	templateCreator: [
			'quote template creator',
			'arithmeticSequence*',
		],
	stickToLast: [
			'stick the avg to the last value',
			'yes*',
		],
	dynamicStep: [
			'calculate step based on price change',
			'yes*',
		],
	pastTimeScale: [
			'the scale to display time in the past',
			0.2,
		],
};

var stickToLast_options = {
	yes: [
			'stick average to last value',
			1,
		],
	no: [
			'calc an arithmetic average',
			0,
		],
};

var dynamicStep_options = {
	yes: [
			'calculate step based on price change',
			1,
		],
	no: [
			'use initially calculated step',
			0,
		],
};

var deltaIsMedianStep_options = {
	yes: [
			'calculate delta as the median step',
			1
		],
	no: [
			'use other way',
			0
		],
};

var templateCreator_options = {};

class templateCreator {
	
	static initOptions() {
		templateCreator_options[this.name] = [this.title, this];
	}
	
	minStep(qty, price) {
		let minProfit = this.simu.config.minProfit;
		let firstQty = this.qtyChunk(qty);
		let commission = commission_calc(
			firstQty, price, this.simu.commission_data);
		let step = (minProfit + commission) / firstQty;
		return step;
	}
	
	testStep(qty, price, step) {
		let firstQty = this.qtyChunk(qty);
		return this.calcProfit(firstQty, price, step);
		let commission = commission_calc(
			firstQty, price, this.simu.commission_data);
		let minProfit = step * firstQty - commission;
		return minProfit;
	}
	
	calcProfit(qty, price, step) {
		let commission = commission_calc(
			qty, price, this.simu.commission_data);
		let profit = step * qty - commission;
		return profit;
	}
	
	isProfitable(qty, step, price) {
		if (qty <= 0) {
			return false;
		}
		let minProfit = this.simu.config.minProfit;
		let profit = this.calcProfit(qty, price, step);
		return profit >= minProfit * this.simu.config.minProfitTolerance;
	}
	
	medianSpread(minStep) {
		let nSteps = this.simu.config.nSteps;
		let nStep = Math.floor(nSteps / 2);
		let spread = minStep * this.priceMultipliers[nStep];
		if (!(nSteps % 2)) {
			let spread2 = minStep * this.priceMultipliers[nStep + 1];
			spread = (spread + spread2) / 2;
		}
		return spread;
	}
	
	deltaFromStep(step) {
		let delta =
			this.simu.deltaIsMedianStep
			? this.medianSpread(step)
			: this.simu.config.stepsInDelta * step;
		return delta;
	}
	
	stepFromDelta(delta) {
		let step =
			this.simu.deltaIsMedianStep
			? delta / this.simu.config.nSteps * 2
			: delta / this.simu.config.stepsInDelta;
		return step;
	}
	
	qtyChunk(qty) {
		return Math.floor(qty / this.chunkDivisor);
	}
	
	priceMultipliers = undefined;
	qtyMultipliers = undefined;
	chunkDivisor = undefined;
	
	showMultipliers() {
		return;
		console.log(
			this.constructor.name,
			this.priceMultipliers,
			this.qtyMultipliers,
			this.chunkDivisor);
	}
	
	constructor(simu, nSteps) {
		this.simu = simu;
		this.nSteps = simu && 'config' in simu && 'nSteps' in simu.config ?
			simu.config.nSteps : nSteps;
	}
	
	createTemplate(avg, step, qty) {
		let template = {};
		const chunk = this.qtyChunk(qty);
//setTableField('status', 'avg', avg);
		for (let c = 0; c < this.simu.config.nSteps; ++c) {
			const level = step * this.priceMultipliers[c] / 2 * this.simu.config.priceDeltaMultiplier;
			const levelQty = Math.floor(chunk * this.qtyMultipliers[c]);
			template[`bid_${c}`] = {
				price: avg - level,
				qty: levelQty,
				step: level * 2,
			};
			Object.freeze(template[`bid_${c}`]);
//setTableField('status', `bid_${ix}`, `${levelQty} @ ${avg - level} (${levelQty * level})`);
			template[`ask_${c}`] = {
				price: avg + level,
				qty: levelQty,
				step: level * 2,
			};
			Object.freeze(template[`ask_${c}`]);
//setTableField('status', `ask_${ix}`, `${levelQty} @ ${avg + level} (${levelQty * level})`);
		}
//console.log(this.constructor.name, qty, chunk);
		return template;
	}
};

class harmonicSequence {
	
	// i've learned of the properties and formulae at
	// https://www.vedantu.com/maths/harmonic-sequence
	static multipliers(nSteps, d=1) {
		let a = 1;
		let arr = Array(nSteps);
		for (let n = 0; n < nSteps; ++n) {
			arr[n] = this.nth(n, d, a);
		}
		return arr;
	}
	
	static brutesum(nSteps, d=1, a=1) {
		//the only precise one
		return this.multipliers(nSteps).reduce((a, b) => a + b);
	}
	
	static sum(nSteps, d=1, a=1) {
		if (a == d) { //maybe another condition
			return this.brutesum(nSteps, d=1, a=1);
		}
		return Math.log(
			(2 * a + (2 * nSteps - 1) * d) / (2 * a - d)) / d;
	}
	
	static nth(n, d=1, a=1) {
		//1 / (a+n*d)
		return 1 / (a + d * n);
	}
};
/*
console.log(harmonicSequence.multipliers(4));
console.log(harmonicSequence.sum(4));
console.log(harmonicSequence.brutesum(4));
console.log(harmonicSequence.nth(3));
*/

class arithmeticSequence extends templateCreator {
	
	static title = 'arithmetic sequence of steps';
	
	static {
		this.initOptions();
	}
	
	constructor(simu, nSteps) {
		super(simu, nSteps);
		this.priceMultipliers = this.constructor.multipliers(this.nSteps);
		this.qtyMultipliers = harmonicSequence.multipliers(this.nSteps);
		this.chunkDivisor = this.constructor.qtyChunkDivisor(this.nSteps);
		this.showMultipliers();
	}
	
	static qtyChunkDivisor(nSteps) {
		return harmonicSequence.sum(nSteps);
	}
	
	static qtyStep(chunk, nSteps, c, d=1) {
		return Math.floor(chunk / (c + 1));
	}
	
	static oneqty(qty, nSteps) {
		return Math.floor(qty / nSteps);
	}
	
	static firstQty(qty, nSteps) {
		return this.oneqty(qty, nSteps);
	}
	
	static getSpread(minStep, nStep) {
		return minStep * (nStep + 1);
	}
	
	static multipliers(nSteps, d=1) {
		let a = 1;
		let arr = Array(nSteps);
		for (let n = 0; n < nSteps; ++n) {
			arr[n] = this.nth(n, d, a);
		}
		return arr;
	}
	
	static sum(nSteps, d=1, a=1) {
		//Sn = ½ n [ 2a + (n - 1)d ]
		return (nSteps / 2) * (2 * a + (nSteps - 1) * d);
	}
	
	static nth(n, d=1, a=1) {
		return a + d * n;
	}
	
	static create(simu, avg, step, qty) {
		let template = {};
		let nSteps = simu.config.nSteps;
		let levelQty = this.oneqty(qty, nSteps);
//setTableField('status', 'avg', avg);
		for (let c = 0; c < nSteps; ++c) {
			let level = step * (c + 1) / 2;
			let ix = c;
			template[`bid_${ix}`] = {
				price: avg - level,
				qty: levelQty,
			};
//setTableField('status', `bid_${ix}`, `${levelQty} @ ${avg - level} (${levelQty * level})`);
			template[`ask_${ix}`] = {
				price: avg + level,
				qty: levelQty,
			};
//setTableField('status', `ask_${ix}`, `${levelQty} @ ${avg + level} (${levelQty * level})`);
		}
		return template;
	}
};
/*
console.log('=', arithmeticSequence.qtyChunk(400, 4));
console.log(arithmeticSequence.multipliers(4));
console.log(arithmeticSequence.sum(4));
console.log(arithmeticSequence.nth(3));
*/
//let as = new arithmeticSequence(null, 5);

class fibonacciSequence extends templateCreator {
	//constant qty * price
	static title = 'fibonacci sequence of steps';
	
	static {
		this.initOptions();
	}
	
	constructor(simu, nSteps) {
		super(simu, nSteps);
		this.priceMultipliers = this.constructor.multipliers(this.nSteps);
		this.qtyMultipliers = this.priceMultipliers.map(n => 1 / n);
		this.chunkDivisor = this.constructor.qtyChunkDivisor(this.nSteps);
		this.showMultipliers();
	}
	
	static qtyChunkDivisor(nSteps) {
		return this.multipliers(nSteps).map(n => 1 / n).reduce((a, b) => a + b, 0);
	}
	
	static multipliers(nSteps) {
		let arr = [0, 1];
		while (nSteps--) {
			arr.push(arr[arr.length-2] + arr[arr.length-1]);
		}
		return arr.slice(2);
	}
	
	static brutesum(nSteps) {
		return this.multipliers(nSteps).reduce((a, b) => a + b, 0);
	}
	
	static nth(n) {
		let arr = this.multipliers(nSteps);
		return arr[arr.length-1];
	}
};
//console.log(fibonacciSequence.multipliers(8));
//let fs = new fibonacciSequence(null, 5);

class geometricSequence extends templateCreator {
	//constant qty * price
	static title = 'geometric sequence of steps';
	
	static {
		this.initOptions();
	}
	
	constructor(simu, nSteps) {
		super(simu, nSteps);
		this.priceMultipliers = this.constructor.multipliers(this.nSteps);
		this.qtyMultipliers = this.priceMultipliers.map(a => 1/a);
		this.chunkDivisor = this.constructor.qtyChunkDivisor(this.nSteps);
		this.showMultipliers();
	}
	
	static qtyChunkDivisor(nSteps) {
		return this.sum(nSteps, 1/2);
	}
	
	static qtyStep(chunk, nSteps, c, r=2) {
		return chunk * r ** (nSteps - c - 1);
	}
	
	static oneqty(qty, nSteps) {
		// sum of powers
		return Math.floor(qty / (2 ** nSteps - 1));
	}
	
	static firstQty(qty, nSteps) {
		return this.oneqty(qty, nSteps) * 2 ** (nSteps - 1);
	}
	
	static getSpread(minStep, nStep) {
		return minStep * 2 ** nStep;
	}
	
	static multipliers(nSteps, r=2) {
		let a = 1;
		let arr = Array(nSteps);
		for (let n = 0; n < nSteps; ++n) {
			arr[n] = this.nth(n, r, a);
		}
		return arr;
	}
	
	static sum(n, r=2, a=1) {
		//a(1 - rⁿ )/(1 – r)
		return a * (1 - r ** n) / (1 - r);
	}
	
	static nth(n, r=2, a=1) {
		return r ** n;
	}
	
	static create(simu, avg, step, qty) {
		let template = {};
		let nSteps = simu.config.nSteps;
		let oneqty = this.oneqty(qty, nSteps);
//setTableField('status', 'avg', avg);
		for (let c = 0; c < nSteps; ++c) {
			let level = step * 2 ** c / 2;
			let levelQty = oneqty * 2 ** (nSteps - c - 1);
			let ix = c;
			template[`bid_${ix}`] = {
				price: avg - level,
				qty: levelQty,
			};
//setTableField('status', `bid_${ix}`, `${levelQty} @ ${avg - level} (${levelQty * level})`);
			template[`ask_${ix}`] = {
				price: avg + level,
				qty: levelQty,
			};
//setTableField('status', `ask_${ix}`, `${levelQty} @ ${avg + level} (${levelQty * level})`);
		}
		return template;
	}
};
/*
console.log(geometricSequence.qtyChunk(400, 4));
console.log(geometricSequence.multipliers(4));
console.log(geometricSequence.sum(4));
console.log(geometricSequence.nth(3));
*/
//let gs = new geometricSequence(null, 5);

class templateQueue {
	
	busy = false;
	queue = [];
	template = null;
	waitTime = 1;
	
	constructor(simu) {
		this.simu = simu;
	}
	
	queueLock(lock=true) {
		if (lock) {
			let checkInterval = setInterval(() => {
				if (!this.busy) {
					this.busy = true;
					clearInterval(checkInterval);
				}
			}, this.waitTime);
		}
		else {
			this.busy = false;
		}
	}
	
	advance() {
		this.queueLock();
		if (this.queue.length && this.template) {
			let first = this.queue.shift();
			this.performCheckTemplate(first);
		}
		this.queueLock(false);
	}
	
	enQueue(data) {
		this.queueLock();
		let found = this.queue.findLastIndex(
			slot =>
			slot.instrument == data.instrument
		);
//		console.log('enQueue', JSON.stringify(this.queue), found, data);
		if (found < 0) {
			this.queue.push(data);
		}
		else {
			this.queue[found] = data;
		}
		this.queueLock(false);
		const advance = () => {this.advance();};
		setTimeout(advance, this.waitTime);
	}
	
	setTemplate(template) {
		this.queueLock();
		this.template = template;
		this.queueLock(false);
	}
	
	checkTemplate(instrument, amount, value, extra) {
		this.enQueue(
			{instrument, amount, value, extra},
		);
	}
	
	performCheckTemplate({instrument, amount, value, extra}) {
		if (!this.template) {
			return;
		}
		let side, checkAmount, adjustAmount, amountQty, amountValue;
		let sAmount, markedAmount;
		let quotes = [];
		const quoteActiveAmt = quote => (quote?.qty || 0) - (quote?.fulfilled || 0);
		let debug = (amount < 0);
		if (instrument == this.simu.currency) {
			side = 'bid';
			checkAmount = template => quoteActiveAmt(template) / template.price;
			adjustAmount = (template, amt) => Math.floor(amt / template.price);
			amountQty = (template, amt) => amt / template.price;
			amountValue = (template, amt) => amt;
			sAmount = amount.toLocaleString(
				undefined, {style:"currency", currency: this.simu.currency});
		}
		else if (instrument == this.simu.instrument) {
			side = 'ask';
			checkAmount = template => quoteActiveAmt(template);
			adjustAmount = (template, amt) => Math.floor(amt);
			amountQty = (template, amt) => amt;
			amountValue = (template, amt) => amt * template.price;
			let amount_value = value.toLocaleString(
				undefined, {style:"currency", currency: this.simu.currency});
			sAmount = `${amount} (${amount_value})`;
		}
		else {
			return;
		}
		let color = amount < 0 ? 'red' : 'green';
		let trader_quotes = this.simu.quoteGetAll(this.simu.trader_tid, this.simu.instrument, side, 'sent');
		let checkLabels = this.simu.trader_orders
			.filter(label => label.length > 0 && label.slice(0, 3) == side);
		let freeAmt =
			amountQty(this.template, amount) -
			checkLabels
				.filter(label => label in trader_quotes)
				.reduce((l, r) => l + quoteActiveAmt(trader_quotes[r]), 0)
			;
		if (debug) {
			console.log('sAmount', sAmount, 'freeAmt', freeAmt);
		}
		let now = this.simu.getTime();
		let sNow = formatDate(now);
		//console.log(instrument, sNow, extra, checkLabels, JSON.stringify(trader_quotes));
		for (let label of checkLabels) {
			let one_template = this.template[label];
			if (!one_template) {
				continue;
			}
			let templateAmt = quoteActiveAmt(one_template);
			let quoteAmt = (label in trader_quotes) ?
				quoteActiveAmt(trader_quotes[label]) : 0;
			let willAdd = templateAmt - quoteAmt;
			let available = freeAmt - willAdd;
			let cancelQuote = false;
			let qty = one_template.qty;
			if (available < 0) {
				let testQty = amountQty(one_template, templateAmt + available);
				let isProfitable = this.simu.templateCreator.isProfitable(
					testQty, one_template.step, one_template.price);
				if (!isProfitable) {
					if (label in trader_quotes) {
//						console.log('rejecting', one_template, templateAmt, available, trader_quotes[label]);
						cancelQuote = true;
					}
					else {
						this.simu._chartPushTicks(
							'ignored',
							extra.chartLabel,
							{branch: `${label}-`, x: now, y: one_template.price}
						);
						continue;
					}
				}
				else {
					/*if (-(available) / templateAmt > this.simu.config.qtyChangeTolerance) {
						continue;
					}*/
					templateAmt += available;
					available = 0;
					qty = adjustAmount(one_template, templateAmt);
				}
			}
			if (
				label in trader_quotes && !cancelQuote &&
				//todo allow only major enough changes in qty
				//qty == trader_quotes[label].qty &&
				one_template.price == trader_quotes[label].price
			) {
				this.simu._chartPushTicks(
					'ignored',
					extra.chartLabel,
					{branch: `${label}\\`, x: now, y: one_template.price}
				);
				continue;
			}
			freeAmt -= (templateAmt - quoteAmt);
			let quote = {
				trader: this.simu.trader_tid,
				instrument: this.simu.instrument,
				label,
				side,
				qty,
				price: one_template.price,
				isPrivate: true,
				cancelQuote,
			};
			quotes.push(quote);
		}
		this.simu.quotesQueueLock();
		for (let quote of quotes) {
			delete this.simu.derailedLabels[this.simu.instrument][quote.label];
			let quote_ix = this.simu.quotesQueue.findIndex(
				_quote => _quote.instrument == this.simu.instrument && _quote.label == quote.label);
			if (quote_ix < 0) {
				this.simu.quotesQueue.push(quote);
			}
			else {
				this.simu.quotesQueue[quote_ix] = quote;
			}
		}
//console.log(JSON.stringify(this.simu.quotesQueue));
		this.simu.quotesQueueLock(false);
		
		let ticks = {rejections: [], approuvals: []};
		for (let quote of quotes) {
			let tick = {branch: quote.label, x: now, y: quote.price};
			let key = quote.cancelQuote ? 'rejections' : 'approuvals';
			ticks[key].push(tick);
		}
		for (let [key, lst] of Object.entries(ticks)) {
			if (lst.length) {
				this.simu._chartPushTicks(key, extra.chartLabel, ...lst);
				//this.simu.logobj(key, lst);
			}
		}
		markedAmount = `<span style="color: ${color};">${sAmount}</span>`;
		setTableField('balance', instrument, markedAmount);
	}
};

function setTableField(tableId, field, value) {
	const rows = document.querySelectorAll(`#${tableId} tr.${field}`);
	rows.forEach(row => {
		row.remove();
	});
	const table = document.querySelector(`#${tableId}`);
	let row =
		`<tr class="${field}">
			<td>${field}</td>
			<td>${value}</td>
		</tr>`;
	table.insertAdjacentHTML('beforeend', row);
}

let chartStyles = {
	ev: {
		borderColor: 'yellow',
	},
	peaks: {
		borderColor: 'lightblue',
	},
	valleys: {
		borderColor: 'maroon',
	},
};

async function afterInit_hook(simu) {
	let result = new Promise((resolve, reject) => {
	simu.instrument = 'IVE';
	simu.currency = 'USD';
	simu.commission_data = commission_params;
	simu.createInstrument(
		simu.instrument, simu.currency,
		instrument_execution[simu.instrument]);
	simu.market_tid = simu.createTrader(
		'market', null, simu.currency, simu.commission_data);
	simu.trader_tid = simu.createTrader(
		'trader', null, simu.currency, simu.commission_data);
	simu.trader_quotes[simu.instrument] = {};
	simu.derailedLabels[simu.instrument] = {};
	simu.config = {};
	loadConfig(simu);
	
	for (let tid of [simu.market_tid, simu.trader_tid]) {
		for (let symbol of [simu.instrument, simu.currency]) {
			simu.traderFundsReset(tid, symbol);
		}
		simu.traderCashReset(tid, simu.currency);
	}
	simu.traderCashDeposit(
		simu.trader_tid, simu.currency, simu.config.capital);
	simu.traderFundDeposit(
		simu.trader_tid, simu.currency, simu.config.capital);

	//operational values. organize per instrument
	simu.lastTicks = [];
	simu.offGaps = [];
	simu.ev_branches = ['ev', 'peaks', 'valleys'];
	simu.allev2 = [];
	simu.avg = null;
	simu.trader_orders = [];
	for (let side of simu.valid_sides) {
		for (let c=0; c < simu.config.nSteps; ++c) {
			let label = `${side}_${c}`;
			simu.trader_orders.push(label);
		}
	}
	simu.balance = {};
	simu.templateQueue = {};
	simu.templateQueue[simu.instrument] = new templateQueue(simu);
	
	let updateFrequency = {
		ev: 3,
		templates: simu.config.nSteps,
		traderOrders: 1,
	};
	objectUpdate(simu.updateFrequency, updateFrequency);
	
	resolve();
	});
	return result;
}

function newChartStart_hook(simu) {
	//traderGetBalance(simu);
	traderGetNLV(simu);
	//todo withdraw realized profit
	if (simu.lastTicks.length) {
		let gap = [
			simu.lastTicks.at(-1).x,
			simu.getTime() - 1,
			null
		];
		gap[2] = gap[1] - gap[0];
		simu.offGaps.push(gap);
	}
	simu.pause(false);
}

function inputScalar(form, field, fallBack) {
	let value = null;
	let baseSelector = `#${form} .${field}`;
	let elem = document.querySelector(baseSelector + ' option:checked') ||
		document.querySelector(baseSelector);
	value = elem ? elem.value : fallBack;
	if (value) {
		let last = value.slice(-1);
		if ('%*'.includes(last)) {
			value = value.slice(0, -1);
		}
		if (last != '*') {
			value = parseFloat(value.replace(',', ''));
			if (last == '%') {
				value /= 100;
			}
		}
	}
	return value;
}

/*
simuDefaults = {
	"capital": 22000,
	"bidPercent": 0.7,
	"minProfit": 3,
	"minProfitTolerance": 0.8,
	"evForPriceAvg": 1,
	"evForPriceDelta": 5,
	"priceDeltaMultiplier": 1.5,
	"ignoreOffTime": 1,
	"nSteps": 20,
	"avgChangeThreshold": 10,
	"quoteModifyThreshold": 0.1,
	"fulfillRecycle": 0,
	"qtyChangeTolerance": 0.1,
	"deltaIsMedianStep": "yes",
	"stepsInDelta": 2,
	"steepTime": 0,
	"staleTime": 0,
	"balanceTTL": 120000,
	"templateCreator": "arithmeticSequence",
	"stickToLast": "yes",
	"dynamicStep": "yes",
	"pastTimeScale": 0.2
};

for (let [k, v] of Object.entries(simuDefaults)) {
	let options = window[k + '_options'];
	if (options) {
		console.log(options);
		if (v in options) {
			simuDefaults[k] = Array.isArray(options[v]) ? options[v][1] : options[v];
		}
		console.log(k, options, v, simuDefaults[k]);
	}
}
*/

function showConfig(simu) {
	let tableRows = [];
	let tab, tabInfo;
	tab = sqlConsole.tabSearch('simu_config');
	if (!tab) {
		[tab, tabInfo] = sqlConsole.createTab(
			'config', `
			<div>
			<table>
				<colgroup>
					<col style="width:70%">
					<col style="width:30%">
				</colgroup>
				<tbody>
				</tbody>
				<tfoot>
					<tr>
					<td>
						<!--button class="load-config">load</button-->
					</td>
					<td>
						<button class="copy-config">copy</button>
					</td>
					</tr>
				</tfoot>
			</table>
			</div>`, {
				searchTag: 'simu_config',
			}
		);
		//tabInfo.querySelector('button.load-config').addEventListener(
		//	'click', e => {loadConfig(simu);});
		tabInfo.querySelector('button.copy-config').addEventListener(
			'click', e => {let config = getConfig(); console.log(config);});
	}
	else {
		tabInfo = sqlConsole.tabInfo(tab);
	}
	let configTable = tabInfo.querySelector('tbody');
	for (let [key, value] of Object.entries(simuDefaults)) {
		let val = inputScalar(
			'config', key,
			(Array.isArray(value) ? value[1] : value).toString()
		);
		let label = Array.isArray(value) ? value[0] : key;
		let field = null;
		if (`${key}_options` in window) {
			let options = window[`${key}_options`];
			field = Object.entries(options)
				.map(entry => {
					let [k, v] = entry;
					v = v[0];
					let checked = (k == val);
					return `<option value="${k}*" ${checked ? 'selected ' : ''}>${v}</option>`;
				})
				.reduce((a, b) => a + '\n' + b, `<select class="${key}">`)
				+ '\n</select>';
		}
		else {
			//todo maybe put 'value' here, to preserve %
			field = `<input class="${key}" value="${val}" style="width:100%" />`;
		}
		let row =
			`<tr>
				<td>${label}</td>
				<td>${field}</td>
			</tr>`;
		tableRows.push(row);
	}
	configTable.textContent = '';
	for (let row of tableRows) {
		configTable.insertAdjacentHTML('beforeend', row);
	}
}

function loadConfig(simu) {
	let config = getDialogConfig();
	simu.config = config;
	let templateCreator_class = templateCreator_options[simu.config.templateCreator][1];
	simu.templateCreator = new templateCreator_class(simu);
	simu.stickToLast = stickToLast_options[simu.config.stickToLast][1];
	simu.dynamicStep = dynamicStep_options[simu.config.dynamicStep][1];
	simu.deltaIsMedianStep = deltaIsMedianStep_options[simu.config.deltaIsMedianStep][1];
	let rounder = simu.getRounder(simu.instrument);
	simu.setRounder(rounder);
	simu.avgChangeThreshold = simu.config.avgChangeThreshold / rounder;
}

function getDialogConfig() {
	let config = {};
	let tab = sqlConsole.tabSearch('simu_config');
	let configTable = sqlConsole.tabInfo(tab);
	configTable.querySelectorAll('input,select').forEach(input => {
		let key = input.classList[0];
		let value = input.value;
		let val = inputScalar(
			'config', key,
			(Array.isArray(value) ? value[1] : value).toString()
		);
		config[key] = val;
	});
	return config;
}

function makeDefaults(config) {
	let result = {};
	for (let [key, value] of Object.entries(simuDefaults)) {
		result[key] = value;
		let val = config[key];
		if (isString(val)) {
			val += '*';
		}
		if (Array.isArray(value)) {
			result[key][1] = val;
		}
		else {
			result[key] = val;
		}
	}
	return result;
}

function chartBuildDataset_hook(simu, datasets) {
	for (let branch of simu.ev_branches) {
		let dataset = {
			type: 'line',
			label: branch,
			beginAtZero: false,
			stepped: false,
			yAxisID: 'yPrices',
			spanGaps: false,
			//hidden: true,
			pointStyle: 'crossRot',
			pointRadius: 0,
			updateGroup: 'ev',
		};
		objectUpdate(
			dataset, chartStyles[branch] || {});
		datasets.push(dataset);
	}
	for (let branch of simu.trader_orders) {
		let [side, c] = branch.split('_');
		c = parseInt(c);
		let dataset = {
			type: 'line',
			label: branch,
			beginAtZero: false,
			yAxisID: 'yPrices',
			stepped: true,
			spanGaps: false,
			hidden: false,
			borderColor: side == 'ask' ? 'red' : 'blue',
			borderDash: [8 / (c + 1), 3],
			borderWidth: 1/*2 / (c + 1)*/,
			pointStyle: 'circle',
			pointRadius: 1,
			isQuote: true,
			updateGroup: 'traderOrders',
		};
		datasets.push(dataset);
	}

	const scatterTooltip = {
		callbacks: {
			label: ({parsed, formattedValue, dataset}) => {
				return `${dataset.emoji}/${parsed.branch}: ${formattedValue}`;
			},
		}
	};

	let dsTemplates = {
		type: 'scatter',
		label: 'templates',
		yAxisID: 'yPrices',
		pointStyle: 'circle',
		borderColor: 'yellow',
		borderWidth: 2,
		updateGroup: 'templates',
		emoji: '🙏',
		tooltip: scatterTooltip,
		order: 100,
	};
	datasets.push(dsTemplates);
	let dsApprouvals = {
		type: 'scatter',
		label: 'approuvals',
		yAxisID: 'yPrices',
		pointStyle: 'cross',
		borderColor: 'green',
		borderWidth: 2,
		updateGroup: 'templates',
		emoji: '👍',
		tooltip: scatterTooltip,
		order: 90,
	};
	datasets.push(dsApprouvals);
	let dsRejections = {
		type: 'scatter',
		label: 'rejections',
		yAxisID: 'yPrices',
		pointStyle: 'line',
		borderColor: 'red',
		borderWidth: 2,
		updateGroup: 'templates',
		emoji: '👎',
		tooltip: scatterTooltip,
		order: 90,
	};
	datasets.push(dsRejections);
	let dsIgnored = {
		type: 'scatter',
		label: 'ignored',
		yAxisID: 'yPrices',
		pointStyle: 'crossrot',
		borderColor: 'lightblue',
		borderWidth: 2,
		updateGroup: 'templates',
		emoji: '👋',
		tooltip: scatterTooltip,
		order: 90,
	};
	datasets.push(dsIgnored);
	let dsBalanceInstrument = {
		type: 'line',
		label: `value-${simu.instrument}`,
		yAxisID: 'yBalance',
		pointStyle: 'line',
		borderColor: 'blue',
		updateGroup: 'balance',
	};
	datasets.push(dsBalanceInstrument);
	let dsBalanceCurrency = {
		type: 'line',
		label: `value-${simu.currency}`,
		yAxisID: 'yBalance',
		pointStyle: 'line',
		borderColor: 'red',
		updateGroup: 'balance',
	};
	datasets.push(dsBalanceCurrency);
}

function beforeUpdateChart_hook(simu, chartLabel) {
}

function afterTicks_hook(simu, title) {
	traderGetBalance(simu, title);
	traderGetNLV(simu, title);
	if (!simu.verbose) {
		simu.order_log_show();
	}
	//console.log('afterTicks', title);
}

function showNLV(simu, nlv, extra) {
	//todo: if extra.chartLabel is the day before, show on both charts
	simu._chartPushTicks('nlv', extra.chartLabel, {x: simu.getTime(), y: nlv});
	let snlv = nlv.toLocaleString(
		undefined, {style:"currency", currency:simu.currency});
	warn(
		'nlv:', snlv, ',',
		...[simu.instrument, simu.currency]
		.map(
			symbol =>
			[
				symbol,
				(symbol in simu.balance ? simu.balance[symbol].amount : 0) || 0,
			])
		.reduce((a, b) => [...a, ',', ...b]),
	);
	let element = document.querySelector('#nlv');
	element.textContent = '';
	let nlvColor = nlv < simu.config.capital ? 'red' : 'green';
	element.insertAdjacentHTML(
		'beforeend',
		`<div style="color: ${nlvColor}">${snlv}</div>`
	);
}

function avgCalc(xyList, length) {
	if (typeof length !== 'undefined') {
		xyList = xyList.slice(-length);
	}
	let yS = xyList.map(one => one.y);
	let avg = yS.reduce((a, b) => a + b, 0) / (yS.length || 1);
	return avg;
}

function avgDiffCalc(mintab, maxtab, length) {
	let minLen = Math.min(mintab.length, maxtab.length);
	if (typeof length !== 'undefined') {
		minLen = Math.min(minLen, length);
	}
	let sumDiffs = 0;
	for (let c = 0; c < minLen; ++c) {
		sumDiffs += (
			maxtab[maxtab.length - 1 - c].y -
			mintab[mintab.length - 1 - c].y
		);
	}
	return sumDiffs / (minLen || 1);
}

function pastCompress(simu, ...xyLists) {
//console.log({gaps: simu.offGaps, firstTime: simu.firstTime});
	for (let xyList of xyLists) {
		for (let gap of simu.offGaps) {
			for (let c in xyList) {
				let one = xyList.at(c);
				if (one.x >= gap[0]) {
					break;
				}
				one = {...one, cow: true};
				if (!('label' in one)) {
					one.label = {
						text: '',
						color: 'green',
					};
				}
				else one.label.text += '\n';
				one.label.text += `was ${simu.dtFormat(one.x, luxon.DATETIME_SHORT)}`
				one.label.text += `\nnow ${simu.dtFormat(one.x + gap[2], luxon.DATETIME_SHORT)}`
				one.x += gap[2];
				xyList[c] = one;
			}
		}
	}
	for (let xyList of xyLists) {
		for (let c in xyList) {
			let one = xyList.at(c);
			if (one.x >= simu.firstTime) {
				break;
			}
			if (!one.cow) {
				one = {...one};
			}
			let fullDiff = simu.firstTime - one.x;
			one.originalX = one.x;
			one.x = simu.firstTime - simu.config.pastTimeScale * fullDiff;
			if (!one.cow) {
				xyList[c] = one;
			}
			one.timeInPast = true;
		}
	}
}

function avgPriceCalc(simu, xyList, delta) {
	let firstPt = xyList[0];
	let lastPt = xyList[xyList.length-1];
	let artificial1stY = 0;
	let avg = avgCalc(xyList);
	let keepDelta = false;
	if (!simu.stickToLast) {
		return [avg, keepDelta, artificial1stY];
	}
	let timeDiff = (lastPt.originalX || lastPt.x) - (firstPt.originalX || firstPt.x);
	if (timeDiff < simu.config.steepTime) {
		if (lastPt.y > avg + delta / 2) {
			//todo cancel asks?
			avg = lastPt.y + delta / 2;
			keepDelta = true;
		}
		else if (lastPt.y < avg - delta / 2) {
			//todo cancel bids?
			avg = lastPt.y - delta / 2;
			keepDelta = true;
		}
//console.log('steepTime', timeDiff);
	}
	if (timeDiff > simu.config.staleTime) {
		//TODO move firstPt to where y was lastPt.y -/+ delta.
		if (lastPt.y > avg + delta / 2) {
			avg = lastPt.y - delta / 2;
			artificial1stY = firstPt.y - delta;
			keepDelta = true;
		}
		else if (lastPt.y < avg - delta / 2) {
			avg = lastPt.y + delta / 2;
			artificial1stY = -(firstPt.y + delta);
			keepDelta = true;
		}
//console.log('staleTime', timeDiff);
	}
	return [avg, keepDelta, artificial1stY];
}

function tickMidPoint_hook(simu, instrument, price) {
	return;
	let thinTick = {x: simu.getTime(), y: price};
	
	//simu.chart.data.datasets[simu.midpoint_ix].data.push(thinTick);
	simu.chartPushTicks('midpoint', thinTick);
//setTableField('status', 'midpoint', price);
}

function setLastPrice_hook(simu, instrument, price) {
	//console.time('setLastPrice');
	let now = simu.getTime();
	let thinTick = {x: now, y: price};
	
	//simu.chart.data.datasets[simu.price_ix].data.push(thinTick);
	simu.chartPushTicks('price', thinTick);
//setTableField('status', 'price', price);
	//let freshStart = simu.getTime() - simu.config.staleTime;
	//simu.lastTicks = simu.lastTicks.filter(one => one.x >= freshStart);
	simu.lastTicks.push(thinTick);
	let allev2 = [];
	
	let qty = Math.floor(
		simu.config.capital * simu.config.bidPercent / price);
	
	//console.time('minStep');
	let step = simu.templateCreator.minStep(qty, price);
	//console.error(simu.templateCreator.testStep(qty, price, step));
	//console.timeEnd('minStep');
	let delta = simu.templateCreator.deltaFromStep(step);
//console.log('status', 'step-delta', `${step} -> ${delta}`);
	let [maxtab, mintab] = peakdet2(
		simu.lastTicks, delta, {getv: v => v.y, allev: allev2});
if (0) { // chart all ev calculated to date
let _allev2 = [];
let [_maxtab, _mintab] = peakdet2(
	//simu.chart.data.datasets[simu.price_ix].data,
	simu.chartData('price'),
	delta, {getv: v => v.y, allev: _allev2});
simu.chartSetTicks('ev', _allev2);
simu.chartSetTicks('valleys', _mintab);
simu.chartSetTicks('peaks', _maxtab);
}
//console.log(mintab, maxtab, allev2);
	if (
		allev2.length >= (2 * simu.config.evForPriceAvg) &&
// 		mintab.length >= simu.config.evForPriceDelta &&
// 		maxtab.length >= simu.config.evForPriceDelta &&
		(
			allev2.length > simu.allev2.length ||
			allev2.at(-1).y != simu.allev2.at(-1).y
		)) {
		allev2 = allev2.map(
			row => ({...row})
		);
		simu.allev2 = allev2.slice(-2 * simu.config.evForPriceAvg);
		mintab = mintab.slice(-simu.config.evForPriceDelta);
		maxtab = maxtab.slice(-simu.config.evForPriceDelta);
		let fromX = Math.min(
			simu.allev2.at(0).x,
			mintab.at(0).x,
			maxtab.at(0).x,
		);
		let [avg, keepDelta, artificial1stY] = avgPriceCalc(simu, allev2, delta);
		if (artificial1stY != 0) {
			let lastIx = simu.lastTicks.findLastIndex(
				tick => tick.x == simu.allev2.at(-1).x);
			if (artificial1stY < 0) {
				artificial1stY *= -1;
				while (lastIx) {
					if (simu.lastTicks.at(lastIx).y <= artificial1stY) {
						break;
					}
					--lastIx;
				}
			}
			else {
				while (lastIx) {
					if (simu.lastTicks.at(lastIx).y >= artificial1stY) {
						break;
					}
					--lastIx;
				}
			}
			fromX = Math.max(fromX, simu.lastTicks.at(lastIx).x);
		}
		simu.lastTicks = simu.lastTicks.filter(one => one.x >= fromX);
		let showAllev2 = simu.allev2.slice();
		pastCompress(simu, showAllev2, mintab, maxtab);
if (1) { // chart only these ev calculation
		simu.chartSetTicks('ev', showAllev2);
		if (artificial1stY != 0) {
//			simu.chartPushTicks('ev', {x: fromX, y: artificial1stY});
		}
		simu.chartSetTicks('valleys', mintab);
		simu.chartSetTicks('peaks', maxtab);
}
		
setTableField('status', 'avg', avg);
setTableField('status', 'delta', delta);
setTableField('status', 'step', step);
//simu.logobj(formatDate(simu.getTime()), allev2, avg);
		if (avg === null) {
			console.log('avgPriceCalc returned null');
			simu.cancelAllQuotes(trader_tid, instrument);
		}
		else if (!simu.avg || Math.abs(avg - simu.avg) / simu.avg > simu.avgChangeThreshold) {
/*console.log(
	'avg changed',
	avg, simu.avg,
	Math.abs(avg - simu.avg)// / simu.avg
	,
	simu.avgChangeThreshold,
	);*/
			if (simu.dynamicStep && !keepDelta) {
				let otherDelta = avgDiffCalc(
					mintab, maxtab, simu.config.evForPriceDelta);
				step = simu.templateCreator.stepFromDelta(otherDelta);
console.log('step changed:', simu.dynamicStep);
			}
			//compare and do needed changes
			simu.avg = avg;
console.log('mul', avg, simu.config.priceDeltaMultiplier);
			let template = simu.templateCreator.createTemplate(avg, step, qty);
			let events = {
				onclick: {
					action: 'data_set',
					data: {
						ev: showAllev2,
						valleys: mintab,
						peaks: maxtab,
					}
				},
			};
			let ticks = Object.entries(template).map(
				(one, ix) => {
				let [label, data] = one;
				return Object.assign(
					{
						x: now + ix,
						y: data.price,
						branch: label,
						/*label: {
							color: 'black',
							backgroudColor: 'light-green',
							text: label.replace(/(sk)|(id)_/g, ''),
						}*/
					},
					events);
			});
			simu.chartPushTicks('templates', ...ticks);
			template.price = price;
			simu.templateQueue[simu.instrument].setTemplate(template);
			traderGetBalance(simu);
		}
	}
	//console.timeEnd('setLastPrice');
}

function orderSent_hook(simu, trader, instrument, label, price) {
	if (trader != simu.trader_tid) {
		return;
	}
}

function orderFulfill_hook(simu, instrument, label, trader, qty, fulfilled, commission, price) {
}

function orderExecuted_hook(simu, instrument, label, trader, time, qty, price) {
	if (trader != simu.trader_tid) {
		return;
	}
	traderGetBalance(simu);
	traderGetNLV(simu);
}

function orderCancelled_hook(simu, instrument, label, trader, time) {
	if (trader != simu.trader_tid) {
		return;
	}
	traderGetBalance(simu);
}

function traderBalance_hook(simu, trader, instrument, amount, lastprice, value, liquidation, time, extra) {
	if (trader != simu.trader_tid) {
		return;
	}
	simu.balance[instrument] = {amount, lastprice, value, liquidation, time};
	simu.templateQueue[simu.instrument].checkTemplate(instrument, amount, value, Object.assign({time: formatDate(time)}, extra));
	//todo: if extra.chartLabel is the day before, show on both charts
	simu._chartPushTicks(`value-${instrument}`, extra.chartLabel, {x: time, y: value});
}

function traderNLV_hook(simu, trader, nlv, extra) {
	if (trader != simu.trader_tid) {
		return;
	}
	showNLV(simu, nlv, extra);
}

function traderGetBalance(simu, chartLabel) {
	for (let symbol of [simu.instrument, simu.currency]) {
		simu.traderGetBalance(simu.trader_tid, symbol, {chartLabel: chartLabel || simu.chartLabel});
	}
}

function traderGetNLV(simu, chartLabel) {
	simu.traderGetNLV(simu.trader_tid, {chartLabel: chartLabel || simu.chartLabel});
}
