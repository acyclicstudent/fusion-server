import 'reflect-metadata';
import { FusionServer } from '../src/fusion-server';
import { Listener } from '../src/core/decorators/interfaces/listener';
import { EvtListener } from '../src/core/interfaces/evt-listener';
import { Controller } from '../src/core/decorators/interfaces/controller';
import { Get } from '../src/core/decorators/http/get';
import { Context } from 'aws-lambda';
import { FusionResponse } from '../src/core/classes/fusion-response';

// Mock AWS Lambda context
const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function:dev',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: 'test-log-group',
    logStreamName: 'test-log-stream',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
};

describe('Listener Routing', () => {
    let server: FusionServer;

    beforeEach(() => {
        server = new FusionServer();
    });

    describe('Backward Compatibility - Event Name Routing', () => {
        it('should route event by event name (legacy behavior)', async () => {
            class UserCreatedListener implements EvtListener {
                async handle(evt: any) {
                    return { handled: true, data: evt.data };
                }
            }
            Listener('user.created')(UserCreatedListener);

            class TestController {}
            Controller('/test')(TestController);
            Get()(TestController.prototype, 'test');

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [UserCreatedListener]
            });

            const event = {
                event: 'user.created',
                data: { userId: '123', name: 'John' }
            };

            const result: any = await handler(event, mockContext);

            expect(result.success).toBe(true);
            expect(result.matchType).toBe('eventName');
            expect(result.body).toEqual({ handled: true, data: { userId: '123', name: 'John' } });
        });

        it('should return error for unregistered event name', async () => {
            class UserCreatedListener implements EvtListener {
                async handle(_evt: any) {
                    return { handled: true };
                }
            }
            Listener('user.created')(UserCreatedListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [UserCreatedListener]
            });

            const event = {
                event: 'user.deleted', // Not registered
                data: {}
            };

            const result: any = await handler(event, mockContext);

            expect(result.success).toBe(false);
            expect(result.body.message).toContain('Unregistered listener for event: user.deleted');
        });
    });

    describe('Pattern Matching - S3 Events', () => {
        it('should match S3 ObjectCreated event', async () => {
            class S3ObjectCreatedListener implements EvtListener {
                async handle(evt: any) {
                    return {
                        bucket: evt.Records[0].s3.bucket.name,
                        key: evt.Records[0].s3.object.key
                    };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3',
                    'Records[0].eventName': 'ObjectCreated:*'
                }
            })(S3ObjectCreatedListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [S3ObjectCreatedListener]
            });

            const s3Event = {
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

            const result: any = await handler(s3Event, mockContext);

            expect(result.success).toBe(true);
            expect(result.matchType).toBe('pattern');
            expect(result.body).toEqual({
                bucket: 'my-bucket',
                key: 'uploads/file.pdf'
            });
        });

        it('should match S3 event with specific bucket name', async () => {
            class S3BucketListener implements EvtListener {
                async handle(_evt: any) {
                    return { matched: true };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3',
                    'Records[0].s3.bucket.name': 'my-bucket'
                }
            })(S3BucketListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [S3BucketListener]
            });

            const s3Event = {
                Records: [
                    {
                        eventSource: 'aws:s3',
                        s3: { bucket: { name: 'my-bucket' } }
                    }
                ]
            };

            const result: any = await handler(s3Event, mockContext);

            expect(result.success).toBe(true);
            expect(result.body.matched).toBe(true);
        });

        it('should not match S3 event with wrong bucket name', async () => {
            class S3BucketListener implements EvtListener {
                async handle(_evt: any) {
                    return { matched: true };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3',
                    'Records[0].s3.bucket.name': 'specific-bucket'
                }
            })(S3BucketListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [S3BucketListener]
            });

            const s3Event = {
                Records: [
                    {
                        eventSource: 'aws:s3',
                        s3: { bucket: { name: 'different-bucket' } }
                    }
                ]
            };

            const result: any = await handler(s3Event, mockContext);

            expect(result.success).toBe(false);
            expect(result.body.message).toContain('No pattern-matched listener found');
        });
    });

    describe('Pattern Matching - SQS Events', () => {
        it('should match SQS event', async () => {
            class SQSListener implements EvtListener {
                async handle(evt: any) {
                    return { messagesCount: evt.Records.length };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:sqs'
                }
            })(SQSListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [SQSListener]
            });

            const sqsEvent = {
                Records: [
                    {
                        eventSource: 'aws:sqs',
                        messageId: 'msg-123',
                        body: 'test message'
                    }
                ]
            };

            const result: any = await handler(sqsEvent, mockContext);

            expect(result.success).toBe(true);
            expect(result.matchType).toBe('pattern');
            expect(result.body.messagesCount).toBe(1);
        });
    });

    describe('Pattern Matching - EventBridge Events', () => {
        it('should match EventBridge event', async () => {
            class EC2StateChangeListener implements EvtListener {
                async handle(evt: any) {
                    return {
                        instanceId: evt.detail.instanceId,
                        state: evt.detail.state
                    };
                }
            }
            Listener({
                match: {
                    source: 'aws.ec2',
                    'detail-type': 'EC2 Instance State-change Notification'
                }
            })(EC2StateChangeListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [EC2StateChangeListener]
            });

            const eventBridgeEvent = {
                source: 'aws.ec2',
                'detail-type': 'EC2 Instance State-change Notification',
                detail: {
                    instanceId: 'i-1234567890abcdef0',
                    state: 'running'
                }
            };

            const result: any = await handler(eventBridgeEvent, mockContext);

            expect(result.success).toBe(true);
            expect(result.matchType).toBe('pattern');
            expect(result.body).toEqual({
                instanceId: 'i-1234567890abcdef0',
                state: 'running'
            });
        });
    });

    describe('Pattern Matching - Wildcard and OR Logic', () => {
        it('should match with wildcard pattern', async () => {
            class WildcardListener implements EvtListener {
                async handle(_evt: any) {
                    return { matched: true };
                }
            }
            Listener({
                match: {
                    'Records[0].eventName': 'ObjectCreated:*'
                }
            })(WildcardListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [WildcardListener]
            });

            const event = {
                Records: [{ eventName: 'ObjectCreated:Put' }]
            };

            const result: any = await handler(event, mockContext);

            expect(result.success).toBe(true);
            expect(result.body.matched).toBe(true);
        });

        it('should match with OR logic (array of values)', async () => {
            class MultiSourceListener implements EvtListener {
                async handle(evt: any) {
                    return { source: evt.Records[0].eventSource };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': ['aws:s3', 'aws:sqs', 'aws:sns']
                }
            })(MultiSourceListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [MultiSourceListener]
            });

            // Test S3
            const s3Event = { Records: [{ eventSource: 'aws:s3' }] };
            const s3Result: any = await handler(s3Event, mockContext);
            expect(s3Result.success).toBe(true);
            expect(s3Result.body.source).toBe('aws:s3');
        });

        it('should match with existence check (*)', async () => {
            class ExistenceCheckListener implements EvtListener {
                async handle(_evt: any) {
                    return { matched: true };
                }
            }
            Listener({
                match: {
                    'Records[0].s3.bucket.name': '*'
                }
            })(ExistenceCheckListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [ExistenceCheckListener]
            });

            const event = {
                Records: [{ s3: { bucket: { name: 'any-bucket-name' } } }]
            };

            const result: any = await handler(event, mockContext);

            expect(result.success).toBe(true);
            expect(result.body.matched).toBe(true);
        });
    });

    describe('Mixed Listeners - Event Name + Pattern', () => {
        it('should handle both event-name and pattern listeners', async () => {
            class EventNameListener implements EvtListener {
                async handle(evt: any) {
                    return { type: 'event-name', data: evt.data };
                }
            }
            Listener('custom.event')(EventNameListener);

            class PatternListener implements EvtListener {
                async handle(evt: any) {
                    return { type: 'pattern', source: evt.Records[0].eventSource };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3'
                }
            })(PatternListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [EventNameListener, PatternListener]
            });

            // Test event-name routing
            const customEvent = { event: 'custom.event', data: { value: 123 } };
            const customResult: any = await handler(customEvent, mockContext);
            expect(customResult.success).toBe(true);
            expect(customResult.matchType).toBe('eventName');
            expect(customResult.body.type).toBe('event-name');

            // Test pattern routing (need new server instance)
            const server2 = new FusionServer();
            const handler2 = server2.createHandler({
                controllers: [TestController],
                listeners: [EventNameListener, PatternListener]
            });

            const s3Event = { Records: [{ eventSource: 'aws:s3' }] };
            const s3Result: any = await handler2(s3Event, mockContext);
            expect(s3Result.success).toBe(true);
            expect(s3Result.matchType).toBe('pattern');
            expect(s3Result.body.type).toBe('pattern');
        });
    });

    describe('Priority Rules', () => {
        it('should prioritize event-name over pattern matching', async () => {
            class EventNameListener implements EvtListener {
                async handle(_evt: any) {
                    return { matched: 'event-name' };
                }
            }
            Listener('s3.notification')(EventNameListener);

            class PatternListener implements EvtListener {
                async handle(_evt: any) {
                    return { matched: 'pattern' };
                }
            }
            Listener({
                match: {
                    event: 's3.notification'
                }
            })(PatternListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [EventNameListener, PatternListener]
            });

            const event = { event: 's3.notification', data: {} };
            const result: any = await handler(event, mockContext);

            // Event-name should win
            expect(result.success).toBe(true);
            expect(result.matchType).toBe('eventName');
            expect(result.body.matched).toBe('event-name');
        });

        it('should use first registered pattern when multiple patterns match', async () => {
            class FirstListener implements EvtListener {
                async handle(_evt: any) {
                    return { listener: 'first' };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3'
                }
            })(FirstListener);

            class SecondListener implements EvtListener {
                async handle(_evt: any) {
                    return { listener: 'second' };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3'
                }
            })(SecondListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [FirstListener, SecondListener]
            });

            const event = { Records: [{ eventSource: 'aws:s3' }] };
            const result: any = await handler(event, mockContext);

            // First listener should win
            expect(result.success).toBe(true);
            expect(result.body.listener).toBe('first');
        });
    });

    describe('Error Handling', () => {
        it('should return clear error for non-matching pattern', async () => {
            class S3Listener implements EvtListener {
                async handle(_evt: any) {
                    return { matched: true };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3'
                }
            })(S3Listener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [S3Listener]
            });

            const event = { someKey: 'someValue', anotherKey: 'anotherValue' };
            const result: any = await handler(event, mockContext);

            expect(result.success).toBe(false);
            expect(result.body.message).toContain('No pattern-matched listener found');
            expect(result.body.message).toContain('someKey, anotherKey');
        });

        it('should handle malformed events gracefully', async () => {
            class S3Listener implements EvtListener {
                async handle(_evt: any) {
                    return { matched: true };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3'
                }
            })(S3Listener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [S3Listener]
            });

            const malformedEvent = { Records: [] }; // Empty array
            const result: any = await handler(malformedEvent, mockContext);

            expect(result.success).toBe(false);
        });
    });

    describe('Complex Real-World Scenarios', () => {
        it('should match Bedrock Agent Action Group event', async () => {
            class BedrockActionListener implements EvtListener {
                async handle(evt: any) {
                    return {
                        actionGroup: evt.actionGroup,
                        parameters: evt.parameters
                    };
                }
            }
            Listener({
                match: {
                    actionGroup: '*',
                    apiPath: '/process-data'
                }
            })(BedrockActionListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [BedrockActionListener]
            });

            const bedrockEvent = {
                actionGroup: 'my-action-group',
                apiPath: '/process-data',
                parameters: [{ name: 'input', value: 'test' }]
            };

            const result: any = await handler(bedrockEvent, mockContext);

            expect(result.success).toBe(true);
            expect(result.body.actionGroup).toBe('my-action-group');
        });

        it('should handle S3 event with multiple conditions', async () => {
            class S3UploadsListener implements EvtListener {
                async handle(_evt: any) {
                    return { processed: true };
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3',
                    'Records[0].eventName': 'ObjectCreated:*',
                    'Records[0].s3.bucket.name': 'uploads-bucket',
                    'Records[0].s3.object.key': '*'
                }
            })(S3UploadsListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [S3UploadsListener]
            });

            const s3Event = {
                Records: [
                    {
                        eventSource: 'aws:s3',
                        eventName: 'ObjectCreated:Put',
                        s3: {
                            bucket: { name: 'uploads-bucket' },
                            object: { key: 'user/123/file.pdf' }
                        }
                    }
                ]
            };

            const result: any = await handler(s3Event, mockContext);

            expect(result.success).toBe(true);
            expect(result.body.processed).toBe(true);
        });
    });

    describe('FusionResponse Integration', () => {
        it('should return FusionResponse directly for Bedrock-like services', async () => {
            class BedrockActionListener implements EvtListener {
                async handle(evt: any) {
                    return new FusionResponse({
                        messageVersion: '1.0',
                        response: {
                            actionGroup: evt.actionGroup,
                            apiPath: evt.apiPath,
                            httpStatusCode: 200,
                            responseBody: {
                                'application/json': {
                                    body: JSON.stringify({ result: 'processed' })
                                }
                            }
                        }
                    });
                }
            }
            Listener({
                match: {
                    'actionGroup': '*',
                    'apiPath': '/process-data'
                }
            })(BedrockActionListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [BedrockActionListener]
            });

            const bedrockEvent = {
                actionGroup: 'my-action-group',
                apiPath: '/process-data',
                httpMethod: 'POST',
                parameters: []
            };

            const result: any = await handler(bedrockEvent, mockContext);

            // Should return FusionResponse directly, not wrapped
            expect(result.messageVersion).toBe('1.0');
            expect(result.response.actionGroup).toBe('my-action-group');
            expect(result.response.httpStatusCode).toBe(200);
            expect(result.success).toBeUndefined(); // Not wrapped
            expect(result.matchType).toBeUndefined(); // Not wrapped
        });

        it('should return FusionResponse directly for Cognito-like services', async () => {
            class CognitoTokenListener implements EvtListener {
                async handle(evt: any) {
                    return new FusionResponse({
                        claimsOverrideDetails: {
                            claimsToAddOrOverride: {
                                'custom:role': 'admin',
                                'custom:tenant': evt.request.userAttributes['custom:tenant']
                            },
                            claimsToSuppress: []
                        }
                    });
                }
            }
            Listener({
                match: {
                    'triggerSource': 'TokenGeneration_Authentication'
                }
            })(CognitoTokenListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [CognitoTokenListener]
            });

            const cognitoEvent = {
                triggerSource: 'TokenGeneration_Authentication',
                request: {
                    userAttributes: {
                        'custom:tenant': 'acme-corp'
                    }
                }
            };

            const result: any = await handler(cognitoEvent, mockContext);

            // Should return FusionResponse directly
            expect(result.claimsOverrideDetails).toBeDefined();
            expect(result.claimsOverrideDetails.claimsToAddOrOverride['custom:role']).toBe('admin');
            expect(result.claimsOverrideDetails.claimsToAddOrOverride['custom:tenant']).toBe('acme-corp');
            expect(result.success).toBeUndefined(); // Not wrapped
        });

        it('should maintain backward compatibility for plain object returns', async () => {
            class PlainObjectListener implements EvtListener {
                async handle(evt: any) {
                    return { processed: true, data: evt.data };
                }
            }
            Listener('custom.event')(PlainObjectListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [PlainObjectListener]
            });

            const event = { event: 'custom.event', data: { value: 123 } };
            const result: any = await handler(event, mockContext);

            // Should be wrapped for backward compatibility
            expect(result.success).toBe(true);
            expect(result.matchType).toBe('eventName');
            expect(result.body).toEqual({ processed: true, data: { value: 123 } });
        });

        it('should support FusionResponse with custom headers and status', async () => {
            class CustomResponseListener implements EvtListener {
                async handle(_evt: any) {
                    return new FusionResponse({ customField: 'value' })
                        .status(201)
                        .header('X-Custom-Header', 'custom-value');
                }
            }
            Listener({
                match: {
                    'Records[0].eventSource': 'aws:s3'
                }
            })(CustomResponseListener);

            class TestController {}
            Controller('/test')(TestController);

            const handler = server.createHandler({
                controllers: [TestController],
                listeners: [CustomResponseListener]
            });

            const s3Event = {
                Records: [{ eventSource: 'aws:s3' }]
            };

            const result: any = await handler(s3Event, mockContext);

            // FusionResponse.toResponse() returns Lambda response format
            expect(result.statusCode).toBe(201);
            expect(result.headers['X-Custom-Header']).toBe('custom-value');
            expect(result.body).toContain('customField');
        });
    });
});
