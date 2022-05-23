import { readFile, stat } from 'fs/promises';
import path from 'path';

import simpleGit from 'simple-git';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import yargs from 'yargs';
import dotenv from 'dotenv';

import { bail, warn } from './common.js';

dotenv.config();

const argv = yargs(process.argv)
    .option('visibility', {
        type: 'string',
        alias: 'vis',
        description: 'Visibility of the object to be uploaded, defaults to public-read. Must be a valid ACL value.'
    })
    .option('bucket', {
        type: 'string',
        alias: 'b',
        description: 'Destination bucket to upload the object to".'
    })
    .option('contentType', {
        type: 'string',
        alias: 'ct',
        description: 'Content type of the object to be uploaded, defaults to application/octet-stream. Must be a valid mimetype.'
    })
    .argv;

const getCurrentGitRevision = async () => {
    return await simpleGit().revparse(['HEAD']);
};

const uploadFileToSpaces = async (filePath, options = {}) => {

    console.log(`Uploading ${path.basename(filePath)} to DO Spaces...`);

    if (process.env.S3_ENDPOINT === undefined) {
        bail("-> Environment Variable S3_ENDPOINT not defined! Aborting!");
    } else if (process.env.S3_REGION === undefined) {
        bail("-> Environment Variable S3_REGION not defined! Aborting!");
    } else if (process.env.S3_KEY === undefined) {
        bail("-> Environment Variable S3_KEY not defined! Aborting!");
    } else if (process.env.S3_SECRET === undefined) {
        bail("-> Environment Variable S3_SECRET not defined! Aborting!");
    } else if (process.env.S3_PATH_PREFIX === undefined) {
        warn("-> Environment Variable S3_PATH_PREFIX not defined! Artifacts uploaded will be placed in the root of the bucket.");
    }

    const absFilePath = path.resolve(filePath);

    try {
        const fileStat = await stat(absFilePath);
    } catch (err) {
        bail(`-> Can't stat file ${filePath}, ${err}`);
    }

    const clientParams = {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        credentials: {
            accessKeyId: process.env.S3_KEY,
            secretAccessKey: process.env.S3_SECRET
        }
    };

    const s3Client = new S3Client(clientParams);
    
    const keyPrefix = `${process.env.S3_PATH_PREFIX && process.env.S3_PATH_PREFIX !== '' ? process.env.S3_PATH_PREFIX + '/' : ''}`;

    const params = {
        Bucket: options.bucket,
        Key: `${keyPrefix}${path.basename(absFilePath)}`,
        Body: await readFile(absFilePath),
        ACL: options.visibility ?? "public-read",
        ContentType: options.contentType ?? "application/octet-stream",
        Metadata: {
            "git-revision-hash": await getCurrentGitRevision()
        }
    };

    console.log(`-> Uploading with params ${JSON.stringify({ ...params, Body: undefined }, null, 2)}`);

    let res;
    try {
        console.log('-> Beginning upload...');
        res = await s3Client.send(new PutObjectCommand(params));
    } catch (err) {
        bail(`Failed to upload file to S3: ${err}`);
    }
    console.log(`-> Upload complete! Available at: ${clientParams.endpoint}/${params.Bucket}/${params.Key}`);
};

(async () => {
    await uploadFileToSpaces(argv._.pop(), {
        bucket: argv.bucket,
        contentType: argv.contentType,
        visibility: argv.visibility
    });
})();
