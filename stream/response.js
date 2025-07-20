const { Writable } = require('stream');
const { normalizeHeaders } = require('../utils');

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

    if (headers) {
      let parsedHeaders = {};

      if (typeof headers === 'string') {
        // Parse headers string into key-value pairs
        headers.split('\n').forEach(line => {
          const [key, ...rest] = line.split(':');
          if (key && rest.length > 0) {
            parsedHeaders[key.trim()] = rest.join(':').trim();
          }
        });
      } else if (typeof headers === 'object') {
        parsedHeaders = headers;
      }

      this.headers = { ...this.headers, ...parsedHeaders };
    }
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
      headers: normalizeHeaders(this.headers),
      body,
    });
  }
}

module.exports = Respose;
