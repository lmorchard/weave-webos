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
     */
    initialize: function (options) {
        this.logged_in = false;

        this.options = Object.extend({
            "api_url":     "https://services.mozilla.com",
            "api_version": "1.0",
            "username":    null,
            "password":    null,
            "passphrase":  null
        }, options || {});

        this.options.u_username = encodeURIComponent(this.options.username);

        this.privkeys = new Weave.Model.PrivKeyManager(this);
        this.pubkeys  = new Weave.Model.PubKeyManager(this);
        this.symkeys  = new Weave.Model.SymKeyManager(this);
    },

    /**
     * Perform login and initial crypto.
     */
    login: function (on_progress, on_success, on_failure) {
        var salt, key, rsa_key, rsa_iv, ursa_key, tag;

        var chain = new Decafbad.Chain([
            function (chain) {
                // First, work out which cluster has our data.
                on_progress(0.1, "Finding your cluster");
                this.findCluster(chain.nextCallback(), chain.errorCallback());
            },
            function (chain, cluster_url) {
                // Stash the cluster URL.
                this.cluster_url = cluster_url;
                // Next, fetch our priv and pub keys.
                on_progress(0.2, "Fetching your keys");
                this.fetchKeys(chain.nextCallback(), chain.errorCallback());
            },
            function (chain, pubkey, privkey) {
                on_progress(1.0, "Logged in " + this.options.username);
                this.pubkey  = pubkey;
                this.privkey = privkey;
                this.logged_in = true;
                on_success(true);
            }
        ], this, on_failure).next();
    },

    /**
     * List all known collections and modification dates.
     */
    listAllCollections: function (on_success, on_failure) {
        if (!this.logged_in) { return on_failure("NOT LOGGED IN"); }

        var info_url = this.cluster_url + this.options.api_version + '/' +
            this.options.u_username + '/info';

        var chain = new Decafbad.Chain([
            function (chain) {
                // Fetch the modified dates for all collections
                this.fetch(info_url + '/collections',
                    chain.nextCallback(),
                    chain.errorCallback('getCollections /collections')
                );
            },
            function (chain, dates) {
                // Transform numeric dates into Date objects.
                $H(dates).keys().each(function (name) {
                    var date = new Date();
                    date.setTime(dates[name] * 1000);
                    dates[name] = date;
                }, this);
                return on_success(dates);
            }
        ], this, on_failure).next();
    },

    /**
     * Assemble counts and dates for the logged in user's collections.
     */
    listAllCollectionCounts: function (on_success, on_failure) {
        if (!this.logged_in) { return on_failure("NOT LOGGED IN"); }

        var info_url = this.cluster_url + this.options.api_version + '/' +
                this.options.u_username + '/info';

        // Fetch and return the collection counts.
        this.fetch(info_url + '/collection_counts', on_success, on_failure);
    },

    /**
     * Fetch a list of IDs for the named collection.
     */
    listCollection: function (collection_name, params, on_success, on_failure) {
        if (!this.logged_in) { return on_failure("NOT LOGGED IN"); }

        var url = this.cluster_url + this.options.api_version + '/' + 
                this.options.u_username + '/storage/' + 
                encodeURIComponent(collection_name);

        if (params) {
            url = url + '?' + $H(params).toQueryString();
        }

        var chain = new Decafbad.Chain([
            function (chain) {
                // Fetch the modified dates for all collections
                this.fetch(
                    url,
                    chain.nextCallback(),
                    chain.errorCallback('getCollections /' + collection_name)
                );
            },
            function (chain, data) {
                return on_success(data);
            }
        ], this, on_failure).next();
    },

    /**
     * Get an object from a collection by ID.
     */
    getFromCollection: function (collection_name, object_id, on_success, on_failure) {
        if (!this.logged_in) { return on_failure("NOT LOGGED IN"); }

        var object_url = this.cluster_url + this.options.api_version + '/' +
                this.options.u_username + '/storage/' +
                encodeURIComponent(collection_name) + '/' + 
                encodeURIComponent(object_id);
               
        var chain = new Decafbad.Chain([
            function (chain) {
                this.fetchWithPayload(
                    object_url,
                    chain.nextCallback(),
                    chain.errorCallback('getFromCollection')
                );
            },
            function (chain, data) {
                this.symkeys.get(
                    data.payload.encryption,
                    chain.nextCallback(data),
                    chain.errorCallback('getFromCollection')
                );
            },
            function (chain, object_data, symkey) {

                // Finally, decrypt and cleanup the JSON for the object.
                var json = Weave.Util.clearify(Weave.Crypto.AES.decrypt(
                    symkey.get('symkey'), 
                    Weave.Util.Base64.decode(symkey.get('payload').bulkIV), 
                    Weave.Util.Base64.decode(object_data.payload.ciphertext)
                ));

                var date = new Date();
                date.setTime(object_data.modified * 1000);
                object_data.modified = date;
                
                var object = json.evalJSON();
                object_data.object = object;

                delete object_data.payload.ciphertext;
                Mojo.log("OBJECT %j", object_data);
                Mojo.log("OBJECT FULL %j", object_data.object);
                
                on_success(object_data);
            }
        ], this, on_failure).next();
    },

    _decryptObject: function (chain, object_data) {

    },

    /**
     * Query the Weave service for this user's cluster URL.
     */
    findCluster: function (on_success, on_failure) {
        var req = new Ajax.Request(
            this.options.api_url + '/user/1/' + this.options.u_username + '/node/weave',
            {
                method: 'GET',
                onSuccess: function (resp) {
                    on_success(resp.responseText);
                }.bind(this),
                onFailure: function () {
                    on_failure(resp, 'findCluster');
                }.bind(this)
            }
        );
    },

    /**
     * Fetch public and private keys from the cluster.
     */
    fetchKeys: function (on_success, on_failure) {
        var base_url = this.cluster_url + this.options.api_version + '/' + 
                this.options.u_username + '/storage/keys';

        this.pubkeys.setDefaultURL(base_url + '/pubkey');
        this.privkeys.setDefaultURL(base_url + '/privkey');

        var chain = new Decafbad.Chain([
            function (chain) {
                this.pubkeys.getDefault(
                    chain.nextCallback(),
                    chain.errorCallback('fetchKeys (pubkey)')
                );
            },
            function (chain, pubkey) {
                this.privkeys.getDefault(
                    chain.nextCallback(pubkey),
                    chain.errorCallback('fetchKeys (privkey)')
                );
            },
            function (chain, pubkey, privkey) {
                on_success(pubkey, privkey);
            }
        ], this, on_failure).next();
    },

    /**
     * Perform an authenticated GET against the API, parsing the JSON payload
     * in place first.
     */
    fetch: function (url, on_success, on_failure) {
        var req = new Ajax.Request(
            url, 
            {
                evalJSON: "force",
                onSuccess: function (resp) {
                    var data = resp.responseJSON;
                    this.data = data;
                    this.response = resp;
                    on_success(data, resp);
                }.bind(this),
                onFailure: on_failure,
                requestHeaders: {
                    Authorization: "Basic " + Weave.Util.Base64.encode(
                        this.options.username + ':' + this.options.password
                    )
                }
            }
        );
    },

    /**
     * Perform an authenticated GET against the API, parsing the JSON payload
     * in place first.
     */
    fetchWithPayload: function (url, on_success, on_failure) {
        return this.fetch(
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
