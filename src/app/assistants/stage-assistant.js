/**
 * @fileOverview Main stage assistant
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Decafbad, Weave, Mojo, $, $L, $A, $H, SimpleDateFormat */
function StageAssistant() {
}

StageAssistant.prototype = (function () { /** @lends StageAssistant# */

    return {

        setup: function() {
            this.controller.setWindowOrientation('free');
            if (AppGlobals.run_tests_at_launch) {
                Mojo.Test.pushTestScene(this.controller, { runAll: true });
            } else {
                this.controller.pushScene('home');
            }
        },

        EOF:null
    };

}());
