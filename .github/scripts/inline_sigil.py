from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

if 'id="sigilInlineRegion"' not in text:
    pattern = re.compile(r'<a class="project" style="grid-column:1/-1;min-height:330px" href="/sigil/">.*?</a>', re.S)
    replacement = '''<div class="project sigil-project" style="grid-column:1/-1;min-height:330px"><div class="tagline"><span class="tag mono">Secure messaging / Rust · WebAssembly</span><span class="badge">Live demo</span></div><h3>Sigil</h3><p>Mensajería segura experimental con composición por símbolos, cifrado autenticado por capas y recuperación de ciphertext fragmentado. El core Rust corre realmente en WebAssembly; la topología de nodos es una simulación opcional.</p><div class="chips"><span class="chip">Secure Canvas</span><span class="chip">Rust/WASM real</span><span class="chip">XChaCha20-Poly1305</span><span class="chip">Reed-Solomon</span></div><div class="actions sigil-actions"><button class="btn primary" id="sigilOpen" type="button">Abrir demo</button><a class="btn" href="/sigil/">Ver demo completa ↗</a></div></div><div id="sigilInlineRegion" class="sigil-inline-region" aria-hidden="true"><div class="sigil-inline-head"><div><span class="mono">Sigil · Live protocol demonstrator</span><small>Se ejecuta dentro de nicolaspintos.com</small></div><button id="sigilClose" type="button">Cerrar</button></div><sigil-inline-demo id="sigilInlineDemo"></sigil-inline-demo></div>'''
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit(f'Sigil card not found or ambiguous: {count}')

old_css = '.sigil-project{cursor:default}.sigil-project:hover{transform:none}.sigil-project .sigil-actions{position:relative;z-index:3;margin-top:24px}.sigil-project .sigil-actions .btn{cursor:pointer}.sigil-inline-region{grid-column:1/-1;display:none;margin-top:2px;border-top:1px solid var(--line2);padding-top:14px;scroll-margin-top:86px}.sigil-inline-region.open{display:block}.sigil-inline-head{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:12px;padding:0 2px}.sigil-inline-head>div{display:grid;gap:5px}.sigil-inline-head small{color:#657168;font-size:10px}.sigil-inline-head button{appearance:none;border:1px solid #374039;background:transparent;color:#9ca79f;padding:9px 13px;border-radius:999px;cursor:pointer;font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase}.sigil-inline-head button:hover{color:#fff;border-color:#667169}@media(max-width:720px){.sigil-inline-head{align-items:flex-start}.sigil-project .sigil-actions{display:grid;grid-template-columns:1fr 1fr}.sigil-project .sigil-actions .btn{justify-content:center}}'
new_css = '.sigil-project{cursor:default}.sigil-project:hover{transform:none}.sigil-project .chips{position:static;left:auto;right:auto;bottom:auto;margin-top:24px}.sigil-project .sigil-actions{position:relative;z-index:3;margin-top:14px;display:flex;gap:10px;flex-wrap:wrap}.sigil-project .sigil-actions .btn{cursor:pointer;justify-content:center}.sigil-inline-region{grid-column:1/-1;display:none;margin-top:2px;border-top:1px solid var(--line2);padding-top:14px;scroll-margin-top:86px}.sigil-inline-region.open{display:block}.sigil-inline-head{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:12px;padding:0 2px}.sigil-inline-head>div{display:grid;gap:5px}.sigil-inline-head small{color:#657168;font-size:10px}.sigil-inline-head button{appearance:none;border:1px solid #374039;background:transparent;color:#9ca79f;padding:9px 13px;border-radius:999px;cursor:pointer;font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase}.sigil-inline-head button:hover{color:#fff;border-color:#667169}@media(max-width:720px){.sigil-inline-head{align-items:flex-start}.sigil-project .sigil-actions{display:grid;grid-template-columns:1fr}.sigil-project .sigil-actions .btn{width:100%;justify-content:center}}'

if old_css in text:
    text = text.replace(old_css, new_css, 1)
elif new_css not in text:
    text = text.replace('</style>', '\n' + new_css + '\n</style>', 1)

text = text.replace('Abrir aparte ↗', 'Ver demo completa ↗')

if 'src="/sigil/embed.js"' not in text:
    js = '''<script type="module" src="/sigil/embed.js"></script><script>document.addEventListener('DOMContentLoaded',()=>{const open=document.getElementById('sigilOpen');const close=document.getElementById('sigilClose');const region=document.getElementById('sigilInlineRegion');const demo=document.getElementById('sigilInlineDemo');if(!open||!close||!region||!demo)return;open.addEventListener('click',()=>{region.classList.add('open');region.setAttribute('aria-hidden','false');customElements.whenDefined('sigil-inline-demo').then(()=>demo.activate());setTimeout(()=>region.scrollIntoView({behavior:'smooth',block:'start'}),40)});close.addEventListener('click',()=>{region.classList.remove('open');region.setAttribute('aria-hidden','true');open.scrollIntoView({behavior:'smooth',block:'center'})})});</script>'''
    text = text.replace('</body>', js + '</body>', 1)

path.write_text(text, encoding='utf-8')
