/* 'This file is part of MediaMonkey licensed for use under the Ventis Media End User License Agreement, and for the creation of derivative works under the less restrictive Ventis Limited Reciprocal License. See: https://www.mediamonkey.com/sw/mmw/5/Ventis_limited_reciprocal_license.txt' */

const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');
const dir = require('node-dir');

const sourceDirectory = path.join(__dirname, '../src'); // Replace with your source directory path
const outputDirectory = path.join(__dirname, '../../builtTS'); // Replace with your output directory path

dir.files(sourceDirectory, function(err, files) {
	// Filter for files that end with .ts
	const tsFiles = files.filter((file) => file.endsWith('.ts'));
	// Build the list of files
	build({
		entryPoints: tsFiles,
		outdir: outputDirectory,
		bundle: false,
		platform: 'browser',
		target: 'es2020',
	})
	.catch(() => process.exit(1));
});

// fs.readdirSync(sourceDirectory).forEach((file) => {
//   if (file.endsWith('.ts')) {
//     const inputFilePath = path.join(sourceDirectory, file);
//     const outputFilePath = path.join(outputDirectory, file.replace(/\.ts$/, '.js'));

//     build({
//       entryPoints: [inputFilePath],
//       outfile: outputFilePath,
//       bundle: true,
//       platform: 'node',
//       target: 'node14',
//     }).catch(() => process.exit(1));
//   }
// });
