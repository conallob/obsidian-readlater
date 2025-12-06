# Fix build errors to enable plugin releases via BRAT

## Summary

Fixes the BRAT installation issue where Obsidian BRAT was unable to import the plugin due to missing releases. The root cause was that the build process was failing, preventing any GitHub releases from being created.

### Changes Made

1. **Fixed TypeScript error in `src/providers/registry.ts`** (lines 9, 24)
   - Changed type from `typeof ReadLaterProvider` to `new (config: any) => ReadLaterProvider`
   - Resolves error: "Cannot create an instance of an abstract class"

2. **Updated `esbuild.config.mjs` external dependencies**
   - Added `playwright`, `playwright-core`, and `chromium-bidi` to external list
   - Added all `node:*` prefixed built-in modules (events, fs, path, process, etc.)
   - Prevents esbuild from attempting to bundle these runtime dependencies

3. **Added `package-lock.json`**
   - Ensures consistent dependency resolution across environments

### Impact

- Build now completes successfully without errors
- Generates all required files for Obsidian plugin distribution:
  - `main.js` - bundled plugin code
  - `manifest.json` - plugin metadata
  - `styles.css` - plugin styles
  - `versions.json` - version compatibility mapping

### Why This Fixes BRAT

Once this PR is merged and tagged (e.g., `v1.0.0`), the GitHub Actions workflow will automatically:
1. Build the plugin
2. Run tests
3. Create a GitHub release with all required artifacts including `manifest.json`

BRAT will then be able to find `manifest.json` in the release assets and successfully install the plugin.

## Test Plan

- [x] Run `npm install` to install dependencies
- [x] Run `npm run build` to verify build completes without errors
- [x] Verify all required files are generated:
  - [x] `main.js` exists and is non-empty (24KB)
  - [x] `manifest.json` exists and contains valid JSON
  - [x] `styles.css` exists
  - [x] `versions.json` exists and contains version mapping
- [ ] After merge: Create git tag `1.0.0` and push to trigger release workflow
- [ ] After release: Verify BRAT can successfully install the plugin from GitHub

## Files Changed

- `esbuild.config.mjs` - Added external dependencies for playwright and node modules
- `src/providers/registry.ts` - Fixed TypeScript typing for provider constructors
- `package-lock.json` - Added for consistent dependency resolution (5870 lines added)
