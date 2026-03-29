#!/bin/bash

# Script to recursively remove all empty folders inside a provided path
# Usage: ./remove_empty_folders.sh <path>

set -e

# Check if a path is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <path>"
    echo "Recursively removes all empty folders inside the provided path."
    exit 1
fi

TARGET_PATH="$1"

# Check if the path exists
if [ ! -d "$TARGET_PATH" ]; then
    echo "Error: '$TARGET_PATH' is not a valid directory."
    exit 1
fi

echo "Searching for empty folders in: $TARGET_PATH"

# Count empty folders before removal
empty_count=$(find "$TARGET_PATH" -type d -empty 2>/dev/null | wc -l | tr -d ' ')

if [ "$empty_count" -eq 0 ]; then
    echo "No empty folders found."
    exit 0
fi

echo "Found $empty_count empty folder(s)."

# List empty folders that will be removed
echo ""
echo "Empty folders to be removed:"
find "$TARGET_PATH" -type d -empty -print 2>/dev/null

echo ""
read -p "Do you want to remove these folders? (y/N): " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
    # Remove empty directories recursively (depth-first)
    # Using -depth ensures subdirectories are processed before parent directories
    find "$TARGET_PATH" -type d -empty -delete 2>/dev/null
    echo "Empty folders have been removed."
else
    echo "Operation cancelled."
fi
