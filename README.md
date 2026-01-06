- npm run dev
- npm run build (Build for mac, works after npm run build-vendor is run once)
- npm run build-everything (Build for mac, runs build-vendor and build)
- xattr -cr /Applications/Koda.app (To run built)

# TODO

- for archives, navgate to it on double click. show unarchive button on the name part
  - open dialog
- vim fuzzy

  - Add to vim buffer

  ```typescript
    fuzzy: {
        query: string,
        matches: {row: number, columns: [number, number]}[]
        active: boolean // fuzzy input is visible, show highlights
    } | undefined
  ```

  - Unfocusing fuzzy input should clear the fuzzy state to undefined. The initial fuzzy state is undefined as well.
  - Move cursor when updating fuzzy state
  - can move cursor with ctrl+j and ctrl+k
  - esc to hide fuzzy input but don't clear the fuzzyQuery
  - remove the filteredData getting filtered by fuzzyQuery, remove the fuzzyQuery from the store. It will be part of the vim buffer now.
  - always use this?
  - Showing the fuzzy input again (pressing /) should delete the query string. Pressing up on the input should bring it back.
  - User will cycle through the matches with n and N when fuzzy input is not active
  - User will cycle through the matches with ctrl+n and ctrl+shift+n when fuzzy input is active
  - FuzzyInput component should memoize the Fuse instance per items, also it should use VimEngine.setFuzzyQuery function to set the query. VimEngine should calculate the matches and set the fuzzy state.
  - Update fuzzy history on fuzzy input unfocus

- selection can't remove select

# AMBITIOUS TODO

- Plugin system
- File encryption
- tree view
- themes

# EH TODO

- fix pending selection to be actually pending selection, not after selection
