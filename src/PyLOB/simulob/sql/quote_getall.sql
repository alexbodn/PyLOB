
select trader, instrument, label, quote, price, qty, fulfilled
from trader_quotes
where
    trader=:trader and
    (:instrument is null or instrument=:instrument) and
    (:side is null or side=:side) and
    (:status is null or [status]=:status)
;
