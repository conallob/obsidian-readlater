import { readFileSync, writeFileSync, existsSync } from "fs";

const targetVersion = process.env.npm_package_version;

// Validate target version format
if (!targetVersion || !/^\d+\.\d+\.\d+$/.test(targetVersion)) {
	console.error(`Error: Invalid version format: ${targetVersion}`);
	process.exit(1);
}

// read minAppVersion from manifest.json and bump version to target version
let manifest;
try {
	manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
} catch (error) {
	console.error("Error: manifest.json is not valid JSON or cannot be read");
	console.error(error.message);
	process.exit(1);
}

const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
let versions = {};
if (existsSync("versions.json")) {
	try {
		versions = JSON.parse(readFileSync("versions.json", "utf8"));
	} catch (error) {
		console.error("Error: versions.json exists but is not valid JSON");
		console.error(error.message);
		process.exit(1);
	}
} else {
	console.log("versions.json not found, creating new file");
}
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
