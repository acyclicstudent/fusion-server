import { extractValue, matchPattern, matchesPatterns } from '../src/core/utils/pattern-matcher';
import { ListenerMatchConfig } from '../src/core/interfaces/listener-config';

describe('Pattern Matcher', () => {
  describe('extractValue', () => {
    it('should extract simple property', () => {
      const obj = { name: 'John' };
      expect(extractValue(obj, 'name')).toBe('John');
    });

    it('should extract nested property', () => {
      const obj = { user: { name: 'John', age: 30 } };
      expect(extractValue(obj, 'user.name')).toBe('John');
      expect(extractValue(obj, 'user.age')).toBe(30);
    });

    it('should extract from array with bracket notation', () => {
      const obj = { items: ['a', 'b', 'c'] };
      expect(extractValue(obj, 'items[0]')).toBe('a');
      expect(extractValue(obj, 'items[1]')).toBe('b');
      expect(extractValue(obj, 'items[2]')).toBe('c');
    });

    it('should extract nested array property', () => {
      const obj = {
        Records: [
          { eventSource: 'aws:s3', s3: { bucket: { name: 'my-bucket' } } }
        ]
      };
      expect(extractValue(obj, 'Records[0].eventSource')).toBe('aws:s3');
      expect(extractValue(obj, 'Records[0].s3.bucket.name')).toBe('my-bucket');
    });

    it('should handle multiple array indices', () => {
      const obj = {
        data: [
          { items: [{ value: 'first' }, { value: 'second' }] }
        ]
      };
      expect(extractValue(obj, 'data[0].items[0].value')).toBe('first');
      expect(extractValue(obj, 'data[0].items[1].value')).toBe('second');
    });

    it('should return undefined for non-existent path', () => {
      const obj = { name: 'John' };
      expect(extractValue(obj, 'age')).toBeUndefined();
      expect(extractValue(obj, 'user.name')).toBeUndefined();
    });

    it('should return undefined for out of bounds array index', () => {
      const obj = { items: ['a', 'b'] };
      expect(extractValue(obj, 'items[5]')).toBeUndefined();
    });

    it('should return undefined for null object', () => {
      expect(extractValue(null, 'name')).toBeUndefined();
    });

    it('should return undefined for undefined object', () => {
      expect(extractValue(undefined, 'name')).toBeUndefined();
    });

    it('should return undefined for empty path', () => {
      const obj = { name: 'John' };
      expect(extractValue(obj, '')).toBeUndefined();
    });

    it('should handle path with null intermediate value', () => {
      const obj = { user: null };
      expect(extractValue(obj, 'user.name')).toBeUndefined();
    });
  });

  describe('matchPattern', () => {
    it('should match exact string', () => {
      expect(matchPattern('aws:s3', 'aws:s3')).toBe(true);
      expect(matchPattern('aws:s3', 'aws:sqs')).toBe(false);
    });

    it('should match with wildcard suffix', () => {
      expect(matchPattern('ObjectCreated:Put', 'ObjectCreated:*')).toBe(true);
      expect(matchPattern('ObjectCreated:Post', 'ObjectCreated:*')).toBe(true);
      expect(matchPattern('ObjectDeleted:Put', 'ObjectCreated:*')).toBe(false);
    });

    it('should match with existence check (*)', () => {
      expect(matchPattern('any-value', '*')).toBe(true);
      expect(matchPattern(123, '*')).toBe(true);
      expect(matchPattern(true, '*')).toBe(true);
      expect(matchPattern(null, '*')).toBe(false);
      expect(matchPattern(undefined, '*')).toBe(false);
    });

    it('should match with OR logic (array)', () => {
      expect(matchPattern('aws:s3', ['aws:s3', 'aws:sqs'])).toBe(true);
      expect(matchPattern('aws:sqs', ['aws:s3', 'aws:sqs'])).toBe(true);
      expect(matchPattern('aws:sns', ['aws:s3', 'aws:sqs'])).toBe(false);
    });

    it('should match array with wildcards', () => {
      expect(matchPattern('ObjectCreated:Put', ['ObjectCreated:*', 'ObjectDeleted:*'])).toBe(true);
      expect(matchPattern('ObjectDeleted:Delete', ['ObjectCreated:*', 'ObjectDeleted:*'])).toBe(true);
      expect(matchPattern('BucketCreated:Put', ['ObjectCreated:*', 'ObjectDeleted:*'])).toBe(false);
    });

    it('should handle number values', () => {
      expect(matchPattern(123, '123')).toBe(true);
      expect(matchPattern(123, '456')).toBe(false);
    });

    it('should return false for null value', () => {
      expect(matchPattern(null, 'any')).toBe(false);
      expect(matchPattern(null, '*')).toBe(false);
    });

    it('should return false for undefined value', () => {
      expect(matchPattern(undefined, 'any')).toBe(false);
      expect(matchPattern(undefined, '*')).toBe(false);
    });
  });

  describe('matchesPatterns', () => {
    it('should match S3 event pattern', () => {
      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            eventName: 'ObjectCreated:Put',
            s3: {
              bucket: { name: 'my-bucket' }
            }
          }
        ]
      };

      const config: ListenerMatchConfig = {
        match: {
          'Records[0].eventSource': 'aws:s3',
          'Records[0].eventName': 'ObjectCreated:*'
        }
      };

      expect(matchesPatterns(event, config)).toBe(true);
    });

    it('should match SQS event pattern', () => {
      const event = {
        Records: [
          {
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:my-queue'
          }
        ]
      };

      const config: ListenerMatchConfig = {
        match: {
          'Records[0].eventSource': 'aws:sqs'
        }
      };

      expect(matchesPatterns(event, config)).toBe(true);
    });

    it('should match EventBridge event pattern', () => {
      const event = {
        'detail-type': 'EC2 Instance State-change Notification',
        source: 'aws.ec2',
        detail: {
          state: 'running'
        }
      };

      const config: ListenerMatchConfig = {
        match: {
          source: 'aws.ec2',
          'detail-type': 'EC2 Instance State-change Notification'
        }
      };

      expect(matchesPatterns(event, config)).toBe(true);
    });

    it('should match with OR logic', () => {
      const event = {
        Records: [{ eventSource: 'aws:s3' }]
      };

      const config: ListenerMatchConfig = {
        match: {
          'Records[0].eventSource': ['aws:s3', 'aws:sqs', 'aws:sns']
        }
      };

      expect(matchesPatterns(event, config)).toBe(true);
    });

    it('should match with existence check', () => {
      const event = {
        Records: [{ s3: { bucket: { name: 'any-bucket' } } }]
      };

      const config: ListenerMatchConfig = {
        match: {
          'Records[0].s3.bucket.name': '*'
        }
      };

      expect(matchesPatterns(event, config)).toBe(true);
    });

    it('should fail if any pattern does not match (AND logic)', () => {
      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            eventName: 'ObjectDeleted:Delete'
          }
        ]
      };

      const config: ListenerMatchConfig = {
        match: {
          'Records[0].eventSource': 'aws:s3',
          'Records[0].eventName': 'ObjectCreated:*' // This won't match
        }
      };

      expect(matchesPatterns(event, config)).toBe(false);
    });

    it('should fail for non-existent path', () => {
      const event = { name: 'test' };

      const config: ListenerMatchConfig = {
        match: {
          'user.name': 'test'
        }
      };

      expect(matchesPatterns(event, config)).toBe(false);
    });

    it('should fail for empty match config', () => {
      const event = { name: 'test' };

      const config: ListenerMatchConfig = {
        match: {}
      };

      expect(matchesPatterns(event, config)).toBe(false);
    });

    it('should fail for invalid match config', () => {
      const event = { name: 'test' };

      const config: any = {
        match: null
      };

      expect(matchesPatterns(event, config)).toBe(false);
    });

    it('should match complex nested pattern', () => {
      const event = {
        Records: [
          {
            eventSource: 'aws:s3',
            eventName: 'ObjectCreated:Put',
            s3: {
              bucket: { name: 'my-bucket' },
              object: { key: 'uploads/file.pdf' }
            }
          }
        ]
      };

      const config: ListenerMatchConfig = {
        match: {
          'Records[0].eventSource': 'aws:s3',
          'Records[0].eventName': 'ObjectCreated:*',
          'Records[0].s3.bucket.name': 'my-bucket',
          'Records[0].s3.object.key': '*'
        }
      };

      expect(matchesPatterns(event, config)).toBe(true);
    });
  });
});
