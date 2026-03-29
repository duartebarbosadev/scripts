# file_ops

Small shell scripts for common folder maintenance tasks.

## Scripts

### `rename_folders.sh`
Recursively finds folders with a specific name inside a target path and renames them.

Usage:
```bash
./rename_folders.sh <path> <old_name> <new_name>
```

Example:
```bash
./rename_folders.sh ./projects draft final
```

What it does:
- Searches for every folder named `<old_name>` under `<path>`
- Shows the rename plan before making changes
- Asks for confirmation
- Renames each folder to `<new_name>`
- Skips any rename where the destination already exists

### `remove_empty_folders.sh`
Recursively finds and deletes empty folders inside a target path.

Usage:
```bash
./remove_empty_folders.sh <path>
```

Example:
```bash
./remove_empty_folders.sh ./projects
```

What it does:
- Searches for empty folders under `<path>`
- Lists the folders that can be removed
- Asks for confirmation
- Deletes the empty folders when confirmed
