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
 * Local database storage of history entries.
 *
 * @class
 * @augments Decafbad.Silo
 */
Weave.Storage.HistorySilo = Class.create(Decafbad.Silo, /** @lends Weave.Storage.HistorySilo */ {
    db_name: 'weave',
    table_name: 'weave_history',
    row_class: Weave.Service.Types.HistoryObject,
    EOF:null
});

/**
 * Local database storage of bookmark entries.
 *
 * @class
 * @augments Decafbad.Silo
 */
Weave.Storage.BookmarkSilo = Class.create(Decafbad.Silo, /** @lends Weave.Storage.BookmarkSilo */ {
    db_name: 'weave',
    table_name: 'weave_bookmarks',
    row_class: Weave.Service.Types.BookmarkObject,
    EOF:null
});

/**
 * Local database storage of browser tabs.
 *
 * @class
 * @augments Decafbad.Silo
 */
Weave.Storage.TabSilo = Class.create(Decafbad.Silo, /** @lends Weave.Storage.TabSilo */ {
    db_name: 'weave',
    table_name: 'weave_tabs',
    row_class: Weave.Service.Types.TabObject,
    EOF:null
});
