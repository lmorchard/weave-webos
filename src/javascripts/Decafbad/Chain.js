/**
 * @fileOverview Provides a chain utility for continuation-passing.
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
    initialize: function(actions, object, on_error, options) {
        
        this.options = Object.extend({
            use_timeouts: true
        }, options || {});

        this.running  = null;
        this.actions  = actions.compact() || [];
        this.object   = object;

        this.on_error = on_error || function() {
            Mojo.Log.error("CHAIN ERROR: %j", $A(arguments));
        };

        return this;
    },

    /**
     * Push a new function onto the end of the chain.
     */
    push: function (fn) {
        if ('string' == typeof fn || 'function' == typeof fn) {
            this.actions.push(fn);
        } else {
            $A(fn).each(function (sub_fn) {
                this.actions.push(sub_fn);
            }, this);
        }
        return this;
    },

    /**
     * Signal an error, aborting the rest of the chain.
     */
    error: function() {
        var args = $A(arguments);

        this.actions = [];

        var fn = (function () {
            if (this.object) {
                this.on_error.apply(this.object, args);
            } else {
                this.on_error.apply(this, args);
            }
        }).bind(this);
        
        if (this.options.use_timeouts) {
            // Use a zero-timeout to escape the call stack and yield to OS.
            setTimeout(fn, 0);
        } else {
            // Use a direct call.
            fn();
        }

        return this;
    },

    /** 
     * Run the next function in the chain.
     */
    next: function()  {

        if (!this.actions.length) {
            // Stop when we're out of functiona.
            return false;
        }

        var action = this.actions.shift(),
            args = $A(arguments);

        // Use a zero-timeout to escape the call stack and yield to OS.
        var fn = (function () {

            // Insert the chain object in front of the arguments for next(), all of
            // which will be passed to the next chain step.
            args.unshift(this);

            try {
                if (typeof action == 'string') {
                    // Accept a method of the context object by name as string.
                    if (this.object && typeof this.object[action] == 'function') {
                        this.object[action].apply(this.object, args);
                    } else {
                        this.error('unknown method ' + action);
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
                this.error(e);
            }

        }).bind(this);

        this.redo = fn;

        if (this.options.use_timeouts) {
            // Use a zero-timeout to escape the call stack and yield to OS.
            setTimeout(fn, 0);
        } else {
            // Use a direct call.
            fn();
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
            $this.error.apply($this, args.concat($A(arguments)));
        };
    }

});
