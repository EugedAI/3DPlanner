/**
 * Node.js server example for Screenplay Parser.
 *
 * Usage:
 *   node node-server.js
 *
 * Then POST text to http://localhost:3000/parse
 */

import { createServer } from 'http';
import { ScreenplayParser, InMemoryAdapter } from '../dist/screenplay-parser.esm.js';

const parser = new ScreenplayParser({
  storage: new InMemoryAdapter(),
  enableLearning: true,
  enableClaudeMode: false,
  logLevel: 'info',
});

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && req.url === '/parse') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);
        const result = await parser.parseText(text);
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/metrics') {
    const metrics = await parser.getMetrics();
    res.writeHead(200);
    res.end(JSON.stringify(metrics, null, 2));
  } else {
    res.writeHead(200);
    res.end(JSON.stringify({
      endpoints: {
        'POST /parse': 'Parse screenplay text. Body: { "text": "..." }',
        'GET /metrics': 'Get parser metrics',
      },
    }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.info(`Screenplay Parser server running on http://localhost:${PORT}`);
});
