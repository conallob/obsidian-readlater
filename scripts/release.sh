#!/bin/bash

# Release script for Obsidian plugin
# This script automates the release process for BRAT-compatible releases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    git status --short
    exit 1
fi

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "You are on branch '$CURRENT_BRANCH', not 'main'"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get current version from manifest.json
CURRENT_VERSION=$(grep '"version"' manifest.json | sed -E 's/.*"version": "([^"]+)".*/\1/')
print_info "Current version: $CURRENT_VERSION"

# Determine release type
echo ""
echo "Select release type:"
echo "  1) Patch (bug fixes)        - ${CURRENT_VERSION} → $(echo $CURRENT_VERSION | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')"
echo "  2) Minor (new features)     - ${CURRENT_VERSION} → $(echo $CURRENT_VERSION | awk -F. '{$(NF-1) = $(NF-1) + 1; $NF = 0;} 1' | sed 's/ /./g')"
echo "  3) Major (breaking changes) - ${CURRENT_VERSION} → $(echo $CURRENT_VERSION | awk -F. '{$1 = $1 + 1; $2 = 0; $3 = 0;} 1' | sed 's/ /./g')"
echo "  4) Custom version"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        RELEASE_TYPE="patch"
        ;;
    2)
        RELEASE_TYPE="minor"
        ;;
    3)
        RELEASE_TYPE="major"
        ;;
    4)
        read -p "Enter custom version (e.g., 1.2.3): " CUSTOM_VERSION
        if [[ ! $CUSTOM_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            print_error "Invalid version format. Must be X.Y.Z"
            exit 1
        fi
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# Bump version
print_info "Bumping version..."
if [ -n "$CUSTOM_VERSION" ]; then
    # Update manifest.json
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$CUSTOM_VERSION\"/" manifest.json && rm manifest.json.bak

    # Update versions.json
    MIN_APP_VERSION=$(grep '"minAppVersion"' manifest.json | sed -E 's/.*"minAppVersion": "([^"]+)".*/\1/')
    # Create temporary file with updated versions.json
    if [ -f versions.json ]; then
        # Add new version to existing versions.json
        jq ". + {\"$CUSTOM_VERSION\": \"$MIN_APP_VERSION\"}" versions.json > versions.json.tmp && mv versions.json.tmp versions.json
    else
        echo "{\"$CUSTOM_VERSION\": \"$MIN_APP_VERSION\"}" | jq . > versions.json
    fi

    NEW_VERSION=$CUSTOM_VERSION
else
    npm version $RELEASE_TYPE --no-git-tag-version
    NEW_VERSION=$(grep '"version"' manifest.json | sed -E 's/.*"version": "([^"]+)".*/\1/')
fi

print_success "Version bumped to $NEW_VERSION"

# Show what changed
print_info "Changes to be committed:"
git diff manifest.json versions.json

echo ""
read -p "Commit and create release? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Release cancelled. Changes have been made but not committed."
    print_info "To revert: git checkout manifest.json versions.json"
    exit 0
fi

# Commit changes
print_info "Committing version bump..."
git add manifest.json versions.json
git commit -m "Release version $NEW_VERSION"

# Create and push tag
print_info "Creating tag $NEW_VERSION..."
git tag $NEW_VERSION

# Push changes
print_info "Pushing to remote..."
git push
git push --tags

print_success "Release $NEW_VERSION created and pushed!"
print_info "GitHub Actions will now build and create the release."
print_info "Check: https://github.com/$(git remote get-url origin | sed -E 's/.*github.com[:\/](.+)\.git/\1/')/actions"

echo ""
print_warning "Don't forget to:"
echo "  1. Review and publish the draft release on GitHub"
echo "  2. Add release notes describing the changes"
