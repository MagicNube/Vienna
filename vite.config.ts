import { defineConfig, type Plugin } from 'vite';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
function nativeBridge(): Plugin {
  return {
    name: 'vienna-native-dev',
    configureServer(server) {
      let child: ChildProcessWithoutNullStreams | undefined;
      let serial = 0;
      const pending = new Map<
        number,
        { resolve: (v: unknown) => void; reject: (e: Error) => void }
      >();
      const clients = new Set<import('node:http').ServerResponse>();
      function start() {
        if (child) return;
        const bin = path.resolve(
          `src-tauri/target/debug/vienna-bridge${process.platform === 'win32' ? '.exe' : ''}`,
        );
        if (!existsSync(bin))
          throw Error('Compila el backend con npm run bridge:build o abre npm run desktop.');
        child = spawn(bin, [], { windowsHide: true });
        createInterface({ input: child.stdout }).on('line', (line) => {
          try {
            const msg = JSON.parse(line);
            if (msg.event) {
              for (const c of clients) c.write(`data: ${JSON.stringify(msg.event)}\n\n`);
              return;
            }
            const p = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) p?.reject(Error(msg.error));
            else p?.resolve(msg.result);
          } catch {
            /* Non-protocol logs are ignored. */
          }
        });
        child.stderr.on('data', (data) => process.stderr.write(data));
        child.on('exit', () => {
          child = undefined;
          for (const p of pending.values()) p.reject(Error('El backend se ha cerrado'));
          pending.clear();
        });
      }
      server.middlewares.use('/__native', async (req, res) => {
        // Dev-only loopback endpoint; reject cross-origin writes and remote hosts.
        if (
          !['127.0.0.1:1420', 'localhost:1420'].includes(req.headers.host ?? '') ||
          (req.headers.origin &&
            !['http://127.0.0.1:1420', 'http://localhost:1420'].includes(req.headers.origin))
        ) {
          res.statusCode = 403;
          res.end();
          return;
        }
        if (req.url === '/events' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          res.write(': connected\n\n');
          clients.add(res);
          req.on('close', () => clients.delete(res));
          return;
        }
        if (req.method !== 'POST' || !req.headers['content-type']?.includes('application/json')) {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          let body = '';
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 20_000_000) throw Error('Archivo demasiado grande');
          }
          const request = JSON.parse(body);
          start();
          const id = ++serial;
          const result = await new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            child!.stdin.write(JSON.stringify({ ...request, id }) + '\n');
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ result }));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
      server.httpServer?.on('close', () => {
        child?.kill();
        for (const c of clients) c.end();
      });
    },
  };
}
function personalSounds(): Plugin {
  return {
    name: 'vienna-personal-sounds',
    buildStart() {
      for (const name of ['move-self.mp3', 'capture.mp3', 'move-check.mp3', 'game-end.mp3']) {
        const source = path.resolve('.vienna-private/sounds/chesscom', name);
        if (!existsSync(source))
          throw Error('Faltan los sonidos privados; usa npm run package para la versión pública.');
        this.emitFile({
          type: 'asset',
          fileName: 'sounds/personal/' + name,
          source: readFileSync(source),
        });
      }
    },
  };
}
export default defineConfig(({ mode }) => ({
  plugins: [nativeBridge(), ...(mode === 'personal' ? [personalSounds()] : [])],
    server: {
      port: 1420,
      strictPort: true,
      watch: { ignored: ['**/src-tauri/**', '**/.vienna-private/**', '**/.vienna-dev/**', '**/exports/**'] },
    },
  clearScreen: false,
}));
