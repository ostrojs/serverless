const { Readable } = require('stream');
class Request extends Readable {
  static fromEvent(event) {
    const req = new Readable();
    if (event.body) {
      req.push(event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body);
    }
    req.push(null);

    req.method = event.httpMethod;
    req.url = event.rawPath || event.path;
    req.headers = event.headers || {};
    req.query = event.queryStringParameters || {};
    req.connection = {};
    req.socket = {};

    return req;
  }
}

module.exports = Request;
