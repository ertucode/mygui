- npm run dev
- npm run build (Build for mac, works after npm run build-vendor is run once)
- npm run build-everything (Build for mac, runs build-vendor and build)
- xattr -cr /Applications/Koda.app (To run built)

# TODO

- find and replace
- unarchive as file if only one file
- pasting should show a dialog if there are conflicts, the backend should return problematic paths, a last updated date
  - user should select don't copy or overwrite, or new name

# AMBITIOUS TODO

- Plugin system ( run arbitrary script with the file path as an argument)
- File encryption
- tree view
- themes
