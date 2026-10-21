import { join } from 'path';

/**
 * Normalizes headers generally by joining array values with commas.
 *
 * @param headers - Key-value pair of headers.
 * @returns Normalized headers object.
 */
export function normalizeHeadersGeneral(headers: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const key in headers) {
    if (Array.isArray(headers[key])) {
      normalized[key] = headers[key].join(', ');
    } else {
      normalized[key] = headers[key];
    }
  }
  return normalized;
}

/**
 * Normalizes headers according to target serverless platform and subtype.
 *
 * @param headers - Incoming headers object.
 * @param platform - Target serverless platform identifier.
 * @param subtype - Optional platform-specific subtype or gateway variant.
 * @returns Lowercased and normalized headers object.
 */
export function normalizeHeaders(
  headers: Record<string, any> | null | undefined | unknown,
  platform?: string | null,
  subtype: string | null = null
): Record<string, any> {
  if (!headers || typeof headers !== 'object') return {};

  const normalized: Record<string, any> = {};

  // Detect whether array headers are allowed
  const supportsArray: boolean = (() => {
    switch (platform) {
      case 'aws':
        switch (subtype) {
          case 'http':         // HTTP API Gateway v2
          case 'alb':          // Application Load Balancer
          case 'lambda-url':   // Direct Lambda URL
          case 'cloudfront':   // Lambda@Edge
            return true;

          case 'rest':         // REST API Gateway v1
            return false;

          case 'event':        // SNS, SQS, CloudWatch, etc.
            return false;

          default:
            throw new Error('AWS subtype is required: http, rest, alb, lambda-url, cloudfront, event');
        }

      case 'gcp':   // Cloud Functions, Run, Gateway
      case 'azure': // Azure Functions, APIM
      case 'local':
      case 'generic':
        return true;

      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  })();

  const headerObj = headers as Record<string, any>;

  // Normalize all headers to lowercase
  for (const key in headerObj) {
    if (!Object.prototype.hasOwnProperty.call(headerObj, key)) continue;

    const lowerKey: string = key.toLowerCase();
    const value: any = headerObj[key];

    if (Array.isArray(value)) {
      if (supportsArray) {
        normalized[lowerKey] = value;
      } else {
        // Special case for Set-Cookie (cannot be joined with commas)
        if (lowerKey === 'set-cookie') {
          normalized[lowerKey] = value[0]; // Keep only first
        } else {
          normalized[lowerKey] = value.join(', ');
        }
      }
    } else {
      normalized[lowerKey] = value;
    }
  }
  return normalized;
}

/**
 * Resolves a module file path using Node's require resolution.
 *
 * @param input - Dot-separated module path with handler name at the end.
 * @param baseDir - Directory from which to resolve.
 * @returns Resolved absolute file path, or null if resolution fails.
 */
export function resolveWithRequire(input: string, baseDir: string = process.cwd()): string | null {
  const parts: string[] = input.split('.');
  const filePath: string = join(baseDir, ...parts.slice(0, -1)); // exclude handler
  try {
    return require.resolve(filePath);
  } catch {
    return null; // or throw err for more detail
  }
}
