
insert into trade (
    bid_order,
    ask_order,
    event_dt,
    price,
    qty
)
values (
	:bid_order,
	:ask_order,
	:time,
	:price,
	:qty
)
