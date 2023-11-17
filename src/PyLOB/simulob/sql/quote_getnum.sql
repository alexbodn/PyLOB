
select idNum
from trader_quotes
where trader=:trader and instrument=:instrument and label=:label
;
