/**
 * @fileOverview History collection type
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */

/**
 *
 * @class
 * @augments Weave.Service.CryptoObject
 */
Weave.Service.Types.HistoryObject = Class.create(Weave.Service.CryptoObject, /** @lends Weave.Service.Types.HistoryObject */{
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
 *
 * @class
 * @augments Weave.Service.CryptoCollection
 */
Weave.Service.Types.HistoryCollection = Class.create(Weave.Service.CryptoCollection, /** @lends Weave.Service.Types.HistoryObject */{
    _collection_name: 'history',
    _record_type: Weave.Service.Types.HistoryObject,
    EOF:null
});
