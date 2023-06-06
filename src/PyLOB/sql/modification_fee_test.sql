
select
	trader_balance.trader,
	trader_balance.instrument,
	trader_balance.modification_fee,
	trader_balance.execution_credit,
	orders.fee
from trader_balance
inner join (
	select
		trader,
		instrument,
		sum(modification_fee) as modification_fee,
		sum(execution_credit) as execution_credit,
		max(sum(modification_fee)-sum(execution_credit), 0) as fee
	from trade_order
	group by trader, instrument
) as orders
	on
		trader_balance.trader=orders.trader and
		trader_balance.instrument=orders.instrument
where
	orders.modification_fee<>trader_balance.modification_fee
	or orders.execution_credit<>trader_balance.execution_credit
