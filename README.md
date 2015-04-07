# Oracle driver for Aqua.js

A driver to connect to an Oracle database from node.js, leveraging the "Oracle C++ Call Interface" (OCCI)
for connectivity.  This is most commonly obtained as part of the Oracle Instant Client.

It is known to work with Oracle 10, 11, and 12, and has been mostly tested on Linux, but should also work on OS X and
Windows 7+


# Basic installation --- optional as the module is precompiled with c++ compiler

(See INSTALL.md for complete instructions for your platform.)

* Prerequisites:
  * Python 2.7 (*not* v3.x), used by node-gyp
  * C++ Compiler toolchain (GCC, Visual Studio or similar)
* Download the latest Oracle Instant Client Basic and SDK, and extract to the same directory.
* Set environment variables:

	```
OCI_LIB_DIR=/path/to/instant_client
OCI_INCLUDE_DIR=/path/to/instant_client/sdk/include
OCI_VERSION=<10, 11, or 12> # Integer. Optional, defaults to '11'
NLS_LANG=.UTF8 # Optional, but required to support international characters
	```
* Create symlinks for libclntsh and libocci in the Instant Client directory (see INSTALL.md)
* (Linux) Install libaio
* Configure the dynamic library path on your platform to include $OCI_LIB_DIR (see INSTALL.md)
* `npm install oracle` to get the latest from npmjs.org

### Default configuration settings

# Examples

### Basic example of a simple query result fetch from Ecx database

```javascript
	
   var http=require('http');
    var AquaJsOracle = require('aquajs-oracle');
    var config = {
                    name: 'testConn',
                    log:true,
                    max:10,
                    hostname: 'xxxxxxx',
                    user: 'xxxxxx',
                    password: 'xxxxx',
                    port: 'xxxxx',
                    database: 'xxxxx'
                };
var selectQuery =    'select all_metros.DESCRIPTION as METRO_DESCRIPTION, COUNT(DISTINCT CVP_PORT_NAME) number_of_ports'+
                        ' FROM'+
                                ' (SELECT DISTINCT DESCRIPTION FROM METRO@XDBREAD where DESCRIPTION is not null) all_metros'+
                                ' LEFT OUTER JOIN'+
                                        ' ECX_PARTICIPANT_VIEW@XDBREAD pv'+
                                ' ON (all_metros.DESCRIPTION = pv.METRO_DESCRIPTION)'+
                                        ' LEFT OUTER JOIN ECEE_VIRTUAL_PORT_V@XDBREAD vp'+
                                ' ON (vp.ACCOUNT_UCM_ID = pv.UCM_ID )'+
                                ' GROUP BY all_metros.DESCRIPTION';

 var oracle = new AquaJsOracle(config);
 http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    var pool = oracle.getPool();
    pool.acquire(function(err, db) {
       console.log(db);
       if (err) {
            return res.end("db error: " + err);
        }
        db.execute(selectQuery, [], function(err, results) {
              if (err) {
                pool.release(db);
                return res.end("QUERY ERROR: " + err);
            }

            res.end(JSON.stringify(results));
        });
    });
}).listen(8090);

console.log('Server running at http://127.0.0.1:1337/');


```

### Alternative db using TNS  result fetch from Ecx database
Replace the `settings` object above with one of the following.

Without tnsnames.ora file:

```javascript
var connString = "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVER=DEDICATED)(SERVICE_NAME=xe)))";
var config = {
                    name: 'testConn',
                    log:true,
                    max:10,
                    hostname: 'xxxxxxx',
                    user: 'xxxxxx',
                    password: 'xxxxx',
                    tns: connString,
                };

```
With tnsnames.ora file:

```text
DEV =
	(DESCRIPTION =
		(ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1521))
		(CONNECT_DATA =
			(SERVER = DEDICATED)
			(SERVICE_NAME = orcl)
		)
	)
```
var config = {
                    name: 'testConn',
                    log:true,
                    max:10,
                    hostname: 'xxxxxxx',
                    user: 'xxxxxx',
                    password: 'xxxxx',
                    tns: 'DEV',
                };
The following OUT Params are supported in Stored Procedures:

* `OCCIINT`
* `OCCISTRING`
* `OCCIDOUBLE`
* `OCCIFLOAT`
* `OCCICURSOR`
* `OCCICLOB`
* `OCCIDATE`
* `OCCITIMESTAMP`
* `OCCINUMBER`
* `OCCIBLOB`

Specify the return type in the OutParam() constructor:

```javascript
db.execute("call myProc(:1,:2)", ["nodejs", new oracle.OutParam(oracle.OCCISTRING)], ...
```

When using `OCCISTRING`, the size can optionally be specified (default is 200 chars):

```javascript
db.execute("call myProc(:1,:2)", ["nodejs", new oracle.OutParam(oracle.OCCISTRING, {size: 1000})], ...
```
See tests for more examples.

### In/Out Params
The following INOUT param types are supported:

* `OCCIINT`
* `OCCISTRING`
* `OCCIDOUBLE`
* `OCCIFLOAT`
* `OCCINUMBER`

INOUT params are used like normal OUT params, with the optional 'in' paramater value being passed in the options object:

```javascript
db.execute("call myProc(:1)", [new oracle.OutParam(oracle.OCCIINT, {in: 42})], ...
```

### Dates
For DATE and TIMESTAMP types, the driver uses the UTC methods from the Javascript Date object. This means the DATE
value stored will match the value of `new Date().toISOString()` on your client machine.  Consider this example
for a client machine in "GMT-0700":

Table schema:

```sql
CREATE TABLE date_test (mydate DATE)
```

Javascript code:

```javascript
...
	var date = new Date(2013, 11, 24, 18, 0, 1);  // Client timezone dependent
	console.log(date.toString());      // Tue Dec 24 2013 18:00:01 GMT-0700 (MST)
	console.log(date.toISOString());   // 2013-12-25T01:00:01.000Z

	db.execute(
		"INSERT INTO date_test (mydate) VALUES (:1) " +
			"RETURNING mydate, to_char(mydate, 'YYYY-MM-DD HH24:MI:SS') INTO :2, :3",
		[date, new oracle.OutParam(oracle.OCCIDATE), new oracle.OutParam(oracle.OCCISTRING)],
		function(err, results) {
			console.log(results.returnParam.toString());  // Tue Dec 24 2013 18:00:01 GMT-0700 (MST)
			console.log(results.returnParam1);            // 2013-12-25 01:00:01
		}
	);
...
```

### Querying large tables

To query large tables you should use a _reader_:

* `reader = db.reader(sql, args)`: creates a reader
* `reader.nextRow(callback)`: returns the next row through the callback
* `reader.nextRows(count, callback)` returns the next `count` rows through the callback. `count` is optional and `nextRows` uses the prefetch row count when `count` is omitted.  Also, you much check for `row.length` since the reader will continue returning empty arrays once it exceeds the end of the data set provided by the query.
* `db.setPrefetchRowCount(count)`: configures the prefetch row count for the db. Prefetching can have a dramatic impact on performance but uses more memory. 

Example:

```javascript
db.setPrefetchRowCount(50);
var reader = db.reader("SELECT * FROM auditlogs", []);

function doRead(cb) {
	reader.nextRow(function(err, row) {
		if (err) return cb(err);
		if (row) {
			// do something with row
			console.log("got " + JSON.stringify(row));
			// recurse to read next record
			return doRead(cb)
		} else {
			// we are done
			return cb();
		}
	})
}

doRead(function(err) {
	if (err) throw err; // or log it
	console.log("all records processed");
});
```

### Large inserts or updates

To insert or update a large number of records you should use _prepared statements_ rather than individual `execute` calls on the db object:

* `statement = db.prepare(sql)`: creates a prepared statement.
* `statement.execute(args, callback)`: executes the prepared statement with the values in `args`. You can call this repeatedly on the same `statement`.

Example:

```javascript

function doInsert(stmt, records, cb) {
	if (records.length > 0) {
		stmt.execute([records.shift()], function(err, count) {
			if (err) return cb(err);
			if (count !== 1) return cb(new Error("bad count: " + count));
			// recurse with remaining records
			doInsert(stmt, records, cb);
		});
	} else {
		// we are done
		return cb();
	}
}

var statement = db.prepare("INSERT INTO users (id, firstName, lastName) VALUES (:1, :2, :3)");
doInsert(statement, users, function(err) {
	if (err) throw err; // or log it
	console.log("all records inserted");	
});
```

# Development
* Clone the source repo
* Follow the installation instructions to prepare your environment (using Oracle Instant Client)
* Run `npm install` or `npm test` in the root of the source directory
* Point to an Oracle instance of your choice.  The free Oracle Express edition works well:
  * Oracle Express 11g: http://www.oracle.com/technetwork/database/database-technologies/express-edition/downloads/index.htmlDownload
* Debugging:
  * Compile node with debug symbols
  * Use gdb/ddd or another C++ debugger to step through
