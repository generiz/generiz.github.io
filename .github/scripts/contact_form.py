from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

css_start = s.find('.contact-form-region{')
if css_start != -1:
    css_end_marker = '@media(max-width:720px){.contact-form-grid{grid-template-columns:1fr}.contact-field.full{grid-column:auto}.contact-form-shell{padding:20px}.contact-form-head{align-items:center}}\n'
    css_end = s.find(css_end_marker, css_start)
    if css_end == -1:
        raise SystemExit('contact form css end not found')
    css_end += len(css_end_marker)
    s = s[:css_start] + s[css_end:]

form_link = '<a href="#contactFormRegion" id="contactFormOpen"><span>Formulario</span><span id="contactFormGlyph">＋</span></a>'
s = s.replace(form_link, '', 1)

form_start = s.find('<div id="contactFormRegion" class="contact-form-region"')
if form_start != -1:
    form_end = s.find('<div class="security-meta mono">', form_start)
    if form_end == -1:
        raise SystemExit('contact form html end not found')
    s = s[:form_start] + s[form_end:]

js_marker = "const open=document.getElementById('contactFormOpen');"
js_pos = s.find(js_marker)
if js_pos != -1:
    script_start = s.rfind('<script>', 0, js_pos)
    script_end = s.find('</script>', js_pos)
    if script_start == -1 or script_end == -1:
        raise SystemExit('contact form script bounds not found')
    script_end += len('</script>')
    # Preserve the email-copy behavior with a minimal script.
    email_script = '''<script>\ndocument.addEventListener('DOMContentLoaded',()=>{\n  const email='nicolaspintos@ufotech.com.py';\n  const emailCopy=document.getElementById('emailCopy');\n  const emailState=document.getElementById('emailCopyState');\n  if(emailCopy){emailCopy.addEventListener('click',async e=>{e.preventDefault();try{await navigator.clipboard.writeText(email);emailState.textContent='Copiado';setTimeout(()=>emailState.textContent='Copiar',1600)}catch(_){emailState.textContent=email}})}\n});\n</script>'''
    s = s[:script_start] + email_script + s[script_end:]

if 'formsubmit.co' in s or 'contactFormRegion' in s or 'contactFormOpen' in s:
    raise SystemExit('contact form residue remains')
if 'nicolaspintos@ufotech.com.py' not in s:
    raise SystemExit('email contact was accidentally removed')

p.write_text(s, encoding='utf-8')
