/**
 * Module dependencies
 */

var encryptForTravis = require('./encrypt-for-travis');
var recompileTravisYmlFile = require('./recompile-travis-yml-file');


/**
 * [encryptAndRecompileForTravis description]
 * @param  {[type]}   options [description]
 * @param  {Function} cb      [description]
 * @return {[type]}           [description]
 */

module.exports = function encryptAndRecompileForTravis (options, cb) {
  options = options || {};
  cb = cb || function noOp(err){ if (err) throw err; };

  var repo = options.repo || 'balderdashy/sails';
  var envVars = options.envVars || {};

  encryptForTravis({
    repo: repo,
    envVars: envVars
  }, function (err, encryptedEnvVars) {
    if (err) return cb(err);
    recompileTravisYmlFile({
      locals: encryptedEnvVars
    }, function (err) {
      if (err) return cb(err);
      return cb(null, encryptedEnvVars);
    });
  });
};


