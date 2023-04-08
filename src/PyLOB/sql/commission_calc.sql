
select
	round(min(
		max(commission_min, commission_per_unit * :qty),
		commission_max_percnt / 100 * :qty *
		case when :price is null then instrument.lastprice else :price end
	), currency.rounder) as commission
from trader
inner join instrument
	on instrument.symbol=:instrument
inner join instrument as currency
	on instrument.currency=currency.symbol
where tid=:trader

