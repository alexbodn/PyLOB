select 
	trader, 
	instrument, 
	amount, 
	lastprice,
	amount * lastprice as value,
	amount * lastbid as liquidation
from trader_balance
inner join instrument on symbol=instrument
where trader in (:trader, :counterparty)
	and instrument in (:symbol, :currency)
order by trader, instrument
