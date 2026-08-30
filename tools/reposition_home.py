from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

s = s.replace(
    '<meta name="description" content="Nicolás Pintos — consultoría de infraestructura, operación IT y seguridad aplicada. Implementación, procurement, automatización, soporte y prototipos técnicos propios.">',
    '<meta name="description" content="Nicolás Pintos — infraestructura, seguridad aplicada, privacidad, identidad y arquitectura tecnológica para problemas de alta exposición.">'
)
s = s.replace(
    '<title>Nicolás Pintos — Infraestructura, Seguridad Aplicada y Operación IT</title>',
    '<title>Nicolás Pintos — Infraestructura, Seguridad Aplicada y Privacidad</title>'
)

s = re.sub(
    r'<header class="nav">.*?</header>',
    '<header class="nav"><div class="shell navin"><a class="brand" href="#inicio"><span class="brandmark"></span>Nicolás Pintos</a><nav class="links"><a href="#intervenciones">Intervenciones</a><a href="#sistemas">Sistemas</a><a href="#perfil">Perfil</a><button class="theme-toggle" id="themeToggle" type="button" aria-label="Cambiar a tema claro" aria-pressed="false">Claro</button><a class="contactbtn" href="#contacto">Contacto</a></nav></div></header>',
    s,
    count=1,
    flags=re.S,
)

s = s.replace(
    '<div class="eyebrow mono">Infraestructura · seguridad aplicada · operación IT</div>',
    '<div class="eyebrow mono">Infraestructura · seguridad aplicada · privacidad · identidad</div>'
)
s = s.replace(
    '<p class="hero-line">Consultor de infraestructura y seguridad aplicada. <span>Diseño, selecciono, implemento y opero sistemas.</span></p>',
    '<p class="hero-line">Consultor de infraestructura y seguridad aplicada. <span>Intervengo cuando exposición, identidad, comunicaciones e infraestructura empiezan a depender unas de otras.</span></p>'
)
s = re.sub(
    r'<p class="hero-desc">.*?</p>',
    '<p class="hero-desc">Diseño arquitectura, reduzco superficies de exposición, separo dominios de confianza y defino controles sobre sistemas, accesos, redes y datos. Las herramientas se eligen después de entender el riesgo.</p>',
    s,
    count=1,
    flags=re.S,
)

interventions = '''<section class="section interventions" id="intervenciones"><div class="shell reveal"><div class="head"><div class="kicker mono">01 / Intervenciones</div><div><h2>Problemas donde las capas dejan de poder analizarse por separado.</h2><p class="lead">Infraestructura, identidad, comunicaciones y exposición se revisan como un sistema. Primero se define qué puede observarse o comprometerse; después se seleccionan controles.</p></div></div><div class="intervention-grid">
<article class="intervention-card"><div class="intervention-no mono">01 / Exposure</div><h3>Exposición digital e identidad</h3><p>Una identidad pública rara vez queda expuesta por una sola filtración. El riesgo aparece cuando dominios, correos, documentos, fotografías, servicios y metadatos pueden correlacionarse.</p><div class="flow mono"><span>Reconnaissance</span><b>→</b><span>Enumeration</span><b>→</b><span>Correlation</span><b>→</b><span>Validation</span><b>→</b><span>Remediation</span></div><div class="intervention-meta"><span>OSINT</span><span>DNS / CT logs</span><span>Metadata</span><span>Identity correlation</span></div><p class="principle">La pregunta es qué puede reconstruir un tercero con información que nunca fue pensada para analizarse en conjunto.</p></article>
<article class="intervention-card"><div class="intervention-no mono">02 / Compartmentalization</div><h3>Compartimentación de identidad</h3><p>Una VPN no separa identidades si distintos contextos siguen compartiendo cuentas, dispositivos, mecanismos de recuperación, navegadores o patrones de conexión.</p><div class="arch-lines mono"><span>IDENTITY A → DEVICE A → ACCOUNTS A → NETWORK A</span><span>IDENTITY B → DEVICE B → ACCOUNTS B → NETWORK B</span></div><div class="intervention-meta"><span>Perfiles</span><span>FIDO2</span><span>Recovery paths</span><span>Network contexts</span></div><p class="principle">La compartimentación ocurre antes del cifrado.</p></article>
<article class="intervention-card"><div class="intervention-no mono">03 / Endpoint</div><h3>Dispositivo de alta exposición</h3><p>La seguridad de un teléfono o estación de trabajo no depende de instalar aplicaciones “privadas”. Se revisan boot chain, permisos, sandboxing, telemetría, sincronización, radios, autenticación y recuperación.</p><div class="arch-lines mono"><span>VERIFIED BOOT</span><span>ISOLATED PROFILES</span><span>HARDWARE-BACKED KEYS</span><span>MINIMUM PRIVILEGED SERVICES</span></div><div class="intervention-meta"><span>Android sandboxing</span><span>Keystore</span><span>Verified Boot</span><span>Strong auth</span></div><p class="principle">El objetivo es reducir superficie de ataque y la cantidad de información innecesariamente disponible.</p></article>
<article class="intervention-card"><div class="intervention-no mono">04 / Communications</div><h3>Comunicaciones sensibles</h3><p>Cifrar contenido no elimina automáticamente la metadata. Un sistema puede ocultar lo que se dice y seguir revelando quién habla, cuándo, desde dónde, con qué frecuencia y durante cuánto tiempo.</p><div class="layer-stack mono"><span>CONTENT</span><span>TRANSPORT</span><span>IDENTITY</span><span>METADATA</span><span>NETWORK</span></div><div class="intervention-meta"><span>E2EE</span><span>Forward secrecy</span><span>Metadata minimization</span><span>Encrypted transport</span></div><p class="principle">La pregunta no es solamente “¿está cifrado?”, sino “¿qué sigue siendo observable después del cifrado?”.</p></article>
<article class="intervention-card"><div class="intervention-no mono">05 / Private infrastructure</div><h3>Infraestructura privada y segmentación</h3><p>Publicar servicios internos directamente en Internet y mantener redes planas amplía el failure domain. Se busca acceso privado por identidad y flujos explícitos entre segmentos.</p><div class="arch-lines mono"><span>USER → IDENTITY → PRIVATE OVERLAY → POLICY → INTERNAL SERVICE</span><span>MGMT ├ SERVERS ├ USERS ├ CCTV ├ IOT └ GUEST</span></div><div class="intervention-meta"><span>WireGuard / Tailscale</span><span>802.1Q</span><span>ACL</span><span>Least privilege</span></div><p class="principle">Menos servicios expuestos y menos sistemas alcanzables desde un punto comprometido.</p></article>
<article class="intervention-card"><div class="intervention-no mono">06 / Threat model</div><h3>Arquitectura ante amenaza dirigida</h3><p>Un checklist genérico sirve poco cuando existe una amenaza concreta. Se define el activo, quién podría atacarlo, qué capacidad tiene y qué riesgo residual sigue siendo aceptable.</p><div class="flow mono"><span>ASSET</span><b>→</b><span>ADVERSARY</span><b>→</b><span>CAPABILITY</span><b>→</b><span>SURFACE</span><b>→</b><span>CONTROL</span><b>→</b><span>RESIDUAL RISK</span></div><div class="intervention-meta"><span>Threat modeling</span><span>Trust boundaries</span><span>Attack surface</span><span>Defense in depth</span></div><p class="principle">Primero se entiende el problema. Después se seleccionan herramientas.</p></article>
</div></div></section>'''

s = re.sub(
    r'<section class="section stack" id="modelo">.*?</section>\s*<section class="section consult" id="consultoria">.*?</section>',
    interventions,
    s,
    count=1,
    flags=re.S,
)

systems = '''<section class="section lab" id="sistemas"><div class="shell reveal"><div class="head"><div class="kicker mono">02 / Sistemas construidos</div><div><h2>Código y sistemas propios.</h2><p class="lead">Implementaciones reales y prototipos de investigación, con estado y límites explícitos.</p></div></div><div class="featured systems-grid">
<div class="project sigil-project" style="grid-column:1/-1;min-height:330px"><div class="tagline"><span class="tag mono">Secure messaging research / Rust · WebAssembly</span><span class="badge">Research prototype</span></div><h3>Sigil</h3><p>Prototipo de mensajería segura centrado en reducir exposición de texto y rotar representaciones internas. El core Rust/WASM ejecuta doble AEAD, fragmentación Reed–Solomon, reconstrucción autenticada y controles de replay; la topología de nodos de la demo sigue siendo simulada.</p><div class="chips"><span class="chip">Rust/WASM</span><span class="chip">XChaCha20-Poly1305</span><span class="chip">Reed-Solomon</span><span class="chip">Threat model</span></div><div class="actions sigil-actions"><button class="btn primary" id="sigilOpen" type="button">Abrir demo</button><a class="btn" href="https://github.com/generiz/Sigil" target="_blank" rel="noopener">Código ↗</a></div></div>
<div id="sigilInlineRegion" class="sigil-inline-region" aria-hidden="true"><div class="sigil-inline-head"><div><span class="mono">Sigil · Live protocol demonstrator</span><small>Se ejecuta dentro de nicolaspintos.com</small></div><button id="sigilClose" type="button">Cerrar</button></div><sigil-inline-demo id="sigilInlineDemo"></sigil-inline-demo></div>
<a class="project system-card" href="https://github.com/generiz/sombra" target="_blank" rel="noopener"><div class="tagline"><span class="tag mono">Resilient messaging / Rust</span><span class="badge">Research prototype</span></div><h3>Sombra</h3><p>Prototipo de mensajería para conectividad degradada. Implementa cola DTN persistente, store-and-forward, TTL, retry, scheduling, deduplicación y abstracciones de transporte. Identidad y envelopes autenticados siguen en desarrollo.</p><div class="chips"><span class="chip">Rust</span><span class="chip">DTN</span><span class="chip">Store-and-forward</span><span class="chip">Persistent queue</span></div></a>
<a class="project system-card" href="https://github.com/generiz/IntraSeal" target="_blank" rel="noopener"><div class="tagline"><span class="tag mono">Encrypted file envelopes / Python</span><span class="badge">Utility</span></div><h3>IntraSeal</h3><p>CLI acotada para envelopes de archivos con AES-256-GCM, scrypt, I/O por streaming, autenticación de cabecera y rechazo de modificaciones.</p><div class="chips"><span class="chip">Python</span><span class="chip">AES-256-GCM</span><span class="chip">scrypt</span><span class="chip">tests</span></div></a>
<a class="project system-card ufotech-system" href="https://ufotech.com.py" target="_blank" rel="noopener"><div class="tagline"><span class="tag mono">Operational infrastructure / Linux</span><span class="badge">In operation</span></div><h3>Infraestructura ufotech</h3><p>Sistema interno que gobierna inventario, roles, revendedores, soporte, garantías, automatización documental, publicación e integraciones sobre infraestructura Linux.</p><div class="chips"><span class="chip">Linux</span><span class="chip">Roles</span><span class="chip">Automation</span><span class="chip">Integrations</span></div></a>
</div></div></section>'''

s = re.sub(
    r'<section class="section lab" id="lab">.*?</section>\s*<section class="bridge" id="ufotech">.*?</section>',
    systems,
    s,
    count=1,
    flags=re.S,
)

s = s.replace('<div class="kicker mono">05 / Perfil</div>', '<div class="kicker mono">03 / Perfil</div>')
s = s.replace(
    '<p>Consultor de infraestructura, operación IT y seguridad aplicada. Fundador de ufotech.</p><p>Trabajo con redes, endpoints, storage, procurement, automatización, soporte y recuperación. En paralelo desarrollo prototipos propios; el Lab está separado de los servicios.</p>',
    '<p>Consultor de infraestructura y seguridad aplicada. Fundador de ufotech.</p><p>Trabajo sobre arquitectura, redes, identidad, exposición, segmentación, procurement y automatización. En paralelo desarrollo prototipos propios de cifrado y comunicaciones resilientes, separados de la actividad profesional facturable.</p>'
)
s = s.replace(
    '<span>Infraestructura · operación · seguridad aplicada · automatización</span>',
    '<span>Infraestructura · seguridad aplicada · privacidad · automatización</span>'
)
s = re.sub(r'<div class="tech" aria-label="Tecnologías y áreas técnicas">.*?</div>\s*<section class="contact"', '<section class="contact"', s, count=1, flags=re.S)
s = s.replace('<div class="kicker mono">06 / Contacto</div>', '<div class="kicker mono">04 / Contacto</div>')
s = s.replace(
    '<p class="contact-note">Consultas sobre infraestructura, soporte, procurement, automatización, seguridad aplicada y recuperación.</p>',
    '<p class="contact-note">Consultas sobre infraestructura, exposición digital, seguridad aplicada, comunicaciones, identidad y arquitectura tecnológica.</p>'
)

extra_css = '''
.interventions{background:#080b09}.intervention-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:70px;border-top:1px solid var(--line2);border-left:1px solid var(--line2)}.intervention-card{position:relative;padding:34px;min-height:430px;border-right:1px solid var(--line2);border-bottom:1px solid var(--line2);transition:background .25s ease,border-color .25s ease}.intervention-card:hover{background:rgba(255,255,255,.018)}.intervention-no{color:#59645d}.intervention-card h3{font-size:32px;line-height:1.02;letter-spacing:-.045em;font-weight:530;margin:42px 0 14px;max-width:620px}.intervention-card>p{color:#858f88;line-height:1.65;max-width:690px;margin:0}.flow,.arch-lines,.layer-stack{margin:28px 0 24px;border:1px solid var(--line2);background:rgba(255,255,255,.012);padding:15px;color:#718078}.flow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.flow b{font-weight:400;color:#3e4a42}.arch-lines{display:grid;gap:9px;line-height:1.5}.layer-stack{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;padding:1px}.layer-stack span{padding:12px 8px;background:var(--panel);text-align:center}.intervention-meta{display:flex;gap:8px;flex-wrap:wrap}.intervention-meta span{border:1px solid var(--line2);border-radius:999px;padding:7px 9px;color:#67736b;font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em}.intervention-card .principle{margin-top:26px;padding-top:20px;border-top:1px solid var(--line2);color:#b1bbb3;font-size:14px}.systems-grid .system-card{grid-column:span 4;min-height:360px}.ufotech-system{background:linear-gradient(155deg,#111714,#0a0e0b)}
@media(max-width:900px){.intervention-grid{grid-template-columns:1fr}.intervention-card{min-height:0}.systems-grid .system-card{grid-column:1/-1}.layer-stack{grid-template-columns:1fr}.flow{line-height:1.8}}
'''
s = s.replace('</style>', extra_css + '\n</style>', 1)

# Remove stale section ids/labels if any survived.
s = s.replace('href="#modelo">Enfoque</a>', 'href="#intervenciones">Intervenciones</a>')
s = s.replace('href="#consultoria">Consultoría IT</a>', 'href="#intervenciones">Intervenciones</a>')
s = s.replace('href="#lab">Security Lab</a>', 'href="#sistemas">Sistemas</a>')

p.write_text(s, encoding='utf-8')
