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
        visit_count:    ['visit_count', 'NUMERIC'],
        frecency:       ['frecency', 'NUMERIC'],
        sortindex:      ['sortindex', 'NUMERIC'],
        modified:       ['modified', 'NUMERIC'],
        local_created:  ['local_created', 'NUMERIC'],
        local_modified: ['local_modified', 'NUMERIC']
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
    version: "0.0.1",
    property_aliases: {
        bmkUri: '$.payload.cleartext.0.bmkUri',
        title:  '$.payload.cleartext.0.title',
        type:   '$.payload.cleartext.0.type', 
        visits: '$.payload.cleartext.0.visits',
        tags:   '$.payload.cleartext.0.tags'
    },
    table_columns: {
        id:             'id',
        parentid:       'parentid',
        predecessorid:  'predecessorid',
        bmkUri:         'bmkUri',
        title:          'title',
        type:           'type',
        sortindex:      ['sortindex', 'NUMERIC'],
        modified:       ['modified', 'NUMERIC'],
        local_created:  ['local_created', 'NUMERIC'],
        local_modified: ['local_modified', 'NUMERIC']
    },
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
    version: "0.0.1",
    property_aliases: {
        clientName: '$.payload.cleartext.0.clientName',
        tabs:       '$.payload.cleartext.0.tabs'
    },
    table_columns: {
        id:             'id',
        clientName:     'clientName',
        sortindex:      ['sortindex', 'NUMERIC'],
        modified:       ['modified', 'NUMERIC'],
        local_created:  ['local_created', 'NUMERIC'],
        local_modified: ['local_modified', 'NUMERIC']
    },
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
