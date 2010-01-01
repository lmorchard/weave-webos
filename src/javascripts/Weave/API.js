/**
 * @fileOverview Wrapper for Weave API
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */
Weave.API = Class.create(/** @lends Weave.API */ {

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

        this.privkeys = new Weave.Model.PrivKeyManager(this);
        this.pubkeys  = new Weave.Model.PubKeyManager(this);
        this.symkeys  = new Weave.Model.SymKeyManager(this);
        this.items    = new Weave.Model.CryptoWrapperCollection(this);
    },

    /**
     * Perform login and initial crypto.
     */
    login: function (on_progress, on_success, on_failure) {
        var salt, key, rsa_key, rsa_iv, ursa_key, tag;

        var chain = new Decafbad.Chain([
            function (chain) {
                on_progress(0.1, "Finding your cluster");
                this.findCluster(chain.nextCb(), chain.errorCb());
            },
            function (chain, cluster_url) {
                on_progress(0.2, "Fetching your keys");
                this.cluster_url = cluster_url;
                this.fetchKeys(chain.nextCb(), chain.errorCb());
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

        var url = this.cluster_url + this.options.api_version +
            '/' + encodeURIComponent(this.options.username) +
            '/info/collections';

        var chain = new Decafbad.Chain([
            function (chain) {
                // Fetch the modified dates for all collections
                this.fetch(url, chain.nextCb(), chain.errorCb());
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
        var url = this.cluster_url + this.options.api_version + 
            '/' + encodeURIComponent(this.options.username) +
            '/info/collection_counts';
        this.fetch(url, on_success, on_failure);
    },

    /**
     * Query the Weave service for this user's cluster URL.
     */
    findCluster: function (on_success, on_failure) {
        var url = this.options.api_url + 
            '/user/1/' + encodeURIComponent(this.options.username) + 
            '/node/weave';
        var req = new Ajax.Request(url,
            {
                method: 'GET',
                onSuccess: function (resp) { on_success(resp.responseText); },
                onFailure: function () { on_failure(resp, 'findCluster'); }
            }
        );
    },

    /**
     * Fetch public and private keys from the cluster.
     */
    fetchKeys: function (on_success, on_failure) {
        var base_url = this.cluster_url + this.options.api_version +
            '/' + encodeURIComponent(this.options.username) +
            '/storage/keys';

        this.pubkeys.setDefaultURL(base_url + '/pubkey');
        this.privkeys.setDefaultURL(base_url + '/privkey');

        var chain = new Decafbad.Chain([
            function (chain) {
                this.pubkeys.getDefault(chain.nextCb(), 
                    chain.errorCb('fetchKeys (pubkey)'));
            },
            function (chain, pubkey) {
                this.privkeys.getDefault(chain.nextCb(pubkey), 
                    chain.errorCb('fetchKeys (privkey)'));
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

    EOF:null // I hate trailing comma errors
});
