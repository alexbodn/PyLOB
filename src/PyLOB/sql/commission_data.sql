
select
	commission_min, commission_per_unit,
	commission_max_percnt,
	currency.rounder as decimals
from trader
inner join instrument
	on instrument.symbol=:instrument
inner join instrument as currency
	on instrument.currency=currency.symbol
where tid=:trader

