- Let's not use ciw, C for now.

# Plan

- FilteredDirectoryData should be vimified
- Sync selection.last with cursor column
  - Selection should work off vim buffer
- Do we have separate vim view?
  - Yes
    - We just define one columns
    - We could define specific column on str mode
    - Supporting this kind of workflow could be useful later on
    - It's slightly less performant
  - No
    - I dont know how to do without duplicating columns
- Initialize per directory data when manipulation command is called
- On insert mode, we just show an input on a specific column
- Implement keybindings
- Fuzzy: Highlighted matches, do not filter the directory(ESC remembers last match, and n, N moves between matches?)
- Aggregated save data:
  - Just diff the state with the initial state.
  - Do not ask for save if there is no delete, move
- Do not allow settings, sorting to change while there is modifications
  - Show a warning with current changes and allow to cancel

# Optional

- Have a way to show the undo history in the ui with buttons for undoing
