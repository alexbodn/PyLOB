
-- the sign of amount varies for deposit/ withdrawal
update trader_balance
set amount=amount+:amount
where trader=:trader and instrument=:instrument;
insert into trader_balance (trader, instrument, amount)
select :trader, :instrument, :amount
where not exists (
	select 1
	from trader_balance
	where trader=:trader and instrument=:instrument
);
