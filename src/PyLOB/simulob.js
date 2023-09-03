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

function formatDate(millis, fmt='h:m:s.S') {
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

class SimuLOB extends OrderBook {
	
	simu_initialized = false;
	derailedLabels = {};
	quotesQueue = [];
	quotesQueueLocked = false;
	
	market_tid = undefined;
	trader_tid = undefined;
	
	price_branch = ['price', 'midpoint'];
	balance_branch = ['balance'];
	executions_branch = ['executions'];
	market_orders = ['ask', 'bid'];
	
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
		balance: {
			borderColor: 'gold',
			pointStyle: 'star',
			yAxisID: 'yBalance',
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
					}
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
						}*/
					},
					/*title: {
						display: true,
						text: 'minutes'
					}*/
				},
				yPrices: {
					type: 'linear',
					position: 'left',
					stack: 'data',
					stackWeight: 3,
					offset: true,
				},
				yBalance: {
					type: 'linear',
					position: 'left',
					stack: 'data',
					stackWeight: 1,
					offset: true,
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
		chartContainer, chartLabel,
	) {
		let isAuthonomous = false;
		super(location, file_loader, db, tick_size, verbose, isAuthonomous);
		this.chartContainer = chartContainer;
		this.chartLabel = chartLabel;
		this.data_branches = this.price_branch
			.concat(this.market_orders);
		this.core_branches = this.data_branches
			.concat(this.executions_branch)
			.concat(this.balance_branch)
			;
		this.order_branches = this.market_orders;
		// an index to the datasets
		this.chartIndex = {};
		this.trader_quotes = {};
		this.order_names = {};
		this.chartBuffer = {};
		this.charts = {};
	}
	
	async init() {
		let result = new Promise((resolve, reject) => {
			super.init()
				.then(
					value => {
						this.ticks = [];
						this.loading = document.querySelector('#loading');
						this.paused = document.querySelector('#paused');
						let chain = Promise.resolve();
						if ('afterInit_hook' in window) {
							chain = chain.then(afterInit_hook(this, value));
						}
						resolve(chain.then(value));
					}
				)
			;
		});
		return result
			.then(value => {
				this.simu_initialized = true;
			});
	}
	
	isInitialized() {
		return this.simu_initialized;
	}
	
	pause(value=true) {
		if (this.loading) {
			this.loading.style.display = value ? 'none' : 'block';
		}
		if (this.paused) {
			this.paused.style.display = value ? 'block' : 'none';
		}
		this.dopause = value;
	}
	
	close() {
		this.pause();
		setTimeout(() => {
			super.close();
			for (let label of Object.keys(this.charts)) {
				this.chartDestroy(label);
			}
		}, 10 * this.tickGap);
	}
	
	chartDestroy(chartLabel) {
		let chart = this.getChart(chartLabel);
		if (chart.chart) {
			chart.chart.clear();
			chart.chart.destroy();
		}
	}
	
	chartSetTitle(title, chartLabel) {
		let chart = this.getChart(chartLabel);
		if (chart.chart) {
			chart.chart.options.plugins.title.text = title;
		}
	}
	
	chartUpdate(method, chartLabel) {
		let chart = this.getChart(chartLabel);
		if (chart.chart) {
			chart.chart.update(method);
		}
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
				stepped: order_branch,
				spanGaps: false,
				hidden: 0&&!order_branch,
			};
			objectUpdate(dataset, this.chartStyle[branch] || {});
			datasets.push(dataset);
		}
		if ('chartBuildDataset_hook' in window) {
			chartBuildDataset_hook(this, datasets);
		}
		let branches = [];
		let order_branches = [];
		let chartIndex = {};
		for (let branch_ix in datasets) {
			let dataset = datasets[branch_ix];
			let label = dataset.label;
			dataset.id = `id_${label}`;
			dataset.data = [];
			if (dataset.isQuote) {
				order_branches.push(label);
				delete dataset.isQuote;
			}
			branches.push(label);
			chartIndex[label] = {dataset: branch_ix};
		}
		this.branches = branches;
		this.order_branches = order_branches;
		this.chartIndex = chartIndex;
		return datasets;
	}
	
	getChart(label) {
		return this.charts[label || this.chartLabel] || {};
	}
	
	chartLoadBuffer(chartLabel) {
		let chart = this.getChart(chartLabel);
		if (!chart.chart) {
			return;
		}
		for (let [label, info] of Object.entries(chart.dataBuffer)) {
			let ticks = info.data || [];
			while (ticks.length) {
				let tick = ticks.shift();
				this.chartPushTicks(label, tick);
			}
		}
	}
	
	chartLoadInitial() {
		for (let [label, info] of Object.entries(this.chartBuffer)) {
			while ((info.data || []).length) {
				let tick = info.data.shift();
				this.chartPushTicks(label, tick);
			}
		}
	}
	
	chartDataset(label, chartLabel) {
		if (!chartLabel) {
			chartLabel = this.chartLabel;
		}
		if (!chartLabel) {
			if (!this.chartBuffer[label]) {
				this.chartBuffer[label] = {data: []};
			}
			return this.chartBuffer[label];
		}
		let chart = this.charts[chartLabel];
		if (!(label in chart.dataBuffer)) {
			chart.dataBuffer[label] = {data: []};
		}
		if (chart.chart) {
			let ix = this.chartIndex[label].dataset;
			return chart.chart.data.datasets[ix];
		}
		return chart.dataBuffer[label];
	}
	
	chartSetTicks(label, ticks) {
		let ds = this.chartDataset(label);
		if (ds) {
			ds.data = ticks;
		}
	}
	
	chartDatasets(chartLabel) {
		let chart = this.getChart(chartLabel);
		let ret = chart.chart.data.datasets.map(ds => ds.label);
		return ret;
	}
	
	chartData(label, chartLabel) {
		let ds = this.chartDataset(label, chartLabel);
		return ds ? ds.data : null;
	}
	
	chartPushTicks(label, ...ticks) {
		let data = this.chartData(label);
		if (data) {
			data.push(...ticks);
		}
	}
	
	chartInit(chartLabel) {
		let timeLabel = `chartInit ${chartLabel}`;
		console.time(timeLabel);
		let additionalPlugins = {
			afterInit: (chart, args, options) => {
				if (!this.charts[chartLabel].initialized) {
					console.timeEnd(timeLabel);
					this.chartSetTitle(chartLabel, chartLabel);
					this.chartLoadBuffer();
				}
				this.charts[chartLabel].chart = chart;
				this.charts[chartLabel].initialized = true;
				this.chartUpdate();
			},
			afterDatasetUpdate: (chart, args, pluginOptions) => {
				//const { ctx } = chart;
				//ctx.save();
				//let ds = args.meta.dataset;
			},
		};
		let hostElemQuery = `${this.chartContainer} .chart-${chartLabel}`;
		let hostElem = document.querySelector(hostElemQuery);
		if (!hostElem) {
			let chartsDiv = document.querySelector(this.chartContainer);
			chartsDiv.insertAdjacentHTML(
				'beforeend',
				`<div class="flex-child"><canvas class="chart-${chartLabel}" height="320px"></canvas></div>`
			);
			hostElem = document.querySelector(hostElemQuery);
		}
		let chartConfig = {...this.chartConfig};
		chartConfig.data = {
			datasets: this.chartBuildDataset()};
		chartConfig.plugins.push(additionalPlugins);
		chartConfig.options.plugins.title.text = chartLabel;
		new Chart(hostElem.getContext("2d"), chartConfig);
	}
	
	async endOfDay(title) {
		this.modificationsCharge();
		if ('afterTicks_hook' in window) {
			await afterTicks_hook(this, title);
		}
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
					return csvLoad(this, day);
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
				if (this.quotesQueueLocked) {
					return;
				}
				this.quotesQueueLock();
				quote = this.quotesQueue.shift();
				label = quote.label;
				let instrument = quote.instrument;
				this.quotesQueueLock(false);
				if (label in this.derailedLabels[quote.instrument]) {
					return;
				}
				simu.processQuote(quote);
				if (!this.quotesQueue.length) {
					simu.chartUpdate('quiet');
				}
			}
			else if (this.ticks.length) {
				let tick = this.ticks.shift();
				if (tick.label == 'chartReset') {
					simu.newChartStart = true;
					let prevLabel = simu.chartLabel;
					simu.chartLabel = tick.title;
					simu.charts[simu.chartLabel] = {
						dataBuffer: {},
						initialized: false,
					};
					if (!prevLabel) {
						this.chartLoadInitial();
					}
					simu.firstTickFollows = true;
					return;
				}
				if (tick.label == 'endOfDay') {
					await this.endOfDay();					return;
				}
				tick.timestamp = simu.updateTime(tick.timestamp);
				if (simu.newChartStart && !simu.chart) {
					simu.newChartStart = false;
					this.chartInit(simu.chartLabel);
///					this.chart.options.scales.x.min = tick.timestamp;
					if ('newChartStart_hook' in window) {
						newChartStart_hook(simu);
					}
				}
				if (tick.label == 'price') {
					if (simu.firstTickFollows) {
						simu.firstTickFollows = false;
						simu.firstTime = tick.timestamp;
					}
					simu.setLastPrice(tick.instrument, tick.price);
				}
				else if (simu.order_branches.includes(tick.label)) {
					if (simu.firstTickFollows) {
						simu.firstTime = tick.timestamp;
						simu.firstTickFollows = false;
					}
					quote = {
						...tick,
						trader: simu.market_tid,
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
				if ('afterTicks_hook' in window) {
					afterTicks_hook(simu);
				}
				return;
			}
			
			++sent;
		}
		, simu.tickGap, simu);
	}
	
	pushTick(tick) {
		this.ticks.push(tick);
	}
	
	processQuote({trader, instrument, label, side, qty, price=null, isPrivate=false, cancelQuote=false}) {
		let quote = this.trader_quotes[instrument][label];
		if (typeof quote === 'undefined') {
			if (!side) {
				side = label.slice(0, 3);
			}
			quote = this.createQuote(
				trader, instrument, side, qty, price);
			this.trader_quotes[instrument][label] = quote;
			this.order_names[quote.idNum] = [instrument, label];
			this.processOrder(quote, true, false, isPrivate);
		}
		else if (cancelQuote) {
			super.cancelOrder(quote.idNum);
		}
		else {
			let update = {
				price: price,
				qty: qty,
			};
			this.modifyOrder(quote.idNum, update, quote.timestamp, false, isPrivate);
			objectUpdate(quote, update);
		}
		quote.fulfilled = 0;
		return quote.idNum;
	}
	
	cancelQuote(trader, instrument, label) {
		let quote = this.trader_quotes[instrument][label];
		if (quote) {
			super.cancelOrder(quote.idNum);
		}
	}
	
	cancelAllQuotes(trader, instrument) {
		for (let label of this.trader_quotes[instrument]) {
			this.cancelQuote(trader, instrument, label);
		}
	}
	
	//todo take and subsequently use order_id
	orderSent(idNum, quote) {
		let [instrument, label] = this.order_names[idNum];
		if (instrument && label) {
			let thinTick = {x: quote.timestamp, y: quote.price};
			this.chartPushTicks(label, thinTick);
		}
	}
	
	//todo use order_id
	dismissQuote(idNum) {
		let [instrument, label] = this.order_names[idNum];
		if (instrument && label) {
			delete this.trader_quotes[instrument][label];
			delete this.order_names[idNum];
			let tick = {
				x: this.updateTime(),
				y: null,
			};
			this.chartPushTicks(label, tick);
		}
	}
	
	setLastPrice(instrument, price, db) {
		let ret = super.setLastPrice(instrument, price, db);
		if ('setLastPrice_hook' in window) {
			setLastPrice_hook(this, instrument, price);
		}
		return ret;
	}
	
	tickMidPoint(instrument, midPoint, db) {
		let ret = super.tickMidPoint(instrument, midPoint, db);
		if ('tickMidPoint_hook' in window) {
			tickMidPoint_hook(this, instrument, midPoint);
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
		if ('orderFulfill_hook' in window) {
			orderFulfill_hook(this, instrument, label, trader, qty, fulfilled, commission, avgPrice);
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
		this.chartPushTicks('executions', tick);
		if ('orderExecuted_hook' in window) {
			let [instrument, label] = this.order_names[idNum];
			orderExecuted_hook(this, instrument, label, trader, time, qty, price);
		}
		return ret;
	}
	
	orderCancelled(idNum, trader, time) {
		let ret = super.orderCancelled(idNum, trader, time);
		if (trader != this.trader_tid) {
			return;
		}
		let [instrument, label] = this.order_names[idNum];
		this.dismissQuote(idNum);
		//why
		//this.derailedLabels[instrument][label] = true;
		//this?
		if ('orderCancelled_hook' in window) {
			orderCancelled_hook(this, instrument, label, trader, time);
		}
		return ret;
	}
	
	traderBalance({instrument, amount, lastprice, value, liquidation, reqId}) {
		let ret = super.traderBalance({instrument, amount, lastprice, value, liquidation, reqId});
		if ('traderBalance_hook' in window) {
			traderBalance_hook(this, instrument, amount, lastprice, value, liquidation, reqId);
		}
		return ret;
	}
	
	dtFormat(millis, fmt='HH:mm:ss.SSS') {
		return formatDate(millis, fmt);
	}
	
	order_log_filter(order_id, label, db) {
		let [dolog, data] = super.order_log_filter(order_id, label, db);
		dolog = (data.trader == this.trader_tid);
		if (['balance_update', 'modify_detail'].includes(label)) {
			dolog = false;
		}
		let [instrument, order_label] = this.order_names[data.idNum];
		data.order_label = order_label;
		data.event_dt = formatDate(data.event_dt);
		return [dolog, data];
	}
	
	updateTime(timestamp) {
		// ensure unique timestamps
		if (timestamp <= this.time) {
			timestamp = this.time + 1;
		}
		return super.updateTime(timestamp);
	}
	
	studySide(side, chartLabel) {
		let chart = this.getChart(chartLabel);
		let labels = this.market_orders
			.filter(label => label != side)
			.concat(
				this.trader_orders
					.filter(label => label.slice(0, 3) == side)
			);
		for (let label of this.branches) {
			let ix = this.chartIndex[label].dataset;
			if (labels.includes(label)) {
				chart.chart.show(ix);
			}
			else {
				chart.chart.hide(ix);
			}
		}
		chart.chart.update();
	}
	
	quotesQueueLock(value=true) {
		this.quotesQueueLocked = value;
	}
};
