import { createServer } from 'node:http';
import { createApp } from './http/app.js';
import { port } from './config.js';

const server = createServer(createApp());

server.listen(port, () => {
  console.log(`Event Ticketing server listening on port ${port}`);
});
