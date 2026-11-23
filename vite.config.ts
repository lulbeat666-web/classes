import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pagesOrigin = 'http://127.0.0.1:8788'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: pagesOrigin,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (upstream, request) => {
            const { host, origin } = request.headers
            const localHost = /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host ?? '')

            // Preserve the same-origin check after a request crosses between local ports.
            if (localHost && origin === `http://${host}`) {
              upstream.setHeader('Origin', pagesOrigin)
            }
          })
        },
      },
    },
  },
})
