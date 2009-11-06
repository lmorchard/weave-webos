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
            this.api = new Weave.API(); 

            Mojo.Log.error("USERNAME %s", Weave.TestData.auth.username);
        },

        /**
         * Common login chain step
         */
        _performLogin: function (chain) {
            this.api.login(
                Weave.TestData.auth.username,
                Weave.TestData.auth.password,
                Weave.TestData.auth.passphrase,
                function (pct) {
                    Mojo.Log.error("Login %s", pct);
                    this.tickleFunction();
                }.bind(this),
                chain.nextCallback(),
                chain.errorCallback('_performLogin')
            );
        },

        /**
         * Exercise Weave login sequence.
         */
        no_testLogin: function (recordResults) {
            var chain = new Decafbad.Chain([], this);
            chain
                .push("_performLogin")
                .push(function (chain) {
                    Mojo.Log.error("PUB KEY %j", this.api.pubkey);
                    Mojo.Log.error("PRIV KEY %j", this.api.privkey);
                    recordResults(Mojo.Test.passed);
                })
                .next();
        },

        /**
         * Exercise the acquisition of collection info
         */
        no_testGetCollections: function (recordResults) {
            var chain = new Decafbad.Chain([], this);
            chain
                .push("_performLogin")
                .push(function (chain) {
                    this.api.getCollections(
                        chain.nextCallback(),
                        chain.errorCallback('testGetCollections, getCollections')
                    );
                })
                .push(function (chain, collections) {
                    var expected_collections = Weave.TestData.expected_collections;

                    try {
                        expected_collections.each(function (name) {
                           
                            Mojo.require('undefined' !== typeof collections[name],
                                "Collection #{name} should exist", {name: name});

                            var result = collections[name];
                            Mojo.require(
                                'undefined' !== typeof result.count,
                                "Collection result count should be defined"
                            );
                            Mojo.require(
                                'undefined' !== typeof result.last_modified,
                                "Collection last modified should be defined"
                            );
                            Mojo.require(
                                'object' == typeof result.last_modified,
                                "Collection last modified should be a date");
                            Mojo.require(
                                'function' == typeof result.last_modified.getDate,
                                "Collection last modified should be a date"
                            );
                            Mojo.Log.error("COLLECTION %j = %j", name, result);

                        }, this);
                    } catch (e) {
                        Mojo.Log.error("ARGH %j", e);
                    }

                    chain.next();
                })
                .push(function (chain) {
                    recordResults(Mojo.Test.passed);
                })
                .next();
        },

        /**
         * Exercise listing a collection.
         */
        no_testListCollection: function (recordResults) {
            var checked_collection = Weave.TestData.checked_collection;
                chain = new Decafbad.Chain([], this);
            chain
                .push("_performLogin")
                .push(function (chain) {
                    this.api.listCollection(
                        checked_collection,
                        {},
                        chain.nextCallback(),
                        chain.errorCallback('testListCollection, listCollection')
                    );
                })
                .push(function (chain, collection_list) {
                    Mojo.Log.error("LIST %j", collection_list);
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
         *
         */
        testGetFromCollection: function (recordResults) {
            var checked_collection = Weave.TestData.checked_collection,
                object_id = null,
                objects = [],
                chain = new Decafbad.Chain([], this);
            chain
                .push("_performLogin")
                .push(function (chain) {
                    this.api.listCollection(
                        checked_collection,
                        {},
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
                            Mojo.Log.error("OBJECT %j", object);
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
