-- before charging modifications
select
	instrument,
	round(amount, rounder) as amount
from (
	select 
		instrument, sum(amount) as amount
	from (
		select instrument, amount
		from trader_balance 
		union all
		select 
			currency as instrument, 
			commission as amount 
		from trade_order
	)
	group by instrument
) as balance
inner join instrument
	on instrument.symbol=balance.instrument
where balance.instrument in (
	select :instrument
	union all
	select currency
	from instrument
	where symbol=:instrument
)