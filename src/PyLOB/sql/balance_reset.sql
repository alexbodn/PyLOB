
insert into trader_balance (trader, instrument, amount)
values (:trader, :instrument, 0)
on conflict (trader, instrument) do
update
set amount=0
where trader=:trader and instrument=:instrument
;
