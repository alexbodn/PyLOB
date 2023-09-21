
-- the sign of amount varies for deposit/withdrawal
insert into cash_balance (trader, currency, amount)
values (:trader, :currency, :amount)
on conflict (trader, currency) do
update
set amount=amount+:amount
where trader=:trader and currency=:currency
;
