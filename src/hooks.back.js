
'use strict';

let simuDefaults = {
	capital: 22000,
	bidPercent: [
			'percent of capital to be initially invested',
			'90%',
		],
	minProfit: [
			'minimum profit for a trade',
			5,
		],
	nEvt: [
			'number of evt to check',
			1,
		],
	nSteps: 3,
	//percent of delta
	avgChangeTreshold: [
			'avg change needed to change quote',
			0.1,
		],
	//todo implement
	quoteModifyTreshold: [
			'percent of template change to justify quote modification',
			0.1,
		],
	fulfillRecycle: [
			'recycle fulfilled quote if no other plan',
			0,
		],
	//percent of qty
	qtyChangeTolerance: [
			'qty change toleration if needed for position',
			0.1,
		],
	stepsInDelta: [ //todo test
			'ratio of the ev delta to one step',
			2.5,
		],
	templateCreator: [
			'quote template creator',
			'qtyHalveByLevel*',
		],
	stickToLast: [
			'stick the avg to the last value',
			'yes*',
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
}

var templateCreator_options = {};

class templateCreator {
	
	static initOptions() {
		templateCreator_options[this.name] = [this.title, this];
	}
	
	static minStep(qty, price, nSteps, minProfit, commission_params) {
		let oneqty = this.oneqty(qty, nSteps);
		let commission = commission_calc(oneqty, price, commission_params);
		//minProfit == step * oneqty - commission'
		let step = (minProfit + commission) / oneqty;
setTableField('status', 'oneqty', oneqty);
setTableField('status', 'price', price);
setTableField('status', 'commission', commission);
setTableField('status', 'step', step);
		return step;
	}
	
	static testStep(qty, price, nSteps, step, commission_params) {
		let oneqty = this.oneqty(qty, nSteps);
		let commission = commission_calc(oneqty, price, commission_params);
		return step * oneqty - commission;
	}
};

class qtySpreadEven extends templateCreator {
	
	static title = 'same qty on each level';
	
	static {
		this.initOptions();
	}
	
	static oneqty(qty, nSteps) {
		return Math.floor(qty / nSteps);
	}
	
	static create(simu, avg, nSteps, step, qty) {
		let template = {};
		let levelQty = this.oneqty(qty, nSteps);
setTableField('status', 'avg', avg);
		for (let c = 0; c < nSteps; ++c) {
			let level = step * (c + 1) / 2;
			//let ix = nSteps - c - 1;
			let ix = c;
			template[`bid_${ix}`] = {
				price: avg - level,
				qty: levelQty,
			};
setTableField('status', `bid_${ix}`, `${levelQty} @ ${avg - level} (${levelQty * level})`);
			template[`ask_${ix}`] = {
				price: avg + level,
				qty: levelQty,
			};
//setTableField('status', `ask_${ix}`, `${levelQty} @ ${avg + level} (${levelQty * level})`);
		}
		return template;
	}
};

class qtyHalveByLevel extends templateCreator {
	//constant qty * price
	static title = 'half the qty as level doubles';
	
	static {
		this.initOptions();
	}
	
	static oneqty(qty, nSteps) {
		// sum of powers
		return Math.floor(qty / (2 ** nSteps - 1));
	}
	
	static create(simu, avg, nSteps, step, qty) {
		let template = {};
		let oneqty = this.oneqty(qty, nSteps);
setTableField('status', 'avg', avg);
		for (let c = 0; c < nSteps; ++c) {
			//let level = step * (c + 1) / 2;
			let level = step * 2 ** c / 2;
			let levelQty = oneqty * 2 ** (nSteps - c - 1);
			//let ix = nSteps - c - 1;
			let ix = c;
			template[`bid_${ix}`] = {
				price: avg - level,
				qty: levelQty,
			};
setTableField('status', `bid_${ix}`, `${levelQty} @ ${avg - level} (${levelQty * level})`);
			template[`ask_${ix}`] = {
				price: avg + level,
				qty: levelQty,
			};
//setTableField('status', `ask_${ix}`, `${levelQty} @ ${avg + level} (${levelQty * level})`);
		}
		return template;
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
	templates: {
		borderColor: 'purple',
		pointStyle: 'cross',
	}
};

function afterInit_hook(simu) {
	let result = new Promise((resolve, reject) => {
	simu.instrument = 'IVE';
	simu.currency = 'USD';
	simu.commission_data = commission_params;
	simu.createInstrument(
		simu.instrument, simu.currency);
	simu.market_tid = simu.createTrader(
		'market', null, simu.currency, simu.commission_data);
	simu.trader_tid = simu.createTrader(
		'trader', null, simu.currency, simu.commission_data);
	simu.trader_quotes[simu.instrument] = {};
	simu.derailedLabels[simu.instrument] = {};
	simu.config = {};
	resolve('afterInit_hook');
	});
	return result;
}

function newChartStart_hook(simu) {
	//todo withdraw the profit
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

function loadConfig(simu) {
	let tableRows = [];
	let configTable = document.querySelector('#config');
	for (let [key, value] of Object.entries(simuDefaults)) {
		let val = inputScalar(
			'config', key,
			(Array.isArray(value) ? value[1] : value).toString()
		);
		simu.config[key] = val;
		let label = Array.isArray(value) ? value[0] : key;
		let field = null;
		if (`${key}_options` in window) {
			let options = window[`${key}_options`];
			console.warn(options);
			field = Object.entries(options)
				.map(entry => {
					let [k, v] = entry;
					v = v[0];
					let checked = (k == simu.config[key]);
					return `<option value="${k}*" ${checked ? 'selected ' : ''}>${v}</option>`;
				})
				.reduce((a, b) => a + '\n' + b, `<select class="${key}">`)
				+ '\n</select>';
		}
		else {
			//todo maybe put 'value' here, to preserve %
			field = `<input class="${key}" value="${simu.config[key]}" style="width:100%" />`;
		}
		let row =
			`<tr>
				<td style="width:70%">${label}</td>
				<td style="width:30%">${field}</td>
			</tr>`;
		tableRows.push(row);
	}
	configTable.textContent = '';
	for (let row of tableRows) {
		configTable.insertAdjacentHTML('beforeend', row);
	}
	simu.templateCreator = templateCreator_options[simu.config.templateCreator][1];
	simu.stickToLast = stickToLast_options[simu.config.stickToLast][1];
}

function afterDataSets_hook(simu) {
	let loading = document.querySelector('#loading');
	if (loading) {
		loading.style.display = 'block';
	}
	loadConfig(simu);
	showNLV(simu);
	simu.branches = [...simu.core_branches];
	let ix = simu.branches.length;
	simu.trader_orders = [];
	simu.ev_branches = ['ev', 'peaks', 'valleys', 'templates'];
	for (let branch of simu.ev_branches) {
		let dataset = {
			type: 'line',
			label: branch,
			beginAtZero: false,
			data: [],
			id: `id_${branch}`,
			stepped: false,
			//hidden: true,
			pointStyle: 'crossRot',
			pointRadius: 0,
		};
		objectUpdate(
			dataset, chartStyles[branch] || {});
		simu.chart.data.datasets[ix] = dataset;
		simu.branches.push(branch);
		simu[`${branch}_ix`] = ix;
		++ix;
	}
	for (let side of simu.valid_sides) {
		for (let c=0; c < simu.config.nSteps; ++c) {
			let branch = `${side}_${c}`;
			let dataset = {
				type: 'line',
				label: branch,
				beginAtZero: false,
				data: [],
				id: `id_${branch}`,
				stepped: true,
				spanGaps: false,
				hidden: false,
				borderColor: side == 'ask' ? 'red' : 'blue',
				borderDash: [8 / (c + 1), 3],
				borderWidth: 2 / (c + 1),
				pointStyle: 'crossRot',
			};
			simu.chart.data.datasets[ix] = dataset;
			simu.trader_orders.push(branch);
			simu.branches.push(branch);
			simu.order_branches.push(branch);
			simu[`${branch}_ix`] = ix;
			++ix;
		}
	}
	simu.traderBalanceReset(simu.market_tid, simu.instrument);
	simu.traderBalanceReset(simu.market_tid, simu.currency);
	simu.traderBalanceReset(simu.trader_tid, simu.instrument);
	simu.traderBalanceReset(simu.trader_tid, simu.currency);
	simu.traderTransfer(
		simu.trader_tid, simu.currency, simu.config.capital);
	simu.traderTransfer(
		simu.trader_tid, simu.instrument, 0);
	
	//operational values. organize per instrument
	simu.lastTicks = [];
	simu.allev2 = [];
	simu.avg = null;
	simu.quotes_template = {};
	simu.quotes_template[simu.instrument] = {};
	for (let label of simu.trader_orders) {
		simu.quotes_template[simu.instrument][label] = {};
	}
	simu.balance = {};
	simu.checkingBalance = {};
}

function afterTicks_hook(simu) {
	simu.traderGetBalance(simu.trader_tid);
	plot_orders(simu);
	let loading = document.querySelector('#loading');
	if (loading) {
		loading.style.display = 'none';
	}
	if (!simu.verbose) {
		simu.order_log_show();
	}
}

function showNLV(simu, withBalance=false) {
	let nlv;
	try {
		//todo: calc at best price and cache
		nlv = simu.balance[simu.instrument].value +
			simu.balance[simu.currency].value;
	}
	catch {
		nlv = simu.config.capital;
	}
	let snlv = nlv.toLocaleString(
		undefined, {style:"currency", currency:simu.currency});
	warn('nlv:', snlv);
	let element = document.querySelector('#nlv');
	element.textContent = '';
	element.insertAdjacentHTML(
		'beforeend', `<div style="color: ${nlv < simu.config.capital ? 'red' : 'green'}">${snlv}</div>`
	);
	if (withBalance) {
		simu.logobj(simu.instrument, simu.balance[simu.instrument]);
		simu.logobj(simu.currency, simu.balance[simu.currency]);
	}
}

function plot_orders(simu) {
	let trader_quotes = simu.trader_quotes[simu.instrument];
//console.warn(trader_quotes);
	let quotes_template = simu.quotes_template[simu.instrument];
//let dta = simu.chart.data.datasets[simu.ask_0_ix].data;
//console.warn('ask_0 @ plot', dta ? dta[dta.length - 1] : null);
	for (let branch of simu.trader_orders) {
		let branch_ix = simu[`${branch}_ix`];
		if (branch in trader_quotes) {
			let data = simu.chart.data.datasets[branch_ix].data;
			if (0&&data && data.length && data[data.length - 1].y) {
				let last = data[data.length - 1];
				if (last.sentinel) {
					last.x = simu.getTime();
				}
				else {
					let quote = trader_quotes[branch];
					data.push({
						x: simu.getTime(),
						y: quote.price,
						sentinel: true,
					});
console.warn(branch, 'sentinel')
//simu.print(simu.instrument);
				}
			}
		}
		if (branch in quotes_template) {
			simu.chart.data.datasets[branch_ix].data
				.push({
					x: simu.getTime(),
					y: quotes_template[branch].price
				});
		}
	}
	showNLV(simu, true);
	//todo fix this. maybe split charts
	simu.chart.data.datasets[simu.balance_ix].data
		.push({x: simu.getTime(), y: nlv});
	simu.chart.update('quiet');
}

function avgCalc(xyList, stickToLast=false, delta) {
	let avg = xyList
		.map(one => one.y)
		.reduce((a, b) => a + b, 0)
		/ (xyList.length || 1);
	if (stickToLast) {
		let lastPt = xyList[xyList.length-1];
		if (lastPt.y > avg) {
			avg = lastPt.y - delta / 2;
		}
		else if (lastPt.y < avg) {
			avg = lastPt.y + delta / 2;
		}
	}
	return avg;
}

function setLastPrice_hook(simu, instrument, price) {
	//console.time('setLastPrice');
	let thinTick = {x: simu.getTime(), y: price};
	
	simu.chart.data.datasets[simu.price_ix].data.push(thinTick);
	simu.lastTicks.push(thinTick);
	let allev2 = [];

	let qty = Math.floor(
		simu.config.capital * simu.config.bidPercent / price);
	
	//console.time('commissionCalc');
	let step = simu.templateCreator.minStep(
		qty, price, simu.config.nSteps, simu.config.minProfit, simu.commission_data);
	//console.error(testStep(
	//	qty, price, simu.config.nSteps, step, simu.commission_data));
	
	//console.timeEnd('commissionCalc');
	let delta = simu.config.stepsInDelta * step;
setTableField('status', 'delta', delta);
	let [maxtab, mintab] = peakdet2(
		simu.lastTicks, delta, {getv: v => v.y, allev: allev2});
	allev2 = allev2.map(
		row => {
			return {
				x: row.x,
				y: row.y,
				///label: maxtab.includes(row) ? {text: '+', color: 'green'} : {text: '-', color: 'red'}
			};
		}
	);
	if (allev2.length >= (2 * simu.config.nEvt) && (
		//arrayCmp(simu.allev2, allev2)
		allev2.length > simu.allev2.length ||
		allev2[allev2.length-1] != simu.allev2[simu.allev2.length-1]
		)) {
		simu.allev2 = allev2.slice(-(2 * simu.config.nEvt));
		let fromX = simu.allev2[0].x;
		//todo replace this with allev2
		simu.lastTicks = simu.lastTicks.filter(one => one.x >= fromX);
		simu.chart.data.datasets[simu.ev_ix].data = simu.allev2;
		simu.chart.data.datasets[simu.valleys_ix].data = mintab;
		simu.chart.data.datasets[simu.peaks_ix].data = maxtab;
		
		let avg = avgCalc(simu.allev2, simu.stickToLast, step);
		//only if passes avgChangeTreshold
		if (avg && (!simu.avg || Math.abs(avg - simu.avg) / delta > simu.config.avgChangeTreshold)) {
			//todo move traderGetBalance call here and wait after template templateCreator
			//compare and do needed changes
			simu.avg = avg;
			let template = simu.templateCreator.create(
				simu, avg, simu.config.nSteps, step, qty);
			for (let [label, level] of Object.entries(template)) {
				let one_template = simu.quotes_template[instrument][label];
				if (one_template.checking) {
					setTimeout(() => {one_template.checking = false;}, simu.tickGap);
				}
				one_template.price = level.price;
				one_template.qty = level.qty;
				one_template.approved = false;
			}
			simu.traderGetBalance(simu.trader_tid);
			plot_orders(simu);
		}
	}
	//console.timeEnd('setLastPrice');
}

function orderFulfill_hook(simu, idNum, trader, qty, fulfilled, commission, price, instrument, label) {
	if (trader != simu.trader_tid) {
		return;
	}
	if (!simu.config.fulfillRecycle) {
		return;
	}
	//maybe re asess the orders approval
	if (instrument && label) {
		let quote_ix = simu.quotesQueue.findIndex(
			quote => quote[1] == instrument && quote[2] == label);
		let template = simu.quotes_template[instrument][label];
		if (quote_ix < 0 && !template.checking && template.approved) {
			let info = simu.findOrder(idNum);
			template.qty = info.qty;
			template.price = info.price;
			template.approved = false;
			simu.traderGetBalance(simu.trader_tid);
		}
	}
}

function traderBalance_hook(simu, instrument, amount, lastprice, value, liquidation) {
	while (instrument in simu.checkingBalance) {
		setTimeout(() => {}, simu.tickGap);
	}
	simu.checkingBalance[instrument] = true;
	simu.balance[instrument] = {amount, lastprice, value, liquidation};
	let side, checkAmount, adjustAmount;
	if (instrument == simu.currency) {
		side = 'bid';
		checkAmount = template => template.qty * template.price;
		adjustAmount = (template, amt) => {template.qty = Math.floor(amt / template.price)};
	}
	else if (instrument == simu.instrument) {
		side = 'ask';
		checkAmount = template => template.qty;
		adjustAmount = (template, amt) => {template.qty = Math.floor(amt)};
	}
	let quotes_template = simu.quotes_template[simu.instrument];
	let trader_quotes = simu.trader_quotes[simu.instrument];
	if (side && Object.keys(quotes_template).length) {
		for (let label of simu.trader_orders) {
			if (amount <= 0) {
				break;
			}
			if (label.slice(0, 3) != side) {
				continue;
			}
			if (!(label in quotes_template)) {
				continue;
			}
			let template = quotes_template[label];
			if (template.approved) {
				continue;
			}
			template.checking = true;
			let amt = checkAmount(template);
			let quoteAmt = 0;
			if (label in trader_quotes) {
				quoteAmt = checkAmount(trader_quotes[label]);
			}
			if (amt - quoteAmt > amount) {
				if ((amt - quoteAmt - amount) / amt > simu.config.qtyChangeTolerance) {
					continue;
				}
				amt = amount + quoteAmt;
				adjustAmount(template, amt);

			}
			amount -= amt;
			simu.quotesQueueLock();
			let quote = [
				simu.trader_tid, simu.instrument,
				label, side, template.qty, template.price,
			];
			//on the way to quote.
			delete simu.derailedLabels[simu.instrument][label];
			let quote_ix = simu.quotesQueue.findIndex(
				quote => quote[1] == simu.instrument && quote[2] == label);
			if (quote_ix >= 0) {
				simu.quotesQueue[quote_ix] = quote;
			}
			else {
				simu.quotesQueue.push(quote);
			}
			simu.quotesQueueLock(false);
			template.checking = false;
			template.approved = true;
		}
	}
	delete simu.checkingBalance[instrument];
	//simu.logobj([instrument, {amount}]);
}

