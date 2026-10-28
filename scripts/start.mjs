import path from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2);
const argument = (long, short) => {
  const index = args.findIndex((value) => value === long || value === short);
  return index >= 0 ? args[index + 1] : undefined;
};
process.env.HOSTNAME = argument('--hostname', '-H') ?? '0.0.0.0';
process.env.PORT = argument('--port', '-p') ?? process.env.PORT ?? '3000';
if (
  !/^\d+$/.test(process.env.PORT) ||
  Number(process.env.PORT) > 65535 ||
  Number(process.env.PORT) < 1
)
  throw new Error('Invalid port');
await import(pathToFileURL(path.resolve('.next/standalone/server.js')).href);
