
-- status of order
select order_id, idNum, trader, side, qty, fulfilled, commission, fulfill_price
from trade_order
where order_id in (:bid_order, :ask_order)
