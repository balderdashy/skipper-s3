var AWS = require('aws-sdk');

// Based on:
// https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/requests-using-stream-objects.html

var source = 'foo.txt';
var destination = '/Users/mikermcneil/Desktop/downloaded-foo.txt';
var awsAccessKey = process.argv[2];
var awsSecret = process.argv[3];
var bucketName = 'experiment-jun28-2018';

console.log('Using AWS access key:', awsAccessKey);
console.log('Using AWS secret:', awsSecret);
console.log('Using bucket:', bucketName);
console.log('Downloading file in S3:', source);
console.log('Downloading file to:', destination);

var s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  region: 'us-west-2',
  accessKeyId: awsAccessKey,
  secretAccessKey: awsSecret
});


var readable = s3.getObject({
  Bucket: bucketName,
  Key: source,
})
.createReadStream();
readable.on('error', (err)=>{
  console.error('s3 download stream error:',err);
});

var drain = require('fs').createWriteStream(destination);
drain.on('error', (err)=>{
  console.error('local filesystem write error:',err);
});

readable.pipe(drain);
console.log('Download Success!');


// wtf:
//
// s3.getObject({
//   Bucket: bucketName,
//   Key: require('path').basename(filePath),
// }, function (err, data) {
//   if (err) {
//     console.log('Error', err);
//   } if (data) {
//     console.log('Download Success', data);
//   }
// });
