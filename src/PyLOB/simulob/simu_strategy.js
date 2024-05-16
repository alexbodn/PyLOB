
class SimuStrategy {
	
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
	
	hook_setLastPrice(instrument, price) {}
	
	hook_tickMidPoint(instrument, midPoint) {}
	
	hook_orderFulfill(instrument, label, trader, qty, fulfilled, commission, avgPrice) {}
	
	hook_orderExecuted(instrument, label, trader, time, qty, price) {}
	
	hook_orderCancelled(instrument, label, trader, time) {}
	
	hook_traderBalance(trader, instrument, amount, lastprice, value, liquidation, time, extra) {}
	
	hook_traderNLV(trader, nlv, extra) {}
	
};

