import { Store } from "@xstate/store";
import { useSelector } from "@xstate/store/react";

export function subscribeToStores<const Stores extends readonly AnyStore[]>(
  stores: Stores,
  selector: (contexts: ContextsOf<Stores>) => readonly any[],
  fn: (contexts: ContextsOf<Stores>, changedIndexes: number[]) => void,
) {
  let lastChecks: readonly any[] | undefined;

  const getContexts = (): ContextsOf<Stores> =>
    stores.map((s) => s.getSnapshot().context) as ContextsOf<Stores>;

  const notifyIfChanged = () => {
    const contexts = getContexts();
    const currentChecks = selector(contexts);

    if (lastChecks && lastChecks.length === currentChecks.length) {
      return;
    }

    const changedIndexes: number[] = [];
    for (let i = 0; i < currentChecks.length; i++) {
      if (lastChecks && lastChecks[i] !== currentChecks[i]) {
        changedIndexes.push(i);
      }
    }

    if (changedIndexes.length === 0) return;

    lastChecks = currentChecks;
    fn(contexts, changedIndexes);
  };

  // initial run (optional but usually desired)
  notifyIfChanged();

  const unsubscribers = stores.map((store) =>
    store.subscribe(() => {
      notifyIfChanged();
    }),
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub.unsubscribe());
  };
}

type AnyStore = Store<any, any, any>;

type StoreContext<S> =
  S extends Store<infer TContext, any, any> ? TContext : never;

type ContextsOf<Stores extends readonly AnyStore[]> = {
  [K in keyof Stores]: StoreContext<Stores[K]>;
};

export function createUseDerivedStoreValue<
  const Stores extends readonly AnyStore[],
  TDerivedValue,
>(
  stores: Stores,
  selector: (contexts: ContextsOf<Stores>) => readonly any[],
  fn: (contexts: ContextsOf<Stores>) => TDerivedValue,
) {
  let last:
    | {
        checks: readonly any[];
        id: number;
        value: TDerivedValue;
      }
    | undefined;

  return [
    function useDerivedStoreValue(): TDerivedValue {
      // subscribe to each store context
      const contexts = stores.map((store) =>
        useSelector(store, (state) => state.context),
      ) as ContextsOf<Stores>;

      const checks = selector(contexts);

      if (
        !last ||
        last.checks.length !== checks.length ||
        last.checks.some((v, i) => v !== checks[i])
      ) {
        last = {
          checks,
          id: Math.random(),
          value: fn(contexts),
        };
      }

      return last.value;
    },
    () => last?.value,
  ] as const;
}
