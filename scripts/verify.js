import { readdir, readFile } from 'fs/promises';
import path from 'path';

import {
    sourceDirectory,
    schemaPath,
    lcpManifestFilename,
    bail
} from './common.js';
import Ajv from 'ajv';

// List of any files that we don't have schemas for.
const skipList = [lcpManifestFilename, 'tables.json'];

const verify = async () => {
    console.log('Verifying content against schemas definitions...');
    console.log('-> Loading Schema definitions...');
    const validators = {};
    try {
        console.log('--> Verifying schemas exist & are readable...');
        const files = (await readdir(schemaPath)).filter(file => path.extname(file) === '.json');
        for (const file of files) {
            console.log(`---> Loading schema definition: ${file}`);
            const ajv = new Ajv({ allowUnionTypes: true, allErrors: true });
            validators[file.replace('.schema', '')] = ajv.compile(JSON.parse(await readFile(path.join(schemaPath, file))));
        }
    }  catch (err) {
        bail('Failed to find schema definitions! Did you forget to run \'git submodule init\'?', err);
    }

    console.log('-> Verifying content against schemas...');
    const sourceFiles = [];
    try {
        sourceFiles.push(...(await readdir(sourceDirectory)).filter(file => path.extname(file) === '.json'));
    } catch (err) {
        bail('Failed while loading source file definitions!', err);
    }
    let fail = false;
    let errors = [];
    for(const file of sourceFiles) {
        if (skipList.includes(file)) {
            console.log(`--> ${file} marked as ignore, skipping...`);
            continue;
        } else {
            console.log(`--> validating ${file}...`);
            const content = JSON.parse(await readFile(path.join(sourceDirectory, file), { encoding: 'utf8' }));
            const validate = validators[file];
            if (validate === undefined) {
                bail(`No schema definition for ${file}! Aborting...`);
            }
            const ok = validate(content);
            if (!ok) {
                fail |= true;
                errors.push({ file, fileErrors: validate.errors });
                continue;
            }
        }
        console.log(`--> ${file} is valid!`);
    }
    if (fail) {
        for (const { file, fileErrors } of errors) {
            console.error(`${file} failed with ${fileErrors.length} errors:`, JSON.stringify(fileErrors, null, 2));
        }
        bail(`Failed validation checks!`);
    }
    console.log(`Done!`);
};

(async () => {
    await verify();
})();