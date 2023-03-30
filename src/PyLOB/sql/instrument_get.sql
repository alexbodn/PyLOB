
select rounder, lastprice, lastbid, lastask
from instrument 
where symbol=:instrument
