
select
	round(min(
		max(commission_min, commission_per_unit * :qty),
		commission_max_percnt / 100 * :qty *
		coalesce(:price, instrument.lastprice)
	), coalesce(currency.rounder, 4)) as commission
from trader
left outer join instrument as currency
	on :currency=currency.symbol
where tid=:trader

