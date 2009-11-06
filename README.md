# weave-webos

## What?

This is an attempt at a [Mozilla Weave][1] client for webOS

[1]: http://labs.mozilla.com/projects/weave/

Someday, I'd like it to do things such as:

* Bring the Firefox Awesome Bar to webOS.
* Access bookmarks / history / tabs from the desktop
* Sync / store other random data (eg. contacts? notes?) from webOS apps.

## How?

Presently, it's all just tests.  To play, make a copy of 
`src/javascripts/Weave/TestData.js-dist` as 
`src/javascripts/Weave/TestData.js` and edit it to reflect
your Weave account details.  The tests are all read-only
right now, too, so hopefully no worries about this munching
all your data.  But, as always, it's wise to mount a 
scratch monkey.

Then, in a properly-configured webOS dev environment with the 
emulator running on Mac OS X, try running `make tests`.  If 
you're not on Mac OS X, things should work with some more effort.

## Who?

* l.m.orchard - <http://decafbad.com> - <mailto:l.m.orchard@pobox.com>
