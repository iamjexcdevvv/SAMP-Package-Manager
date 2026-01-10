// Third-Party modules
const simpleGit = require("simple-git");
const git = simpleGit();

// Core Modules
const os = require("os");
const path = require("path");
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

async function initSPM(options) {
	if (options.yes) {
		// The user skips the prompt
		return;
	}

	try {
		const onCancel = (prompt) => {
			console.log("ERROR: interrupt");
			process.exit(1);
		};

		// Prompt for entry point this is used for compiling the gamemode
		// const entryPoint = await askUser(
		// 	"Choose an entry point - this is the file that is passed to the compiler."
		// );

		const response = await prompts(promptQuestions, { onCancel });

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
			repo: response.packageName,
		};

        const formattedStr = JSON.stringify(spmConfig, null, 4);

		fs.writeFileSync("pawn.json", formattedStr);

		const configPath = path.join(process.cwd(), "pawn.json");
		console.log(`Wrote to ${configPath}\n`);
        console.log(formattedStr);
	} catch (error) {
		console.log(error);
	}
}

module.exports = initSPM;
