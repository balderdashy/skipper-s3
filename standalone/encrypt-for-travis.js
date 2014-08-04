
/**
 * Module dependencies
 */

var encrypt = require('travis-encrypt');
var asyncReduce = require('./async-reduce');



/**
 * [encryptForTravis description]
 * @param  {[type]}   options [description]
 * @param  {Function} cb      [description]
 * @return {[type]}           [description]
 */

module.exports = function encryptForTravis (options, cb) {
  options = options || {};
  var REPO = options.repo || 'balderdashy/sails';
  var envVars = options.envVars || {};
  asyncReduce(envVars, function (memo, value, envVarName, next) {

    // Based on the suggestions here:
    // • http://docs.travis-ci.com/user/travis-pro/
    //
    // and using the module here:
    // • https://www.npmjs.org/package/travis-encrypt

    encrypt(REPO, envVarName.toUpperCase()+'='+value, undefined, undefined, function (err, blob) {
      if (err) return next(err);

      memo[envVarName] = blob;
      return next(null, memo);
    });
  }, {}, function (err, encryptedEnvVars) {
    if (err) {
      var e = new Error('Failed to encrypt environment variable values');
      e.code = 'E_FAILED_TO_ENCRYPT';
      e.message = typeof err == 'object' ? (err.message || err) : err;
      e.stack = typeof err == 'object' ? (err.stack || err) : err;
      return cb(e);
    }

    return cb(undefined, encryptedEnvVars);
  });
};

