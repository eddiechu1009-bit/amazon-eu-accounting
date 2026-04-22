import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const deployTarget = process.env.DEPLOY_TARGET || 'github'

export default defineConfig({
  plugins: [react()],
  base: deployTarget === 'netlify' ? '/' : '/amazon-eu-accounting/',
})
