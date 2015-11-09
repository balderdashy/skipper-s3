# [<img title="skipper-s3 - S3 adapter for Skipper" src="http://i.imgur.com/P6gptnI.png" width="200px" alt="skipper emblem - face of a ship's captain"/>](https://github.com/balderdashy/skipper-s3) S3 Blob Adapter

[![NPM version](https://badge.fury.io/js/skipper-s3.png)](http://badge.fury.io/js/skipper-s3) &nbsp; &nbsp;
[![Build Status](https://travis-ci.org/balderdashy/skipper-s3.svg?branch=master)](https://travis-ci.org/balderdashy/skipper-s3)

S3 adapter for receiving [upstreams](https://github.com/balderdashy/skipper#what-are-upstreams). Particularly useful for handling streaming multipart file uploads from the [Skipper](https://github.com/balderdashy/skipper) body parser.


## Installation

```
$ npm install skipper-s3 --save
```

Also make sure you have skipper itself [installed as your body parser](http://beta.sailsjs.org/#/documentation/concepts/Middleware?q=adding-or-overriding-http-middleware).  This is the default configuration in [Sails](https://github.com/balderdashy/sails) as of v0.10.


## Usage

```javascript
req.file('avatar')
.upload({
  adapter: require('skipper-s3'),
  key: 'thekyehthethaeiaghadkthtekey'
  secret: 'AB2g1939eaGAdesoccertournament'
  bucket: 'my_stuff'
}, function whenDone(err, uploadedFiles) {
  if (err) return res.negotiate(err);
  else return res.ok({
    files: uploadedFiles,
    textParams: req.params.all()
  });
});
```


For more detailed usage information and a full list of available options, see the Skipper docs, especially the section on "[Uploading to S3](https://github.com/balderdashy/skipper#uploading-files-to-s3)".


## Contribute

See [ROADMAP.md](https://github.com/balderdashy/skipper-s3/blob/master/ROADMAP.md).

Also be sure to check out [ROADMAP.md in the Skipper repo](https://github.com/balderdashy/skipper/blob/master/ROADMAP.md).

To run the tests:

```sh
git clone git@github.com:balderdashy/skipper-s3.git
cd skipper-s3
npm install
KEY=your_aws_access_key SECRET=your_aws_access_secret BUCKET=your_s3_bucket npm test
```

Please don't check in your aws credentials :)


## License

**[MIT](./LICENSE)**
&copy; 2013, 2014-

[Mike McNeil](http://michaelmcneil.com), [Balderdash](http://balderdash.co) & contributors

See `LICENSE.md`.

This module is part of the [Sails framework](http://sailsjs.org), and is free and open-source under the [MIT License](http://sails.mit-license.org/).


![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png)


[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/a22d3919de208c90c898986619efaa85 "githalytics.com")](http://githalytics.com/balderdashy/skipper-s3)
