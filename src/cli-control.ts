import { request } from 'node:http';

export function sendWebControl(
  port: number,
  payload: Record<string, unknown>,
  strict = false,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/control',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: 800,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode ?? 500) >= 400) {
            if (strict) reject(new Error(`web control failed (${res.statusCode}): ${text}`));
            else resolve(0);
            return;
          }
          try {
            const parsed = JSON.parse(text) as { clients?: number };
            resolve(parsed.clients ?? 0);
          } catch {
            resolve(0);
          }
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      if (strict) reject(new Error(`连接 127.0.0.1:${port} 超时，请先执行 skillhub serve`));
      else resolve(0);
    });
    req.on('error', () => {
      if (strict) reject(new Error(`未检测到运行中的 SkillHub 网页服务（127.0.0.1:${port}），请先执行 skillhub serve`));
      else resolve(0);
    });
    req.write(body);
    req.end();
  });
}
