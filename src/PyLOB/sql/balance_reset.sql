
update trader_balance
set amount=0
where trader=:trader and instrument=:instrument
