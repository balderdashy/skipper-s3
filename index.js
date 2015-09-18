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
var S3MultipartUpload = require('knox-mpu-alt');
var S3Lister = require('s3-lister');
var mime = require('mime');

/**
 * skipper-s3
 *
 * @param  {Object} globalOpts
 * @return {Object}
 */

module.exports = function SkipperS3 (globalOpts) {
  globalOpts = globalOpts || {};

  // console.log('S3 adapter was instantiated...');


  var adapter = {

    read: function (fd, cb) {

      var prefix = fd;

      var client = knox.createClient({
        key: globalOpts.key,
        secret: globalOpts.secret,
        bucket: globalOpts.bucket,
        region: globalOpts.region||undefined,
        endpoint: globalOpts.endpoint||undefined,
        token: globalOpts.token||undefined
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

    rm: function (fd, cb) {
      knox.createClient({
        key: globalOpts.key,
        secret: globalOpts.secret,
        bucket: globalOpts.bucket,
        region: globalOpts.region||undefined,
        endpoint: globalOpts.endpoint||undefined
      })
        .del(fd)
        .on('response', function (res) {
            if (res.statusCode === 204) {
              cb();
            } else {
              cb({
                statusCode: res.statusCode,
                message: res.body
              });
            }
          })
        .end();
    },
    ls: function (dirname, cb) {
      var client = knox.createClient({
        key: globalOpts.key,
        secret: globalOpts.secret,
        bucket: globalOpts.bucket,
        region: globalOpts.region,
        endpoint: globalOpts.endpoint,
        token: globalOpts.token||undefined
      });

      // TODO: take a look at maxKeys
      // https://www.npmjs.org/package/s3-lister

      // Allow empty dirname (defaults to `/`)
      if (!dirname) {
        prefix='/';
      }
      else prefix = dirname;

      // Strip leading slash from dirname to form prefix
      var prefix = dirname.replace(/^\//, '');

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
            thisPath = thisPath.replace(/^.*[\/]([^\/]*)$/, '$1');

            // Join the dirname with the filename
            thisPath = path.join(dirname, path.basename(thisPath));

            return thisPath;
          });



          // console.log('______ files _______\n', data);
          cb(null, data);
        }));

        // TODO: marshal each matched file in the stream
        // (using a Transform- take a look at all the
        //  "plucking" and stuff I have going on above ^)
        return lister;
      }
    },

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
    // console.log('`.receive()` was called...');
    options = options || {};
    options = _.defaults(options, globalOpts);

    var receiver__ = Writable({
      objectMode: true
    });

    receiver__.once('error', function (err) {
      // console.log('ERROR ON RECEIVER__ ::',err);
    });

    // This `_write` method is invoked each time a new file is received
    // from the Readable stream (Upstream) which is pumping filestreams
    // into this receiver.  (filename === `__newFile.filename`).
    receiver__._write = function onFile(__newFile, encoding, next) {

      var startedAt = new Date();

      __newFile.once('error', function (err) {
        // console.log('ERROR ON file read stream in receiver (%s) ::', __newFile.filename, err);
        // TODO: the upload has been cancelled, so we need to stop writing
        // all buffered bytes, then call gc() to remove the parts of the file that WERE written.
        // (caveat: may not need to actually call gc()-- need to see how this is implemented
        // in the underlying knox-mpu module)
        //
        // Skipper core should gc() for us.
      });

      // Allow `tmpdir` for knox-mpu to be passed in, or default
      // to `.tmp/s3-upload-part-queue`
      options.tmpdir = options.tmpdir || path.resolve(process.cwd(), '.tmp/s3-upload-part-queue');

      var headers = options.headers || {};

      // Lookup content type with mime if not set
      if ('undefined' === typeof headers['content-type']) {
        headers['content-type'] = mime.lookup(__newFile.fd);
      }

      var mpu = new S3MultipartUpload({
        objectName: __newFile.fd,
        stream: __newFile,
        maxUploadSize: options.maxBytes,
        tmpDir: options.tmpdir,
        headers: headers,
        client: knox.createClient({
          key: options.key,
          secret: options.secret,
          bucket: options.bucket,
          region: globalOpts.region||undefined,
          endpoint: globalOpts.endpoint||undefined,
          token: globalOpts.token||undefined
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


        // console.timeEnd('fileupload:'+__newFile.filename);
        var endedAt = new Date();
        var duration = ((endedAt - startedAt) / 1000);
        // console.log('**** S3 upload took '+duration+' seconds...');

        next();
      });


      mpu.on('progress', function(data) {
        var snapshot = new Date();
        var secondsElapsed = ((snapshot - startedAt) / 1000);
        var estUploadRate = (data.written/1000) / secondsElapsed;
        // console.log('Uploading at %dkB/s', estUploadRate);
        // console.log('Elapsed:',secondsElapsed+'s');

        // console.log('Uploading (%s)..',__newFile.filename, data);
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


