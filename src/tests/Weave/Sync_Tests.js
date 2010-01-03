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

Weave_Sync_Tests.sync = new Weave.Sync({
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
         */
        testHistorySync: function (recordResults) {
            var g = {};
            var chain = new Decafbad.Chain([
                "_resetSync", "_performLogin",
                function (ch) {
                    // List collections to get last mod times.
                    this.service.listAllCollections(ch.nextCb(), ch.errorCb());
                },
                function (ch, collections) {
                    // Plan to grab entries from 2 days ago.
                    g.mod_time = collections.history / 1000;
                    g.start_time = g.mod_time - (2 * 24 * 60 * 60);

                    g.dt = new Date();
                    g.dt.setTime(g.start_time * 1000);
                    Mojo.log("Seeking items since " + g.dt + '...');

                    this.service.history.list({
                        sort: 'newer',
                        newer: g.start_time
                    }, ch.nextCb(), ch.errorCb());
                },
                function (ch, id_list) {
                    Mojo.log("Found " + id_list.length + " items");

                    this.service.history.list({
                        full: true,
                        limit: 25, 
                        sort: 'newer',
                        newer: g.start_time
                    }, ch.nextCb(), ch.errorCb());
                },
                function (ch, results) {
                    var s_ch = new Decafbad.Chain([], this);

                    results.each(function (item) {
                        s_ch.push([
                            function (s_ch) {
                                this.sync.silos.history
                                    .save(item, s_ch.nextCb(), s_ch.errorCb());
                            },
                            function (s_ch, obj) {
                                Mojo.log('TITLE: '+obj.get('title'));
                                //Mojo.log('URL: '+obj.get('histUri'));
                                s_ch.next();
                            }
                        ]);
                    }, this);

                    s_ch.push(function (s_ch) { ch.next(); });
                    s_ch.start();
                },
                function (ch) {

                    var db = this.sync.silos.history.db,
                        table_name = this.sync.silos.history.table_name;
                    db.transaction(function (tx) {
                        tx.executeSql(
                            'SELECT COUNT(*) AS count FROM ' + table_name, [],
                            function (tx, rs) {
                                var i, l, rows = rs.rows;
                                for (i=0,l=rows.length; i<l; i++) {
                                    var row = rows.item(i);
                                    Mojo.Log.logJSON(row);
                                }
                                ch.next();
                            },
                            ch.errorCb()
                        );
                    });

                },
                function (ch) {
                    recordResults(Mojo.Test.passed);
                }

            ], this).start();
        },

        /**
         * Reset all the sync silos before a test.
         */
        _resetSync: function (chain) {
            var sub_chain = new Decafbad.Chain([], this);
            
            /*
            $H(this.sync.silos).each(function (pair) {
                sub_chain.push(function (sc) {
                    Mojo.log("Resetting %s silo...", pair.key);
                    pair.value.resetAll(sc.nextCb(), chain.errorCb());
                });
            }, this);
            */

            sub_chain.push([
                function (sc) {
                    this.sync.open(sc.nextCb(), sc.errorCb());
                },
                function (sc) {
                    chain.next();
                }
            ]).start();
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
