#!/bin/bash

# Release script for Obsidian plugin
# This script automates the release process for BRAT-compatible releases
#
# Usage: ./scripts/release.sh [--dry-run]

set -euo pipefail

# Parse arguments
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - No changes will be made"
    echo ""
fi

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

# Check required dependencies
if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed"
    print_info "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    print_error "gh CLI is required but not installed"
    print_info "Install with: brew install gh (macOS) or see https://cli.github.com/manual/installation"
    exit 1
fi

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

# Get current version from manifest.json using jq for robust parsing
CURRENT_VERSION=$(jq -r '.version' manifest.json)
print_info "Current version: $CURRENT_VERSION"

# Function to compare semantic versions (returns 0 if $1 > $2, 1 otherwise)
version_gt() {
    test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# Function to calculate next version based on release type
calculate_next_version() {
    local current_version=$1
    local release_type=$2

    case $release_type in
        patch)
            echo "$current_version" | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g'
            ;;
        minor)
            echo "$current_version" | awk -F. '{$(NF-1) = $(NF-1) + 1; $NF = 0;} 1' | sed 's/ /./g'
            ;;
        major)
            echo "$current_version" | awk -F. '{$1 = $1 + 1; $2 = 0; $3 = 0;} 1' | sed 's/ /./g'
            ;;
        *)
            echo "$current_version"
            ;;
    esac
}

# Determine release type
echo ""
echo "Select release type:"
echo "  1) Patch (bug fixes)        - ${CURRENT_VERSION} → $(calculate_next_version "$CURRENT_VERSION" patch)"
echo "  2) Minor (new features)     - ${CURRENT_VERSION} → $(calculate_next_version "$CURRENT_VERSION" minor)"
echo "  3) Major (breaking changes) - ${CURRENT_VERSION} → $(calculate_next_version "$CURRENT_VERSION" major)"
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

        # Validate version ordering
        if ! version_gt "$CUSTOM_VERSION" "$CURRENT_VERSION"; then
            print_error "Custom version $CUSTOM_VERSION is not greater than current version $CURRENT_VERSION"
            print_info "Version must be greater than current version to prevent accidental downgrades"
            exit 1
        fi
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

# Run build and tests before version bump
if [ "$DRY_RUN" = false ]; then
    print_info "Running build and tests..."
    if ! npm run build; then
        print_error "Build failed. Please fix errors before releasing."
        exit 1
    fi

    if ! npm test; then
        print_error "Tests failed. Please fix errors before releasing."
        exit 1
    fi

    print_success "Build and tests passed"
else
    print_info "Skipping build and tests (dry run)"
fi

# Bump version
print_info "Bumping version..."
if [ "$DRY_RUN" = false ]; then
    if [ -n "${CUSTOM_VERSION:-}" ]; then
        # Use npm version for consistency (it triggers version-bump.mjs hook)
        npm version "$CUSTOM_VERSION" --no-git-tag-version
    else
        # npm version automatically runs version-bump.mjs via package.json scripts
        npm version $RELEASE_TYPE --no-git-tag-version
    fi

    # Read version from package.json after npm version (single source of truth)
    NEW_VERSION=$(jq -r '.version' package.json)
    print_success "Version bumped to $NEW_VERSION"
else
    # Dry run - calculate what the version would be
    if [ -n "${CUSTOM_VERSION:-}" ]; then
        NEW_VERSION=$CUSTOM_VERSION
    else
        NEW_VERSION=$(calculate_next_version "$CURRENT_VERSION" "$RELEASE_TYPE")
    fi
    print_info "Would bump version to $NEW_VERSION"
fi

# Show what changed
if [ "$DRY_RUN" = false ]; then
    print_info "Changes to be committed:"
    DIFF_OUTPUT=$(git diff package.json manifest.json versions.json)
    if [ -n "$DIFF_OUTPUT" ]; then
        echo "$DIFF_OUTPUT"
    else
        print_warning "No changes detected (this may indicate a problem with version bump)"
    fi
else
    print_info "Would update: package.json, manifest.json, versions.json"
fi

echo ""
if [ "$DRY_RUN" = false ]; then
    read -p "Commit and create release? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Release cancelled. Changes have been made but not committed."
        print_info "To revert: git checkout package.json manifest.json versions.json"
        exit 0
    fi
else
    print_info "Would prompt for confirmation (skipped in dry run)"
fi

# Commit changes
if [ "$DRY_RUN" = false ]; then
    print_info "Committing version bump..."
    git add package.json manifest.json versions.json
    git commit -m "Release version $NEW_VERSION"
else
    print_info "Would commit with message: 'Release version $NEW_VERSION'"
fi

# Create and push tag
if [ "$DRY_RUN" = false ]; then
    print_info "Creating tag $NEW_VERSION..."
    git tag $NEW_VERSION
else
    print_info "Would create tag: $NEW_VERSION"
fi

# Push changes with error handling
if [ "$DRY_RUN" = false ]; then
    print_info "Pushing commits to remote..."
    if ! git push; then
        print_error "Failed to push commits to remote"
        print_warning "The version has been committed locally but not pushed"
        print_info "To retry: git push && git push --tags"
        print_info "To undo: git reset --hard HEAD~1 && git tag -d $NEW_VERSION"
        exit 1
    fi

    print_info "Pushing tags to remote..."
    if ! git push --tags; then
        print_error "Failed to push tags to remote"
        print_warning "Commits were pushed but tag $NEW_VERSION was not"
        print_info "To retry: git push --tags"
        print_info "To undo tag: git tag -d $NEW_VERSION"
        exit 1
    fi
else
    print_info "Would push commits and tags to remote"
fi

if [ "$DRY_RUN" = false ]; then
    print_success "Release $NEW_VERSION created and pushed!"
    print_info "GitHub Actions will now build and create the release."

    # Get repository info using gh CLI for robustness
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
    if [ -n "$REPO" ]; then
        print_info "Check: https://github.com/$REPO/actions"
    else
        print_info "Check your repository's Actions tab for build status"
    fi

    echo ""
    print_warning "Don't forget to:"
    echo "  1. Review and publish the draft release on GitHub"
    echo "  2. Add release notes describing the changes"
    echo ""
    print_info "If something goes wrong:"
    echo "  • Tag already pushed: You can delete it with 'git push --delete origin $NEW_VERSION'"
    echo "  • Commits already pushed: Coordinate with team before force-pushing"
    echo "  • Failed release creation: Check GitHub Actions logs and manually create release if needed"
else
    print_success "Dry run complete!"
    print_info "Would create release version $NEW_VERSION"
    echo ""
    print_info "To actually perform the release, run:"
    echo "  ./scripts/release.sh"
fi
