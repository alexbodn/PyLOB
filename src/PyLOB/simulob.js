
'use strict';

function cmp(a, b) {
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

	function labelattr(context, attr)
	{
		let label = context.chart.data.datasets[context.datasetIndex].data[context.dataIndex].label;
		if (label) {
			return label[attr];
		}
		return null;
	}
		
	function chartfill(chart, prices, minprofit, capital, hidden)
	{
		let allev2 = [];
		let delta = significant_delta(
			capital, 
			prices[0].y, 
			minprofit
		);
		let [maxtab, mintab] = peakdet2(
			prices, delta, {getv: v => v.y, allev: allev2});
		allev2 = allev2.map(
			row => {
				row.label = maxtab.includes(row) ? {text: '+', color: 'green'} : {text: '-', color: 'red'};
				return row;
			}
		);
		//logobj(maxtab);
		chart.data.datasets[0] = {label: 'price', data: prices, hidden: hidden};
		chart.data.datasets[1] = {label: 'ev', data: allev2};
		chart.data.datasets[2] = {label: 'peaks', data: maxtab};
		chart.data.datasets[3] = {label: 'valeys', data: mintab};
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
	
	function chartupdate(chart, prices)
	{
		chartfill(
			chart, 
			prices, 
			inputNumber('minprofit'), 
			inputNumber('capital'),
			document.getElementById('hidden').checked
		);
		chart.update();
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

function chartUpdate(chart, simu) {
	let total = 0;
	chart.data.datasets.forEach((dataset, ix) => {
		let length = simu.dataBuffers[ix].length;
		let content = simu.dataBuffers[ix].splice(0, length);
		dataset.data = dataset.data.concat(content);
		total += length;
	});
	if (total) {
		console.error('should update chart', total);
		chart.update();
	}
	return total;
}

class SimuLOB extends OrderBook {
	
	lastTicks = [];
	nEvt = 2;
	
	instrument = 'IVE';
	market_tid = undefined;
	trader_tid = undefined;
	market_ask_id = undefined;
	market_bid_id = undefined;
	
	branches = ['price', 'ask', 'bid'];
	dataBuffers = [];
	
	constructor(
			location, file_loader, db, 
			tick_size=0.0001, verbose=false, chartElem
	) {
		super(location, file_loader, db, tick_size, verbose);
		this.chartElem = chartElem;
		for (let ix in this.branches) {
			this[`${this.branches[ix]}_ix`] = ix;
		}
		this.time = 0;
	}
	
	run(data) { // x, y, label,rowid
		console.time('data sort');
		let ticks = data
			.filter(branch=>this.branches.includes(branch.title))
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
		//logobj(ticks[0]);
		//logobj(ticks[ticks.length-1]);
		console.timeEnd('data sort');
		//console.time('data plot');
		/*this.prices = data
			.filter(elem => {return elem.title == 'price';})
			.map(dset => dset.data)
			.reduce((a, b) => a);
		*/
		console.time('chart init');
		let hostElem = document.getElementById(this.chartElem);
		let config = Object.assign({}, this.chartConfig);
		config.plugins.push(...[{
			afterInit: (chart, args, options) => {
				for (let ix in this.branches) {
					chart.data.datasets[ix] = {
						label: this.branches[ix], data: []
					};
					this.dataBuffers[ix] = [];
				}
				this.chart = chart;
				console.timeEnd('chart init');
				this.loadTicks(ticks, chart);
			}
		}]);
		new Chart(hostElem, config);
		//this.chartupdate();
		//console.timeEnd('data plot');
		
		
		//this.loadTicks(ticks);
	}
	
	loadTicks(ticks, chart) {
		console.time('data process');
		this.createInstrument(this.instrument, 'USD');
		this.market_tid = this.createTrader(
			'market', null, 'USD', 0.01, 2.5, 1);
		this.trader_tid = this.createTrader(
			'trader', null, 'USD', 0.01, 2.5, 1);
		let ask, bid, price;
		
		let chartInterval = setInterval(
			function (chart, simu) {
				if (!chartInterval) {
					return;
				}
				let updated = chartUpdate(chart, simu);
				if (!updated) {
					clearInterval(chartInterval);
					chartInterval = 0;
					console.error('done');
					return;
				}
			}, 200, chart, this
		);
		let sent = 0, iter = 0;
		for (let tick of ticks/*.slice(0,10000)*/) {
			// should break in function calls
			if (!tick.y) {
				continue;
			}
//break;
			let dset = null;
			if (tick.label == 'price' && tick.y != price) {
				price = tick.y;
				tick.x = parseDate(tick.x);
				this.updateTime(tick.x);
				this.setLastPrice(this.instrument, price);
				dset = this.price_ix;
			}
			if (tick.label == 'ask' && tick.y != ask) {
				ask = tick.y;
				tick.x = parseDate(tick.x);
				this.updateTime(tick.x);
				if (this.market_ask_id == undefined) {
					let quote;
					[this.market_ask_id, quote] = this.createQuote(
						this.market_tid, this.instrument, 'ask', 1000000, ask);
					this.processOrder(quote, true, false);
				}
				else {
					let askUpdate = {price: ask, instrument: this.instrument};
					this.modifyOrder(this.market_ask_id, askUpdate);
				}
				dset = this.ask_ix;
			}
			if (tick.label == 'bid' && tick.y != bid) {
				bid = tick.y;
				tick.x = parseDate(tick.x);
				this.updateTime(tick.x);
				if (this.market_bid_id == undefined) {
					let quote;
					[this.market_bid_id, quote] = this.createQuote(
						this.market_tid, this.instrument, 'bid', 1000000, bid);
					this.processOrder(quote, true, false);
				}
				else {
					let bidUpdate = {price: bid, instrument: this.instrument};
					this.modifyOrder(this.market_bid_id, bidUpdate);
				}
				dset = this.bid_ix;
			}
			if (dset !== null) {
				let thinTick = {x: tick.x, y: tick.y};
				this.dataBuffers[dset].push(thinTick);
				++sent;
			}
			++iter;
		}
//		console.error('sent:', sent, '/ iter:', iter);
		console.timeEnd('data process');
	}
	
	setLastPrice(instrument, price, db) {
		super.setLastPrice(this.instrument, price, db);
		let thinTick = {x: this.time, y: price};
		this.lastTicks.push(thinTick);
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
	
	chartupdate() {
		chartupdate(this.chart, this.prices);
	}
	
};