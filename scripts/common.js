import fs from 'fs';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

import jsonFormat from 'json-format';
import { minify } from 'html-minifier';

export const buildDirectory = path.join(process.cwd(), 'build');
export const sourceDirectory = path.join(process.cwd(), 'src');
export const packageJsonPath = path.join(process.cwd(), 'package.json');
export const schemaPath = path.join(process.cwd(), 'deps', 'vscode-comp-con-content-authoring', 'schemas');
export const lcpManifestFilename = 'lcp_manifest.json';
export const templatePath = path.join(process.cwd(), 'templates');
export const templateMappingFilename = path.join(templatePath, 'template-map.json');

export const bail = err => {
    console.error(err);
    process.exit(1);
};

export const warn = (err, failIfCI = true) => {
    console.warn(err);
    if (failIfCI && process.env.CI === 'true') {
        process.exit(1);
    }
}

export const lcpFilename = (name, version) => `${name}_${version}.lcp`;

export const contentVersionInfo = async () => {
    const { name, version } = JSON.parse(await readFile(packageJsonPath, { encoding: 'utf8' }));
    if (process.env.CI === 'true' && process.env.GITHUB_RUN_NUMBER) {
        const [major, minor] = version.split('.');
        const bumpedVersion = `${major}.${minor}.${process.env.GITHUB_RUN_NUMBER}`;
        return { name, version: bumpedVersion };
    } else {
        return { name, version };
    }
};

export const outputZipFile = async (zip, name, version) => {
    return new Promise((resolve, reject) => {
        zip.generateNodeStream({ streamFiles: true })
        .pipe(fs.createWriteStream(path.join(buildDirectory, lcpFilename(name, version))))
        .on('finish', resolve)
        .on('error', reject);
    });
};

export const resolvePropertyPath = (data, path) => {
    let ptr = data;
    const properties = path.substr(1).split('/');
    while (properties.length > 0) {
        const property = properties.shift();
        ptr = ptr[!Number.isNaN(Number(property)) ? Number(property) : property];
        if (ptr === undefined) {
            throw new Error(`Failed to resolve property path ${path} at segment ${property} at index ${properties.length + 1}`)
        }
    }
    return ptr;
};

export const setValueAtPropertyPath = (data, path, value) => {
    const recurse = (obj, path, value) => {
        if (path.length > 1) {
            const property = path.shift();
            if(obj[property] === undefined) {
                throw new Error(`Failed to resolve property path ${path} at segment ${property} at index ${properties.length + 1}`)
            }
            recurse(obj[property], path, value);
        } else {
            obj[path[0]] = value;
        }
    }
    recurse(data, path.substr(1).split('/'), value);
    return data;
}

export const decompressArchive = async (zip, directory) => {
    const files = zip.filter((relpath, file) => relpath.endsWith('.json') && !file.dir);
    console.log(files.map(file => file.name));
    for (const file of files) {
       const raw = await zip.file(file.name).async('string');
       await writeFile(
           path.join(directory, file.name),
           `${jsonFormat(JSON.parse(raw), { type: 'space', size: 2 })}\n`, 
           { encoding: 'utf8'});
    }
};

export const loadAndInlineHTML = async (sourcePath) => {
    const content = await readFile(sourcePath, { encoding: 'utf8' });
    return minify(content, { collapseWhitespace: true });
}

export const buildTemplatesForFile = async (filename, content, tableDescriptors) => {
    for (const tableDescriptor of tableDescriptors) {
        const { source, destination, operation } = tableDescriptor;
        if (destination !== filename) {
            throw new Error(`Filename/Destination mismatch between descriptor and file: ${filename} and ${destination}`);
        }
        const sourceContent = await loadAndInlineHTML(path.join(templatePath, source));
        let contentObject = JSON.parse(content);
        switch (operation.type) {
            case "replace": {
                const original = resolvePropertyPath(contentObject, operation.path);
                const modified = original.replace(operation.target, sourceContent);
                if (original === modified) {
                    warn(`Replaced ${operation.target} at ${operation.path}, but no changes were made`);
                }
                contentObject = setValueAtPropertyPath(
                    contentObject,
                    operation.path,
                    modified
                );
                break;
            };
        }
        content = JSON.stringify(contentObject);
    }
    return content;
};