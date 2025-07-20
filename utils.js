exports.normalizeHeaders =  function normalizeHeaders(headers) {
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