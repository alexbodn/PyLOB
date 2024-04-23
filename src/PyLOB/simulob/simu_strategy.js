
class SimuStrategy {
	
	constructor(simu) {
		this.simu = simu;
	}
	
	async hook_afterInit(simu) {return Promise.resolve();}
	
	hook_chartBuildDataset(simu, datasets) {}
	
	hook_beforeUpdateChart(simu, chartLabel) {}
	
	hook_afterTicks(simu, chartLabel) {}
	
	hook_newChartStart(simu) {}
	
	hook_orderSent(simu, tid, instrument, label, price) {}
	
	hook_setLastPrice(simu, instrument, price) {}
	
	hook_tickMidPoint(simu, instrument, midPoint) {}
	
	hook_orderFulfill(simu, instrument, label, trader, qty, fulfilled, commission, avgPrice) {}
	
	hook_orderExecuted(simu, instrument, label, trader, time, qty, price) {}
	
	hook_orderCancelled(simu, instrument, label, trader, time) {}
	
	hook_traderBalance(simu, trader, instrument, amount, lastprice, value, liquidation, time, extra) {}
	
	hook_traderNLV(simu, trader, nlv, extra) {}
	
};

