class SombraLiveDemo extends HTMLElement {
  constructor(){
    super();
    this.attachShadow({mode:'open'});
    this.seq=0;this.timer=null;this.bundle=null;this.logs=[];
    this.links={short:true,long:true,internet:true,dtn:false};
    this.seed=42;
  }

  connectedCallback(){this.render();this.bind();this.paintLinks();this.updateClock();}

  render(){
    this.shadowRoot.innerHTML=`
    <style>
      :host{display:block;color:#e9eee9;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
      *{box-sizing:border-box}button,input,select{font:inherit}.demo{border:1px solid #2b332d;border-radius:18px;background:linear-gradient(155deg,#0d120f,#080b09);overflow:hidden}
      .top{display:flex;justify-content:space-between;gap:24px;padding:24px 26px;border-bottom:1px solid #273029}.eyebrow,.mono{font:600 9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase}.eyebrow{color:#8da18f}.top h2{font-size:clamp(28px,4vw,50px);line-height:.94;letter-spacing:-.055em;margin:9px 0 8px;font-weight:570}.top p{margin:0;color:#828d85;max-width:760px;line-height:1.55;font-size:13px}.truth{display:flex;gap:7px;flex-wrap:wrap;align-content:flex-start;justify-content:flex-end}.pill{border:1px solid #364139;border-radius:999px;padding:7px 9px;color:#87948a;white-space:nowrap}.pill.real{color:#b4c6b6}.pill.warn{color:#b6a57c}
      .boundary{padding:13px 26px;border-bottom:1px solid #273029;color:#6f7d73;font:500 10px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.boundary b{color:#a4b0a7}
      .grid{display:grid;grid-template-columns:280px minmax(0,1fr) 310px;min-height:570px}.panel{padding:22px;border-right:1px solid #273029}.panel:last-child{border-right:0}.head{display:flex;justify-content:space-between;align-items:center;color:#66736a;margin-bottom:18px}.head span:first-child{color:#a6b3a9}
      .control{margin-bottom:18px}.control label{display:flex;justify-content:space-between;gap:10px;color:#77837a;font:600 9px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;text-transform:uppercase;margin-bottom:8px}.control select,.control input[type=range]{width:100%}.control select{appearance:none;background:#0b0f0c;border:1px solid #313b34;color:#c4cdc6;border-radius:8px;padding:10px 11px}.control input{accent-color:#8da18f}
      .toggles{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0}.toggle{appearance:none;border:1px solid #303a33;background:#0b0f0c;color:#7c887f;border-radius:9px;padding:10px 8px;cursor:pointer;font:600 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;transition:.2s}.toggle.on{border-color:#607064;color:#c3cec5;background:#111813}.toggle.dtn.on{border-color:#756a4f;color:#d0bd8c}.toggle:hover{transform:translateY(-1px)}
      .actions{display:grid;gap:8px}.action{appearance:none;border:1px solid #39433c;background:transparent;color:#aab5ad;border-radius:999px;padding:11px 13px;cursor:pointer;font-size:11px}.action.primary{background:#e6ebe6;color:#080b09;border-color:#e6ebe6}.action:disabled{opacity:.35;cursor:not-allowed}.hint{margin-top:16px;color:#606c64;font-size:10px;line-height:1.55}
      .stage{position:relative;min-height:430px;border:1px solid #263029;border-radius:14px;background:radial-gradient(circle at 50% 45%,rgba(116,143,122,.08),transparent 34%),#090d0a;overflow:hidden}.stage svg{position:absolute;inset:0;width:100%;height:100%}.edge{stroke:#303a33;stroke-width:1.2;stroke-dasharray:4 7;transition:.25s}.edge.on{stroke:#718477}.edge.dtn.on{stroke:#907f58}.node{position:absolute;transform:translate(-50%,-50%);width:84px;padding:10px 8px;text-align:center;border:1px solid #344038;border-radius:10px;background:#0d130f;z-index:2}.node b{display:block;font-size:11px}.node small{display:block;margin-top:4px;color:#67746b;font:600 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.n1{left:12%;top:50%}.n2{left:37%;top:25%}.n3{left:38%;top:75%}.n4{left:64%;top:50%}.n5{left:88%;top:50%}.bundle{position:absolute;z-index:5;width:13px;height:13px;border-radius:50%;background:#c6d2c8;box-shadow:0 0 0 5px rgba(159,184,164,.09),0 0 22px rgba(174,206,182,.35);left:12%;top:50%;transform:translate(-50%,-50%);opacity:0;transition:left .7s ease,top .7s ease,opacity .2s}.bundle.show{opacity:1}.bundle.wait{background:#c7b47f;box-shadow:0 0 0 5px rgba(199,180,127,.08),0 0 22px rgba(199,180,127,.28)}
      .status{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:12px;border:1px solid #263029;border-radius:10px;overflow:hidden;background:#263029}.metric{background:#0b0f0c;padding:10px}.metric span{display:block;color:#59665e;font:600 8px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;text-transform:uppercase}.metric b{display:block;margin-top:5px;font-size:12px;font-weight:560;color:#b7c1ba}
      .scorebox{margin-top:14px;border:1px solid #263029;border-radius:10px;overflow:hidden}.scorehead,.row{display:grid;grid-template-columns:1.2fr .7fr .8fr .8fr;gap:8px;align-items:center;padding:9px 11px}.scorehead{color:#59665e;background:#0a0e0b;font:600 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}.row{border-top:1px solid #202821;color:#818d84;font:500 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}.row.chosen{background:#111713;color:#c2cec4}.row.off{opacity:.35}.row b{font-weight:600;color:inherit}
      .queue{display:grid;gap:9px}.qitem{border:1px solid #29332c;border-radius:10px;padding:12px;background:#0b0f0c}.qtop{display:flex;justify-content:space-between;gap:8px}.qtop b{font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.qstate{font:600 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#b9aa82}.qmeta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px;color:#69756d;font-size:10px}.empty{color:#5c6860;font-size:11px;line-height:1.5;padding:12px 0}.log{margin-top:16px;border-top:1px solid #273029;padding-top:13px;display:grid;gap:7px;max-height:240px;overflow:auto}.logline{display:grid;grid-template-columns:42px 1fr;gap:8px;color:#707c73;font:500 9px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.logline time{color:#4f5c53}.logline strong{color:#aab6ac;font-weight:600}
      .footer{padding:13px 22px;border-top:1px solid #273029;color:#5f6d63;font:500 9px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.footer b{color:#8f9c92}
      @media(max-width:1050px){.grid{grid-template-columns:1fr}.panel{border-right:0;border-bottom:1px solid #273029}.panel:last-child{border-bottom:0}.stage{min-height:390px}}@media(max-width:620px){.top{display:grid;padding:20px}.truth{justify-content:flex-start}.boundary{padding:12px 20px}.panel{padding:18px}.status{grid-template-columns:1fr 1fr}.node{width:70px}.scorehead,.row{grid-template-columns:1.1fr .7fr .8fr}.scorehead span:nth-child(4),.row span:nth-child(4){display:none}}
    </style>
    <div class="demo">
      <div class="top"><div><div class="eyebrow">Sombra · resilience demonstrator</div><h2>El transporte puede desaparecer.</h2><p>El bundle queda en cola, conserva prioridad y TTL, y vuelve a intentar cuando aparece un camino utilizable.</p></div><div class="truth"><span class="pill real mono">REAL MODEL · policy + queue</span><span class="pill warn mono">SIMULADO · nodos + enlaces</span></div></div>
      <div class="boundary"><b>Frontera:</b> esta visualización reproduce el scoring actual de RoutingPolicy y el comportamiento de cola/retry de Sombra v0.2. Los nodos, radios y tiempos son simulados. v0.2 todavía no implementa envelopes autenticados ni cifrado de la cola.</div>
      <div class="grid">
        <section class="panel controls"><div class="head mono"><span>01 / CONDICIONES</span><span id="clock">T+00</span></div>
          <div class="control"><label><span>Prioridad</span><span id="priorityLabel">IMPORTANT</span></label><select id="priority"><option value="routine">Routine</option><option value="important" selected>Important</option><option value="urgent">Urgent</option></select></div>
          <div class="control"><label><span>TTL</span><span id="ttlLabel">45 s</span></label><input id="ttl" type="range" min="15" max="120" step="5" value="45"></div>
          <div class="toggles"><button class="toggle on" data-link="short">Corto · ON</button><button class="toggle on" data-link="long">Largo · ON</button><button class="toggle on" data-link="internet">Internet · ON</button><button class="toggle dtn" data-link="dtn">Ventana DTN · OFF</button></div>
          <div class="actions"><button id="send" class="action primary">Enviar bundle</button><button id="retry" class="action" disabled>Procesar cola ahora</button><button id="outage" class="action">Corte total inmediato</button><button id="restore" class="action">Restablecer caminos</button></div>
          <div class="hint">Probá “Corte total inmediato”, enviá un bundle y después abrí sólo “Ventana DTN”. Ahí se ve store-and-forward.</div>
        </section>
        <section class="panel"><div class="head mono"><span>02 / TOPOLOGÍA</span><span id="decision">IDLE</span></div>
          <div class="stage" id="stage">
            <svg viewBox="0 0 700 430" preserveAspectRatio="none"><path id="eShort" class="edge short" d="M84 215 C155 115 205 105 259 108"/><path id="eLong" class="edge long" d="M259 108 C360 130 380 192 448 215"/><path id="eInternet" class="edge internet" d="M448 215 C530 190 570 210 616 215"/><path id="eDtn" class="edge dtn" d="M84 215 C180 345 300 345 448 215"/></svg>
            <div class="node n1"><b>ORIGEN</b><small>local queue</small></div><div class="node n2"><b>RELAY A</b><small>short range</small></div><div class="node n3"><b>CARRY</b><small>DTN</small></div><div class="node n4"><b>BRIDGE</b><small>multi-link</small></div><div class="node n5"><b>DESTINO</b><small>delivery</small></div><div id="bundleDot" class="bundle"></div>
          </div>
          <div class="status"><div class="metric"><span>Bundle</span><b id="bundleId">—</b></div><div class="metric"><span>Estado</span><b id="state">esperando</b></div><div class="metric"><span>Intentos</span><b id="attempts">0</b></div><div class="metric"><span>TTL restante</span><b id="remaining">—</b></div></div>
          <div class="scorebox"><div class="scorehead"><span>Transporte</span><span>Score</span><span>Entrega</span><span>Latencia</span></div><div id="scores"></div></div>
        </section>
        <section class="panel"><div class="head mono"><span>03 / COLA</span><span>STORE + FORWARD</span></div><div id="queue" class="queue"><div class="empty">No hay bundles pendientes.</div></div><div id="log" class="log"></div></section>
      </div>
      <div class="footer"><b>Modelo:</b> delivery 0.30 · congestion 0.24 · energy 0.16 · latency 0.14 · metadata 0.16. Retry inicial 2 s; el proyecto real limita el backoff hasta 5 min.</div>
    </div>`;
  }

  bind(){
    const $=id=>this.shadowRoot.getElementById(id);this.$=$;
    $('priority').addEventListener('change',()=>{$('priorityLabel').textContent=$('priority').value.toUpperCase();this.refreshScores();});
    $('ttl').addEventListener('input',()=>{$('ttlLabel').textContent=`${$('ttl').value} s`;});
    this.shadowRoot.querySelectorAll('[data-link]').forEach(btn=>btn.addEventListener('click',()=>this.toggle(btn.dataset.link)));
    $('send').addEventListener('click',()=>this.send());$('retry').addEventListener('click',()=>this.attempt(true));
    $('outage').addEventListener('click',()=>{Object.keys(this.links).forEach(k=>this.links[k]=false);this.paintLinks();this.log('network','todos los caminos inmediatos quedaron fuera');this.attempt(true);});
    $('restore').addEventListener('click',()=>{this.links.short=this.links.long=this.links.internet=true;this.links.dtn=false;this.paintLinks();this.log('network','short, long e internet restablecidos');this.attempt(true);});
  }

  toggle(name){this.links[name]=!this.links[name];this.paintLinks();this.log('link',`${name} ${this.links[name]?'disponible':'no disponible'}`);if(this.bundle&&this.bundle.state==='queued')this.attempt(true);else this.refreshScores();}
  paintLinks(){
    const map={short:'eShort',long:'eLong',internet:'eInternet',dtn:'eDtn'};
    Object.entries(map).forEach(([k,id])=>this.$?.(id)?.classList.toggle('on',this.links[k]));
    this.shadowRoot?.querySelectorAll('[data-link]').forEach(btn=>{const k=btn.dataset.link;btn.classList.toggle('on',this.links[k]);btn.textContent=`${k==='short'?'Corto':k==='long'?'Largo':k==='internet'?'Internet':'Ventana DTN'} · ${this.links[k]?'ON':'OFF'}`;});
    if(this.$)this.refreshScores();
  }

  rng(){let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
  range(a,b){return a+(b-a)*this.rng();}
  metrics(){
    return [
      {name:'short',label:'Short range',available:this.links.short,congestion:this.range(.10,.85),energy:this.range(.10,.35),latency:Math.round(this.range(40,350)),delivery:this.links.short?this.range(.72,.97):0,metadata:this.range(.20,.55)},
      {name:'long',label:'Long range',available:this.links.long,congestion:this.range(.05,.60),energy:this.range(.35,.70),latency:Math.round(this.range(350,2500)),delivery:this.links.long?this.range(.68,.94):0,metadata:this.range(.20,.50)},
      {name:'dtn',label:'Delay tolerant',available:this.links.dtn,congestion:this.range(0,.25),energy:this.range(.05,.25),latency:Math.round(this.range(30000,900000)),delivery:this.links.dtn?this.range(.75,.98):0,metadata:this.range(.10,.35)},
      {name:'internet',label:'Internet',available:this.links.internet,congestion:this.range(.05,.90),energy:this.range(.10,.30),latency:Math.round(this.range(30,220)),delivery:this.links.internet?this.range(.88,.995):0,metadata:this.range(.55,.90)}
    ];
  }
  score(link,priority){const scale=priority==='routine'?60000:priority==='important'?15000:4000;const lp=Math.max(0,Math.min(1,link.latency/scale));return link.delivery*.30-link.congestion*.24-link.energy*.16-lp*.14-link.metadata*.16;}
  choose(){const priority=this.$('priority').value;const links=this.metrics();links.forEach(l=>l.score=this.score(l,priority));const available=links.filter(l=>l.available);const chosen=available.sort((a,b)=>b.score-a.score)[0]||null;return{links,chosen};}
  refreshScores(result){if(!this.$)return;const r=result||this.choose();this.lastScores=r;const host=this.$('scores');host.replaceChildren();r.links.forEach(l=>{const row=document.createElement('div');row.className=`row ${!l.available?'off':''} ${r.chosen?.name===l.name?'chosen':''}`;row.innerHTML=`<b>${l.label}</b><span>${l.available?l.score.toFixed(3):'OFF'}</span><span>${Math.round(l.delivery*100)}%</span><span>${l.latency<1000?`${l.latency} ms`:`${(l.latency/1000).toFixed(1)} s`}</span>`;host.append(row);});this.$('decision').textContent=r.chosen?r.chosen.label.toUpperCase():'NO PATH';}

  send(){
    clearTimeout(this.timer);this.seq+=1;const now=Date.now();this.bundle={id:`B${String(this.seq).padStart(3,'0')}-${Math.floor(this.rng()*0xffff).toString(16).padStart(4,'0')}`,created:now,expires:now+Number(this.$('ttl').value)*1000,priority:this.$('priority').value,attempts:0,state:'created',nextRetry:now};
    this.$('bundleId').textContent=this.bundle.id;this.$('attempts').textContent='0';this.log('bundle',`${this.bundle.id} creado · ${this.bundle.priority} · TTL ${this.$('ttl').value}s`);this.renderQueue();this.place('origin');this.attempt(true);
  }

  attempt(force=false){
    const b=this.bundle;if(!b||b.state==='delivered'||b.state==='expired')return;const now=Date.now();if(now>=b.expires){this.expire();return;}if(!force&&now<b.nextRetry)return;
    clearTimeout(this.timer);b.attempts+=1;this.$('attempts').textContent=String(b.attempts);const r=this.choose();this.refreshScores(r);
    if(!r.chosen){this.queue('sin transporte disponible');return;}
    const c=r.chosen;b.state='forwarding';this.updateState(`via ${c.name}`);this.log('route',`${c.label} elegido · score ${c.score.toFixed(3)}`);this.animate(c).then(()=>{
      if(!this.bundle||this.bundle.id!==b.id)return;const success=this.rng()<=c.delivery;if(success){this.deliver(c);}else{this.log('retry',`${c.label} falló la entrega`);this.queue('entrega fallida');}
    });
  }

  queue(reason){const b=this.bundle;if(!b)return;b.state='queued';const delay=Math.min(300000,2000*Math.pow(2,Math.max(0,b.attempts-1)));b.nextRetry=Date.now()+delay;this.updateState('en cola');this.place('origin',true);this.log('queue',`${reason} · retry en ${Math.round(delay/1000)}s`);this.renderQueue();this.$('retry').disabled=false;this.timer=setTimeout(()=>this.attempt(false),delay);}
  deliver(link){const b=this.bundle;b.state='delivered';clearTimeout(this.timer);this.place('dest');this.updateState('entregado');this.$('retry').disabled=true;this.log('delivered',`${b.id} entregado por ${link.label}`);this.renderQueue();}
  expire(){const b=this.bundle;if(!b)return;b.state='expired';clearTimeout(this.timer);this.updateState('TTL expirado');this.place('origin',true);this.$('retry').disabled=true;this.log('expired',`${b.id} expiró antes de encontrar entrega`);this.renderQueue();}

  animate(link){
    const dot=this.$('bundleDot');dot.classList.add('show');dot.classList.remove('wait');this.place('origin');
    const steps=link.name==='short'?[['relay',550],['bridge',550],['dest',550]]:link.name==='long'?[['relay',450],['bridge',800],['dest',450]]:link.name==='internet'?[['bridge',500],['dest',500]]:[['carry',850],['bridge',1100],['dest',700]];
    return steps.reduce((p,[pos,ms])=>p.then(()=>new Promise(res=>setTimeout(()=>{this.place(pos);res();},ms))),Promise.resolve());
  }
  place(pos,wait=false){if(!this.$)return;const map={origin:[12,50],relay:[37,25],carry:[38,75],bridge:[64,50],dest:[88,50]};const [l,t]=map[pos];const d=this.$('bundleDot');d.style.left=`${l}%`;d.style.top=`${t}%`;d.classList.add('show');d.classList.toggle('wait',wait);}
  updateState(text){this.$('state').textContent=text;this.renderQueue();}
  renderQueue(){if(!this.$)return;const host=this.$('queue');host.replaceChildren();const b=this.bundle;if(!b||b.state==='delivered'){const e=document.createElement('div');e.className='empty';e.textContent=b?'Cola vacía. El último bundle fue entregado.':'No hay bundles pendientes.';host.append(e);return;}const q=document.createElement('div');q.className='qitem';q.innerHTML=`<div class="qtop"><b>${b.id}</b><span class="qstate">${b.state}</span></div><div class="qmeta"><span>${b.priority}</span><span>${b.attempts} intento${b.attempts===1?'':'s'}</span></div>`;host.append(q);}
  log(type,text){if(!this.$)return;const sec=Math.max(0,Math.floor((Date.now()-(this.started||Date.now()))/1000));if(!this.started)this.started=Date.now();this.logs.unshift({sec,type,text});this.logs=this.logs.slice(0,18);const host=this.$('log');host.replaceChildren();this.logs.forEach(x=>{const el=document.createElement('div');el.className='logline';el.innerHTML=`<time>T+${String(x.sec).padStart(2,'0')}</time><span><strong>${x.type}</strong> · ${x.text}</span>`;host.append(el);});}
  updateClock(){if(!this.isConnected)return;const now=Date.now();const sec=this.started?Math.floor((now-this.started)/1000):0;this.$('clock').textContent=`T+${String(sec).padStart(2,'0')}`;const b=this.bundle;if(b&&b.state!=='delivered'&&b.state!=='expired'){const rem=Math.max(0,Math.ceil((b.expires-now)/1000));this.$('remaining').textContent=`${rem}s`;if(rem<=0)this.expire();}else if(b?.state==='delivered')this.$('remaining').textContent='done';else this.$('remaining').textContent='—';requestAnimationFrame(()=>setTimeout(()=>this.updateClock(),250));}
}
customElements.define('sombra-live-demo',SombraLiveDemo);

function integrateHome(){
  const grid=document.querySelector('.systems-grid');if(!grid)return;
  const card=[...grid.querySelectorAll('.system-card')].find(c=>c.querySelector('h3')?.textContent.trim().toLowerCase()==='sombra');if(!card||document.getElementById('sombraInline'))return;
  const tagline=card.querySelector('.tagline');const badge=tagline?.querySelector('.badge');
  const wrap=document.createElement('div');wrap.className='sombra-card-actions';
  const btn=document.createElement('button');btn.type='button';btn.className='sombra-open';btn.textContent='Abrir demo';
  if(badge){badge.replaceWith(wrap);wrap.append(badge,btn);}else tagline?.append(btn);
  const region=document.createElement('div');region.id='sombraInline';region.className='sombra-inline-region';region.innerHTML='<div class="sombra-inline-head"><div><b>Sombra · interactive resilience demo</b><small>Simulación basada en el modelo v0.2</small></div><button type="button">Cerrar</button></div><sombra-live-demo></sombra-live-demo>';
  grid.insertAdjacentElement('afterend',region);
  const css=document.createElement('style');css.textContent=`.sombra-card-actions{display:flex;align-items:center;gap:8px}.sombra-open{appearance:none;border:1px solid #4a564d;background:transparent;color:#abb7ae;border-radius:999px;padding:7px 10px;cursor:pointer;font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;text-transform:uppercase}.sombra-open:hover{border-color:#7b8a7e;color:#fff}.sombra-inline-region{display:none;margin-top:18px}.sombra-inline-region.open{display:block}.sombra-inline-head{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:12px}.sombra-inline-head>div{display:grid;gap:4px}.sombra-inline-head b{font-size:13px}.sombra-inline-head small{color:#667169;font:600 9px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}.sombra-inline-head button{appearance:none;border:1px solid #374039;background:transparent;color:#9ca79f;padding:9px 13px;border-radius:999px;cursor:pointer;font:600 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase}@media(max-width:720px){.sombra-card-actions{gap:5px}.sombra-open{padding:7px 8px}.sombra-inline-head{align-items:flex-start}}`;
  document.head.append(css);
  btn.addEventListener('click',()=>{region.classList.add('open');region.scrollIntoView({behavior:'smooth',block:'start'});});region.querySelector('.sombra-inline-head button').addEventListener('click',()=>{region.classList.remove('open');card.scrollIntoView({behavior:'smooth',block:'center'});});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',integrateHome);else integrateHome();
