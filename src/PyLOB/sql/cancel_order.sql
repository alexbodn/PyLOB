
update trade_order 
set cancel=:cancel
where
	order_id=:order_id
