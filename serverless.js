class Serverless {
  constructor(config) {
    this.$config = config;
    this.$request = null;
    this.$response = null;
    this.$handler = null;
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

  handle(Request = require('./stream/request'), Response = require('./stream/response')) {
    return async (event, context) => {
      return new Promise((resolve) => {
        const request = new this.$request(Request.fromEvent(event));
        request.context = context;
        const response = new this.$response(new Response(resolve))
        this.$handler(request, response, (err) => {
          this.next(err, resolve);
        });
      });
    };
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