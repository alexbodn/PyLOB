
from PyLOB import OrderBook
import sqlite3
from datetime import datetime, timedelta, date, time

#bid: buy
#ask: sell

instrument = 'IVE'
day = date(2009, 9, 29)

def time_combine(tm):
    if not tm or tm is time.min:
        return None
    return datetime.combine(day, tm).strftime("%Y-%m-%dT%H:%M:%S.000Z")

bidask_connection = sqlite3.connect("../tickdata/bidask.db")
bidask_connection.isolation_level = None
bidask_connection.execute('PRAGMA foreign_keys=ON;')

bidask_crsr = bidask_connection.cursor()

lob_connection = sqlite3.connect("lob.db")
lob_connection.isolation_level = None
lob_connection.execute(
    """PRAGMA foreign_keys=ON;
    -- move to run_lob.py
    insert into trader (tid, name) values (201, 'market maker for IVE');
    """)

select_tick = open('select_tick.sql', 'r').read()

next_day = day + timedelta(days=1)

mm_tid = 101
mm_bid_order = None
mm_ask_order = None
current_Bid = None
current_Ask = None
wall_clock = None

# Create a LOB object
lob = OrderBook(db=lob_connection)

select_params = dict(instrument=instrument, dt_start=str(day), dt_end=str(next_day))
N = 0
for n, row in enumerate(bidask_crsr.execute(select_tick + 'limit 100', select_params)):
    event_dt, Price, Bid, Ask, Size = row
    #print (row)
    wall_clock = event_dt
    order_template = dict(
        instrument=instrument,
        type='limit', 
        qty=999999, 
        tid=mm_tid,
        timestamp=event_dt,
    )
    fromData = True
    #continue
    if Bid != current_Bid:
        current_Bid = Bid
        N += 1
        order = dict(
            order_template,
            side='bid', 
            price=Bid,
        )
        if fromData:
            order['idNum'] = N
        if mm_bid_order is None:
            trades, mm_bid_order = lob.processOrder(order, fromData, False)
            print('-------', mm_bid_order)
            continue
        else:
            continue
            lob.modifyOrder(mm_bid_order['idNum'], order, time=event_dt)
    if Ask != current_Ask:
        current_Ask = Ask
        N += 1
        order = dict(
            order_template,
            side='ask', 
            price=Ask,
        )
        if fromData:
            order['idNum'] = N
        if mm_ask_order is None:
            trades, mm_ask_order = lob.processOrder(order, fromData, False)
            print('-------', mm_ask_order)
            continue
        else:
            continue
            lob.modifyOrder(mm_ask_order['idNum'], order, time=event_dt)

print(lob)

print(instrument, str(day), n, 'records')

