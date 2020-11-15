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

    const host = (this.domain !== 'digitaloceanspaces.com')
            ? `${bucket}.${this.service}.${this.region}.${this.domain}`
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

    const credentialScope = datestamp + '/' + this.region + '/' + this.service + '/' + 'aws4_request';
    const stringToSign = algorithm + '\n' + amzdate + '\n' + credentialScope + '\n' + sha256(canonicalRequest);

    const signingKey = getSignatureKey(this.secretKey, datestamp, this.region, this.service);
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

S3.prototype.getPublicUrl = function (params) {
    bucket = params.bucket;
    key = params.key;
    expiration_time_limit = params.expiration_time_limit || '86400';

    const amzdate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const datestamp = amzdate.slice(0, 8);

    $canonical_request = "GET" + "\n" +
            `${key}` + "\n" +
            "X-Amz-Algorithm=" + "AWS4-HMAC-SHA256" + "&" +
            "X-Amz-Credential=" + `${this.accessKey}%2F${datestamp}%2F${this.region}%2F${this.service}%2Faws4_request` + "&" +
            "X-Amz-Date=" + `${amzdate}` + "&" +
            "X-Amz-Expires=" + `${expiration_time_limit}` + "&" +
            "X-Amz-SignedHeaders=" + "host" + "\n" +
            `host:${bucket}.${this.service}.${this.region}.${this.domain}` + "\n" +
            "\n" +
            "host" + "\n" +
            "UNSIGNED-PAYLOAD";


    $hashed_canonical_request = sha256($canonical_request);
    stringToSign = "AWS4-HMAC-SHA256" + "\n" +
            `${amzdate}` + "\n" +
            `${datestamp}/${this.region}/${this.service}/aws4_request` + "\n" +
            `${$hashed_canonical_request}`;

    const signingKey = getSignatureKey(this.secretKey, datestamp, this.region, this.service);
    const signature = hmacSha256(stringToSign, signingKey);

    $signed_get_url = `https://${bucket}.${this.service}.${this.region}.${this.domain}` +
            `${key}` + "?" +
            "X-Amz-Algorithm=" + "AWS4-HMAC-SHA256" + "&" +
            "X-Amz-Credential=" + `${this.accessKey}%2F${datestamp}%2F${this.region}%2F${this.service}%2Faws4_request` + "&" +
            "X-Amz-Date=" + amzdate + "&" +
            "X-Amz-Expires=" + expiration_time_limit + "&" +
            "X-Amz-SignedHeaders=" + "host" + "&" +
            "X-Amz-Signature=" + signature;

    return $signed_get_url;
}

function S3(config) {
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.region = config.region;
    this.domain = (config.domain !== undefined) ? config.domain : defaultDomain;
    this.headers = {};
    this.service = 's3';


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
