/**
 * @fileOverview Weave sync engine
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Mojo, Weave, Chain, Class, Ajax */
Weave.Sync = Class.create(/** @lends Weave.Sync */ {

    /**
     * Weave sync engine
     * @constructs
     * @author l.m.orchard@pobox.com
     */
    initialize: function (options) {

        this.options = Object.extend({
            "service": null
        }, options || {});

        this.silos = {
            history: new Weave.Storage.HistorySilo(),
            bookmarks: new Weave.Storage.BookmarkSilo(),
            tabs: new Weave.Storage.TabSilo()
        };

    },

    open: function (on_success, on_failure) {
        var chain = new Decafbad.Chain([], this, on_failure);
        
        $H(this.silos).each(function (pair) {
            chain.push(function (c) {
                pair.value.open(c.nextCb(), on_failure);
            });
        }, this);

        chain.push(on_success).start();
    },

    EOF:null // I hate trailing comma errors
});
