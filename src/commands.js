const { Command } = require("commander");
const program = new Command();

const initSPM = require("./spm-init");
const { installPackage, uninstallPackage } = require("./dependency");

program
	.name("SAMP Package Manager")
	.description("CLI to manage SAMP libraries")
	.version("1.0.0");

program
	.command("install")
	.alias("i")
	.description("Install a specified dependency")
	.argument("<package>", "A dependency to install")
	.action((package) => installPackage(package));

program
	.command("uninstall")
	.alias("un")
	.description("Uninstall a specified dependency")
	.argument("<package>", "A dependency to uninstall")
	.action((package) => uninstallPackage(package));

program
	.command("init")
	.description("Initialize SAMP package manager")
	.option("-y, --yes", "Yes to all")
	.action((options) => initSPM(options));

module.exports = program;
