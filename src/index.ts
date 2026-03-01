#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
    .name("component-forge")
    .description("Architecture-first CLI for scalable React projects")
    .version("0.1.0")

program.parse(process.argv);