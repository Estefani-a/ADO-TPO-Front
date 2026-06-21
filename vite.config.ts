import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Proyecto independiente: no importa rutas ni código del backend.
// El destino del proxy se define con VITE_PROXY_TARGET (ver .env.example).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
