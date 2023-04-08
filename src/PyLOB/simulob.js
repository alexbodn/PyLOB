
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
	if (ret != 0) {
		return ret;
	}
	for (let ix in a) {
		ret = cmp(a[ix], b[ix]);
		if (ret != 0) {
			return ret;
		}
	}
	return 0;
}

	function labelattr(context, attr)
	{
		let label = context.chart.data.datasets[context.datasetIndex].data[context.dataIndex].label;
		if (label) {
			return label[attr];
		}
		return null;
	}
		
	function inputNumber(id)
	{
		let value = null;
		let elem = document.getElementById(id);
		if (elem) {
			value = elem.value;
			if (value) {
				value = parseFloat(value.replace(',', ''));
			}
		}
		return value;
	}
	
function parseDate(dt) {
	let lx = luxon.DateTime.fromISO(
		dt.replace('Z', ''), {
			zone: 'America/New_York',
				setZone: true,
			}
		);
	return lx.toMillis();
}

class SimuLOB extends OrderBook {
	
	lastTicks = [];
	
	instrument = 'IVE';
	market_tid = undefined;
	trader_tid = undefined;
	market_ask_id = undefined;
	market_bid_id = undefined;
	
	price_branch = ['price'];
	market_orders = ['ask', 'bid'];
	ev_branches = ['ev', 'peaks', 'valleys'];
	trader_orders = ['sellall', 'sellhalf', 'buyhalf', 'buyall'];
	
	chartConfig = {
		type: 'line',
		plugins: [
			ChartDataLabels,
		],
		options: {
			animation: false,
			normalized: true,
			plugins: {
				datalabels: {
				backgroundColor: function(context) {
					return context.dataset.backgroundColor;
				},
				borderRadius: 4,
				color: function(context) {
					return labelattr(context, 'color');
				},
				//color: 'white',
				font: {
					weight: 'bold'
				},
				formatter: function(value, context) {
					//return value;
					return labelattr(context, 'text');
				},
				padding: 1
				}
			},
			scales: {
				x: {
					type: 'time',
					time: {
						unit: "minute",
						tooltipFormat: "HH:mm:ss.SSS",
						displayFormats: {
							millisecond: 'HH:mm:ss.SSS',
							'second': 'HH:mm:ss',
							'minute': 'HH:mm:ss',
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
						source: 'data'
					}
				},
			},
		},
		/*data: {
			datasets: []
		},*/
	};
	
	constructor(
			location, file_loader, db, 
			tick_size=0.0001, verbose=false, 
			chartElem,
			capital, 
			minprofit,
			nEvt=2,
	) {
		super(location, file_loader, db, tick_size, verbose);
		this.chartElem = chartElem;
		this.capital = capital || inputNumber('capital');
		this.minprofit = minprofit || inputNumber('minprofit');
		this.nEvt = nEvt;
		this.data_branches = this.price_branch
			.concat(this.market_orders);
		this.branches = this.data_branches
			.concat(this.ev_branches)
			.concat(this.trader_orders);
		for (let ix in this.branches) {
			this[`${this.branches[ix]}_ix`] = ix;
		}
		this.order_branches = this.trader_orders
			.concat(this.market_orders);
	}
	
	dataTicks(data) { // x, y, label,rowid
		console.time('data sort');
		let ticks = data
			.filter(branch=>this.data_branches.includes(branch.title))
			.map(
				branch=>branch
				.data
				.map(
					(datum, rowid)=>{
						datum.label = branch.title;
						datum.rowid = rowid;
						return datum;
					}
				)
			)
			.reduce((a, b)=>a.concat(b))
			.sort((a, b)=>objCmp(a, b, ['x', 'rowid']))
			;
		//logobj(ticks[0], ticks[ticks.length - 1]);
		console.timeEnd('data sort');
		return ticks;
	}
	
	run(data) { // x, y, label,rowid
		console.time('chart init');
		let hostElem = document.getElementById(this.chartElem);
		let config = Object.assign({}, this.chartConfig);
		config.plugins.push(...[{
			afterInit: (chart, args, options) => {
				for (let ix in this.branches) {
					let branch = this.branches[ix];
					console.log(branch, this.order_branches, branch in this.order_branches);
					chart.data.datasets[ix] = {
						label: branch,
						data: [],
						id: `id_${branch}`,
						stepped: (this.order_branches.includes(branch)),
					};
				}
//				chart.data.datasets[this.ask_ix].stepped = true;
//				chart.data.datasets[this.bid_ix].stepped = true;
				this.chart = chart;
				console.timeEnd('chart init');
				let ticks = this.dataTicks(data);
				this.loadTicks(ticks, chart);
			},
			beforeDraw: (chart, args, options) => {
				//let lastprice = chart.data.datasets[this.price_ix].data.slice(-1)[0];
				//console.log('last drawn price', lastprice.x);
			}
		}]);
		new Chart(hostElem, config);

		//this.loadTicks(ticks);
	}
	
	loadTicks(ticks, chart) {
		console.time('data process');
		this.createInstrument(this.instrument, 'USD');
		this.market_tid = this.createTrader(
			'market', null, 'USD', 0.01, 2.5, 1);
		this.trader_tid = this.createTrader(
			'trader', null, 'USD', 0.01, 2.5, 1);
		this.commission_data = this.commissionData(
			this.trader_tid, this.instrument);

		let sent = 0, iter = 0;
		let simu = this;
		let current = {};
		let tickInterval = setInterval (
			(simu, ticks, current) =>
		/*for (let tick of ticks) */
		{
			if (!ticks.length) {
				clearInterval(tickInterval);
				tickInterval = 0;
				error('sent:', sent, '/ iter:', iter);
				console.timeEnd('data process');
				simu.chart.update();
				let loading = document.getElementById('loading');
				if (loading) {
					loading.style.display = 'none';
				}
				return;
			}
			let tick = ticks.shift();
			
			++iter;
			if (!tick.y || tick.y == current[tick.label]) {
				//continue;
				return;
			}
			current[tick.label] = tick.y;
			tick.x = simu.updateTime(parseDate(tick.x));
			let dset = simu[`${tick.label}_ix`];
			if (1 && tick.label != 'price') {
				let thinTick = {x: tick.x, y: tick.y};
				simu.chart.data.datasets[dset].data.push(thinTick);
			}
			++sent;
			
			if (tick.label == 'price') {
				simu.setLastPrice(simu.instrument, tick.y);
			}
			if (tick.label == 'ask') {
				if (simu.market_ask_id == undefined) {
					let quote;
					[simu.market_ask_id, quote] = simu.createQuote(
						simu.market_tid, simu.instrument, tick.label, 1000000, tick.y);
					simu.processOrder(quote, true, false);
				}
				else {
					let askUpdate = {price: tick.y, instrument: simu.instrument};
					simu.modifyOrder(simu.market_ask_id, askUpdate);
				}
			}
			if (tick.label == 'bid') {
				if (simu.market_bid_id == undefined) {
					let quote;
					[simu.market_bid_id, quote] = simu.createQuote(
						simu.market_tid, simu.instrument, tick.label, 1000000, tick.y);
					simu.processOrder(quote, true, false);
				}
				else {
					let bidUpdate = {price: tick.y, instrument: simu.instrument};
					simu.modifyOrder(simu.market_bid_id, bidUpdate);
				}
			}
		}
		, 10, simu, ticks, current);
		//console.error('sent:', sent, '/ iter:', iter);
		//console.timeEnd('data process');
	}
	
	setLastPrice(instrument, price, db) {
		let ret = super.setLastPrice(instrument, price, db);
		if ('setLastPrice_hook' in window) {
			setLastPrice_hook(this, instrument, price);
		}
		return ret;
	}
	
	
	order_log_filter(order_id, label, db) {
		let [dolog, data] = super.order_log_filter(order_id, label, db);
		if (data.trader == this.market_tid) {
			dolog = false;
		}
		return [dolog, data];
	}
	
	updateTime(timestamp) {
		// ensure unique timestamps
		if (timestamp <= this.time) {
			timestamp = this.time + 1;
		}
		return super.updateTime(timestamp);
	}
	
};