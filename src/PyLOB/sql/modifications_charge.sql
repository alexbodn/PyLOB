--todo: should be transaction
update trader_balance
set amount=amount-instruments.fee
from (
	select
		instrument_balance.trader,
		instrument.currency,
		sum(max(instrument_balance.modification_fee-instrument_balance.execution_credit, 0)) as fee
	from trader_balance as instrument_balance
	inner join instrument on instrument.symbol=instrument_balance.instrument
	where currency is not null
	group by instrument_balance.trader, instrument.currency
) as instruments
where
	instruments.trader=trader_balance.trader
	and instruments.currency=trader_balance.instrument;
;
update trader_balance
set execution_credit=0,
	modification_fee=0
from (
	select symbol
	from instrument
	where currency is not null
) as instruments
where trader_balance.instrument=instruments.symbol
;
