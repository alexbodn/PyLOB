'use strict';

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
	
	market_tid = undefined;
	trader_tid = undefined;
	
	titleLabel = 'title';
	
	title_branch = ['title'];
	price_branch = ['price'];
	balance_branch = ['nlv'];
	executions_branch = ['bought', 'sold'];
	market_orders = ['ask', 'bid'];
	trader_orders = [];
	
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
	];
	
	constructor(oo) {
		let verbose = true;
		const isAuthonomous = false;
		super(oo, undefined, verbose, isAuthonomous);
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
		// an index to the datasets
		this.chartIndex = {};
		this.chartBuffer = {};
		this.charts = {};

		this.simu_queries = {};
		// isolation_level: null
		this.simu_db = new oo.DB('file:simulob?mode=memory', 'c');
		// move these to local db
		this.trader_quotes = {};
		this.order_names = {};
	}
	
	async init(strategyClass, strategyDefaults) {
		let result = new Promise((resolve, reject) => {
			super.init()
			.then(() => this.init_queries(this.simu_query_names, this.simu_queries, '/simulob'))
			.then(() => this.simu_db.exec(this.simu_queries.simulob))
			.then(
				value => {
					this.strategy = new strategyClass(this, strategyDefaults);
					this.ticks = [];
					this.loading = document.querySelector('#loading');
					this.paused = document.querySelector('#paused');
					let chain = Promise.resolve();
					chain = chain.then(
						value => {return this.strategy.hook_afterInit();});
					return chain;
				}
			)
			.then(value => {
				return fetchPricesZIP(this);
			})
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
		this.strategy.hook_chartBuildDataset(datasets);
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
			let ix = this.chartIndex[label].dataset;
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
				setTableField('status', field, value);
			}
		}
	}
	
	chartInit(chartLabel, prevLabel, firstTime) {
		let timeLabel = `chartInit ${chartLabel}`;
		console.time(timeLabel);
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
					let quotes = this.quoteGetAll(this.trader_tid, this.instrument, null, 'sent');
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
				this.strategy.hook_beforeUpdateChart(chartLabel);
				let chartInfo = this.getChartInfo(chartLabel);
				let sentinelTime = chartInfo.lastTime || this.getTime();
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
				return true;
			},
			afterUpdate: (chart, args, options) => {
				chartInfo.updating = false;
				return true;
			}
		};
		
		const tabLabel = `${this.strategy.getName()}/${chartLabel}`;
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
			for (const [key, info] of Object.entries(this.strategy.getButtons())) {
				buttonsDiv.insertAdjacentHTML(
					'beforeend',
					`<button class="${key}">${info.label}</button>`
				);
				tabInfo.querySelector('button.' + key).addEventListener(
					'click',
					e => {info.listener(e, chartLabel);}
				);
			}
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
	
	afterTicks(chartLabel) {
		let chartInfo = this.getChartInfo(chartLabel);
		chartInfo.lastTime = this.getTime();
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
		this.strategy.hook_afterTicks(chartLabel);
	}
	
	async endOfDay(chartLabel) {
		await this.modificationsCharge();
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
				label = quote.label;
				let instrument = quote.instrument;
				this.quotesQueueLock(false);
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
					this.chartInit(simu.chartLabel, simu.prevLabel, tick.timestamp);
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
				else if (simu.order_branches.includes(tick.label)) {
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
	
	cancelAllQuotes(trader, instrument) {
		let quotes = this.quoteGetKeys(trader, instrument);
		for (let quote of quotes) {
			this.cancelQuote(quote.trader, quote.instrument, quote.label);
		}
	}
	
	//todo take and subsequently use order_id
	orderSent(idNum, quote) {
		let order = this.quoteGetByNum(idNum);
		if (!order) {
			console.error('sent order not found', idNum, quote, this.findOrder(idNum));
			return;
		}
		let {instrument, label} = order;
		quote.status = 'sent';
		this.quoteUpdate(quote);
		this.chartPushTicks(
			label,
			{x: quote.timestamp, y: quote.price},
			{x: quote.timestamp + 1, y: quote.price, sentinel: true},
		);
		this.strategy.hook_orderSent(quote.tid, instrument, label, quote.price);
	}
	
	//todo use order_id
	dismissQuote(idNum) {
		this.simu_db.transaction(D => {
		//let D;
			let order = this.quoteGetByNum(idNum, D);
			if (!order) {
				console.error('dismissed order not found', idNum, this.findOrder(idNum));
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
	
	setLastPrice(instrument, price, time, db) {
		let ret = super.setLastPrice(instrument, price, time, db);
		this.strategy.hook_setLastPrice(instrument, price, time);
		return ret;
	}
	
	tickMidPoint(instrument, midPoint, time) {
		let ret = super.tickMidPoint(instrument, midPoint, time);
		this.strategy.hook_tickMidPoint(instrument, midPoint, time);
		let tick = {
			x: time,
			y: midPoint,
		};
		this.chartPushTicks('midpoint', tick);
		return ret;
	}
	
	orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice) {
		let ret = super.orderFulfill(idNum, trader, qty, fulfilled, commission, avgPrice);
		if (trader != this.trader_tid) {
			return;
		}
		let order = this.quoteGetByNum(idNum);
		if (!order) {
			console.error('fulfilled order not found', idNum, this.findOrder(idNum));
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
		return ret;
	}
	
	orderExecuted(idNum, trader, time, qty, price) {
		let ret = super.orderExecuted(idNum, trader, time, qty, price);
		if (trader != this.trader_tid) {
			return;
		}
		let order = this.quoteGetByNum(idNum);
		if (!order) {
			console.error('executed order not found', idNum, this.findOrder(idNum));
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
		return ret;
	}
	
	orderCancelled(idNum, trader, time) {
		let ret = super.orderCancelled(idNum, trader, time);
		if (trader != this.trader_tid) {
			return;
		}
		let order = this.quoteGetByNum(idNum);
		if (!order) {
			console.error('cancelled order not found', idNum, this.findOrder(idNum));
			return;
		}
		let {instrument, label} = order;
		this.dismissQuote(idNum);
		//why
		//this.derailedLabels[instrument][label] = true;
		//this?
		this.strategy.hook_orderCancelled(instrument, label, trader, time);
		return ret;
	}
	
	orderRejected(idNum, why) {
		let ret = super.orderRejected(idNum, why);
		console.log('rejected order', idNum, why);
		this.quoteDismiss(idNum);
		return ret;
	}
	
	traderBalance({trader, instrument, amount, lastprice, value, liquidation, time, extra}) {
		let ret = super.traderBalance(
			{trader, instrument, amount, lastprice, value, liquidation, time, extra});
		this.strategy.hook_traderBalance(
			trader, instrument, amount, lastprice, value, liquidation, time, extra);
		return ret;
	}
	
	traderNLV({trader, nlv, extra}) {
		let ret = super.traderNLV({trader, nlv, extra});
		this.strategy.hook_traderNLV(trader, nlv, extra);
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
		if (data.idNum in this.order_names) {
			let [instrument, order_label] = this.order_names[data.idNum];
			data.order_label = order_label;
			data.event_dt = this.dtFormat(data.event_dt);
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
	
	studySide(side, chartLabel) {
		let labels =
			this.market_orders
				.filter(label => label != side)
			.concat(
				this.trader_orders
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

