
/**
 * Module dependencies
 */

var encrypt = require('travis-encrypt');
var _ = require('lodash');



/**
 * [encryptForTravis description]
 * @param  {[type]}   options [description]
 * @param  {Function} cb      [description]
 * @return {[type]}           [description]
 */

module.exports = function encryptForTravis (options, cb) {
  options = options || {};
  var repo = options.repo || 'balderdashy/sails';
  var envVars = options.envVars || {};

  // Build string like "FOO=bar BAZ=boo"
  var envVarString = _.reduce(envVars, function (memo, value, envVarName){
    return envVarName.toUpperCase() + '=' + value +' ' + memo;
  }, '');
  // Trim trailing whitespace
  envVarString = envVarString.replace(/\s*$/, '');

  encrypt(repo, envVarString, undefined, undefined, function (err, encryptedEnvVars) {
    if (err) {
      var e = new Error('Failed to encrypt environment variable values');
      e.code = 'E_FAILED_TO_ENCRYPT';
      e.message = typeof err == 'object' ? (err.message || err) : err;
      e.stack = typeof err == 'object' ? (err.stack || err) : err;
      return cb(e);
    }

    return cb(undefined, {secure: encryptedEnvVars});
  });
};




  // Based on the suggestions here:
  // • http://docs.travis-ci.com/user/travis-pro/
  //
  // and using the module here:
  // • https://www.npmjs.org/package/travis-encrypt

  // asyncReduce(envVars, function (memo, value, envVarName, next) {

  //   encrypt(REPO, envVarName.toUpperCase()+'='+value, undefined, undefined, function (err, blob) {
  //     if (err) return next(err);

  //     memo[envVarName] = blob;
  //     return next(null, memo);
  //   });
  // }, {}, function (err, encryptedEnvVars) {
  //   if (err) {
  //     var e = new Error('Failed to encrypt environment variable values');
  //     e.code = 'E_FAILED_TO_ENCRYPT';
  //     e.message = typeof err == 'object' ? (err.message || err) : err;
  //     e.stack = typeof err == 'object' ? (err.stack || err) : err;
  //     return cb(e);
  //   }

  //   return cb(undefined, encryptedEnvVars);
  // });


