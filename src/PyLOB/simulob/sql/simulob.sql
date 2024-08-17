
PRAGMA foreign_keys=on;
PRAGMA recursive_triggers=1;
PRAGMA cell_size_check=on;
PRAGMA cache_spill=off;

begin transaction;

create table if not exists requests_counters (
	subject text not null primary key,
	counter integer not null default(0)
) STRICT;

create table if not exists requests (
	rowid integer primary key,
	subject text not null,
	reqId integer default(-1),
	extra text,
	unique (subject, reqId) on conflict ignore
) STRICT;

create trigger if not exists default_reqId
	AFTER INSERT ON requests
BEGIN
	insert into requests_counters(subject)
	select new.subject
	on conflict(subject)
	do update
	set counter=counter+1
	where subject=new.subject;
	update requests
	set reqId=(
		select counter
		from requests_counters
		where requests_counters.subject=new.subject
	)
	where requests.rowid=new.rowid;
END;

create table if not exists trading_template (
	instrument text not null primary key,
	price real not null
) STRICT;

create table if not exists template_level (
	instrument text not null,
	side text check (side in ('bid', 'ask')),
	[level] integer not null, --label
	price real not null,
	qty integer not null,
	step real not null,
	primary key (instrument, side, [level]),
	foreign key(instrument)
		references trading_template (instrument)
		on DELETE cascade
		on UPDATE cascade
) STRICT;

-- this is the source of all quotes
create table if not exists trader_quotes (
	idNum integer primary key,
	trader integer not null,
	instrument text not null,
	side text check (side in ('bid', 'ask')),
	qty integer not null,
	price real,
	label text not null,
	fulfilled integer not null default(0),
	[quote] text, --will be removed
	order_id integer,
	[status] text default('created'),
	[timestamp] integer default(CAST(ROUND((julianday('now') - 2440587.5)*86400000) As INTEGER))
	--,
	--foreign key(trader) references trader(tid),
	--foreign key(instrument) references instrument(symbol)
) STRICT;

create index if not exists trader_quotes_ix
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
