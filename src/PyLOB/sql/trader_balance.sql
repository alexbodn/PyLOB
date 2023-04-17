select
	instrument, 
	amount,
	amount_promised,
	lastprice,
	amount * lastprice as value,
	-- should rather be: best bid
	amount * lastbid as liquidation
from trader_balance
inner join instrument on symbol=instrument
where trader=:trader
	and (:symbol is null or instrument=:symbol)
