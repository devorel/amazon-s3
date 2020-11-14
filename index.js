var sha256 = require('crypto-js/sha256');
var hmacSha256 = require('crypto-js/hmac-sha256');

/*
 Documentation:
 https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
 */

function getSignatureKey(key, dateStamp, regionName, serviceName) {
    var keyDate = hmacSha256(dateStamp, "AWS4" + key);
    var keyRegion = hmacSha256(regionName, keyDate);
    var keyService = hmacSha256(serviceName, keyRegion);
    var keySigning = hmacSha256("aws4_request", keyService)
    return keySigning;
}

S3.prototype.signAndSendRequest = function (method, bucket, path, body) {

    const amzdate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
    const datestamp = amzdate.slice(0, 8)

    const service = 's3';
    const host = (this.domain !== 'digitaloceanspaces.com')
            ? `${bucket}.${service}.${this.region}.${this.domain}`
            : `${bucket}.${this.region}.${this.domain}`

    const endpoint = `https://${host}${path}`;

    const canonicalUri = path;
    const canonicalQuerystring = '';
    const payloadHash = 'UNSIGNED-PAYLOAD';// sha256(body).toString();

    const Headers = [`host:${host}`, `x-amz-content-sha256:${payloadHash}`, `x-amz-date:${amzdate}`];
    const canonicalHeaders = Headers.join(`\n`);//`host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzdate}\n`;
    const signedHeaders = Headers.map(i => i.split(":")[0]).join(';').toLowerCase(); // 'host;x-amz-content-sha256;x-amz-date';

    const algorithm = 'AWS4-HMAC-SHA256';

    const canonicalRequest = method + '\n' + canonicalUri + '\n' + canonicalQuerystring + '\n' + canonicalHeaders + '\n\n' + signedHeaders + '\n' + payloadHash;

    const credentialScope = datestamp + '/' + this.region + '/' + service + '/' + 'aws4_request';
    const stringToSign = algorithm + '\n' + amzdate + '\n' + credentialScope + '\n' + sha256(canonicalRequest);

    const signingKey = getSignatureKey(this.secretKey, datestamp, this.region, service);
    const signature = hmacSha256(stringToSign, signingKey);

    const authorizationHeader = algorithm + ' ' + 'Credential=' + this.accessKey + '/' + credentialScope + ',' + 'SignedHeaders=' + signedHeaders + ',' + 'Signature=' + signature;
    this.headers = {...this.headers, ...{
                'Authorization': authorizationHeader,
                'x-amz-content-sha256': payloadHash,
                'x-amz-date': amzdate,
        }};


    let params = {
        method: method,
        headers: this.headers,
    };

    if (body) {// !== '' && body !== null && body !== undefined
        params.body = body;
    }

    console.log(endpoint);
    console.log(params);

    return fetch(endpoint, params);
}

//
// Any S3 compatible service provider can be used. The default is AWS.
//
//   AWS             amazonaws.com
//   Digital Ocean   digitaloceanspaces.com
//   Scaleway        scw.cloud
//
var defaultDomain = 'amazonaws.com'


function S3(config) {
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.region = config.region;
    this.domain = (config.domain !== undefined) ? config.domain : defaultDomain;
    this.headers = {};


}

S3.prototype.glacierObject = function (params) {
    this.headers = {...this.headers, ...{'x-amz-copy-source': '/' + params.bucket + params.key, 'x-amz-storage-class': 'GLACIER'}};
    return this.signAndSendRequest('PUT', params.bucket, params.key);
}

S3.prototype.restoreObject = function (params) {
    return this.signAndSendRequest('PUT', params.bucket, params.key, `<RestoreRequest xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Days>${params.days || 250}</Days></RestoreRequest>`);
}

S3.prototype.getObject = function (params) {
    return this.signAndSendRequest('GET', params.bucket, params.key);
}

S3.prototype.putObject = function (params) {
    return this.signAndSendRequest('PUT', params.bucket, params.key, params.body);
}

S3.prototype.deleteObject = function (params) {
    return this.signAndSendRequest('DELETE', params.bucket, params.key);
}

module.exports = S3;
