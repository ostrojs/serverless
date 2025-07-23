const { IncomingMessage } = require('http');
const { URLSearchParams } = require('url');
const { Readable } = require('stream');
const { Duplex } = require('stream');

class MockSocket extends Duplex {
  constructor(options = {}) {
    super();
    this._remoteAddress = options.remoteAddress || '';
    this.encrypted = options.encrypted || false;
  }

  get remoteAddress() {
    return this._remoteAddress;
  }

  setRemoteAddress(addr) {
    this._remoteAddress = addr;
  }

  _read() { }
  _write(chunk, encoding, callback) {
    callback();
  }
}

class Request extends IncomingMessage {
  constructor(event, context = {}, platform) {
    const {
      method,
      url,
      headers,
      query,
      pathParams,
      rawBodyBuf,
      remoteAddress,
      isEncrypted
    } = Request._normalize(event, context, platform);

    const mockSocket = new MockSocket({
      remoteAddress,
      encrypted: isEncrypted
    });

    super(mockSocket);

    this.event = event;
    this.context = context;
    this._platform = platform;

    this.method = method || 'GET';
    this.url = url || '/';
    this.headers = headers || {};
    this.query = query || {};
    this.params = pathParams || {};

    this.httpVersion = '1.1';
    this.httpVersionMajor = 1;
    this.httpVersionMinor = 1;

    if (rawBodyBuf?.length) {

      this.push(rawBodyBuf);
    }
    this.push(null); // always end the stream

    this.body = rawBodyBuf;

  }

  static _normalize(event, context, platform) {
    let method = 'GET',
      url = '/',
      headers = {},
      query = {},
      pathParams = {},
      cookies = [],
      rawBodyBuf = event.body ? (event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body)) : Buffer.alloc(0),
      remoteAddress = '',
      isEncrypted = false;

    switch (platform) {
      case 'aws_http':
        method = event.requestContext.http.method;
        url = event.rawPath + (event.rawQueryString ? `?${event.rawQueryString}` : '');
        headers = event.headers || {};
        query = event.rawQueryString
          ? Object.fromEntries(new URLSearchParams(event.rawQueryString))
          : {};
        pathParams = event.pathParameters || {};
        cookies = event.cookies || [];
        remoteAddress = event.requestContext?.http?.sourceIp ||
          headers['x-forwarded-for']?.split(',')[0] || '';
        isEncrypted = headers['x-forwarded-proto'] === 'https';
        break;

      case 'aws_rest':
        method = event.httpMethod;
        url = event.path;
        headers = event.headers || {};
        query = event.queryStringParameters || {};
        pathParams = event.pathParameters || {};
        cookies = headers.Cookie
          ? headers.Cookie.split(';').map(c => c.trim())
          : [];
        remoteAddress = headers['x-forwarded-for']?.split(',')[0] || '';
        isEncrypted = headers['x-forwarded-proto'] === 'https';
        break;

      case 'azure':
        const req = context.req || event;
        method = req.method;
        url = req.url;
        headers = req.headers || {};
        query = req.query || {};
        pathParams = req.params || {};
        cookies = headers.cookie
          ? headers.cookie.split(';').map(c => c.trim())
          : [];
        remoteAddress = headers['x-forwarded-for']?.split(',')[0] || '';
        isEncrypted = headers['x-forwarded-proto'] === 'https';
        if (req.rawBody instanceof Buffer) rawBodyBuf = req.rawBody;
        else if (req.rawBody) rawBodyBuf = Buffer.from(req.rawBody);
        break;

      case 'gcp':
        method = event.method || event.httpMethod;
        url = event.url ||
          (event.path + (event.query ? '?' + new URLSearchParams(event.query).toString() : ''));
        headers = event.headers || {};
        query = event.query || {};
        pathParams = event.params || {};
        cookies = headers.cookie
          ? headers.cookie.split(';').map(c => c.trim())
          : [];
        remoteAddress = headers['x-forwarded-for']?.split(',')[0] || '';
        isEncrypted = headers['x-forwarded-proto'] === 'https';
        break;

      default:
        method = event.method || 'GET';
        url = event.url || '/';
        headers = event.headers || {};
        query = event.rawQueryString || {};
        pathParams = event.params || {};
        cookies = headers.cookie
          ? headers.cookie.split(';').map(c => c.trim())
          : [];
        remoteAddress = headers['x-forwarded-for']?.split(',')[0] || '127.0.0.1';
        isEncrypted = headers['x-forwarded-proto'] === 'https';
    }

    if (!headers.cookie && cookies.length > 0) {
      headers.cookie = cookies.join('; ');
    }

    return {
      method,
      url,
      headers,
      query,
      pathParams,
      cookies,
      rawBodyBuf,
      remoteAddress,
      isEncrypted
    };
  }
}

module.exports = Request;
