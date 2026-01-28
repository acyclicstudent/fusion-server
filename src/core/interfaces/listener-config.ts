/**
 * Pattern matching configuration for listeners
 * Allows matching events based on their structure instead of event name
 */
export interface ListenerMatchConfig {
  /**
   * Object where keys are dot-notation paths into the event object
   * and values are patterns to match against
   *
   * @example
   * {
   *   'Records[0].eventSource': 'aws:s3',
   *   'Records[0].eventName': 'ObjectCreated:*',
   *   'Records[0].s3.bucket.name': 'my-bucket'
   * }
   */
  match: {
    [path: string]: string | string[];
  };
}

/**
 * Listener configuration - either a simple event name string or pattern matching config
 */
export type ListenerConfig = string | ListenerMatchConfig;

/**
 * Internal metadata structure for listeners
 */
export interface ListenerMetadata {
  type: 'eventName' | 'pattern';
  config: string | ListenerMatchConfig;
}

/**
 * Type guard to check if config is a pattern match config
 */
export function isPatternMatchConfig(config: ListenerConfig): config is ListenerMatchConfig {
  return typeof config === 'object' && config !== null && 'match' in config;
}

/**
 * Type guard to check if config is an event name string
 */
export function isEventNameConfig(config: ListenerConfig): config is string {
  return typeof config === 'string';
}
