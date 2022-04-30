# Lancer Content Pack Creation Template

[![Build](https://github.com/tenebrae-press/lcp-creation-template/actions/workflows/build-action.yml/badge.svg?branch=master)](https://github.com/tenebrae-press/lcp-creation-template/actions/workflows/build-action.yml) [![Test Runner](https://github.com/tenebrae-press/lcp-creation-template/actions/workflows/test-runner.yml/badge.svg?branch=master)](https://github.com/tenebrae-press/lcp-creation-template/actions/workflows/test-runner.yml)

## Setup

1. Clone the repo recursively to include the dependencies: `git clone --recursive git://github.com/tenebrae-press/lcp-creation-template.git`
2. Using a NodeJS versioning tool (we recommend [nvm](https://github.com/nvm-sh/nvm)) switch to NodeJS v16.x
3. Run `npm install`
4. Run `npm run build` to verify your setup.
5. (Optional) Create a `.env` file with environment variables for uploading content to S3 (defined in the usage guide below)

## Usage Guide

### Creating a build of your LCP

Run `npm run build` to generate the LCP from source. The resulting file can be loaded into COMP/CON or a LCP editor.

### Editing your LCP

1. Run `npm run build` to generate the LCP from source files.
2. Load the resulting file into an editor [like our version of the web LCP editor](https://editor.tenebrae.press).
3. Once you make your changes, save the resulting file back into the `build/` directory, preferably overwriting the existing build.
4. Run `npm run unwrap` and the script will overwrite your existing `.json` files in the repository with your changes.
5. Optionally you can run `npm run test` to check the source JSON files against schemas from `massif-press/vscode-comp-con-content-authoring`.

### Running tests

Run `npm run test` to test your source files against schemas. You can add additional custom tests in `scripts/verify.js`

### Publishing assets and releases to S3 Storage

You can create a `.env` file with the following environment variables in the format `KEY=VALUE` separated by newlines:

1. `S3_ENDPOINT` - The base URL of your S3 service provider (ex: `https://nyc3.digitaloceanspaces.com`)
2. `S3_REGION` - The region of your S3 service provider (ex: `us-east-1`)
3. `S3_KEY` - The API Key provided by your S3 service provider.
4. `S3_SECRET` - The API secret provided by your S3 service provider.
5. (Optional) `S3_PATH_PREFIX` - The path to upload files to within S3. The directory will not be created automatically, so make sure it exists before uploading.

These environment variables will be automatically imported by the asset upload script.

To upload a file, simply run the following command: `npm run upload-assets -- --ct <file mimetype> --b <S3 Bucket Name> path/to/file.svg`
Replace the argument to the `ct` flag with the mimetype of the file you're uploading, it will default to application/octet-stream otherwise.
Replace the argument to the `b` flag with the name of the bucket where you want to upload.

This script will append a custom header to the uploaded file that contains the current git revision at the time of uploading. This can be used to verify that you've uploaded the latest version of the file. Future iterations of this script will automate this process by comparing those headers.

### CI/CD

This repository defines three Github Actions that can be used to build, test, and create auto-incrementing versions of your LCP when you merge changes to master.

* The Build action will build a version of your LCP from source. This makes it easy to distribute preview builds among your team or playtesters.
* The Test Runner action will automatically verify your source files against the JSON schemas, warning you about formatting or syntax errors in the source files. It currently does NOT verify the textual content inside the JSON fields, like descriptions or names, or whether or not IDs or game logic is valid.
* The Publish action will create a release version of your LCP, upload it to the configured S3 bucket and path. See the [Publishing assets and releases to S3 Storage] section for more information on the available configuration options. The environment variables defined in that section will need to be set in your repository secrets.

### Template Inlining

Inserting tables and other raw HTML content is difficult with the web editors available. We wrote a script to quickly replace strings with the contents of files in the `templates/` directory as defined by the `template-map.json`. You can configure this by doing the following:

* Inside your LCP, create an string to replace using the templating system. We recommend a short string wrapped in curly braces (ex: `{your-custom-html}`);
* Create an object inside the `template-map.json` file that looks like the following:

```json
    {
      "source": "content-to-inline.html",
      "destination": "frames.json",
      "operation": {
          "type": "replace",
          "target": "{your-custom-html}",
          "path": "/2/traits/2/description"
      }
    }
```

* The `source` defines the content to be inserted into the LCP source.
* The `destination` defines the LCP file to search within.
* The `operation` defines the action to perform with the following properties:
  * The `type` defines the type of operation to perform. Currently this only supports "replace".
  * The `target` defines the string to search for within the property defined by `path`.
  * The `path` defines the JSON path to replace text within. The syntax for this value follows the same style of object access syntax as javascript, except with `/` instead of `.` or `[]`.

The example operation above will replace the string `{your-custom-html}` in `frames.json` for the 2nd frame, on its 2nd trait in the description with the contents of the `content-to-inline.html` file.

You can apply the template operations to your source files by running `npm run build -- --run-templates`
