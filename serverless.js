const StreamRequest = require('./stream/request');
const StreamResponse = require('./stream/response');
class Serverless {
  constructor() {
    this.stream();
  }

  stream(request = StreamRequest, response = StreamResponse) {
    if (typeof request != 'function') {
      throw new Error('Request class must be function/class');
    }
    if (typeof response != 'function') {
      throw new Error('Response class must function/class');
    }
    Object.defineProperties(this, {
      $streamRequest: {
        value: request,
        writable: true,
        configurable: true,
        enumerable: false
      },
      $streamResponse: {
        value: response,
        writable: true,
        configurable: true,
        enumerable: false
      }
    });
  }

  request(HttpRequest) {
    if (typeof HttpRequest != 'function') {
      throw new Error('HttpRequest class must be function/class')
    }
    Object.defineProperty(this, '$request', { value: HttpRequest })
  }

  response(HttpResponse) {
    if (typeof HttpResponse != 'function') {
      throw new Error('HttpResponse class must function/class')
    }
    Object.defineProperty(this, '$response', { value: HttpResponse })
  }

  register(handler) {
    Object.defineProperty(this, '$handler', { value: handler })
  }

  handle() {
    return async (event, context) => {
      return new Promise((resolve) => {
        const request = new this.$request(this.$streamRequest.fromEvent(event));
        request.context = context;
        const response = new this.$response(new this.$streamResponse(resolve))
        this.$handler(request, response, (err) => {
          this.next(err, resolve);
        });
      });
    };
  }

  handler(event, context) {
    return this.handle()(event, context);

  }

  next(err, resolve) {
    if (err) {
      console.error('Middleware error:', err);
      resolve({
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    } else {
      resolve({
        statusCode: 404,
        body: JSON.stringify({ message: 'Not Found' }),
      });
    }
  };
}

module.exports = Serverless;