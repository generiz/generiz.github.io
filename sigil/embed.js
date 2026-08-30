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
    this.showReceiverSymbols = false;
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
        :host{display:block;color:#edf1ec;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;--line:#283029;--green:#86a08b;--amber:#b39c70;--danger:#9a6b63}
        *{box-sizing:border-box}button,input{font:inherit}.wrap{border:1px solid var(--line);border-radius:20px;overflow:hidden;background:radial-gradient(circle at 50% 20%,rgba(125,149,130,.08),transparent 32%),#080b09;box-shadow:0 30px 90px rgba(0,0,0,.22)}
        .head{min-height:58px;padding:13px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{display:flex;align-items:center;gap:10px;font-weight:680;font-size:13px}.dot{width:8px;height:8px;border-radius:50%;border:1px solid var(--green);box-shadow:0 0 0 4px rgba(134,160,139,.08)}.runtime{color:#69756c;font:600 9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.11em}.runtime.ok{color:#95a99a}.runtime.bad{color:#b77a72}
        .truth{padding:10px 18px;border-bottom:1px solid var(--line);display:flex;gap:20px;flex-wrap:wrap;color:#657168;font:600 8px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.09em}.truth b{color:#a9b5ac;margin-right:7px}.truth .warn b{color:var(--amber)}
        .boundary{padding:11px 18px;border-bottom:1px solid var(--line);background:#090d0a;color:#68756c;font:550 9px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.boundary b{color:#9cab9f}.grid{display:grid;grid-template-columns:minmax(260px,.82fr) minmax(430px,1.36fr) minmax(230px,.72fr)}.pane{min-width:0;background:linear-gradient(160deg,#0d110f,#090c0a)}.composer{border-right:1px solid var(--line)}.receiver{border-left:1px solid var(--line)}.pane-head{height:48px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;padding:0 16px;color:#7b877f;font:650 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase}.pane-head span{color:#4f5a53}.body{padding:17px}.label{color:#58635c;font:650 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase;margin-bottom:9px}.secure-display{min-height:94px;border:1px solid #354038;border-radius:12px;background:#070a08;padding:13px;display:flex;gap:6px;align-content:flex-start;align-items:flex-start;flex-wrap:wrap;user-select:none;-webkit-user-select:none}.glyph{min-width:24px;height:29px;padding:0 5px;border:1px solid #303a33;border-radius:6px;display:grid;place-items:center;background:#0d120f;color:#dce3dd;font:650 14px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.empty{color:#536058;font:600 9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}.meta{display:flex;justify-content:space-between;margin-top:8px;color:#536058;font:550 8px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace}
        .keyboard{margin-top:15px;display:grid;gap:6px;touch-action:manipulation}.keyrow{display:flex;gap:5px;justify-content:center}.key{appearance:none;min-width:28px;min-height:37px;padding:0 7px;border:1px solid #354038;border-radius:8px;background:#0c110e;color:#aab6ad;cursor:pointer;font:650 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;touch-action:manipulation;user-select:none}.key:hover,.key:active{background:#151c17;border-color:#59665d;color:#fff}.key.wide{min-width:68px}.key.space{flex:1;max-width:190px}.keyboard-note{margin-top:10px;color:#59645d;font-size:9px;line-height:1.48}.controls{border-top:1px solid var(--line);padding:13px 17px;display:grid;gap:10px}.range{display:grid;grid-template-columns:1fr 60px;gap:7px;align-items:center}.range span{color:#667169;font:600 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em}.range input{width:100%;accent-color:#849b88}.range b{text-align:right;color:#acb7af;font-size:13px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.action{border:1px solid #3a453d;border-radius:999px;background:#0c110e;color:#9aa69d;padding:10px 11px;cursor:pointer;font-size:9px}.action.primary{background:#e6ebe6;color:#080a09;border-color:#e6ebe6;font-weight:700}.action:disabled{opacity:.35;cursor:default}
        .guide{border-bottom:1px solid var(--line);padding:14px 17px;background:#080c09;display:grid;gap:9px}.guide-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.guide-head b,.guide-head span{font:650 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}.guide-head b{color:#9aab9e}.guide-head span{color:#617067}.guide-copy strong{display:block;color:#d9e0da;font-size:12px;margin-bottom:5px}.guide-copy p{margin:0;color:#78857c;font-size:10px;line-height:1.55;max-width:680px}.guide-progress{height:2px;background:#1e2721;overflow:hidden;border-radius:2px}.guide-progress i{display:block;width:0;height:100%;background:#8da292;transition:width .25s ease}.guide-note{color:#566159;font:550 7px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.guide-note b{color:#7f9084}
        .pipeline{background:#090c0a}.stages{padding:17px;display:grid;gap:8px}.stage{border:1px solid #283029;border-radius:10px;background:#0d120f;padding:11px 12px;display:grid;grid-template-columns:28px 1fr;gap:5px 10px;transition:.25s}.stage.flash{border-color:#65756a;background:#111813;transform:translateY(-1px)}.stage.fail{border-color:#674b46;background:#17100f}.idx{width:25px;height:25px;border:1px solid #3c4840;border-radius:50%;display:grid;place-items:center;color:#6f7d73;font:650 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;grid-row:1/3}.stage b{font-size:11px}.stage small{display:block;margin-top:4px;color:#66736a;font:550 8px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}.preview{grid-column:2;color:#839188;font:500 8px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shards{grid-column:1/3;display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:5px}.shard{height:25px;border:1px solid #3b493f;border-radius:5px;background:#0a0e0b;color:#87998b;display:grid;place-items:center;font:600 6px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.shard.lost{border-color:#4f3e3b;color:#7d615d;opacity:.52}.nodes{grid-column:1/3;display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.node{border:1px solid #3a463d;border-radius:8px;background:#0a0e0b;color:#91a095;padding:7px 8px;cursor:pointer;display:grid;gap:2px;min-width:65px}.node b{font:650 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.node small{font:500 6px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#5f6d63}.node.down{border-color:#674b46;background:#17100f}.node.down b,.node.down small{color:#a8746d}.node-state{grid-column:1/3;color:#718078;font:600 7px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line)}.metric{padding:10px;border-right:1px solid var(--line)}.metric:last-child{border-right:0}.metric span{display:block;color:#536058;font:650 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;margin-bottom:5px}.metric b{color:#a5b0a8;font:600 8px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace}
        .receiver-body{min-height:440px;padding:24px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.peer{width:18px;height:18px;border-radius:50%;background:#809b85;box-shadow:0 0 0 6px rgba(128,155,133,.07),0 0 28px rgba(128,155,133,.13);margin-bottom:12px}.peer-label{color:#657168;font:650 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;margin-bottom:25px}.receiver-glyphs{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;min-height:40px;margin-bottom:16px}.receiver-glyphs .glyph{font-size:18px;min-width:30px;height:36px}.proof{min-width:170px;padding:17px;border:1px solid #354038;border-radius:12px;background:#0b100d;color:#91a095;font:700 11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.proof.bad{border-color:#674b46;color:#a8746d;background:#17100f}.receiver-state{max-width:230px;margin-top:17px;color:#66736a;font:550 8px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.repeat{border-top:1px solid var(--line);padding:13px 15px;display:grid;gap:5px}.repeat span{color:#536058;font:650 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase}.repeat code{color:#839188;font:500 7px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.repeat strong{color:#738078;font:600 8px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:4px}
        @media(max-width:1050px){.grid{grid-template-columns:1fr}.composer,.receiver{border:0}.composer,.pipeline{border-bottom:1px solid var(--line)}.receiver-body{min-height:260px}.metrics{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:560px){.head{align-items:flex-start;flex-direction:column}.truth{display:grid;gap:7px}.body{padding:13px}.key{min-width:0;flex:1;padding:0 4px}.shards{grid-template-columns:repeat(5,1fr)}.metrics{grid-template-columns:1fr 1fr}}
      </style>
      <div class="wrap">
        <div class="head"><div class="brand"><span class="dot"></span>Sigil</div><div id="runtime" class="runtime">WASM en espera</div></div>
        <div class="truth"><span><b>REAL</b> SymbolId · doble AEAD · Reed–Solomon · autenticación</span><span class="warn"><b>LOOPBACK</b> un proceso · sin AKE</span><span class="warn"><b>SIMULADO</b> topología de nodos</span></div>
        <div class="boundary"><b>Frontera del demo:</b> el origen web conoce los bytes que componés. La salida JSON no devuelve plaintext; tras autenticar, el renderer pide SymbolId uno por uno. El mismo origen puede observarlos. Esto demuestra el pipeline criptográfico local, no un canal confidencial entre dos dispositivos.</div>
        <div class="grid">
          <section class="pane composer">
            <div class="pane-head"><span>01</span> Secure Canvas Composer</div>
            <div class="body">
              <div class="label">Renderer propio · sin textarea · sin IME</div>
              <div id="composerDisplay" class="secure-display" aria-label="Mensaje compuesto"></div>
              <div class="meta"><span id="byteCount">0 bytes</span><span>plaintext local del origen</span></div>
              <div id="keyboard" class="keyboard" aria-label="Teclado gráfico Sigil"></div>
              <div class="keyboard-note">El teclado Android no participa en esta composición. Eso evita la ruta IME normal, pero JavaScript y el origen que ejecuta esta página siguen observando los bytes del mensaje.</div>
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
            <div class="pane-head"><span>02</span> Loopback pipeline</div>
            <div class="guide">
              <div class="guide-head"><b id="guideStep">RECORRIDO EN VIVO</b><span id="guideTiming">0.9 s / etapa</span></div>
              <div class="guide-copy"><strong id="guideTitle">Qué demuestra</strong><p id="guideText">El mismo proceso sella, fragmenta, reconstruye y abre el envelope. ENVIAR ralentiza la representación visual; la criptografía sigue ejecutándose a velocidad real.</p></div>
              <div class="guide-progress"><i id="guideBar"></i></div>
              <div class="guide-note"><b>No demuestra:</b> acuerdo de claves, firma de identidad, ratchet, red live ni protección frente a un origen web comprometido.</div>
            </div>
            <div class="stages">
              <div id="stageSymbols" class="stage"><div class="idx">A</div><div><b>Binary symbol layer</b><small id="symbolStatus">esperando</small></div><code id="symbolPreview" class="preview">—</code></div>
              <div id="stageCrypto" class="stage"><div class="idx">B</div><div><b>Identity-bound layered AEAD</b><small id="cryptoStatus">esperando</small></div><code id="wirePreview" class="preview">—</code></div>
              <div id="stageShards" class="stage"><div class="idx">C</div><div><b>Reed–Solomon shards</b><small id="shardStatus">esperando</small></div><div id="shards" class="shards"></div></div>
              <div id="stageNodes" class="stage"><div class="idx">D</div><div><b>Virtual node transport</b><small id="nodeStatus">simulación</small></div><div id="nodeList" class="nodes"></div><div id="nodeState" class="node-state">0 nodos caídos</div></div>
              <div id="stageReconstruct" class="stage"><div class="idx">E</div><div><b>Reconstruction + authentication</b><small id="reconstructStatus">esperando</small></div><code id="reconstructPreview" class="preview">—</code></div>
            </div>
            <div class="metrics"><div class="metric"><span>Core</span><b id="core">—</b></div><div class="metric"><span>Wire digest</span><b id="envelope">—</b></div><div class="metric"><span>Threshold</span><b id="threshold">—</b></div><div class="metric"><span>Network</span><b id="network">—</b></div></div>
          </section>
          <section class="pane receiver">
            <div class="pane-head"><span>03</span> Authentication result</div>
            <div class="receiver-body"><div class="peer"></div><div class="peer-label">LOOPBACK VERIFY</div><div id="receiverGlyphs" class="receiver-glyphs"></div><div id="receiverProof" class="proof">WAITING</div><div id="receiverState" class="receiver-state">El WASM no exporta el mensaje reconstruido al JSON público.</div></div>
            <div class="repeat"><span>Envelope anterior</span><code id="previous">ninguno</code><span>Envelope actual</span><code id="current">ninguno</code><strong id="rotation">Nuevo envelope genera otro digest.</strong></div>
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
      this.setGuide(0, 'Qué demuestra', 'Componé un mensaje y tocá ENVIAR para recorrer el pipeline loopback.');
    });
  }

  buildKeyboard() {
    const host = this.$('keyboard');
    ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM', '1234567890'].forEach((row) => {
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
    actions.querySelector('[data-action="back"]').addEventListener('click', () => { this.message.pop(); this.renderComposer(); this.schedule(); });
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

  renderComposer() {
    const host = this.$('composerDisplay');
    host.replaceChildren();
    if (!this.message.length) {
      const empty = document.createElement('span');
      empty.className = 'empty';
      empty.textContent = 'sin símbolos';
      host.append(empty);
    } else {
      this.message.forEach((byte) => {
        const glyph = document.createElement('span');
        glyph.className = 'glyph';
        glyph.textContent = this.glyphLabel(byte);
        host.append(glyph);
      });
    }
    this.$('byteCount').textContent = `${this.message.length} byte${this.message.length === 1 ? '' : 's'}`;
  }

  clearOutput() {
    ['symbolStatus','cryptoStatus','shardStatus','nodeStatus','reconstructStatus'].forEach((id) => { this.$(id).textContent = 'esperando'; });
    this.$('symbolPreview').textContent = '—';
    this.$('wirePreview').textContent = '—';
    this.$('reconstructPreview').textContent = '—';
    this.$('shards').replaceChildren();
    this.$('nodeList').replaceChildren();
    this.$('receiverGlyphs').replaceChildren();
    this.$('receiverProof').textContent = 'WAITING';
    this.$('receiverProof').classList.remove('bad');
    this.$('receiverState').textContent = 'El WASM no exporta el mensaje reconstruido al JSON público.';
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
    this.showReceiverSymbols = !live;
    this.session = new this.module.DemoSession(Uint8Array.from(this.message));
    this.baseResult = JSON.parse(this.session.run(''));
    this.previousDigest = previous;
    this.rebuildTopology(false);
    this.$('replay').disabled = false;
    if (live) {
      this.evaluate();
      this.setGuide(0, 'Actualización loopback', 'Mientras componés, el mismo proceso genera y verifica el envelope. Tocá ENVIAR para verlo etapa por etapa.');
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
    this.assignments = Array.from({ length: this.baseResult.fragments_total }, (_, index) => ({
      slot: index + 1,
      nodeIndex: this.stableHash(`slot:${index + 1}`) % count,
    }));
    if (render) this.evaluate();
  }

  missingSlots() {
    const missing = new Set();
    const baseline = Math.min(Number(this.$('loss').value), this.baseResult?.fragments_total || 0);
    for (let slot = 1; slot <= baseline; slot += 1) missing.add(slot);
    this.assignments.forEach(({ slot, nodeIndex }) => { if (this.failedNodes.has(nodeIndex)) missing.add(slot); });
    return [...missing].sort((a, b) => a - b);
  }

  evaluate() {
    if (!this.session || !this.baseResult) return;
    const result = JSON.parse(this.session.run(this.missingSlots().join(',')));
    this.currentResult = result;
    this.renderResult(result);
  }

  authenticated(result) {
    return result.reconstruction_matches && result.outer_authenticated && result.inner_authenticated;
  }

  renderReceiverSymbols() {
    const host = this.$('receiverGlyphs');
    host.replaceChildren();
    if (!this.session || !this.showReceiverSymbols) return;
    const missing = this.missingSlots().join(',');
    for (let index = 0; index < this.message.length; index += 1) {
      const symbolId = this.session.receiver_symbol_at(index, missing);
      if (!symbolId) break;
      const glyph = document.createElement('span');
      glyph.className = 'glyph';
      glyph.textContent = this.glyphLabel(symbolId - 1);
      host.append(glyph);
    }
  }

  renderResult(result) {
    const usedNodes = new Set(this.assignments.map((a) => a.nodeIndex));
    const ok = this.authenticated(result);
    this.$('core').textContent = `v${result.version}`;
    this.$('envelope').textContent = `${result.outer_wire_digest.slice(0, 16)}…`;
    this.$('threshold').textContent = `${result.fragments_available}/${result.fragments_required} avail`;
    this.$('network').textContent = `${this.$('nodes').value} pool · ${usedNodes.size} usados`;
    this.$('symbolStatus').textContent = `${this.message.length} bytes locales → SymbolId`;
    this.$('symbolPreview').textContent = 'representación interna no exportada';
    this.$('cryptoStatus').textContent = 'doble AEAD · AAD bindeado a contexto de identidad';
    this.$('wirePreview').textContent = `${result.outer_wire_digest.slice(0, 24)}…`;
    this.$('shardStatus').textContent = `${result.fragments_total} shards · ${result.fragments_lost} no disponibles`;
    this.renderShards(result);
    this.renderNodes(result);
    this.$('stageReconstruct').classList.toggle('fail', !ok);
    this.$('reconstructStatus').textContent = ok ? 'wire reconstruido · outer auth ✓ · inner auth ✓' : `${result.fragments_available}/${result.fragments_required} · autenticación no completada`;
    this.$('reconstructPreview').textContent = ok ? 'reconstruction_matches = true' : 'reconstruction_matches = false';
    if (ok) this.renderReceiverSymbols(); else this.$('receiverGlyphs').replaceChildren();
    this.$('receiverProof').textContent = ok ? 'AUTHENTICATED' : 'NO DATA';
    this.$('receiverProof').classList.toggle('bad', !ok);
    this.$('receiverState').textContent = ok
      ? 'Loopback autenticado. El JSON no contiene plaintext; el renderer solicita cada SymbolId autenticado para mostrarlo.'
      : 'No se alcanzó una reconstrucción autenticada. No se exporta contenido parcial.';
    this.$('previous').textContent = this.previousDigest ? `${this.previousDigest.slice(0, 18)}…` : 'ninguno';
    this.$('current').textContent = `${result.outer_wire_digest.slice(0, 18)}…`;
    this.$('rotation').textContent = this.previousDigest
      ? (this.previousDigest !== result.outer_wire_digest ? 'Mismo input, nuevo secreto/nonces, digest distinto.' : 'Digest repetido inesperadamente.')
      : 'Generá otro envelope para comparar.';
  }

  renderShards(result) {
    const host = this.$('shards');
    host.replaceChildren();
    const missing = new Set(this.missingSlots());
    for (let slot = 1; slot <= result.fragments_total; slot += 1) {
      const el = document.createElement('div');
      el.className = `shard ${missing.has(slot) ? 'lost' : ''}`;
      el.textContent = `S${String(slot).padStart(2, '0')}`;
      host.append(el);
    }
  }

  renderNodes(result) {
    const host = this.$('nodeList');
    host.replaceChildren();
    const missing = new Set(this.missingSlots());
    const counts = new Map();
    this.assignments.forEach(({ slot, nodeIndex }) => {
      const item = counts.get(nodeIndex) || { total: 0, ok: 0 };
      item.total += 1;
      if (!missing.has(slot)) item.ok += 1;
      counts.set(nodeIndex, item);
    });
    [...counts.keys()].sort((a,b)=>a-b).forEach((index) => {
      const count = counts.get(index);
      const down = this.failedNodes.has(index);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `node ${down ? 'down' : ''}`;
      button.innerHTML = `<b>N${String(index + 1).padStart(3, '0')}</b><small>${down ? 'NODE DOWN' : `${count.ok}/${count.total} slots`}</small>`;
      button.addEventListener('click', () => { down ? this.failedNodes.delete(index) : this.failedNodes.add(index); this.evaluate(); });
      host.append(button);
    });
    const margin = result.fragments_available - result.fragments_required;
    this.$('nodeState').textContent = `${this.failedNodes.size} nodos caídos · ${result.fragments_available}/${result.fragments_required} shards · ${margin >= 0 ? `margen +${margin}` : 'umbral insuficiente'}`;
    this.$('nodeStatus').textContent = `${counts.size} nodos simulados usados · asignación por slot`;
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
    this.showReceiverSymbols = true;
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

    if (!await step(1, 'stageSymbols', 'Entrada local → representación binaria', 'El origen web ya conoce los bytes. El core los transforma a SymbolId y stream binario; esa capa no es cifrado.', () => {
      this.$('core').textContent = `v${result.version}`;
      this.$('symbolStatus').textContent = `${this.message.length} bytes locales → SymbolId`;
      this.$('symbolPreview').textContent = 'representación interna no exportada';
    })) return;

    if (!await step(2, 'stageCrypto', 'Dos capas AEAD con contexto', 'El stream entra en XChaCha20-Poly1305 interno y luego externo. El AAD de aplicación incluye el contexto ordenado de identidad del demo; esto no es AKE ni firma.', () => {
      this.$('envelope').textContent = `${result.outer_wire_digest.slice(0, 16)}…`;
      this.$('cryptoStatus').textContent = 'doble AEAD · identity-bound AAD';
      this.$('wirePreview').textContent = `${result.outer_wire_digest.slice(0, 24)}…`;
    })) return;

    if (!await step(3, 'stageShards', 'Redundancia después del cifrado', 'Reed–Solomon trabaja sobre el wire ya cifrado. Da disponibilidad; no agrega confidencialidad ni reemplaza AEAD.', () => {
      this.$('threshold').textContent = `${result.fragments_available}/${result.fragments_required} avail`;
      this.$('shardStatus').textContent = `${result.fragments_total} shards · ${result.fragments_lost} no disponibles`;
      this.renderShards(result);
    })) return;

    if (!await step(4, 'stageNodes', 'Topología solamente simulada', 'Los slots que se quitan sí cambian el conjunto entregado al core para reconstrucción. Los nodos dibujados no son servidores reales.', () => {
      const usedNodes = new Set(this.assignments.map((a) => a.nodeIndex));
      this.$('network').textContent = `${this.$('nodes').value} pool · ${usedNodes.size} usados`;
      this.renderNodes(result);
    })) return;

    if (!await step(5, 'stageReconstruct', 'Reconstrucción y autenticación loopback', 'El mismo proceso intenta reconstruir el wire y abrir ambas capas. El resultado público contiene estados y digest, no el plaintext reconstruido.', () => {
      this.$('reconstructStatus').textContent = 'verificando wire y autenticidad…';
    })) return;

    this.renderResult(result);
    const ok = this.authenticated(result);
    this.setGuide(5, ok ? 'Loopback autenticado' : 'Reconstrucción bloqueada', ok
      ? 'El wire coincidió y ambas capas autenticaron. No hubo AKE: los dos secretos nacieron dentro de esta misma DemoSession.'
      : 'No se completó una reconstrucción autenticada. El JSON no devuelve contenido parcial ni plaintext.');
    this.$('replay').disabled = false;
  }
}

if (!customElements.get('sigil-inline-demo')) customElements.define('sigil-inline-demo', SigilInlineDemo);
