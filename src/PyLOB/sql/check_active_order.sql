
select cancel, qty, fulfilled
from trade_order 
where order_id=:order_id
	and cancel=0 and fulfilled < qty
;
