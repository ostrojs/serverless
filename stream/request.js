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
  constructor(event, context = {}, platform, getwayType) {
    const {
      method,
      url,
      headers,
      query,
      pathParams,
      rawBodyBuf,
      remoteAddress,
      isEncrypted
    } = Request._normalize(event, context, platform, getwayType);
    const mockSocket = new MockSocket({
      remoteAddress,
      encrypted: isEncrypted
    });

    super(mockSocket);

    this.event = event;
    this.context = context;
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
    this.push(null);

    this.body = rawBodyBuf;

  }

  static _normalize(event, context, platform, getwayType) {
    const request = {
      method: 'GET',
      url: '/',
      headers: {},
      query: {},
      pathParams: {},
      cookies: [],
      rawBodyBuf: event.body ? (event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body)) : Buffer.alloc(0),
      remoteAddress: '',
      isEncrypted: false
    }

    switch (platform) {
      case 'aws':
        switch (getwayType) {
          case 'http':
            request.method = event.requestContext.http.method;
            request.url = event.rawPath + (event.rawQueryString ? `?${event.rawQueryString}` : '');
            request.headers = event.headers || {};
            request.query = event.rawQueryString
              ? Object.fromEntries(new URLSearchParams(event.rawQueryString))
              : {};
            request.pathParams = event.pathParameters || {};
            request.cookies = event.cookies || [];
            request.remoteAddress = event.requestContext?.http?.sourceIp ||
              request.headers['x-forwarded-for']?.split(',')[0] || '';
            request.isEncrypted = request.headers['x-forwarded-proto'] === 'https';

            break;
          case 'lambda-url':
            request.method = event.requestContext?.http?.method || 'GET';
            request.url = event.rawPath + (event.rawQueryString ? `?${event.rawQueryString}` : '');
            request.headers = event.headers || {};
            request.query = event.rawQueryString
              ? Object.fromEntries(new URLSearchParams(event.rawQueryString))
              : {};
            request.pathParams = event.pathParameters || {};
            request.cookies = event.cookies || [];
            request.remoteAddress = event.requestContext?.http?.sourceIp ||
              request.headers['x-forwarded-for']?.split(',')[0] || '';
            request.isEncrypted = request.headers['x-forwarded-proto'] === 'https';
            break;

          case 'rest':
            request.method = event.httpMethod;
            request.url = event.path;
            request.headers = event.headers || {};
            request.query = event.queryStringParameters || {};
            request.pathParams = event.pathParameters || {};
            request.cookies = request.headers.Cookie
              ? request.headers.Cookie.split(';').map(c => c.trim())
              : [];
            request.remoteAddress = request.headers['x-forwarded-for']?.split(',')[0] || '';
            request.isEncrypted = request.headers['x-forwarded-proto'] === 'https';
            break;
        }
        break;


      case 'azure':
        const req = context.req || event;
        request.method = req.method;
        request.url = req.url;
        request.headers = req.headers || {};
        request.query = req.query || {};
        request.pathParams = req.params || {};
        request.cookies = request.headers.cookie
          ? request.headers.cookie.split(';').map(c => c.trim())
          : [];
        request.remoteAddress = request.headers['x-forwarded-for']?.split(',')[0] || '';
        request.isEncrypted = request.headers['x-forwarded-proto'] === 'https';
        if (req.rawBody instanceof Buffer) rawBodyBuf = req.rawBody;
        else if (req.rawBody) rawBodyBuf = Buffer.from(req.rawBody);
        break;

      case 'gcp':
        request.method = event.method || event.httpMethod;
        request.url = event.url ||
          (event.path + (event.query ? '?' + new URLSearchParams(event.query).toString() : ''));
        request.headers = event.headers || {};
        request.query = event.query || {};
        request.pathParams = event.params || {};
        request.cookies = request.headers.cookie
          ? request.headers.cookie.split(';').map(c => c.trim())
          : [];
        request.remoteAddress = request.headers['x-forwarded-for']?.split(',')[0] || '';
        request.isEncrypted = request.headers['x-forwarded-proto'] === 'https';
        break;

      default:
        request.method = event.method || 'GET';
        request.url = event.url || '/';
        request.headers = event.headers || {};
        request.query = event.rawQueryString || {};
        request.pathParams = event.params || {};
        request.cookies = request.headers.cookie
          ? request.headers.cookie.split(';').map(c => c.trim())
          : [];
        request.remoteAddress = request.headers['x-forwarded-for']?.split(',')[0] || '127.0.0.1';
        request.isEncrypted = request.headers['x-forwarded-proto'] === 'https';
    }


    if (!request.headers.cookie && request.cookies.length > 0) {
      request.headers.cookie = request.cookies.join('; ');
    }
    return request;
  }
}

module.exports = Request;
