import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// Shared protocol package (Prompt 003). Aliased to the source rather than
// installed so the dashboard always compiles against the contracts in this
// repository, with no build step and no duplicate copy to keep in sync.
//
// The server and the agent consume the same files through the npm package name
// `@focus-mode/protocol`; both resolve to this directory.
const protocolDir = path.resolve(rootDir, '..', 'shared', 'protocol')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@protocol': path.resolve(protocolDir, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // Allow serving the protocol package, which lives outside this workspace.
    fs: {
      allow: [rootDir, protocolDir],
    },
  },
})