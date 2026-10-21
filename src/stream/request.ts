import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { URLSearchParams } from 'url';

interface MockSocketOptions {
  remoteAddress?: string;
  encrypted?: boolean;
}

class MockSocket extends Duplex {
  _remoteAddress: string;
  encrypted: boolean;

  /**
   * Create a new MockSocket instance.
   *
   * @param options - Socket configuration options.
   */
  constructor(options: MockSocketOptions = {}) {
    super();
    this._remoteAddress = options.remoteAddress || '';
    this.encrypted = options.encrypted || false;
  }

  /**
   * Get the remote IP address.
   */
  get remoteAddress(): string {
    return this._remoteAddress;
  }

  /**
   * Set the remote IP address.
   *
   * @param addr - Remote IP address.
   */
  setRemoteAddress(addr: string): void {
    this._remoteAddress = addr;
  }

  /**
   * Dummy read implementation.
   */
  override _read(): void {}

  /**
   * Dummy write implementation.
   *
   * @param _chunk - Data chunk.
   * @param _encoding - String encoding.
   * @param callback - Completion callback.
   */
  override _write(_chunk: unknown, _encoding: BufferEncoding | string, callback: (error?: Error | null) => void): void {
    callback();
  }
}

interface NormalizedRequest {
  method: string | null;
  url: string | null;
  headers: Record<string, any> | null;
  query: Record<string, any> | null;
  pathParams: Record<string, any> | null;
  cookies?: string[];
  rawBodyBuf: Buffer | null;
  remoteAddress: string;
  isEncrypted: boolean;
}

class Request extends IncomingMessage {
  event: any;
  context: Record<string, any>;
  query: Record<string, any>;
  params: Record<string, any>;
  body: Buffer | null;

  /**
   * Create a new Request instance wrapping a serverless event.
   *
   * @param event - Serverless trigger event payload.
   * @param context - Execution context from cloud provider.
   * @param platform - Cloud platform name.
   * @param getwayType - Gateway or trigger subtype.
   */
  constructor(
    event: any = {},
    context: Record<string, any> = {},
    platform?: string | null,
    getwayType?: string | null
  ) {
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

    super(mockSocket as any);

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

  /**
   * Normalize cloud-provider specific event and context into a standard HTTP request representation.
   *
   * @param event - Serverless trigger event payload.
   * @param context - Cloud context object.
   * @param platform - Platform identifier (aws, gcp, azure, generic).
   * @param getwayType - Gateway type (http, lambda-url, rest).
   * @returns Normalized request data.
   */
  static _normalize(
    event: any = {},
    context: Record<string, any> = {},
    platform?: string | null,
    getwayType?: string | null
  ): NormalizedRequest {
    const request = {
      method: 'GET',
      url: '/',
      headers: {} as Record<string, any>,
      query: {} as Record<string, any>,
      pathParams: {} as Record<string, any>,
      cookies: [] as string[],
      rawBodyBuf: event?.body ? (event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body)) : Buffer.alloc(0),
      remoteAddress: '',
      isEncrypted: false
    };

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
              ? request.headers.Cookie.split(';').map((c: string) => c.trim())
              : [];
            request.remoteAddress = request.headers['x-forwarded-for']?.split(',')[0] || '';
            request.isEncrypted = request.headers['x-forwarded-proto'] === 'https';
            break;
        }
        break;

      case 'azure': {
        const req: any = context.req || event;
        request.method = req.method;
        request.url = req.url;
        request.headers = req.headers || {};
        request.query = req.query || {};
        request.pathParams = req.params || {};
        request.cookies = request.headers.cookie
          ? request.headers.cookie.split(';').map((c: string) => c.trim())
          : [];
        request.remoteAddress = request.headers['x-forwarded-for']?.split(',')[0] || '';
        request.isEncrypted = request.headers['x-forwarded-proto'] === 'https';
        if (req.rawBody instanceof Buffer) request.rawBodyBuf = req.rawBody;
        else if (req.rawBody) request.rawBodyBuf = Buffer.from(req.rawBody);
        break;
      }

      case 'gcp':
        request.method = event.method || event.httpMethod;
        request.url = event.url ||
          (event.path + (event.query ? '?' + new URLSearchParams(event.query).toString() : ''));
        request.headers = event.headers || {};
        request.query = event.query || {};
        request.pathParams = event.params || {};
        request.cookies = request.headers.cookie
          ? request.headers.cookie.split(';').map((c: string) => c.trim())
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
          ? request.headers.cookie.split(';').map((c: string) => c.trim())
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

(Request as any).__esModule = true;
(Request as any).default = Request;

export default Request;
