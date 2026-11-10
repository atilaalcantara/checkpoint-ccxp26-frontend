import { defineConfig } from 'astro/config';
import { readdir, rm } from 'node:fs/promises';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  // Never inline scripts: lets the production CSP use script-src 'self' without per-build hashes.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [{
    name: 'exclude-unreleased-character-art',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const characters = new URL('assets/characters/', dir);
        const names = await readdir(characters).catch(() => []);
        const demo = new URL('assets/demo/', dir);
        await Promise.all([
          ...names.filter(name => /^Nivel[2-9]/i.test(name)).map(name => rm(new URL(name, characters))),
          rm(demo, { recursive: true, force: true }),
        ]);
      },
      'astro:config:setup': ({ updateConfig }) => updateConfig({ vite: { plugins: [{
        name: 'block-unreleased-character-art',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (/^\/assets\/characters\/Nivel[2-9]/i.test(decodeURIComponent(req.url ?? ''))) { res.statusCode = 404; res.end(); return; }
            next();
          });
        },
      }] } }),
    },
  }, {
    name: 'motion-playground-dev-only',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command === 'dev') injectRoute({ pattern: '/dev/motion', entrypoint: './src/components/MotionPlayground.astro' });
      },
    },
  }],
});
