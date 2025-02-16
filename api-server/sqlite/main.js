const { Database } = require("node-sqlite3-wasm");
const memdb = new Database("%memory%");

memdb.exec(
  "DROP TABLE IF EXISTS employees; " +
    "CREATE TABLE IF NOT EXISTS employees (name TEXT, salary INTEGER)"
);

memdb.run("INSERT INTO employees VALUES (:n, :s)", {
  ":n": "James",
  ":s": 50000,
});

//const r = memdb.all("SELECT * from employees");
//console.log(r);
// [ { name: 'James', salary: 50000 } ]

//memdb.close();

module.exports = {memdb};
