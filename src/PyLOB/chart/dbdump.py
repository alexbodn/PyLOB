
import sqlite3
import sys


html = """
<!DOCTYPE html>
<html>
<body>
%s
</body>
</html>
"""

def html_rs(type, name, columns, rows):
    html_table = "<table border='1'>%s</table>"
    html_tr = "<tr>%s</tr>"
    data = list()
    data.append(['<th colspan="%d">%s: %s</th>' % (len(columns), type, name)])
    data.append(['<th>%s</th>' % label.split(':')[0] for label in columns])
    for row in rows:
        data.append(['<td>%s</td>' % ('null' if field is None else field) for field in row])
    return html_table % '\n'.join([html_tr % ''.join(row) for row in data])

def html_db(dbname):
    connection = sqlite3.connect(dbname)
    cursor = connection.cursor()

    tables = list()

    # for most other rdbms
    sql_tables = "SELECT table_type, table_name FROM information_schema.tables WHERE table_schema='public'"
    # for sqlite
    sql_tables = "select type, name from sqlite_master where type in ('table', 'view')"

    for row in cursor.execute(sql_tables):
        tables.append(list(row))

    for table in tables:
        type, name = table
        cursor.execute("select * from %s limit 10" % name)
        columns = [col[0] for col in cursor.description]
        rows = [row for row in cursor]
        table += [columns, rows]

    return html % '\n'.join([html_rs(*table) for table in tables])

if __name__ == '__main__':
    html = html_db(sys.argv[1])
    print(html)
