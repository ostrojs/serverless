import { resolve } from 'path';
import StreamRequest from './stream/request';
import StreamResponse from './stream/response';
import { resolveWithRequire } from './utils';

interface ServerlessConfig {
  handler: string;
  platform?: string;
  gateway?: string;
  [key: string]: any;
}

interface ServerlessOptions {
  serverless: ServerlessConfig;
}

type ServerlessHandler = (event: any, context: any) => Promise<unknown>;
type HttpHandler = (req: any, res: any, next: (err?: any) => void) => void;

class Serverless {
  declare handler: ServerlessHandler;
  declare $config: ServerlessConfig;
  declare $streamRequest: any;
  declare $streamResponse: any;
  declare $request: any;
  declare $response: any;
  declare $handler: HttpHandler;

  /**
   * Create a new Serverless instance.
   *
   * @param options - Configuration options containing the serverless config.
   */
  constructor({ serverless }: ServerlessOptions) {
    this.stream();
    const handler = this.handle();
    Object.defineProperties(this, {
      handler: {
        value: handler
      },
      $config: {
        value: serverless
      }
    });

    this.entry(resolveWithRequire(serverless.handler));
  }

  /**
   * Configure the stream request and response classes.
   *
   * @param request - Stream request class.
   * @param response - Stream response class.
   */
  stream(request: any = StreamRequest, response: any = StreamResponse): void {
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
        enumerable: false
      },
      $streamResponse: {
        value: response,
        writable: true,
        enumerable: false
      }
    });
  }

  /**
   * Register the HTTP request wrapper class.
   *
   * @param HttpRequest - Ostro HTTP request constructor.
   */
  request(HttpRequest: any): void {
    if (typeof HttpRequest != 'function') {
      throw new Error('HttpRequest class must be function/class');
    }
    Object.defineProperty(this, '$request', { value: HttpRequest });
  }

  /**
   * Register the HTTP response wrapper class.
   *
   * @param HttpResponse - Ostro HTTP response constructor.
   */
  response(HttpResponse: any): void {
    if (typeof HttpResponse != 'function') {
      throw new Error('HttpResponse class must function/class');
    }
    Object.defineProperty(this, '$response', { value: HttpResponse });
  }

  /**
   * Register the main Ostro application request handler callback.
   *
   * @param handler - HTTP request handler function.
   */
  register(handler: HttpHandler): void {
    Object.defineProperty(this, '$handler', { value: handler });
  }

  /**
   * Build the serverless event handler function.
   *
   * @returns Asynchronous serverless event handler.
   */
  handle(): ServerlessHandler {
    return (event: any, context: any): Promise<unknown> => {
      return new Promise((resolve) => {
        const serverlessPlateform = this.$config.platform || 'generic';
        const serverlessGetway = this.$config.gateway;
        const request = new this.$request(new this.$streamRequest(event, context, serverlessPlateform, serverlessGetway));
        const response = new this.$response(new this.$streamResponse(resolve, serverlessPlateform, serverlessGetway));
        Object.defineProperty(response, 'request', { value: request });
        this.$handler(request, response, (err: unknown) => {
          response.send(err);
        });
      });
    };
  }

  /**
   * Load the entry point file for the serverless application.
   *
   * @param entryPath - Resolved path to the entry module.
   */
  entry(entryPath?: string | null): void {
    if (entryPath) {
      this.loadMainModule(entryPath);
    }
  }

  /**
   * Load the main module and set it as require.main and process.mainModule.
   *
   * @param mainModulePath - Path to the main application module.
   * @returns The exported module.
   */
  loadMainModule(mainModulePath: string): unknown {
    const mainPath: string = resolve(mainModulePath);
    const mainModule: unknown = require(mainPath);
    const cachedModule: unknown = require.cache[mainPath];
    const desc: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(require, 'main');
    if (!desc || desc.configurable) {
      const descriptor: PropertyDescriptor = {
        value: cachedModule,
        writable: true,
        configurable: true,
        enumerable: true
      };
      Object.defineProperty(require, 'main', descriptor);
    }

    (process as any).mainModule = require.main;

    return mainModule;
  }
}

export default Serverless;
