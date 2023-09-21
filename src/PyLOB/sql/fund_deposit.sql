
-- the sign of amount varies for deposit/withdrawal
insert into trader_balance (trader, instrument, amount)
values (:trader, :instrument, :amount)
on conflict (trader, instrument) do
update
set amount=amount+:amount
where trader=:trader and instrument=:instrument
;
