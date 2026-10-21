import { ServerResponse } from 'http';
import { Writable } from 'stream';
import { normalizeHeaders } from '../utils';

class Response extends ServerResponse {
  _resolve: (value: unknown) => void;
  _chunks: Buffer[];
  $isBase64Encoded: boolean;
  _platform: string | null;
  _getwayType: string | null;
  request?: any;

  /**
   * Create a new Response instance.
   *
   * @param resolve - Promise resolution callback to return final formatted response.
   * @param platform - Target serverless platform name.
   * @param getwayType - Gateway or trigger subtype.
   */
  constructor(resolve: (value: unknown) => void, platform: any, getwayType: any) {
    const dummyWritable: Writable = new Writable({
      write(_chunk: unknown, _encoding: BufferEncoding | string, callback: (error?: Error | null) => void): void {
        callback(); // noop
      }
    });

    super(dummyWritable as any);

    this._resolve = resolve;
    this._chunks = [];
    this.$isBase64Encoded = true;
    this._platform = platform;
    this._getwayType = getwayType;
  }

  /**
   * Write data chunk to response buffer.
   *
   * @param chunk - Data chunk (string or Buffer).
   * @param _args - Additional arguments.
   * @returns Self or boolean.
   */
  override write(chunk: unknown, ..._args: unknown[]): any {
    if (typeof chunk === 'string') {
      this._chunks.push(Buffer.from(chunk));
    } else if (Buffer.isBuffer(chunk)) {
      this._chunks.push(chunk);
    } else {
      throw new TypeError('Response.write() expects string or Buffer');
    }
  }

  /**
   * End response and trigger promise resolution with formatted output.
   *
   * @param chunk - Optional final chunk.
   * @param args - Additional arguments passed to ServerResponse.end.
   * @returns ServerResponse instance.
   */
  override end(chunk?: any, ...args: any[]): this {
    if (chunk) this.write(chunk);

    const result: Record<string, any> = this.toJSON();
    this._resolve(result);

    return super.end(null, ...args);
  }

  /**
   * Set base64 encoding flag.
   *
   * @param encoding - Desired encoding string (e.g. 'base64').
   * @returns Self for chaining.
   */
  encode(encoding?: string | null): this {
    this.$isBase64Encoded = (encoding && encoding.toLowerCase() === 'base64') as boolean;
    return this;
  }

  /**
   * Check whether response is base64 encoded.
   *
   * @returns True if base64 encoded, false otherwise.
   */
  isBase64Encoded(): boolean {
    return this.$isBase64Encoded;
  }

  /**
   * Check if running on the specified platform or platforms.
   *
   * @param platform - Platform name or array of platform names.
   * @returns True if matches, false otherwise.
   */
  isPlatform(platform?: string | string[] | null): boolean {
    const platformList: string[] | null | undefined = typeof platform === 'string' ? [platform] : platform;
    return Boolean(platformList && platformList.includes(this._platform as string));
  }

  /**
   * Convert response to cloud-provider format.
   *
   * @returns Provider-formatted response object.
   */
  toJSON(): Record<string, any> {
    const buffer: Buffer = Buffer.concat(this._chunks);
    const isBase64Encoded: boolean = this.isBase64Encoded();
    const body: string = isBase64Encoded ? buffer.toString('base64') : buffer.toString('utf8');

    const headers: Record<string, any> = normalizeHeaders(this.getHeaders(), this._platform, this._getwayType);

    headers['content-length'] = buffer.length;

    let cookies: any = undefined;
    if (this.isPlatform('aws')) {
      const setCookieKey: string | undefined = Object.keys(headers).find(
        key => key.toLowerCase() === 'set-cookie'
      );
      if (setCookieKey) {
        cookies = headers[setCookieKey];
        delete headers[setCookieKey];
      }
    }

    const statusCode: number = this.statusCode || 200;

    switch (this._platform) {
      case 'azure':
        return {
          status: statusCode,
          headers,
          body,
        };
      case 'gcp':
        return {
          statusCode,
          headers,
          body,
        };
      case 'aws':
        return {
          statusCode,
          headers,
          body,
          cookies,
          isBase64Encoded,
        };
      default:
        return {
          statusCode,
          headers,
          body,
          isBase64Encoded,
        };
    }
  }
}

export default Response;
