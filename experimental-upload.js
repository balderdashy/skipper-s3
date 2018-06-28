var AWS = require('aws-sdk');


function experiment(filePath, fileStream, bucketName, awsAccessKey, awsSecret){
  var s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    region: 'us-west-2',
    accessKeyId: awsAccessKey,
    secretAccessKey: awsSecret
  });

  // call S3 to retrieve upload file to specified bucket
  s3.upload({
    Bucket: bucketName,
    Key: require('path').basename(filePath),
    Body: fileStream
  }, function (err, data) {
    if (err) {
      console.log('Error', err);
    } if (data) {
      console.log('Upload Success', data.Location);
    }
  });
}//ƒ


console.log('Using AWS access key:', process.argv[2]);
console.log('Using AWS secret:', process.argv[3]);
var filePath = '/Users/mikermcneil/Desktop/foo.txt';
console.log('Uploading file:', filePath);

var fileStream = require('fs').createReadStream(filePath);
fileStream.on('error', (err)=>{
  console.log('File Error', err);
});

experiment(
  filePath,
  fileStream,
  'experiment-jun28-2018',
  process.argv[2],
  process.argv[3]
);
