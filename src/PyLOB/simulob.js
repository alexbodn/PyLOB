
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

function parseDate(dt) {
	let lx = luxon.DateTime.fromISO(
		dt, {
				zone: 'America/New_York',
				setZone: true,
			}
		);
	return lx.toMillis();
}

class SimuLOB extends OrderBook {
	
	simu_initialized = false;
	derailedLabels = {};
	quotesQueue = [];
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
		this.ticks = [];
		initDone.then(
			value => {
				const initialized = () => {
					this.simu_initialized = true;
					resolve(value);
				}
				if ('afterInit_hook' in window) {
					result = afterInit_hook(this).then(
						initialized());
				}
				else {
					initialized();
				}
			}
		);
		});
		return result;
	}
	
	isInitialized() {
		return this.simu_initialized;
	}
	
	stop(value=true) {
		//todo implement hook to hide loading
		this.dostop = value;
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
	
	chartDataset(label) {
		let ix = this[`${label}_ix`];
		return this.chart.datasets[ix];
	}
	
	run(dates) { // x, y, label,rowid
		//this.ticks = dataTicks(this, data);
		console.time('chart init');
		let hostElem = document.getElementById(this.chartElem);
		let chartConfig = Object.assign({}, this.chartConfig);
		chartConfig.plugins.push(...[{
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
						hidden: (0 && !this.order_branches.includes(branch)),
					};
					objectUpdate(dataset, this.chartStyle[branch] || {});
					chart.data.datasets[ix] = dataset;
				}
				this.chart = chart;
				if ('afterDataSets_hook' in window) {
					afterDataSets_hook(this);
				}
				console.timeEnd('chart init');
				this.dataComing = true;
				this.loadTicks();
				for (let day of dates) {
					csvLoad(this, day);
				}
			},
			afterDatasetUpdate: (chart, args, pluginOptions) => {
				//const { ctx } = chart;
				//ctx.save();
				//let ds = args.meta.dataset;
			},
		}]);
		new Chart(hostElem.getContext("2d"), chartConfig);
	}
	
	loadTicks() {
		console.time('data process');
		let sent = 0;
		let simu = this;
		simu.dostop = false;
		simu.newChartStart = false;
		let tickInterval = setInterval ((simu) => {
			if (simu.dostop) {
				return;
			}
			let label, price, quote;
			if (this.quotesQueue.length) {
				if (this.quotesQueueLocked) {
					return;
				}
				quote = this.quotesQueue.shift();
				label = quote[2];
				let instrument = quote[1];
				if (label in this.derailedLabels[instrument]) {
					return;
				}
				//this.logobj(quote);
			}
			else if (this.ticks.length) {
				let tick = this.ticks.shift();
				if (tick.label == 'chartReset') {
					this.chart.options.plugins.title.text = tick.title;
					simu.newChartStart = true;
					return;
				}
				tick.x = simu.updateTime(tick.x);
				if (simu.newChartStart) {
					this.chart.options.scales.x.min = tick.x;
					if ('newChartStart_hook' in window) {
						newChartStart_hook(simu);
					}
					simu.newChartStart = false;
					this.chart.update('none');
				}
				label = tick.label;
				price = tick.y;
				quote = [
					simu.market_tid, simu.instrument,
					label, undefined, 1000000, price
				];
			}
			else if (this.dataComing) {
				console.log('dataComing');
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
		, simu.tickGap, simu);
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
		return quote.idNum;
	}
	
	//todo take and use order_id
	orderSent(idNum, quote) {
		let [instrument, label] = this.order_names[idNum.toString()];
		if (instrument && label) {
			let thinTick = {x: quote.timestamp, y: quote.price};
			let label_ix = this[`${label}_ix`];
			let data = this.chart.data.datasets[label_ix].data;
			data.push(thinTick);
		}
	}
	
	//todo use order_id
	dismissQuote(idNum) {
		let [instrument, label] = this.order_names[idNum.toString()];
		if (instrument && label) {
			delete this.trader_quotes[instrument][label];
			delete this.order_names[idNum.toString()];
console.warn(`dismissing ${label}`);
			let label_ix = this[`${label}_ix`];
			let data = this.chart.data.datasets[label_ix].data;
			let tick = {
				x: this.updateTime(),
				y: null,
			};
			data.push(tick);
console.warn(label, idNum, data[data.length - 1]);
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
			let label_ix = this[`${label}_ix`];
			let data = this.chart.data.datasets[label_ix].data;
			let tick = {
				x: this.updateTime(),
				y: avgPrice,
			};
			data.push(tick);
			this.dismissQuote(idNum);
		}
		else if (instrument && label) {
			this.trader_quotes[instrument][label].fulfilled = fulfilled;
		}
		if ('orderFulfill_hook' in window) {
			orderFulfill_hook(this, idNum, trader, qty, fulfilled, commission, avgPrice, instrument, label);
		}
		return ret;
	}
	
	orderExecuted(idNum, trader, time, qty, price) {
		let ret = super.orderExecuted(idNum, trader, time, qty, price);
		if (trader != this.trader_tid) {
			return;
		}
		let side = this.orderGetSide(idNum);
		let tick = {
			x: time,
			y: price,
			label: {
				text: `${side == 'ask' ? 'S' : 'B'} ${qty}`,
				color: side == 'ask' ? 'red' : 'blue',
				backgroundColor: 'yellow',
			},
		};
		this.chart.data.datasets[this.executions_ix].data.push(tick);
		if ('orderExecuted_hook' in window) {
			orderExecuted_hook(this, idNum, trader, time, qty, price);
		}
		return ret;
	}
	
	orderCancelled(idNum) {
		let ret = super.orderCancelled(idNum);
		if (trader != this.trader_tid) {
			return;
		}
		this.dismissQuote(idNum);
		//approuval needed again
		let [instrument, label] = this.order_names[idNum];
		this.derailedLabels[instrument][label] = true;
		if ('orderCancelled_hook' in window) {
			orderCancelled_hook(this, idNum);
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
		if (['balance_update', 'modify_detail'].includes(label)) {
			dolog = false;
		}
		let [instrument, order_label] = this.order_names[data.idNum];
		data.order_label = order_label;
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
