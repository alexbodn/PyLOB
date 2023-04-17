
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
	quotesQueue = [];
	
	market_tid = undefined;
	trader_tid = undefined;

	price_branch = ['price'];
	ev_branches = ['ev', 'peaks', 'valleys'];
	market_orders = ['ask', 'bid'];
	trader_orders = ['askall', 'askhalf', 'bidhalf', 'bidall'];
	
	chartStyle = {
		price: {
			borderColor: 'green',
		},
		ev: {
			borderColor: 'yellow',
		},
		peaks: {
			borderColor: 'lightblue',
		},
		valleys: {
			borderColor: 'maroon',
		},
		ask: {
			borderColor: 'red',
		},
		bid: {
			borderColor: 'blue',
		},
		askall: {
			borderColor: 'red',
			borderDash: [10, 5],
		},
		askhalf: {
			borderColor: 'red',
			borderDash: [5, 5],
		},
		bidhalf: {
			borderColor: 'blue',
			borderDash: [5, 5],
		},
		bidall: {
			borderColor: 'blue',
			borderDash: [10, 5],
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
		capital, 
		minprofit,
		nEvt=2,
		instrument='IVE',
		currency='USD',
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
		this.orders_detail = {};
		this.orders_detail[this.instrument] = {};
		this.trader_quotes = {};
		this.order_names = {};
		this.instrument = instrument;
		this.currency = currency;
		this.balance = {};
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
					let dataset = {
						label: branch,
						data: [],
						id: `id_${branch}`,
						stepped: (this.order_branches.includes(branch)),
						hidden: (!this.order_branches.includes(branch)),
					};
					objectUpdate(dataset, this.chartStyle[branch] || {});
					chart.data.datasets[ix] = dataset;
				}
				this.chart = chart;
				console.timeEnd('chart init');
				let ticks = this.dataTicks(data);
				this.loadTicks(ticks);
			},
			beforeDraw: (chart, args, options) => {
				//let lastprice = chart.data.datasets[this.price_ix].data.slice(-1)[0];
				//console.log('last drawn price', lastprice.x);
			}
		}]);
		new Chart(hostElem, config);

		//this.loadTicks(ticks);
	}
	
	loadTicks(ticks) {
		console.time('data process');
		this.createInstrument(
			this.instrument, this.currency);
		this.market_tid = this.createTrader(
			'market', null, this.currency, 0.01, 2.5, 1);
		this.trader_tid = this.createTrader(
			'trader', null, this.currency, 0.01, 2.5, 1);
		this.commission_data = this.commissionData(
			this.trader_tid, this.instrument);
		this.traderTransfer(
			this.trader_tid, this.currency, this.capital);
		this.traderTransfer(
			this.trader_tid, this.instrument, 0);
		this.traderGetBalance(this.trader_tid);
		
		let current = {};
		ticks = ticks.filter(
			tick => {
				let ret = tick.y && tick.y != current[tick.label];
				current[tick.label] = tick.y;
				return ret;
				
			});
		
		let sent = 0;
		let simu = this;
		let tickInterval = setInterval ((simu, ticks) => {
			let label, price, quote;
			if (this.quotesQueue.length) {
				quote = this.quotesQueue.shift();
				label = quote[2];
				//this.logobj(quote);
			}
			else if (ticks.length) {
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
		, 10, simu, ticks);
	}
	
	processQuote(trader, instrument, label, side, qty, price) {
		if (!side) {
			side = label.slice(0, 3);
		}
		let idNum = this.trader_quotes[label];
		if (idNum === undefined) {
			let quote;
			[idNum, quote] = this.createQuote(
				trader, instrument, side, qty, price);
			this.trader_quotes[label] = idNum;
			this.order_names[idNum.toString()] = label;
			this.processOrder(quote, true, false);
		}
		else {
			let update = {
				price: price,
				qty: qty,
			};
			this.modifyOrder(idNum, update);
		}
		let thinTick = {x: this.time, y: price};
		let dset = this[`${label}_ix`];
		this.chart.data.datasets[dset].data.push(thinTick);
		return idNum;
	}
	
	dismissQuote(idNum) {
		let label = this.order_names[idNum.toString()];
		if (label) {
			delete this.trader_quotes[label];
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
		if ('orderFulfill_hook' in window) {
			orderFulfill_hook(this, idNum, trader, qty, fulfilled, commission);
		}
		return ret;
	}
	
	traderBalance(instrument, amount, amount_promissed, lastprice, value, liquidation) {
		let ret = super.traderBalance(instrument, amount, lastprice, value, liquidation);
		if ('traderBalance_hook' in window) {
			traderBalance_hook(this, instrument, amount, amount_promissed, lastprice, value, liquidation);
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
