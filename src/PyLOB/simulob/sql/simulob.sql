
PRAGMA foreign_keys=1;
PRAGMA recursive_triggers=1;

begin transaction;

create table if not exists requests (
    reqid integer not null primary key,
    extra text
);

create table if not exists trading_template (
    instrument text not null primary key,
    price real not null
);

create table if not exists template_level (
    instrument text not null,
    side text check (side in ('bid', 'ask')),
    [level] integer not null,
    price real not null,
    qty integer not null,
    step real not null,
    primary key (instrument, side, [level]),
    foreign key(instrument)
        references trading_template (instrument)
        on DELETE cascade
        on UPDATE cascade
);

create table if not exists trader_quotes (
    trader integer not null,
    instrument text not null,
    label text not null,
    side text check (side in ('bid', 'ask')),
    quote text,
    price real not null,
    qty integer not null,
    fulfilled integer not null default(0),
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

create trigger if not exists set_side
    AFTER INSERT ON trader_quotes
BEGIN
    update trader_quotes
	set side=substr(new.label, 1, 3)
    where idNum=new.idNum and new.side is null
    ;
END;

commit;
