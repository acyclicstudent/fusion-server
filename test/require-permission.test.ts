import 'reflect-metadata';
import { container } from 'tsyringe';
import { RequirePermission } from '../src/core/decorators/security/require-permission';
import { ResolveAuth } from '../src/core/decorators/security/resolve-auth';
import { getAuthContext } from '../src/core/decorators/security/current-user';
import {
  AUTH_CONTEXT_RESOLVER,
  IAuthContextResolver,
  AuthContext,
} from '../src/core/interfaces/auth-context';
import { FusionResponse } from '../src/core/classes/fusion-response';

const mkEvent = (overrides: any = {}) =>
  ({
    requestContext: { authorizer: {} },
    ...overrides,
  } as any);

const makeResolver = (ctx: AuthContext): IAuthContextResolver => ({
  resolve: () => ctx,
});

/**
 * Decorators are applied by manual invocation (not `@` syntax) to keep TS 5
 * happy without requiring experimentalDecorators in test compilation — this
 * matches the pattern used in decorators.test.ts.
 */
function makeCtrl(
  decorate: (proto: any, key: string) => void,
  impl: (evt: any) => any = () => 'ok'
): { new (): { handle: (evt: any) => Promise<any> } } {
  class Ctrl {
    async handle(evt: any) {
      return impl(evt);
    }
  }
  decorate(Ctrl.prototype, 'handle');
  return Ctrl as any;
}

describe('@RequirePermission', () => {
  afterEach(() => {
    container.reset();
  });

  it('executes handler when granted perms satisfy required (all mode, default)', async () => {
    container.register(AUTH_CONTEXT_RESOLVER, {
      useValue: makeResolver({ permissions: ['ops:read:*', 'ops:write:*'] }),
    });

    const Ctrl = makeCtrl(
      RequirePermission('ops:read:own', 'ops:write:own') as any,
      () => ({ ok: true })
    );

    const result = await new Ctrl().handle(mkEvent());
    expect(result).toEqual({ ok: true });
  });

  it('returns 403 FusionResponse when missing a required perm (all mode)', async () => {
    container.register(AUTH_CONTEXT_RESOLVER, {
      useValue: makeResolver({ permissions: ['ops:read:*'] }),
    });

    const Ctrl = makeCtrl(
      RequirePermission('ops:read:own', 'ops:write:own') as any,
      () => ({ ok: true })
    );

    const result = await new Ctrl().handle(mkEvent());
    expect(result).toBeInstanceOf(FusionResponse);
    expect((result as FusionResponse).statusCode).toBe(403);
    expect((result as FusionResponse).body).toMatchObject({
      message: 'Forbidden',
      required: ['ops:read:own', 'ops:write:own'],
      mode: 'all',
    });
  });

  it('any mode passes when at least one matches', async () => {
    container.register(AUTH_CONTEXT_RESOLVER, {
      useValue: makeResolver({ permissions: ['ops:write:own'] }),
    });

    const Ctrl = makeCtrl(
      RequirePermission('admin:*', 'ops:write:own', { mode: 'any' }) as any,
      () => 'ran'
    );

    await expect(new Ctrl().handle(mkEvent())).resolves.toBe('ran');
  });

  it('any mode returns 403 when none match', async () => {
    container.register(AUTH_CONTEXT_RESOLVER, {
      useValue: makeResolver({ permissions: ['other:perm'] }),
    });

    const Ctrl = makeCtrl(
      RequirePermission('admin:*', 'ops:write:own', { mode: 'any' }) as any,
      () => 'ran'
    );

    const res = await new Ctrl().handle(mkEvent());
    expect((res as FusionResponse).statusCode).toBe(403);
    expect((res as FusionResponse).body.mode).toBe('any');
  });

  it('uses default Cognito resolver when none registered', async () => {
    const Ctrl = makeCtrl(RequirePermission('a:b') as any, () => 'ok');

    const evt = mkEvent({
      requestContext: { authorizer: { claims: { permissions: 'a:b,c:d' } } },
    });
    await expect(new Ctrl().handle(evt)).resolves.toBe('ok');
  });

  it('attaches auth context to event for downstream handler', async () => {
    const authCtx: AuthContext = {
      userId: 'u-1',
      permissions: ['ops:read:*'],
      roles: ['viewer'],
    };
    container.register(AUTH_CONTEXT_RESOLVER, { useValue: makeResolver(authCtx) });

    let captured: AuthContext | undefined;
    const Ctrl = makeCtrl(RequirePermission('ops:read:own') as any, evt => {
      captured = getAuthContext(evt);
      return 'ok';
    });

    await new Ctrl().handle(mkEvent());
    expect(captured).toEqual(authCtx);
  });

  it('calls custom onDenied when provided', async () => {
    container.register(AUTH_CONTEXT_RESOLVER, {
      useValue: makeResolver({ permissions: [] }),
    });

    const Ctrl = makeCtrl(
      RequirePermission('admin:*', {
        onDenied: ({ required }) =>
          new FusionResponse({ msg: 'nope', need: required }).status(401),
      }) as any,
      () => 'ok'
    );

    const res = (await new Ctrl().handle(mkEvent())) as unknown as FusionResponse;
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ msg: 'nope', need: ['admin:*'] });
  });

  it('stores permissions metadata on method', () => {
    const Ctrl = makeCtrl(
      RequirePermission('a:b', 'c:d', { mode: 'any' }) as any,
      () => 'ok'
    );

    const meta = Reflect.getMetadata('fusion:permissions', Ctrl.prototype, 'handle');
    expect(meta).toEqual({ permissions: ['a:b', 'c:d'], mode: 'any' });
  });

  it('denies when granted permissions list is empty', async () => {
    container.register(AUTH_CONTEXT_RESOLVER, {
      useValue: makeResolver({ permissions: [] }),
    });

    const Ctrl = makeCtrl(RequirePermission('a:b') as any, () => 'ok');

    const res = await new Ctrl().handle(mkEvent());
    expect((res as FusionResponse).statusCode).toBe(403);
  });

  it('awaits async resolvers', async () => {
    const asyncResolver: IAuthContextResolver = {
      resolve: async () => {
        await new Promise(r => setTimeout(r, 5));
        return { permissions: ['a:b'] };
      },
    };
    container.register(AUTH_CONTEXT_RESOLVER, { useValue: asyncResolver });

    const Ctrl = makeCtrl(RequirePermission('a:b') as any, () => 'ok');
    await expect(new Ctrl().handle(mkEvent())).resolves.toBe('ok');
  });
});

describe('@ResolveAuth', () => {
  afterEach(() => {
    container.reset();
  });

  it('attaches auth without enforcing permissions', async () => {
    container.register(AUTH_CONTEXT_RESOLVER, {
      useValue: makeResolver({ permissions: [], userId: 'anon' }),
    });

    let captured: AuthContext | undefined;
    const Ctrl = makeCtrl(ResolveAuth() as any, evt => {
      captured = getAuthContext(evt);
      return 'ok';
    });

    await expect(new Ctrl().handle(mkEvent())).resolves.toBe('ok');
    expect(captured?.userId).toBe('anon');
  });
});

describe('getAuthContext', () => {
  it('returns undefined when event has no auth attached', () => {
    expect(getAuthContext({} as any)).toBeUndefined();
  });
});

/**
 * Regression test for the esbuild/TS legacy-decorator case: `__decorateClass`
 * (the helper TS+esbuild emits) reads the original PropertyDescriptor, passes
 * it as the 3rd arg, and expects the decorator to RETURN a (possibly updated)
 * descriptor. If the decorator only mutates `target[propertyKey]` and returns
 * undefined, __decorateClass will restore the ORIGINAL descriptor via
 * `Object.defineProperty`, silently un-wrapping the method. The decorator must
 * therefore update `descriptor.value` and return it.
 */
describe('@RequirePermission under legacy __decorateClass emit (esbuild/TS)', () => {
  afterEach(() => container.reset());

  /** Mimics what TS + esbuild emit at runtime. */
  function applyLegacyDecorator(
    decorator: any,
    ClassRef: any,
    key: string
  ): void {
    const proto = ClassRef.prototype;
    let descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(proto, key);
    const result = decorator(proto, key, descriptor);
    descriptor = (result as PropertyDescriptor) || descriptor;
    if (descriptor) {
      Object.defineProperty(proto, key, descriptor);
    }
  }

  it('enforces permissions when applied via legacy __decorateClass emit', async () => {
    container.register(AUTH_CONTEXT_RESOLVER, {
      useValue: makeResolver({ permissions: [] }),
    });

    class Ctrl {
      async handle(_evt: any) {
        return 'leaked';
      }
    }
    applyLegacyDecorator(RequirePermission('users:read:*'), Ctrl, 'handle');

    const res = (await new Ctrl().handle(mkEvent())) as unknown as FusionResponse;
    expect(res).toBeInstanceOf(FusionResponse);
    expect(res.statusCode).toBe(403);
  });

  it('allows through when permission matches (legacy emit)', async () => {
    container.register(AUTH_CONTEXT_RESOLVER, {
      useValue: makeResolver({ permissions: ['users:read:*'] }),
    });

    class Ctrl {
      async handle(_evt: any) {
        return 'ok';
      }
    }
    applyLegacyDecorator(RequirePermission('users:read:own'), Ctrl, 'handle');

    await expect(new Ctrl().handle(mkEvent())).resolves.toBe('ok');
  });
});
