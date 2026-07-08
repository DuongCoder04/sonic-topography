const AUDIO_PROXY_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges'];

function responseDestroyed(res) {
  return Boolean(res?.destroyed || res?.writableDestroyed);
}

function requestDestroyed(req) {
  return Boolean(req?.destroyed || req?.aborted);
}

function endResponse(res) {
  if (!responseDestroyed(res) && !res.writableEnded) res.end();
}

function cancelReader(reader) {
  reader?.cancel?.().catch(() => {});
}

export function streamNeteaseAudioResponse(req, res, audioResponse) {
  res.statusCode = audioResponse.status;
  for (const header of AUDIO_PROXY_HEADERS) {
    const value = audioResponse.headers.get(header);
    if (value) res.setHeader(header, value);
  }

  if (!res.getHeader('Content-Type') && !res.getHeader('content-type')) {
    res.setHeader('Content-Type', 'audio/mpeg');
  }

  if (!audioResponse.body) {
    endResponse(res);
    return Promise.resolve();
  }

  const reader = audioResponse.body.getReader();
  let settled = false;

  return new Promise((resolve) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const close = () => {
      cancelReader(reader);
      finish();
    };

    req.on?.('close', close);
    res.on?.('close', close);
    res.on?.('error', close);

    const pump = async () => {
      try {
        if (requestDestroyed(req) || responseDestroyed(res)) {
          cancelReader(reader);
          finish();
          return;
        }

        const { done, value } = await reader.read();
        if (done) {
          endResponse(res);
          finish();
          return;
        }

        res.write(Buffer.from(value), (err) => {
          if (err || requestDestroyed(req) || responseDestroyed(res)) {
            cancelReader(reader);
            finish();
            return;
          }
          pump();
        });
      } catch {
        cancelReader(reader);
        endResponse(res);
        finish();
      }
    };

    pump();
  });
}
