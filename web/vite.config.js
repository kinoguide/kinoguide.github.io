import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' makes the build work on GitHub Pages subpaths and Vercel alike
// the dev port follows $PORT when one is set, so a second dev server (another
// session, another branch) doesn't collide on 5173
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: Number(process.env.PORT) || 5173 },
})
