import { Store } from "@xstate/store";

export function subscribeToStore<T extends Store<any, any, any>>(
  store: T,
  selector: (state: ReturnType<T["getSnapshot"]>["context"]) => any[],
  fn: (state: ReturnType<T["getSnapshot"]>["context"]) => void,
) {
  let lastChecks: any[] | undefined = undefined;
  store.subscribe((state) => {
    const currentChecks = selector(state.context);
    if (
      lastChecks !== undefined &&
      lastChecks.every((prevItem, index) => prevItem === currentChecks[index])
    )
      return;

    lastChecks = currentChecks;

    fn(state.context);
  });
}
