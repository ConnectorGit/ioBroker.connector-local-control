var crypto = require('crypto');

/**
 * aes加密
 * @param data
 * @param key
 * @returns {string}
 */
const encryption = function (token, key, iv) {
    iv = iv || "";
    var clearEncoding = 'utf8';
    var cipherEncoding = 'base64';
    var cipher = crypto.createCipheriv('aes-128-ecb', key, iv);
    cipher.setAutoPadding(false);
    var accesstoken =  cipher.update(token,'utf8', 'hex')
    return accesstoken.substr(0, 32).toUpperCase();
}

exports.generateAcc = encryption;
