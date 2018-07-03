/**
 * Module dependencies
 */

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
     * @param  {Dictionary} s3ClientOpts
     *         @property {String} fd
     *         @property {String} bucket
     *         etc…
     * @return {Receiver} (a writable stream)
     */
    receive: function S3Receiver (s3ClientOpts) {
      s3ClientOpts = s3ClientOpts || {};
      s3ClientOpts = _.extend({}, globalOpts, s3ClientOpts);

      var receiver = Writable({ objectMode: true });
      receiver.once('error', (unusedErr)=>{
        // console.log('ERROR ON receiver ::', unusedErr);
      });//œ

      receiver._write = (incomingFileStream, encoding, proceed)=>{
        incomingFileStream.once('error', (unusedErr)=>{
          // console.log('ERROR ON incoming readable file stream in Skipper S3 adapter (%s) ::', incomingFileStream.filename, unusedErr);
        });//œ
        _uploadFile(incomingFileStream, (progressInfo)=>{
          incomingFileStream.byteCount = progressInfo.written;//« used by Skipper core
          receiver.emit('progress', progressInfo);
        }, s3ClientOpts, (err, report)=>{
          if (err) {
            // console.log(('Receiver: Error writing `' + __newFile.filename + '`:: ' + require('util').inspect(err) + ' :: Cancelling upload and cleaning up already-written bytes...').red);
            receiver.emit('error', err);
          } else {
            incomingFileStream.byteCount = report.totalBytesWritten;//« used by Skipper core
            receiver.emit('writefile', incomingFileStream);
            return proceed();
          }
        });//_∏_
      };//ƒ

      return receiver;
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

function _buildS3Client(s3ClientOpts) {
  var s3ConstructorArgins = _stripKeysWithUndefinedValues({
    apiVersion: '2006-03-01',
    region: s3ClientOpts.region,
    accessKeyId: s3ClientOpts.key,
    secretAccessKey: s3ClientOpts.secret,
    endpoint: s3ClientOpts.endpoint
  });
  return new AWS.S3(s3ConstructorArgins);
}//ƒ

function _uploadFile(incomingFileStream, onProgress, s3ClientOpts, done) {

  var wasMaxBytesQuotaExceeded;
  var totalBytesWritten = 0;

  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property
  var s3ManagedUpload = _buildS3Client(s3ClientOpts)
  .upload(_stripKeysWithUndefinedValues({
    Bucket: s3ClientOpts.bucket,
    Key: incomingFileStream.fd,
    Body: incomingFileStream,
    ContentType: mime.lookup(incomingFileStream.fd)//« advisory; makes things nicer in the S3 dashboard
  }), (err, rawS3ResponseData)=>{
    if (err && s3ClientOpts.maxBytes && wasMaxBytesQuotaExceeded && flaverr.taste({name: 'RequestAbortedError'}, err)) {
      err = flaverr({code: 'E_EXCEEDS_UPLOAD_LIMIT'}, new Error(`Upload too big!  Exceeded quota ("maxBytes": ${s3ClientOpts.maxBytes})`));
      return done(err);
    } else if (err) {
      return done(err);
    } else {
      return done(undefined, {
        rawS3ResponseData,
        totalBytesWritten
      });
    }
  });//_∏_

  s3ManagedUpload.on('httpUploadProgress', (event)=>{
    totalBytesWritten = event.loaded;
    if (event.loaded > s3ClientOpts.maxBytes) {
      wasMaxBytesQuotaExceeded = true;
      s3ManagedUpload.abort();
    } else if (onProgress) {
      let written = _.isNumber(event.loaded) ? event.loaded : 0;
      let total = _.isNumber(event.total) ? event.total : undefined;
      onProgress(_stripKeysWithUndefinedValues({
        name: incomingFileStream.filename || incomingFileStream.fd,
        written,
        total,
        percent: total ? (written / total) : undefined
      }));
    }//ﬁ
  });//œ

}//ƒ
