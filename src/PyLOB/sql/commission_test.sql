select 
	round(
		sum(commission)
	, 10) 
	as commission_balance
from (
	select sum(amount) as commission
	from trader_balance 
	where instrument='USD'
	union all
	select sum(commission) as commission 
	from trade_order
	inner join instrument
		on trade_order.instrument=instrument.symbol
	where instrument.currency='USD'
) as commission_row;
