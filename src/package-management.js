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
const { isValidPackageFormat, formatJSON } = require("./utils");

async function installPackage(package) {
	const isValid = isValidPackageFormat(package);

	if (!isValid) {
		console.error("SPM: Invalid format. Use username/repo");
		process.exit(1);
	}

	const configFilePath = path.join(process.cwd(), "pawn.json");

	if (!fs.existsSync(configFilePath)) {
		console.error("SPM: Can't find the configuration file");
		process.exit(1);
	}

	const separatorIdx = package.indexOf("/");
	const username = package.slice(0, separatorIdx);
	const repo = package.slice(separatorIdx + 1);

	try {
		const sampModulesDir = path.join(process.cwd(), "samp_modules");
		const appDataDir =
			process.env.APPDATA ||
			(process.platform === "darwin"
				? path.join(os.homedir(), "Library", "Application Support")
				: path.join(os.homedir(), ".local", "share"));

		const cacheDir = path.join(appDataDir, "spm", "cache");

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

			fs.writeFileSync(metadataPath, formatJSON(metadata, 4));
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

			fs.unlinkSync(tempZipPath);
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

		const config = await fs.promises.readFile(configFilePath, "utf8");
		const configData = JSON.parse(config);
		const dependencies = configData.dependencies || [];

		if (!dependencies.includes(package)) {
			dependencies.push(package);
			configData.dependencies = dependencies;

			const formattedStr = formatJSON(configData, 4);
			fs.writeFileSync("pawn.json", formattedStr);
		}

		console.log(`SPM: ${package} has been succesfully installed`);
	} catch (error) {
		console.log("Error: SPM encountered an error");
	}
}

module.exports = installPackage;
