const { Readable } = require('stream');
class Request extends Readable {
  static fromEvent(event) {
    const req = new Readable();

    if (event.body) {
      req.push(event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body);
    }
    req.push(null);

    // Support for event structure as per sample
    req.method = event.requestContext?.http?.method || event.http?.method;
    req.url = event.rawPath + (event.rawQueryString ? '?' + event.rawQueryString : '');
    req.headers = event.headers || {};
    req.query = event.rawQueryString
      ? Object.fromEntries(new URLSearchParams(event.rawQueryString))
      : {};
    req.connection = { remoteAddress: event.requestContext?.http?.sourceIp || '' };
    req.socket = req.connection;
    req.body = event.body;

    // Optionally, attach additional context if needed
    req.requestContext = event.requestContext;
    req.isBase64Encoded = event.isBase64Encoded;

    return req;
  }
}

module.exports = Request;
