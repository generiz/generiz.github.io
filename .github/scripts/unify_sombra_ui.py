from pathlib import Path

p = Path('index.html')
s = p.read_text()

old = '<a class="project system-card" href="https://github.com/generiz/sombra" target="_blank" rel="noopener"><div class="tagline"><span class="tag mono">Resilient messaging / Rust</span><span class="badge">Research prototype</span></div><h3>Sombra</h3><p>Prototipo de mensajería para conectividad degradada. Implementa cola DTN persistente, store-and-forward, TTL, retry, scheduling, deduplicación y abstracciones de transporte. Identidad y envelopes autenticados siguen en desarrollo.</p><div class="chips"><span class="chip">Rust</span><span class="chip">DTN</span><span class="chip">Store-and-forward</span><span class="chip">Persistent queue</span></div></a>'
new = '<div class="project system-card sombra-project"><div class="tagline"><span class="tag mono">Resilient messaging / Rust</span><span class="badge">Research prototype</span></div><h3>Sombra</h3><p>Prototipo de mensajería para conectividad degradada. Implementa cola DTN persistente, store-and-forward, TTL, retry, scheduling, deduplicación y abstracciones de transporte. Identidad y envelopes autenticados siguen en desarrollo.</p><div class="chips"><span class="chip">Rust</span><span class="chip">DTN</span><span class="chip">Store-and-forward</span><span class="chip">Persistent queue</span></div><div class="actions sombra-actions"><button class="btn primary" id="sombraOpen" type="button">Abrir demo</button><a class="btn" href="https://github.com/generiz/sombra" target="_blank" rel="noopener">Código ↗</a></div></div><div id="sombraInlineRegion" class="sigil-inline-region" aria-hidden="true"><div class="sigil-inline-head"><div><span class="mono">Sombra · Resilience demonstrator</span><small>Se ejecuta dentro de nicolaspintos.com</small></div><button id="sombraClose" type="button">Cerrar</button></div><sombra-live-demo id="sombraInlineDemo"></sombra-live-demo></div>'

if old not in s:
    raise SystemExit('Sombra card not found')
s = s.replace(old, new, 1)

css = '.sombra-project{cursor:default}.sombra-project:hover{transform:none}.sombra-project .chips{position:static;left:auto;right:auto;bottom:auto;margin-top:auto;padding-top:24px}.sombra-project .sombra-actions{position:relative;z-index:3;margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}.sombra-project .sombra-actions .btn{cursor:pointer;justify-content:center}.sombra-project .sombra-actions a{position:relative;z-index:4}@media(max-width:720px){.sombra-project .sombra-actions{display:grid;grid-template-columns:1fr}.sombra-project .sombra-actions .btn{width:100%;justify-content:center}}'
if css not in s:
    s = s.replace('</style>', css + '</style>', 1)

loader = '<script type="module" src="/sombra/embed.js"></script>'
script = '<script>document.addEventListener(\'DOMContentLoaded\',()=>{const open=document.getElementById(\'sombraOpen\');const close=document.getElementById(\'sombraClose\');const region=document.getElementById(\'sombraInlineRegion\');const demo=document.getElementById(\'sombraInlineDemo\');if(!open||!close||!region||!demo)return;open.addEventListener(\'click\',()=>{region.classList.add(\'open\');region.setAttribute(\'aria-hidden\',\'false\');setTimeout(()=>region.scrollIntoView({behavior:\'smooth\',block:\'start\'}),40)});close.addEventListener(\'click\',()=>{region.classList.remove(\'open\');region.setAttribute(\'aria-hidden\',\'true\');open.scrollIntoView({behavior:\'smooth\',block:\'center\'})})});</script>'
if script not in s:
    if loader not in s:
        raise SystemExit('Sombra loader not found')
    s = s.replace(loader, loader + script, 1)

p.write_text(s)
