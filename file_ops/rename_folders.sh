#!/bin/bash

# Script to recursively find folders with a certain name and rename them
# Usage: ./rename_folders.sh <path> <old_name> <new_name>
# Example:
#   ./rename_folders.sh ./projects draft final
# Expected result:
#   Lists every folder named "draft" under ./projects, asks for confirmation,
#   then renames each one to "final" unless a target folder already exists.

set -e

# Check if all arguments are provided
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <path> <old_name> <new_name>"
    echo "Recursively finds all folders named <old_name> inside <path> and renames them to <new_name>."
    exit 1
fi

TARGET_PATH="$1"
OLD_NAME="$2"
NEW_NAME="$3"

# Check if the path exists
if [ ! -d "$TARGET_PATH" ]; then
    echo "Error: '$TARGET_PATH' is not a valid directory."
    exit 1
fi

# Check if old_name and new_name are different
if [ "$OLD_NAME" = "$NEW_NAME" ]; then
    echo "Error: Old name and new name are the same."
    exit 1
fi

echo "Searching for folders named '$OLD_NAME' in: $TARGET_PATH"

# Find all folders with the specified name
# Using -depth to process deepest directories first (avoids path issues during rename)
# Store results in a temp file for compatibility with older bash versions
temp_file=$(mktemp)
find "$TARGET_PATH" -depth -type d -name "$OLD_NAME" 2>/dev/null > "$temp_file"

folder_count=$(wc -l < "$temp_file" | tr -d ' ')

if [ "$folder_count" -eq 0 ]; then
    echo "No folders named '$OLD_NAME' found."
    rm -f "$temp_file"
    exit 0
fi

echo "Found $folder_count folder(s) named '$OLD_NAME':"
echo ""
while IFS= read -r folder; do
    parent_dir=$(dirname "$folder")
    echo "  $folder -> $parent_dir/$NEW_NAME"
done < "$temp_file"

echo ""
read -p "Do you want to rename these folders? (y/N): " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
    renamed_count=0
    skipped_count=0
    
    while IFS= read -r folder; do
        parent_dir=$(dirname "$folder")
        new_path="$parent_dir/$NEW_NAME"
        
        # Check if target already exists
        if [ -e "$new_path" ]; then
            echo "Skipped: '$folder' -> Target '$new_path' already exists."
            skipped_count=$((skipped_count + 1))
        else
            mv "$folder" "$new_path"
            echo "Renamed: '$folder' -> '$new_path'"
            renamed_count=$((renamed_count + 1))
        fi
    done < "$temp_file"
    
    echo ""
    echo "Done! Renamed $renamed_count folder(s), skipped $skipped_count folder(s)."
else
    echo "Operation cancelled."
fi

rm -f "$temp_file"
