
update trader_quotes
    set quote=:quote,
        price=:price,
        qty=:qty,
        fulfilled=:fulfilled,
        order_id=:order_id,
        [status]=case when :status is null then [status] else :status end
where idNum=:idNum
;
