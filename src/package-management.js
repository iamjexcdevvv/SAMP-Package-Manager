const userConfig = require("../spm-config.json");
const personalToken = userConfig.github_token || process.env.GITHUB_TOKEN;

// Third-Party modules
const { Octokit } = require("octokit");
const octokit = new Octokit({ auth: personalToken });

const unzipper = require("unzipper");

const { pipeline } = require("stream/promises");

function isValidPackageFormat(package) {
	const regex = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;
	return regex.test(package);
}

async function installPackage(package) {
	const isValid = isValidPackageFormat(package);

	if (!isValid) {
		console.error("Error: Invalid format. Use username/repo");
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

		const { data } = await octokit.rest.repos.get({
			owner: username,
			repo: repo,
		});

		const branch = data.default_branch;

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

		fs.cpSync(extractedFolder, targetFolder, { recursive: true });

		console.log(`SPM: ${package} has been succesfully installed`);
	} catch (error) {
		console.log(error);
	}
}

module.exports = installPackage