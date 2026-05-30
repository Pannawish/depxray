import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '../vscode-extension/webview-ui/node_modules/@vitejs/plugin-react/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sharedNodeModules = path.resolve(
  here,
  '../vscode-extension/webview-ui/node_modules',
);

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      react: path.join(sharedNodeModules, 'react'),
      'react/jsx-runtime': path.join(sharedNodeModules, 'react/jsx-runtime.js'),
      'react-dom': path.join(sharedNodeModules, 'react-dom'),
      'react-dom/client': path.join(
        sharedNodeModules,
        'react-dom/client.js',
      ),
      reactflow: path.join(sharedNodeModules, 'reactflow'),
      dagre: path.join(sharedNodeModules, 'dagre'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
