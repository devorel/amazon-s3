# scaleway-s3
Read and write objects to scaleway S3 using fetch()

## Install
```
$ npm install scaleway-s3
```

## Usage
```javascript
var S3 = require('scaleway-s3')
global.fetch = require('node-fetch')

var s3 = new S3({
    accessKey: '<private accessKey>',
    secretKey: '<private secretKey>',
    region: 'fr-par',
    domain: 'scw.cloud'
});

(async function() {
    try {

        let bucket = 'testbucket';
        let key = '/a/test/file.txt';

        let body = 'test file contents';
        let putResponse = await s3.putObject({bucket, key, body})
        console.log(`put status: ${putResponse.status}`)
        console.log(`put response body: '${await putResponse.text()}'`)

        let expiration_time_limit = 86400;
        let PublicUrl = s3.getPublicUrl({bucket, key, expiration_time_limit})
        console.log(`Public Url: ${PublicUrl}`)
        
        let getResponse = await s3.getObject({bucket, key});
        console.log(`get status: ${getResponse.status}`)
        console.log(`get response body: '${await getResponse.text()}'`)

        let putResponse2 = await s3.glacierObject({bucket, key})
        console.log(`put status: ${putResponse2.status}`)
        console.log(`put response body: '${await putResponse2.text()}'`)

        let days = 250;
        let getResponse1 = await s3.restoreObject({bucket, key, days});
        console.log(`get status: ${getResponse1.status}`)
        console.log(`get response body: '${await getResponse1.text()}'`)


        let delResponse = await s3.deleteObject({bucket, key});

        console.log(`del status: ${delResponse.status}`)
        console.log(`del response body: '${await delResponse.text()}'`)
    }
    catch (ex) {
        console.log(ex)
    }
}());
```

## License
MIT license; see [LICENSE](./LICENSE).
