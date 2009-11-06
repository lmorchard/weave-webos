/**
 * @fileOverview Wrapper for Weave API
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */
Weave.API = function() {
    this.initialize.apply(this, $A(arguments));
};

Weave.API.prototype = /** @lends Weave.API */ {

    /**
     * Wrapper for Weave API
     * @constructs
     * @author l.m.orchard@pobox.com
     *
     * @param {string} Weave API base URL
     */
    initialize: function (options) {
        this.logged_in = false;

        this.options = Object.extend({
            
            "api_url":       "https://services.mozilla.com",
            "api_version":   "0.5",
            "cache_objects": true

        }, options || {});

        this.caches = {
            encryptions: {},
            pubkeys: {},
            objects: {}
        };
    },

    /**
     * Perform login and initial crypto.
     */
    login: function (username, password, passphrase, on_progress, on_success, on_failure) {
        this.username   = username;
        this.u_username = encodeURIComponent(username);
        this.password   = password;
        this.passphrase = passphrase;

        var chain = new Decafbad.Chain([], this, on_failure),
            salt, key, rsa_key, rsa_iv, ursa_key, tag;

        chain
            .push(function (chain) {
                // First, work out which cluster has our data.
                this._findCluster(chain.nextCallback(), on_failure);
            })
            .push(function (chain, cluster_url) {
                // Stash the cluster URL.
                this.cluster_url = cluster_url;
                // Next, fetch our priv and pub keys.
                this._fetchKeys(chain.nextCallback(), on_failure);
            })
            .push(function (chain, pubkey, pubkey_url, privkey, privkey_url) {
                // Stash the keys fetched.
                this.pubkey      = pubkey;
                this.pubkey_url  = pubkey_url;
                this.privkey     = privkey;
                this.privkey_url = privkey_url;

                Mojo.Log.error("LOGGED IN %s", username);

                // Generate symmetric key based on supplied passphrase.
                Weave.Crypto.PKCS5_Chained.generate(
                    this.passphrase,
                    Weave.Util.Base64.decode(this.privkey.salt),
                    4096, 32,
                    chain.nextCallback(),
                    on_failure
                );
                on_progress(0.3);
            })
            .push(function (chain, pkcs5_key) {

                // Decrypt the user's private key using the passphrase-based
                // symmetric key.
                ursa_key = Weave.Crypto.AES.decrypt(
                    pkcs5_key, 
                    Weave.Util.Base64.decode(this.privkey.iv),
                    Weave.Util.Base64.decode(this.privkey.keyData)
                );

                // Parse for the key
                tag = Weave.Crypto.ASN1.PKCS1.parse(ursa_key);
                if (!tag) {
                    return chain.on_error("PASSPHRASE INCORRECT");
                }
                this.tag = tag;
                on_progress(0.7);

                this.rsa_key = new RSAKey();
                this.rsa_key.setPrivateEx(
                    tag[0], tag[1], tag[2], tag[3], 
                    tag[4], tag[5], tag[6], tag[7]
                );
  
                this.logged_in = true;
                on_success(true);
            })
            .next();
    },

    /**
     * Assemble counts and dates for the logged in user's collections.
     */
    getCollections: function (on_success, on_failure) {
        if (!this.logged_in) { return on_failure("NOT LOGGED IN"); }

        var info_url = this.cluster_url + this.options.api_version + '/' +
                this.u_username + '/info',
            dates = null,
            counts = null,
            collections = {},
            chain = new Decafbad.Chain([], this, on_failure);

        chain
            .push(function (chain) {
                // Fetch the modified dates for all collections
                this._fetchAPI(info_url + '/collections',
                    chain.nextCallback(),
                    chain.errorCallback('getCollections /collections')
                );
            })
            .push(function (chain, data) {
                // Stash the dates and fetch the counts for all collections.
                dates = data;
                this._fetchAPI(info_url + '/collection_counts',
                    chain.nextCallback(),
                    chain.errorCallback('getCollections /collection_counts')
                );
            })
            .push(function (chain, data) {
                // Stash the counts for all collections.
                counts = data;

                // Iterate through all the named collections with dates,
                // assemble unified data structures of dates and counts for
                // every collection.  The names of both sets should match.
                $H(dates).keys().each(function (name) {

                    // Turn the numeric time into a date object.
                    var date = new Date();
                    date.setTime(dates[name] * 1000);

                    // Add the count / date to the set of collections
                    collections[name] = {
                        count: counts[name], 
                        last_modified: date
                    };

                }, this);

                return on_success(collections);
            })
            .next();
    },

    /**
     * Fetch a list of IDs for the named collection.
     */
    listCollection: function (collection_name, params, on_success, on_failure) {
        if (!this.logged_in) { return on_failure("NOT LOGGED IN"); }

        var url = this.cluster_url + this.options.api_version + '/' + 
                this.u_username + '/storage/' + 
                encodeURIComponent(collection_name),
            chain = new Decafbad.Chain([], this, on_failure);

        chain
            .push(function (chain) {
                // Fetch the modified dates for all collections
                this._fetchAPI(
                    url,
                    chain.nextCallback(),
                    chain.errorCallback('getCollections /' + collection_name)
                );
            })
            .push(function (chain, data) {
                return on_success(data);
            })
            .next();
    },

    /**
     * Get an object from a collection by ID.
     */
    getFromCollection: function (collection_name, object_id, on_success, on_failure) {
        if (!this.logged_in) { return on_failure("NOT LOGGED IN"); }

        var object_url = this.cluster_url + this.options.api_version + '/' +
                this.u_username + '/storage/' +
                encodeURIComponent(collection_name) + '/' + 
                encodeURIComponent(object_id),
            object_data = null,
            enc_url = null,
            chain = new Decafbad.Chain([], this, on_failure);

        chain
            .push(function (chain) {
                
                // Fetch the object data from the service.
                this._fetchAPIWithPayload(
                    object_url,
                    chain.nextCallback(),
                    chain.errorCallback('getFromCollection /' + object_url)
                );

            })
            .push(function (chain, data) {

                // Stash the object data.
                object_data = data;

                enc_url = object_data.payload.encryption;
                if (this.caches.encryptions[enc_url]) {
                    // If the encryption asserted by the object has been
                    // cached, use it.
                    chain.next(this.caches.encryptions[enc_url]);
                } else {
                    // Otherwise, fetch the encryption details fresh before
                    // moving on.
                    this._fetchAPIWithPayload(
                        enc_url,
                        chain.nextCallback(),
                        chain.errorCallback('getFromCollection /' + enc_url)
                    );
                }

            })
            .push(function (chain, enc_data) {

                if ('undefined' == typeof enc_data.symkey) {
                    // If the symmetric key has not yet been decrypted, do so
                    // just this once and then cache for this encryption.
                    var key = enc_data.payload.keyring[this.pubkey_url];
                    var symkey = Weave.Util.intify(this.rsa_key.decrypt(
                        Weave.Util.StH(Weave.Util.Base64.decode(key))
                    ));
                    enc_data.symkey = symkey;
                    this.caches.encryptions[enc_url] = enc_data;
                }

                // Finally, decrypt and cleanup the JSON for the object.
                var json = Weave.Util.clearify(Weave.Crypto.AES.decrypt(
                    enc_data.symkey, 
                    Weave.Util.Base64.decode(enc_data.payload.bulkIV), 
                    Weave.Util.Base64.decode(object_data.payload.ciphertext)
                ));

                var date = new Date();
                date.setTime(object_data.modified * 1000);
                object_data.modified = date;
                
                // With the JSON in hand, parse it, cache the resulting 
                // object if necessary, and return it.
                var object = json.evalJSON();
                object_data.object = object;
                
                on_success(object_data);
            })
            .next();
    },

    _decryptObject: function (chain, object_data) {

    },

    /**
     * Query the Weave service for this user's cluster URL.
     */
    _findCluster: function (on_success, on_failure) {
        var req = new Ajax.Request(
            this.options.api_url + '/user/1/' + this.u_username + '/node/weave',
            {
                method: 'GET',
                onSuccess: function (resp) {
                    Mojo.Log.error("CLUSTER URL %s", resp.responseText);
                    on_success(resp.responseText);
                }.bind(this),
                onFailure: function () {
                    on_failure(resp, '_findCluster');
                }.bind(this)
            }
        );
    },

    /**
     * Fetch public and private keys from the cluster.
     */
    _fetchKeys: function (on_success, on_failure) {
        var base_url = this.cluster_url + this.options.api_version + '/' + 
                this.u_username + '/storage/keys',
            chain = new Decafbad.Chain([], this, on_failure),
            pubkey_url  = base_url + '/pubkey',
            pubkey      = null,
            privkey_url = base_url + '/privkey',
            privkey     = null;

        chain
            .push(function () {
                this._fetchAPIWithPayload(
                    pubkey_url,
                    chain.nextCallback(),
                    function (resp) {
                        on_failure(resp, '_fetchKeys (privkey)');
                    }
                );
            })
            .push(function (chain, data) {
                pubkey = data.payload;
                this.caches.pubkeys[pubkey_url] = data;
                this._fetchAPIWithPayload(
                    privkey_url,
                    chain.nextCallback(),
                    function (resp) {
                        on_failure(resp, '_fetchKeys (privkey)');
                    }
                );
            })
            .push(function (chain, data) {
                privkey = data.payload;
                on_success(pubkey, pubkey_url, privkey, privkey_url);
            })
            .next();
    },

    /**
     * Perform an authenticated GET against the API, parsing the JSON payload
     * in place first.
     */
    _fetchAPI: function (url, on_success, on_failure) {
        var req = new Ajax.Request(
            url, 
            {
                evalJSON: "force",
                onSuccess: function (resp) {
                    var data = resp.responseJSON;
                    Mojo.Log.error("API DATA %s / %j", url, data);
                    on_success(data, resp);
                }.bind(this),
                onFailure: on_failure,
                requestHeaders: {
                    Authorization: "Basic " + Weave.Util.Base64.encode(
                        this.username + ':' + this.password
                    )
                }
            }
        );
    },

    /**
     * Perform an authenticated GET against the API, parsing the JSON payload
     * in place first.
     */
    _fetchAPIWithPayload: function (url, on_success, on_failure) {
        return this._fetchAPI(
            url,
            function (data, resp) {
                data.payload = data.payload.evalJSON();
                on_success(data, resp);
            },
            on_failure
        );
    },

    EOF:null // I hate trailing comma errors
};
