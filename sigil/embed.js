class SigilInlineDemo extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.message = [72, 79, 76, 65];
    this.failedNodes = new Set();
    this.assignments = [];
    this.session = null;
    this.baseResult = null;
    this.currentResult = null;
    this.previousDigest = null;
    this.module = null;
    this.ready = false;
    this.timer = null;
    this.playback = 0;
  }

  connectedCallback() {
    this.render();
    this.bind();
    this.renderComposer();
  }

  disconnectedCallback() {
    if (this.session?.free) this.session.free();
    clearTimeout(this.timer);
    this.playback += 1;
  }

  async activate() {
    if (this.ready) return;
    const status = this.$('runtime');
    status.textContent = 'cargando Rust/WASM…';
    try {
      const url = new URL('./pkg/sigil_core.js', import.meta.url);
      this.module = await import(url.href);
      await this.module.default();
      this.ready = true;
      status.textContent = `Rust/WASM real · v${this.module.sigil_demo_version()}`;
      status.classList.add('ok');
      await this.newSession(true);
    } catch (error) {
      console.error(error);
      status.textContent = 'WASM no pudo inicializar';
      status.classList.add('bad');
      this.$('receiverState').textContent = String(error);
    }
  }

  $(id) { return this.shadowRoot.getElementById(id); }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;color:#edf1ec;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;--bg:#070908;--panel:#0c100e;--panel2:#101512;--line:#283029;--muted:#7e8981;--dim:#59645d;--green:#86a08b;--amber:#b39c70;--danger:#9a6b63}
        *{box-sizing:border-box}button,input{font:inherit}.wrap{border:1px solid var(--line);border-radius:20px;overflow:hidden;background:radial-gradient(circle at 50% 20%,rgba(125,149,130,.08),transparent 32%),#080b09;box-shadow:0 30px 90px rgba(0,0,0,.22)}
        .head{min-height:58px;padding:13px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{display:flex;align-items:center;gap:10px;font-weight:680;font-size:13px}.dot{width:8px;height:8px;border-radius:50%;border:1px solid var(--green);box-shadow:0 0 0 4px rgba(134,160,139,.08)}.runtime{color:#69756c;font:600 9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.11em}.runtime.ok{color:#95a99a}.runtime.bad{color:#b77a72}
        .truth{padding:10px 18px;border-bottom:1px solid var(--line);display:flex;gap:22px;flex-wrap:wrap;color:#657168;font:600 8px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.09em}.truth b{color:#a9b5ac;margin-right:7px}.truth .sim b{color:#b39c70}
        .grid{display:grid;grid-template-columns:minmax(260px,.82fr) minmax(430px,1.36fr) minmax(230px,.72fr)}.pane{min-width:0;background:linear-gradient(160deg,#0d110f,#090c0a)}.composer{border-right:1px solid var(--line)}.receiver{border-left:1px solid var(--line)}.pane-head{height:48px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;padding:0 16px;color:#7b877f;font:650 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase}.pane-head span{color:#4f5a53}.body{padding:17px}.label{color:#58635c;font:650 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase;margin-bottom:9px}.secure-display{min-height:94px;border:1px solid #354038;border-radius:12px;background:#070a08;padding:13px;display:flex;gap:6px;align-content:flex-start;align-items:flex-start;flex-wrap:wrap;user-select:none;-webkit-user-select:none}.glyph{min-width:24px;height:29px;padding:0 5px;border:1px solid #303a33;border-radius:6px;display:grid;place-items:center;background:#0d120f;color:#dce3dd;font:650 14px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.empty{color:#536058;font:600 9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.meta{display:flex;justify-content:space-between;margin-top:8px;color:#536058;font:550 8px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace}
        .keyboard{margin-top:15px;display:grid;gap:6px;touch-action:manipulation}.keyrow{display:flex;gap:5px;justify-content:center}.key{appearance:none;min-width:28px;min-height:37px;padding:0 7px;border:1px solid #354038;border-radius:8px;background:#0c110e;color:#aab6ad;cursor:pointer;font:650 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;touch-action:manipulation;user-select:none}.key:hover,.key:active{background:#151c17;border-color:#59665d;color:#fff}.key.wide{min-width:68px}.key.space{flex:1;max-width:190px}.keyboard-note{margin-top:10px;color:#59645d;font-size:9px;line-height:1.45}
        .controls{border-top:1px solid var(--line);padding:13px 17px;display:grid;gap:10px}.range{display:grid;grid-template-columns:1fr 60px;gap:7px;align-items:center}.range span{color:#667169;font:600 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em}.range input{width:100%;accent-color:#849b88}.range b{text-align:right;color:#acb7af;font-size:13px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.action{border:1px solid #3a453d;border-radius:999px;background:#0c110e;color:#9aa69d;padding:10px 11px;cursor:pointer;font-size:9px}.action.primary{background:#e6ebe6;color:#080a09;border-color:#e6ebe6;font-weight:700}.action:disabled{opacity:.35;cursor:default}
        .guide{border-bottom:1px solid var(--line);padding:14px 17px;background:#080c09;display:grid;gap:9px}.guide-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.guide-head b,.guide-head span{font:650 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}.guide-head b{color:#9aab9e}.guide-head span{color:#617067}.guide-copy strong{display:block;color:#d9e0da;font-size:12px;margin-bottom:5px}.guide-copy p{margin:0;color:#78857c;font-size:10px;line-height:1.55;max-width:680px}.guide-progress{height:2px;background:#1e2721;overflow:hidden;border-radius:2px}.guide-progress i{display:block;width:0;height:100%;background:#8da292;transition:width .25s ease}.guide-note{color:#566159;font:550 7px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.guide-note b{color:#7f9084}
        .pipeline{background:#090c0a}.stages{padding:17px;display:grid;gap:8px}.stage{border:1px solid #283029;border-radius:10px;background:#0d120f;padding:11px 12px;display:grid;grid-template-columns:28px 1fr;gap:5px 10px;transition:.25s}.stage.flash{border-color:#65756a;background:#111813;transform:translateY(-1px)}.stage.fail{border-color:#674b46;background:#17100f}.idx{width:25px;height:25px;border:1px solid #3c4840;border-radius:50%;display:grid;place-items:center;color:#6f7d73;font:650 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;grid-row:1/3}.stage b{font-size:11px}.stage small{display:block;margin-top:4px;color:#66736a;font:550 8px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}.preview{grid-column:2;color:#839188;font:500 8px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shards{grid-column:1/3;display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:5px}.shard{height:25px;border:1px solid #3b493f;border-radius:5px;background:#0a0e0b;color:#87998b;display:grid;place-items:center;font:600 6px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.shard.lost{border-color:#4f3e3b;color:#7d615d;opacity:.52}
        .nodes{grid-column:1/3;display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.node{border:1px solid #3a463d;border-radius:8px;background:#0a0e0b;color:#91a095;padding:7px 8px;cursor:pointer;display:grid;gap:2px;min-width:65px}.node b{font:650 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.node small{font:500 6px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#5f6d63}.node.down{border-color:#674b46;background:#17100f}.node.down b,.node.down small{color:#a8746d}.node-state{grid-column:1/3;color:#718078;font:600 7px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em}
        .metrics{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line)}.metric{padding:10px;border-right:1px solid var(--line)}.metric:last-child{border-right:0}.metric span{display:block;color:#536058;font:650 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;margin-bottom:5px}.metric b{color:#a5b0a8;font:600 8px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace}
        .receiver-body{min-height:440px;padding:24px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.peer{width:18px;height:18px;border-radius:50%;background:#809b85;box-shadow:0 0 0 6px rgba(128,155,133,.07),0 0 28px rgba(128,155,133,.13);margin-bottom:12px}.peer-label{color:#657168;font:650 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;margin-bottom:34px}.receiver-glyphs{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;min-height:42px;user-select:none}.receiver-glyphs .glyph{font-size:18px;min-width:30px;height:36px}.receiver-state{margin-top:17px;color:#66736a;font:550 8px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.blocked{color:#a8746d!important;font-weight:700!important;letter-spacing:.08em}.repeat{border-top:1px solid var(--line);padding:13px 15px;display:grid;gap:5px}.repeat span{color:#536058;font:650 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase}.repeat code{color:#839188;font:500 7px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.repeat strong{color:#738078;font:600 8px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:4px}
        @media(max-width:1050px){.grid{grid-template-columns:1fr}.composer,.receiver{border:0}.composer,.pipeline{border-bottom:1px solid var(--line)}.receiver-body{min-height:260px}.metrics{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:560px){.head{align-items:flex-start;flex-direction:column}.truth{display:grid;gap:7px}.body{padding:13px}.key{min-width:0;flex:1;padding:0 4px}.shards{grid-template-columns:repeat(5,1fr)}.metrics{grid-template-columns:1fr 1fr}.receiver-glyphs .glyph{font-size:15px}}
      </style>
      <div class="wrap">
        <div class="head"><div class="brand"><span class="dot"></span>Sigil</div><div id="runtime" class="runtime">WASM en espera</div></div>
        <div class="truth"><span><b>REAL</b> SymbolId · doble AEAD · Reed–Solomon · reconstrucción</span><span class="sim"><b>SIMULADO</b> topología y transporte de nodos</span></div>
        <div class="grid">
          <section class="pane composer">
            <div class="pane-head"><span>01</span> Secure Canvas Composer</div>
            <div class="body">
              <div class="label">Renderer propio · sin textarea · sin IME</div>
              <div id="composerDisplay" class="secure-display" aria-label="Mensaje compuesto"></div>
              <div class="meta"><span id="byteCount">0 bytes</span><span>estado binario local</span></div>
              <div id="keyboard" class="keyboard" aria-label="Teclado gráfico Sigil"></div>
              <div class="keyboard-note">Estos botones generan códigos binarios internos. El teclado Android no participa en la composición de esta demo.</div>
            </div>
            <div class="controls">
              <label class="range"><span>pool nodos virtuales</span><input id="nodes" type="range" min="2" max="1000" value="8"><b id="nodesValue">8</b></label>
              <label class="range"><span>shards perdidos</span><input id="loss" type="range" min="0" max="8" value="0"><b id="lossValue">0</b></label>
              <label class="range"><span>pausa visual al enviar</span><input id="delay" type="range" min="0" max="2000" step="100" value="900"><b id="delayValue">0.9 s</b></label>
              <div class="actions"><button id="fail" class="action">Matar nodo</button><button id="restore" class="action">Restaurar</button></div>
              <div class="actions"><button id="rerun" class="action primary">Nuevo envelope</button><button id="replay" class="action" disabled>Ver paso a paso</button></div>
              <button id="clear" class="action">Borrar mensaje</button>
            </div>
          </section>
          <section class="pane pipeline">
            <div class="pane-head"><span>02</span> Live pipeline</div>
            <div class="guide">
              <div class="guide-head"><b id="guideStep">RECORRIDO EN VIVO</b><span id="guideTiming">0.9 s / etapa</span></div>
              <div class="guide-copy"><strong id="guideTitle">Qué hace Sigil</strong><p id="guideText">Mientras escribís, el core actualiza rápido. Al tocar ENVIAR o “Ver paso a paso”, esta vista ralentiza cada etapa para explicar qué ocurre.</p></div>
              <div class="guide-progress"><i id="guideBar"></i></div>
              <div class="guide-note"><b>Importante:</b> el delay es solo visual. El cifrado y la reconstrucción siguen ejecutándose a velocidad real.</div>
            </div>
            <div class="stages">
              <div id="stageSymbols" class="stage"><div class="idx">A</div><div><b>Ephemeral symbol layer</b><small id="symbolStatus">esperando</small></div><code id="symbolPreview" class="preview">—</code></div>
              <div id="stageCrypto" class="stage"><div class="idx">B</div><div><b>Layered AEAD</b><small id="cryptoStatus">esperando</small></div><code id="wirePreview" class="preview">—</code></div>
              <div id="stageShards" class="stage"><div class="idx">C</div><div><b>Reed–Solomon shards</b><small id="shardStatus">esperando</small></div><div id="shards" class="shards"></div></div>
              <div id="stageNodes" class="stage"><div class="idx">D</div><div><b>Virtual node transport</b><small id="nodeStatus">simulación</small></div><div id="nodeList" class="nodes"></div><div id="nodeState" class="node-state">0 nodos caídos</div></div>
              <div id="stageReconstruct" class="stage"><div class="idx">E</div><div><b>Reconstruction + authentication</b><small id="reconstructStatus">esperando</small></div><code id="reconstructPreview" class="preview">—</code></div>
            </div>
            <div class="metrics"><div class="metric"><span>Core</span><b id="core">—</b></div><div class="metric"><span>Envelope</span><b id="envelope">—</b></div><div class="metric"><span>Threshold</span><b id="threshold">—</b></div><div class="metric"><span>Network</span><b id="network">—</b></div></div>
          </section>
          <section class="pane receiver">
            <div class="pane-head"><span>03</span> Receiver renderer</div>
            <div class="receiver-body"><div class="peer"></div><div class="peer-label">VERIFIED PEER</div><div id="receiverGlyphs" class="receiver-glyphs"></div><div id="receiverState" class="receiver-state">esperando reconstrucción autenticada</div></div>
            <div class="repeat"><span>Envelope anterior</span><code id="previous">ninguno</code><span>Envelope actual</span><code id="current">ninguno</code><strong id="rotation">Nuevo envelope genera otra representación.</strong></div>
          </section>
        </div>
      </div>`;
  }

  bind() {
    this.buildKeyboard();
    this.$('nodes').addEventListener('input', () => {
      this.$('nodesValue').textContent = this.$('nodes').value;
      if (this.baseResult) this.rebuildTopology();
    });
    this.$('loss').addEventListener('input', () => {
      this.$('lossValue').textContent = this.$('loss').value;
      if (this.session) this.evaluate();
    });
    this.$('delay').addEventListener('input', () => {
      const ms = Number(this.$('delay').value);
      const label = ms === 0 ? 'sin pausa' : `${(ms / 1000).toFixed(1)} s`;
      this.$('delayValue').textContent = label;
      this.$('guideTiming').textContent = ms === 0 ? 'sin pausa' : `${label} / etapa`;
    });
    this.$('fail').addEventListener('click', () => this.failRandomNode());
    this.$('restore').addEventListener('click', () => { this.failedNodes.clear(); this.evaluate(); });
    this.$('rerun').addEventListener('click', () => this.newSession(false));
    this.$('replay').addEventListener('click', () => this.playCurrent());
    this.$('clear').addEventListener('click', () => {
      this.message = [];
      this.renderComposer();
      this.clearOutput();
      if (this.session?.free) this.session.free();
      this.session = null;
      this.baseResult = null;
      this.currentResult = null;
      this.$('replay').disabled = true;
      this.setGuide(0, 'Qué hace Sigil', 'Escribí con el teclado gráfico y tocá ENVIAR. La demo mostrará cada transformación con la pausa que elijas.');
    });
  }

  buildKeyboard() {
    const host = this.$('keyboard');
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM', '1234567890'];
    rows.forEach((row) => {
      const line = document.createElement('div');
      line.className = 'keyrow';
      [...row].forEach((label) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'key';
        button.textContent = label;
        button.addEventListener('click', () => this.pushByte(label.charCodeAt(0)));
        line.append(button);
      });
      host.append(line);
    });
    const actions = document.createElement('div');
    actions.className = 'keyrow';
    actions.innerHTML = '<button type="button" class="key wide" data-action="back">BORRAR</button><button type="button" class="key space" data-action="space">ESPACIO</button><button type="button" class="key wide" data-action="send">ENVIAR</button>';
    actions.querySelector('[data-action="back"]').addEventListener('click', () => {
      this.message.pop(); this.renderComposer(); this.schedule();
    });
    actions.querySelector('[data-action="space"]').addEventListener('click', () => this.pushByte(32));
    actions.querySelector('[data-action="send"]').addEventListener('click', () => this.newSession(false));
    host.append(actions);
  }

  pushByte(code) {
    if (this.message.length >= 120) return;
    this.message.push(code);
    this.renderComposer();
    this.schedule();
  }

  schedule() {
    clearTimeout(this.timer);
    if (!this.ready || !this.message.length) return;
    this.timer = setTimeout(() => this.newSession(true), 230);
  }

  glyphLabel(byte) {
    if (byte === 32) return '·';
    if ((byte >= 48 && byte <= 57) || (byte >= 65 && byte <= 90)) return String.fromCharCode(byte);
    return `#${byte.toString(16).padStart(2, '0')}`;
  }

  renderBytes(container, bytes) {
    container.replaceChildren();
    if (!bytes?.length) {
      const empty = document.createElement('span'); empty.className = 'empty'; empty.textContent = 'sin símbolos'; container.append(empty); return;
    }
    bytes.forEach((byte) => {
      const glyph = document.createElement('span'); glyph.className = 'glyph'; glyph.textContent = this.glyphLabel(byte); container.append(glyph);
    });
  }

  renderComposer() {
    this.renderBytes(this.$('composerDisplay'), this.message);
    this.$('byteCount').textContent = `${this.message.length} byte${this.message.length === 1 ? '' : 's'}`;
  }

  clearOutput() {
    ['symbolStatus','cryptoStatus','shardStatus','nodeStatus','reconstructStatus'].forEach((id) => { this.$(id).textContent = 'esperando'; });
    this.$('symbolPreview').textContent = '—'; this.$('wirePreview').textContent = '—'; this.$('reconstructPreview').textContent = '—';
    this.$('shards').replaceChildren(); this.$('nodeList').replaceChildren(); this.renderBytes(this.$('receiverGlyphs'), []);
    this.$('receiverState').textContent = 'esperando reconstrucción autenticada';
  }

  setGuide(step, title, text) {
    this.$('guideStep').textContent = step ? `PASO ${step} / 5` : 'RECORRIDO EN VIVO';
    this.$('guideTitle').textContent = title;
    this.$('guideText').textContent = text;
    this.$('guideBar').style.width = `${step ? step * 20 : 0}%`;
  }

  wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  guidedDelay() { return Number(this.$('delay').value); }

  async newSession(live) {
    if (!this.ready || !this.message.length) return;
    this.playback += 1;
    if (this.session?.free) this.session.free();
    this.failedNodes.clear();
    const previous = this.currentResult?.outer_wire_digest || this.previousDigest;
    this.session = new this.module.DemoSession(Uint8Array.from(this.message));
    this.baseResult = JSON.parse(this.session.run(''));
    this.previousDigest = previous;
    this.rebuildTopology(false);
    this.$('replay').disabled = false;
    if (live) {
      this.evaluate();
      this.setGuide(0, 'Actualización en vivo', 'Mientras componés, Sigil actualiza el pipeline rápidamente. Tocá ENVIAR para verlo etapa por etapa.');
      return;
    }
    await this.playCurrent();
  }

  stableHash(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }

  rebuildTopology(render = true) {
    if (!this.baseResult) return;
    const count = Number(this.$('nodes').value);
    this.failedNodes = new Set([...this.failedNodes].filter((index) => index < count));
    this.assignments = this.baseResult.fragments.map((fragment, index) => ({ fragment, index, nodeIndex: this.stableHash(`${fragment.capability}:${index}`) % count }));
    if (render) this.evaluate();
  }

  missingSlots() {
    const missing = new Set();
    const baseline = Math.min(Number(this.$('loss').value), this.baseResult?.fragments_total || 0);
    this.baseResult?.fragments.slice(0, baseline).forEach((f) => missing.add(f.display_slot));
    this.assignments.forEach(({ fragment, nodeIndex }) => { if (this.failedNodes.has(nodeIndex)) missing.add(fragment.display_slot); });
    return [...missing].sort((a, b) => a - b);
  }

  evaluate() {
    if (!this.session || !this.baseResult) return;
    const result = JSON.parse(this.session.run(this.missingSlots().join(',')));
    this.currentResult = result;
    this.renderResult(result);
  }

  renderResult(result) {
    this.$('core').textContent = `v${result.version}`;
    this.$('envelope').textContent = `${result.outer_wire_bytes} B`;
    this.$('threshold').textContent = `${result.fragments_available}/${result.fragments_required} avail`;
    const usedNodes = new Set(this.assignments.map((a) => a.nodeIndex));
    this.$('network').textContent = `${this.$('nodes').value} pool · ${usedNodes.size} usados`;
    this.$('symbolStatus').textContent = `${result.symbol_count} SymbolId · mapa efímero`;
    this.$('symbolPreview').textContent = result.symbol_codes.slice(0, 3).map((v) => v.slice(0, 14)).join(' · ') || '—';
    this.$('cryptoStatus').textContent = 'inner AEAD ✓ · outer AEAD ✓';
    this.$('wirePreview').textContent = `${result.outer_wire_digest.slice(0, 24)}…`;
    this.$('shardStatus').textContent = `${result.fragments_total} shards · ${result.fragments_lost} no disponibles`;
    this.renderShards(result);
    this.renderNodes(result);
    const ok = result.reconstruction_possible && result.reconstruction_matches && result.receiver_matches;
    this.$('stageReconstruct').classList.toggle('fail', !ok);
    if (ok) {
      this.$('reconstructStatus').textContent = 'ciphertext reconstruido · autenticación ✓';
      this.$('reconstructPreview').textContent = `${result.reconstructed_wire_digest.slice(0, 24)}…`;
      this.renderBytes(this.$('receiverGlyphs'), result.receiver_bytes || []);
      this.$('receiverState').textContent = 'renderer inerte · resultado autenticado';
      this.$('receiverState').classList.remove('blocked');
    } else {
      this.$('reconstructStatus').textContent = `${result.fragments_available}/${result.fragments_required} · sin umbral`;
      this.$('reconstructPreview').textContent = result.reconstruction_error || 'reconstrucción bloqueada';
      this.$('receiverGlyphs').replaceChildren();
      const blocked = document.createElement('span'); blocked.className = 'blocked'; blocked.textContent = 'NO DATA'; this.$('receiverGlyphs').append(blocked);
      this.$('receiverState').textContent = 'no hay suficientes shards para reconstruir';
      this.$('receiverState').classList.add('blocked');
    }
    this.$('previous').textContent = this.previousDigest ? `${this.previousDigest.slice(0, 18)}…` : 'ninguno';
    this.$('current').textContent = `${result.outer_wire_digest.slice(0, 18)}…`;
    this.$('rotation').textContent = this.previousDigest
      ? (this.previousDigest !== result.outer_wire_digest ? 'Mismo mensaje puede producir un envelope distinto.' : 'Envelope repetido inesperadamente.')
      : 'Generá otro envelope para comparar.';
  }

  renderShards(result) {
    const host = this.$('shards'); host.replaceChildren();
    result.fragments.forEach((fragment) => {
      const el = document.createElement('div'); el.className = `shard ${fragment.available ? '' : 'lost'}`; el.textContent = fragment.capability.slice(0, 5); host.append(el);
    });
  }

  renderNodes(result) {
    const host = this.$('nodeList'); host.replaceChildren();
    const bySlot = new Map(result.fragments.map((f) => [f.display_slot, f]));
    const counts = new Map();
    this.assignments.forEach(({ fragment, nodeIndex }) => {
      const item = counts.get(nodeIndex) || { total: 0, ok: 0 };
      item.total += 1; if (bySlot.get(fragment.display_slot)?.available) item.ok += 1; counts.set(nodeIndex, item);
    });
    [...counts.keys()].sort((a,b)=>a-b).forEach((index) => {
      const count = counts.get(index); const down = this.failedNodes.has(index);
      const button = document.createElement('button'); button.type = 'button'; button.className = `node ${down ? 'down' : ''}`;
      button.innerHTML = `<b>N${String(index + 1).padStart(3, '0')}</b><small>${down ? 'NODE DOWN' : `${count.ok}/${count.total} shards`}</small>`;
      button.addEventListener('click', () => { down ? this.failedNodes.delete(index) : this.failedNodes.add(index); this.evaluate(); });
      host.append(button);
    });
    const margin = result.fragments_available - result.fragments_required;
    this.$('nodeState').textContent = `${this.failedNodes.size} nodos caídos · ${result.fragments_available}/${result.fragments_required} shards · ${margin >= 0 ? `margen +${margin}` : 'umbral insuficiente'}`;
    this.$('nodeStatus').textContent = `${usedText(counts.size)} · tocá un nodo para apagarlo`;
    this.$('restore').disabled = !this.failedNodes.size;
    this.$('fail').disabled = this.failedNodes.size >= counts.size;
  }

  failRandomNode() {
    const used = [...new Set(this.assignments.map((a) => a.nodeIndex))];
    const candidates = used.filter((n) => !this.failedNodes.has(n));
    if (!candidates.length) return;
    this.failedNodes.add(candidates[Math.floor(Math.random() * candidates.length)]);
    this.evaluate();
  }

  async playCurrent() {
    if (!this.session || !this.baseResult) return;
    const token = ++this.playback;
    const result = JSON.parse(this.session.run(this.missingSlots().join(',')));
    this.currentResult = result;
    this.$('replay').disabled = true;
    this.clearOutput();
    ['core','envelope','threshold','network'].forEach((id) => { this.$(id).textContent = '—'; });
    this.$('stageReconstruct').classList.remove('fail');
    const delay = this.guidedDelay();

    const step = async (number, id, title, text, reveal) => {
      if (token !== this.playback) return false;
      const el = this.$(id);
      this.setGuide(number, title, text);
      el.classList.add('flash');
      reveal();
      if (delay) await this.wait(delay);
      el.classList.remove('flash');
      return token === this.playback;
    };

    if (!await step(1, 'stageSymbols', 'El texto deja de ser texto del sistema', 'Las pulsaciones del Secure Canvas ya son bytes y SymbolId internos. La representación efímera cambia entre envelopes.', () => {
      this.$('core').textContent = `v${result.version}`;
      this.$('symbolStatus').textContent = `${result.symbol_count} SymbolId · mapa efímero`;
      this.$('symbolPreview').textContent = result.symbol_codes.slice(0, 3).map((v) => v.slice(0, 14)).join(' · ') || '—';
    })) return;

    if (!await step(2, 'stageCrypto', 'Se cifra y vuelve a envolver', 'El stream binario entra en una capa AEAD y luego en otra capa AEAD independiente para transporte. Lo visible en red ya es ciphertext autenticado.', () => {
      this.$('envelope').textContent = `${result.outer_wire_bytes} B`;
      this.$('cryptoStatus').textContent = 'inner AEAD ✓ · outer AEAD ✓';
      this.$('wirePreview').textContent = `${result.outer_wire_digest.slice(0, 24)}…`;
    })) return;

    if (!await step(3, 'stageShards', 'El ciphertext se convierte en un rompecabezas', 'Reed–Solomon divide el ciphertext externo en 20 shards. El receptor necesita un umbral suficiente, no necesariamente todas las piezas.', () => {
      this.$('threshold').textContent = `${result.fragments_available}/${result.fragments_required} avail`;
      this.$('shardStatus').textContent = `${result.fragments_total} shards · ${result.fragments_lost} no disponibles`;
      this.renderShards(result);
    })) return;

    if (!await step(4, 'stageNodes', 'Las piezas se dispersan', 'La topología dibujada es simulada. Cada shard mostrado sí viene del core real; apagar un nodo quita sus shards del intento real de reconstrucción.', () => {
      const usedNodes = new Set(this.assignments.map((a) => a.nodeIndex));
      this.$('network').textContent = `${this.$('nodes').value} pool · ${usedNodes.size} usados`;
      this.renderNodes(result);
    })) return;

    if (!await step(5, 'stageReconstruct', 'El receptor reconstruye antes de mostrar', 'Si quedan suficientes shards, el core recompone el ciphertext, verifica autenticidad, descifra las dos capas y recién entonces entrega símbolos al renderer.', () => {
      this.$('reconstructStatus').textContent = 'verificando umbral y autenticidad…';
    })) return;

    this.renderResult(result);
    const ok = result.reconstruction_possible && result.reconstruction_matches && result.receiver_matches;
    this.setGuide(5, ok ? 'Mensaje reconstruido y autenticado' : 'Reconstrucción bloqueada', ok
      ? 'El receptor obtuvo suficientes piezas, verificó el ciphertext y renderizó el contenido. Las claves no se muestran en la interfaz.'
      : 'No quedaron suficientes piezas para alcanzar el umbral. Sigil no intenta mostrar un mensaje parcial o no autenticado.');
    this.$('replay').disabled = false;
  }
}

function usedText(count) { return `${count} nodo${count === 1 ? '' : 's'} usado${count === 1 ? '' : 's'}`; }

if (!customElements.get('sigil-inline-demo')) customElements.define('sigil-inline-demo', SigilInlineDemo);
