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

                if (!this.get('payload')) {
                    // TODO: Maybe do something better here on missing payload?
                    return on_success(this);
                }

                // Use the supplied symkey, or fetch the one specified in the
                // payload if none supplied.
                if (symkey) {
                    chain.next(symkey);
                } else {
                    this.collection.service.symkeys.get(
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
                delete this.get('payload').encryption;
                on_success(this);
            }
        ], this, on_failure).start();
    },

    EOF:null

});

/**
 * @class 
 * @augments Weave.Service.BasicCollection
 */
Weave.Service.CryptoCollection = Class.create(Weave.Service.BasicCollection, /** @lends Weave.Service.CryptoCollection */ {

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

        if ('ids' in params && Object.isArray(params.ids)) {
            // Expect an array of IDs, join to comma-separated string.
            params.ids = params.ids.join(',');
        }

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

                // Wrap each service result item with an appropriate object
                // instance and queue each up for decryption.
                var objects = [],
                    sub_chain = new Decafbad.Chain([], this, on_failure);
                results.each(function (data, idx) {
                    var url = base_url + '/' + data.id,
                        record = new this._record_type(data, this, url);
                    sub_chain.push([
                        function (sub_chain) {
                            // Decrypt the record.
                            record.decrypt(null, sub_chain.nextCb(), on_failure);
                        },
                        function (sub_chain) {
                            // Wait until after decryption to add the record
                            // to the results list and record cache.
                            // TODO: Do we really need to add listed objects to cache?
                            // objects.push(this.set(url, record));
                            objects.push(record);
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
