
select
	trader,
	sum(amount * lastbid) as nlv
from trader_balance
inner join instrument on symbol=instrument
where (trader=:trader)
