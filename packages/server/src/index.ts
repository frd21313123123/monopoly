import { createServer } from './server.js';

const PORT = Number(process.env.PORT ?? 8787);
createServer(PORT);
console.log(`Monopoly server: ws://localhost:${PORT}`);
