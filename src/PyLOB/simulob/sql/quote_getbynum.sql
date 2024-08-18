
select trader, instrument, label, side, [quote], idNum, order_id
from trader_quotes
where idNum=:idNum or order_id=:order_id
;
