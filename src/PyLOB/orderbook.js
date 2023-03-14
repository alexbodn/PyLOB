

class OrderBook {
	valid_types = ['market', 'limit'];
    valid_sides = ['ask', 'bid'];
    queries = [
		'active_orders',
		'best_quotes',
		'best_quotes_order',
		'cancel_order',
		'find_order',
		'insert_order',
		'insert_trade',
		'limit1',
		'matches',
		'modify_order',
		'select_trades',
		'set_lastprice',
		'volume_at_price',
    ];
    
	constructor(location, file_loader, db, tick_size=0.0001) {
		this.location = location;
		this.file_loader = file_loader;
		let obj = this;
		for (let query of this.queries) {
			let ret = file_loader(location + '/sql/' + query + '.sql');
			ret.then(function(data) {
				obj[query] = data;
				console.log(data);
			});
        }
        this.lastTick = null;
		this.lastPrice = {};
        this.lastTimestamp = 0;
        this.tickSize = tick_size
        this.rounder = int(Math.log10(1 / this.tickSize));
        this.time = 0;
        this.nextQuoteID = 0;
        this.db = db;
        this.best_quotes_order_asc = this.best_quotes_order.replace(':direction', 'asc');
        this.best_quotes_order_desc = this.best_quotes_order.replace(':direction', 'desc');
        this.best_quotes_order_map = {
            desc: this.best_quotes_order_desc,
            asc: this.best_quotes_order_asc
		};
	}
};


