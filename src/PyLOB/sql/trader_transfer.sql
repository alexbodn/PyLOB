
-- the sign of amount varies for deposit/withdrawal
insert into trader_balance (trader, instrument, amount)
select :trader, :instrument, :amount
on conflict do nothing;
update trader_balance
set amount=amount+:amount
where trader=:trader and instrument=:instrument
