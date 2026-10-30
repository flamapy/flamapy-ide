import type { Disposable, ServiceId, ServiceRegistry } from './types';

/**
 * The typed service registry: plugins provide implementations under branded string ids
 * and consumers look them up (or await them — activation order makes `whenAvailable`
 * mostly unnecessary, but dynamic providers exist, e.g. after a worker restart).
 */
export function createServiceRegistry(): ServiceRegistry {
  const services = new Map<string, unknown>();
  const waiters = new Map<string, Array<(implementation: unknown) => void>>();

  return {
    provide<T>(id: ServiceId<T>, implementation: T): Disposable {
      if (services.has(id)) {
        throw new Error(`Service '${id}' is already provided.`);
      }
      services.set(id, implementation);
      const pending = waiters.get(id) ?? [];
      waiters.delete(id);
      for (const resolve of pending) {
        resolve(implementation);
      }
      return {
        dispose() {
          if (services.get(id) === implementation) {
            services.delete(id);
          }
        },
      };
    },

    get<T>(id: ServiceId<T>): T {
      if (!services.has(id)) {
        throw new Error(`Service '${id}' is not available.`);
      }
      return services.get(id) as T;
    },

    tryGet<T>(id: ServiceId<T>): T | undefined {
      return services.get(id) as T | undefined;
    },

    whenAvailable<T>(id: ServiceId<T>): Promise<T> {
      if (services.has(id)) {
        return Promise.resolve(services.get(id) as T);
      }
      return new Promise((resolve) => {
        const pending = waiters.get(id) ?? [];
        pending.push(resolve as (implementation: unknown) => void);
        waiters.set(id, pending);
      });
    },
  };
}
