/**
 * @fileOverview Crypto Object for weave basic object
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

/**
 * Object for service objects with built-in decryption
 *
 * @class
 * @augments Weave.Service.BasicObject
 */
Weave.Service.CryptoObject = Class.create(Weave.Service.BasicObject, /** @lends Weave.Service.CryptoObject */{

    _object_map: null,

    extract: function ($super) {
        if (!this._object_map) {
            var flattened = Object.clone(this._object);
            if (flattened.payload && flattened.payload.cleartext) {
                cleartext = Object.clone(flattened.payload.cleartext[0]);
                delete flattened.payload.cleartext;
                delete flattened.payload;
                flattened = Object.extend(flattened, cleartext);
            }
            return flattened;
        } else {
            var mapped = {};
            this._extract_map.each(function (pair) {
                mapped[pair.key] = this.get(pair.value);
            }, this);
            return mapped;
        }
    },

    /**
     *
     */
    get: function ($super, key) {
        if ('$'===(''+key).substr(0,1)) {
            return jsonPath(this._object, key)[0];
        } else {
            return $super(key);
        }
    },

    /**
     * TODO:
    encrypt: function (on_success, on_failure) {
    },
     */

    /**
     * Decrypt the contents of this record.
     *
     * @param {Weave.Service.SymKey} symkey     Symkey used to decrypt object
     * @param {function}           on_success Success callback (record)
     * @param {function}           on_failure Failure callback
     */
    decrypt: function (symkey, on_success, on_failure) {
        var chain = new Decafbad.Chain([
            function (chain) {
                // Use the supplied symkey, or fetch the one specified in the
                // payload if none supplied.
                if (symkey) {
                    chain.next(symkey);
                } else {
                    this.manager.service.symkeys.get(
                        this.get('payload').encryption,
                        chain.nextCb(), chain.errorCb()
                    );
                }
            },
            function (chain, symkey) {
                // Decrypt the cyphertext using the symkey.
                var json = Weave.Util.clearify(Weave.Crypto.AES.decrypt(
                    symkey.get('symkey'), 
                    Weave.Util.Base64.decode(symkey.get('payload').bulkIV), 
                    Weave.Util.Base64.decode(this.get('payload').ciphertext)
                ));
                this.get('payload').cleartext = json.evalJSON();
                delete this.get('payload').ciphertext;
                on_success(this);
            }
        ], this, on_failure).start();
    },

    EOF:null

});

/**
 * @class 
 * @augments Weave.Service.RecordManager
 */
Weave.Service.CryptoObjectCollection = Class.create(Weave.Service.RecordManager, /** @lends Weave.Service.CryptoObjectCollection */ {

    _collection_name: 'history',
    _record_type: Weave.Service.CryptoObject,

    /**
     * Get an object by ID
     *
     * @param {string}   object_id  Object ID to get
     * @param {function} on_success Success callback (record)
     * @param {function} on_failure Failure callback
     */
    getByID: function (object_id, on_success, on_failure) {
        var url = this.service.cluster_url + 
            this.service.options.service_version + 
            '/' + encodeURIComponent(this.service.options.username) + 
            '/storage/' + encodeURIComponent(this._collection_name) + 
            '/' + encodeURIComponent(object_id);
        return this.get(url, on_success, on_failure);
    },

    /**
     * List objects in the collection using the supplied options
     *
     * @param {object}   params     Params for the list query
     * @param {function} on_success Success callback (record)
     * @param {function} on_failure Failure callback
     */
    list: function (params, on_success, on_failure) {

        var collection_name = ('collection' in params) ?
            params.collection : this._collection_name;
        delete params.collection;

        var record_type = ('record_type' in params) ?
            params.record_type : this._record_type;
        delete params.record_type;

        var base_url = this.service.cluster_url + 
                this.service.options.service_version + 
                '/' + encodeURIComponent(this.service.options.username) + 
                '/storage/' + encodeURIComponent(collection_name),
            list_url = base_url;

        if (params) {
            // Append the list parameters onto the list URL.
            list_url = list_url + '?' + $H(params).toQueryString();
        }

        var chain = new Decafbad.Chain([
            function (chain) {
                // Fetch the list results using supplied parameters.
                this.service.fetch(list_url, chain.nextCb(), chain.errorCb());
            },
            function (chain, results) {
                if (!Object.isArray(results)) { 
                    // If the results aren't an array, yield an empty array
                    return chain.next([]);
                }
                if (!('full' in params)) { 
                    // If the results aren't expected to be full objects, just
                    // pass the results through without decryption step.
                    return chain.next(results); 
                }

                // Wrap each JSON item in the service results with an
                // appropriate object instance and queue each up for decryption
                // in a chain.
                var objects = [],
                    sub_chain = new Decafbad.Chain([], this, on_failure);
                results.each(function (data, idx) {
                    var url = base_url + '/' + data.id,
                        record = new this._record_type(this, url, data);
                    sub_chain.push([
                        function (sub_chain) {
                            // Decrypt the record.
                            record.decrypt(null, sub_chain.nextCb(), on_failure);
                        },
                        function (sub_chain) {
                            // Wait until after decryption to add the record
                            // to the results list and record cache.
                            objects.push(this.set(url, record));
                            sub_chain.next(record);
                        }
                    ]);
                }, this);
                
                // The last step of the decryption chain is to pass the
                // finished results along.
                sub_chain.push(function (sub_chain) {
                    chain.next(objects);
                });

                // Fire up the decryption chain.
                sub_chain.start();
            },
            function (chain, results) {
                // Finally, yield the list results.
                return on_success(results);
            }
        ], this, on_failure).start();

    },

    /**
     * Override to superclass _import that automatically decrypts all 
     * new objects.
     *
     * @param {string}   url        URL to fetch and import
     * @param {function} on_success Success callback (record)
     * @param {function} on_failure Failure callback
     */
    _import: function ($super, url, on_success, on_failure) {
        $super(
            url,
            function (record) {
                record.decrypt(null, on_success, on_failure);
            }.bind(this),
            on_failure
        );
    },

    EOF:null
});
