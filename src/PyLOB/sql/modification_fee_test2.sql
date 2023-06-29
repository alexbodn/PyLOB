
select
	trade_order.order_id,
	modification_debit,
	trade_order.execution_credit
from trade_order
inner join (
	select order_id, 1 as credit
	from order_log
	where label='fulfill_order'
	group by order_id
) as credit on trade_order.order_id=credit.order_id
inner join (
	select order_id, count(order_id) as debit
	from order_log
	where label in ('modify_order', 'cancel_order')
	group by order_id
) as debit on trade_order.order_id=debit.order_id
inner join instrument on instrument.symbol=trade_order.instrument
inner join instrument as currency on instrument.currency=currency.symbol
where
	trade_order.instrument=:instrument and
	round(modification_debit, currency.rounder)<>round(debit * instrument.modification_fee, currency.rounder)
	or round(trade_order.execution_credit, currency.rounder)<>round(credit * instrument.execution_credit, currency.rounder)
