select
	instrument, 
	amount, 
	lastprice,
	amount * lastprice as value,
	amount * lastbid as liquidation
from trader_balance
inner join instrument on symbol=instrument
where trader=:trader
	and (:symbol is null or instrument=:symbol)
