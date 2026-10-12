import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The default CSS minifier collapses `backdrop-filter` and
    // `-webkit-backdrop-filter` into a single declaration, which kills the
    // frosted header, chip bar and nav pill on one browser family or the
    // other (older iOS Safari needs the prefix, Chrome needs the plain one).
    // Ship the stylesheet unminified so both stay exactly as written (gzip
    // keeps the size cost small).
    cssMinify: false,
  },
})
