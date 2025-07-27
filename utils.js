exports.normalizeHeadersGeneral = function normalizeHeaders(headers) {
  const normalized = {};
  for (const key in headers) {
    if (Array.isArray(headers[key])) {
      normalized[key] = headers[key].join(', ');
    } else {
      normalized[key] = headers[key];
    }
  }
  return normalized;
}
exports.normalizeHeaders = function normalizeHeaders(headers, platform, subtype = null) {
  if (!headers || typeof headers !== 'object') return {};

  const normalized = {};

  // Detect whether array headers are allowed
  const supportsArray = (() => {
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

  // Normalize all headers to lowercase
  for (const key in headers) {
    if (!Object.prototype.hasOwnProperty.call(headers, key)) continue;

    const lowerKey = key.toLowerCase();
    const value = headers[key];

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

exports.resolveWithRequire = function resolveWithRequire(input, baseDir = process.cwd()) {
  const parts = input.split('.');
  const filePath = path.join(baseDir, ...parts.slice(0, -1)); // exclude handler
  try {
    return require.resolve(filePath);
  } catch (err) {
    return null; // or throw err for more detail
  }
}
