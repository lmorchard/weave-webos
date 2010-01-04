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

            Weave_Sync_Tests.service = new Weave.Service({
                username:   Weave.TestData.auth.username,
                password:   Weave.TestData.auth.password,
                passphrase: Weave.TestData.auth.passphrase
            }); 

            Weave_Sync_Tests.sync_manager = new Weave.Sync.Manager({
                service: Weave_Sync_Tests.service
            });

            this.service = Weave_Sync_Tests.service;
            this.sync_manager = Weave_Sync_Tests.sync_manager;
        },

        /**
         *
         */
        testSync: function (recordResults) {

            dojo.subscribe('/weave/sync/progress', function (msg) {
                Mojo.log("[sync] %s", msg);
            });

            var chain = new Decafbad.Chain([
                "_resetSync", "_performLogin",
                function (ch) {
                    this.sync_manager.options.max_history = 2 * 24 * 60 * 60;
                    this.sync_manager.check('history', 
                        chain.nextCb(), chain.errorCb());
                },
                function (ch) {
                    this.sync_manager.options.max_history = null;
                    this.sync_manager.check('bookmarks', 
                        chain.nextCb(), chain.errorCb());
                },
                function (ch) {
                    this.sync_manager.options.max_history = null;
                    this.sync_manager.check('tabs', 
                        chain.nextCb(), chain.errorCb());
                },
                function (ch) {
                    dojo.subscribe('/weave/sync/running', function () {
                        Mojo.log("Running.");
                    });
                    dojo.subscribe('/weave/sync/finished', chain.nextCb());
                    dojo.subscribe('/weave/sync/failed', chain.errorCb());
                    // this.sync_manager.step(ch.nextCb(), ch.errorCb());
                    this.sync_manager.start();
                },
                function (ch) {
                    Mojo.log("Finished!");
                    recordResults(Mojo.Test.passed);
                }

            ], this).start();
        },

        /**
         * Reset all the sync silos before a test.
         */
        _resetSync: function (chain) {
            var sc = new Decafbad.Chain([
                function (sc) { 
                    try{
                        this.sync_manager.resetAll(sc.nextCb(), sc.errorCb()); 
                    } catch(e) {
                        Mojo.logException(e);
                    }
                },
                function (sc) { 
                    this.sync_manager.open(sc.nextCb(), sc.errorCb()); 
                },
                function (sc) { 
                    chain.next(); 
                }
            ], this, chain.errorCb()).start();
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
