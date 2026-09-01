const UFOTECH_NODES = {
  core: {
    label: 'ufotech core',
    kicker: 'Plataforma operativa',
    summary: 'Núcleo común que conecta operación técnica, comercial, soporte, publicación y control bajo una misma arquitectura.',
    capabilities: ['31 blueprints registrados', 'múltiples portales y roles', 'configuración central', 'eventos auditados'],
    related: ['web','shop','support','resellers','inventory','customers','finance','publishing','control','sync']
  },
  web: {
    label: 'Web pública',
    kicker: 'Presencia y entrada',
    summary: 'La presencia pública funciona como puerta de entrada a las áreas comerciales y de servicio de ufotech.',
    capabilities: ['sitio corporativo', 'empresas', 'shop', 'soporte', 'revendedores'],
    related: ['core','shop','support','resellers']
  },
  shop: {
    label: 'Shop',
    kicker: 'Catálogo público',
    summary: 'Publicación comercial con catálogo, detalle de producto, imágenes, diseño administrable y visibilidad independiente por canal.',
    capabilities: ['catálogo y detalle', 'múltiples fotos', 'SEO y contenido comercial', 'visibilidad shop / revendedores', 'modo mantenimiento'],
    related: ['core','web','inventory','publishing','resellers']
  },
  support: {
    label: 'Soporte',
    kicker: 'Operación de casos',
    summary: 'Entorno de soporte para particulares y empresas con expertos, tickets, mensajería, archivos, recursos y administración.',
    capabilities: ['usuarios y empresas', 'expertos y asignación', 'tickets y estados', 'mensajes y adjuntos', 'recursos y conocimiento', 'auditoría de soporte'],
    related: ['core','web','customers','control']
  },
  resellers: {
    label: 'Revendedores',
    kicker: 'Canal comercial',
    summary: 'Portal comercial separado con identidad propia, pricing por revendedor y herramientas para cotizar, comprar y buscar equipos.',
    capabilities: ['invitaciones y activación', 'precios personalizados', 'presupuestos con snapshot', 'pedidos y compras', 'Buscame un equipo + eventos', 'oportunidades y enlaces a clientes'],
    related: ['core','web','shop','inventory','customers','publishing']
  },
  inventory: {
    label: 'Equipos',
    kicker: 'Inventario físico',
    summary: 'Cada unidad conserva identidad, estado operativo, condición comercial y relaciones con testeo, taller, venta, garantía y publicación.',
    capabilities: ['inventario por unidad', 'estado operativo / comercial', 'QR y etiquetas', 'tokens de venta', 'incidencias', 'ciclo de vida'],
    related: ['core','shop','resellers','workshop','warranty','publishing','finance']
  },
  workshop: {
    label: 'Testeo + Taller',
    kicker: 'Operación técnica',
    summary: 'Diagnóstico de hardware y flujo de taller con órdenes, incidencias, componentes y trazabilidad de movimientos.',
    capabilities: ['CPU / RAM / discos / GPU', 'salud de batería y disco', 'estado de periféricos', 'órdenes de taller', 'componentes reutilizables', 'movimientos y cierre por testeo'],
    related: ['inventory','warranty','control']
  },
  customers: {
    label: 'Clientes + Empresas',
    kicker: 'Relaciones comerciales',
    summary: 'Personas y empresas se modelan por separado y pueden vincularse, manteniendo consultas, seguimientos y condiciones comerciales.',
    capabilities: ['fichas personales', 'fichas de empresas', 'relaciones persona-empresa', 'consultas y seguimiento', 'precios especiales'],
    related: ['core','support','resellers','finance']
  },
  finance: {
    label: 'Ventas + Finanzas',
    kicker: 'Cobro y seguimiento',
    summary: 'La venta puede continuar como operación financiera: planes, cuotas, cobros, promesas, gestiones y gastos relacionados.',
    capabilities: ['ventas', 'planes de cobro', 'cuotas y reprogramación', 'cobros aplicados', 'promesas de pago', 'gestiones de cobranza', 'gastos'],
    related: ['core','inventory','customers','control']
  },
  publishing: {
    label: 'Publicación',
    kicker: 'Catálogo y salida',
    summary: 'Convierte inventario y catálogo en material comercial y publicaciones, manteniendo relación con canales y estado del producto.',
    capabilities: ['catálogo de proveedores', 'listas públicas', 'PDF / Excel', 'publicaciones por canal', 'alertas de retiro', 'fotos y contenido'],
    related: ['core','shop','resellers','inventory','web']
  },
  warranty: {
    label: 'Garantías + Tags',
    kicker: 'Identidad posventa',
    summary: 'La unidad física puede vincularse a etiquetas preimpresas y a una garantía pública consultable mediante token.',
    capabilities: ['garantía pública', 'tokens de acceso', 'tags por activo', 'lotes de etiquetas', 'orden de imprenta reproducible'],
    related: ['inventory','workshop','control']
  },
  control: {
    label: 'Control',
    kicker: 'Identidad y auditoría',
    summary: 'Permisos, sesiones y auditoría atraviesan el sistema para separar funciones administrativas, colaborativas y públicas.',
    capabilities: ['roles y módulos', 'permisos por colaborador', 'cierre de sesiones', 'registro antes / después', 'IP, ruta y resultado', 'accesos denegados auditados'],
    related: ['core','support','finance','workshop','sync']
  },
  sync: {
    label: 'Datos + Sync',
    kicker: 'Persistencia híbrida',
    summary: 'El sistema puede trabajar localmente y sincronizar con Google mediante una cola durable, manteniendo la operación desacoplada del proveedor remoto.',
    capabilities: ['store local', 'Google Sheets', 'Google Drive', 'Apps Script', 'cola durable', 'backups', 'audited store'],
    related: ['core','control','publishing','inventory']
  }
};

const EDGES = [
  ['core','web'],['core','shop'],['core','support'],['core','resellers'],
  ['core','inventory'],['core','customers'],['core','finance'],['core','publishing'],['core','control'],['core','sync'],
  ['web','shop'],['web','support'],['web','resellers'],
  ['shop','inventory'],['shop','publishing'],['shop','resellers'],
  ['support','customers'],['support','control'],
  ['resellers','inventory'],['resellers','customers'],['resellers','publishing'],
  ['inventory','workshop'],['inventory','warranty'],['inventory','publishing'],['inventory','finance'],
  ['workshop','warranty'],['workshop','control'],
  ['customers','finance'],['finance','control'],
  ['publishing','sync'],['warranty','control'],['control','sync']
];

const POS = {
  web:[145,75], shop:[340,70], support:[560,70], resellers:[765,75],
  control:[315,205], sync:[600,205], core:[455,292],
  inventory:[155,315], workshop:[150,485], customers:[350,500], finance:[530,505],
  publishing:[765,475], warranty:[785,300]
};

function esc(value){
  return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

class UfotechArchitecture extends HTMLElement {
  constructor(){
    super();
    this.attachShadow({mode:'open'});
    this.active='core';
  }

  connectedCallback(){
    this.render();
    this.bind();
    this.select('core', false);
  }

  render(){
    const lines=EDGES.map(([a,b],i)=>{
      const [x1,y1]=POS[a], [x2,y2]=POS[b];
      return `<line data-edge="${a}:${b}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }).join('');
    const nodes=Object.entries(UFOTECH_NODES).map(([id,node])=>{
      const [x,y]=POS[id];
      return `<button class="node ${id==='core'?'core-node':''}" data-node="${id}" style="--x:${x/9}%;--y:${y/5.7}%" type="button"><span>${esc(node.label)}</span><small>${esc(node.kicker)}</small></button>`;
    }).join('');

    this.shadowRoot.innerHTML=`
      <style>
        :host{display:block;color:var(--ink,#edf1ec);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
        *{box-sizing:border-box}button{font:inherit}
        .wrap{border:1px solid var(--line2,#2b332d);border-radius:18px;background:linear-gradient(155deg,var(--panel,#0d110f),var(--bg,#070908));overflow:hidden}
        .hero{display:grid;grid-template-columns:1.2fr .8fr;min-height:230px;border-bottom:1px solid var(--line2,#2b332d)}
        .hero-copy{padding:30px 32px}.eyebrow,.mono{font:600 9px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.13em;text-transform:uppercase}.eyebrow{color:var(--amber,#bda87b)}
        h2{font-size:clamp(42px,6vw,76px);line-height:.9;letter-spacing:-.065em;font-weight:590;margin:22px 0 18px}h2 span{color:var(--muted,#858e88)}
        .hero p{margin:0;color:var(--muted,#858e88);font-size:14px;line-height:1.65;max-width:760px}
        .author{display:flex;flex-direction:column;justify-content:space-between;padding:30px;border-left:1px solid var(--line2,#2b332d);background:rgba(255,255,255,.012)}
        .author strong{font-size:22px;font-weight:560;letter-spacing:-.035em}.author p{font-size:12px;margin:8px 0 0}.status{display:flex;gap:7px;flex-wrap:wrap}.pill{border:1px solid var(--line2,#2b332d);border-radius:999px;padding:7px 9px;color:var(--muted,#858e88);font:600 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}.pill.live{color:var(--ink,#edf1ec);border-color:#536057}
        .explorer{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr)}
        .map-shell{padding:24px;border-right:1px solid var(--line2,#2b332d)}.map-head{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:14px}.map-head span:first-child{color:var(--muted,#858e88)}.map-head span:last-child{color:var(--dim,#5e6862)}
        .map{position:relative;min-height:590px;border:1px solid var(--line2,#2b332d);border-radius:14px;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(120,145,126,.09),transparent 35%),linear-gradient(180deg,rgba(255,255,255,.012),transparent)}
        .map:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:34px 34px;mask-image:radial-gradient(circle at 50% 45%,#000,transparent 82%)}
        svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}line{stroke:#465249;stroke-width:1;opacity:.23;transition:opacity .22s,stroke .22s,stroke-width .22s}line.hot{opacity:.8;stroke:#93a696;stroke-width:1.5}line.dim{opacity:.06}
        .node{position:absolute;left:var(--x);top:var(--y);transform:translate(-50%,-50%);z-index:3;min-width:126px;max-width:150px;padding:11px 12px;border:1px solid #364039;border-radius:10px;background:rgba(11,15,12,.94);color:#aeb8b0;text-align:left;cursor:pointer;transition:.2s;box-shadow:0 14px 36px rgba(0,0,0,.12)}
        .node span{display:block;font-size:12px;font-weight:650;letter-spacing:-.02em}.node small{display:block;margin-top:5px;color:#59665d;font:600 7px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;text-transform:uppercase}.node:hover{border-color:#68766c;transform:translate(-50%,-52%)}.node.active{border-color:#9aab9d;color:#f0f3ef;box-shadow:0 0 0 4px rgba(143,164,147,.06),0 18px 44px rgba(0,0,0,.18)}.node.related{border-color:#536058}.node.dim{opacity:.34}.core-node{min-width:145px;padding:15px 14px;background:#e8ece7;color:#0b0e0c;border-color:#e8ece7}.core-node small{color:#526057}.core-node.active{color:#0b0e0c;border-color:#fff}
        .detail{padding:28px;display:flex;flex-direction:column;min-height:680px}.detail-top{border-bottom:1px solid var(--line2,#2b332d);padding-bottom:23px}.detail-kicker{color:var(--amber,#bda87b)}.detail h3{font-size:34px;line-height:.95;letter-spacing:-.05em;font-weight:570;margin:12px 0}.detail-summary{color:var(--muted,#858e88);font-size:13px;line-height:1.62;margin:0}.cap-title{color:var(--dim,#5e6862);margin:24px 0 10px}.caps{display:grid}.cap{padding:10px 0;border-bottom:1px solid var(--line2,#2b332d);color:#a4aea6;font-size:12px;display:flex;gap:9px}.cap:before{content:"";width:5px;height:5px;border-radius:50%;background:#778a7b;margin-top:6px;flex:0 0 auto}.relations{display:flex;gap:6px;flex-wrap:wrap}.relation{appearance:none;border:1px solid var(--line2,#2b332d);border-radius:999px;background:transparent;color:#7f8b82;padding:7px 9px;cursor:pointer;font:600 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}.relation:hover{color:var(--ink,#edf1ec);border-color:#5e6b61}
        .stack{margin-top:auto;padding-top:28px}.stack-flow{display:grid;gap:1px;border:1px solid var(--line2,#2b332d);background:var(--line2,#2b332d)}.stack-flow div{padding:10px 11px;background:var(--panel,#0d110f);display:flex;justify-content:space-between;gap:10px}.stack-flow span:first-child{color:#69756d}.stack-flow span:last-child{color:#9ca69f;text-align:right}
        .scope{border-top:1px solid var(--line2,#2b332d);padding:20px 24px;display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--line2,#2b332d)}.scope div{background:var(--panel,#0d110f);padding:15px 13px;min-height:86px}.scope b{display:block;font-size:11px;font-weight:620}.scope span{display:block;color:#667269;font-size:9px;line-height:1.4;margin-top:7px}
        .foot{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:16px 24px;border-top:1px solid var(--line2,#2b332d);color:var(--dim,#5e6862)}.foot strong{color:#8f9a92;font-weight:540}.foot a{color:#9da8a0;text-decoration:none}.foot a:hover{color:var(--ink,#edf1ec)}
        @media(max-width:980px){.hero,.explorer{grid-template-columns:1fr}.author,.map-shell{border-left:0;border-right:0;border-top:1px solid var(--line2,#2b332d)}.detail{min-height:0}.scope{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:680px){.hero-copy,.author,.detail{padding:22px}.map-shell{padding:14px}.map{min-height:760px}.map-head{align-items:flex-start;flex-direction:column}.node{min-width:104px;max-width:118px;padding:9px}.node span{font-size:10px}.core-node{min-width:120px}.scope{grid-template-columns:repeat(2,1fr)}.foot{align-items:flex-start;flex-direction:column}.map svg{display:none}
          .node[data-node="web"]{--x:22%!important;--y:9%!important}.node[data-node="shop"]{--x:70%!important;--y:9%!important}.node[data-node="support"]{--x:22%!important;--y:22%!important}.node[data-node="resellers"]{--x:70%!important;--y:22%!important}.node[data-node="control"]{--x:22%!important;--y:36%!important}.node[data-node="sync"]{--x:70%!important;--y:36%!important}.node[data-node="core"]{--x:46%!important;--y:50%!important}.node[data-node="inventory"]{--x:22%!important;--y:64%!important}.node[data-node="workshop"]{--x:70%!important;--y:64%!important}.node[data-node="customers"]{--x:22%!important;--y:78%!important}.node[data-node="finance"]{--x:70%!important;--y:78%!important}.node[data-node="publishing"]{--x:22%!important;--y:92%!important}.node[data-node="warranty"]{--x:70%!important;--y:92%!important}}
      </style>
      <section class="wrap">
        <div class="hero">
          <div class="hero-copy">
            <div class="eyebrow">ufotech · operational platform</div>
            <h2>Una empresa.<br><span>Un sistema.</span></h2>
            <p>Plataforma diseñada y desarrollada por Nicolás Pintos para conectar la operación técnica y comercial de ufotech en una arquitectura común.</p>
          </div>
          <div class="author">
            <div><div class="mono" style="color:var(--dim,#5e6862)">Autoría</div><strong>Nicolás Pintos</strong><p>Arquitectura, desarrollo e integración del sistema.</p></div>
            <div class="status"><span class="pill live">En operación</span><span class="pill">Python · Flask</span><span class="pill">Linux</span><span class="pill">Hybrid storage</span></div>
          </div>
        </div>
        <div class="explorer">
          <div class="map-shell">
            <div class="map-head mono"><span>Mapa de relaciones</span><span>Seleccioná un dominio</span></div>
            <div class="map">
              <svg viewBox="0 0 900 570" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
              ${nodes}
            </div>
          </div>
          <aside class="detail" id="detail"></aside>
        </div>
        <div class="scope">
          <div><b>Web + canales</b><span>sitio · shop · soporte · revendedores</span></div>
          <div><b>Operación técnica</b><span>equipos · testeo · taller · tags</span></div>
          <div><b>Comercial</b><span>clientes · empresas · cotización · ventas</span></div>
          <div><b>Finanzas</b><span>planes · cuotas · cobros · gastos</span></div>
          <div><b>Publicación</b><span>proveedores · listas · canales · alertas</span></div>
          <div><b>Control</b><span>roles · auditoría · sync · backups</span></div>
        </div>
        <div class="foot mono"><span><strong>Arquitectura real</strong> · visualización del alcance, no un dashboard de producción</span><a href="https://ufotech.com.py" target="_blank" rel="noopener">ufotech.com.py ↗</a></div>
      </section>`;
  }

  bind(){
    this.shadowRoot.querySelectorAll('[data-node]').forEach(btn=>btn.addEventListener('click',()=>this.select(btn.dataset.node)));
  }

  select(id, scroll=false){
    if(!UFOTECH_NODES[id]) return;
    this.active=id;
    const node=UFOTECH_NODES[id];
    const related=new Set(node.related || []);
    related.add(id);
    this.shadowRoot.querySelectorAll('[data-node]').forEach(el=>{
      const nid=el.dataset.node;
      el.classList.toggle('active',nid===id);
      el.classList.toggle('related',nid!==id && related.has(nid));
      el.classList.toggle('dim',!related.has(nid));
    });
    this.shadowRoot.querySelectorAll('[data-edge]').forEach(line=>{
      const [a,b]=line.dataset.edge.split(':');
      const hot=a===id || b===id;
      const connected=related.has(a) && related.has(b);
      line.classList.toggle('hot',hot);
      line.classList.toggle('dim',!hot && !connected);
    });
    const relationButtons=(node.related||[]).map(r=>`<button class="relation" data-jump="${r}" type="button">${esc(UFOTECH_NODES[r].label)}</button>`).join('');
    const caps=node.capabilities.map(x=>`<div class="cap">${esc(x)}</div>`).join('');
    this.shadowRoot.getElementById('detail').innerHTML=`
      <div class="detail-top"><div class="detail-kicker mono">${esc(node.kicker)}</div><h3>${esc(node.label)}</h3><p class="detail-summary">${esc(node.summary)}</p></div>
      <div class="cap-title mono">Alcance</div><div class="caps">${caps}</div>
      <div class="cap-title mono">Se relaciona con</div><div class="relations">${relationButtons}</div>
      <div class="stack"><div class="cap-title mono">Stack operativo</div><div class="stack-flow mono"><div><span>Canales</span><span>web · portales · administración</span></div><div><span>Aplicación</span><span>Flask · blueprints · permisos</span></div><div><span>Datos</span><span>local · Sheets · Drive · cola</span></div><div><span>Control</span><span>auditoría · backups · sesiones</span></div><div><span>Servidor</span><span>Linux · systemd · Gunicorn</span></div></div></div>`;
    this.shadowRoot.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>this.select(btn.dataset.jump)));
    if(scroll) this.shadowRoot.getElementById('detail').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}

if(!customElements.get('ufotech-architecture')) customElements.define('ufotech-architecture', UfotechArchitecture);
