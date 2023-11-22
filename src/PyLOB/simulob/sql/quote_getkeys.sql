
select trader, instrument, label
from trader_quotes
where
    trader=:trader and
    (:side is null or side=:side) and
    (:instrument is null or instrument=:instrument)
;
