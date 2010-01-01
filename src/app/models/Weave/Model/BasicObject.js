/**
 * @fileOverview Weave model basic object
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

Weave.Model.BasicObject = Class.create(Decafbad.SiloObject, /** @lends Weave.Model.BasicObject */{

    /**
     * Weave basic object
     *
     * @param {function} $super Superclass constructor
     * @param {string}   url    URL for the record
     * @param {object}   data   Data for use in the record
     *
     * @constructs
     * @augments Decafbad.SiloObject
     * @author l.m.orchard@pobox.com
     */
    initialize: function ($super, manager, url, data) {
        $super({
            url: url,
            payload: {}
        });
        this.manager = manager;
        if (data) { this.update(data); }
    },

    /**
     * Populate the object with data from a JSON string
     *
     * @param {string} json JSON string for deserialization
     */
    deserialize: function (json) {
        this._object = ('string' === typeof json) ?
            json.evalJSON() : json;
        if (this._object.payload) {
            this._object.payload = $H(this._object.payload.evalJSON());
        } else {
            this._object.deleted = true;
        }
    },

    EOF:null

});

Weave.Model.RecordManager = Class.create(/** @lends Weave.Model.RecordManager */{

    /** Class to be instantiated for each record fetched. */
    _record_type: Weave.Model.BasicObject,

    /**
     * Manager of a set of weave basic objects
     * 
     * @param {Weave.API} api Instance of Weave.API
     *
     * @constructs
     * @author l.m.orchard@pobox.com
     */
    initialize: function (api) {
        this.api = api;
        this._records = {};
    },

    /**
     * Force a fetch from the API.
     *
     * @param {string}   url        URL of the record to fetch
     * @param {function} on_success Success callback (record)
     * @param {function} on_failure Failure callback (record)
     */
    _import: function (url, on_success, on_failure) {
        this.api.fetch(
            url,
            function (data, resp) {
                if (!data) { on_failure(this); }
                if (data.payload) {
                    data.payload = data.payload.evalJSON();
                }
                var record = new this._record_type(this, url, data);
                on_success(this.set(url, record));
            }.bind(this),
            on_failure
        );
    },

    /**
     * Retrieve a record from the manager cache, forcing a fetch if the record
     * is not found.
     *
     * @param {string}   url        URL of the record to fetch
     * @param {function} on_success Success callback (record)
     * @param {function} on_failure Failure callback (record)
     */
    get: function (url, on_success, on_failure) {
        if (this.contains(url)) {
            on_success(this._records[url]);
        } else {
            return this._import(url, on_success, on_failure);
        }
    },

    /**
     * Store a record in the manager cache at the given URL.
     *
     * @param {string} url URL for record
     * @param {Weave.Model.BasicObject} record Record to store
     */
    set: function (url, record) {
        this._records[url] = record;
        return record;
    },

    /**
     * Check whether the record for a given URL exists in the cache.
     *
     * @param {string} url URL for record
     */
    contains: function (url) {
        if (url in this._records) { return true; }
        return false;
    },

    /**
     * Clear all records from the cache.
     */
    clearCache: function () {
        this._records = {};
    },

    /**
     * Clear one record from the cache by URL
     *
     * @param {string} url URL for record
     */
    del: function (url) {
        delete this._records[url];
    },

    EOF: null
});
