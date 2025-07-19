const { Writable } = require('stream');
class Respose extends Writable {
  constructor(resolve) {
    super();
    this.chunks = [];
    this.statusCode = 200;
    this.headers = {};
    this._resolve = resolve;
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(chunk);
    callback();
  }

  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    if (headers) this.headers = { ...this.headers, ...headers };
  }

  setHeader(key, value) {
    this.headers[key] = value;
  }

  getHeaders() {
    return this.headers;
  }
  getHeader(key) {
    return this.headers[key];
  }
  _implicitHeader() {
    if (!this.headersSent) {
      this.headersSent = true;
    }
  }
  end(chunk) {
    if (chunk) this.write(chunk, null, () => { });
    const body = Buffer.concat(this.chunks).toString();
    this._resolve({
      statusCode: this.statusCode,
      headers: this.headers,
      body,
    });
  }
}

module.exports = Respose;
