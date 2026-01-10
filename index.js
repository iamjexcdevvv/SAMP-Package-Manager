#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const config = require("./spm-config.json");
const personalToken = config.github_token || process.env.GITHUB_TOKEN;

// Third-Party modules
const { Octokit } = require("octokit");
const octokit = new Octokit({ auth: personalToken });

const unzipper = require("unzipper");

const simpleGit = require("simple-git");
const git = simpleGit();

// Core Modules
const os = require("os");
const path = require("path");
const { pipeline } = require("stream/promises");
const fs = require("fs");

const prompts = require("prompts");

const USERNAME = os.userInfo().username;
const PACKAGENAME = path.parse(process.cwd()).base;

const promptQuestions = [
	{
		type: "text",
		name: "username",
		message:
			"Your Name - If you plan to release, must be your GitHub username.",
		initial: USERNAME,
	},
	{
		type: "text",
		name: "packageName",
		message:
			"Package Name - If you plan to release, must be the GitHub project name.",
		initial: PACKAGENAME,
	},
	{
		type: "confirm",
		name: "devFiles",
		message: "Add a .gitignore and .gitattributes files? (y/n)",
		initial: false,
	},
	{
		type: "confirm",
		name: "readmeFile",
		message: "Add a README.md file? (y/n)",
		initial: false,
	},
	{
		type: "confirm",
		name: "gitinit",
		message: "Initialise a git repository? (y/n)",
		initial: false,
	},
];

function isValidPackageFormat(package) {
	const regex = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;
	return regex.test(package);
}

async function initSPM(options) {
	if (options.yes) {
		// The user skips the prompt
		return;
	}

	try {
		const onCancel = (prompt) => {
			console.log("ERROR: interrupt");
			process.exit(1);
		}

		// Prompt for entry point this is used for compiling the gamemode
		// const entryPoint = await askUser(
		// 	"Choose an entry point - this is the file that is passed to the compiler."
		// );

		const response = await prompts(promptQuestions, {onCancel});

		if (response.devFiles) {
			fs.writeFileSync(".gitignore", "");
			fs.writeFileSync(".gitattributes", "");
		}

		if (response.readmeFile) {
			fs.writeFileSync("README.md", "");
		}

		if (response.gitinit) {
			await git.init();
			console.log("SPM: Initialized git repository");
		}

		const spmConfig = {
			user: response.username,
			repo: response.packageName
		}

		fs.writeFileSync("pawn.json", JSON.stringify(spmConfig, null, 4));
		console.log("SPM: initialized");
	} catch (error) {
		console.log(error);
	}
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

module.exports = {
	initSPM,
	installPackage,
};

const program = require("./commands");
program.parse();
