import { createServer } from 'node:http';
import { createApp } from './http/app.js';
import { port } from './config.js';
import { createDatabase } from './db/connection.js';
import { createSqliteRepository } from './repositories/sqlite.js';

const database = createDatabase();
const server = createServer(createApp({ repository: createSqliteRepository(database) }));

server.listen(port, () => {
  console.log(`Event Ticketing server listening on port ${port}`);
});

process.on('SIGINT', () => {
  database.close();
  server.close(() => process.exit(0));
});
