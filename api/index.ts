import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../src/server/app';

const apiApp = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const vercelReq = req as IncomingMessage & { body?: unknown; _body?: boolean };
  if (vercelReq.body !== undefined) {
    vercelReq._body = true;
  }

  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const forwardedPath = parsedUrl.searchParams.get('__path');

  if (forwardedPath !== null) {
    parsedUrl.searchParams.delete('__path');
    const qs = parsedUrl.searchParams.toString();
    const cleanPath = forwardedPath.startsWith('/') ? forwardedPath : `/${forwardedPath}`;
    req.url = `/api${cleanPath}${qs ? `?${qs}` : ''}`;
  } else if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return apiApp(req as Parameters<typeof apiApp>[0], res as Parameters<typeof apiApp>[1]);
}
