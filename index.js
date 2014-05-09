/**
 * Module dependencies
 */

var path = require('path');
var Writable = require('stream').Writable;
var Transform = require('stream').Transform;
var concat = require('concat-stream');
var _ = require('lodash');
_.defaultsDeep = require('merge-defaults');
var knox = require('knox');
var S3MultipartUpload = require('knox-mpu');



/**
 * skipper-s3
 *
 * @param  {Object} globalOpts
 * @return {Object}
 */

module.exports = function SkipperS3 (globalOpts) {
  globalOpts = globalOpts || {};


  _.defaults(globalOpts, {

      // By default, create new files on disk
      // using their uploaded filenames.
      // (no overwrite-checking is performed!!)
      saveAs: function (__newFile) {
        return __newFile.filename;
      },

      // Max bytes (defaults to ~15MB)
      maxBytes: 15000000,

      // The bucket we're going to upload stuff into
      // bucket: '',

      // Our S3 API key
      // key: '',

      // Our S3 API secret
      // secret: '',

      // By default, upload files to `/` (within the bucket)
      dirname: '/'
    });

  var adapter = {

    read: function (filename, cb) {

      // Determine location where file should be written:
      var dirPath = globalOpts.dirname;
      var filePath = path.join(dirPath, filename);

      var client = knox.createClient({
        key: globalOpts.key,
        secret: globalOpts.secret,
        bucket: globalOpts.bucket
      });

      // Build a noop transform stream that will pump the S3 output through
      var __transform__ = new Transform();
      __transform__._transform = function (chunk, encoding, callback) {
        return callback(null, chunk);
      };

      client.get(filePath).on('response', function(s3res){
        // Handle explicit s3res errors
        s3res.once('error', function (err) {
          __transform__.emit('error', err);
        });

        // check whether we got an actual file stream:
        if (s3res.statusCode < 300) {
          s3res.pipe(__transform__);
        }
        // or an error:
        else {
          // Wait for the body of the error message to stream in:
          var body = '';
          s3res.setEncoding('utf8');
          s3res.on('readable', function (){
            var chunk = s3res.read();
            if (typeof chunk === 'string') body += chunk;
          });
          // Then build the error and emit it
          s3res.once('end', function () {
            var err = new Error();
            err.status = s3res.statusCode;
            err.headers = s3res.headers;
            err.message = 'Non-200 status code returned from S3 for requested file.';
            if (body) err.message += ('\n'+body);
            __transform__.emit('error', err);
          });
        }
      })
      .end();

      if (cb) {
        var firedCb = false;
        __transform.once('error', function (err) {
          if (firedCb) return;
          firedCb = true;
          cb(err);
        });
        __transform__.pipe(concat(function (data) {
          if (firedCb) return;
          firedCb = true;
          cb(null, data);
        }));
      }

      return __transform__;
    },

    rm: function (filepath, cb){
      return fsx.unlink(filepath, function(err) {
        // Ignore "doesn't exist" errors
        if (err && err.code !== 'ENOENT') { return cb(err); }
        else return cb();
      });
    },
    ls: function (dirpath, cb) {
      return fsx.readdir(dirpath, cb);
    },

    receiver: S3Receiver,
    receive: S3Receiver
  };

  return adapter;

  /**
   * A simple receiver for Skipper that writes Upstreams to
   * S3 to the configured bucket at the configured path.
   *
   * Includes a garbage-collection mechanism for failed
   * uploads.
   *
   * @param  {Object} options
   * @return {Stream.Writable}
   */
  function S3Receiver (options) {
    options = options || {};
    options = _.defaults(options, globalOpts);

    var receiver__ = Writable({
      objectMode: true
    });

    // This `_write` method is invoked each time a new file is received
    // from the Readable stream (Upstream) which is pumping filestreams
    // into this receiver.  (filename === `__newFile.filename`).
    receiver__._write = function onFile(__newFile, encoding, next) {

      // Garbage-collect the bytes that were already written for this file.
      // (called when a read or write error occurs)
      function gc(err) {
        // console.log('************** Garbage collecting file `' + __newFile.filename + '` located @ ' + filePath + '...');
        adapter.rm(filePath, function (gcErr) {
          if (gcErr) return done([err].concat([gcErr]));
          else return done();
        });
      }

      // Determine location where file should be written:
      // -------------------------------------------------------
      var filePath, dirPath, filename;
      dirPath = options.dirname;
      filename = options.saveAs(__newFile);
      filePath = path.join(dirPath, filename);
      // -------------------------------------------------------


      // console.log(('Receiver: Received file `' + __newFile.filename + '` from an Upstream.').grey);

      // console.log('->',options);
      var mpu = new S3MultipartUpload({
        objectName: filePath,
        stream: __newFile,
        maxUploadSize: options.maxBytes,
        client: knox.createClient({
          key: options.key,
          secret: options.secret,
          bucket: options.bucket
        })
      }, function (err, body) {
        if (err) {
          // console.log(('Receiver: Error writing `' + __newFile.filename + '`:: ' + require('util').inspect(err) + ' :: Cancelling upload and cleaning up already-written bytes...').red);
          receiver__.emit('error', err);
          return;
        }

        // Package extra metadata about the S3 response on each file stream
        // in case we decide we want to use it for something later
        __newFile.extra = body;

        // console.log(('Receiver: Finished writing `' + __newFile.filename + '`').grey);
        next();
      });

      mpu.on('progress', function(data) {
        receiver__.emit('progress', {
          name: __newFile.filename,
          written: data.written,
          total: data.total,
          percent: data.percent
        });
      });
    };

    return receiver__;
  }



};


