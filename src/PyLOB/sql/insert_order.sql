
insert into trade_order (
	instrument,
	order_type, 
	side,
	event_dt, 
	qty, 
	price, 
	idNum, 
	trader
)
values (
	:instrument,
	:order_type,
	:side,
	:timestamp,
	:qty,
	:price,
	:idNum,
	:tid
)
