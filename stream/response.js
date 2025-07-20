const { Writable } = require('stream');
const { normalizeHeaders } = require('../utils');

class Respose extends Writable {
  constructor(resolve) {
    super();
    this.chunks = [];
    this.statusCode = 200;
    this.headers = {};
    this.finished = false;
    this.headersSent = false;
    this.$isBase64Encoded = true;
    this._resolve = resolve;
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(chunk);
    callback();
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

  write(chunk, encoding, callback) {
    this._implicitHeader();
    return super.write(chunk, encoding, callback);
  }
  end(chunk, encoding, callback) {
    if (chunk) this.write(chunk, encoding, () => { });

    const buffer = Buffer.concat(this.chunks);

    let isBase64Encoded = this.isBase64Encoded();

    this.finished = true;

    this._resolve({
      statusCode: this.statusCode,
      headers: normalizeHeaders(this.headers),
      body: isBase64Encoded ? buffer.toString('base64') : buffer.toString('utf8'),
      isBase64Encoded,
    });

    if (typeof callback === 'function') callback();
  }




  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this._implicitHeader();

    if (headers) {
      if (typeof headers === 'object') {
        this.headers = { ...this.headers, ...headers };
      }
    }
  }

  setHeader(key, value) {
    this.headers[key.toLowerCase()] = value;
  }

  getHeader(key) {
    return this.headers[key.toLowerCase()];
  }

  getHeaders() {
    return this.headers;
  }

  hasHeader(key) {
    return key.toLowerCase() in this.headers;
  }

  removeHeader(key) {
    delete this.headers[key.toLowerCase()];
  }

  _implicitHeader() {
    if (!this.headersSent) {
      this.headersSent = true;
    }
  }
}

module.exports = Respose;
