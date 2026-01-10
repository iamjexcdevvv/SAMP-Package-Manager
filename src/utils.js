const path = require("path");
const fs = require("fs");
const os = require("os");

function isValidPackageFormat(package) {
	const regex = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;
	return regex.test(package);
}

function formatJSON(obj, indent, replacer = null) {
	return JSON.stringify(obj, replacer, indent);
}

function isPawnConfigFileFound() {
	const configFilePath = path.join(process.cwd(), "pawn.json");
	return fs.existsSync(configFilePath);
}

function extractPackageNameAndOwner(package) {
	const separatorIdx = package.indexOf("/");
	const username = package.slice(0, separatorIdx);
	const repo = package.slice(separatorIdx + 1);

	return { username, repo };
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
	extractPackageNameAndOwner,
	updatePawnConfigFile,
	getCachedDependenciesDir,
};
