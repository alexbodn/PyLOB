
select side, instrument, price, qty, fulfilled, cancel, order_id, order_type, trader 
from trade_order 
where idNum=:idNum
	and cancel=0 and fulfilled < qty
;
