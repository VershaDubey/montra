/**
 * Sanitize string by removing/escaping control characters
 * @param {string} str - Input string
 * @returns {string} - Sanitized string
 */
function sanitizeString(str) {
  if (!str) return '';
  
  // Convert to string if not already
  let sanitized = String(str);
  
  // Replace common control characters
  sanitized = sanitized
    .replace(/[\r\n]/g, ' ')      // Replace newlines with space
    .replace(/[\t\v\f]/g, ' ')    // Replace tabs and other whitespace with space
    .replace(/\\/g, '\\\\')       // Escape backslashes
    .replace(/"/g, '\\"')         // Escape quotes for JSON safety
    .trim();                       // Remove leading/trailing whitespace
  
  return sanitized;
}

/**
 * Sanitize all string values in an object recursively
 * @param {object} obj - Input object
 * @returns {object} - Sanitized object
 */
function sanitizeObject(obj) {
  if (!obj) return obj;
  
  const sanitized = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? sanitizeString(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

module.exports = {
  sanitizeString,
  sanitizeObject
};
