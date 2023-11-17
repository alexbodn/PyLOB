
--PRAGMA foreign_keys=ON;

begin transaction;

create table if not exists requests (
    reqid integer not null primary key,
    extra text
);

create table if not exists trader_quotes (
    trader integer,
    instrument text,
    label text,
    side text,
    quote text,
    idNum integer unique,
    order_id integer,
    [status] text default('created'),
    primary key (trader, instrument, label)
    --,
    --foreign key(trader) references trader(tid),
    --foreign key(instrument) references instrument(symbol)
);

create unique index if not exists trader_quotes_ix
	on trader_quotes (trader, instrument, label);

commit;
