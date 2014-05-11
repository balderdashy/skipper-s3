# [<img title="skipper-s3 - S3 adapter for Skipper" src="http://i.imgur.com/P6gptnI.png" width="200px" alt="skipper emblem - face of a ship's captain"/>](https://github.com/balderdashy/skipper-s3) S3 Blob Adapter

[![NPM version](https://badge.fury.io/js/skipper-s3.png)](http://badge.fury.io/js/skipper-s3) &nbsp; &nbsp;
[![Build Status](https://travis-ci.org/balderdashy/skipper-s3.svg?branch=master)](https://travis-ci.org/balderdashy/skipper-s3)

S3 adapter for receiving streams of file streams. Particularly useful for streaming multipart file uploads via [Skipper](github.com/balderdashy/skipper).


> WARNING
>
> THIS MODULE IS UNDER ACTIVE DEVELOPMENT AND NOT READY FOR PRODUCTION USE.


========================================

## Installation

```
$ npm install skipper-s3 --save
```

========================================

## Usage

First instantiate a blob adapter (`blobAdapter`):

```js
var blobAdapter = require('skipper-s3')();
```

Build a receiver (`receiving`):

```js
var receiving = blobAdapter.receive();
```

Then stream file(s) from a particular field (`req.file('foo')`):

```js
req.file('foo').upload(receiving, function (err, filesUploaded) {
  // ...
});
```

========================================

## Options

All options may be passed either into the blob adapter's factory method:

```js
var blobAdapter = require('skipper-s3')({
  // These options will be applied unless overridden.
});
```

Or directly into a receiver:

```js
var receiving = blobAdapter.receive({
  // Options will be applied only to this particular receiver.
});
```


| Option    | Type       | Details |
|-----------|:----------:|---------|
| `key`     | ((string)) | Your AWS "Access Key ID", e.g. `"BZIZIZFFHXR27BFUOZ7"` (_required_) |
| `secret`     | ((string)) | Your AWS "Secret Access Key", e.g. `"L8ZN3aP1B9qkUgggUnEZ6KzrQJbJxx4EMjNaWy3n"` (_required_) |
| `bucket`     | ((string)) | The bucket to upload your files into, e.g. `"my_cool_file_uploads"` (_required_) |
| `dirname`  | ((string)) | The path to the "directory" on S3 where file uploads should be streamed.  Should be specified as an absolute path (e.g. `/avatar-uploads/admin/`) from the root of the bucket.  Defaults to `"/"`
| `saveAs()`  | ((function)) | An optional function that can be used to define the logic for naming files. For example: <br/> `function (file) {return Math.random()+file.name;} });` <br/> By default, the filename of the uploaded file is used, including the extension (e.g. `"Screen Shot 2014-05-06 at 4.44.02 PM.jpg"`.  If a file already exists at `dirname` with the same name, it will be overridden. |
| `maxBytes` | ((integer)) | Max total number of bytes permitted for a given upload, calculated by summing the size of all files in the upstream; e.g. if you created an upstream that watches the "avatar" field (`req.file('avatar')`), and a given request sends 15 file fields with the name "avatar", `maxBytes` will check the total number of bytes in all of the 15 files.  If maxBytes is exceeded, the already-written files will be left untouched, but unfinshed file uploads will be garbage-collected, and not-yet-started uploads will be cancelled. |

========================================

## Advanced Usage

#### `upstream.pipe(receiving)`

As an alternative to the `upload()` method, you can pipe an incoming **upstream** returned from `req.file()` (a Readable stream of Readable binary streams) directly to the **receiver** (a Writable stream for Upstreams.)

```js
req.file('foo').pipe(receiving);
```

There is no performance benefit to using `.pipe()` instead of `.upload()`-- they both use streams2.  The `.pipe()` method is available merely as a matter of flexibility/chainability.  Be aware that `.upload()` handles the `error` and `finish` events for you; if you choose to use `.pipe()`, you will of course need to listen for these events manually:

```js
req.file('foo')
.on('error', function onError() { ... })
.on('finish', function onSuccess() { ... })
.pipe(receiving)
```

========================================

## Contribute

See `CONTRIBUTING.md`.

####Jump in and run the tests:

```sh
git clone git@github.com:balderdashy/skipper-s3.git
cd skipper-s3
npm install
KEY= your_aws_access_key SECRET=your_aws_access_secret BUCKET=your_s3_bucket npm test
```

========================================

### License

**[MIT](./LICENSE)**
&copy; 2013, 2014-

[Mike McNeil](http://michaelmcneil.com), [Balderdash](http://balderdash.co) & contributors

See `LICENSE.md`.

This module is part of the [Sails framework](http://sailsjs.org), and is free and open-source under the [MIT License](http://sails.mit-license.org/).


![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png)


[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/a22d3919de208c90c898986619efaa85 "githalytics.com")](http://githalytics.com/balderdashy/sails.io.js)
