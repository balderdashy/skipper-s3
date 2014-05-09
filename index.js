/**
 * Module dependencies
 */

var path = require('path');
var _ = require('lodash');
_.defaultsDeep = require('merge-defaults');
var Writable = require('stream').Writable;
var knox = require('knox');
var S3MultipartUpload = require('knox-mpu');



/**
 * skipper-s3
 *
 * @param  {Object} globalOpts
 * @return {Object}
 */

module.exports = function DiskStore (globalOpts) {
  globalOpts = globalOpts || {};

  return {

    rm: function (){throw new Error('todo');},
    ls: function (){throw new Error('todo');},

    receiver: S3Receiver,
    receive: S3Receiver
  };

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

    // Normalize `saveAs()` option:
    // options.saveAs() <==> options.rename() <==> options.getFilename() <==> options.getFileName()
    options.saveAs = options.saveAs || options.rename;
    options.saveAs = options.saveAs || options.getFileName;
    options.saveAs = options.saveAs || options.getFilename;

    _.defaults(options, {

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

    var Writable = require('stream').Writable;
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
        // console.log'************** Garbage collecting file `' + __newFile.filename + '` located @ ' + filePath + '...');

        // TODO: cancel upload (or delete file from S3 if necessary)
        // fsx.unlink(filePath, function(gcErr) {
        //   // Ignore "doesn't exist" errors
        //   if (gcErr) {
        //     if (gcErr.code !== 'ENOENT') return next([err].concat([gcErr]));
        //   }
        //   return next(err);
        // });
      }

      // Determine location where file should be written:
      // -------------------------------------------------------
      var filePath, dirPath, filename;
      dirPath = path.resolve(options.dirname);
      filename = options.saveAs(__newFile);
      filePath = path.join(dirPath, filename);
      // -------------------------------------------------------


      console.log(('Receiver: Received file `' + __newFile.filename + '` from an Upstream.').grey);

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


