/**
 * @fileOverview Weave crypto keys
 * @author <a href="http://decafbad.com">l.m.orchard@pobox.com</a>
 * @version 0.1
 */
/*jslint laxbreak: true */
/*global Weave, Chain, Class, Ajax */

/**
 * Representation of a public key
 *
 * @class
 * @augments Weave.Service.BasicObject
 */
Weave.Service.PubKey = Class.create(Weave.Service.BasicObject, /** @lends Weave.Service.PubKey */{
    EOF:null
});

/**
 * Collection of a set of public keys
 *
 * @class
 * @augments Weave.Service.BasicCollection
 */
Weave.Service.PubKeyCollection = Class.create(Weave.Service.BasicCollection, /** @lends Weave.Service.PubKeyCollection */{

    _record_type: Weave.Service.PubKey,
    _default_url: null,

    /**
     * Set the URL for getDefault()
     *
     * @param {string}   url URL of the record to fetch
     */
    setDefaultURL: function (url) {
        this._default_url = url;
    },

    /**
     * Get the URL for getDefault()
     */
    getDefaultURL: function () {
        return this._default_url;
    },

    /**
     * Retrieve a record for a pre-set default URL.
     *
     * @param {function} on_success Success callback (record)
     * @param {function} on_failure Failure callback (record)
     */
    getDefault: function (on_success, on_failure) {
        return this.get(this._default_url, on_success, on_failure);
    },

    EOF:null
});

/**
 * Representation of a private key
 *
 * @class
 * @augments Weave.Service.BasicObject
 */
Weave.Service.PrivKey = Class.create(Weave.Service.BasicObject, /** @lends Weave.Service.PrivKey */{

    /**
     * Decrypt this private key using a passphrase.
     *
     * @param {string}   passphrase Passphrase for key decryption
     * @param {function} on_success Success callback (record)
     * @param {function} on_failure Failure callback (record)
     */
    decrypt: function (passphrase, on_success, on_failure) {
        var chain = new Decafbad.Chain([
            function (chain) {

                var pkcs5_key = Weave.Crypto.PKCS5.generate(
                    passphrase,
                    Weave.Util.Base64.decode(this.get('payload').salt),
                    4096, 32
                );

                // Decrypt the user's private key using the passphrase-based
                // symmetric key.
                ursa_key = Weave.Crypto.AES.decrypt(
                    pkcs5_key, 
                    Weave.Util.Base64.decode(this.get('payload').iv),
                    Weave.Util.Base64.decode(this.get('payload').keyData)
                );

                // Parse for the key
                tag = Weave.Crypto.ASN1.PKCS1.parse(ursa_key);
                if (!tag) { return on_failure("PASSPHRASE INCORRECT"); }

                var rsa_key = new RSAKey();
                rsa_key.setPrivateEx(
                    tag[0], tag[1], tag[2], tag[3], 
                    tag[4], tag[5], tag[6], tag[7]
                );
                this.set('rsa_key', rsa_key);

                chain.next();
            },
            function (chain) {
                return on_success(this);
            }
        ], this, on_failure).next();
    },

    EOF:null
});

/**
 * Collection of a set of private keys
 *
 * @class
 * @augments Weave.Service.PubKeyCollection
 */
Weave.Service.PrivKeyCollection = Class.create(Weave.Service.PubKeyCollection, /** @lends Weave.Service.PrivKeyCollection */{
    _record_type: Weave.Service.PrivKey,

    /**
     * Override to superclass _import that automatically decrypts all newly
     * fetched private keys using the passphrase from service.
     */
    _import: function ($super, url, on_success, on_failure) {
        $super(
            url,
            function (record) {
                record.decrypt(
                    this.service.options.passphrase,
                    on_success, on_failure
                );
            }.bind(this),
            on_failure
        );
    },

    EOF:null
});

/**
 * Representation of a symmetric key
 *
 * @class
 * @augments Weave.Service.BasicObject
 */
Weave.Service.SymKey = Class.create(Weave.Service.BasicObject, /** @lends Weave.Service.SymKey */{

    /**
     * Decrypt this symmetric key given a public and private key pair.
     *
     * @param {Weave.Service.PubKey}  pubkey  Public key
     * @param {Weave.Service.PrivKey} privkey Private key
     */
    decrypt: function (pubkey, privkey, on_success, on_failure) {
        var privkeys = this.collection.service.privkeys,
            pubkeys  = this.collection.service.pubkeys;

        var chain = new Decafbad.Chain([
            function (chain) {
                if (pubkey) {
                    chain.next(pubkey);
                } else {
                    pubkeys.getDefault(chain.nextCb(), on_failure);
                }
            },
            function (chain, pubkey) {
                if (privkey) {
                    chain.next(pubkey, privkey);
                } else {
                    privkeys.getDefault(chain.nextCb(pubkey), on_failure);
                }
            },
            function (chain, pubkey, privkey) {
                var rsa_key = privkey.get('rsa_key');
                var key = this.get('payload').keyring[pubkey.get('url')];
                var symkey = Weave.Util.intify(rsa_key.decrypt(
                    Weave.Util.StH(Weave.Util.Base64.decode(key))
                ));
                this.set('symkey', symkey);
                on_success(this);
            }
        ], this, on_failure).start();
    },

    EOF:null
});

/**
 * Collection of a set of symmetric keys
 *
 * @class
 * @augments Weave.Service.BasicCollection
 */
Weave.Service.SymKeyCollection = Class.create(Weave.Service.BasicCollection, /** @lends Weave.Service.SymKeyCollection */{
    _record_type: Weave.Service.SymKey,

    /**
     * Override to superclass _import that automatically decrypts all newly
     * fetched symmetric keys using the default public/private keys.
     */
    _import: function ($super, url, on_success, on_failure) {
        $super(
            url,
            function (record) {
                record.decrypt(null, null, on_success, on_failure);
            }.bind(this),
            on_failure
        );
    },

    EOF:null
});
