- npm run dev
- npm run build (Build for mac, works after npm run build-vendor is run once)
- npm run build-everything (Build for mac, runs build-vendor and build)
- xattr -cr /Applications/Koda.app (To run built)

# TODO

- find and replace
- unarchive as file if only one file
- command system: stdout -> call with arguments -> if missing, the script returns metadata. else runs and prints messages.
  - for example: file picker, folder picker, just text. etc, add as required
  - maybe script does not return metadata but add it in definition (optional fields)
  - extension config
  - event for refreshing a directory

# AMBITIOUS TODO

- Plugin system ( run arbitrary script with the file path as an argument)
- File encryption
- tree view
- themes
