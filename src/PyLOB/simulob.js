
'use strict';

//import {OrderBook, objectUpdate, fetchText} from './orderbook.js';

//var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
//var scriptDirectory = _scriptDir.substr(0, _scriptDir.replace(/[?#].*/, "").lastIndexOf('/')+1);
//console.log(scriptDirectory);

	function labelattr(context, attr)
	{
		let label = context.dataset.data[context.dataIndex].label;
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
				let last = value.slice(-1);
				if (last == '%') {
					value = value.slice(0, -1);
				}
				value = parseFloat(value.replace(',', ''));
				if (last == '%') {
					value /= 100;
				}
			}
		}
		return value;
	}
	
function parseDate(dt) {
	if (dt instanceof Number) {
		return dt;
	}
	let lx = luxon.DateTime.fromISO(
		dt.replace('Z', ''), {
				zone: 'America/New_York',
				setZone: true,
			}
		);
	return lx.toMillis();
}

class SimuLOB extends OrderBook {
	
	simu_initialized = false;
	derailedLabels = {};
	quotesQueueLocked = false;
	
	market_tid = undefined;
	trader_tid = undefined;
	
	tickGap = 10;
	
	price_branch = ['price'];
	balance_branch = ['balance'];
	executions_branch = ['executions'];
	market_orders = ['ask', 'bid'];
	
	chartStyle = {
		price: {
			borderColor: 'green',
			pointStyle: 'cross',
			pointRadius: 0,
		},
		balance: {
			borderColor: 'gold',
			pointStyle: 'star',
		},
		executions: {
			borderColor: 'violet',
			pointStyle: 'star',
			type: 'scatter',
		},
		ask: {
			borderColor: 'red',
		},
		bid: {
			borderColor: 'blue',
		},
	};
	
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
					padding: 1
				},
				legend: {
					title: {
						display: true,
						text: 'datasets',
						fontSize: 14,
						fontFamily: 'Roboto',
						fontColor: '#474747',
					},
					display: true,
					position: 'bottom',
					labels: {
						fontColor: '#333',
						usePointStyle: true,
						boxWidth: 9,
						fontColor: '#474747',
						fontFamily: '6px Montserrat',
					}
				},
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
		tick_size=0.0001, verbose=true,
		chartElem,
	) {
		super(location, file_loader, db, tick_size, verbose);
		this.chartElem = chartElem;
		this.data_branches = this.price_branch
			.concat(this.market_orders);
		this.core_branches = this.data_branches
			.concat(this.balance_branch)
			.concat(this.executions_branch);
		for (let ix in this.core_branches) {
			this[`${this.core_branches[ix]}_ix`] = ix;
		}
		this.order_branches = [...this.market_orders];
		this.trader_quotes = {};
		this.order_names = {};
	}
	
	async init() {
		let result = new Promise((resolve, reject) => {
		let initDone = super.init();
		initDone.then(
			value => {
				if ('afterInit_hook' in window) {
					result = afterInit_hook(this).then(
						() => {
						this.simu_initialized = true;
						resolve(value);
					});
				}
				else {
					this.simu_initialized = true;
					resolve(value);
				}
			}
		);
		});
		return result;
	}
	
	isInitialized() {
		return this.simu_initialized;
	}
	
	stop() {
		this.dostop = true;
	}
	
	close() {
		this.stop();
		setTimeout(() => {
			super.close();
			this.chartDestroy();
		}, 10 * this.tickGap);
	}
	
	chartDestroy() {
		if (this.chart) {
			this.chart.clear();
			this.chart.destroy();
		}
	}
	
	run(data) { // x, y, label,rowid
		console.time('chart init');
		let hostElem = document.getElementById(this.chartElem);
		let config = Object.assign({}, this.chartConfig);
		config.plugins.push(...[{
			afterInit: (chart, args, options) => {
				for (let ix in this.core_branches) {
					let branch = this.core_branches[ix];
					let dataset = {
						type: 'line',
						label: branch,
						beginAtZero: false,
						data: [],
						id: `id_${branch}`,
						stepped: (this.order_branches.includes(branch)),
						hidden: (!this.order_branches.includes(branch)),
					};
					objectUpdate(dataset, this.chartStyle[branch] || {});
					chart.data.datasets[ix] = dataset;
				}
				this.chart = chart;
				if ('afterDataSets_hook' in window) {
					afterDataSets_hook(this);
				}
				console.timeEnd('chart init');
				let ticks = dataTicks(this, data);
				this.loadTicks(ticks);
			},
			afterDatasetUpdate: (chart, args, pluginOptions) => {
				//const { ctx } = chart;
				//ctx.save();
				/*let ds = args.meta.dataset;
				if (ds) {
					console.log('here', args.meta.label, ds.active);
				}*/
			},
			beforeDraw: (chart, args, options) => {
				//let lastprice = chart.data.datasets[this.price_ix].data.slice(-1)[0];
				//console.log('last drawn price', lastprice.x);
			},
		}]);
		new Chart(hostElem, config);
	}
	
	loadTicks(ticks) {
		console.time('data process');
		let sent = 0;
		let simu = this;
		simu.dostop = false;
		let tickInterval = setInterval ((simu, ticks) => {
			let label, price, quote;
			if (this.quotesQueue.length && !simu.dostop) {
				if (this.quotesQueueLocked) {
					return;
				}
				quote = this.quotesQueue.shift();
				label = quote[2];
				if (label in this.derailedLabels) {
					return;
				}
				//this.logobj(quote);
			}
			else if (ticks.length && !simu.dostop) {
				let tick = ticks.shift();
				tick.x = simu.updateTime(parseDate(tick.x));
				label = tick.label;
				price = tick.y;
				quote = [
					simu.market_tid, simu.instrument,
					label, undefined, 1000000, price
				];
			}
			else {
				clearInterval(tickInterval);
				tickInterval = 0;
				error('sent:', sent);
				console.timeEnd('data process');
				if ('afterTicks_hook' in window) {
					afterTicks_hook(simu);
				}
				return;
			}
			
			++sent;
			
			if (label == 'price') {
				simu.setLastPrice(simu.instrument, price);
			}
			else if (simu.order_branches.includes(label)) {
				simu.processQuote(...quote);
			}
		}
		, simu.tickGap, simu, ticks);
	}
	
	processQuote(trader, instrument, label, side, qty, price) {
		let quote = this.trader_quotes[instrument][label];
		if (typeof quote === 'undefined') {
			if (!side) {
				side = label.slice(0, 3);
			}
			quote = this.createQuote(
				trader, instrument, side, qty, price);
			this.trader_quotes[instrument][label] = quote;
			this.order_names[quote.idNum.toString()] = [instrument, label];
			this.processOrder(quote, true, false);
		}
		else {
			let update = {
				price: price,
				qty: qty,
			};
			this.modifyOrder(quote.idNum, update);
			objectUpdate(quote, update);
		}
		quote.fulfilled = 0;
		let thinTick = {x: quote.timestamp, y: price};
		let dset = this[`${label}_ix`];
		this.chart.data.datasets[dset].data.push(thinTick);
		return quote.idNum;
	}
	
	dismissQuote(idNum) {
		let [instrument, label] = this.order_names[idNum.toString()];
		if (instrument && label) {
			delete this.trader_quotes[instrument][label];
			delete this.order_names[idNum.toString()];
		}
	}
	
	setLastPrice(instrument, price, db) {
		let ret = super.setLastPrice(instrument, price, db);
		if ('setLastPrice_hook' in window) {
			setLastPrice_hook(this, instrument, price);
		}
		return ret;
	}
	
	orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice) {
		let ret = super.orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice);
		if (trader != this.trader_tid) {
			return;
		}
		let [instrument, label] = this.order_names[idNum];
		if (fulfilled == qty) {
			this.dismissQuote(idNum);
		}
		else if (instrument && label) {
			this.trader_quotes[instrument][label].fulfilled = fulfilled;
		}
		//approuval needed again
		this.derailedLabels[label] = true;
		if ('orderFulfill_hook' in window) {
			orderFulfill_hook(this, idNum, trader, qty, fulfilled, commission, avgPrice);
		}
		return ret;
	}
	
	orderExecute(idNum, trader, time, qty, price) {
		let ret = super.orderExecute(idNum, trader, time, qty, price);
		if (trader != this.trader_tid) {
			return;
		}
		let side = this.orderGetSide(idNum);
		let tick = {
			x: time,
			y: price,
			label: {
				text: `${side == 'ask' ? 'SOLD' : 'BOUGHT'} ${qty}`,
				color: side == 'ask' ? 'red' : 'blue',
				backgroundColor: 'yellow',
			},
		};
		this.chart.data.datasets[this.executions_ix].data.push(tick);
		if ('orderExecute_hook' in window) {
			orderExecute_hook(this, idNum, trader, time, qty, price);
		}
		return ret;
	}
	
	traderBalance({instrument, amount, lastprice, value, liquidation}) {
		let ret = super.traderBalance({instrument, amount, lastprice, value, liquidation});
		if ('traderBalance_hook' in window) {
			traderBalance_hook(this, instrument, amount, lastprice, value, liquidation);
		}
		return ret;
	}
	
	dtFormat(value) {
		let dt = luxon.DateTime.fromMillis(
			value, {
				zone: 'America/New_York',
				setZone: true,
			}
		);
		return dt.toFormat('HH:mm:ss.SSS');
	}
	
	order_log_filter(order_id, label, db) {
		let [dolog, data] = super.order_log_filter(order_id, label, db);
		dolog = (data.trader == this.trader_tid);
		let [instrument, order_label] = this.order_names[data.idNum];
		data.order_label = order_label;
		/*else {
			dolog = [
				//'fulfill_order',
				]
				.includes(label);
		}*/
		return [dolog, data];
	}
	
	updateTime(timestamp) {
		// ensure unique timestamps
		if (timestamp <= this.time) {
			timestamp = this.time + 1;
		}
		return super.updateTime(timestamp);
	}
	
	studySide(side) {
		let labels = this.market_orders
			.filter(label => label != side)
			.concat(
				this.trader_orders
					.filter(label => label.slice(0, 3) == side)
			);
		for (let label of this.branches) {
			let ix = this[`${label}_ix`];
			if (labels.includes(label)) {
				this.chart.show(ix);
			}
			else {
				this.chart.hide(ix);
			}
		}
		this.chart.update();
	}

	quotesQueueLock(value=true) {
		this.quotesQueueLocked = value;
	}
};
