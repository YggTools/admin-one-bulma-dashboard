import * as esb from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';

import * as fsp from 'fs/promises';
import path from 'path';

const WITH_SOURCEMAPS = false;

const ROOT = path.resolve('.');

const DSTDIR = 'demo';

const FILE_EXTS = ['html'];

const loader = Object.fromEntries(FILE_EXTS.map(ext => ['.'+ext, 'file']));
const plugins = [sassPlugin({
    loadPaths: ['.'],
})];

// clear directory before build
await fsp.rm(DSTDIR, { recursive: true, force: true });

async function* _walkDir(dir)
{
    for await(const d of await fsp.opendir(dir))
    {
        const entry = `${dir}/${d.name}`;
        if(d.isDirectory()) yield* await walk(entry);
        else if(d.isFile()) yield entry;
    }
}

async function build(output, entryPoints, opts={})
{
    if(typeof(entryPoints) === 'string')
        entryPoints = [entryPoints];
    let outputKey;
    if(output.startsWith(':'))
    {
        outputKey = 'outfile'
        output = output.slice(1);
    }
    else
        outputKey = 'outdir';
    return await esb.build({
        entryPoints,
        bundle: true,
        [outputKey]: `${DSTDIR}/${output}`,
        format: 'esm',
        ...opts,
        loader: {...loader, ...(opts.loader || {})},
        plugins: [...plugins, ...(opts.plugins || [])],
    });
}

async function copy(outDir, inDir, filter=null)
{
    if(inDir.endsWith('/'))
        inDir = inDir.slice(0, -1);
    if(!outDir.endsWith('/'))
        outDir += '/';

    const tasks = [];
    for await(const inPath of _walkDir(inDir))
    {
        if(!inPath.startsWith(inDir + '/'))
            throw new Error(`Invalid input directory path '${inDir}'`);
        const outPath = inPath.slice(inDir.length + 1);
        tasks.push((async () => {
            await fsp.mkdir(`${DSTDIR}/${outDir}${outPath.split('/').slice(0, -1).join('/')}`, { recursive: true });
            await fsp.copyFile(inPath, `${DSTDIR}/${outDir}${outPath}`);
        })());
    }
    await Promise.all(tasks);
}

/* JS */

build(':js/main.js', 'src/js/main.js');
build(':js/main.min.js', 'src/js/main.js', { minify: true, sourcemap: WITH_SOURCEMAPS });
build(':js/chart.sample.js', 'src/js/chart.sample.js');
build(':js/chart.sample.min.js', 'src/js/chart.sample.js', { minify: true, sourcemap: WITH_SOURCEMAPS });

/* SCSS */

build(':css/main.css', 'src/scss/main.scss');
build(':css/main.min.css', 'src/scss/main.scss', { minify: true, sourcemap: WITH_SOURCEMAPS });

/* HTML */

copy('', 'src/html');

/* Img */

copy('img', 'src/img');
