'use strict';

function showNLV(snlv, nlvColor) {
	let element = document.querySelector('#nlv');
	element.textContent = '';
	element.insertAdjacentHTML(
		'beforeend',
		`<div style="color: ${nlvColor}">${snlv}</div>`
	);
}

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

class SimuConsole extends SimuReceiver {
	
	titleLabel = 'title';
	
	title_branch = ['title'];
	price_branch = ['price'];
	balance_branch = ['nlv'];
	executions_branch = ['bought', 'sold'];
	market_orders = ['ask', 'bid'];
	
	// an index to the datasets
	chartIndex = {};
	chartBuffer = {};
	charts = {};
	
	updateGroups = {
		sum: 'sum',
	};
	updateFrequency = {
		default: 100,
		sum: 120,
		balance: 10,
		executions: 3,
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
			updateGroup: 'default',
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
	
	request_promises = {};
	reqIds = {};
	reqIdsLocked = false;
	
	constructor(oo, thisLocation) {
		super();
		this.loading = document.querySelector('#loading');
		this.paused = document.querySelector('#paused');
		this.location = thisLocation;
		const sqlite3Dir = '/node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm';
		this.worker_url = `${this.location}/simu_worker.js?sqlite3.dir=${sqlite3Dir}`;
		this.lobClient = new SimuClient(this.worker_url, this, null/*dtFormat*/);
		
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
		this.order_branches = [
			...this.market_orders,
		];
	}
	
	async init(strategy, config) {
		this.strategy = strategy;
		await this.lobClient.init();
		this.config = await this.lobClient.strategyLoad(strategy, config);
		this.order_branches.push(...this.config.trader_orders);
	}
	
	run(dates) {
		this.lobClient.run(dates);
	}
	
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
	
	getReqExtra(subject, reqId) {
		let promise = null, extra = null;
		try {
			if (reqId in this.request_promises) {
				promise = this.request_promises[reqId];
				delete this.request_promises[reqId];
			}
		}
		catch(error) {
			console.log('getReqExtra', error);
		}
		return [promise, extra];
	}
	
	getReqId = (subject, reqId=null, {extra=null, withPromise=false}={}) => {
		this.reqIdsLock();
		if (!(subject in this.reqIds)) {
			this.reqIds[subject] = 0;
		}
		if (!reqId) {
			reqId = ++this.reqIds[subject];
		}
		this.reqIdsLock(false);
		if (withPromise) {
			const promise = Promise.withResolvers();
			this.request_promises[reqId] = promise;
			return [reqId, promise.promise];
		}
		return reqId;
	}
	
	reqIdsLock(lock=true) {
		if (lock) {
			let checkInterval = setInterval(
				() => {
				if (!this.reqIdsLocked) {
					this.reqIdsLocked = true;
					clearInterval(checkInterval);
				}
			}, 1);
		}
		else {
			this.reqIdsLocked = false;
		}
	}
	
	studySide(side, chartLabel) {
		let labels =
			this.market_orders
				.filter(label => label != side)
			.concat(
				this.config.trader_orders
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
	
	pause(value=true) {
		if (this.loading) {
			this.loading.style.display = value ? 'none' : 'block';
		}
		if (this.paused) {
			this.paused.style.display = value ? 'block' : 'none';
		}
	}
	
	close() {
		for (let label of Object.keys(this.charts)) {
			this.chartDestroy(label);
		}
		this.lobClient.close();
	}
	
	setUpdateFrequency(frequencies) {
		objectUpdate(this.updateFrequency, frequencies);
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
	
	manualQuote() {
		const str = prompt('please enter a quote string', `bid 10 ${this.instrument} lmt 50`);
		this.lobClient.manualQuote(str);
	}
	
	async chartBuildDataset() {
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
		let ds_strategy = await this.lobClient.strategy_hook_chartBuildDataset()
		const strategy = SimuStrategy.getStrategy(this.strategy);
		for (let ds of ds_strategy) {
			if (ds.tooltip) {
				ds.tooltip = strategy[ds.tooltip];
			}
		}
		datasets.push(...ds_strategy);
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
		await this.lobClient.chartUpdateGroups([this.updateGroups, this.updateFrequency]);
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
			let ix = this.chartIndex[label]?.dataset;
			if (typeof ix === 'undefined') {
				return;
			}
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
		if (chartInfo.updating || chartInfo.updateTimeout) {
			return;
		}
		chartInfo.updateTimeout = setTimeout(
			this.chartDoUpdate,
			300, chartInfo
		);
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
					let titleTicks = ticks
						.map(tick => Object.assign({}, tick, {y: null}))
						;
					titleTicks.sort((a, b) => a.x - b.x);
					let sorted = !titleData.length || titleTicks.at(0).x >= titleData.at(-1).x;
					titleData.push(...titleTicks);
					if (!sorted) {
						titleData.sort((a, b) => a.x - b.x);
					}
				}
			}
			this.chartDataUpdate(label, ticks, chartLabel);
		}
	}
	
	_chartPushTicksBuffer(reqId, ticksBuffer) {
		for (let row of ticksBuffer) {
			let [label, chartLabel, ticks] = row;
			this._chartPushTicks(label, chartLabel, ...ticks);
		}
		this.lobClient.sendQuery('done', reqId);
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
				this.setTableField('status', field, value);
			}
		}
	}
	
	clearTableField(tableId, field) {
		clearTableField(tableId, field);
	}
	
	setTableField(tableId, field, ...value) {
		setTableField(tableId, field, ...value);
	}
	
	showNLV(snlv, nlvColor) {
		showNLV(snlv, nlvColor);
	}
	
	chartInit = async (reqId, chartLabel, prevLabel, firstTime) => {
		let timeLabel = `chartInit ${chartLabel}`;
		console.time(timeLabel);
		this.chartLabel = chartLabel;
	/*
	this.prevLabel = prevLabel;
	this.firstTime = firstTime;*/
		this.charts[chartLabel] = {
			label: chartLabel,
			prevLabel,
			firstTime,
			dataBuffer: {},
			initialized: false,
		};
		let chartInfo = this.charts[chartLabel];
		let additionalPlugins = {
			afterInit: async (chart, args, options) => {
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
					let quotes = await this.lobClient.quoteGetAll(
						this.config.trader_tid, this.config.instrument, null, 'sent');
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
			beforeUpdate: async (chart, args, options) => {
				let data = await this.lobClient.strategy_hook_beforeUpdateChart(chartLabel);
				let chartInfo = this.getChartInfo(chartLabel);
				let sentinelTime = chartInfo.lastTime || data.now;
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
				return true;
			},
			afterUpdate: (chart, args, options) => {
				chartInfo.updating = false;
				chartInfo.updateTimeout = 0;
				return true;
			}
		};
		
		const tabLabel = `${this.strategy}/${chartLabel}`;
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
						<button class="manual-quote">manual quote</button>
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
			let buttons = await this.lobClient.strategy_getButtons();
			for (const [key, info] of Object.entries(buttons)) {
				buttonsDiv.insertAdjacentHTML(
					'beforeend',
					`<button class="${key}">${info.label}</button>`
				);
				tabInfo.querySelector('button.' + key).addEventListener(
					'click',
					e => {
						const strategy = SimuStrategy.getStrategy(this.strategy);
						const listener = strategy[info.listener];
						listener(e, this, chartLabel);
					}
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
			tabInfo.querySelector('button.manual-quote').addEventListener(
				'click',
				e => {this.manualQuote();}
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
		let datasets = await this.chartBuildDataset();
		chartConfig.data = {datasets};
		chartConfig.plugins.push(additionalPlugins);
		chartConfig.options.plugins.title.text = chartLabel;
		new Chart(canvas.getContext("2d"), chartConfig);
		this.lobClient.sendQuery('done', reqId);
	}
	
	afterTicks(chartLabel, lastTime) {
		let chartInfo = this.getChartInfo(chartLabel);
		chartInfo.lastTime = lastTime;
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
	}
	
	logHtml({cssClass, args}) {
		return logHtml(cssClass, args);
	}
};
