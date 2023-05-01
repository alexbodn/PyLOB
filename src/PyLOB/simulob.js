
'use strict';

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
				value = parseFloat(value.replace(',', ''));
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
	market_tid = undefined;
	trader_tid = undefined;
	
	tickGap = 10;
	
	price_branch = ['price'];
	balance_branch = ['balance'];
	ev_branches = ['ev', 'peaks', 'valleys'];
	market_orders = ['ask', 'bid'];
	
	chartStyle = {
		price: {
			borderColor: 'green',
			pointStyle: false,
		},
		ev: {
			borderColor: 'yellow',
			pointStyle: false,
		},
		peaks: {
			borderColor: 'lightblue',
			pointStyle: false,
		},
		valleys: {
			borderColor: 'maroon',
			pointStyle: false,
		},
		balance: {
			borderColor: 'gold',
			pointStyle: 'star',
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
							second: 'HH:mm:ss',
							minute: 'HH:mm:ss',
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
			.concat(this.ev_branches)
			.concat(this.balance_branch);
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
					afterInit_hook(this);
				}
				this.simu_initialized = true;
				resolve(value);
			}
		);
		});
		return result;
	}
	
	isInitialized() {
		return this.simu_initialized;
	}
	
	close() {
		this.stop = true;
		setTimeout(() => {
			super.close();
			this.chartDestroy();
		}, 10 * this.tickGap);
	}
	
	chartDestroy() {
		this.chart &&
		this.chart.clear() &&
		this.chart.destroy();
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
			beforeDraw: (chart, args, options) => {
				//let lastprice = chart.data.datasets[this.price_ix].data.slice(-1)[0];
				//console.log('last drawn price', lastprice.x);
			}
		}]);
		new Chart(hostElem, config);
	}
	
	loadTicks(ticks) {
		console.time('data process');
		let sent = 0;
		let simu = this;
		simu.stop = false;
		let tickInterval = setInterval ((simu, ticks) => {
			let label, price, quote;
			if (this.quotesQueue.length && !simu.stop) {
				quote = this.quotesQueue.shift();
				label = quote[2];
				//this.logobj(quote);
			}
			else if (ticks.length && !simu.stop) {
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
		if (quote === undefined) {
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
		let thinTick = {x: this.time, y: price};
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
		let ret = super.orderFulfill(idNum, trader, qty, fulfilled, commission);
		if (fulfilled == qty) {
			this.dismissQuote(idNum);
		}
		else {
			let [instrument, label] = this.order_names[idNum.toString()];
			if (instrument && label) {
				this.trader_quotes[instrument][label]['fulfilled'] = fulfilled;
			}
		}
		if ('orderFulfill_hook' in window) {
			orderFulfill_hook(this, idNum, trader, qty, fulfilled, commission);
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
		if (data.trader == this.market_tid) {
			dolog = false;
		}
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
};
