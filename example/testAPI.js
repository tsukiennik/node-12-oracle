 var http=require('http');
    var AquaJsOracle = require('aquajs-oracle');
    var config = {
                    name: 'testConn',
                    log:true,
                    max:10,
                    hostname: 'eceedevdb01.sv2.corp.equinix.com',
                    user: 'ecee_int',
                    password: 'welcome1',
                    port: '1521',
                    database: 'ECEEDEV1'
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
