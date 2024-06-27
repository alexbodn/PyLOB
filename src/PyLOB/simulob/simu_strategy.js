
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
	hook_newChartStart() {}
	hook_orderSent(tid, instrument, label, price) {}
	hook_tickLastPrice(instrument, price, time) {}
	hook_tickMidPoint(instrument, midPoint, time) {}
	hook_orderFulfill(instrument, label, trader, qty, fulfilled, commission, avgPrice) {}
	hook_orderExecuted(instrument, label, trader, time, qty, price) {}
	hook_orderCancelled(instrument, label, trader, time) {}
	hook_traderBalance(trader, instrument, amount, lastprice, value, liquidation, time, extra) {}
	hook_traderNLV(trader, nlv, extra) {}
	
	getName() {return this.constructor.name;}
	getButtons() {return {};}
};


class StrategyReceiver extends WorkerReceiver {
	constructor() {
		super();
	}
	
};

class StrategyForwarder extends StrategyReceiver {
	constructor(sender) {
		super();
		this.sender = sender;
		this.filters = {};
	}
	addFilter(field, value) {
		this.filters[field] = value;
	}
	forward(method, ...args) {
		this.sender(method, ...args);
	}
};

class StrategyClient extends WorkerClient {
	constructor(worker_url, receiver, dtFormat) {
		super(worker_url, receiver);
		this.dtFormat = dtFormat;
	}
};

if (typeof module !== 'undefined') {
	module.exports = {SimuStrategy};
}
