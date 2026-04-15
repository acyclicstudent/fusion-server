import { APIGatewayEvent } from 'aws-lambda';
import { DefaultCognitoAuthResolver } from '../src/core/classes/default-auth-resolver';

const mkEvent = (authorizer: any): APIGatewayEvent =>
  ({ requestContext: { authorizer } } as any);

describe('DefaultCognitoAuthResolver', () => {
  const resolver = new DefaultCognitoAuthResolver();

  it('returns empty permissions when authorizer missing', () => {
    const ctx = resolver.resolve({ requestContext: {} } as any);
    expect(ctx.permissions).toEqual([]);
    expect(ctx.userId).toBeUndefined();
  });

  it('reads sub as userId from claims', () => {
    const ctx = resolver.resolve(mkEvent({ claims: { sub: 'u-123' } }));
    expect(ctx.userId).toBe('u-123');
  });

  it('falls back to principalId when no sub/userId in claims', () => {
    const ctx = resolver.resolve(mkEvent({ principalId: 'prince-1' }));
    expect(ctx.userId).toBe('prince-1');
  });

  it('parses CSV permissions string', () => {
    const ctx = resolver.resolve(
      mkEvent({ claims: { permissions: 'a:read,b:write , c:*' } })
    );
    expect(ctx.permissions).toEqual(['a:read', 'b:write', 'c:*']);
  });

  it('parses JSON array permissions string', () => {
    const ctx = resolver.resolve(
      mkEvent({ claims: { permissions: '["a:read","b:write"]' } })
    );
    expect(ctx.permissions).toEqual(['a:read', 'b:write']);
  });

  it('accepts permissions as native array', () => {
    const ctx = resolver.resolve(
      mkEvent({ claims: { permissions: ['a:read', 'b:write'] } })
    );
    expect(ctx.permissions).toEqual(['a:read', 'b:write']);
  });

  it('reads custom:permissions Cognito attribute', () => {
    const ctx = resolver.resolve(
      mkEvent({ claims: { 'custom:permissions': 'x:y,z:w' } })
    );
    expect(ctx.permissions).toEqual(['x:y', 'z:w']);
  });

  it('reads roles from cognito:groups', () => {
    const ctx = resolver.resolve(
      mkEvent({ claims: { 'cognito:groups': ['admin', 'ops'] } })
    );
    expect(ctx.roles).toEqual(['admin', 'ops']);
  });

  it('reads areas from custom:areas', () => {
    const ctx = resolver.resolve(
      mkEvent({ claims: { 'custom:areas': 'OPERATIONS,SALES' } })
    );
    expect(ctx.areas).toEqual(['OPERATIONS', 'SALES']);
  });

  it('reads from authorizer.jwt.claims (HTTP API v2 shape)', () => {
    const ctx = resolver.resolve(
      mkEvent({ jwt: { claims: { sub: 'u-9', permissions: 'a:b' } } })
    );
    expect(ctx.userId).toBe('u-9');
    expect(ctx.permissions).toEqual(['a:b']);
  });

  it('falls back to authorizer root when no claims/jwt', () => {
    const ctx = resolver.resolve(
      mkEvent({ userId: 'u-root', permissions: 'a:b,c:d' })
    );
    expect(ctx.userId).toBe('u-root');
    expect(ctx.permissions).toEqual(['a:b', 'c:d']);
  });

  it('returns empty array on malformed JSON permissions', () => {
    const ctx = resolver.resolve(
      mkEvent({ claims: { permissions: '[not json' } })
    );
    expect(ctx.permissions).toEqual([]);
  });

  it('exposes original claims on raw', () => {
    const claims = { sub: 'u-1', permissions: 'a:b' };
    const ctx = resolver.resolve(mkEvent({ claims }));
    expect(ctx.raw).toBe(claims);
  });
});
