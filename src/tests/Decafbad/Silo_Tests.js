/**
 * @fileOverview Tests for Decafbad.API
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Decafbad, Chain, Class, Ajax */
function Decafbad_Silo_Tests(tickleFunction) {
    this.initialize(tickleFunction);
}

Decafbad_Silo_Tests.timeoutInterval = 5000;

Decafbad_Silo_Tests.prototype = (function () {

    var TestSilo = Class.create(Decafbad.Silo, {
        db_name: 'tests',
        table_name: 'test_objects',
        meta_table_name: 'test_silo_meta',
        row_class: Class.create(Decafbad.SiloObject, {
            version: "1.0.1",
            table_columns: { 
                'uuid':     'uuid', 
                'name':     'name',
                'age':      'age',
                'address':  'address',
                'created':  'created', 
                'modified': 'modified' 
            }
        })
    });

    var test_data = {
        cols: [ 'name', 'age', 'address', 'profession', 'pets' ],
        rows: [
            [ 'John Smith', '34', '123 Any St',     'writer', 
                { dog: 1, cat: 1, hamster: 1 } ],
            [ 'Mike Brown', '12', '223 Another St', 'kid', 
                { dog: 1 } ],
            [ 'Jill Joy',   '54', '999 Test Rd.',   'executive' , 
                { cat: 1, parakeet: 1 } ]
        ]
    };

    var test_objects = test_data.rows.map(function (row) {
        var obj = {};
        test_data.cols.each(function (name, idx) {
            obj[name] = row[idx];
        });
        return obj;
    });

    return /** @lends Decafbad_Silo_Tests */ {

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

        },

        /**
         * Exercise opening the silo and verify version
         */
        testOpenAndVersion: function (recordResults) {
            Mojo.log('testOpen');

            var $this = this, 
                chain = new Decafbad.Chain([], this, function () {
                    Mojo.Log.error("Failed! %j", $A(arguments));
                });

            this.silo = new TestSilo();

            chain.push([
                '_resetAndOpen',
                function (chain) {
                    // Ensure the silo table version is as expected.
                    this.silo.db.transaction(function (tx) {
                        $this.silo.getTableVersion(
                            tx,
                            function (tx, version) {
                                Mojo.log("Table version = %s", version);
                                Mojo.requireEqual(
                                    this.silo.row_class.prototype.version, 
                                    version
                                );
                                chain.next();
                            }.bind(this), 
                            chain.errorCallback()
                        );
                    }.bind(this));
                },
                function (chain) { recordResults(Mojo.Test.passed); }
            ]).next();
        },

        /**
         * Exercise simple object saving and find
         */
        testSaveFindQuery: function (recordResults) {
            Mojo.log('testSave');

            var $this = this, 
                chain = new Decafbad.Chain([], this, function () {
                    Mojo.Log.error("Failed! %j", $A(arguments));
                    return false;
                }),
                saved_objects = [];

            this.silo = new TestSilo();
            
            chain.push(this._resetAndOpen);

            $A(test_objects).each(function (obj_data) {
                chain.push([
                    function (chain) {
                        Mojo.log("Saving %j", obj_data);
                        var obj = this.silo.factory(obj_data);
                        obj.save(chain.nextCallback(), chain.errorCallback());
                    },
                    function (chain, saved_obj) {
                        Mojo.log("Saved %j", saved_obj.toObject());
                        Mojo.require(null !== saved_obj.get('id'), 
                            'ID should be defined');
                        this.silo.find(
                            saved_obj.get('id'), 
                            chain.nextCallback(saved_obj), 
                            chain.errorCallback()
                        );
                    },
                    function (chain, saved_obj, found_obj) {
                        Mojo.log("Found (id) %j", found_obj.toObject());
                        Mojo.require(
                            null !== found_obj,
                            "An object for id %s should have been found", 
                            saved_obj.get('id')
                        );
                        this.silo.find(
                            { uuid: saved_obj.get('uuid') },
                            chain.nextCallback(saved_obj, found_obj),
                            chain.errorCallback()
                        );
                    },
                    function (chain, saved_obj, id_found_obj, uuid_found_objs) {
                        Mojo.require(
                            1 === uuid_found_objs.length,
                            "There should be one object found by UUID"
                        );
                        var uuid_found_obj = uuid_found_objs[0];
                        Mojo.log("Found (uuid) %j", uuid_found_obj.toObject());

                        Mojo.requireEqual(
                            saved_obj.get('uuid'), uuid_found_obj.get('uuid'),
                            "UUIDs should match"
                        );

                        // Compare most of the properties of each saved or found
                        // object to the original object data.
                        [saved_obj,id_found_obj,uuid_found_obj].each(function (obj) {
                            Object.keys(obj_data).each(function (name) {
                                if ('object' == typeof obj_data[name]) { return; }
                                Mojo.requireEqual(
                                    obj_data[name], obj.get(name)
                                );
                            });
                        });

                        // Delay 1.25 sec before update, to force changed mod time.
                        setTimeout(function () { chain.next(saved_obj); }, 1250);
                    },
                    function (chain, saved_obj) {
                        // Tickle the timer to prevent test timeout.
                        this.tickleFunction();

                        var orig_modified = saved_obj.modified;
                        saved_obj.set('name', saved_obj.get('name') + ' esq.');
                        saved_obj.get('pets').salamander = 1;
                        saved_obj.save(chain.nextCallback(orig_modified), 
                            chain.errorCallback());
                    },
                    function (chain, orig_modified, saved_obj) {
                        this.silo.find(
                            saved_obj.get('id'), 
                            chain.nextCallback(orig_modified, saved_obj), 
                            chain.errorCallback()
                        );
                    },
                    function (chain, orig_modified, saved_obj, found_obj2) {
                        Mojo.log("Modified %j", found_obj2.toObject());
                        // Make sure the properties changed.
                        Mojo.requireEqual(
                            saved_obj.get('name'), found_obj2.get('name')
                        );
                        Mojo.requireEqual(1, found_obj2.get('pets').salamander);
                        // Make sure the modified date changed.
                        Mojo.require(orig_modified !== found_obj2.get('modified'));
                        Mojo.require(
                            found_obj2.get('modified') !== found_obj2.get('created')
                        );
                        chain.next();
                    },
                ]);
            });

            chain.push([
                function (chain) {
                    Mojo.log("Querying for age > 12");
                    this.silo.query(
                        [ 'WHERE age > ?' ], [12],
                        chain.nextCallback(), chain.errorCallback()
                    );
                },
                function (chain, result_objs) {
                    Mojo.requireEqual(2, result_objs.length);
                    result_objs.each(function (obj) {
                        Mojo.require(obj.get('age') > 12);
                    });

                    Mojo.log("Querying for name in set");
                    this.silo.query(
                        [ 'WHERE name IN (?,?)'], 
                        [ "Mike Brown esq.", "John Smith esq." ],
                        chain.nextCallback(), chain.errorCallback()
                    );
                },
                function (chain, result_objs) {
                    Mojo.requireDefined(result_objs);
                    Mojo.requireEqual(2, result_objs.length);
                    result_objs.each(function (obj) {
                        Mojo.log("Found name %s", obj.get('name'));
                        Mojo.require(
                            "Mike Brown esq." === obj.get('name') ||
                            "John Smith esq." === obj.get('name')
                        );
                    });
                    chain.next();
                },
                function (chain) { 
                    // Everything passed, so yay.
                    recordResults(Mojo.Test.passed); 
                }
            ]);

            // Fire it up
            chain.next();
        },

        /**
         * Reset the DB and open it.
         */
        _resetAndOpen: function (chain) {
            Mojo.log("Resetting.");
            this.silo.resetAll(
                function () {
                    Mojo.log("Opening.");
                    this.silo.open(chain.nextCallback(), chain.errorCallback());
                }.bind(this),
                chain.errorCallback()
            );
        },

        EOF:null // I hate trailing comma errors
    };
}());
