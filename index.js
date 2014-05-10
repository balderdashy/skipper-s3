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
var S3Lister = require('s3-lister');


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

    read: function (filepath, cb) {

      // DONT trim leading slash to form prefix!!
      var prefix = filepath;
      // var prefix = dirpath.replace(/^\//, '');
      console.log('Trying to look up:', prefix);


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

      client.get(prefix).on('response', function(s3res){
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
        var firedCb;
        __transform__.once('error', function (err) {
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
      return cb(new Error('TODO'));
    },
    ls: function (dirpath, cb) {
      var client = knox.createClient({
        key: globalOpts.key,
        secret: globalOpts.secret,
        bucket: globalOpts.bucket
      });

      // TODO: take a look at maxKeys
      // https://www.npmjs.org/package/s3-lister

      // Allow empty dirpath (defaults to `/`)
      if (!dirpath) {
        dirpath='/';
      }
      // Strip leading slash from dirpath to form prefix
      var prefix = dirpath.replace(/^\//, '');

      var lister = new S3Lister(client, {
        prefix : prefix
      });

      if (!cb) {
        return lister;
      }
      else {
        var firedCb;
        lister.once('error', function (err) {
          if(firedCb)return;
          firedCb=true;
          cb(err);
        });
        lister.pipe(concat(function (data) {
          if(firedCb)return;
          firedCb=true;

          // Pluck just the "Key" (i.e. file path)
          // and return only the filename (i.e. snip
          // off the path prefix)
          data = _.pluck(data, 'Key');
          data = _.map(data, function snipPathPrefixes (thisPath) {
            return thisPath.replace(/^.*[\/]([^\/]*)$/, '$1');
          });

          console.log('______ files _______\n', data);
          cb(null, data);
        }));

        // TODO: marshal each matched file in the stream
        // (using a Transform- take a look at all the
        //  "plucking" and stuff I have going on above ^)
        return lister;
      }
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

    receiver__.once('error', function (err) {
      console.log('ERROR ON RECEIVER__ ::',err);
    });

    // This `_write` method is invoked each time a new file is received
    // from the Readable stream (Upstream) which is pumping filestreams
    // into this receiver.  (filename === `__newFile.filename`).
    receiver__._write = function onFile(__newFile, encoding, next) {

      __newFile.once('error', function (err) {
        console.log('ERROR ON file read stream in receiver (%s) ::', __newFile.filename, err);
        // TODO: the upload has been cancelled, so we need to stop writing
        // all buffered bytes, then call gc() to remove the parts of the file that WERE written.
        // (caveat: may not need to actually call gc()-- need to see how this is implemented
        // in the underlying knox-mpu module)
      });

      // Garbage-collect the bytes that were already written for this file.
      // (called when a read or write error occurs)
      // function gc(err) {
      //   console.log('************** Garbage collecting file `' + __newFile.filename + '` located @ ' + filePath + '...');
      //   adapter.rm(filePath, function (gcErr) {
      //     if (gcErr) return done([err].concat([gcErr]));
      //     else return done();
      //   });
      // }

      // Determine location where file should be written:
      // -------------------------------------------------------
      var filePath, dirPath, filename;
      dirPath = options.dirname;
      filename = options.filename || options.saveAs(__newFile);
      filePath = path.join(dirPath, filename);
      // -------------------------------------------------------


      console.log(('Receiver: Received file `' + __newFile.filename + '` from an Upstream.').grey);

      // TODO: fix backpressure issues
      // It would appear that knox-mpu is not
      // properly handling backpressure, which
      // breaks the TCP backpressure we're expecting
      // to keep ourselves from overflowing
      // Not 100% sure yet- problem could also
      // be in multiparty.

      console.log('->',options);
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
          console.log(('Receiver: Error writing `' + __newFile.filename + '`:: ' + require('util').inspect(err) + ' :: Cancelling upload and cleaning up already-written bytes...').red);
          receiver__.emit('error', err);
          return;
        }

        // Package extra metadata about the S3 response on each file stream
        // in case we decide we want to use it for something later
        __newFile.extra = body;

        console.log(('Receiver: Finished writing `' + __newFile.filename + '`').grey);
        next();
      });

      mpu.on('progress', function(data) {
        console.log('Uploading (%s)..',__newFile.filename, data);
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


