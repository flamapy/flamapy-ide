import { describe, expect, it } from 'vitest';

import { createServiceRegistry } from './serviceRegistry';
import { serviceId } from './types';

interface Greeter {
  greet(): string;
}
const GreeterId = serviceId<Greeter>('test.greeter');

describe('service registry', () => {
  it('provides and gets a typed service', () => {
    const registry = createServiceRegistry();
    registry.provide(GreeterId, { greet: () => 'hi' });
    expect(registry.get(GreeterId).greet()).toBe('hi');
  });

  it('throws on get of a missing service, tryGet returns undefined', () => {
    const registry = createServiceRegistry();
    expect(() => registry.get(GreeterId)).toThrow(/not available/);
    expect(registry.tryGet(GreeterId)).toBeUndefined();
  });

  it('rejects duplicate providers', () => {
    const registry = createServiceRegistry();
    registry.provide(GreeterId, { greet: () => 'a' });
    expect(() => registry.provide(GreeterId, { greet: () => 'b' })).toThrow(/already provided/);
  });

  it('disposing a provider frees the id (worker-restart re-provide path)', () => {
    const registry = createServiceRegistry();
    const first = registry.provide(GreeterId, { greet: () => 'first' });
    first.dispose();
    registry.provide(GreeterId, { greet: () => 'second' });
    expect(registry.get(GreeterId).greet()).toBe('second');
  });

  it('whenAvailable resolves immediately for present services and later for future ones', async () => {
    const registry = createServiceRegistry();
    registry.provide(GreeterId, { greet: () => 'now' });
    await expect(registry.whenAvailable(GreeterId)).resolves.toBeDefined();

    const LateId = serviceId<Greeter>('test.late');
    const pending = registry.whenAvailable(LateId);
    registry.provide(LateId, { greet: () => 'later' });
    expect((await pending).greet()).toBe('later');
  });
});
