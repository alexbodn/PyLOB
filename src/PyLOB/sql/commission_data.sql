
select
	commission_min, commission_per_unit,
	commission_max_percnt,
	coalesce(currency.rounder, 4) as decimals
from trader
inner join instrument as currency
	on :currency=currency.symbol
where tid=:trader

