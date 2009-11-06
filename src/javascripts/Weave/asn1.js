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
 * The Original Code is PKCS1 Parser.
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

Weave.Crypto.ASN1 = function() {
  /* ASN.1 Tags */
  var INT = 0x02;
  var OCT = 0x04;
  var OBJ = 0x06;
  var SEQ = 0x10;
  
  /* Global data & offset */
  var dat;
  var off;
  
  /* Parse tag */
  function _parseTag() {
    var tag = dat.charCodeAt(off);
    /* Only bits 1-5 represent actual value */
    tag = tag & 0x1f;
    switch (tag) {
      case INT:
      case OCT:
      case OBJ:
      case SEQ:
        off += 1;
        return tag;
      default:
        return false;
    }
  }
  
  /* Parse length */
  function _parseLength() {
    /* Bit 8 tells us if length is one octet or more */
    var len = dat.charCodeAt(off);
    var det = len & 0x80;

    if (!det) {
      /* 1 octet length, bits 1-7 give us length */
      off += 1;
      return len & 0x7f;
    } else {
      /* Multi-octet length, bits 1-7 give us number of octets */
      var bytes = len & 0x7f;
      var value = '';
      for (var i = 0; i < bytes; i++) {
        off += 1;
        var cur = dat.charCodeAt(off);
        var hex = cur.toString(16);
        if (hex.length == 1) {
          hex = '0' + hex;
        }
        value += hex;
      }
      off += 1;
      var len = parseInt(value, 16);
      return len;
    }
  }
  
  function _getInteger() {
    var tag = _parseTag();
    if (tag != INT) {
      return false;
    }

    var ret = '';
    var len = _parseLength();
    var val = dat.slice(off, off + len);
    
    for (var i = 0; i < val.length; i++) {
      var cur = val.charCodeAt(i);
      var hex = cur.toString(16);
      if (hex.length == 1) {
        hex = '0' + hex;
      }
      ret += hex;
    }
    off += len;

    return ret;
  }
  
  return {
    TAG_INT: INT,
    TAG_OCT: OCT,
    TAG_OBJ: OBJ,
    TAG_SEQ: SEQ,
    
    begin: function(data) {
      off = 0;
      dat = data;
      return this;
    },
    
    setOffset: function(offset) {
      off = offset;
    },
    
    getOffset: function() {
      return off;
    },
    
    getTag: _parseTag,
    getLength: _parseLength,
    getInteger: _getInteger
  };
}();

Weave.Crypto.ASN1.PKCS1 = function() {
  
  function _extractRSA(data) {
    var asn1 = Weave.Crypto.ASN1.begin(data);
    
    /* First tag should be SEQUENCE */
    var fseq = asn1.getTag();
    if (fseq != asn1.TAG_SEQ) {
      return false;
    }
    
    /* Next tag is an INTEGER identifying version which must be 0 */
    asn1.setOffset(4);
    var vtag = asn1.getTag();
    if (vtag != asn1.TAG_INT) {
      return false;
    }
    var vlen = asn1.getLength();
    if (vlen != 1) {
      return false;
    }
    var coff = asn1.getOffset();
    var vers = data.charCodeAt(coff);
    if (vers != 0) {
      return false;
    }
    
    /* Now, extract RSA integer components */
    asn1.setOffset(coff + 1);
    var N = asn1.getInteger();
    var E = asn1.getInteger();
    var D = asn1.getInteger();
    var P = asn1.getInteger();
    var Q = asn1.getInteger();
    var dP = asn1.getInteger();
    var dQ = asn1.getInteger();
    var C = asn1.getInteger();
    
    return [N, E, D, P, Q, dP, dQ, C];
  }
  
  function _parsePKCS1(data) {
    var asn1 = Weave.Crypto.ASN1.begin(data);
    
    /* Check if first tag is SEQUENCE */
    var bseq = asn1.getTag();
    if (bseq != asn1.TAG_SEQ) {
      return false;
    }
    
    /* RSA OID is always at offset 9 */
    asn1.setOffset(9);
    var roid = asn1.getTag();
    if (roid != asn1.TAG_OBJ)
      return false;
    /* And length of OID is always 9 */
    var rlen = asn1.getLength();
    if (rlen != 9) {
      return false;
    }
    
    /* Finally the Octet string starts at 22 */
    asn1.setOffset(22);
    var ocst = asn1.getTag();
    if (ocst != asn1.TAG_OCT) {
      return false;
    }
    var olen = asn1.getLength();
    var from = asn1.getOffset();

    /* Return the RSA values */
    return _extractRSA(data.slice(from, from + olen));
  }
  
  return {
    parse: _parsePKCS1
  };
  
}();