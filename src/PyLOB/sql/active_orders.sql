
select idNum, trader, qty, fulfilled, price, event_dt, instrument
from best_quotes
where 
	side=:side 
	and instrument=:instrument
	-- except orders of forWhom
	and (:forWhom is null or trader<>:forWhom or allow_self_matching=1)
-- order by statement should be appended
