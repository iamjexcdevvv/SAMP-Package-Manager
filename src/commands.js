const { Command } = require("commander");
const program = new Command();

const initSPM = require("./spm-init");
const installPackage = require("./package-management");

program
	.name("SAMP Package Manager")
	.description("CLI to manage SAMP libraries")
	.version("1.0.0");

program
	.command("install")
	.alias("i")
	.description("Install a specified SAMP library")
	.argument("<package>", "A SAMP package to install")
	.action((package) => installPackage(package));

program
	.command("init")
	.description("Initialize SAMP package manager")
	.option("-y, --yes", "Yes to all")
	.action((options) => initSPM(options));

module.exports = program;
