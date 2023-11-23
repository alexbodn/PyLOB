
select quote, idNum, order_id, [status]
from trader_quotes
where trader=:trader and instrument=:instrument and label=:label
and (:status is null or [status]=:status)
;
