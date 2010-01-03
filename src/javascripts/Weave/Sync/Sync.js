/**
 * @fileOverview Weave sync engine
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

/** @namespace */
Weave.Sync = {};

Weave.Sync.BasicSync = Class.create(/** @lends Weave.Sync.BasicSync */ {

    /** Local storage silo class */
    silo_class: Weave.Storage.HistorySilo,
    collection_name: 'history',

    /**
     * Weave sync engine
     * @constructs
     * @author l.m.orchard@pobox.com
     */
    initialize: function (options) {
        this.options = Object.extend({
            "service": null
        }, options || {});

        this.service = this.options.service;
        this.collection = this.service[this.collection_name];
        this.silo = new this.silo_class();
    },

    open: function (on_success, on_failure) {
        var chain = new Decafbad.Chain([
            function (chain) {
                this.silo.open(chain.nextCb(), on_failure);
            },
            on_success
        ], this, on_failure).start();
    },

    EOF:null // I hate trailing comma errors
});

/**
 * @class
 * @augments Weave.Sync.BasicSync
 */
Weave.Sync.HistorySync = Class.create(Weave.Sync.BasicSync, /** @lends Weave.Sync.HistorySync */ {
    silo_class: Weave.Storage.HistorySilo,
    collection_name: 'history',
    EOF: null
});

/**
 * @class
 * @augments Weave.Sync.BasicSync
 */
Weave.Sync.BookmarkSync = Class.create(Weave.Sync.BasicSync, /** @lends Weave.Sync.BookmarkSync */ {
    silo_class: Weave.Storage.BookmarkSilo,
    collection_name: 'bookmarks',
    EOF: null
});

/**
 * @class
 * @augments Weave.Sync.BasicSync
 */
Weave.Sync.TabSync = Class.create(Weave.Sync.BasicSync, /** @lends Weave.Sync.TabSync */ {
    silo_class: Weave.Storage.TabSilo,
    collection_name: 'tabs',
    EOF: null
});
