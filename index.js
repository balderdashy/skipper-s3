/**
 * Module dependencies
 */

var path = require('path');
var Writable = require('stream').Writable;
var _ = require('@sailshq/lodash');
var flaverr = require('flaverr');
var mime = require('mime');
var AWS = require('aws-sdk');

/**
 * skipper-s3
 *
 * @param  {Dictionary} globalOpts
 *         @property {String} key
 *         @property {String} secret
 *         @property {String} bucket
 *
 * @returns {Dictionary}
 *         @property {Function} read
 *         @property {Function} rm
 *         @property {Function} ls
 *         @property {Function} receive
 */

module.exports = function SkipperS3 (globalOpts) {
  globalOpts = globalOpts || {};

  // console.log('S3 adapter was instantiated...');

  return {

    read: function (fd, done) {
      if (done) {
        throw new Error('For performance reasons, skipper-s3 does not support using a callback with `.read()`');
      }

      var readable = _buildS3Client(globalOpts)
      .getObject({
        Bucket: globalOpts.bucket,
        Key: fd,
      })
      .createReadStream();

      return readable;
    },

    rm: function (fd, done) {
      _buildS3Client(globalOpts)
      .deleteObjects(_stripKeysWithUndefinedValues({
        Bucket: globalOpts.bucket,
        Delete: {
          Quiet: false,
          Objects: [
            {
              Key: fd
            }
          ]
        }
      }), (err, result)=>{
        if (err){ return done(err); }

        if (result && result['Errors'] && result['Errors'].length > 0) {
          return done(flaverr({raw: result['Errors']}, new Error('Failed to remove some file(s) from S3 (see `.raw`)')));
        }

        return done(undefined, result);
      });//_∏_
    },
    ls: function (dirname, done) {

      // Allow empty dirname (defaults to `/`), & strip leading slash
      // from dirname to form prefix
      dirname = dirname || '/';
      var prefix = dirname.replace(/^\//, '');

      _buildS3Client(globalOpts)
      .listObjectsV2(_stripKeysWithUndefinedValues({
        Bucket: globalOpts.bucket,
        Prefix: prefix
        // FUTURE: maybe also check out "MaxKeys"..?
      }), (err, result)=>{
        if (err){ return done(err); }

        var formattedResults;
        try {
          formattedResults = _.pluck(result['Contents'], 'Key');
        } catch (err) { return done(err); }

        return done(undefined, formattedResults);
      });//_∏_

    },

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
    receive: function S3Receiver (options) {
      // console.log('`.receive()` was called...');
      options = options || {};
      options = _.defaults(options, globalOpts);

      // The max bytes available for uploading starts out as the
      // max upload limit, and is reduced every time a file
      // is successfully uploaded.
      var bytesRemaining = options.maxBytes;

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

        // Attempt to look up content type if not set
        if (headers['content-type'] === undefined) {
          headers['content-type'] = mime.lookup(__newFile.fd);
        }

        var bytesWritten = 0;

        var mpu = new S3MultipartUpload({
          objectName: __newFile.fd,
          stream: __newFile,
          maxUploadSize: bytesRemaining,
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

          // Reduce the bytes available for upload by the size of the
          // successfully uploaded file.
          bytesRemaining -= body.size;

          // Package extra metadata about the S3 response on each file stream
          // in case we decide we want to use it for something later
          __newFile.extra = body;

          // console.log(('Receiver: Finished writing `' + __newFile.filename + '`').grey);

          // Set the byteCount on the stream to the size of the file that was persisted.
          // Skipper uses this value when serializing uploaded file info.
          __newFile.byteCount = body.size;

          // console.timeEnd('fileupload:'+__newFile.filename);
          var endedAt = new Date();
          var duration = ((endedAt - startedAt) / 1000);
          // console.log('**** S3 upload took '+duration+' seconds...');

          // Indicate that a file was persisted.
          receiver__.emit('writefile', __newFile);

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
            total: bytesWritten += data.written,
            percent: data.percent
          });
        });
      };

      return receiver__;
    }
  };
};


//////////////////////////////////////////////////////////////////////////////


/**
 * destructive -- mutates, returns reference only for convenience
 */
function _stripKeysWithUndefinedValues(dictionary) {
  for (let k in dictionary) {
    if (dictionary[k] === undefined) {
      delete dictionary[k];
    }
  }
  return dictionary;
}//ƒ

function _buildS3Client(globalOpts) {
  var s3ConstructorArgins = _stripKeysWithUndefinedValues({
    apiVersion: '2006-03-01',
    region: globalOpts.region,
    accessKeyId: globalOpts.key,
    secretAccessKey: globalOpts.secret,
    endpoint: globalOpts.endpoint
  });
  return new AWS.S3(s3ConstructorArgins);
}//ƒ
