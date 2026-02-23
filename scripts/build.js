// scripts/build.js
const esbuild = require('esbuild');

const watchMode = process.argv.includes('--watch');

if (watchMode) {
    esbuild.context({
        entryPoints: ['js/main-entry.js'],
        bundle: true,
        outfile: 'dist/bundle.js',
        sourcemap: true,
        target: ['es2017'],
        format: 'iife',
    }).then(function(ctx) {
        return ctx.watch();
    }).then(function() {
        console.log('Watching for changes...');
    });
} else {
    esbuild.build({
        entryPoints: ['js/main-entry.js'],
        bundle: true,
        outfile: 'dist/bundle.js',
        sourcemap: true,
        target: ['es2017'],
        format: 'iife',
    });
}
