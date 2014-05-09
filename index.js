/**
 * Module dependencies
 */

var Writable = require('stream').Writable;
var fsx = require('fs-extra');
var path = require('path');
var _ = require('lodash');



/**
 * skipper-disk
 *
 * @param  {Object} options
 * @return {Object}
 */

module.exports = function DiskStore (options) {
  options = options || {};

  return {

    touch: function (){throw new Error('todo');},
    rm: function (){throw new Error('todo');},
    ls: function (){throw new Error('todo');},
    write: function (){throw new Error('todo');},

    receiver: DiskReceiver,
    receive: DiskReceiver
  };
};



/**
 * A simple receiver for Skipper that writes Upstreams to
 * disk at the configured path.
 *
 * Includes a garbage-collection mechanism for failed
 * uploads.
 *
 * @param  {Object} options
 * @return {Stream.Writable}
 */
function DiskReceiver (options) {
  options = options || {};

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

    // By default, upload files to `./.tmp/uploads` (relative to cwd)
    dirname: '.tmp/uploads'
  });

  var receiver__ = Writable({
    objectMode: true
  });

  // This `_write` method is invoked each time a new file is received
  // from the Readable stream (Upstream) which is pumping filestreams
  // into this receiver.  (filename === `__newFile.filename`).
  receiver__._write = function onFile(__newFile, encoding, done) {

    // Determine location where file should be written:
    // -------------------------------------------------------
    var filePath, dirPath, filename;
    if (options.id) {
      // If `options.id` was specified, use it directly as the path.
      filePath = options.id;
      dirPath = path.dirname(filePath);
      filename = path.basename(filePath);
    }
    else {
      // Otherwise, use the more sophisiticated options:
      dirPath = path.resolve(options.dirname);
      filename = options.saveAs(__newFile);
      filePath = path.join(dirPath, filename);
    }
    // -------------------------------------------------------


    // Garbage-collect the bytes that were already written for this file.
    // (called when a read or write error occurs)
    function gc(err) {
      // console.log('************** Garbage collecting file `' + __newFile.filename + '` located @ ' + filePath + '...');
      fsx.unlink(filePath, function(gcErr) {
        // Ignore "doesn't exist" errors
        if (gcErr) {
          if (gcErr.code !== 'ENOENT') return done([err].concat([gcErr]));
        }
        return done(err);
      });
    }

    // Ensure necessary parent directories exist:
    fsx.mkdirs(dirPath, function (mkdirsErr) {
      // If we get an error here, it's probably because the Node
      // user doesn't have write permissions at the designated
      // path.
      if (mkdirsErr) {
        return done(mkdirsErr);
      }

      var outs = fsx.createWriteStream(filePath, encoding);
      __newFile.on('error', function (err) {
        // console.log('***** READ error on file ' + __newFile.filename, '::', err);
      });
      outs.on('error', function failedToWriteFile(err) {
        // console.log('Error on output stream- garbage collecting unfinished uploads...');
        gc(err);
      });
      outs.on('finish', function successfullyWroteFile() {
        done();
      });
      __newFile.pipe(outs);
    });

  };

  return receiver__;

}
