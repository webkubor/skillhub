import type { IncomingMessage, ServerResponse } from 'node:http';
import { doctor, scanSkills } from './scan.js';
import { checkCliStatus } from './cli-status.js';
import { UsageStore } from './usage.js';
import type { ScanResult } from './types.js';

export async function createHandler(roots: string[], usage?: UsageStore) {
  let cached: ScanResult = await scanSkills({ roots });
  const store = usage ?? new UsageStore();
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SkillHub</title><style>
body{font:14px system-ui,sans-serif;margin:2rem;background:#0f1115;color:#e8eaed}h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:2rem}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.5rem;border-bottom:1px solid #2b2f38}code{color:#9cdcfe}.warn{color:#f5a97f}.ok{color:#7ee787}.muted{color:#9aa0a6}.dot{font-size:1.1rem}
</style></head><body><h1>SkillHub <span class="ok">local</span></h1>
<p>独立 SkillHub，只读视图。端点：<code>/api/scan</code> · <code>/api/doctor</code> · <code>/api/stats</code> · <code>/api/status</code> · <code>/api/refresh</code></p>
<h2>CLI 状态</h2><div id="cli">loading…</div>
<h2>清单</h2><div id="app">loading…</div>
<h2>使用统计</h2><div id="stats">loading…</div>
<script>
async function load(){const [c,s,d,t]=await Promise.all([fetch('/api/status').then(r=>r.json()),fetch('/api/scan').then(r=>r.json()),fetch('/api/doctor').then(r=>r.json()),fetch('/api/stats').then(r=>r.json())]);
document.getElementById('cli').innerHTML = c.map(x=>'<p><span class="dot">'+x.light+'</span> <b>'+x.cli+'</b> '+(x.hosts.length?x.hosts.map(h=>'<span class="dot">'+h.light+'</span> <code>'+h.host+'</code>'+(h.user?' ('+h.user+')':'')).join(' &nbsp; '):'<span class="muted">'+x.detail+'</span>')+'</p>').join('');
document.getElementById('app').innerHTML='<p>'+s.count+' skills · '+s.broken.length+' broken · doctor '+(d.ok?'<span class="ok">ok</span>':'<span class="warn">'+d.problems.length+' problems</span>')+'</p><table><tr><th>Name</th><th>Version</th><th>Category</th><th>Origin</th><th>Scope</th></tr>'+s.skills.map(x=>'<tr><td><code>'+x.name+'</code></td><td>'+(x.version||'—')+'</td><td>'+x.category+'</td><td>'+x.origin+'</td><td>'+(x.scope||'—')+'</td></tr>').join('')+'</table>';
document.getElementById('stats').innerHTML = t.length ? '<table><tr><th>Skill</th><th>Uses</th><th>Success</th><th>Partial</th><th>Failed</th><th>Rate</th><th>Last</th></tr>'+t.map(r=>'<tr><td><code>'+r.skill+'</code></td><td>'+r.uses+'</td><td>'+r.success+'</td><td>'+r.partial+'</td><td>'+r.failed+'</td><td>'+(r.success_rate*100).toFixed(1)+'%</td><td>'+r.last_used_at.slice(0,16).replace('T',' ')+'</td></tr>').join('')+'</table>' : '<p class="muted">暂无使用记录。跑 <code>skillhub use &lt;skill&gt; --outcome success</code> 开始统计。</p>';}
load().catch(e=>{document.getElementById('app').textContent='failed: '+e.message});</script></body></html>`;

  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      if (path === '/api/scan') return void res.end(JSON.stringify(cached));
      if (path === '/api/doctor') return void res.end(JSON.stringify(doctor(cached)));
      if (path === '/api/stats') return void res.end(JSON.stringify(store.stats()));
      if (path === '/api/status') return void res.end(JSON.stringify(checkCliStatus()));
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
