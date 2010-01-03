/**
 * @fileOverview Tests for Weave.Sync
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */
function Weave_Sync_Tests(tickleFunction) {
    this.initialize(tickleFunction);
}

Weave_Sync_Tests.service = new Weave.Service({
    username:   Weave.TestData.auth.username,
    password:   Weave.TestData.auth.password,
    passphrase: Weave.TestData.auth.passphrase
}); 

Weave_Sync_Tests.sync = new Weave.Sync.HistorySync({
    service: Weave_Sync_Tests.service
});

// Extra long timeout to account for slow network.
Weave_Sync_Tests.timeoutInterval = 120000;

Weave_Sync_Tests.prototype = (function () {

    return /** @lends Weave_Sync_Tests */ {

        /**
         * Test setup, run before execution of each test.
         *
         * @constructs
         * @author l.m.orchard@pobox.com
         *
         * @param {function} Test tickle function
         */
        initialize: function (tickleFunction) {
            this.tickleFunction = tickleFunction;

            this.service = Weave_Sync_Tests.service;
            this.sync = Weave_Sync_Tests.sync;
        },

        /**
         *
         */
        testHistorySync: function (recordResults) {
            var g = {};
            var chain = new Decafbad.Chain([
                "_resetSync", "_performLogin",
                function (ch) {
                    this.sync.startSync(
                        function (str) {
                            Mojo.log("[sync] %s", str);
                        },
                        chain.nextCb(), chain.errorCb()
                    );
                },
                /*
                function (ch) {
                    // List collections to get last mod times.
                    this.sync.service.listAllCollections(ch.nextCb(), ch.errorCb());
                },
                function (ch, collections) {
                    // Plan to grab entries from 2 days ago.
                    g.mod_time = collections.history / 1000;
                    g.start_time = g.mod_time - (3 * 24 * 60 * 60);
                    Mojo.log("Newest item at " + g.mod_time);

                    this.sync.silo.getLastModified(ch.nextCb(), ch.errorCb());
                },
                function (ch, results) {
                    Mojo.log("Silo last modified %s", results);
                    Mojo.log("Seeking items since " + g.start_time + '...');

                    this.sync.service.history.list({
                        sort: 'newer', newer: g.start_time
                    }, ch.nextCb(), ch.errorCb());
                },
                function (ch, id_list) {
                    Mojo.log("Found " + id_list.length + " items");

                    this.sync.collection.list({
                        full: true, limit: 30, sort: 'newer', newer: g.start_time
                    }, ch.nextCb(), ch.errorCb());
                },
                function (ch, results) {
                    this.sync.silo.save(results, ch.nextCb(), ch.errorCb());
                },
                function (ch) {
                    this.sync.silo.query([], [], ch.nextCb(), ch.errorCb());
                },
                function (ch, results) {
                    results.each(function (item) {
                        Mojo.log("TITLE: %s", item.get('title'));
                    }, this);
                    Mojo.log("Found %s items in DB", results.length);
                    this.sync.silo.getLastModified(ch.nextCb(), ch.errorCb());
                },
                function (ch, results) {
                    Mojo.log("Silo last modified %s", results);
                },
                */
                function (ch) {
                    recordResults(Mojo.Test.passed);
                }

            ], this).start();
        },

        /**
         * Reset all the sync silos before a test.
         */
        _resetSync: function (chain) {
            var sub_chain = new Decafbad.Chain([
                function (sc) {
                    this.sync.silo.resetAll(sc.nextCb(), sc.errorCb());
                },
                function (sc) {
                    this.sync.open(sc.nextCb(), sc.errorCb());
                },
                function (sc) {
                    chain.next();
                }
            ], this).start();
        },

        /**
         * Common login chain step
         */
        _performLogin: function (chain) {
            this.service.login(
                function (pct, msg) {
                    Mojo.Log.error("Login %s%% - %s", pct * 100, msg);
                    this.tickleFunction();
                }.bind(this),
                chain.nextCb(),
                chain.errorCb('_performLogin')
            );
        },

        EOF:null // I hate trailing comma errors

    };
}());
