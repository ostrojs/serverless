const { ServerResponse } = require('http');
const { Writable } = require('stream');
const { normalizeHeaders } = require('../utils');

class Response extends ServerResponse {
  constructor(resolve, platform, getwayType) {
    const dummyWritable = new Writable({
      write(chunk, encoding, callback) {
        callback(); // noop
      }
    });

    super(dummyWritable);

    this._resolve = resolve;
    this._chunks = [];
    this.$isBase64Encoded = true;
    this._platform = platform;
    this._getwayType = getwayType;
  }

  write(chunk, ...args) {
    if (typeof chunk === 'string') {
      this._chunks.push(Buffer.from(chunk));
    } else if (Buffer.isBuffer(chunk)) {
      this._chunks.push(chunk);
    } else {
      throw new TypeError('Response.write() expects string or Buffer');
    }
  }

  end(chunk, ...args) {
    if (chunk) this.write(chunk);

    const result = this.toJSON();
    this._resolve(result);
   
    return super.end(null, ...args);
  }

  encode(encoding) {
    this.$isBase64Encoded = (encoding && encoding.toLowerCase() === 'base64');
    return this;
  }

  isBase64Encoded() {
    return this.$isBase64Encoded;
  }

  isPlatform(platform) {
    platform = typeof platform === 'string' ? [platform] : platform;
    return platform && platform.includes(this._platform);
  }

  toJSON() {
    const buffer = Buffer.concat(this._chunks);
    const isBase64Encoded = this.isBase64Encoded();
    const body = isBase64Encoded ? buffer.toString('base64') : buffer.toString('utf8');

    const headers = normalizeHeaders(this.getHeaders(), this._platform, this._getwayType);

    headers['content-length'] = buffer.length;

    let cookies = undefined;
    if (this.isPlatform('aws')) {
      const setCookieKey = Object.keys(headers).find(
        key => key.toLowerCase() === 'set-cookie'
      );
      if (setCookieKey) {
        cookies = headers[setCookieKey];
        delete headers[setCookieKey];
      }
    }

    const statusCode = this.statusCode || 200;

    switch (this._platform) {
      case 'azure':
        return {
          status: statusCode,
          headers,
          body,
        };
      case 'gcp':
        return {
          statusCode,
          headers,
          body,
        };
      case 'aws':
        return {
          statusCode,
          headers,
          body,
          cookies,
          isBase64Encoded,
        };
      default:
        return {
          statusCode,
          headers,
          body,
          isBase64Encoded,
        };
    }
  }
}

module.exports = Response;
