/**
 * Module dependencies
 */

var async = require('async');
var _ = require('lodash');





/**
 * [asyncReduce description]
 * @param  {Object|Array} collection
 * @param  {Function(memo,value,key,cb)} iteratorFn
 * @param  {*} initialMemo
 * @param  {Function(err,result)} afterwards
 */

module.exports = function asyncReduce(collection, iteratorFn, initialMemo, afterwards){
  var memo = initialMemo;
  async.eachSeries(_.keys(collection), function (key, next){
    iteratorFn(memo, collection[key], key, function (err, _updatedMemo) {
      if (err) return next(err);
      memo = _updatedMemo;
      next();
    });
  }, function (err) {
    return afterwards(err, memo);
  });
}

