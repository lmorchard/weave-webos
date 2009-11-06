/**
 * @fileOverview Provides the chain utility for continuation-passing.
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 *
 * Inspired by: http://en.wikipedia.org/wiki/Continuation-passing_style
 */
/*jslint laxbreak: true */
/*global Decafbad, Class, Note, Mojo, $A, $L, $H, SimpleDateFormat */
Decafbad.Chain = Class.create(/** @lends Decafbad.Chain */{

    /**
     * Chain of functions, useful in sequencing async calls.
     *
     * @constructs
     * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
     *
     * @param {array} action List of functions for chain
     * @param {object} object Object used as this scope in calls.
     */
    initialize: function(actions, object, on_error) {
        this.running  = null;
        this.actions  = actions.compact() || [];
        this.object   = object;
        this.on_error = on_error || function() {
            Mojo.Log.error("CHAIN ERROR: %j", $A(arguments));
        };

        this.use_timeout = true;

        return this;
    },

    /**
     * Push a new function onto the end of the chain.
     */
    push: function (fn) {
        this.actions.push(fn);
        return this;
    },

    /**
     * Run the next function in the chain, either directly or via setTimeout
     * depending the value of this.use_timeout.  Calls via setTimeout may
     * introduce small delays, but yield control to the browser more often
     * and prevent script interruptions and improve UI responsiveness.
     */
    next: function() {
        var args = $A(arguments),
            $this = this;
        if (this.use_timeout) {
            setTimeout(function () {
                $this._next.apply($this, args);
            }, 0);
        } else {
            return $this._next.apply($this, args);
        }
    },

    /** 
     * Real method to run the next function in the chain.
     */
    _next: function()  {

        if (!this.actions.length) {
            // Stop when we're out of actions.
            return false;
        }

        var action = this.actions.shift(),
            args = $A(arguments);

        // Insert the chain object in front of the arguments for next(), all of
        // which will be passed to the next chain step.
        args.unshift(this);

        try {
            if (typeof action == 'string') {
                // Accept a method of the context object by name as string.
                if (this.object && typeof this.object[action] == 'function') {
                    this.object[action].apply(this.object, args);
                } else {
                    this.on_error('unknown method');
                }
            } else if (typeof action == 'function') {
                // Accept a function, bind to the context object if supplied.
                if (this.object) {
                    action.apply(this.object, args);
                } else {
                    action.apply(this, args);
                }
            }
        } catch(e) {
            if (typeof Mojo.Log.logException != 'undefined') {
                Mojo.Log.logException(e);
            }
            this.on_error(e);
        }

        return this;
    },

    /**
     * Alias for the next() method.
     */
    start: function () {
        return this.next();
    },

    /**
     * Generate a callback for the .next() method.  
     *
     * Any parameters supplied to this method are passed to next() when the
     * callback is called, followed by any parameters supplied to the callback. 
     */
    nextCallback: function () {
        var args  = $A(arguments),
            $this = this;
        return function () {
            $this.next.apply($this, args.concat($A(arguments)));
        };
    },

    /**
     * Generate a bound callback for the on_error method.
     *
     * Any parameters supplied to this method are passed to on_error when the
     * callback is called, followed by any parameters supplied to the callback. 
     */
    errorCallback: function () {
        var args  = $A(arguments),
            $this = this;
        return function () {
            $this.on_error.apply($this, args.concat($A(arguments)));
        };
    }

});
