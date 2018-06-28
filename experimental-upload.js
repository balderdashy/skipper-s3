var AWS = require('aws-sdk');

var source = '/Users/mikermcneil/Desktop/foo.txt';
var awsAccessKey = process.argv[2];
var awsSecret = process.argv[3];
var bucketName = 'experiment-jun28-2018';

console.log('Using AWS access key:', awsAccessKey);
console.log('Using AWS secret:', awsSecret);
console.log('Using bucket:', bucketName);
console.log('Uploading file:', source);

var s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  region: 'us-west-2',
  accessKeyId: awsAccessKey,
  secretAccessKey: awsSecret
});


var fileStream = require('fs').createReadStream(source);
fileStream.on('error', (err)=>{
  console.log('File Error', err);
});

s3.upload({
  Bucket: bucketName,
  Key: require('path').basename(source),
  Body: fileStream
}, function (err, data) {
  if (err) {
    console.log('Error', err);
  } if (data) {
    console.log('Upload Success', data.Location);
  }
});


