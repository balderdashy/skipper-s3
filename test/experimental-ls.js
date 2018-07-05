var AWS = require('aws-sdk');

// Based on:
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectsV2-property

// Usage:
// node experimental-ls.js AWS_KEY AWS_SECRET


var optionalPrefix = process.env.PREFIX || undefined;
var optionalMaxKeys = undefined;
var awsAccessKey = process.argv[2] || process.env.KEY;
var awsSecret = process.argv[3] || process.env.SECRET;
var bucketName = process.env.BUCKET || 'experiment-jun28-2018';

console.log('Using AWS access key:', awsAccessKey);
console.log('Using AWS secret:', awsSecret);
console.log('Using bucket:', bucketName);
console.log('Listing files in S3 with optional prefix:', optionalPrefix);
console.log('Max keys is set to:', optionalMaxKeys);

// var s3 = new AWS.S3({
//   apiVersion: '2006-03-01',
//   region: 'us-west-2',
//   accessKeyId: awsAccessKey,
//   secretAccessKey: awsSecret
// });


// var s3LsArgins = {
//   Bucket: bucketName,
//   MaxKeys: optionalMaxKeys,
//   Prefix: optionalPrefix
// };
// for (let k in s3LsArgins) {
//   if (s3LsArgins[k] === undefined) {
//     delete s3LsArgins[k];
//   }
// }


// s3.listObjectsV2(s3LsArgins, (err, result)=>{
//   if (err){
//     console.error('s3 ls error:',err);
//     return;
//   }

//   console.log('s3 ls success!', result['Contents']);

// });//_∏_



// Or, using adapter:
// ================================================
var adapter = require('../index')({
  bucket: bucketName,
  region: 'us-west-2',
  key: awsAccessKey,
  secret: awsSecret,
});

adapter.ls(optionalPrefix, (err, results)=>{
  if (err) {
    console.error('s3 ls error:', err);
  } else {
    console.log('s3 ls success!', results);
  }
});//_∏_
// ================================================
