/**
 * @fileOverview Weave model basic object
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

Weave.Service.BasicObject = Class.create(Decafbad.SiloObject, /** @lends Weave.Service.BasicObject */{

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
    initialize: function ($super, data, collection, url) {
        if (Object.isString(data)) {
            data = json.evalJSON();
        }
        $super(data);
        if (this._object.payload && Object.isString(this._object.payload)) {
            this._object.payload = this._object.payload.evalJSON();
        }
        if (url) {
            this.set('url', url);
        }
        this.collection = collection;
    },

    /**
     * Handler to be called just before saving this object.
     *
     * Since the Weave service has its own notion of modified timestamp,
     * rename the local versions with a prefix.  Also, Weave uses seconds
     * and not milliseconds, so adjust for easier comparison.
     *
     * @param {Decafbad.Silo} silo Silo about to save this object.
     */
    beforeSave: function ($super, silo) {
        this.silo = this;
        if (!this.get('local_created')) { 
            this.set('local_created', (new Date()).getTime() / 1000);
        }
        this.set('local_modified', (new Date()).getTime() / 1000);
    },

    EOF:null

});

Weave.Service.BasicCollection = Class.create(/** @lends Weave.Service.BasicCollection */{

    /** Class to be instantiated for each record fetched. */
    _record_type: Weave.Service.BasicObject,

    /**
     * collection of a set of weave basic objects
     * 
     * @param {Weave.Service} service Instance of Weave.Service
     *
     * @constructs
     * @author l.m.orchard@pobox.com
     */
    initialize: function (service) {
        this.service = service;
        this._records = {};
    },

    /**
     * Force a fetch from the service.
     *
     * @param {string}   url        URL of the record to fetch
     * @param {function} on_success Success callback (record)
     * @param {function} on_failure Failure callback (record)
     */
    _import: function (url, on_success, on_failure) {
        this.service.fetch(
            url,
            function (data, resp) {
                if (!data) { on_failure(this); }
                if (data.payload) {
                    data.payload = data.payload.evalJSON();
                }
                var record = new this._record_type(data, this, url);
                record.set('url', url);
                on_success(this.set(url, record));
            }.bind(this),
            on_failure
        );
    },

    /**
     * Retrieve a record from the collection cache, forcing a fetch if the record
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
     * Store a record in the collection cache at the given URL.
     *
     * @param {string} url URL for record
     * @param {Weave.Service.BasicObject} record Record to store
     */
    set: function (url, record) {
        this._records[url] = record;
        record.collection = this;
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
