var AWS = require('aws-sdk');
var flaverr = require('flaverr');

// See
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3/ManagedUpload.html#httpUploadProgress-event

var source = '/Users/mikermcneil/Desktop/video-downsampled.mov';
var awsAccessKey = process.argv[2];
var awsSecret = process.argv[3];
var bucketName = 'experiment-jun28-2018';
var maxBytes = 20000000;

console.log('Using AWS access key:', awsAccessKey);
console.log('Using AWS secret:', awsSecret);
console.log('Using bucket:', bucketName);
console.log('Uploading file:', source);
console.log('Max bytes:', maxBytes);

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

var wasMaxBytesQuotaExceeded;

var s3ManagedUpload = s3.upload({
  Bucket: bucketName,
  Key: require('path').basename(source),
  Body: fileStream
}, function (err, data) {
  if (flaverr.taste({name: 'RequestAbortedError'}, err) && wasMaxBytesQuotaExceeded) {
    err = flaverr({code: 'E_EXCEEDS_UPLOAD_LIMIT'}, new Error('Upload too big!'));
    console.log('Quota exceeded', err);
  } else if (err) {
    console.log('Upload error', err);
  } else {
    console.log('Upload success', data['Location']);
  }
});//_∏_

s3ManagedUpload.on('httpUploadProgress', (event)=>{
  if (event.loaded > maxBytes) {
    console.log('UPLOAD ('+event.loaded+') EXCEEDED MAX BYTES!');
    wasMaxBytesQuotaExceeded = true;
    s3ManagedUpload.abort();
  } else {
    console.log(event.loaded + ' of ' + event.total + ' bytes');
  }
});//œ


