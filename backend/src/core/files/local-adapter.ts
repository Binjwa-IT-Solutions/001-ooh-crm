import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from '../../config/index.js';
import { NotFoundError } from '../errors/index.js';
import type { StorageAdapter } from './types.js';

/**
 * DEVELOPMENT ONLY. Writes to a folder on disk so nobody needs cloud storage
 * credentials to work on a feature that uploads a file.
 *
 * Never use this in production: the VPS disk fills up, and disk-based backups
 * of proof photos become unmanageable. Production uses the S3 adapter.
 */

const ROOT = path.resolve(process.cwd(), config.storage.localDir);

function resolveSafe(key: string): string {
  // Reject traversal — a key must stay inside the storage root.
  const cleanKey = key.replace(/^[/\\]+/, '');
  const target = path.resolve(ROOT, cleanKey);
  if (!target.startsWith(ROOT + path.sep) && target !== ROOT) {
    throw new Error(`Refusing to access a path outside the storage root: ${key}`);
  }
  return target;
}

export const localStorageAdapter: StorageAdapter = {
  name: 'local',

  async put({ key, body }) {
    const target = resolveSafe(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    return { key, size: body.byteLength };
  },

  async get(key) {
    try {
      return await fs.readFile(resolveSafe(key));
    } catch {
      throw new NotFoundError('File not found');
    }
  },

  async url(key) {
    // Served by the route in files-routes.ts. Object storage returns a signed
    // URL here instead, which is why callers must always await this.
    const token = createHash('sha256').update(key).digest('hex').slice(0, 8);
    return `${config.storage.publicBaseUrl}/api/files/${encodeURIComponent(key)}?v=${token}`;
  },

  async remove(key) {
    await fs.rm(resolveSafe(key), { force: true });
  },

  async exists(key) {
    try {
      await fs.access(resolveSafe(key));
      return true;
    } catch {
      return false;
    }
  },
};
