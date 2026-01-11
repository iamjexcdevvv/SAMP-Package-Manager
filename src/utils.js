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

function extractPackageNameAndOwner(package) {
	const separatorIdx = package.indexOf("/");
	const branchSpecifierIdx = package.indexOf("@");
	const releaseTagSpecifierIdx = package.indexOf(":")
	const commitHashSpecifierIdx = package.indexOf("#");

	const dependencyInfo = {};
	let remaining = package;

	if (branchSpecifierIdx !== -1) {
		dependencyInfo.version = package.slice(branchSpecifierIdx + 1);
		remaining = remaining.slice(0, branchSpecifierIdx);
	}
	else if (releaseTagSpecifierIdx !== -1)
	{
		dependencyInfo.version = package.slice(releaseTagSpecifierIdx + 1);
		remaining = remaining.slice(0, releaseTagSpecifierIdx);
	}
	else if (commitHashSpecifierIdx !== -1)
	{
		dependencyInfo.version = package.slice(commitHashSpecifierIdx + 1);
		remaining = remaining.slice(0, commitHashSpecifierIdx);
	}
	else {
		dependencyInfo.version = NULL;
	}

	if (separatorIdx !== -1) {
		dependencyInfo.username = remaining.slice(0, separatorIdx);
		dependencyInfo.repo = remaining.slice(separatorIdx + 1);
	}

	dependencyInfo.specifier = package.charAt(branchSpecifierIdx) || package.charAt(releaseTagSpecifierIdx) || package.charAt(commitHashSpecifierIdx);

	return dependencyInfo;
}

function getDownloadURLBySpecifier(specifier, username, repo, version)
{
	let downloadURL = `https://github.com/${username}/${repo}/archive`;

	switch(specifier)
	{
		case '@':
			downloadURL = downloadURL.concat(`/refs/heads/${version}.zip`);
			break;
		case ':':
			downloadURL = downloadURL.concat(`/refs/tags/${version}.zip`);
			break;
		case '#': 
			downloadURL = downloadURL.concat(`/${version}.zip`);
			break;
		default:
			console.error("SPM: Unknown specifier");
	}

	return downloadURL;
}

async function downloadDependency(specifier, username, repo, version) {
	const downloadURL = getDownloadURLBySpecifier(specifier, username, repo, version);

	let response;

	try {
		response = await fetch(downloadURL);
	} catch (error) {
		console.error(error);
	}

	return response;
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
	downloadDependency
};
