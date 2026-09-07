import { randomUUID } from 'node:crypto';
import path from 'node:path';

import multer from 'multer';

import { config } from '../../config/index.js';
import type { RequestContext } from '../context.js';
import { ValidationError } from '../errors/index.js';
import { localStorageAdapter } from './local-adapter.js';
import { s3StorageAdapter } from './s3-adapter.js';
import type { StorageAdapter, StoredFile } from './types.js';

export type { StorageAdapter, StoredFile } from './types.js';
export { localStorageAdapter } from './local-adapter.js';
export { s3StorageAdapter } from './s3-adapter.js';

/**
 * FILE UPLOADS.
 *
 * Everything goes through `fileService`. Modules never touch the filesystem or
 * an SDK directly — swap the adapter in one place and every module follows.
 *
 *   router.post(
 *     '/:id/photo',
 *     requireAuth,
 *     requirePermission('proofs.upload'),
 *     uploadSingle('photo'),
 *     asyncHandler(controller.uploadPhoto),
 *   );
 *
 *   // in the controller
 *   const stored = await fileService.save(req.file, { folder: 'proofs', ctx });
 *   // persist stored.key on your document — never the URL, which expires
 */

function resolveAdapter(): StorageAdapter {
  return config.storage.driver === 's3' ? s3StorageAdapter : localStorageAdapter;
}

/** Files the system is willing to accept. Extend deliberately, not casually. */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]);

/**
 * Multer in memory, so the buffer can be handed straight to the adapter.
 * Memory is correct here because the size limit is small; do not raise the
 * limit far without switching to a streaming upload.
 */
const createUpload = (allowedTypes: Set<string> = ALLOWED_MIME_TYPES) => {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.storage.maxUploadBytes, files: 10 },
    fileFilter: (_req, file, callback) => {
      if (!allowedTypes.has(file.mimetype)) {
        callback(new ValidationError(`Files of type ${file.mimetype} are not accepted`));
        return;
      }
      callback(null, true);
    },
  });
};

const defaultUpload = createUpload();

export const uploadSingle = (field: string, customAllowedTypes?: string[]) => {
  if (customAllowedTypes) {
    return createUpload(new Set(customAllowedTypes)).single(field);
  }
  return defaultUpload.single(field);
};

export const uploadMany = (field: string, max = 10, customAllowedTypes?: string[]) => {
  if (customAllowedTypes) {
    return createUpload(new Set(customAllowedTypes)).array(field, max);
  }
  return defaultUpload.array(field, max);
};

/** `photo.JPG` → `photo.jpg`, stripped of anything that could escape a path. */
function safeExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

export const fileService = {
  get adapterName(): string {
    return resolveAdapter().name;
  },

  /**
   * Stores an uploaded file and returns what to persist on your document.
   *
   * The key is generated, never taken from the client — an attacker-supplied
   * filename is how you get a path traversal or an overwritten file.
   */
  async save(
    file: Express.Multer.File | undefined,
    options: { folder: string; ctx?: RequestContext },
  ): Promise<StoredFile> {
    if (!file) throw new ValidationError('No file was uploaded');

    const adapter = resolveAdapter();
    const datePrefix = new Date().toISOString().slice(0, 10);
    const key = `${options.folder}/${datePrefix}/${randomUUID()}${safeExtension(file.originalname)}`;

    const { size } = await adapter.put({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    return {
      key,
      url: await adapter.url(key),
      size,
      contentType: file.mimetype,
      originalName: file.originalname,
    };
  },

  /** Stores a buffer the server generated itself — a PDF, an export. */
  async saveBuffer(params: {
    buffer: Buffer;
    folder: string;
    filename: string;
    contentType: string;
  }): Promise<StoredFile> {
    const adapter = resolveAdapter();
    const datePrefix = new Date().toISOString().slice(0, 10);
    const key = `${params.folder}/${datePrefix}/${randomUUID()}${safeExtension(params.filename)}`;

    const { size } = await adapter.put({
      key,
      body: params.buffer,
      contentType: params.contentType,
    });

    return {
      key,
      url: await adapter.url(key),
      size,
      contentType: params.contentType,
      originalName: params.filename,
    };
  },

  /**
   * Resolve a stored key to a fetchable URL. Call this at read time — with
   * object storage the URL is signed and expires, so a URL persisted on a
   * document six months ago will be dead.
   */
  url: (key: string) => resolveAdapter().url(key),
  read: (key: string) => resolveAdapter().get(key),
  remove: (key: string) => resolveAdapter().remove(key),
  exists: (key: string) => resolveAdapter().exists(key),
};
