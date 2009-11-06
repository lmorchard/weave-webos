/**
 * @fileOverview App assistant
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
function AppAssistant(app_controller) {
}

AppAssistant.prototype = (function() {

    /** @lends AppAssistant# */ 
    return {

        setup: function() {
        },

        handleLaunch: function(launch_params) {
            AppGlobals.init(launch_params);
        },

        handleCommand: function(event) {
        }

    };

}());
