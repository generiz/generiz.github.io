from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

css = r'''
.contact-form-region{max-height:0;opacity:0;overflow:hidden;transition:max-height .45s ease,opacity .28s ease,margin .35s ease;margin-top:0}
.contact-form-region.open{max-height:900px;opacity:1;margin-top:24px}
.contact-form-shell{border:1px solid var(--line2);border-radius:var(--radius);background:linear-gradient(155deg,#101512,#0a0d0b);padding:28px}
.contact-form-head{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;margin-bottom:24px}
.contact-form-head strong{display:block;font-size:24px;font-weight:560;letter-spacing:-.035em}
.contact-form-head small{display:block;color:#737f76;margin-top:7px;font-size:11px;line-height:1.5}
.contact-form-close{appearance:none;border:1px solid #374039;background:transparent;color:#9ba69e;border-radius:999px;padding:9px 13px;cursor:pointer;font-size:11px}
.contact-form{display:grid;gap:14px}
.contact-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.contact-field{display:grid;gap:7px}
.contact-field.full{grid-column:1/-1}
.contact-field label{color:#657169;font:600 9px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}
.contact-field input,.contact-field select,.contact-field textarea{width:100%;border:1px solid #303932;border-radius:10px;background:#090d0a;color:#dce3dd;padding:13px 14px;outline:none;transition:.2s}
.contact-field textarea{min-height:150px;resize:vertical;line-height:1.5}
.contact-field input:focus,.contact-field select:focus,.contact-field textarea:focus{border-color:#68756b;background:#0d120f}
.contact-form-actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:4px}
.contact-form-submit{appearance:none;border:1px solid #e9ede8;background:#e9ede8;color:#0a0c0b;border-radius:999px;padding:12px 17px;cursor:pointer;font-size:12px}
.contact-form-submit:disabled{opacity:.5;cursor:wait}
.contact-form-status{color:#7e8981;font-size:11px;line-height:1.4;min-height:16px}
.contact-form-note{margin:0;color:#59645d;font:500 9px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}
.contact-honey{position:absolute!important;left:-10000px!important;opacity:0!important;pointer-events:none!important}
@media(max-width:720px){.contact-form-grid{grid-template-columns:1fr}.contact-field.full{grid-column:auto}.contact-form-shell{padding:20px}.contact-form-head{align-items:center}}
'''
if '.contact-form-region{' not in s:
    s = s.replace('</style>', css + '\n</style>', 1)

needle = '<a href="https://github.com/generiz" target="_blank" rel="noopener"><span>GitHub</span><span>↗</span></a></div><div class="security-meta mono">'
replacement = '''<a href="https://github.com/generiz" target="_blank" rel="noopener"><span>GitHub</span><span>↗</span></a><a href="#" id="emailCopy"><span class="contact-name"><span>Email</span><span class="contact-badge">nicolaspintos@ufotech.com.py</span></span><span id="emailCopyState">Copiar</span></a><a href="#contactFormRegion" id="contactFormOpen"><span>Formulario</span><span id="contactFormGlyph">＋</span></a></div><div id="contactFormRegion" class="contact-form-region" aria-hidden="true"><div class="contact-form-shell"><div class="contact-form-head"><div><strong>Consulta</strong><small>Contame el contexto técnico y qué necesitás resolver.</small></div><button class="contact-form-close" id="contactFormClose" type="button">Cerrar</button></div><form id="contactForm" class="contact-form"><input class="contact-honey" type="text" name="_honey" tabindex="-1" autocomplete="off"><input type="hidden" name="_subject" value="Contacto desde nicolaspintos.com"><input type="hidden" name="_captcha" value="false"><div class="contact-form-grid"><div class="contact-field"><label for="contactName">Nombre / organización</label><input id="contactName" name="name" type="text" autocomplete="name" required></div><div class="contact-field"><label for="contactEmail">Email de respuesta</label><input id="contactEmail" name="email" type="email" autocomplete="email" required></div><div class="contact-field full"><label for="contactArea">Área</label><select id="contactArea" name="area" required><option value="" selected disabled>Seleccionar</option><option>Infraestructura</option><option>Seguridad / exposición digital</option><option>Identidad / compartimentación</option><option>Comunicaciones sensibles</option><option>Arquitectura ante amenaza dirigida</option><option>Otro</option></select></div><div class="contact-field full"><label for="contactMessage">Contexto</label><textarea id="contactMessage" name="message" placeholder="Qué está pasando, qué necesitás proteger o resolver y cualquier restricción relevante." required></textarea></div></div><div class="contact-form-actions"><button id="contactSubmit" class="contact-form-submit" type="submit">Enviar consulta</button><span id="contactFormStatus" class="contact-form-status" role="status" aria-live="polite"></span></div><p class="contact-form-note">Envío web mediante relay externo mientras este sitio siga siendo estático. No abre una aplicación de correo.</p></form></div></div><div class="security-meta mono">'''
if 'id="emailCopy"' not in s:
    if needle not in s:
        raise SystemExit('contact insertion point not found')
    s = s.replace(needle, replacement, 1)

js = r'''
<script>
document.addEventListener('DOMContentLoaded',()=>{
  const email='nicolaspintos@ufotech.com.py';
  const emailCopy=document.getElementById('emailCopy');
  const emailState=document.getElementById('emailCopyState');
  if(emailCopy){emailCopy.addEventListener('click',async e=>{e.preventDefault();try{await navigator.clipboard.writeText(email);emailState.textContent='Copiado';setTimeout(()=>emailState.textContent='Copiar',1600)}catch(_){emailState.textContent=email}})}
  const open=document.getElementById('contactFormOpen');
  const close=document.getElementById('contactFormClose');
  const region=document.getElementById('contactFormRegion');
  const glyph=document.getElementById('contactFormGlyph');
  const form=document.getElementById('contactForm');
  const submit=document.getElementById('contactSubmit');
  const status=document.getElementById('contactFormStatus');
  const setOpen=(value)=>{if(!region)return;region.classList.toggle('open',value);region.setAttribute('aria-hidden',String(!value));if(glyph)glyph.textContent=value?'−':'＋';if(value)setTimeout(()=>region.scrollIntoView({behavior:'smooth',block:'nearest'}),40)};
  if(open)open.addEventListener('click',e=>{e.preventDefault();setOpen(!region.classList.contains('open'))});
  if(close)close.addEventListener('click',()=>setOpen(false));
  if(form)form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(form.querySelector('[name="_honey"]').value)return;
    submit.disabled=true;status.textContent='Enviando…';
    try{
      const response=await fetch('https://formsubmit.co/ajax/nicolaspintos@ufotech.com.py',{method:'POST',headers:{Accept:'application/json'},body:new FormData(form)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.success===false)throw new Error('send failed');
      form.reset();status.textContent='Enviado.';
    }catch(_){status.textContent='No se pudo enviar. Revisá la activación del formulario o intentá de nuevo.'}
    finally{submit.disabled=false}
  });
});
</script>
'''
if "formsubmit.co/ajax/nicolaspintos@ufotech.com.py" not in s:
    s = s.replace('</body>', js + '\n</body>', 1)

p.write_text(s, encoding='utf-8')
