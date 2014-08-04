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


// ----------------------------------------------------------------------------
// Could get even fancier by doing something like this:
// (from http://docs.travis-ci.com/user/travis-pro/)
//
//
// > For the build to decrypt the file, add a before_script section to your
// > `.travis.yml` that runs the opposite command of the above:
// >
// > before_script:
// >   - secret=`openssl rsautl -decrypt -inkey ~/.ssh/id_rsa -in secret`
// >   - openssl aes-256-cbc -k "$secret" -in config.xml.enc -d -a -out config.xml
// ----------------------------------------------------------------------------
