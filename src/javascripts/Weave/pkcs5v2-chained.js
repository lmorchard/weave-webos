/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is PKCS5v2 Key Generator.
 *
 * The Initial Developer of the Original Code is Anant Narayanan.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Anant Narayanan <anant@kix.in>
 *  l.m.orchard <l.m.orchard@pobox.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
/*jslint laxbreak: true */
/*global Weave, Decafbad*/

Weave.Crypto.PKCS5_Chained = function() {
    var chunk_size = 300;

    /* For HMAC-SHA-1 */
    var hLen = 20;

    /* Pseudorandom PRF, we use HMAC-SHA-1 */
    function _PRF(k, d) {
        return Weave.Util.SHA1.hmac(k, d, 3);
    }

    function _F(P, S, c, i, on_success, on_failure) {
        var chain = new Decafbad.Chain([], this, on_failure),
            ret,
            U = [], 
            I = [];

        /* Encode i into 4 octets: _INT */
        I[0] = String.fromCharCode((i >> 24) & 0xff);
        I[1] = String.fromCharCode((i >> 16) & 0xff);
        I[2] = String.fromCharCode((i >> 8) & 0xff);
        I[3] = String.fromCharCode(i & 0xff);

        U[0] = _PRF(P, S + I.join(''));

        for (var j = 1; j < c; j+=chunk_size) {
            chain.push((function (j, chain) {
                Mojo.Log.error("_PRF chunk %s", j);
                var end = Math.min( j + chunk_size, c );
                for (var j1 = j; j1 < end; j1++) {
                    U[j1] = _PRF(P, U[j1 - 1]);
                }
                chain.next();
            }).curry(j));
        }

        chain.push(function (chain) {
            ret = U[0]; 
            chain.next();
        });

        for (j = 1; j < c; j+=chunk_size) {
            chain.push((function (j, chain) {
                Mojo.Log.error("_ATS chunk %s", j);
                var end = Math.min( j + chunk_size, c );
                for (var j1 = j; j1 < end; j1++) {
                    ret = Weave.Util.AtS(Weave.Util.XOR(ret, U[j1]));
                }
                chain.next();
            }).curry(j));
        }

        chain.push(function (chain) {
            on_success(ret);
        });

        chain.start();
    }

    /* PKCS #5, v2.0 pp. 9-10 */
    function _pkcs5Generator(P, S, c, dkLen, on_success, on_failure) {
        var chain = new Decafbad.Chain([], this, on_failure),
            l = Math.ceil(dkLen / hLen),
            r = dkLen - ((l - 1) * hLen),
            T = [],
            ret = '';

        for (var i = 0; i < l; i++) {
            chain.push((function (i, chain) {
                Mojo.Log.error("_F(%s)", i);
                _F(
                    P, S, c, i + 1, 
                    function (val) { T[i] = val; chain.next(); }, 
                    on_failure
                );
            }).curry(i));
        }

        chain.push(function () {
            for (i = 0; i < l - 1; i++) {
                ret += T[i];
            }
            ret += T[l - 1].substr(0, r);
            on_success(ret);
        });

        chain.start();
    }

    return {
        generate: _pkcs5Generator
    };

}();
