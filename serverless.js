const { values } = require('lodash');
const StreamRequest = require('./stream/request');
const StreamResponse = require('./stream/response');

class Serverless {
  constructor() {
    this.stream();
    const handler = this.handle()
    Object.defineProperty(this, "handler", {
      value: (event, context) => {
        return handler(event, context);
      }
    })
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
    this.loadMain(process.cwd() + '/serverless.js');
    return (event, context) => {
      return new Promise((resolve) => {
        const request = new this.$request(this.$streamRequest.fromEvent(event));
        request.context = context;
        const response = new this.$response(new this.$streamResponse(resolve))
        Object.defineProperty(response, 'req', { value: request })
        this.$handler(request, response, (err) => {
          this.next(err, resolve);
        });
      });

    };
  }
  loadMain(mainModulePath) {
    // Resolve the absolute path to the main module
    const mainPath = path.resolve(mainModulePath);

    // Load the module manually
    const mainModule = require(mainPath);

    // Monkey patch require.main to simulate the main module
    Object.defineProperty(require, 'main', {
      value: require.cache[mainPath] || null,
      writable: false,
      configurable: false,
      enumerable: true
    });

    // Also set process.mainModule for compatibility (deprecated but still used sometimes)
    process.mainModule = require.main;

    return mainModule;
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