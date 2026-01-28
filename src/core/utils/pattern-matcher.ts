import { ListenerMatchConfig } from '../interfaces/listener-config';

/**
 * Extracts a value from an object using dot notation path
 * Supports nested objects and array indices
 *
 * @param obj - The object to extract from
 * @param path - Dot notation path (e.g., 'user.name', 'Records[0].s3.bucket')
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * extractValue({ user: { name: 'John' } }, 'user.name') // 'John'
 * extractValue({ Records: [{ s3: { bucket: 'my-bucket' } }] }, 'Records[0].s3.bucket') // 'my-bucket'
 */
export function extractValue(obj: any, path: string): any {
  if (obj == null || path === '') {
    return undefined;
  }

  // Split path by dots and brackets
  // 'Records[0].s3.bucket' -> ['Records', '0', 's3', 'bucket']
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1') // Convert [0] to .0
    .split('.')
    .filter(p => p !== '');

  let current = obj;

  for (const part of parts) {
    if (current == null) {
      return undefined;
    }

    // Try as array index first (numeric string)
    if (/^\d+$/.test(part)) {
      const index = parseInt(part, 10);
      if (Array.isArray(current) && index >= 0 && index < current.length) {
        current = current[index];
        continue;
      }
    }

    // Try as object property
    if (typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Checks if a value matches a pattern
 *
 * Pattern types:
 * - '*': Existence check (any non-null/undefined value)
 * - 'prefix:*': Wildcard suffix matching
 * - ['a', 'b']: OR logic (matches if value equals any array element)
 * - 'exact': Exact string match
 *
 * @param value - The value to check
 * @param pattern - The pattern to match against
 * @returns True if value matches pattern
 *
 * @example
 * matchPattern('aws:s3', 'aws:s3') // true (exact)
 * matchPattern('ObjectCreated:Put', 'ObjectCreated:*') // true (wildcard)
 * matchPattern('aws:s3', ['aws:s3', 'aws:sqs']) // true (OR logic)
 * matchPattern('any-value', '*') // true (existence)
 */
export function matchPattern(value: any, pattern: string | string[]): boolean {
  // Handle null/undefined value
  if (value == null) {
    return false;
  }

  // Convert value to string for matching
  const valueStr = String(value);

  // Array pattern = OR logic
  if (Array.isArray(pattern)) {
    return pattern.some(p => matchPattern(value, p));
  }

  // Existence check
  if (pattern === '*') {
    return true;
  }

  // Wildcard suffix matching
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return valueStr.startsWith(prefix);
  }

  // Exact match
  return valueStr === pattern;
}

/**
 * Checks if an event matches all patterns in a configuration
 * All patterns must match (AND logic)
 *
 * @param event - The event object to check
 * @param config - The pattern matching configuration
 * @returns True if event matches all patterns
 *
 * @example
 * matchesPatterns(
 *   { Records: [{ eventSource: 'aws:s3', eventName: 'ObjectCreated:Put' }] },
 *   {
 *     match: {
 *       'Records[0].eventSource': 'aws:s3',
 *       'Records[0].eventName': 'ObjectCreated:*'
 *     }
 *   }
 * ) // true
 */
export function matchesPatterns(event: any, config: ListenerMatchConfig): boolean {
  if (!config.match || typeof config.match !== 'object') {
    return false;
  }

  const patterns = Object.entries(config.match);

  // Empty match config never matches
  if (patterns.length === 0) {
    return false;
  }

  // All patterns must match (AND logic)
  for (const [path, pattern] of patterns) {
    const value = extractValue(event, path);
    if (!matchPattern(value, pattern)) {
      return false;
    }
  }

  return true;
}
