// Mock simples do payment-service usado APENAS para testar manualmente o
// HttpPaymentClient (Pessoa 2). NÃO faz parte do runtime — o payment-service
// real fica em /services/payment-service.
//
// Uso:
//   npm run mock:payment -- approved   # 200 {"status":"approved"}
//   npm run mock:payment -- declined   # 200 {"status":"declined"}
//   npm run mock:payment -- error      # 500 sempre (forca retry+fallback)
//   npm run mock:payment -- timeout    # nao responde (forca timeout 2s)

import { createServer, IncomingMessage, ServerResponse } from 'http';

type Mode = 'approved' | 'declined' | 'error' | 'timeout';

const mode = (process.argv[2] ?? 'approved') as Mode;
const port = 8081;

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end();
        return;
    }
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c as Buffer));
    req.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        // eslint-disable-next-line no-console
        console.log(`[mock] POST ${req.url}  body=${body}`);
        if (mode === 'timeout') return; // never responds
        if (mode === 'error') {
            res.writeHead(500);
            res.end();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: mode }));
    });
});

server.listen(port, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(`[mock] payment-service em http://localhost:${port}  mode=${mode}`);
});
