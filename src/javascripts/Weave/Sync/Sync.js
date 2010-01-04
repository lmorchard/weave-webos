/**
 * @fileOverview Weave sync engine
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

/** @namespace */
Weave.Sync = {};

/**
 * @class
 */
Weave.Sync.Manager = Class.create({

    running: false,

    /**
     * @constructs
     */
    initialize: function (options) {
        this.options = Object.extend({
            service: null,
            chunk_size: 50,
            max_history: 1 * 24 * 60 * 60
        }, options || {});

        this.service = this.options.service;

        this.silos = {
            history: new Weave.Storage.HistorySilo(),
            bookmarks: new Weave.Storage.BookmarkSilo(),
            tabs: new Weave.Storage.TabSilo()
        };
        
        this.states = new Weave.Sync.StateSilo();
        this.tasks = new Weave.Sync.TaskSilo();
    },

    /**
     * Open all silos and prepare this sync manager for work.
     *
     * @param {function} on_success Callback on success
     * @param {function} on_failure Callback on failure
     */
    open: function (on_success, on_failure) {
        var chain = new Decafbad.Chain([
            function (ch) { this.states.open(ch.nextCb(), ch.errorCb()); },
            function (ch) { this.tasks.open(ch.nextCb(), ch.errorCb()); }
        ], this, on_failure);
        Object.keys(this.silos).each(function (name) {
            chain.push(function (ch) {
                this.silos[name].open(ch.nextCb(), ch.errorCb());
            });
        }, this);
        chain.push(on_success).start();
    },

    /**
     * Reset all silos.
     *
     * @param {function} on_success Callback on success
     * @param {function} on_failure Callback on failure
     */
    resetAll: function (on_success, on_failure) {
        var chain = new Decafbad.Chain([
            function (ch) { this.states.resetAll(ch.nextCb(), ch.errorCb()); },
            function (ch) { this.tasks.resetAll(ch.nextCb(), ch.errorCb()); }
        ], this, on_failure);
        Object.keys(this.silos).each(function (name) {
            chain.push(function (ch) {
                this.silos[name].resetAll(ch.nextCb(), ch.errorCb());
            });
        }, this);
        chain.push(on_success).start();
    },

    /**
     *
     */
    on_progress: function (msg) {
        dojo.publish('/weave/sync/progress', [ msg ]);
    },

    /**
     * Check a collection for items in need of sync, queue up tasks if
     * necessary.
     *
     * @param {string}   collection_name Collection to check
     * @param {function} on_success      Callback on success
     * @param {function} on_failure      Callback on failure
     */
    check: function (collection_name, on_success, on_failure) {
        var g = {};

        var chain = new Decafbad.Chain([
            function (ch) {
                // Try to find the sync state for this collection.
                this.states.find(collection_name, ch.nextCb(), ch.errorCb());
            },
            function (ch, state) {
                // If no state found, create a new one.
                g.state = (state) ? state : 
                    this.states.factory({ id: collection_name });
                // Look for collections to get a last modified date.
                this.service.listAllCollections(ch.nextCb(), ch.errorCb());
            },
            function (ch, collections) {
                // Grab the sync last-checked and collection last-modified
                g.last_checked = g.state.get('last_checked');
                g.last_modified = collections[collection_name];

                if (g.last_checked && g.last_checked < g.last_modified) {
                    // There was a last-checked time and the collection has
                    // been modified since then.
                    this.on_progress("Seeking from last checked");
                    return ch.next(g.last_checked);
                }
                if (!this.options.max_history) {
                    // There's no max history period, so sync everything.
                    this.on_progress("Seeking all items");
                    return ch.next(null);
                }
                // There is a max history period, so just look for everything
                // within that max period back from last modified.
                this.on_progress("Seeking max history items");
                ch.next(g.last_modified - this.options.max_history);
            },
            function (ch, newer_than) {
                // Look for IDs in order of importance, newer than the time
                // derived in the previous step.
                this.service.collections[collection_name].list({
                    sort: 'index', newer: newer_than
                }, ch.nextCb(), ch.errorCb());
            },
            function (ch, need_ids) {
                this.on_progress("Found " + need_ids.length + " " + 
                    collection_name + " items to sync.");

                // Divide the fetched IDs into chunks.
                var chunk_size = this.options.chunk_size,
                    chunks = [];
                for (var i=0, l=need_ids.length; i<l; i+=chunk_size) {
                    chunks.push( need_ids.slice(i, i+chunk_size) );
                }

                // Queue up the generation of a batch of tasks for each 
                // of the chunks.
                var s_ch = new Decafbad.Chain([], this, ch.errorCb()),
                    batch_uuid = Math.uuid(),
                    total_chunks = chunks.length,
                    created = (new Date()).getTime() / 1000;

                chunks.each(function (chunk, idx) {
                    s_ch.push(function (s_ch) {
                        this.tasks.factory({
                            batch_uuid: batch_uuid,
                            batch_index: idx,
                            batch_total: total_chunks,
                            batch_created: created,
                            collection_name: collection_name,
                            chunk: chunk,
                            processed: null
                        }).save(s_ch.nextCb(), s_ch.errorCb());
                    });
                }, this);

                // Fire up the task generation.
                s_ch.push(ch.nextCb()).start();
            },
            function (ch) {
                // All done!
                on_success();
            }
        ], this, on_failure).start();
    },

    /**
     * Fetch and process one sync task.
     *
     * TODO: Extract this into a general task queue utility?
     * TODO: Explode this out into per-collection classes for customization?
     *
     * @param {function} on_success Callback on success
     * @param {function} on_failure Callback on failure
     */
    step: function (on_success, on_failure) {
        var g = {};
        var ch = new Decafbad.Chain([
            function (ch) {
                // Look for the newest unprocessed task.
                // NOTE: That means this task queue is LIFO!
                this.tasks.query(
                    [ 'WHERE processed IS null', 
                        'ORDER BY batch_created DESC, batch_index ASC LIMIT 1' ], [],
                    ch.nextCb(), ch.errorCb()
                );
            },
            function (ch, results) {
                // If there are no tasks fetched, yield queue empty.
                if (!results.length) { return on_success(false); }

                // Get the task, extract the chunk and collection name.
                g.task = results.shift();
                g.chunk = g.task.get('chunk');
                g.collection_name = g.task.get('collection_name');

                // Now, grab full items for the chunk.
                this.service.collections[g.collection_name].list({
                    full: true, ids: g.chunk
                }, ch.nextCb(), ch.errorCb());
            },
            function (ch, results) {
                // Got the full items, now save them to the silo.
                this.on_progress("Downloaded " + results.length + " " + 
                    g.collection_name + " items");
                this.silos[g.collection_name].save(
                    results, ch.nextCb(), ch.errorCb()
                );
            },
            function (ch, saved) {
                this.on_progress("Saved " + saved.length + " " + 
                    g.collection_name + " items");

                // Report on batch progress.
                var uuid  = g.task.get('batch_uuid'),
                    index = g.task.get('batch_index'),
                    total = g.task.get('batch_total');
                this.on_progress("Processed " + (index+1) + "/" + total + 
                    " (" + uuid + ")");

                // The task is complete, so mark it processed.
                g.task.set('processed', (new Date()).getTime());
                g.task.save(ch.nextCb(), ch.errorCb());
            },
            function (ch) {
                on_success(true);
            }
        ], this, on_failure).start();
    },

    /**
     * Start task queue running.
     */
    start: function () {
        this.running = true;
        this._runLoop();
    },

    /**
     * Stop the task queue after completion of the next task, if any.
     */
    stop: function () {
        this.running = false;
    },

    /**
     * Main task processing run-loop, calls this.step() until exhausted. Calls
     * itself via setTimeout() while this.running is true.
     */
    _runLoop: function () {
        this.step(
            function (more) { 
                if (!more) {
                    return dojo.publish('/weave/sync/finished');
                } else if (!this.running) {
                    return dojo.publish('/weave/sync/stopped');
                } else {
                    setTimeout(this._runLoop.bind(this), 0.1);
                    return dojo.publish('/weave/sync/running');
                }
            }.bind(this),
            function () { 
                return dojo.publish('/weave/sync/failed');
            }.bind(this)
        );
    },

    EOF:null
});

/**
 * Silo of sync state recordkeeping objects.
 */
Weave.Sync.StateSilo = Class.create(Decafbad.Silo, 
    /** @lends Weave.Sync.StateSilo */ {
    table_name: 'weave_sync_state',
    row_class: Weave.Sync.State = Class.create(Decafbad.SiloObject, 
        /** @lends Weave.Sync.State */ {
        table_columns: {
            id: 'id',
            last_checked: ['last_checked', 'NUMERIC'],
            created: ['created', 'NUMERIC'],
            modified: ['modified', 'NUMERIC']
        }
    })
});

/**
 * Silo of pending sync tasks.
 */
Weave.Sync.TaskSilo = Class.create(Decafbad.Silo, 
    /** @lends Weave.Sync.TaskSilo */ {
    table_name: 'weave_sync_tasks',
    row_class: Weave.Sync.Task = Class.create(Decafbad.SiloObject, 
        /** @lends Weave.Sync.Task */ {
        version: '0.0.1',         
        table_columns: {
            collection_name: 'collection_name',
            batch_uuid: 'batch_uuid',
            batch_index:   ['batch_index', 'NUMERIC'],
            batch_total:   ['batch_total', 'NUMERIC'],
            batch_created: ['batch_created', 'NUMERIC'],
            processed:     ['processed', 'NUMERIC'],
            created:       ['created', 'NUMERIC'],
            modified:      ['modified', 'NUMERIC']
        }
    })
});
