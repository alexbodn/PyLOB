
class SimuStrategy {
	
	static strategies = {};
	
	static classInit() {
		this.strategies[this.name] = this;
	}
	
	static getStrategy(name) {
		return this.strategies[name];
	}
	
	static strategyBuildDialog = (key, strategy) => {
		let strategyTab = sqlConsole.tabSearch(key), strategyDialog;
		if (!strategyTab) {
			[strategyTab, strategyDialog] = sqlConsole.createTab(
				key, `
				<div class="buttons">
					<button class="run">run</button>
					<button class="stop">stop</button>
					<button class="close">close</button>
					<button class="copy-config">copy</button>
					<button class="paste-config">paste</button>
					<button class="reset-config">reset</button>
				</div>
				<div class="config"></div>
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
				const
				sob = new SimuLOB(oo);
				sob.init(strategy).then(
					obj => {
						sqlConsole.setDb(sob.db);
						sob.run(dates);
						strategy.dialog.querySelector('button.stop').addEventListener(
							'click', e => {sob.close();});
						strategy.dialog.querySelector('button.close').addEventListener(
							'click', e => {sqlConsole.tabClose(strategyTab);});
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
	
	static strategyChoice(sqlConsole, oo) {
		let tab, tabInfo;
		const tag = 'strategies';
		tab = sqlConsole.tabSearch(tag);
		if (!tab) {
			const strategyButtons = Object.keys(this.strategies)
				.map(key => `<button class="strategy ${key}">${key}</button>`)
				.join('<br />');
			[tab, tabInfo] = sqlConsole.createTab(
				tag, `
				<div>
				${strategyButtons}
				</div>`, {
					searchTag: tag,
				}
			);
			Object.entries(this.strategies).forEach(([key, strategy], c) => {
				const button = tabInfo.querySelector(`button.strategy.${key}`)
				button.addEventListener(
					'click',
					e => {this.strategyBuildDialog(key, strategy);}
				);
				if (!c) {
					button.focus();
				}
			});
		}
		tab = sqlConsole.tabActivate(tab);
	}
	
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
	
	async hook_afterInit() {return Promise.resolve();}
	hook_chartBuildDataset(datasets) {}
	hook_beforeUpdateChart(chartLabel) {}
	hook_afterTicks(chartLabel) {}
	hook_newChartStart() {}
	hook_orderSent(tid, instrument, label, price) {}
	hook_setLastPrice(instrument, price, time) {}
	hook_tickMidPoint(instrument, midPoint, time) {}
	hook_orderFulfill(instrument, label, trader, qty, fulfilled, commission, avgPrice) {}
	hook_orderExecuted(instrument, label, trader, time, qty, price) {}
	hook_orderCancelled(instrument, label, trader, time) {}
	hook_traderBalance(trader, instrument, amount, lastprice, value, liquidation, time, extra) {}
	hook_traderNLV(trader, nlv, extra) {}
	
	getName() {return this.constructor.name;}
	getButtons() {return {};}
};

