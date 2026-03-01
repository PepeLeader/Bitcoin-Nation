import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            include: ['buffer', 'crypto', 'stream', 'util', 'process', 'events'],
            globals: {
                Buffer: true,
                global: true,
                process: true,
            },
        }),
    ],
    resolve: {
        alias: {
            crypto: 'crypto-browserify',
        },
    },
    define: {
        global: 'globalThis',
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-opnet': ['opnet', '@btc-vision/bitcoin', '@btc-vision/transaction'],
                    'vendor-walletconnect': ['@btc-vision/walletconnect'],
                },
            },
        },
    },
});
