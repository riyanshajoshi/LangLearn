import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import aiProxy from './server/ai.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), aiProxy()],
})
