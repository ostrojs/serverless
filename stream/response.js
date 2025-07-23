const { ServerResponse } = require('http');
const { Writable } = require('stream');
const { normalizeHeaders } = require('../utils');

class Response extends ServerResponse {
  constructor(resolve, platform, getwayType) {
    super({ writable: true } instanceof Writable ? { writable: true } : new Writable());

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

    const result = this.toJSON(); // Automatically uses detected platform
    this._resolve(result);

    return super.end(...args);
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
    return platform.includes(this._platform);
  }

  toJSON() {
    const buffer = Buffer.concat(this._chunks);
    const isBase64Encoded = this.isBase64Encoded();
    const body = isBase64Encoded ? buffer.toString('base64') : buffer.toString('utf8');

    const headers = normalizeHeaders(this.getHeaders(), this._platform, this._getwayType)
    let cookies = '';
    if (this.isPlatform('aws')) {
      const setCookieKey = Object.keys(headers).find(
        key => key.toLowerCase() === 'set-cookie'
      );
      cookies = setCookieKey ? headers[setCookieKey] : undefined;
      if (setCookieKey) {
        delete headers[setCookieKey];
      }
    }

    const platform = this._platform;
    const statusCode = this.statusCode || 200;
    // Per-platform output format adjustment
    switch (platform) {
      case 'azure':
        return {
          status: statusCode,
          headers,
          body,
        };
      case 'gcp':
        // GCP doesn't use the return value; it's streamed via `res`
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
          isBase64Encoded
        }
      default:
        return {
          statusCode,
          headers,
          body,
          isBase64Encoded
        };
    }
  }
}

module.exports = Response;
