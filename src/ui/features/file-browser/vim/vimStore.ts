import { createStore, StoreSnapshot } from "@xstate/store";
import { VimEngine } from "@common/VimEngine";
import { DirectoryId } from "../directoryStore/DirectoryBase";

type VimStoreContext = {
  vimStatesByDirectoryId: Record<DirectoryId, VimEngine.State>;
};

export const vimStore = createStore({
  context: {
    vimStatesByDirectoryId: {} as Record<DirectoryId, VimEngine.State>,
  } as VimStoreContext,
  on: {
    initVimState: (
      context,
      event: { directoryId: DirectoryId; state: VimEngine.State },
    ) => ({
      ...context,
      vimStatesByDirectoryId: {
        ...context.vimStatesByDirectoryId,
        [event.directoryId]: event.state,
      },
    }),

    updateVimState: (
      context,
      event: {
        directoryId: DirectoryId;
        updater: (state: VimEngine.State) => VimEngine.State;
      },
    ) => {
      const currentState = context.vimStatesByDirectoryId[event.directoryId];
      if (!currentState) return context;

      return {
        ...context,
        vimStatesByDirectoryId: {
          ...context.vimStatesByDirectoryId,
          [event.directoryId]: event.updater(currentState),
        },
      };
    },

    removeVimState: (context, event: { directoryId: DirectoryId }) => {
      const newStates = { ...context.vimStatesByDirectoryId };
      delete newStates[event.directoryId];

      return {
        ...context,
        vimStatesByDirectoryId: newStates,
      };
    },
  },
});

export function selectCursor(directoryId: DirectoryId, index: number) {
  return (state: StoreSnapshot<VimStoreContext>) => {
    const vimState = state.context.vimStatesByDirectoryId[directoryId];
    if (!vimState) return undefined;
    if (vimState.cursor.line !== index) return undefined;
    return {
      column: vimState.cursor.column,
      mode: vimState.mode,
    };
  };
}
