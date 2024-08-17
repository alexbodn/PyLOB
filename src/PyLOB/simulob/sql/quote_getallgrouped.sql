
with lastingroup as (
	select trader, instrument, label, max([timestamp]) as [timestamp]
	from trader_quotes
	group by trader, instrument, label
)
select trader, instrument, label, [quote], price, qty, fulfilled
from trader_quotes
inner join lastingroup using (trader, instrument, label, [timestamp])
where
    trader=:trader and
    (:instrument is null or instrument=:instrument) and
    (:side is null or side=:side) and
    (:status is null or [status]=:status)
group by trader, instrument, label
;
