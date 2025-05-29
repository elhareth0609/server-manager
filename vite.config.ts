// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    strictPort: true,
    host: 'localhost',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  base: './',
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['electron', 'fs', 'path', 'url', 'mkdirp', 'axios', 'extract-zip', 'tar'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});




// // vite.electron.config.ts
// import { defineConfig } from 'vite';
// import { resolve } from 'path';

// export default defineConfig({
//     server: {
//     port: 3001,
//     strictPort: true,
//     host: 'localhost', // Explicitly use localhost instead of ::1
//   },
//   build: {
//     lib: {
//       entry: {
//         main: resolve(__dirname, 'electron/main.ts'),
//         preload: resolve(__dirname, 'electron/preload.ts')
//       },
//       formats: ['cjs'],
//       fileName: (format, entryName) => `${entryName}.js`
//     },
//     outDir: 'dist-electron',
//     emptyOutDir: true,
//     rollupOptions: {
//       external: ['electron', 'fs', 'path', 'url']
//     }
//   }
// });














// // vite.config.ts
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import { resolve } from 'path';

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     port: 3001,
//     strictPort: true,
//   },
//   build: {
//     outDir: 'dist',
//     emptyOutDir: true,
//     // Optimize for development builds
//     minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
//     sourcemap: process.env.NODE_ENV !== 'production',
//     // Reduce chunk size warnings
//     chunkSizeWarningLimit: 1000,
//     rollupOptions: {
//       output: {
//         manualChunks: {
//           vendor: ['react', 'react-dom'],
//           lucide: ['lucide-react'],
//         },
//       },
//     },
//   },
//   base: './',
//   define: {
//     global: 'globalThis',
//   },
//   optimizeDeps: {
//     exclude: ['electron', 'fs', 'path', 'url', 'mkdirp', 'axios', 'extract-zip', 'tar'],
//     include: ['react', 'react-dom', 'lucide-react'],
//   },
//   resolve: {
//     alias: {
//       '@': resolve(__dirname, 'src'),
//     },
//   },
//   // Performance optimizations
//   esbuild: {
//     target: 'es2020',
//   },
// });












// // vite.config.ts
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import { resolve } from 'path'; // Keep this if you use it elsewhere

// export default defineConfig({
//   plugins: [
//     react()
//   ],
//   server: {
//     port: 3001,
//     strictPort: true,
//   },
//   build: {
//     outDir: 'dist', // This is for your renderer code
//     emptyOutDir: true,
//   },
//   base: './',
//   define: {
//     global: 'globalThis',
//   },
//   optimizeDeps: {
//     exclude: ['electron', 'fs', 'path', 'url', 'mkdirp', 'axios', 'extract-zip', 'tar'],
//   },
//   resolve: {
//     alias: {
//       '@': resolve(__dirname, 'src'),
//     },
//   },
// });
