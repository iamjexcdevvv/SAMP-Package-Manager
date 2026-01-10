// Third-Party modules
const simpleGit = require("simple-git");
const git = simpleGit();

// Core Modules
const os = require("os");
const path = require("path");
const fs = require("fs");

const prompts = require("prompts");

// Custom modules
const { formatJSON } = require("./utils");

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

async function initSPM(options) {
	let isAddDevFiles = true,
		isAddReadme = true,
		isInitializeGit = true;
	let username = USERNAME,
		packageName = PACKAGENAME;

	if (!options.yes) {
		const onCancel = (prompt) => {
			console.log("ERROR: interrupt");
			process.exit(1);
		};

		const response = await prompts(promptQuestions, { onCancel });

		isAddDevFiles = response.devFiles;
		isAddReadme = response.readmeFile;
		isInitializeGit = response.gitinit;
		username = response.username;
		packageName = response.packageName;
	}

	try {
		// Prompt for entry point this is used for compiling the gamemode
		// const entryPoint = await askUser(
		// 	"Choose an entry point - this is the file that is passed to the compiler."
		// );

		if (isAddDevFiles) {
			fs.writeFileSync(".gitignore", "");
			fs.writeFileSync(".gitattributes", "");
		}

		if (isAddReadme) {
			fs.writeFileSync("README.md", "");
		}

		if (isInitializeGit) {
			await git.init();
			console.log("SPM: Initialized git repository");
		}

		const spmConfig = {
			user: username,
			repo: packageName,
		};

		const formattedStr = formatJSON(spmConfig, 4);

		fs.writeFileSync("pawn.json", formattedStr);

		const configPath = path.join(process.cwd(), "pawn.json");
		console.log(`Wrote to ${configPath}\n`);
		console.log(formattedStr);
	} catch (error) {
		console.log(error);
	}
}

module.exports = initSPM;
