
insert into trade (
    bid_order,
    ask_order,
    event_dt,
    price,
    qty
)
select
	:bid_order as bid_order,
	:ask_order as ask_order,
	:time as event_dt,
	:price as price,
	:qty as qty
where
	(
		select count(n)
		from (
			select 1 as n
			from trade_order
			where order_id in (:bid_order, :ask_order) and qty-fulfilled >= :qty
		) as to_fulfill
	)=2
