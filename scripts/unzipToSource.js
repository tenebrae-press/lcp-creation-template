import { readFile, stat } from 'fs/promises';
import path from 'path';

import JSZip from 'jszip';

import {
    decompressArchive,
    lcpFilename,
    buildDirectory,
    sourceDirectory,
    contentVersionInfo,
    bail
} from './common.js';

const defaultPath = async () => {
    const { name, version } = await contentVersionInfo();
    return path.join(buildDirectory, lcpFilename(name, version));
};

const unzip = async (opts) => {
    const {
        sourceFile
    } = opts;
    console.log('Loading LCP into Source Directory...');
    console.log('-> Using Argument: ' + sourceFile);
    const sourceFileAbsolute = path.resolve(sourceFile);

    try {
        const fileStat = await stat(sourceFileAbsolute);
    } catch (err) {
        bail(`Can't stat LCP argument (${sourceFileAbsolute}), aborting!`);
    }
    console.log(`--> Source file resolved to ${sourceFileAbsolute} and read OK, loading...`);
    const root = new JSZip();
    try {
        await root.loadAsync(await readFile(sourceFileAbsolute));
    } catch (err) {
        bail(`Can't read the LCP file provided! ${err.message}`);
    }
    console.log(`-> Decompressing LCP...`);
    try {
        await decompressArchive(root, sourceDirectory);
    } catch (err) {
        bail(err);
    }
    console.log('Done!');
};

(async () => {
    await unzip({ sourceFile: process.argv[2] ?? await defaultPath() });
})();