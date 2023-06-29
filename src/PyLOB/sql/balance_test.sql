-- before charging modifications
select 
	instrument, 
	round(sum(amount), 10) as amount
from (
	select instrument, amount
	from trader_balance 
	union all
	select 
		currency as instrument, 
		commission as amount 
	from trade_order
)
group by instrument;
