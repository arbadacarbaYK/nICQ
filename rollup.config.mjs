import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default [
  {
    input: 'src/background.js',
    output: {
      file: 'dist/background.js',
      format: 'iife',
      name: 'background'
    },
    plugins: [
      resolve({ browser: true }),
      commonjs()
    ]
  },
  {
    input: 'src/popup.js',
    output: {
      file: 'dist/popup.js',
      format: 'iife',
      name: 'popup'
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      copy({
        targets: [
          { src: 'src/popup.html', dest: 'dist' },
          { src: 'icons', dest: 'dist' },
          { src: 'sounds', dest: 'dist' },
          { src: 'manifest.json', dest: 'dist' },
          { src: 'src/popup.css', dest: 'dist' },
          { src: 'src/style.css', dest: 'dist' }
        ]
      })
    ]
  },
  {
    input: 'src/content.js',
    output: {
      file: 'dist/content.js',
      format: 'iife',
      name: 'content'
    },
    plugins: [
      resolve({ browser: true }),
      commonjs()
    ]
  }
];