
--delete from trader_quotes
update trader_quotes
set [status]='dismissed'
where idNum=:idNum
;
