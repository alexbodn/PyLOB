
-- status of order
select order_id, idNum, trader, qty, fulfilled, commission
from trade_order
where order_id in (:bid_order, :ask_order)
