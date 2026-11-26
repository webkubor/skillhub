import { IncomingMessage, ServerResponse } from 'node:http';
import { doctor, scanSkills } from './scan.js';
import type { ScanResult } from './types.js';

export async function createHandler(roots: string[]) {
  let cached: ScanResult = await scanSkills({ roots });
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SkillHub</title><style>
body{font:14px system-ui,sans-serif;margin:2rem;background:#0f1115;color:#e8eaed}h1{font-size:1.5rem}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.5rem;border-bottom:1px solid #2b2f38}code{color:#9cdcfe}.warn{color:#f5a97f}.ok{color:#7ee787}
</style></head><body><h1>SkillHub <span class="ok">local</span></h1><p>只读视图。写操作走 <code>cs skill</code>。端点：<code>/api/scan</code> · <code>/api/doctor</code></p><div id="app">loading…</div><script>
async function load(){const [s,d]=await Promise.all([fetch('/api/scan').then(r=>r.json()),fetch('/api/doctor').then(r=>r.json())]);document.getElementById('app').innerHTML='<p>'+s.count+' skills · '+s.broken.length+' broken · doctor '+(d.ok?'<span class="ok">ok</span>':'<span class="warn">'+d.problems.length+' problems</span>')+'</p><table><tr><th>Name</th><th>Version</th><th>Category</th><th>Origin</th><th>Scope</th></tr>'+s.skills.map(x=>'<tr><td><code>'+x.name+'</code></td><td>'+(x.version||'—')+'</td><td>'+x.category+'</td><td>'+x.origin+'</td><td>'+(x.scope||'—')+'</td></tr>').join('')+'</table>';}
load().catch(e=>{document.getElementById('app').textContent='failed: '+e.message});</script></body></html>`;

  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      if (path === '/api/scan') return void res.end(JSON.stringify(cached));
      if (path === '/api/doctor') return void res.end(JSON.stringify(doctor(cached)));
      if (path === '/api/refresh') {
        cached = await scanSkills({ roots });
        return void res.end(JSON.stringify({ ok: true, count: cached.count }));
      }
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(html);
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  };
}
