/**
 * @fileOverview Namespace for Weave.Service.Types
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

/**
 * @namespace
 */
Weave.Service.Types = { };

/**
 * Browser history entry.
 *
 * @class
 * @memberOf Weave.Service.Types
 * @augments Weave.Service.CryptoObject
 */
Weave.Service.Types.HistoryObject = Class.create(Weave.Service.CryptoObject, /** @lends Weave.Service.Types.HistoryObject */{
    version: "0.0.1",
    property_aliases: {
        histUri:    '$.payload.cleartext.0.histUri',
        title:      '$.payload.cleartext.0.title',
        visits:     '$.payload.cleartext.0.visits'
    },
    table_columns: {
        id:             'id',
        histUri:        'histUri',
        title:          'title',
        visit_count:    'visit_count',
        frecency:       'frecency',
        sortindex:      'sortindex',
        modified:       'modified',
        local_created:  'local_created',
        local_modified: 'local_modified',
    },
    get_visit_count: function () {
        var visits = this.get('$.payload.cleartext.0.visits');
        return visits ? visits.length : 0;
    },
    get_frecency: function () {
        return 0;
    },
    EOF:null
});

/**
 * Service collection of history entries.
 *
 * @class
 * @memberOf Weave.Service.Types
 * @augments Weave.Service.CryptoCollection
 */
Weave.Service.Types.HistoryCollection = Class.create(Weave.Service.CryptoCollection, /** @lends Weave.Service.Types.HistoryObject */{
    _collection_name: 'history',
    _record_type: Weave.Service.Types.HistoryObject,
    EOF:null
});

/**
 * Browser bookmark
 *
 * @class
 * @memberOf Weave.Service.Types
 * @augments Weave.Service.CryptoObject
 */
Weave.Service.Types.BookmarkObject = Class.create(Weave.Service.CryptoObject, /** @lends Weave.Service.Types.BookmarkObject */{
    /*
    _extract_map: $H({
        uuid:       'id',
        s_modified: 'modified',
        url:        'url',
        sortindex:  'sortindex',
        histUri:    '$.payload.cleartext.0.histUri',
        title:      '$.payload.cleartext.0.title',
        visits:     '$.payload.cleartext.0.visits'
    }),
    */

    EOF:null
});

/**
 * Service collection of browser bookmarks.
 *
 * @class
 * @memberOf Weave.Service.Types
 * @augments Weave.Service.CryptoCollection
 */
Weave.Service.Types.BookmarkCollection = Class.create(Weave.Service.CryptoCollection, /** @lends Weave.Service.Types.BookmarkObject */{
    _collection_name: 'bookmarks',
    _record_type: Weave.Service.Types.BookmarkObject,
    EOF:null
});

/**
 * Browser tab object
 *
 * @class
 * @memberOf Weave.Service.Types
 * @augments Weave.Service.CryptoObject
 */
Weave.Service.Types.TabObject = Class.create(Weave.Service.CryptoObject, /** @lends Weave.Service.Types.TabObject */{
    /*
    _extract_map: $H({
        uuid:       'id',
        s_modified: 'modified',
        url:        'url',
        sortindex:  'sortindex',
        histUri:    '$.payload.cleartext.0.histUri',
        title:      '$.payload.cleartext.0.title',
        visits:     '$.payload.cleartext.0.visits'
    }),
    */

    EOF:null
});

/**
 * Service collection of browser tab objects
 *
 * @class
 * @memberOf Weave.Service.Types
 * @augments Weave.Service.CryptoCollection
 */
Weave.Service.Types.TabCollection = Class.create(Weave.Service.CryptoCollection, /** @lends Weave.Service.Types.TabObject */{
    _collection_name: 'tabs',
    _record_type: Weave.Service.Types.TabObject,
    EOF:null
});
