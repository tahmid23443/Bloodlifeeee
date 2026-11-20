import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createApiApp } from './src/server/app';
import type { BloodRequest } from './src/types';

interface ConnectedClient {
  ws: WebSocket;
  userId: string | null;
}

const clients = new Set<ConnectedClient>();

function broadcastAll(event: string, payload: unknown) {
  const msg = JSON.stringify({ event, payload });
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  }
}

function sendToUser(userId: string, event: string, payload: unknown) {
  const msg = JSON.stringify({ event, payload });
  for (const c of clients) {
    if (c.userId === userId && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(msg);
    }
  }
}

function sendToRequestParticipants(reqObj: BloodRequest, event: string, payload: unknown) {
  const targets = new Set<string>();
  if (reqObj.needer_id) targets.add(reqObj.needer_id);
  if (reqObj.provider_id) targets.add(reqObj.provider_id);
  if (reqObj.rider_id) targets.add(reqObj.rider_id);
  for (const uid of targets) {
    sendToUser(uid, event, payload);
  }
}

function getOnlineUserIds(): Set<string> {
  return new Set(
    Array.from(clients)
      .map((c) => c.userId)
      .filter((id): id is string => Boolean(id))
  );
}

function broadcastPresence() {
  broadcastAll('presence:update', { onlineUserIds: Array.from(getOnlineUserIds()) });
}

const app = createApiApp({
  broadcastAll,
  sendToUser,
  sendToRequestParticipants,
  getOnlineUserIds,
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = Number(process.env.PORT) || 3000;

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/ws', `http://localhost:${PORT}`);
  const initialUserId = url.searchParams.get('userId');
  const client: ConnectedClient = { ws, userId: initialUserId };
  clients.add(client);

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'auth' && typeof data.userId === 'string') {
        client.userId = data.userId;
        broadcastPresence();
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    clients.delete(client);
    broadcastPresence();
  });

  broadcastPresence();
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Blood Life server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
