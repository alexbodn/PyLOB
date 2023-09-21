
-- deposit / withdraw will insert anyway
delete from trader_balance
where trader=:trader and instrument=:instrument
;