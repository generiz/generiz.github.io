from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old = '''<a class="project system-card ufotech-system" href="https://ufotech.com.py" target="_blank" rel="noopener"><div class="tagline"><span class="tag mono">Operational infrastructure / Linux</span><span class="badge">In operation</span></div><h3>Infraestructura ufotech</h3><p>Sistema interno que gobierna inventario, roles, revendedores, soporte, garantías, automatización documental, publicación e integraciones sobre infraestructura Linux.</p><div class="chips"><span class="chip">Linux</span><span class="chip">Roles</span><span class="chip">Automation</span><span class="chip">Integrations</span></div></a>'''

new = '''<div class="project system-card ufotech-system"><div class="tagline"><span class="tag mono">Business platform / Python · Linux</span><span class="badge">In operation</span></div><h3>ufotech</h3><p>Plataforma operativa diseñada y desarrollada por Nicolás Pintos. Integra web, equipos, clientes, empresas, ventas, soporte, revendedores, taller, finanzas, publicación, garantías, permisos, auditoría y sincronización en una arquitectura común.</p><div class="chips"><span class="chip">Flask / Linux</span><span class="chip">Multi-portal</span><span class="chip">Hybrid storage</span><span class="chip">Audit</span></div><div class="actions ufotech-actions"><button class="btn primary" id="ufotechOpen" type="button">Explorar sistema</button><a class="btn" href="https://ufotech.com.py" target="_blank" rel="noopener">Abrir ufotech ↗</a></div></div><div id="ufotechInlineRegion" class="sigil-inline-region" aria-hidden="true"><div class="sigil-inline-head"><div><span class="mono">ufotech · architecture explorer</span><small>Alcance y relaciones de la plataforma operativa</small></div><button id="ufotechClose" type="button">Cerrar</button></div><ufotech-architecture id="ufotechInlineDemo"></ufotech-architecture></div>'''

if old not in s:
    if 'id="ufotechOpen"' not in s:
        raise SystemExit('ufotech card insertion point not found')
else:
    s = s.replace(old, new, 1)

css = '''\n.ufotech-system{cursor:default;grid-column:1/-1!important;min-height:360px!important}.ufotech-system:hover{transform:none}.ufotech-system h3{min-height:0!important;margin:48px 0 18px!important}.ufotech-system .chips{position:static;left:auto;right:auto;bottom:auto;margin-top:auto;padding-top:22px}.ufotech-system .ufotech-actions{position:relative;z-index:3;margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}.ufotech-system .ufotech-actions .btn{cursor:pointer;justify-content:center}.ufotech-system .ufotech-actions a{position:relative;z-index:4}@media(max-width:720px){.ufotech-system .ufotech-actions{display:grid;grid-template-columns:1fr}.ufotech-system .ufotech-actions .btn{width:100%;justify-content:center}}\n'''
if '.ufotech-system .ufotech-actions' not in s:
    s = s.replace('</style>', css + '</style>', 1)

loader = '''<script type="module" src="/ufotech/embed.js"></script><script>document.addEventListener('DOMContentLoaded',()=>{const open=document.getElementById('ufotechOpen');const close=document.getElementById('ufotechClose');const region=document.getElementById('ufotechInlineRegion');if(!open||!close||!region)return;open.addEventListener('click',()=>{region.classList.add('open');region.setAttribute('aria-hidden','false');setTimeout(()=>region.scrollIntoView({behavior:'smooth',block:'start'}),40)});close.addEventListener('click',()=>{region.classList.remove('open');region.setAttribute('aria-hidden','true');open.scrollIntoView({behavior:'smooth',block:'center'})})});</script>'''
if '/ufotech/embed.js' not in s:
    s = s.replace('</body>', loader + '\n</body>', 1)

p.write_text(s, encoding='utf-8')
