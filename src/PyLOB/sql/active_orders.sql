
select idNum, qty, fulfilled, price, event_dt, instrument
from best_quotes
where side=:side and instrument=:instrument
-- order by statement should be appended
