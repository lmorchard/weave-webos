/**
 * @fileOverview Weave sync engine
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

/** @namespace */
Weave.Sync = {
    running: []
};

Weave.Sync.BasicSync = Class.create(/** @lends Weave.Sync.BasicSync */ {

    /** Local storage silo class */
    silo_class: Weave.Storage.HistorySilo,
    /** Name of the service collection synched */
    collection_name: 'history',
    /** Maximum duration into history for sync */
    max_history: null,
    /** Number of items to fetch and sync at a time */
    chunk_size: 100,

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

    /**
     * Open the silo for sync
     *
     * @param {function} on_success Callback on success
     * @param {function} on_failure Callback on failure
     */
    open: function (on_success, on_failure) {
        var chain = new Decafbad.Chain([
            function (chain) {
                this.silo.open(chain.nextCb(), on_failure);
            },
            on_success
        ], this, on_failure).start();
    },

    /**
     *
     * @param {function} on_progress Callback on progress
     * @param {function} on_success  Callback on success
     * @param {function} on_failure  Callback on failure
     */
    startSync: function (on_progress, on_success, on_failure) {
        var $this = this;
        var chain = new Decafbad.Chain([
            function (ch) {
                // Look for silo last modified timestamp.
                this.silo.getLastModified(ch.nextCb(), ch.errorCb());
            },
            function (ch, silo_last_mod) {
                if (silo_last_mod) {
                    // Got a last modified, so pass it along.
                    on_progress("Seeking from silo last modified");
                    return ch.next(silo_last_mod);
                }
                if (!this.max_history) {
                    // No max history, so need to get everything.
                    on_progress("Seeking all items");
                    return ch.next(null);
                }
                // Look for the last modified of the service in order
                // to derive newer than timestamp from max history.
                this.service.listAllCollections(
                    function (data) {
                        var service_last_mod = 
                            data[this.collection_name].getTime() / 1000;
                        var newer_than = service_last_mod - this.max_history;
                        on_progress("Seeking history newer than " + newer_than);
                        ch.next(newer_than);
                    }.bind(this),
                    ch.errorCb()
                );
            },
            function (ch, newer_than) {
                this.collection.list({
                    sort: 'index', newer: newer_than
                }, ch.nextCb(), ch.errorCb());
            },
            function (ch, need_ids) {
                on_progress("Found " + need_ids.length + " items to sync.");

                var chunks = [];
                for (var i=0, l=need_ids.length; i<l; i+=this.chunk_size) {
                    chunks.push(need_ids.slice(i, i+this.chunk_size));
                }

                var total_chunks = chunks.length;
                on_progress("Prepared " + total_chunks + " chunks to sync.");

                (function () {
                    var cb = arguments.callee.bind(this),
                        chunk = chunks.shift(),
                        perc = ((total_chunks-chunks.length)/total_chunks) * 100;

                    // DEBUG: Bail at 18%
                    //if (perc > 18) { return ch.next(); }
                    //Mojo.Log.logJSON(chunk);

                    if (!chunk) { return ch.next(); }

                    this.collection.list(
                        { full: true, ids: chunk },
                        function (results) {
                            on_progress("Downloaded " + results.length + " items");

                            this.silo.save(
                                results,
                                function (saved) {
                                    on_progress("Saved " + saved.length + " items");
                                    on_progress("Completed " + Math.ceil(perc) + "%");
                                    setTimeout(cb, 1);
                                },
                                ch.errorCb()
                            );
                        }.bind(this),
                        ch.errorCb()
                    );

                }.bind(this))();

                //ch.next();
            },
            on_success
        ], this).start();
    },

    EOF:null // I hate trailing comma errors
});

/**
 *
 */
Weave.Sync.SyncState = Class.create(/** @lends Weave.Sync.SyncState */{

    /**
     *
     * @constructs
     * @author l.m.orchard@pobox.com
     *
     * @param {object} options Silo options
     */
    initialize: function (options) {
        this.options = Object.extend({

        }, options || {});
    },

    EOF:null
});

/**
 * @class
 * @augments Weave.Sync.BasicSync
 */
Weave.Sync.HistorySync = Class.create(Weave.Sync.BasicSync, /** @lends Weave.Sync.HistorySync */ {
    silo_class: Weave.Storage.HistorySilo,
    collection_name: 'history',
    max_history: null, //3 * 24 * 60 * 60,
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
