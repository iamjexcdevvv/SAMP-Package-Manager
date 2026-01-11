const userConfig = require("../spm-config.json");
const personalToken = userConfig.github_token || process.env.GITHUB_TOKEN;

// Core Modules
const fs = require("fs");
const path = require("path");

// Third-Party modules
const { Octokit } = require("octokit");
const octokit = new Octokit({ auth: personalToken, timeout: 10000 });

const unzipper = require("unzipper");

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

async function uninstallPackage(package) {
	if (!isPawnConfigFileFound()) {
		console.error("SPM: Can't find the configuration file");
		process.exit(1);
	}

	const pawnConfigFilePath = path.join(process.cwd(), "pawn.json");
	const data = JSON.parse(
		fs.readFileSync(pawnConfigFilePath, "utf8")
	);

	const { repo } = extractDependencyInfo(package);

	if (!Object.hasOwn(data.dependencies, repo)) {
		console.error("SPM: Can't find the specified dependency");
		process.exit(1);
	}

	const dependencyDirPath = path.join(process.cwd(), "samp_modules", repo);

	try {
		await fs.promises.rm(dependencyDirPath, {
			recursive: true,
			force: true,
		});

		delete data.dependencies[repo];
		updatePawnConfigFile(data);

		console.log(`SPM: removed dependency ${package}`);
	} catch (error) {
		console.error("Error: SPM encountered an error");
	}
}

async function installPackage(package) {
	const isValid = isValidPackageFormat(package);

	if (!isValid) {
		console.error("SPM: Invalid format. Use username/repo");
		process.exit(1);
	}

	if (!isPawnConfigFileFound()) {
		console.error("SPM: Can't find the configuration file");
		process.exit(1);
	}

	const { username, repo } = extractDependencyInfo(package);

	try {
		const sampModulesDir = path.join(process.cwd(), "samp_modules");
		const cacheDir = getCachedDependenciesDir();

		if (!fs.existsSync(sampModulesDir))
			fs.mkdirSync(sampModulesDir, { recursive: true });

		if (!fs.existsSync(cacheDir))
			fs.mkdirSync(cacheDir, { recursive: true });

		let branch;
		let metadata = {};
		const metadataPath = path.join(cacheDir, "metadata.json");

		if (fs.existsSync(metadataPath)) {
			metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
		}

		if (!metadata[package]) {
			const { data } = await octokit.rest.repos.get({
				owner: username,
				repo: repo,
			});

			branch = data.default_branch;

			metadata[package] = {
				branch,
				cachedAt: new Date().toISOString(),
				lastUsed: new Date().toISOString(),
			};

			await fs.promises.writeFile(metadataPath, formatJSON(metadata, 4));
		} else {
			branch = metadata[package].branch;
		}

		const cachedPackagePath = path.join(cacheDir, `${repo}-${branch}`);

		const extractedFolder = path.join(cacheDir, `${repo}-${branch}`);
		const targetFolder = path.join(sampModulesDir, repo);

		if (!fs.existsSync(cachedPackagePath)) {
			const downloadURL = `https://github.com/${username}/${repo}/archive/refs/heads/${branch}.zip`;

			const response = await fetch(downloadURL);

			if (!response.ok) {
				console.error("Error: Can't download the library");
				process.exit(1);
			}

			const tempZipPath = path.join(sampModulesDir, `${repo}.zip`);
			const fileStream = fs.createWriteStream(tempZipPath);
			await pipeline(response.body, fileStream);

			await new Promise((resolve, reject) => {
				fs.createReadStream(tempZipPath)
					.pipe(unzipper.Extract({ path: cacheDir }))
					.on("close", resolve)
					.on("error", reject);
			});

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

		if (!fileFound) {
			fs.cpSync(extractedFolder, targetFolder, { recursive: true });
		}

		const pawnConfigFilePath = path.join(process.cwd(), "pawn.json");
		const config = await fs.promises.readFile(pawnConfigFilePath, "utf8");
		const configData = JSON.parse(config);
		const dependencies = configData.dependencies || {};

		if (!Object.hasOwn(dependencies, repo)) {
			dependencies[repo] = branch;
			configData.dependencies = dependencies;

			updatePawnConfigFile(configData);
		}

		console.log(`SPM: ${package} has been succesfully installed`);
	} catch (error) {
		console.error("Error: SPM encountered an error");
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
			console.log("Error: SPM encountered an error");
		}
	}
}

module.exports = { installPackage, clearCachedDependencies, uninstallPackage };
