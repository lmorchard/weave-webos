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

Weave.Crypto.PKCS5 = function() {
  /* For HMAC-SHA-1 */
  var hLen = 20;
  
  /* Pseudorandom PRF, we use HMAC-SHA-1 */
  function _PRF(k, d) {
    return Weave.Util.SHA1.hmac(k, d, 3);
  }
  
  function _F(P, S, c, i) {
    var ret;
    var U = [];

    /* Encode i into 4 octets: _INT */
    var I = [];
    I[0] = String.fromCharCode((i >> 24) & 0xff);
    I[1] = String.fromCharCode((i >> 16) & 0xff);
    I[2] = String.fromCharCode((i >> 8) & 0xff);
    I[3] = String.fromCharCode(i & 0xff);

    U[0] = _PRF(P, S + I.join(''));
    for (var j = 1; j < c; j++) {
      U[j] = _PRF(P, U[j - 1]);
    }

    ret = U[0];
    for (j = 1; j < c; j++) {
      ret = Weave.Util.AtS(Weave.Util.XOR(ret, U[j]));
    }

    return ret;
  }

  /* PKCS #5, v2.0 pp. 9-10 */
  function _pkcs5Generator(P, S, c, dkLen) {
    var l = Math.ceil(dkLen / hLen);
    var r = dkLen - ((l - 1) * hLen);

    T = [];
    for (var i = 0; i < l; i++) {
      T[i] = _F(P, S, c, i + 1);
    }

    var ret = '';
    for (i = 0; i < l - 1; i++) {
      ret += T[i];
    }
    ret += T[l - 1].substr(0, r);

    return ret;
  }

  return {
    generate: _pkcs5Generator
  };

}();
