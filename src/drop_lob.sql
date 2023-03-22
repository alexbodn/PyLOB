
begin transaction;

drop table if exists trader;
drop table if exists instrument;
drop table if exists trader_balance;
drop table if exists side;
drop table if exists trade_order;
drop table if exists trade;
drop table if exists event;
drop table if exists event_arg;

drop view if exists best_quotes;
drop view if exists order_detail;
drop view if exists trade_detail;

commit;

