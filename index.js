#!/usr/bin/env node
require("dotenv").config({ quiet: true });

const program = require("./src/commands");
program.parse();
