
insert into trader_quotes 
    (trader, instrument, label, quote, idNum, order_id)
values (:trader, :instrument, :label, :quote, :idNum, :order_id)
on conflict (trader, instrument, label) -- where expr
do update
    quote=excluded.quote,
    idNum=excluded.idNum,
    order_id=excluded.order_id
where trader=excluded.trader and instrument=excluded.instrument and label=excluded.label
;
