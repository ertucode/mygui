import React, { useState } from "react";

export type SelectionState = {
  indexes: Set<number>;
  lastSelected?: number;
};
export type SelectionInput = {
  state: SelectionState;
  setState: (state: SelectionState) => void;
};
export function useSelection(props: SelectionInput) {
  const { state, setState } = props;

  const select = (
    index: number,
    event: React.MouseEvent | React.KeyboardEvent,
  ) => {
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

  return {
    select,
    onKeydown: (event: React.KeyboardEvent) => {
      event.preventDefault();

      const lastSelected = state.lastSelected ?? 0;
      if (event.key === "ArrowUp") {
        if (state.indexes.has(lastSelected - 1)) {
          setState({
            indexes: Helpers.remove(state.indexes, lastSelected),
            lastSelected: lastSelected - 1,
          });
        } else {
          select(lastSelected - 1, event);
        }
      } else if (event.key === "ArrowDown") {
        if (state.indexes.has(lastSelected + 1)) {
          setState({
            indexes: Helpers.remove(state.indexes, lastSelected),
            lastSelected: lastSelected + 1,
          });
        } else {
          select(lastSelected + 1, event);
        }
      } else if (event.key === "ArrowLeft") {
        select(lastSelected - 10, event);
      } else if (event.key === "ArrowRight") {
        select(lastSelected + 10, event);
      }
    },
    reset: () => {
      setState(defaultSelection());
    },
    isSelected: (index: number) => state.indexes.has(index),
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
