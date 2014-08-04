// To use this file, run:
//
// key=YOUR_AWS_KEY_HERE secret=YOUR_AWS_SECRET_HERE node encrypt-test-credentials
//
// This will recompile the .travis.yml file using

var buildYml = require('./standalone/encrypt-and-recompile-for-travis');
buildYml({
  repo: 'balderdashy/skipper-s3',
  envVars: {
    key: process.env.KEY,
    secret: process.env.SECRET
  }
});

