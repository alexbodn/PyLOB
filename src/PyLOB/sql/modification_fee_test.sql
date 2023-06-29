
select
	trader_balance.trader,
	trader_balance.instrument,
	trader_balance.modification_debit as tdebit,
	odebit,
	trader_balance.execution_credit as tcredit,
	ocredit,
	orders.fee
from trader_balance
inner join (
	select
		trader,
		instrument,
		sum(modification_debit) as odebit,
		sum(execution_credit) as ocredit,
		max(sum(modification_debit)-sum(execution_credit), 0) as fee
	from trade_order
	where instrument=:instrument
	group by trader, instrument
) as orders
	on
		trader_balance.trader=orders.trader and
		trader_balance.instrument=orders.instrument
inner join instrument on instrument.symbol=trader_balance.instrument
inner join instrument as currency on instrument.currency=currency.symbol
where
	trader_balance.instrument=:instrument and
	round(odebit, currency.rounder)<>round(tdebit, currency.rounder)
	or round(ocredit, currency.rounder)<>round(tcredit, currency.rounder)
