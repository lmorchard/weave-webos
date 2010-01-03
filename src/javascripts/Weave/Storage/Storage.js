/**
 * @fileOverview Local silo storage for Weave data
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

/**
 * @namespace
 */
Weave.Storage = {};

/**
 * Weave customizations to Decafbad.Silo
 *
 * @class
 * @augments Decafbad.Silo
 */
Weave.Storage.Silo = Class.create(Decafbad.Silo, /** @lends Weave.Storage.Silo */ {

    /**
     * Fetch the last modified time from the silo.
     *
     * @param {function} on_success Callback on success
     * @param {function} on_failure Callback on failure
     */
    getLastModified: function (on_success, on_failure) {
        this.db.transaction(function (tx) {
            tx.executeSql(
                'SELECT MAX(modified) AS last_modified FROM ' + this.table_name,
                [],
                function (tx, rs) {
                    on_success(rs.rows.item(0).last_modified);
                },
                on_failure
            );
        }.bind(this), on_failure);
    },

    EOF:null
});

/**
 * Local database storage of history entries.
 *
 * @class
 * @augments Weave.Storage.Silo
 */
Weave.Storage.HistorySilo = Class.create(Weave.Storage.Silo, /** @lends Weave.Storage.HistorySilo */ {
    db_name: 'weave',
    table_name: 'weave_history',
    row_class: Weave.Service.Types.HistoryObject,
    EOF:null
});

/**
 * Local database storage of bookmark entries.
 *
 * @class
 * @augments Weave.Storage.Silo
 */
Weave.Storage.BookmarkSilo = Class.create(Weave.Storage.Silo, /** @lends Weave.Storage.BookmarkSilo */ {
    db_name: 'weave',
    table_name: 'weave_bookmarks',
    row_class: Weave.Service.Types.BookmarkObject,
    EOF:null
});

/**
 * Local database storage of browser tabs.
 *
 * @class
 * @augments Weave.Storage.Silo
 */
Weave.Storage.TabSilo = Class.create(Weave.Storage.Silo, /** @lends Weave.Storage.TabSilo */ {
    db_name: 'weave',
    table_name: 'weave_tabs',
    row_class: Weave.Service.Types.TabObject,
    EOF:null
});
