
-- deposit / withdraw will insert anyway
delete from cash_balance 
where trader=:trader and currency=:currency
;