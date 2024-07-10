
class SimuStrategy {
	
	static strategies = {};
	
	static classInit() {
		this.strategies[this.name] = this;
	}
	
	static getStrategy(name) {
		return this.strategies[name];
	}
	
	static strategyBuildDialog = (key, strategy, dates) => {
		let strategyTab = sqlConsole.tabSearch(key), strategyDialog;
		if (!strategyTab) {
			const datesList = dates
				.map(date => `<label><input type="checkbox" value="${date}"> ${date}</label>`)
				.join('\n');
			[strategyTab, strategyDialog] = sqlConsole.createTab(
				key, `
				<div class="buttons" style="float: inline-start; width: 10%;">
					<button class="run" autofocus="autofocus">run</button>
					<button class="stop">stop</button>
					<button class="close">close</button>
					<button class="copy-config">copy</button>
					<button class="paste-config">paste</button>
					<button class="reset-config">reset</button>
				</div>
				<div class="config" style="float: inline-start; width: 50%"></div>
				<div style="float: inline-start; width: 10%;">
					<fieldset class="dates">
						<p>choose dates</p>
						${datesList}
					</fieldset>
				</div>
				`, {
					searchTag: key,
				}
			);
		}
		strategy.dialog = strategyDialog;
		strategy.showConfig();
		strategy.dialog.querySelector('button.close').addEventListener(
			'click',
			e => {
				if (window.strategyClass === strategy) {
					window.strategyClass = null;
				}
				sqlConsole.tabClose(strategyTab);
			}
		);
		strategy.dialog.querySelector('button.run').addEventListener(
			'click',
			e => {
				const simuLocation = new URL('PyLOB/simulob', window.location.href);
				const sob = new SimuConsole(oo, simuLocation);
				const defaults = strategy.getDialogConfig();
				sob.init(strategy.name, defaults).then(
					obj => {
						//sqlConsole.setDb(sob.db);
						sob.run(dates);
						strategy.dialog.querySelector('button.stop').addEventListener(
							'click', e => {sob.close();});
						strategy.dialog.querySelector('button.close').addEventListener(
							'click', e => {
								sob.close();
								sqlConsole.tabClose(strategyTab);
							}
						);
					}
				);
			}
		);
		strategy.dialog.querySelector('button.copy-config').addEventListener(
			'click',
			e => {
				let config = strategy.getDialogConfig();
				strategy.textToClipboard(config);
			}
		);
		strategy.dialog.querySelector('button.paste-config').addEventListener(
			'click',
			e => {
				strategy.textFromClipboard().then(config => {
					strategy.setDialogConfig(config);
				});
			}
		);
		sqlConsole.tabActivate(strategyTab);
		window.strategyClass = strategy;
	}
	
	static strategyChoice(sqlConsole, oo, dates) {
		let tab, tabInfo;
		const tag = 'strategies';
		tab = sqlConsole.tabSearch(tag);
		if (!tab) {
			let c = 0;
			const strategyButtons = Object.keys(this.strategies)
				.map(key => `
					<button class="strategy ${key}" style="float: inline-start;" ${c ? '' : 'autofocus="autofocus"'}>
						${key}
					</button>`)
				.join('\n');
			[tab, tabInfo] = sqlConsole.createTab(
				tag, `
				<div>
					<div>
						${strategyButtons}
					</div>
				</div>
				`, {
					searchTag: tag,
				}
			);
			Object.entries(this.strategies).forEach(([key, strategy], c) => {
				const button = tabInfo.querySelector(`button.strategy.${key}`)
				button.addEventListener(
					'click',
					e => {this.strategyBuildDialog(key, strategy, dates);}
				);
				if (!c) {
					button.focus();
				}
			});
		}
		tab = sqlConsole.tabActivate(tab);
	}
	
	// human readable version
	static getDialogConfig() {return {};}
	static setDialogConfig(text) {}
	
	static async textToClipboard(text) {
		await navigator.clipboard.writeText(text).then(
			() => {
				//alert('clipboard successfully set');
			},
			() => {
				alert('clipboard write failed');
			},
		);
	}
	
	static async textFromClipboard() {
		return navigator.clipboard.readText().then(
			(text) => {
				return text;
			},
			() => {
				alert('clipboard read failed');
			},
		);
	}
	
	static showConfig(sqlConsole) {}
	
	constructor(simu, defaults) {
		this.simu = simu;
		this.defaults = defaults;
	}
	
	logobj(...args) {
		return this.simu.logobj(...args);
	}
	
	async hook_afterInit() {return Promise.resolve();}
	async hook_chartBuildDataset(datasets) {return Promise.resolve([]);}
	hook_beforeUpdateChart(chartLabel) {}
	hook_afterTicks(chartLabel, lastTime) {}
	hook_newChartStart(chartLabel, firstTime) {}
	hook_orderSent(instrument, label, tid, price, qty) {}
	hook_tickLastPrice(instrument, price, time) {}
	hook_tickMidPoint(instrument, midPoint, time) {}
	hook_orderFulfill(instrument, label, trader, qty, fulfilled, commission, avgPrice) {}
	hook_orderExecuted(instrument, label, trader, time, qty, price) {}
	hook_orderCancelled(instrument, label, trader, time) {}
	hook_dismissQuote(instrument, label, trader) {}
	hook_traderBalance(trader, instrument, amount, lastprice, value, liquidation, time, extra) {}
	hook_traderNLV(trader, nlv, extra) {}
	
	getName() {return this.constructor.name;}
	getButtons() {return {};}
};

//receives info from strategy. forwards to simu
class StrategyReceiver extends WorkerReceiver {
	constructor(forwarder) {
		super(forwarder);
	}
};

	/*
createInstrument
createTrader
getRounder
logobj
order_log_show
pause
quoteGetAll
quotesQueue
quotesQueueLock
setRounder
setUpdateFrequency
traderCashDeposit
traderCashReset
traderFundsDeposit
traderFundsReset
traderGetBalance
traderGetNLV
valid_sides
verbose
*/

class StrategyForwarder extends StrategyReceiver {
	config = {};
	
	constructor(forwarder) {
		super(forwarder);
	}
	addFilter(field, value) {
	}
	chartPushTicks(label, ...ticks) {
	}
	async _chartPushTicks(label, chartLabel, ...ticks) {
	}
	chartSetTicks(label, ticks, chartLabel) {
	}
	clearTableField(tableId, field) {
	}
	setTableField(tableId, field, ...value) {
	}
	showNLV(snlv, nlvColor) {
	}
};

//invokes the strategy in a worker
class StrategyClient extends WorkerClient {
	constructor(worker_url, receiver) {
		super(worker_url, receiver);
	}
	async hook_afterInit() {
		return this.sendRegistered('hook_afterInitReq');
	}
	async hook_chartBuildDataset(datasets) {
		return this.sendRegistered('hook_chartBuildDatasetReq', null, datasets);
	}
	hook_beforeUpdateChart(...args) {
		this.sendQuery('hook_beforeUpdateChart', ...args);
	}
	hook_afterTicks(...args) {
		this.sendQuery('hook_afterTicks', ...args);
	}
	hook_newChartStart(...args) {
		this.sendQuery('hook_newChartStart', ...args);
	}
	hook_orderSent(...args) {
		this.sendQuery('hook_orderSent', ...args);
	}
	hook_tickLastPrice(...args) {
		this.sendQuery('hook_tickLastPrice', ...args);
	}
	hook_tickMidPoint(...args) {
		this.sendQuery('hook_tickMidPoint', ...args);
	}
	hook_orderFulfill(...args) {
		this.sendQuery('hook_orderFulfill', ...args);
	}
	hook_orderExecuted(...args) {
		this.sendQuery('hook_orderExecuted', ...args);
	}
	hook_orderCancelled(...args) {
		this.sendQuery('hook_orderCancelled', ...args);
	}
	hook_dismissQuote(...args) {
		this.sendQuery('hook_dismissQuote', ...args);
	}
	hook_traderBalance(...args) {
		this.sendQuery('hook_traderBalance', ...args);
	}
	hook_traderNLV(...args) {
		this.sendQuery('hook_traderNLV', ...args);
	}
};

if (typeof module !== 'undefined') {
	module.exports = {SimuStrategy};
}
