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

    read: function (fd) {
      if (arguments[1]) {
        return arguments[1](new Error('For performance reasons, skipper-s3 does not support passing in a callback to `.read()`'));
      }

      var readable = _buildS3Client(globalOpts)
      .getObject({
        Bucket: globalOpts.bucket,
        Key: fd.replace(/^\/+/, ''),// « strip leading slashes
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
              Key: fd.replace(/^\/+/, '')// « strip leading slashes
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
      _buildS3Client(globalOpts)
      .listObjectsV2(_stripKeysWithUndefinedValues({
        Bucket: globalOpts.bucket,
        // Delimiter: '/',  « doesn't seem to make any meaningful difference
        Prefix: (
          // Allow empty dirname (defaults to ''), & strip leading slashes
          // from dirname to form prefix
          (dirname || '').replace(/^\/+/, '')
        )
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

      var wasMaxBytesPerUpstreamQuotaExceeded;
      var wasMaxBytesPerFileQuotaExceeded;
      var maxBytesPerUpstream = s3ClientOpts.maxBytes || undefined;
      var maxBytesPerFile = s3ClientOpts.maxBytesPerFile || undefined;

      var receiver = Writable({ objectMode: true });
      receiver.once('error', (unusedErr)=>{
        // console.log('ERROR ON receiver ::', unusedErr);
      });//œ

      var bytesWrittenByFd = {};

      // console.log('constructed receiver');
      receiver._write = (incomingFileStream, encoding, proceed)=>{
        // console.log('uploading file w/ skipperFd', incomingFileStream.skipperFd);

        // Check for `.skipperFd` (or if not present, `.fd`, for backwards compatibility)
        if (!_.isString(incomingFileStream.skipperFd) || incomingFileStream.skipperFd === '') {
          if (!_.isString(incomingFileStream.fd) || incomingFileStream.fd === '') {
            return proceed(new Error('In skipper-s3: Incoming file stream does not have the expected `.skipperFd` or `.fd` properties-- at least not as a valid string.  If you are using sails-hook-uploads or skipper directly, this should have been automatically attached!  Here is what we got for `.fd` (legacy property): `'+incomingFileStream.fd+'`.  And here is what we got for `.skipperFd` (new property): `'+incomingFileStream.skipperFd+'`'));
          } else {
            // Backwards compatibility:
            incomingFileStream.skipperFd = incomingFileStream.fd;
          }
        }//ﬁ

        var incomingFd = incomingFileStream.skipperFd;
        bytesWrittenByFd[incomingFd] = 0;//« bytes written for this file so far
        incomingFileStream.once('error', (unusedErr)=>{
          // console.log('ERROR ON incoming readable file stream in Skipper S3 adapter (%s) ::', incomingFileStream.filename, unusedErr);
        });//œ
        _uploadFile(incomingFd, incomingFileStream, (progressInfo)=>{
          bytesWrittenByFd[incomingFd] = progressInfo.written;
          incomingFileStream.byteCount = progressInfo.written;//« used by Skipper core
          let totalBytesWrittenForThisUpstream = 0;
          for (let fd in bytesWrittenByFd) {
            totalBytesWrittenForThisUpstream += bytesWrittenByFd[fd];
          }//∞
          // console.log('maxBytesPerUpstream',maxBytesPerUpstream);
          // console.log('bytesWrittenByFd',bytesWrittenByFd);
          // console.log('totalBytesWrittenForThisUpstream',totalBytesWrittenForThisUpstream);
          if (maxBytesPerUpstream && totalBytesWrittenForThisUpstream > maxBytesPerUpstream) {
            wasMaxBytesPerUpstreamQuotaExceeded = true;
            return false;
          } else if (maxBytesPerFile && bytesWrittenByFd[incomingFd] > maxBytesPerFile) {
            wasMaxBytesPerFileQuotaExceeded = true;
            return false;
          } else {
            if (s3ClientOpts.onProgress) {
              s3ClientOpts.onProgress(progressInfo);
            } else {
              receiver.emit('progress', progressInfo);// « for backwards compatibility
            }
            return true;
          }
        }, s3ClientOpts, (err)=>{
          if (err) {
            // console.log(('Receiver: Error writing `' + incomingFileStream.filename + '`:: ' + require('util').inspect(err) + ' :: Cancelling upload and cleaning up already-written bytes...').red);
            if (flaverr.taste({name: 'RequestAbortedError'}, err)) {
              if (maxBytesPerUpstream && wasMaxBytesPerUpstreamQuotaExceeded) {
                err = flaverr({code: 'E_EXCEEDS_UPLOAD_LIMIT'}, new Error(`Upload too big!  Exceeded quota ("maxBytes": ${maxBytesPerUpstream})`));
              } else if (maxBytesPerFile && wasMaxBytesPerFileQuotaExceeded) {
                err = flaverr({code: 'E_EXCEEDS_FILE_SIZE_LIMIT'}, new Error(`One of the attempted file uploads was too big!  Exceeded quota ("maxBytesPerFile": ${maxBytesPerFile})`));
              }//ﬁ
            }//ﬁ
            receiver.emit('error', err);
          } else {
            incomingFileStream.byteCount = bytesWrittenByFd[incomingFd];//« used by Skipper core
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

function _uploadFile(incomingFd, incomingFileStream, handleProgress, s3ClientOpts, done) {
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property
  var s3ManagedUpload = _buildS3Client(s3ClientOpts)
  .upload(_stripKeysWithUndefinedValues({
    Bucket: s3ClientOpts.bucket,
    Key: incomingFd.replace(/^\/+/, ''),//« remove any leading slashes
    Body: incomingFileStream,
    ContentType: mime.getType(incomingFd),//« advisory; makes things nicer in the S3 dashboard
    ContentDisposition: s3ClientOpts.ContentDisposition
  }), (err, rawS3ResponseData)=>{
    if (err) {
      return done(err);
    } else {
      return done(undefined, {
        rawS3ResponseData
      });
    }
  });//_∏_

  s3ManagedUpload.on('httpUploadProgress', (event)=>{
    // console.log('upload progress');
    let written = _.isNumber(event.loaded) ? event.loaded : 0;
    let total = _.isNumber(event.total) ? event.total : undefined;
    let handledSuccessfully = handleProgress(_stripKeysWithUndefinedValues({
      name: incomingFileStream.filename || incomingFd,
      fd: incomingFd,
      written,
      total,
      percent: total ? (written / total) : undefined
    }));
    if (!handledSuccessfully) {
      s3ManagedUpload.abort();
    }
  });//œ

}//ƒ
