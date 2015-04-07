"use strict";
var settings = {};
var aquajsOracleDriver = require('strong-oracle')(settings);
var oracle_pool = require('generic-pool');
var VError = require('verror');
var dbConfig = {};

/**
 * AquaJsOracle validate the configuration parameters
 * @api public
 * @return {Error List of AquaJsOracle}
 */
function validateConfig(config) {
    var hostname  = config.hostname || config.host,
        user  = config.user,
        password  = config.password,
        port  = config.port,
        database  = config.database,
        errList = [];
    if (hostname === undefined || hostname === null || hostname === "") {
        errList.push("provide mandatory field value hostName");
    }
    if (user === undefined || user === null || user === "") {
        errList.push("provide mandatory field value user");
    }
    if (password === undefined || password === null || password === "") {
        errList.push("provide mandatory field value password");
    }
    if (port === undefined || port === null || port === "") {
        errList.push("provide mandatory field value port");
    }
    if (database === undefined || database === null || database === "") {
        errList.push("provide mandatory field value database");
    }
    return errList;
}

/**
 * AquaJsOracle get individual databse settings to connect to database
 * @api public
 * @return {DB Configuration for each Database}
 */
function getEachDBSettings(settings) {
    var eachDbConfig = {};
    if (settings.tns === undefined ||  settings.tns === null || settings.tns === "") {
        eachDbConfig.hostname = settings.hostname || settings.host;
        eachDbConfig.port = settings.port;
        eachDbConfig.database = settings.database;
    } else {
        eachDbConfig.tns = settings.tns;
    }
    eachDbConfig.user = settings.user || settings.username;
    eachDbConfig.password = settings.password;
    return eachDbConfig;
}

/**
 * AquaJsOracle constructur takes the below parameters as config arguments
 * @return {Object of AquaJsOracle}
 * @api public
   config attributes :

   name : name of pool (string, optional)
                create : function that returns a new resource
                           should call callback() with the created resource
               destroy : function that accepts a resource and destroys it
                   max : maximum number of resources to create at any given time
                         optional (default=1)
                   min : minimum number of resources to keep in pool at any given time
                         if this is set > max, the pool will silently set the min
                         to factory.max - 1
                         optional (default=0)
     idleTimeoutMillis : max milliseconds a resource can go unused before it should be destroyed
                         (default 30000)
    reapIntervalMillis : frequency to check for idle resources (default 1000),
         priorityRange : int between 1 and x - if set, borrowers can specify their
                         relative priority in the queue if no resources are available.
                         see example.  (default 1)
                   log : true/false or function -
                           If a log is a function, it will be called with two parameters:
                                                    - log string
                                                    - log level ('verbose', 'info', 'warn', 'error')
                           Else if log is true, verbose log info will be sent to console.log()
                           Else internal log messages be ignored (this is the default)
*/

var AquaJsOracle = function (config) {
        if (!(this instanceof AquaJsOracle)) {
            return new AquaJsOracle(config);
        }
        var errList = validateConfig(config);
        if (errList.length > 0) {
            throw new VError('Error while initializing the aquajs oracle  pool cause :->"%s"', JSON.stringify(errList));
        } else {
            this.name = config.name;
            this.max = config.max || 10;
            this.min = config.min || 0;
            this.idleTimeoutMillis = config.idleTimeoutMillis || 0;
            this.reapInterval = config.reapInterval;
            this.priorityRange = config.priorityRange;
            dbConfig[this.name] = getEachDBSettings(config);
            //initialize the connection pooling
            this.initConnPool();
        }
    };

/**
 * AquaJsOracle init connection pooling configuration
 * @api public
 */

AquaJsOracle.prototype.initConnPool = function () {
    if (this.pool === undefined || this.pool === null) {
        var aquaJsPool = oracle_pool.Pool({
                name : this.name,
                max : this.max,
                min : this.min,
                idleTimeoutMillis : this.idleTimeoutMillis,
                log : this.log,
                create   : function (callback) {
                    try {
                        new aquajsOracleDriver.connect(dbConfig[this.name], function (err, connection) {
                            callback(err, connection);
                        });
                    } catch (err) {
                        var conError = new VError(err, 'while initialize connection pool , Conenction Settings:->"%s"', dbConfig[this.name]);
                        console.error(conError);
                        callback(conError, null);
                    }
                },
                destroy  : function (client) {
					try
					{
						client.close();
					}
					catch (err)
					{
						$logger.error("Error while destroying  the used connection , more info" + err);
					}
                }
            });
        this.pool = aquaJsPool;
    }
};

AquaJsOracle.prototype.getPool = function () {
    return this.pool;
};

AquaJsOracle.prototype.getName = function () {
    return this.pool.getName();
};

AquaJsOracle.prototype.getSettings = function () {
    return this.settings;
};
AquaJsOracle.prototype.getPoolSize = function () {
    return this.pool.getPoolSize();
};

AquaJsOracle.prototype.getAvailableObjectsCount = function () {
    return this.pool.availableObjectsCount();
};

AquaJsOracle.prototype.getWaitingClientsCount = function () {
    return this.pool.waitingClientsCount();
};
// acquire connection - no priority - will go at end of line
AquaJsOracle.prototype.releasePool = function (db) {
	try
	{
	  return this.pool.release(db);
	}
	catch (err)
	{
		$logger.error("Error while releasing the connection to pool , more info" + err);
	}
    
};

AquaJsOracle.prototype.drain = function () {
	try
	{
	 this.pool.destroyAllNow();
	}
	catch (err)
	{
		$logger.error("Error while draing all the connections , more info" + err);
	}
    
};

module.exports = AquaJsOracle;
