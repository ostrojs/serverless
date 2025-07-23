const { ServerResponse } = require('http');
const { Writable } = require('stream');
const { normalizeHeaders } = require('../utils');
class Response extends ServerResponse {

  constructor(resolve) {
    super({ writable: true } instanceof Writable ? { writable: true } : new Writable());
    this._resolve = resolve;
    this._chunks = [];
    this.$isBase64Encoded = true;
  }

  end(chunk, ...args) {
    if (chunk) {
      this.write(chunk);
    }
    const buffer = Buffer.concat(this._chunks)
    const isBase64Encoded = this.isBase64Encoded();
    const headers = this.getHeaders()
    const setCookieKey = Object.keys(headers).find(
      key => key.toLowerCase() === 'set-cookie'
    );
    let setCookieHeader = [];
    if (setCookieKey) {
      setCookieHeader = headers[setCookieKey];
      delete headers[setCookieKey];
    }
    this._resolve({
      statusCode: this.statusCode,
      headers: normalizeHeaders(headers),
      cookies: setCookieHeader,
      body: isBase64Encoded ? buffer.toString('base64') : buffer.toString('utf8'),
      isBase64Encoded,
    });
    return super.end(...args);
  }

  write(chunk, ...args) {
    if (typeof chunk === 'string') {
      this._chunks.push(Buffer.from(chunk));
    } else {
      this._chunks.push(chunk);
    }
    return super.write(chunk, ...args);
  }

  isBase64Encoded() {
    return this.$isBase64Encoded
  }

  encode(endcodin) {
    if (endcodin && endcodin.toLowerCase() === 'base64') {
      this.$isBase64Encoded = true;
    } else {
      this.$isBase64Encoded = false;
    }
    return this;
  }

}
module.exports = Response;
