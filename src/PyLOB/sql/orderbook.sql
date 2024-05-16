
PRAGMA foreign_keys=on;
PRAGMA recursive_triggers=1;

begin transaction;

create table if not exists trader (
    tid integer not null primary key,
    name text,
    currency text default('USD'),
    -- commission calculations in the currency of the instrument
    commission_per_unit real default(0),
    commission_min real default(0),
    commission_max_percnt real default(0),
    allow_self_matching integer default(0),
    foreign key(currency) references instrument(symbol)
) -- strict
;

create table if not exists instrument (
    symbol text primary key,
    currency text,
    rounder integer default(4),
    lastprice real,
    lastbid real,
	lastask real,
	modification_fee real default(0),
	execution_credit real default(0),
	foreign key(currency)
		references instrument(symbol)
		on DELETE restrict
		on UPDATE cascade
) -- strict
;

create trigger if not exists instrument_update_lock
    BEFORE UPDATE OF symbol, currency ON instrument
BEGIN
    select RAISE (ABORT, 'symbol and currency may not be updated');
END;

create trigger if not exists base_currency
    AFTER INSERT ON instrument
BEGIN
    update instrument
	set lastprice=1,
        lastbid=1,
		lastask=1
    where new.currency is null and symbol=new.symbol;
END;

insert into instrument (symbol, currency) 
values ('USD', null) 
on conflict(symbol) do nothing;

create table if not exists cash_balance (
    trader integer, -- trader
    currency text,
    amount real not null default(0),
    primary key(trader, currency),
    foreign key(trader) references trader(tid),
    foreign key(currency) references instrument(symbol)
) -- strict
;

create table if not exists trader_balance (
    trader integer, -- trader
    instrument text,
    amount real not null default(0),
	modification_debit real default(0), -- grow on modify/cancel
	execution_credit real default(0), -- grow on execution, only if 0
    primary key(trader, instrument),
    foreign key(trader) references trader(tid),
    foreign key(instrument) references instrument(symbol)
) -- strict
;

-- todo change of commission should update balance
create table if not exists commission (
	id integer primary key,
	order_id integer,
	name text not null,
	amount real,
	unique(order_id, name) on conflict replace,
	foreign key (order_id) references trade_order(order_id)
) -- strict
;

create table if not exists side (
    side text primary key check (side in ('bid', 'ask')),
    matching text,
    matching_order integer,
    foreign key (matching) references side(side)
) -- strict
;

insert into side (side, matching, matching_order) 
values 
    ('bid', 'ask', -1),
    ('ask', 'bid', 1)
on conflict(side) do nothing;

create trigger if not exists SIDE_DELETE_LOCK
    BEFORE DELETE ON side
BEGIN
    select RAISE (ABORT, 'side may not be deleted');
END;

create trigger if not exists SIDE_UPDATE_LOCK
    BEFORE UPDATE ON side
BEGIN
    select RAISE (ABORT, 'side may not be updated');
END;

create table if not exists trade_order (
    order_id integer primary key, -- permId on IB
    instrument text,
    order_type text, -- currently limit / market
    side text, -- bid/ask
-------
    --event_dt text default(datetime('now')), -- supplied
    event_dt integer default(CAST(ROUND((julianday('now') - 2440587.5)*86400000) As INTEGER)),
-------
    qty integer not null, -- required
    fulfilled integer default(0), -- accumulator of trades by :side _order
    price real, -- trigger price, null for market
    idNum integer unique, -- externally supplied, optional
    trader integer, -- trader
    active integer default(1),
    cancel integer default(0),
    condition integer, -- optional
    fulfill_price real default(0),
    commission real not null default(0), -- calculate on fulfill or on cancel, else nullify
	modification_debit real default(0), -- grow on modify/cancel
	execution_credit real default(0), -- grow on execution, only if 0
    currency text, -- redundant, but frequently used
    foreign key(side) references side(side),
    foreign key(trader) references trader(tid),
    foreign key(condition) references event_condition(condition),
    foreign key(instrument) references instrument(symbol),
    foreign key(currency) references instrument(symbol)
) -- STRICT
;

create index if not exists order_priority 
	on trade_order (side, instrument, price asc, event_dt asc);
create index if not exists order_idnum on trade_order (idNum asc);

create view if not exists best_quotes as
select 
    order_id, idNum, side.side as side, price, 
    qty, fulfilled, qty-fulfilled as available, 
    event_dt, instrument, trade_order.trader, allow_self_matching, 
    matching, matching_order
from trade_order
inner join trader on trader.tid=trade_order.trader
inner join side on side.side=trade_order.side
where active=1 and cancel=0 and qty>fulfilled
-- please note, that the order by clause may need to be added to your select
order by 
    side asc,
    case when price is null then 0 else 1 end asc, -- null prices are always best
    matching_order * coalesce(price, 0) asc,
    event_dt asc
;

create view if not exists order_detail as
select 
    order_id, instrument, instrument.currency, order_type, side, event_dt, 
    qty, fulfilled, price, idNum, trader, active, cancel, 
    -- the commission in case the entire order would be executed
    case when active=1 
    then commission 
    else round(
		min(
    		commission_max_percnt * price * qty / 100, 
    		max(commission_min, commission_per_unit * qty)
		), currency.rounder)
    end as commission, 
    instrument.currency as commission_currency
from trade_order
inner join instrument on trade_order.instrument=instrument.symbol
inner join instrument as currency on currency.symbol=instrument.currency
inner join trader on trader.tid=trade_order.trader
;

create trigger if not exists order_lock
    BEFORE UPDATE OF order_type, order_id, idNum, instrument, side ON trade_order
BEGIN
    select RAISE (ABORT, 'fields: order_type, order_id, idNum, instrument, side may not be changed');
END;

create trigger if not exists order_insert
    AFTER INSERT ON trade_order
BEGIN
    -- set default timestamp
    update trade_order
    set event_dt=
    	case when event_dt is null
    		then CAST(ROUND((julianday('now') - 2440587.5)*86400000) As INTEGER)
    		else event_dt
    	end,
		currency=instrument.currency
    from (
        select currency, lastask, lastbid, lastprice
        from instrument
        where instrument.symbol=new.instrument
    ) as instrument
    where trade_order.order_id=new.order_id;
    -- ensure trader has balance records for instrument and instrument.currency
    insert into trader_balance (trader, instrument) 
    select new.trader, new.instrument 
    on conflict(trader, instrument) do nothing;
    insert into trader_balance (trader, instrument) 
    select new.trader, instrument.currency
    from instrument 
    where instrument.symbol=new.instrument 
    on conflict(trader, instrument) do nothing;
END;

create trigger if not exists order_modify
    AFTER UPDATE OF qty, price ON trade_order
BEGIN
    update trade_order
    set modification_debit=trade_order.modification_debit+fee.fee
    from (
        select instrument.modification_fee as fee
        from instrument
        where new.instrument=instrument.symbol
    ) as fee
    where
    	trade_order.order_id=new.order_id;
END;

create trigger if not exists order_cancel_or_fulfill
    AFTER UPDATE OF cancel, fulfilled, fulfill_price ON trade_order
BEGIN
    update trade_order
    set commission=round(
		min(
			trader.commission_max_percnt * new.fulfill_price / 100, 
			max(trader.commission_min, trader.commission_per_unit * new.fulfilled)
		), commission_rounder),
		modification_debit=trade_order.modification_debit + case when new.cancel>old.cancel then trader.modification_fee else 0 end,
		execution_credit=case when new.fulfilled>0 then trader.execution_credit else 0 end
    from (
        select 
			commission_max_percnt, commission_min, commission_per_unit, 
			currency.rounder as commission_rounder,
			instrument.modification_fee,
			instrument.execution_credit
        from trader
        inner join instrument on new.instrument=instrument.symbol
		inner join instrument as currency on currency.symbol=instrument.currency
        where trader.tid=new.trader
    ) as trader
    where
    	trade_order.order_id=new.order_id
    	and old.cancel=0 -- not fulfilling anymore??
    	and new.fulfilled>0;
END;

create trigger if not exists trader_commission
    AFTER UPDATE OF commission ON trade_order
BEGIN
	-- todo save in commission table
    update trader_balance
    set amount=amount - (new.commission - old.commission)
    where trader_balance.trader=new.trader and trader_balance.instrument=new.currency;
END;

create trigger if not exists trader_modification_fee
    AFTER UPDATE OF modification_debit, execution_credit ON trade_order
BEGIN
	-- todo save in fees table
    update trader_balance
	set modification_debit=trader_balance.modification_debit+new.modification_debit-old.modification_debit,
		execution_credit=trader_balance.execution_credit+new.execution_credit-old.execution_credit
    where trader_balance.trader=new.trader and trader_balance.instrument=new.instrument;
END;

/*
create trigger if not exists trader_modification_fee
    AFTER UPDATE OF commission, modification_debit, execution_credit ON trade_order
BEGIN
    update trader_balance
    set amount=amount - (new.commission - old.commission)
    where new.commission<>old.commission
    	and trader_balance.trader=new.trader and trader_balance.instrument=new.currency;
    update trader_balance
	set modification_debit=trader_balance.modification_debit+new.modification_debit-old.modification_debit,
		execution_credit=trader_balance.execution_credit+new.execution_credit-old.execution_credit
    where (new.modification_debit<>old.modification_debit or new.execution_credit<>old.execution_credit)
    	and trader_balance.trader=new.trader and trader_balance.instrument=new.instrument;
END;
*/

create table if not exists trade (
    trade_id integer primary key, 
    bid_order integer,
    ask_order integer,
-------
    --event_dt text default(datetime('now')),
    event_dt integer default(CAST(ROUND((julianday('now') - 2440587.5)*86400000) As INTEGER)),
-------
    price real, -- order price or better
    qty integer, -- accumulates to fulfill of orders
    idNum integer, -- external supplied, optional
    foreign key(bid_order) references trade_order(order_id),
    foreign key(ask_order) references trade_order(order_id)
) -- STRICT
;

create trigger if not exists trade_lock
    BEFORE UPDATE OF qty, price, bid_order, ask_order ON trade
BEGIN
    select RAISE (ABORT, 'fields: qty, price, bid_order, ask_order may not be changed');
END;

create trigger if not exists trade_insert
    AFTER INSERT ON trade
BEGIN
    -- set default timestamp
    update trade
    set event_dt=CAST(ROUND((julianday('now') - 2440587.5)*86400000) As INTEGER)
    where new.event_dt is null 
        and trade.trade_id=new.trade_id;
    -- increase order fulfillment
    update trade_order 
    set fulfilled=fulfilled + new.qty,
    	fulfill_price=fulfill_price + new.qty * new.price
    where order_id in (new.bid_order, new.ask_order);
    
    -- bid balance increases by qty instrument
    update trader_balance
    set amount=trader_balance.amount + bid_order.amount
    from (
        select trader, instrument, new.qty as amount
        from trade_order 
        where trade_order.order_id=new.bid_order
    ) as bid_order
    where 
        trader_balance.trader=bid_order.trader and
        trader_balance.instrument=bid_order.instrument;
    
    -- ask balance increases by qty * price instrument.currency
    update trader_balance
    set amount=trader_balance.amount + ask_order.amount
    from (
        select trader, currency,
        	new.qty * new.price as amount
        from trade_order 
        where trade_order.order_id=new.ask_order
    ) as ask_order
    where 
        trader_balance.trader=ask_order.trader and
        trader_balance.instrument=ask_order.currency;
    
    -- ask balance decreases by qty instrument
    update trader_balance
    set amount=trader_balance.amount - ask_order.amount
    from (
        select trader, instrument, new.qty as amount
        from trade_order 
        where trade_order.order_id=new.ask_order
    ) as ask_order
    where 
        trader_balance.trader=ask_order.trader and
        trader_balance.instrument=ask_order.instrument;
    
    -- bid balance decreases by qty * price instrument.currency
    update trader_balance
    set amount=trader_balance.amount - bid_order.amount
    from (
        select trader, currency,
        	new.qty * new.price as amount
        from trade_order 
        where trade_order.order_id=new.bid_order
    ) as bid_order
    where 
        trader_balance.trader=bid_order.trader and
        trader_balance.instrument=bid_order.currency;
END;

create trigger if not exists trade_delete
    AFTER DELETE ON trade
BEGIN
    -- decrease order fulfillment
    update trade_order 
    set fulfilled=fulfilled - new.qty,
    	fulfill_price=fulfill_price - new.qty * new.price
    where order_id in (new.bid_order, new.ask_order);
    -- bid balance decreases by qty instrument
    update trader_balance
    set amount=trader_balance.amount - bid_order.qty 
    from (
        select trader, instrument, new.qty 
        from trade_order 
        where trade_order.order_id=new.bid_order
    ) as bid_order
    where 
        trader_balance.trader=bid_order.trader and
        trader_balance.instrument=bid_order.instrument;
    -- ask balance decreases by qty * price instrument.currency
    update trader_balance
    set amount=trader_balance.amount - ask_order.amount 
    from (
        select trader, currency, new.qty * new.price as amount
        from trade_order 
        where trade_order.order_id=new.ask_order
    ) as ask_order
    where 
        trader_balance.trader=ask_order.trader and
        trader_balance.instrument=ask_order.currency;
    -- ask balance increases by qty instrument
    update trader_balance
    set amount=trader_balance.amount + ask_order.qty 
    from (
        select trader, instrument, new.qty 
        from trade_order 
        where trade_order.order_id=new.ask_order
    ) as bid_order
    where 
        trader_balance.trader=ask_order.trader and
        trader_balance.instrument=ask_order.instrument;
    -- bid balance increases by qty * price instrument.currency
    update trader_balance
    set amount=trader_balance.amount + bid_order.amount 
    from (
        select trader, currency, new.qty * new.price as amount
        from trade_order 
        where trade_order.order_id=new.bid_order
    ) as bid_order
    where 
        trader_balance.trader=bid_order.trader and
        trader_balance.instrument=bid_order.currency;
END;

create view if not exists trade_detail as
select 
    'trade', trade.qty, trade.price, bidorder.instrument, trade.event_dt, trade.trade_id,
    case when bidorder.price is null or askorder.price is null or bidorder.price >= askorder.price 
    then '👍' else '👎'
    end as matches,
    'bid' as bid, bidorder.trader, bidorder.idNum, bidorder.qty, bidorder.price, bidorder.fulfilled, 
    'ask' as ask, askorder.trader, askorder.idNum, askorder.qty, askorder.price, askorder.fulfilled 
from trade
inner join trade_order as bidorder on bidorder.order_id=trade.bid_order 
inner join trade_order as askorder on askorder.order_id=trade.ask_order 
;

create table if not exists event (
    reqId integer,
    handler text, -- method on lob that will handle. it will handle using the args
    callback text, -- method to invoke on trigger
    condition text, -- arg values
    unique(reqId) on conflict replace
);

create table if not exists event_arg (
    reqId integer,
    arg text,
    val text,
    convertor text,
    unique(reqId, arg) on conflict replace,
    foreign key(reqId) references event(reqId) on delete cascade
);

create table if not exists event_condition (
	condition integer primary key,
	trader integer null,
	instrument text null,
	field text check (
		case when field is null then field='timestamp'
		else field in ('price', 'bid', 'ask') end),
	field_relation text check (field is null or field_relation in ('lt', 'gt', 'le', 'ge', 'eq')),
	field_value real check (field is null or field_value is not null),
	condition_relation integer null,
	foreign key (trader) references trader(tid),
	foreign key (instrument) references instrument(symbol),
	foreign key (condition_relation) references event_condition_relation(condition_relation)
);

create table if not exists event_condition_relation (
	condition_relation integer primary key,
	relation text check (condition_relation in ('and', 'or')),
	related1 integer,
	related2 integer,
	foreign key (related1) references event_condition(condition),
	foreign key (related2) references event_condition(condition)
);

create table if not exists order_log (
	event_dt integer default(CAST(ROUND((julianday('now') - 2440587.5)*86400000) As INTEGER)),
	order_id integer,
	label text,
	info text
);

create trigger if not exists order_log_insert
    AFTER INSERT ON order_log
BEGIN
    -- set default timestamp
    update order_log
    set event_dt=CAST(ROUND((julianday('now') - 2440587.5)*86400000) As INTEGER)
    where new.event_dt is null 
        and order_log.rowid=new.rowid;
END;

commit;
