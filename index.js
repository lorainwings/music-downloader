#!/usr/bin/env node

const program = require('commander');

program
    .version('1.0.0')
    .description('A project was used for downloading your favorite music')
    .option('-d, --dir-name <dirName>', 'set a directory to download music', './music/')
    .parse(process.argv);


if (program.dirName) console.log('  - dirName', program.dirName);