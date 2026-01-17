/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

const fs = require('fs');
const { join, basename, dirname } = require('path');

const TS_DIR = join(__dirname, '..', 'src');
const OUT_DIR = join(TS_DIR, 'types');

const files = ['Controls.ts', 'Helpers.ts', ];
for (let file of files) {
    let filepath = join(OUT_DIR, file);
    if (fs.existsSync(filepath)) {
        console.log(`Deleting temporary file ${filepath}`);
        fs.unlinkSync(filepath);
    }
}

console.log('Done');