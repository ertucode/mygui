import React, { Dispatch, SetStateAction, useState } from "react";

export type SelectionState = {
  indexes: Set<number>;
  lastSelected?: number;
};
export type SelectionInput = {
  state: SelectionState;
  setState: Dispatch<SetStateAction<SelectionState>>;
};
export function useSelection(props: SelectionInput) {
  const { state, setState } = props;

  const select = (index: number, event: React.MouseEvent | KeyboardEvent) => {
    // event.preventDefault();
    // event.stopPropagation();

    if (event.shiftKey && state.lastSelected != null) {
      const lastSelected = state.lastSelected;
      const indexes = new Set(state.indexes);

      if (lastSelected > index) {
        let allSelected = true;
        for (let i = lastSelected - 1; i >= index; i--) {
          if (!indexes.has(i)) {
            allSelected = false;
            break;
          }
        }

        if (allSelected) {
          for (let i = lastSelected - 1; i >= index; i--) {
            indexes.delete(i);
          }
        } else {
          for (let i = lastSelected - 1; i >= index; i--) {
            indexes.add(i);
          }
        }
      } else {
        let allSelected = true;
        for (let i = lastSelected + 1; i <= index; i++) {
          if (!indexes.has(i)) {
            allSelected = false;
            break;
          }
        }

        if (allSelected) {
          for (let i = lastSelected + 1; i <= index; i++) {
            indexes.delete(i);
          }
        } else {
          for (let i = lastSelected + 1; i <= index; i++) {
            indexes.add(i);
          }
        }
      }

      setState({ indexes, lastSelected: index });
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      if (state.indexes.has(index)) {
        setState({
          indexes: Helpers.remove(state.indexes, index),
          lastSelected: index,
        });
        return;
      }
      setState({
        indexes: new Set([...state.indexes, index]),
        lastSelected: index,
      });
      return;
    }

    setState({ indexes: new Set([index]), lastSelected: index });
  };

  const getShortcuts = (count: number) => [
    {
      key: [{ key: "a", metaKey: true }],
      handler: (e: KeyboardEvent) => {
        setState({
          indexes: new Set(Array.from({ length: count }).map((_, i) => i)),
          lastSelected: count - 1,
        });
        e.preventDefault();
      },
    },
    {
      key: ["ArrowUp", "k", "K"],
      handler: (e: KeyboardEvent) => {
        const lastSelected = state.lastSelected ?? 0;
        if (state.indexes.has(lastSelected - 1)) {
          setState({
            indexes: Helpers.remove(state.indexes, lastSelected),
            lastSelected: lastSelected - 1,
          });
        } else {
          if (lastSelected - 1 < 0) {
            select(count - 1, e);
          } else {
            select(lastSelected - 1, e);
          }
        }
        e.preventDefault();
      },
    },
    {
      key: ["ArrowDown", "j", "J"],
      handler: (e: KeyboardEvent) => {
        const lastSelected = state.lastSelected ?? 0;
        if (state.indexes.has(lastSelected + 1)) {
          setState({
            indexes: Helpers.remove(state.indexes, lastSelected),
            lastSelected: lastSelected + 1,
          });
        } else {
          if (lastSelected + 1 === count) {
            select(0, e);
          } else {
            select(lastSelected + 1, e);
          }
        }
        e.preventDefault();
      },
    },
    {
      key: "ArrowLeft",
      handler: (e: KeyboardEvent) => {
        const lastSelected = state.lastSelected ?? 0;
        select(lastSelected - 10, e);
        e.preventDefault();
      },
    },
    {
      key: "ArrowRight",
      handler: (e: KeyboardEvent) => {
        const lastSelected = state.lastSelected ?? 0;
        select(lastSelected + 10, e);
        e.preventDefault();
      },
    },
  ];

  return {
    select,
    getShortcuts,
    reset: () => {
      setState(defaultSelection());
    },
    isSelected: (index: number) => state.indexes.has(index),
    selectManually: (index: number) => {
      setState({
        indexes: new Set([index]),
        lastSelected: index,
      });
    },
    state,
    setState,
  };
}

export function useDefaultSelection() {
  const [state, setState] = useState(defaultSelection());
  return {
    state,
    setState,
  };
}

export function defaultSelection(): SelectionState {
  return { indexes: new Set() };
}

namespace Helpers {
  export function remove(set: Set<number>, item: number) {
    const newSet = new Set(set);
    newSet.delete(item);
    return newSet;
  }
}
