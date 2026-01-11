const path = require("path");
const fs = require("fs");
const os = require("os");

function isValidPackageFormat(package) {
	const regex =
		/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)([@:#][a-zA-Z0-9_.\/-]+)?$/;
	return regex.test(package);
}

function formatJSON(obj, indent, replacer = null) {
	return JSON.stringify(obj, replacer, indent);
}

function isPawnConfigFileFound() {
	const configFilePath = path.join(process.cwd(), "pawn.json");
	return fs.existsSync(configFilePath);
}

function extractDependencyInfo(package) {
	const separatorIdx = package.indexOf("/");
	const branchSpecifierIdx = package.indexOf("@");
	const releaseTagSpecifierIdx = package.indexOf(":");
	const commitHashSpecifierIdx = package.indexOf("#");

	const dependencyInfo = {};
	let remaining = package;

	if (branchSpecifierIdx !== -1) {
		dependencyInfo.specifiedVersion = package.slice(branchSpecifierIdx + 1);
		remaining = remaining.slice(0, branchSpecifierIdx);
	} else if (releaseTagSpecifierIdx !== -1) {
		dependencyInfo.specifiedVersion = package.slice(releaseTagSpecifierIdx + 1);
		remaining = remaining.slice(0, releaseTagSpecifierIdx);
	} else if (commitHashSpecifierIdx !== -1) {
		dependencyInfo.specifiedVersion = package.slice(commitHashSpecifierIdx + 1);
		remaining = remaining.slice(0, commitHashSpecifierIdx);
	} else {
		dependencyInfo.specifiedVersion = null;
	}

	if (separatorIdx !== -1) {
		dependencyInfo.username = remaining.slice(0, separatorIdx);
		dependencyInfo.repo = remaining.slice(separatorIdx + 1);
	}

	dependencyInfo.specifier =
		package.charAt(releaseTagSpecifierIdx) ||
		package.charAt(commitHashSpecifierIdx) ||
		"@";

	return dependencyInfo;
}

function updatePawnConfigFile(configData) {
	const formattedStr = formatJSON(configData, 4);
	fs.writeFileSync("pawn.json", formattedStr);
}

function getCachedDependenciesDir() {
	const appDataDir =
		process.env.APPDATA ||
		(process.platform === "darwin"
			? path.join(os.homedir(), "Library", "Application Support")
			: path.join(os.homedir(), ".local", "share"));

	const cacheDir = path.join(appDataDir, "spm", "cache");
	return cacheDir;
}

module.exports = {
	isValidPackageFormat,
	formatJSON,
	isPawnConfigFileFound,
	extractDependencyInfo,
	updatePawnConfigFile,
	getCachedDependenciesDir,
};
