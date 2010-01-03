/**
 * @fileOverview Database abstraction based on JSON blobs
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

/**
 * Object wrapper for DB rows
 *
 * @author l.m.orchard@pobox.com
 * @augments Hash
 * @class
 */
Decafbad.SiloObject = Class.create(Hash, /** @lends Decafbad.SiloObject */{

    /** Version of the object in the DB */
    version: 1,

    /** Parent source silo */
    silo: null,

    /** Map of table columns to indexed object properties */
    table_columns: { 
        'uuid':     'uuid', 
        'created':  'created', 
        'modified': 'modified' 
    },

    /** Map of property names aliased to other properties or jsonPaths */
    property_aliases: { },

    /** Name of the table column that receives the JSON blob */
    blob_column: 'json',

    /**
     * Enhancement to Hash.get() that looks for get_{key} methods for
     * by-property delegate handlers.
     */
    get: function ($super, key) {
        if (key in this.property_aliases) {
            key = this.property_aliases[key];
        }
        if ('$'===(''+key).substr(0,1)) {
            return jsonPath(this._object, key)[0];
        }
        var fn_name = 'get_'+key;
        if ('function' === typeof this[fn_name]) {
            return this[fn_name]($super);
        }
        return $super(key);
    },

    /**
     * Enhancement to Hash.set() that looks for set_{key} methods for
     * by-property delegate handlers.
     */
    set: function ($super, key, value) {
        if (key in this.property_aliases) {
            key = this.property_aliases[key];
        }
        if ('$'===(''+key).substr(0,1)) {
            // TODO: Can't set by jsonPath yet.
            return false;
        }
        var fn_name = 'set_'+key;
        if ('function' === typeof this[fn_name]) {
            return this[fn_name]($super, value);
        }
        return $super(key, value);
    },

    /**
     * Save this object to its associated silo, if one exists.
     *
     * @param {function} on_success Callback on success
     * @param {function} on_failure Callback on failure
     */
    save: function (on_success, on_failure) {
        if (!this.silo) { return; }
        this.silo.save(this, on_success, on_failure);
        return this;
    },

    /**
     * Handler to be called just before saving this object.
     *
     * @param {Decafbad.Silo} silo Silo about to save this object.
     */
    beforeSave: function (silo) {
        this.silo = this;
        if (!this.get('uuid')) { 
            this.set('uuid', Math.uuid());
        }
        if (!this.get('created')) { 
            this.set('created', (new Date()).getTime());
        }
        this.set('modified', (new Date()).getTime());
    },

    EOF:null
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
     * Database table abstraction with object wrappers
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
                this.getTableVersion(tx, chain.nextCb(), on_failure);
            },
            function (chain, tx, table_version) {
                if (!table_version) {
                    // No table version found, so assume table doesn't exist.
                    this._createTable(tx, chain.nextCb(), on_failure);
                } else {
                    if (table_version !== object_proto.version) {
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
        this.db.transaction(chain.nextCb());

        return this;
    },

    /**
     * Reset by destroying this silo and its record from the meta table,
     * most useful for clearing things out before tests.
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
            'DELETE FROM '+this.meta_table_name+' WHERE table_name="'+this.table_name+'"',
            'DROP TABLE IF EXISTS "'+this.table_name+'"'
        ];
        stmts.each(function (stmt) {
            chain.push(function (chain, tx) {
                // tx.executeSql(stmt, [], chain.nextCb(tx), on_failure);
                tx.executeSql(stmt, [], chain.nextCb(tx), chain.nextCb(tx));
            });
        });

        chain.push(on_success);

        this.db.transaction(chain.nextCb());
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
     * @param {string|array} partial_sql ID or object
     * @param {function}     on_success  Callback on success
     * @param {function}     on_failure  Callback on failure
     */
    query: function (partial_sql, vals, on_success, on_failure) {
        var $this = this,
            blob_col = this.row_class.prototype.blob_column,
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
        var obj = new this.row_class(data);
        // Make sure this object knows its silo now.
        obj.silo = this;
        return obj;
    },

    /**
     * Save the given object
     *
     * @param {Decafbad.SiloObject} obj        Object to save
     * @param {function}            on_success Callback on success
     * @param {function}            on_failure Callback on failure
     */
    save: function (obj, on_success, on_failure) {
        var sql, cols = [], vals = [], is_insert;

        if (Object.isArray(obj)) {

            // If the object is an array, assume it's a set to be saved.
            var all_saved = [];
            var chain = new Decafbad.Chain([], this, on_failure);
            obj.each(function (sub_obj) {
                // Queue a save for each individual item in the set.
                chain.push([
                    function (chain) {
                        // Save this object...
                        this.save(sub_obj, chain.nextCb(), chain.errorCb());
                    },
                    function (chain, saved) {
                        // Accumulate this saved object and move on.
                        all_saved.push(saved);
                        chain.next();
                    }
                ]);
            }, this);

            // Finally, queue up on_success and start.
            return chain.push(function () {
                // Yield the set of all saved objects.
                on_success(all_saved);
            }).start();

        }

        if ('beforeSave' in obj) {
            // If the object has a beforeSave handler, call it.
            obj.beforeSave(this);
        }

        // Gather the table column values from object data.
        Object.keys(obj.table_columns).each(function (col_name) {
            cols.push(col_name);
            vals.push(obj.get(obj.table_columns[col_name]));
        });

        // Shove the JSON into the list of columns and values;
        cols.push(obj.blob_column);
        vals.push(obj.toJSON());
        
        is_insert = (('id' in obj.table_columns) || !obj.get('id'));
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
            vals.push(obj.get('id'));
        }

        // Finally, execute the SQL to insert or update
        this.db.transaction(
            function (tx) {
                sql = sql.flatten().join(' ');
                tx.executeSql(
                    sql, vals,
                    function (tx, rs) {
                        if (is_insert) { obj.set('id', rs.insertId); }
                        if ('afterSave' in obj) {
                            // If the object has an afterSave handler, call it.
                            obj.afterSave(this);
                        }
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
                                tx, chain.nextCb(tx, null), on_failure
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
            row_proto = $this.row_class.prototype,
            schema_cols = [], schema;

        if ('id' in row_proto.table_columns) {
            // ID uniqueness taken under direct control.
            schema_cols.push("'id' TEXT UNIQUE ON CONFLICT REPLACE");
        } else {
            // No ID column specified, so assume autoincrement
            schema_cols.push("'id' INTEGER PRIMARY KEY AUTOINCREMENT");
        }

        // Create TEXT columns for all others besides id
        Object.keys(row_proto.table_columns).each(function (column_name) {
            if ('id' === column_name) { return; }
            // TODO: Allow different types for extracted columns someday?
            schema_cols.push("'"+column_name+"' TEXT");
        }, this);

        // Create a BLOB column for the JSON serialization.
        schema_cols.push("'" + row_proto.blob_column + "' BLOB");

        // Finally, assemble the complete schema.
        schema = [
            "CREATE TABLE IF NOT EXISTS '" + $this.table_name + "' (",
            schema_cols.flatten().join(','),
            ")"
        ].flatten().join(' ');

        // Create the new table from the schema and register it with the silo
        // meta table.
        tx.executeSql(schema, [], function (tx, rs) {
            tx.executeSql(
                "INSERT OR REPLACE INTO " + $this.meta_table_name +
                "('table_name', 'version', 'json') VALUES (?,?,?)",
                [ 
                    $this.table_name, 
                    row_proto.version,
                    Object.toJSON(row_proto)
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
            blob_col = this.row_class.prototype.blob_column, 
            i, l;

        for (i=0,l=rows.length; i<l; i++) {
            var row  = rows.item(i),
                data = row[blob_col].evalJSON(),
                obj  = this.factory(data);
            
            obj.set('id', row.id);
            objs.push(obj);
        }
        return objs;
    },

    EOF:null
});
