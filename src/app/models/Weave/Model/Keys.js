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
 * @augments Weave.Model.BasicObject
 */
Weave.Model.PubKey = Class.create(Weave.Model.BasicObject, /** @lends Weave.Model.PubKey */{
    EOF:null
});

/**
 * Manager of a set of public keys
 *
 * @class
 * @augments Weave.Model.RecordManager
 */
Weave.Model.PubKeyManager = Class.create(Weave.Model.RecordManager, /** @lends Weave.Model.PubKeyManager */{

    _record_type: Weave.Model.PubKey,
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
 * @augments Weave.Model.BasicObject
 */
Weave.Model.PrivKey = Class.create(Weave.Model.BasicObject, /** @lends Weave.Model.PrivKey */{

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
 * Manager of a set of private keys
 *
 * @class
 * @augments Weave.Model.PubKeyManager
 */
Weave.Model.PrivKeyManager = Class.create(Weave.Model.PubKeyManager, /** @lends Weave.Model.PrivKeyManager */{
    _record_type: Weave.Model.PrivKey,

    /**
     * Override to superclass _import that automatically decrypts all newly
     * fetched private keys using the passphrase from API.
     */
    _import: function ($super, url, on_success, on_failure) {
        $super(
            url,
            function (record) {
                record.decrypt(
                    this.api.options.passphrase,
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
 * @augments Weave.Model.BasicObject
 */
Weave.Model.SymKey = Class.create(Weave.Model.BasicObject, /** @lends Weave.Model.SymKey */{

    /**
     * Decrypt this symmetric key given a public and private key pair.
     *
     * @param {Weave.Model.PubKey}  pubkey  Public key
     * @param {Weave.Model.PrivKey} privkey Private key
     */
    decrypt: function (pubkey, privkey, on_success, on_failure) {
        var privkeys = this.manager.api.privkeys,
            pubkeys  = this.manager.api.pubkeys;

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
                var rsa_key = privkey.get('rsa_key'),
                    key = this.get('payload').keyring[pubkey.get('url')],
                    symkey = Weave.Util.intify(rsa_key.decrypt(
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
 * Manager of a set of symmetric keys
 *
 * @class
 * @augments Weave.Model.RecordManager
 */
Weave.Model.SymKeyManager = Class.create(Weave.Model.RecordManager, /** @lends Weave.Model.SymKeyManager */{
    _record_type: Weave.Model.SymKey,

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
