/**
 * @fileOverview Database abstraction based on JSON blobs
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

Decafbad.SiloObject = Class.create(/** @lends Decafbad.SiloObject */{

    /** Version of the object in the DB */
    __version: 1,

    /** DB row id */
    __id: null,

    /** Parent source silo */
     __silo: null,

    /** Map of table columns to indexed object properties */
    __table_columns: { 
        'uuid':     'uuid', 
        'created':  'created', 
        'modified': 'modified' 
    },

    /** Name of the table column that receives the JSON blob */
    __blob_column: 'json',

    /**
     * Object wrapper for DB rows
     * @constructs
     * @author l.m.orchard@pobox.com
     *
     * @param {Decafbad.Silo} silo Source silo for the row
     * @param {Object}        data DB row data / object data
     */
    initialize: function (silo, data) {
        this.__silo = silo;
        Object.keys(data).each(function (key) {
            if ('__' === key.substr(0,2)) { return; }
            this[key] = data[key];
        }.bind(this));
    },

    /**
     * Produce a hash from object data, minus any database metadata & etc.
     *
     * @returns {Object} Data from the object.
     */
    toHash: function () {
        var h = $H();
        Object.keys(this).each(function (key) {
            if ('__' === key.substr(0,2)) { return; }
            h.set(key, this[key]);
        }.bind(this));
        return h;
    },

    /**
     * Save this object to the silo.
     */
    save: function (on_success, on_error) {
        if (!this.uuid) { 
            this.uuid = Math.uuid(); 
        }
        if (!this.created) { 
            this.created = (new Date()).getTime();
        }
        this.modified = (new Date()).getTime();
        this.__silo._save(this, on_success, on_error);
        return this;
    },

    __EOF:null
});

Decafbad.Silo = Class.create(/** @lends Decafbad.Silo */{

    /** Name of the silo's database */
    db_name: 'silo',
    /** Version of the silo's database */
    db_version: '0',
    /** Estimated size of the silo's database */
    db_size: 1 * 1024 * 1024,
    /** Name of the silo's DB table */
    table_name: 'example',
    /** Metadata table for all silos */
    meta_table_name: 'silo_meta',
    /** Object wrapper class for DB rows */
    row_class: Decafbad.SiloObject,

    /**
     * Databse table abstraction with object wrappers
     *
     * @see Decafbad.SiloObject
     * @constructs
     * @author l.m.orchard@pobox.com
     *
     * @param {object} options Silo options
     */
    initialize: function (options) {
        this.options = Object.extend({

        }, options || {});
    },

    /**
     * Open the silo, creating the database if necessary
     *
     * @param {function} on_success Callback on success
     * @param {function} on_failure Callback on failure
     */
    open: function (on_success, on_failure) {
        var $this = this,
            object_proto = this.row_class.prototype,
            chain = new Decafbad.Chain([], this, on_failure, {
                use_timeouts: false
            });
        
        // Try opening the database, bail on error.
        this.db = openDatabase(this.db_name, this.db_version, this.db_name,
            this.db_size);
        if (!this.db) { on_failure(); }

        // Check the table version, creating or upgrading it if necessary.
        chain.push([
            function (chain, tx) {
                // Try getting the version of the table.
                this.getTableVersion(tx, chain.nextCallback(), on_failure);
            },
            function (chain, tx, table_version) {
                if (!table_version) {
                    // No table version found, so assume table doesn't exist.
                    this._createTable(tx, chain.nextCallback(), on_failure);
                } else {
                    if (table_version !== object_proto.__version) {
                        // Table exists, but version mismatch.
                        // TODO: table upgrades
                        // Mojo.Log.error("NEED UPGRADE FROM %s TO %s",
                        //    object_proto.object_proto, table_version);
                    } else {
                        // Table exists and matches our version in code.        
                        chain.next();
                    }
                }
            },
            function (chain) { on_success(this); }
        ]);

        // Fire up the chain within a DB transaction
        this.db.transaction(chain.nextCallback());

        return this;
    },

    /**
     * Reset by destroying all silos and the meta table, most useful for
     * clearing things out before tests.
     *
     * @param {function} on_success Callback on success
     * @param {function} on_failure Callback on failure
     */
    resetAll: function (on_success, on_failure) {
        var $this = this,
            chain = new Decafbad.Chain([], this, on_failure, {
                use_timeouts: false
            });

        this.db = openDatabase(
            this.db_name, this.db_version, this.db_name, this.db_size
        );

        var stmts = [
            'DROP TABLE IF EXISTS "'+this.meta_table_name+'"',
            'DROP TABLE IF EXISTS "'+this.table_name+'"'
        ];
        stmts.each(function (stmt) {
            chain.push(function (chain, tx) {
                tx.executeSql(stmt, [], chain.nextCallback(tx), on_failure);
            });
        });

        chain.push(on_success);

        this.db.transaction(chain.nextCallback());
    },

    /**
     * Find a single object by ID, or array of objects using columns specified
     * in an object.
     *
     * @param {string|object} id_or_obj  ID or object
     * @param {function}      on_success Callback on success
     * @param {function}      on_failure Callback on failure
     */
    find: function (id_or_obj, on_success, on_failure) {
        var $this = this, vals = [], sql = [],
            is_multi = ('object' === typeof id_or_obj);

        if (!is_multi) {
            sql.push('WHERE id=?');
            vals.push(id_or_obj);
        } else {
            sql.push([
                'WHERE',
                Object.keys(id_or_obj).map(function (name) {
                    vals.push(id_or_obj[name]);
                    return name + '=?';
                }).join(' AND ')
            ]);
        }

        // Perform the SQL query to yield object(s)
        this.query(sql, vals, function (objs) {
            on_success(is_multi ? objs : objs[0]);
        }, on_failure);
    },

    /**
     * Perform a query with partial SQL, assuming the SELECT / FROM parts are
     * already supplied.
     *
     * @param {string|array } partial_sql ID or object
     * @param {function}      on_success  Callback on success
     * @param {function}      on_failure  Callback on failure
     */
    query: function (partial_sql, vals, on_success, on_failure) {
        var $this = this,
            blob_col = this.row_class.prototype.__blob_column,
            sql = [
                'SELECT id, ' + blob_col,
                'FROM ' + this.table_name,
                partial_sql
            ];
        this._query(sql, vals, on_success, on_failure);
    },

    /**
     * Perform a full SQL query and attempt to yield an array of objects.
     *
     * @param {string}   sql        SQL query to perform
     * @param {string[]} vals       Values to replace ? placeholders in SQL
     * @param {function} on_success Callback on success
     * @param {function} on_failure Callback on failure
     */
    _query: function (sql, vals, on_success, on_failure) {
        var sql_stmt = ('string' == typeof sql) ?
            sql : sql.flatten().join(' ');

        this.db.transaction(
            function (tx) {
                tx.executeSql(
                    sql_stmt, vals,
                    function (tx, rs) {
                        on_success(this._rsToObjects(rs));
                    }.bind(this),
                    on_failure
                );
            }.bind(this),
            on_failure
        );
    },

    /**
     * Create a new silo object instance.
     *
     * @param {object} data Object data / DB row data
     */
    factory: function (data) {
        return new this.row_class(this, data);
    },

    /**
     * Save the given object
     *
     * @param {Decafbad.SiloObject} obj        Object to save
     * @param {function}            on_success Callback on success
     * @param {function}            on_failure Callback on failure
     */
    _save: function (obj, on_success, on_failure) {
        var data = obj.toHash(), sql, cols = [], vals = [], is_insert;

        // Gather the table column values from object data.
        Object.keys(obj.__table_columns).each(function (col_name) {
            cols.push(col_name);
            vals.push(data.get(obj.__table_columns[col_name]));
        });

        // Shove the JSON into the list of columns and values;
        cols.push(obj.__blob_column);
        vals.push(data.toJSON());
        
        is_insert = (null === obj.__id);
        if (is_insert) {
            // If there's no ID, assume that this is a new object.
            sql = [
                "INSERT OR REPLACE INTO " + this.table_name + "",
                "(", cols.join(','), ")",
                "VALUES",
                "(", cols.map(function (c) { return '?'; }).join(','), ")"
            ];
        } else {
            // If there is an ID, assume that this is an update.
            sql = [
                "UPDATE " + this.table_name + " SET",
                cols.map(function (name) { 
                    return "'"+name+"'=?";
                }).join(','),
                "WHERE id=?"
            ];
            vals.push(obj.__id);
        }

        // Finally, execute the SQL to insert or update
        this.db.transaction(
            function (tx) {
                sql = sql.flatten().join(' ');
                tx.executeSql(
                    sql, vals,
                    function (tx, rs) {
                        if (is_insert) { obj.__id = rs.insertId; }
                        on_success(obj);
                        return true;
                    }.bind(this),
                    on_failure
                );
            }.bind(this),
            on_failure
        );
    },

    /**
     * Find the current version of the silo table, creating the meta table if
     * not found.
     *
     * @param {SQLTransaction} tx         Open DB transaction
     * @param {function}       on_success Callback on success
     * @param {function}       on_failure Callback on failure
     */
    getTableVersion: function (tx, on_success, on_failure) {
        var $this = this,
            chain = new Decafbad.Chain([], this, on_failure, {
                use_timeouts: false
            });

        chain.push([
            function (chain) {
                tx.executeSql(
                    'SELECT version FROM '+this.meta_table_name+' WHERE table_name=?',
                    [ this.table_name ],
                    function (tx, rs) {
                        // Table exists, so continue on with the version if found.
                        chain.next(tx, (1 !== rs.rows.length) ? 
                            null : rs.rows.item(0).version);
                    },
                    function (tx, err) {
                        if (/no such table/.test(err.message)) {
                            // Create the meta table since it wasn't found, and
                            // pass along a version of null to the next step.
                            $this._createMetaTable(
                                tx, chain.nextCallback(tx, null), on_failure
                            );
                        } else {
                            // Some other error, so bail.
                            on_failure(tx, err);
                        }
                    }
                );
            },
            function (chain, tx, version) {
                // Finally, after version lookup or meta table creation,
                // yield the version to the caller.
                on_success(tx, version);
            }
        ]).next();
    },

    /**
     * Create the table for this silo.
     */
    _createTable: function (tx, on_success, on_failure) {
        var $this = this,
            table_columns = $H($this.row_class.prototype.__table_columns);
            schema = [ 
                "CREATE TABLE IF NOT EXISTS '" + $this.table_name + "' (", [
                    "'id' INTEGER PRIMARY KEY AUTOINCREMENT",
                    table_columns.keys().map(function (key) { 
                        return "'"+key+"' TEXT"; 
                    }),
                    "'" + $this.row_class.prototype.__blob_column + "' BLOB"
                ].join(', '),
                ")"
            ].flatten().join(' ');

        tx.executeSql(schema, [], function (tx, rs) {
            tx.executeSql(
                "INSERT INTO " + $this.meta_table_name +
                "('table_name', 'version', 'json') VALUES (?,?,?)",
                [ 
                    $this.table_name, 
                    $this.row_class.prototype.__version,
                    $H($this.row_class.prototype).toJSON()
                ],
                function (tx) { on_success(tx); },
                on_failure
            );
        }, on_failure);
    },

    /**
     * Create the meta table for all silos.
     */
    _createMetaTable: function (tx, on_success, on_fail) {
        var schema = [
            "CREATE TABLE IF NOT EXISTS '" + this.meta_table_name + "' (",
            "   'id' INTEGER PRIMARY KEY AUTOINCREMENT,",
            "   'table_name' TEXT UNIQUE NOT NULL ON CONFLICT REPLACE,",
            "   'version' TEXT,",
            "   'json' BLOB",
            ")"
        ].join(' ');
        tx.executeSql(schema, [], on_success, on_fail);
    },

    /**
     * Convert the rows of a result set into a set of objects.
     * Assumes that at least the blob column and ID are available in rows.
     *
     * @param   {SQLResultSet} rs Result set
     * @returns {Array} Set of instantiated objects.
     */
    _rsToObjects: function (rs) {
        var rows = rs.rows, objs = [], 
            blob_col = this.row_class.prototype.__blob_column, 
            i, l;

        for (i=0,l=rows.length; i<l; i++) {
            var row  = rows.item(i),
                data = row[blob_col].evalJSON(),
                obj  = this.factory(data);
            
            obj.__id = row.id;
            objs.push(obj);
        }
        return objs;
    },

    __EOF:null
});