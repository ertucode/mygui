import { Store } from '@xstate/store'
import { useSyncExternalStore } from 'react'

export function subscribeToStores<const Stores extends readonly AnyStore[]>(
  stores: Stores,
  selector: (contexts: ContextsOf<Stores>) => readonly any[],
  fn: (contexts: ContextsOf<Stores>, changedIndexes: number[]) => void
) {
  let lastChecks: readonly any[] | undefined

  const getContexts = (): ContextsOf<Stores> => stores.map(s => s.getSnapshot().context) as ContextsOf<Stores>

  const notifyIfChanged = () => {
    const contexts = getContexts()
    const currentChecks = selector(contexts)

    const changedIndexes: number[] = []
    if (lastChecks === undefined) {
      lastChecks = currentChecks
      for (let i = 0; i < currentChecks.length; i++) {
        changedIndexes.push(i)
      }
    } else {
      for (let i = 0; i < currentChecks.length; i++) {
        if (lastChecks && lastChecks[i] !== currentChecks[i]) {
          changedIndexes.push(i)
        }
      }
    }

    if (lastChecks?.length === currentChecks.length && changedIndexes.length === 0) return

    lastChecks = currentChecks
    fn(contexts, changedIndexes)
  }

  // initial run (optional but usually desired)
  notifyIfChanged()

  const unsubscribers = stores.map(store =>
    store.subscribe(() => {
      notifyIfChanged()
    })
  )

  return () => {
    unsubscribers.forEach(unsub => unsub.unsubscribe())
  }
}

type AnyStore = Store<any, any, any>

type StoreContext<S> = S extends Store<infer TContext, any, any> ? TContext : never

type ContextsOf<Stores extends readonly AnyStore[]> = {
  [K in keyof Stores]: StoreContext<Stores[K]>
}

export function createUseDerivedStoreValue<const Stores extends readonly AnyStore[], TDerivedValue>(
  stores: Stores,
  selector: (contexts: ContextsOf<Stores>) => readonly any[],
  fn: (contexts: ContextsOf<Stores>) => TDerivedValue
) {
  let last:
    | {
        checks: readonly any[]
        id: number
        value: TDerivedValue
        contexts: ContextsOf<Stores>
      }
    | undefined

  const subscribe = (onStoreChange: () => void) => {
    // Subscribe to all stores
    const subscriptions = stores.map(store => store.subscribe(onStoreChange))

    // Return cleanup function
    return () => {
      subscriptions.forEach(sub => sub.unsubscribe())
    }
  }

  const getSnapshot = () => {
    const contexts = stores.map(s => s.getSnapshot().context) as ContextsOf<Stores>
    if (last && contexts.every((c, i) => c === last?.contexts[i])) return last.value

    // Only recompute the derived value if checks actually changed
    const checks = selector(contexts)
    if (!last || last.checks.length !== checks.length || last.checks.some((v, i) => v !== checks[i])) {
      last = {
        checks,
        id: Math.random(),
        value: fn(contexts),
        contexts,
      }
    }

    return last.value
  }

  return [
    function useDerivedStoreValue(): TDerivedValue {
      // Use useSyncExternalStore for manual subscription that only rerenders when
      // the selector check values actually change, not when unrelated store parts change.

      return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    },
    () => last?.value,
  ] as const
}
