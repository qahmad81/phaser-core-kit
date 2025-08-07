import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
  // ESM build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/core-kit.esm.js',
      format: 'esm',
    },
    external: ['phaser', 'js-yaml'],
    plugins: [resolve(), commonjs()],
  },
  // UMD build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/core-kit.umd.js',
      format: 'umd',
      name: 'PCore',
      globals: {
        phaser: 'Phaser',
        'js-yaml': 'jsyaml',
      },
    },
    external: ['phaser', 'js-yaml'],
    plugins: [resolve(), commonjs()],
  },
];