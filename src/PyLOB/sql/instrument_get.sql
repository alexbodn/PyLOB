
select rounder, currency, lastprice, lastbid, lastask
from instrument 
where symbol=:instrument
