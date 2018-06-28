var AWS = require('aws-sdk');

// Based on:
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#deleteObjects-property

var source = 'foo.txt';
var awsAccessKey = process.argv[2];
var awsSecret = process.argv[3];
var bucketName = 'experiment-jun28-2018';

console.log('Using AWS access key:', awsAccessKey);
console.log('Using AWS secret:', awsSecret);
console.log('Using bucket:', bucketName);
console.log('Deleting file in S3:', source);

var s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  region: 'us-west-2',
  accessKeyId: awsAccessKey,
  secretAccessKey: awsSecret
});


s3.deleteObjects({
  Bucket: bucketName,
  Delete: {
    Quiet: false,
    Objects: [
      {
        Key: source
      }
    ]
  }
}, (err, result)=>{
  if (err){
    console.error('s3 rm error:',err);
    return;
  }

  if (result && result['Errors'] && result['Errors'].length > 0) {
    console.error('s3 rm success!... but there was partial failure.  Got the following errors:', result['Errors']);
    return;
  }

  console.log('s3 rm success!', result);

});//_∏_

