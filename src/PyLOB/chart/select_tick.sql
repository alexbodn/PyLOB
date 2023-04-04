
select event_dt, Price, Bid, Ask, Size 
from tick 
where instrument=:instrument and event_dt between :dt_start and :dt_end
order by instrument, event_dt
