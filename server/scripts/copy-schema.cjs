const { copyFileSync, mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const source = resolve(__dirname, '../src/db/schema.sql');
const destination = resolve(__dirname, '../dist/src/db/schema.sql');

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
