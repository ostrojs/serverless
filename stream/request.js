const { Readable } = require('stream');
const { URLSearchParams } = require('url');

class Request extends Readable {
  constructor(event, context = {}, platform) {
    super();

    this.event = event;
    this.context = context;
    this._source = platform;

    const {
      method,
      url,
      headers,
      query,
      pathParams,
      rawBodyBuf,
    } = this._normalize(event, context);

    if (rawBodyBuf?.length) this.push(rawBodyBuf);
    this.push(null); 

    this.method = method || 'GET';
    this.url = url || '/';
    this.headers = headers || {};
    this.query = query || {};
    this.params = pathParams || {};

    this.httpVersion = '1.1';
    this.httpVersionMajor = 1;
    this.httpVersionMinor = 1;

    this.connection = this.socket = {
      encrypted: headers['x-forwarded-proto'] === 'https',
      remoteAddress:
        event.requestContext?.http?.sourceIp ||
        headers['x-forwarded-for']?.split(',')[0] ||
        '',
    };

    this.rawBody = rawBodyBuf;
    this._platform = platform;
  }

  _normalize(event, context) {
    let method = 'GET',
      url = '/',
      headers = {},
      query = {},
      pathParams = {},
      cookies = [],
      rawBodyBuf = Buffer.alloc(0);

    switch (this._source) {
      case 'aws_http': {
        method = event.requestContext.http.method;
        url = event.rawPath + (event.rawQueryString ? `?${event.rawQueryString}` : '');
        headers = event.headers || {};
        query = event.rawQueryString
          ? Object.fromEntries(new URLSearchParams(event.rawQueryString))
          : {};
        pathParams = event.pathParameters || {};
        cookies = event.cookies || [];

        if (!headers.cookie && cookies.length > 0) {
          headers.cookie = cookies.join('; ');
        }

        if (event.body) {
          rawBodyBuf = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : Buffer.from(event.body);
        }
        break;
      }

      case 'aws_rest': {
        method = event.httpMethod;
        url = event.path;
        headers = event.headers || {};
        query = event.queryStringParameters || {};
        pathParams = event.pathParameters || {};
        cookies = headers.Cookie
          ? headers.Cookie.split(';').map(c => c.trim())
          : [];

        if (!headers.cookie && cookies.length > 0) {
          headers.cookie = cookies.join('; ');
        }

        if (event.body) {
          rawBodyBuf = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : Buffer.from(event.body);
        }
        break;
      }

      case 'azure': {
        const req = context.req || event;
        method = req.method;
        url = req.url;
        headers = req.headers || {};
        query = req.query || {};
        pathParams = req.params || {};
        cookies = headers.cookie
          ? headers.cookie.split(';').map(c => c.trim())
          : [];

        if (!headers.cookie && cookies.length > 0) {
          headers.cookie = cookies.join('; ');
        }

        if (req.rawBody instanceof Buffer) rawBodyBuf = req.rawBody;
        else if (req.rawBody) rawBodyBuf = Buffer.from(req.rawBody);
        break;
      }

      case 'gcp': {
        method = event.method || event.httpMethod;
        url =
          event.url ||
          (event.path + (event.query ? '?' + new URLSearchParams(event.query).toString() : ''));
        headers = event.headers || {};
        query = event.query || {};
        pathParams = event.params || {};
        cookies = headers.cookie
          ? headers.cookie.split(';').map(c => c.trim())
          : [];

        if (!headers.cookie && cookies.length > 0) {
          headers.cookie = cookies.join('; ');
        }

        if (event.body) {
          rawBodyBuf = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : Buffer.from(event.body);
        }
        break;
      }

      default: {
        method = event.method || 'GET';
        url = event.url || '/';
        headers = event.headers || {};
        query = event.rawQueryString || {};
        pathParams = event.params || {};
        cookies = headers.cookie
          ? headers.cookie.split(';').map(c => c.trim())
          : [];

        if (!headers.cookie && cookies.length > 0) {
          headers.cookie = cookies.join('; ');
        }

        if (event.body) {
          rawBodyBuf = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : Buffer.from(event.body);
        }
      }
    }

    return { method, url, headers, query, pathParams, cookies, rawBodyBuf };
  }

}

module.exports = Request;
