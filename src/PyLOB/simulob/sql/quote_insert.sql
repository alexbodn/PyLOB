
insert into trader_quotes 
    (trader, instrument, label, quote, price, qty, fulfilled, idNum, order_id, [status])
values (:trader, :instrument, :label, :quote, :price, :qty, :fulfilled, :idNum, :order_id, :status)
on conflict (trader, instrument, label) -- where expr
do update
    set quote=:quote,
        price=:price,
        qty=:qty,
        fulfilled=:fulfilled,
        idNum=:idNum,
        order_id=:order_id,
        [status]=:status
where trader=:trader and instrument=:instrument and label=:label
;
