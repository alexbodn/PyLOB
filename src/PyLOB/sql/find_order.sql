
select side, instrument, price, qty, fulfilled, cancel, order_id, order_type, trader, promise_price 
from trade_order 
where idNum=:idNum
