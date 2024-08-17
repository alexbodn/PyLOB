
insert into trader_quotes 
	(trader, instrument, side, qty, price, label, fulfilled, [quote], order_id, [status], [timestamp], idNum)
values (:trader, :instrument, :side, :qty, :price, :label, :fulfilled, :quote, :order_id, :status, :timestamp, :idNum)
on conflict (idNum)
do update
	set
		trader=:trader,
		instrument=:instrument,
		side=:side,
		qty=:qty,
		price=:price,
		label=:label,
		fulfilled=:fulfilled,
		[quote]=:quote,
		order_id=:order_id,
		[status]=:status,
		[timestamp]=:timestamp
where idNum=:idNum
;
