/*
 * WeaveClient Utility functions. This must be the first file to be included
 * because it defines the global objects.
 */
var Weave = {
  Util: {},
  Crypto: {}
};

Weave.Util = function() {
  function _XOR(a, b, isA) {
    if (a.length != b.length) {
      return false;
    }
    
    var val = [];
    for (var i = 0; i < a.length; i++) {
      if (isA) {
        val[i] = a[i] ^ b[i];
      } else {
        val[i] = a.charCodeAt(i) ^ b.charCodeAt(i);
      }
    }
    
    return val;
  }
  
  function _stringToHex(str) {
    var ret = '';
    for (var i = 0; i < str.length; i++) {
      var num = str.charCodeAt(i);
      var hex = num.toString(16);
      if (hex.length == 1) {
        hex = '0' + hex;
      }
      ret += hex;
    }
    return ret;
  }
  
  function _hexToString(hex) {
    var ret = '';
    if (hex.length % 2 != 0) {
      return false;
    }
    
    for (var i = 0; i < hex.length; i += 2) {
      var cur = hex[i] + hex[i + 1];
      ret += String.fromCharCode(parseInt(cur, 16));
    }
    return ret;
  }
  
  function _arrayToString(arr) {
    var ret = '';
    for (var i = 0; i < arr.length; i++) {
      ret += String.fromCharCode(arr[i]);
    }
    return ret;
  }

  function _stringToArray(str) {
    var ret = [];
    for (var i = 0; i < str.length; i++) {
      ret[i] = str.charCodeAt(i);
    }
    return ret;
  }
  
  function _intify(str) {
    ret = '';
    for (var i = 0; i < str.length; i++) {
      var cur = str.charCodeAt(i);
      ret += String.fromCharCode(cur & 0xff);
    }
    
    return ret;
  }
  
  function _clearify(str) {
    ret = '';
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code >= 32 && code <= 126) {
        ret += String.fromCharCode(code);
      }
    }
    
    return ret;
  }
  
  return {
    XOR: _XOR,
    HtS: _hexToString,
    StH: _stringToHex,
    AtS: _arrayToString,
    StA: _stringToArray,
    intify: _intify,
    clearify: _clearify
  };
  
}();

/*
 * The JavaScript implementation of Base 64 encoding scheme
 * http://rumkin.com/tools/compression/base64.php
 *
 * Modified, 2008, Anant Narayanan <anant@kix.in>
 *
 * Public domain
 */
Weave.Util.Base64 = function() {
  var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  
  function _encode64(input) {
    var i = 0;
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
  
    do {
      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);
          
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;

      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }

      output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
    } while (i < input.length);

    return output;
  }

  function _decode64(input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
  
    /* remove all characters that are not A-Z, a-z, 0-9, +, /, or = */
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
  
    do {
      enc1 = keyStr.indexOf(input.charAt(i++));
      enc2 = keyStr.indexOf(input.charAt(i++));
      enc3 = keyStr.indexOf(input.charAt(i++));
      enc4 = keyStr.indexOf(input.charAt(i++));

      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;

      output = output + String.fromCharCode(chr1);

      if (enc3 != 64) {
              output = output + String.fromCharCode(chr2);
      }

      if (enc4 != 64) {
              output = output + String.fromCharCode(chr3);
      }
    } while (i < input.length);
  
    return output;
  }
  
  return {
    encode: _encode64,
    decode: _decode64
  };
  
}();

/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1,
 * as defined in FIPS PUB 180-1.
 *
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Modified by Anant Narayanan, 2008.
 *
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */
Weave.Util.SHA1 = function () {
  /*
   * Configurable variables. You may need to tweak these to be compatible with
   * the server-side, but the defaults work in most cases.
   */
  var hexcase = 0;   /* hex output format. 0 - lowercase; 1 - uppercase        */
  var b64pad  = "="; /* base-64 pad character. "=" for strict RFC compliance   */
  var chrsz   = 8;   /* bits per input character. 8 - ASCII; 16 - Unicode      */
  
  /*
   * Perform the appropriate triplet combination function for the current
   * iteration
   */
  function _ft_sha1(t, b, c, d) {
    if (t < 20) {
      return (b & c) | ((~b) & d);
    }
    if (t < 40) {
      return b ^ c ^ d;
    }
    if (t < 60) {
      return (b & c) | (b & d) | (c & d);
    }
    
    return b ^ c ^ d;
  }
  
  /*
   * Determine the appropriate additive constant for the current iteration
   */
  function _kt_sha1(t) {
    return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
           (t < 60) ? -1894007588 : -899497514;
  }
  
  /*
   * Add integers, wrapping at 2^32. This uses 16-bit operations internally
   * to work around bugs in some JS interpreters.
   */
  function _safe_add(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }
  
  /*
   * Bitwise rotate a 32-bit number to the left.
   */
  function _rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  
  /*
   * Calculate the SHA-1 of an array of big-endian words, and a bit length
   */
  function _core_sha1(x, len) {
    /* append padding */
    x[len >> 5] |= 0x80 << (24 - len % 32);
    x[((len + 64 >> 9) << 4) + 15] = len;

    var w = new Array(80);
    var a =  1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d =  271733878;
    var e = -1009589776;

    for (var i = 0; i < x.length; i += 16) {
      var olda = a;
      var oldb = b;
      var oldc = c;
      var oldd = d;
      var olde = e;

      for (var j = 0; j < 80; j++) {
        if (j < 16) {
          w[j] = x[i + j];
        } else {
          w[j] = _rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
        }
        
        var t = _safe_add(_safe_add(_rol(a, 5), _ft_sha1(j, b, c, d)),
                          _safe_add(_safe_add(e, w[j]), _kt_sha1(j)));
        e = d;
        d = c;
        c = _rol(b, 30);
        b = a;
        a = t;
      }

      a = _safe_add(a, olda);
      b = _safe_add(b, oldb);
      c = _safe_add(c, oldc);
      d = _safe_add(d, oldd);
      e = _safe_add(e, olde);
    }
    
    return [a, b, c, d, e];
  }
  
  /*
   * Convert an 8-bit or 16-bit string to an array of big-endian words
   * In 8-bit function, characters >255 have their hi-byte silently ignored.
   */
  function _str2binb(str) {
    var bin = [];
    var mask = (1 << chrsz) - 1;
    
    for (var i = 0; i < str.length * chrsz; i += chrsz){
      bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
    }
    
    return bin;
  }

  /*
   * Convert an array of big-endian words to a string
   */
  function _binb2str(bin) {
    var str = "";
    var mask = (1 << chrsz) - 1;
    
    for (var i = 0; i < bin.length * 32; i += chrsz) {
      str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
    }
    
    return str;
  }

  /*
   * Convert an array of big-endian words to a hex string.
   */
  function _binb2hex(binarray) {
    var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
    var str = "";
    
    for (var i = 0; i < binarray.length * 4; i++) {
      str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
             hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
    }
    
    return str;
  }

  /*
   * Convert an array of big-endian words to a base-64 string
   */
  function _binb2b64(binarray) {
    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var str = "";
    
    for (var i = 0; i < binarray.length * 4; i += 3) {
      var triplet = (((binarray[i     >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                  | (((binarray[i + 1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                  |  ((binarray[i + 2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
      for (var j = 0; j < 4; j++) {
        if (i * 8 + j * 6 > binarray.length * 32) {
          str += b64pad;
        } else {
          str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
        }
      }
    }
    
    return str;
  }
  
  /*
   * Calculate the HMAC-SHA1 of a key and some data
   */
  function _core_hmac_sha1(key, data) {
    var bkey = _str2binb(key);
    if (bkey.length > 16) {
      bkey = _core_sha1(bkey, key.length * chrsz);
    }

    var ipad = new Array(16);
    var opad = new Array(16);
    for (var i = 0; i < 16; i++) {
      ipad[i] = bkey[i] ^ 0x36363636;
      opad[i] = bkey[i] ^ 0x5C5C5C5C;
    }

    var hash = _core_sha1(ipad.concat(_str2binb(data)), 512 + data.length * chrsz);
    return _core_sha1(opad.concat(hash), 512 + 160);
  }
  
  return {
    digest: function(s, t) {
      switch (t) {
        case 2:
          return _binb2str(_core_sha1(_str2binb(s), s.length * chrsz));
        case 3:
          return _binb2b64(_core_sha1(_str2binb(s), s.length * chrsz));
        default:
          return _binb2hex(_core_sha1(_str2binb(s), s.length * chrsz));
      }
    },
    
    hmac: function(key, data, t) {
      switch (t) {
        case 2:
          return _binb2b64(_core_hmac_sha1(key, data));
        case 3:
          return _binb2str(_core_hmac_sha1(key, data));
        default:
          return _binb2hex(_core_hmac_sha1(key, data));
      }
    }
  };
  
}();
