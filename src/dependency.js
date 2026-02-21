// TODO: Handle package installation where the cached dependency should update once specified version dont match in the meta data

const userConfig = require("../spm-config.json");
const personalToken = userConfig.github_token || process.env.GITHUB_TOKEN;

// Core Modules
const fs = require("fs");
const path = require("path");

// Third-Party modules
const { Octokit } = require("octokit");
const octokit = new Octokit({
	auth: personalToken,
	timeout: 10000,
	throttle: {
		onRateLimit: (retryAfter, options) => {
			octokit.log.warn(
				`Request quota exhausted for request ${options.method} ${options.url}`
			);

			// Retry twice after hitting a rate limit error, then give up
			if (options.request.retryCount <= 2) {
				console.log(`Retrying after ${retryAfter} seconds!`);
				return true;
			}
		},
		onSecondaryRateLimit: (retryAfter, options, octokit) => {
			// does not retry, only logs a warning
			octokit.log.warn(
				`Secondary quota detected for request ${options.method} ${options.url}`
			);
		},
	},
});

const unzipper = require("unzipper");
const semver = require("semver");
const yoctoSpinner = require("yocto-spinner").default;

const { pipeline } = require("stream/promises");

// Custom modules
const {
	isValidPackageFormat,
	formatJSON,
	isPawnConfigFileFound,
	extractDependencyInfo,
	updatePawnConfigFile,
	getCachedDependenciesDir,
} = require("./utils");

async function uninstallDependency(package) {
	if (!isPawnConfigFileFound()) {
		console.error("SPM: Can't find the configuration file");
		process.exit(1);
	}

	const pawnConfigFilePath = path.join(process.cwd(), "pawn.json");
	const data = JSON.parse(fs.readFileSync(pawnConfigFilePath, "utf8"));

	const { repo } = extractDependencyInfo(package);

	if (!Object.hasOwn(data.dependencies, package)) {
		console.error("SPM: Can't find the specified dependency");
		process.exit(1);
	}

	const dependencyDirPath = path.join(process.cwd(), "samp_modules", repo);

	try {
		await fs.promises.rm(dependencyDirPath, {
			recursive: true,
			force: true,
		});

		delete data.dependencies[package];
		updatePawnConfigFile(data);

		console.error(`SPM: removed dependency ${package}`);
	} catch (error) {
		console.log(error);
		// console.error("Error: SPM encountered an error");
	}
}

async function installDependency(specifiedPackage) {
	const isValid = isValidPackageFormat(specifiedPackage);

	if (!isValid) {
		console.error("SPM: Invalid format. Use username/repo");
		process.exit(1);
	}

	if (!isPawnConfigFileFound()) {
		console.error("SPM: Can't find the configuration file");
		process.exit(1);
	}

	let { username, repo, specifiedVersion, specifier } =
		extractDependencyInfo(specifiedPackage);

	try {
		const sampModulesDir = path.join(process.cwd(), "samp_modules");
		const cacheDir = getCachedDependenciesDir();

		if (!fs.existsSync(sampModulesDir))
			fs.mkdirSync(sampModulesDir, { recursive: true });

		if (!fs.existsSync(cacheDir))
			fs.mkdirSync(cacheDir, { recursive: true });

		let metadata = {};
		const metadataPath = path.join(cacheDir, "metadata.json");
		const package = `${username}/${repo}`;

		if (fs.existsSync(metadataPath)) {
			metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
		}

		let cachedPackagePath = "";

		if (Object.hasOwn(metadata, package)) {
			if (semver.validRange(metadata[package].specifiedVersion)) {
				metadata[package].availableVersions.sort(semver.rcompare);
				const resolvedVersion = semver.maxSatisfying(
					metadata[package].availableVersions,
					range
				);

				cachedPackagePath = path.join(
					cacheDir,
					`${repo}-${resolvedVersion}`
				);
			}

			specifiedVersion = metadata[package].specifiedVersion;

			cachedPackagePath = path.join(
				cacheDir,
				`${repo}-${metadata[package].specifiedVersion}`
			);
		}

		if (!fs.existsSync(cachedPackagePath)) {
			const { data } = await octokit.rest.repos.get({
				owner: username,
				repo: repo,
			});

			if (!specifiedVersion || !specifier) {
				specifiedVersion = data.default_branch;
			}
			
			spinner.success("Downloaded Package");

			const { response, availableVersions, resolvedVersion } =
				await downloadDependency(
					username,
					repo,
					specifiedVersion,
					specifier
				);

			if (!response?.ok) {
				console.error("Error: Can't download the specified dependency");
				return;
			}

			cachedPackagePath = path.join(
				cacheDir,
				`${repo}-${resolvedVersion}`
			);

			const tempZipPath = path.join(sampModulesDir, `${repo}.zip`);
			const fileStream = fs.createWriteStream(tempZipPath);
			await pipeline(response.body, fileStream);

			await new Promise((resolve, reject) => {
				fs.createReadStream(tempZipPath)
					.pipe(unzipper.Extract({ path: cacheDir }))
					.on("close", resolve)
					.on("error", reject);
			});

			metadata[package] = {
				specifiedVersion,
				availableVersions,
				cachedAt: new Date().toISOString(),
				lastUsed: new Date().toISOString(),
			};

			await fs.promises.writeFile(metadataPath, formatJSON(metadata, 4));

			await fs.promises.unlink(tempZipPath);
		}

		const pattern = path.join(
			process.cwd(),
			"samp_modules",
			repo,
			"**/*.inc"
		);
		let fileFound = false;

		for await (const file of fs.promises.glob(pattern)) {
			if (file) {
				fileFound = true;
				break;
			}
		}

		const targetFolder = path.join(sampModulesDir, repo);

		if (!fileFound) {
			fs.cpSync(cachedPackagePath, targetFolder, { recursive: true });
		}

		const pawnConfigFilePath = path.join(process.cwd(), "pawn.json");
		const config = await fs.promises.readFile(pawnConfigFilePath, "utf8");
		const configData = JSON.parse(config);
		const dependencies = configData.dependencies || {};

		if (!Object.hasOwn(dependencies, package)) {
			dependencies[package] = specifiedVersion;
			configData.dependencies = dependencies;

			updatePawnConfigFile(configData);
		}

		console.log(`SPM: ${package} dependency added`);
	} catch (error) {
		console.log(error);
		// console.error("Error: SPM encountered an error");
	}
}

async function clearCachedDependencies(options) {
	if (options.clean) {
		const cachedDependenciesDirPath = getCachedDependenciesDir();

		try {
			await fs.promises.rm(cachedDependenciesDirPath, {
				recursive: true,
				force: true,
			});

			console.log("SPM: cleanup cached dependencies");
		} catch (error) {
			console.log(error);
			// console.error("Error: SPM encountered an error");
		}
	}
}

async function downloadDependency(username, repo, version, specifier = "@") {
	// TODO: Handle dependency versioning
	let response = {};
	let availableVersions = [];

	try {
		if (specifier === ":") {
			const range = semver.validRange(version);

			if (!range && !semver.valid(version)) {
				return response;
			}

			if (range) {
				availableVersions = await fetchDependencyVersions(
					username,
					repo
				);
				const resolvedVersion = semver.maxSatisfying(
					availableVersions,
					range
				);

				if (!resolvedVersion) {
					console.error(
						`No version of ${username}/${repo} satisfies "${version}"`
					);
					process.exit(1);
				}

				version = resolvedVersion;
			}
		}

		const downloadURL = getDownloadURLBySpecifier(
			username,
			repo,
			version,
			specifier
		);

		response = await fetch(downloadURL);
	} catch (error) {
		console.log(error);
		// console.error("Error: SPM encountered an error");
	}

	return { response, resolvedVersion: version, availableVersions };
}

function getDownloadURLBySpecifier(username, repo, version, specifier = "@") {
	let downloadURL = `https://github.com/${username}/${repo}/archive`;

	switch (specifier) {
		case "@":
			downloadURL = downloadURL.concat(`/refs/heads/${version}.zip`);
			break;
		case ":":
			downloadURL = downloadURL.concat(`/refs/tags/${version}.zip`);
			break;
		case "#":
			downloadURL = downloadURL.concat(`/${version}.zip`);
			break;
		default:
			console.error("SPM: Unknown specifier");
	}

	return downloadURL;
}

async function fetchDependencyVersions(username, repo) {
	const availableVersions = [];

	try {
		const { data } = await octokit.rest.repos.listTags({
			owner: username,
			repo: repo,
		});

		data.forEach((v) => availableVersions.push(v.name));
		availableVersions.sort(semver.rcompare);
	} catch (error) {
		console.log(error);
		// console.error("Error: SPM encountered an error");
	}

	return availableVersions;
}

module.exports = {
	installDependency,
	clearCachedDependencies,
	uninstallDependency,
};
