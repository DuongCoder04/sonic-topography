import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { streamNeteaseAudioResponse } from '../../server/netease-audio-proxy.mjs';

type TestHeaders = {
  get: (name: string) => string | null;
};

type TestRequest = EventEmitter & {
  destroyed: boolean;
};

type TestResponse = EventEmitter & {
  destroyed: boolean;
  statusCode: number;
  headers: Map<string, string>;
  chunks: Buffer[];
  ended: boolean;
  setHeader: (name: string, value: string) => void;
  getHeader: (name: string) => string | undefined;
  write: (chunk: Uint8Array | Buffer, callback?: (error?: Error) => void) => boolean;
  end: () => void;
};

type TestReaderOptions = {
  throwOnRead?: boolean;
};

function createHeaders(values: Record<string, string> = {}): TestHeaders {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    get(name) {
      return normalized.get(String(name).toLowerCase()) || null;
    },
  };
}

function createRequest(): TestRequest {
  const req = new EventEmitter() as TestRequest;
  req.destroyed = false;
  return req;
}

function createResponse(): TestResponse {
  const res = new EventEmitter() as TestResponse;
  res.destroyed = false;
  res.statusCode = 200;
  res.headers = new Map();
  res.chunks = [];
  res.ended = false;
  res.setHeader = (name, value) => {
    res.headers.set(name, value);
  };
  res.getHeader = (name) => res.headers.get(name);
  res.write = (chunk, callback) => {
    res.chunks.push(Buffer.from(chunk));
    if (callback) queueMicrotask(() => callback());
    return true;
  };
  res.end = () => {
    res.ended = true;
    res.emit('finish');
  };
  return res;
}

async function waitForFinish(res: TestResponse) {
  if (res.ended) return;
  await new Promise((resolve) => res.once('finish', resolve));
}

function createReader(chunks: Uint8Array[], options: TestReaderOptions = {}) {
  let index = 0;
  const reader = {
    cancelled: false,
    async read() {
      if (options.throwOnRead) throw new Error('reader exploded');
      if (index >= chunks.length) return { done: true };
      const value = chunks[index];
      index += 1;
      return { done: false, value };
    },
    async cancel() {
      reader.cancelled = true;
    },
  };
  return reader;
}

async function recordsSuccessfulStreamAndHeaders() {
  const req = createRequest();
  const res = createResponse();
  const reader = createReader([Uint8Array.from([1, 2]), Uint8Array.from([3])]);

  streamNeteaseAudioResponse(req, res, {
    status: 206,
    headers: createHeaders({
      'content-type': 'audio/mpeg',
      'content-length': '3',
      'content-range': 'bytes 0-2/3',
      'accept-ranges': 'bytes',
    }),
    body: { getReader: () => reader },
  });

  await waitForFinish(res);

  assert.equal(res.statusCode, 206);
  assert.equal(res.headers.get('content-type'), 'audio/mpeg');
  assert.equal(res.headers.get('content-length'), '3');
  assert.equal(res.headers.get('content-range'), 'bytes 0-2/3');
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  assert.deepEqual(Buffer.concat(res.chunks), Buffer.from([1, 2, 3]));
  assert.equal(res.ended, true);
}

async function cancelsReaderWhenClientCloses() {
  const req = createRequest();
  const res = createResponse();
  let releaseRead;
  const reader = {
    cancelled: false,
    read() {
      return new Promise((resolve) => {
        releaseRead = () => resolve({ done: true });
      });
    },
    async cancel() {
      reader.cancelled = true;
    },
  };

  streamNeteaseAudioResponse(req, res, {
    status: 200,
    headers: createHeaders(),
    body: { getReader: () => reader },
  });

  req.destroyed = true;
  req.emit('close');
  releaseRead();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(reader.cancelled, true);
}

async function endsResponseWhenReaderThrows() {
  const req = createRequest();
  const res = createResponse();
  const reader = createReader([], { throwOnRead: true });

  streamNeteaseAudioResponse(req, res, {
    status: 200,
    headers: createHeaders(),
    body: { getReader: () => reader },
  });

  await waitForFinish(res);

  assert.equal(res.ended, true);
}

await recordsSuccessfulStreamAndHeaders();
await cancelsReaderWhenClientCloses();
await endsResponseWhenReaderThrows();

console.log('neteaseAudioProxy tests passed');
