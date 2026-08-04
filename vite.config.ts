import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function localApiPlugin() {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/') && url !== '/api') return next();

        if (!server._apiHandler) {
          const mod = await import(['.', 'api', '[[...path]].js'].join('/'));
          server._apiHandler = mod.default;
        }

        const [pathname, search] = url.split('?');
        const query = {};
        if (search) {
          for (const pair of search.split('&')) {
            const [k, v] = pair.split('=');
            query[decodeURIComponent(k)] = decodeURIComponent(v || '');
          }
        }

        const segments = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

        let body = {};
        const method = (req.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
          await new Promise((resolve) => {
            let raw = '';
            req.on('data', (chunk) => (raw += chunk));
            req.on('end', () => {
              try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
              resolve();
            });
            req.on('error', resolve);
          });
        }

        const fakeReq = {
          method,
          url,
          query: { ...query, path: segments },
          headers: req.headers,
          body,
          socket: { remoteAddress: req.socket?.remoteAddress || '127.0.0.1' },
        };

        const fakeRes = {
          statusCode: 200,
          _headers: {},
          setHeader(name, value) { this._headers[name] = value; },
          getHeader(name) { return this._headers[name]; },
          status(code) { this.statusCode = code; return this; },
          json(data) {
            this.setHeader('Content-Type', 'application/json');
            res.writeHead(this.statusCode, this._headers);
            res.end(JSON.stringify(data));
          },
          end(data) {
            res.writeHead(this.statusCode, this._headers);
            res.end(data);
          },
          send(data) {
            res.writeHead(this.statusCode, this._headers);
            res.end(data);
          },
        };

        try {
          await server._apiHandler(fakeReq, fakeRes);
        } catch (err) {
          console.error('[local-api] handler error:', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      });
    },
  };
}

export default defineConfig(async ({ mode }) => {
  const plugins = [react(), tailwindcss(), localApiPlugin()];
  try {
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_', 'SUPABASE_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'SUPABASE_'],
    define: processEnvDefines,
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'motion-vendor': ['framer-motion'],
            'icons-vendor': ['lucide-react'],
          },
        },
      },
    },
  };
})