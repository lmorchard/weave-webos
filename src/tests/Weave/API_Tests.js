/**
 * @fileOverview Tests for Weave.API
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */
function Weave_API_Tests(tickleFunction) {
    this.initialize(tickleFunction);
}

Weave_API_Tests.api = new Weave.API({
    username:   Weave.TestData.auth.username,
    password:   Weave.TestData.auth.password,
    passphrase: Weave.TestData.auth.passphrase
}); 

// Extra long timeout to account for slow network.
Weave_API_Tests.timeoutInterval = 120000;

Weave_API_Tests.prototype = (function () {

    return /** @lends Weave_API_Tests */ {

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

            this.api = Weave_API_Tests.api;
            /*
            this.api = new Weave.API({
                username:   Weave.TestData.auth.username,
                password:   Weave.TestData.auth.password,
                passphrase: Weave.TestData.auth.passphrase
            });
            */

            Mojo.Log.error("USERNAME %s", Weave.TestData.auth.username);
        },

        /**
         * Common login chain step
         */
        _performLogin: function (chain) {
            this.api.login(
                function (pct, msg) {
                    Mojo.Log.error("Login %s%% - %s", pct * 100, msg);
                    this.tickleFunction();
                }.bind(this),
                chain.nextCallback(),
                chain.errorCallback('_performLogin')
            );
        },

        /**
         * Exercise Weave login sequence.
         */
        testLogin: function (recordResults) {
            Mojo.log("testLogin");
            var chain = new Decafbad.Chain([], this);
            chain.push([
                "_performLogin",
                function (chain) {
                    Mojo.Log.error("PUB KEY %s", $H(this.api.pubkey).keys());
                    Mojo.Log.error("PRIV KEY %s", $H(this.api.privkey).keys());
                    recordResults(Mojo.Test.passed);
                }
            ]).next();
        },

        /**
         * Exercise the acquisition of collection info
         */
        testListAllCollections: function (recordResults) {
            Mojo.log("testListAllCollections");
            var chain = new Decafbad.Chain([], this);
            chain
                .push("_performLogin")
                .push(function (chain) {
                    this.api.listAllCollections(
                        chain.nextCallback(),
                        chain.errorCallback('testListAllCollections, listAllCollections')
                    );
                })
                .push(function (chain, collections) {
                    var expected_collections = Weave.TestData.expected_collections;

                    expected_collections.each(function (name) {
                        var result = collections[name];
                        Mojo.require(
                            'object' == typeof result,
                            "Collection last modified should be a date");
                        Mojo.require(
                            'function' == typeof result.getDate,
                            "Collection last modified should be a date"
                        );
                        Mojo.Log.error("COLLECTION %j = %j", name, result);
                    }, this);

                    chain.next();
                })
                .push(function (chain) {
                    recordResults(Mojo.Test.passed);
                })
                .next();
        },

        /**
         * Exercise the acquisition of collection info
         */
        testListAllCollectionCounts: function (recordResults) {
            Mojo.log("testListAllCollectionCounts");
            var chain = new Decafbad.Chain([], this);
            chain
                .push("_performLogin")
                .push(function (chain) {
                    this.api.listAllCollectionCounts(
                        chain.nextCallback(),
                        chain.errorCallback('testListAllCollectionCounts, ' + 
                            'listAllCollectionCounts')
                    );
                })
                .push(function (chain, collections) {
                    var expected_collections = Weave.TestData.expected_collections;
                    expected_collections.each(function (name) {
                        Mojo.Log.error("COLLECTION %j = %j", name, collections[name]);
                        /*
                        Mojo.require(
                            'number' === typeof collections[name],
                            "Collection count should be a number (was " +
                                (typeof collections[name]) + ")"
                            );
                            */
                    }, this);

                    recordResults(Mojo.Test.passed);
                })
                .next();
        },

        /**
         * Exercise listing a collection.
         */
        testListCollection: function (recordResults) {
            Mojo.log("testListCollection");
            var checked_collection = Weave.TestData.checked_collection;
                chain = new Decafbad.Chain([], this);
            chain
                .push("_performLogin")
                .push(function (chain) {
                    this.api.listCollection(
                        checked_collection,
                        { 
                            "sort": "newest",
                            "limit": 5
                        },
                        chain.nextCallback(),
                        chain.errorCallback('testListCollection, listCollection')
                    );
                })
                .push(function (chain, collection_list) {
                    Mojo.Log.error("LIST %s %j", 
                        checked_collection, collection_list);
                    Mojo.require(collection_list.length > 0,
                        "There should be at least one item in the collection");
                    Mojo.require("string" == typeof collection_list[0],
                        "The first item in the list should be a string");
                    chain.next();
                })
                .push(function (chain) {
                    recordResults(Mojo.Test.passed);
                })
                .next();
        },

        /**
         * Exercise fetching individual items from a collection.
         */
        testGetFromCollection: function (recordResults) {
            Mojo.log('testGetFromCollection');
            var checked_collection = Weave.TestData.checked_collection,
                object_id = null,
                objects = [],
                chain = new Decafbad.Chain([], this);
            chain
                .push("_performLogin")
                .push(function (chain) {
                    this.api.listCollection(
                        checked_collection,
                        {
                            "sort": "newest",
                            "limit": 5
                        },
                        chain.nextCallback(),
                        chain.errorCallback('testGetFromCollection, list')
                    );
                })
                .push(function (chain, collection_list) {

                    var sub_chain = new Decafbad.Chain([], this),
                        sub_list = collection_list.slice(0,5);
                        
                    sub_list.each(function (object_id, idx) {
                        Mojo.Log.error("QUEUEING OBJECT FETCH #%s - %s/%s", 
                            idx, checked_collection, object_id);

                        sub_chain.push(function (sub_chain) {
                            this.api.getFromCollection(
                                checked_collection,
                                object_id,
                                sub_chain.nextCallback(),
                                sub_chain.errorCallback('fetching')
                            );
                        });

                        sub_chain.push(function (sub_chain, object) {
                            objects.push(object);
                            Mojo.require('object' === typeof object,
                                "Collection should yield an object");
                            sub_chain.next();
                        });
                    });

                    sub_chain.push(chain.nextCallback()).next();
                })
                .push(function (chain) {
                    recordResults(Mojo.Test.passed);
                })
                .next();
        },

        EOF:null // I hate trailing comma errors
    };
}());
