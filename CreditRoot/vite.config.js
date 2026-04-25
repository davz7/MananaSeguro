import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function cetesRatePlugin() {
  return {
    name: 'cetes-rate',
    configureServer(server) {
      server.middlewares.use('/api/cetes-rate', async (_req, res) => {
        try {
          const r = await fetch('https://stablebonds.etherfuse.com/bonds')
          const bonds = await r.json()
          const cetes = bonds.find(b =>
            b.name?.toLowerCase().includes('cetes') ||
            b.symbol?.toLowerCase().includes('cetes')
          )
          const raw = cetes?.apy ?? cetes?.interestRate ?? cetes?.rate ?? 5.7
          const rate = raw > 100 ? raw / 100 : parseFloat(raw)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ rate, source: 'etherfuse' }))
        } catch (e) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ rate: 5.7, source: 'fallback', error: e.message }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), cetesRatePlugin()],
  test: { environment: 'jsdom' },
})