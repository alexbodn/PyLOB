
insert into cash_balance (trader, currency, amount)
values (:trader, :currency, 0)
on conflict (trader, currency) do
update
set amount=0
where trader=:trader and currency=:currency
;
