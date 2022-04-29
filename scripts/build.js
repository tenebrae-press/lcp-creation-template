import { readdir, readFile } from 'fs/promises';
import { promisify } from 'util';
import path from 'path';

import JSZip from 'jszip';
import mkdirp from 'mkdirp';
import _rimraf from 'rimraf';
import yargs from 'yargs';

const rimraf = promisify(_rimraf);

import {
    outputZipFile,
    lcpFilename,
    buildDirectory,
    sourceDirectory,
    contentVersionInfo,
    templateMappingFilename,
    buildTemplatesForFile,
    bail
} from './common.js';

const argv = yargs(process.argv)
    .option('run-templates', {
        type: 'boolean',
        alias: 'tmpl',
        description: 'Run templating step for operations defined in templates/template-map.json'
    })
    .argv;

const build = async opts => {
    console.log('Building LCP...');

    console.log('-> Gathering version data prior to build...');

    const { name, version } = await contentVersionInfo();

    console.log(`--> Got Version data for LCP, output file is: ${lcpFilename(name, version)}`);

    console.log('-> Clearing Existing Build Directory');
    await rimraf(buildDirectory);
    await mkdirp(buildDirectory);

    console.log('-> Generating LCP File...');

    let templates;
    if (opts.buildWithTemplates) {
        console.log('-> Loading list of files to template...');
        templates = JSON.parse(await readFile(templateMappingFilename, { encoding: 'utf8' }));
        console.log(`--> Got ${templates.length} templates to insert`);
    }

    const root = new JSZip();
    
    try {
        const files = await readdir(sourceDirectory, { encoding: 'utf8' });
        if (files.length === 0) {
            bail('No source files found in directory: ' + sourceDirectory);
        } else if (!files.includes('lcp_manifest.json')) {
            bail('Missing required file: lcp_manifest.json');
        }
        console.log(`--> Loading files from ${sourceDirectory}`)
        for (const file of files) {
            console.log(`---> ${file}`);
            const raw = await readFile(path.join(sourceDirectory, file));
            if (opts.buildWithTemplates) {
                const templatesToInsert = templates.filter(template => template.destination === file);
                if(templatesToInsert.length > 0) {
                    const parsed = await buildTemplatesForFile(file, raw, templatesToInsert);
                    root.file(file, parsed);
                } else {
                    root.file(file, raw);
                }
            } else if (process.env.CI === 'true' && file.includes('lcp_manifest.json')) {
                const parsed = JSON.parse(raw);
                parsed.version = version;
                root.file(file, JSON.stringify(parsed));
            } else {
                root.file(file, raw);
            }
        }
    } catch (err) {
        bail(err.message);
    }

    console.log('--> ZIP File Generated! Writing to Disk...');

    try {
        await outputZipFile(root, name, version);
    } catch (err) {
        bail(err.message);
    }

    console.log('-> Done!');
    process.exit(0);
};

(async () => {
    await build({ buildWithTemplates: argv.runTemplates ?? false });
})();
