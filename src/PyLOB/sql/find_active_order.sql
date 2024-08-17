
select side, instrument, price, qty, fulfilled, cancel, order_id, order_type, trader, idNum
from trade_order 
where idNum=:idNum or order_id=:order_id
	and cancel=0 and fulfilled < qty
;
