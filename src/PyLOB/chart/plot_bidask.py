
import json
import sqlite3
from datetime import datetime, timedelta, date, time

#bid: buy
#ask: sell

instrument = 'IVE'
day = date(2009, 9, 29)

def time_combine(tm):
    if not tm or tm is time.min:
        return None
    return datetime.combine(day, tm).strftime("%Y-%m-%dT%H:%M:%SZ")

bidask_connection = sqlite3.connect("../tickdata/bidask.db")
bidask_connection.isolation_level = None

bidask_crsr = bidask_connection.cursor()

select_tick = open('select_tick.sql', 'r').read()

next_day = day + timedelta(days=1)

data = [
    dict(title='price', data=list()),
    dict(title='bid', data=list()),
    dict(title='ask', data=list()),
]

lastx = None
select_params = dict(instrument=instrument, dt_start=str(day), dt_end=str(next_day))
for n, row in enumerate(bidask_crsr.execute(select_tick, select_params)):
    for c, layer in enumerate(data):
        layer['data'].append(dict(y=row[c + 1], x=row[0]+'Z'))
    #print(row)
    lastx = row[0]+'Z'

print(instrument, str(day), n, 'records')

html = open('chart_template.html', 'r').read()

orders = [
    dict(side='SELL', quantity=15, limit=51.83, issued=time(10, 18, 35), id=1,),
    dict(side='BUY', quantity=8, limit=51.46, issued=time(10, 55, 35), expires=time(14, 47, 16), id=2,),
    dict(side='SELL', quantity=10, limit=51.63, issued=time(12, 18, 35), expires=time(15, 47, 16), id=3,),
]

order_executions = [
    dict(order=3, quantity=3, at=time(15, 37, 16)),
    dict(order=3, quantity=6, at=time(15, 7, 16)),
]

orders_list = list()

for order in orders:
    rows = [
        dict(
            x=time_combine(order['issued']),
            y=order['limit'],
            label=dict(
                text='%(side)s %(quantity)d' % order,
                color='blue' if order['side'] == 'BUY' else 'red',
            ),
        )
    ]
    rows += [
        dict(
            x=time_combine(execution['at']),
            y=order['limit'],
            label=dict(
                text='exec: %(quantity)d' % execution,
                color='green',
            )
        ) for execution in sorted(order_executions, key=lambda x: x['at']) \
        if execution['order'] == order['id']
    ]
    rows.append(
        dict(
            x=time_combine(order['expires']) if 'expires' in order else lastx,
            y=order['limit'],
        )
    )
    data.append(dict(title='order %(id)d' % order, data=rows))

html = html.replace('${chart_title}', '%s prices for %s' % (instrument, str(day)))
html = html.replace('${data_layers}', json.dumps(data, indent=4))

open('output.html', 'w').write(html)
