
select
	trader,
	instrument,
	round(amount, rounder),
	lastprice,
	amount * lastprice as value,
	-- should rather be: best bid
	amount * lastbid as liquidation,
	trader_balance.modification_debit,
	trader_balance.execution_credit
from trader_balance
inner join instrument on symbol=instrument
where (:trader is null or trader=:trader)
	and (:symbol is null or instrument=:symbol)
order by trader, instrument
