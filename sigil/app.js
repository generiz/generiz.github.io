import init, { DemoSession, sigil_demo_version } from './pkg/sigil_core.js';

const $ = (id) => document.getElementById(id);
const encoder = new TextEncoder();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runtime = document.querySelector('.runtime');
const runtimeLabel = $('runtimeLabel');
const input = $('messageInput');
const lossInput = $('lossInput');
const lossValue = $('lossValue');
const nodeToggle = $('nodeToggle');
const nodeInput = $('nodeInput');
const nodeValue = $('nodeValue');
const nodeControl = $('nodeControl');
const liveToggle = $('liveToggle');
const liveState = $('liveState');
const failNodeButton = $('failNodeButton');
const restoreNodesButton = $('restoreNodesButton');
const sendButton = $('sendButton');
const receiverText = $('receiverText');
const receiverState = $('receiverState');
const fragmentGrid = $('fragmentGrid');
const nodeMap = $('nodeMap');
const virtualNodes = $('virtualNodes');
const packetLayer = $('packetLayer');
const stages = [...document.querySelectorAll('.stage')];

let previousRun = null;
let activeSession = null;
let baseResult = null;
let currentResult = null;
let currentAssignments = [];
let failedNodes = new Set();
let running = false;
let pendingAutoRun = false;
let liveTimer = null;
let runSerial = 0;
let transportComplete = false;

function digestShort(value) {
  if (!value || value === 'none') return value;
  return `${value.slice(0, 18)}…${value.slice(-8)}`;
}

function updateByteCount() {
  const bytes = encoder.encode(input.value).length;
  $('byteCount').textContent = `${bytes} byte${bytes === 1 ? '' : 's'}`;
  $('byteCount').classList.toggle('over', bytes > 512);
}

function updateControls() {
  lossValue.textContent = lossInput.value;
  nodeValue.textContent = nodeInput.value;
  nodeControl.classList.toggle('disabled', !nodeToggle.checked);
  nodeInput.disabled = !nodeToggle.checked;
  failNodeButton.disabled = !nodeToggle.checked || !activeSession;
  restoreNodesButton.disabled = !nodeToggle.checked || !failedNodes.size;
  liveState.textContent = liveToggle.checked ? 'LIVE' : 'MANUAL';
  liveState.classList.toggle('off', !liveToggle.checked);
}

function clearStageState() {
  stages.forEach((stage) => stage.classList.remove('active', 'done', 'skipped', 'failed'));
  receiverText.classList.remove('revealed', 'blocked');
  receiverText.textContent = '—';
  receiverState.textContent = 'esperando reconstrucción autenticada';
  $('symbolStatus').textContent = 'esperando';
  $('cryptoStatus').textContent = 'esperando';
  $('fragmentStatus').textContent = 'esperando';
  $('nodeStatus').textContent = nodeToggle.checked ? 'esperando' : 'simulación desactivada';
  $('reconstructStatus').textContent = 'esperando';
  $('symbolPreview').textContent = '—';
  $('wirePreview').textContent = '—';
  $('reconstructPreview').textContent = '—';
  $('nodeFailureState').textContent = `${failedNodes.size} nodos caídos`;
  fragmentGrid.replaceChildren();
  virtualNodes.replaceChildren();
  packetLayer.replaceChildren();
  $('networkMetric').textContent = nodeToggle.checked ? `${nodeInput.value} pool` : 'local';
}

function renderFragments(result) {
  fragmentGrid.replaceChildren();
  for (const fragment of result.fragments) {
    const el = document.createElement('div');
    el.className = `fragment ${fragment.available ? 'available' : 'lost'}`;
    el.dataset.slot = String(fragment.display_slot);
    el.title = `slot ${fragment.display_slot} · cap ${fragment.capability} · digest ${fragment.payload_digest} · ${fragment.bytes} bytes`;
    const label = document.createElement('small');
    label.textContent = fragment.capability.slice(0, 6);
    el.append(label);
    fragmentGrid.append(el);
  }
}

function stableHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildAssignments(result, nodeCount) {
  return result.fragments.map((fragment, index) => ({
    fragment,
    index,
    nodeIndex: stableHash(`${fragment.capability}:${index}`) % nodeCount,
  }));
}

function nodeLabel(index) {
  const width = Number(nodeInput.value) >= 100 ? 4 : 2;
  return `N${String(index + 1).padStart(width, '0')}`;
}

function renderVirtualNodes(assignments) {
  virtualNodes.replaceChildren();
  const used = [...new Set(assignments.map(({ nodeIndex }) => nodeIndex))].sort((a, b) => a - b);

  for (const index of used) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'virtual-node';
    node.dataset.nodeIndex = String(index);
    node.setAttribute('aria-pressed', failedNodes.has(index) ? 'true' : 'false');
    node.title = `${nodeLabel(index)} · tocar para apagar/restaurar`;
    node.addEventListener('click', () => toggleNode(index));
    virtualNodes.append(node);
  }

  return used.length;
}

function resultBySlot(result) {
  return new Map(result.fragments.map((fragment) => [fragment.display_slot, fragment]));
}

function refreshNodeCards(result) {
  if (!currentAssignments.length) return;
  const bySlot = resultBySlot(result);
  const counts = new Map();

  for (const { fragment, nodeIndex } of currentAssignments) {
    const count = counts.get(nodeIndex) || { total: 0, available: 0, lost: 0 };
    count.total += 1;
    if (bySlot.get(fragment.display_slot)?.available) count.available += 1;
    else count.lost += 1;
    counts.set(nodeIndex, count);
  }

  for (const node of virtualNodes.querySelectorAll('.virtual-node')) {
    const index = Number(node.dataset.nodeIndex);
    const count = counts.get(index) || { total: 0, available: 0, lost: 0 };
    const failed = failedNodes.has(index);
    node.classList.toggle('failed', failed);
    node.classList.toggle('partial', !failed && count.lost > 0 && count.available > 0);
    node.classList.toggle('idle', !count.total);
    node.setAttribute('aria-pressed', failed ? 'true' : 'false');
    node.innerHTML = `<b>${nodeLabel(index)}</b><span>${count.total} shard${count.total === 1 ? '' : 's'}</span><small>${failed ? 'NODE DOWN' : `${count.available} ok${count.lost ? ` · ${count.lost} lost` : ''}`}</small>`;
  }
}

function baselineMissingSlots() {
  if (!baseResult) return new Set();
  const count = Math.min(Number(lossInput.value), baseResult.fragments_total);
  return new Set(baseResult.fragments.slice(0, count).map((fragment) => fragment.display_slot));
}

function computeMissingSlots() {
  const missing = baselineMissingSlots();
  if (nodeToggle.checked) {
    for (const { fragment, nodeIndex } of currentAssignments) {
      if (failedNodes.has(nodeIndex)) missing.add(fragment.display_slot);
    }
  }
  return missing;
}

function missingCsv() {
  return [...computeMissingSlots()].sort((a, b) => a - b).join(',');
}

function updateRecoveryUI(result, revealReceiver) {
  currentResult = result;
  renderFragments(result);
  refreshNodeCards(result);

  const margin = result.fragments_available - result.fragments_required;
  const recoverable = result.reconstruction_possible && result.reconstruction_matches;
  $('threshold').textContent = `${result.fragments_available}/${result.fragments_required} avail · ${result.fragments_total} total`;
  $('fragmentStatus').textContent = `${result.fragments_total} generados · ${result.fragments_lost} no disponibles · ${result.fragments_available} disponibles`;
  $('nodeFailureState').textContent = `${failedNodes.size} nodo${failedNodes.size === 1 ? '' : 's'} caído${failedNodes.size === 1 ? '' : 's'} · ${result.fragments_available}/${result.fragments_required} shards · ${recoverable ? `margen +${margin}` : 'umbral insuficiente'}`;
  restoreNodesButton.disabled = !nodeToggle.checked || !failedNodes.size;

  const reconstructStage = document.querySelector('[data-stage="reconstruct"]');
  reconstructStage.classList.toggle('failed', !recoverable);

  if (recoverable) {
    $('reconstructStatus').textContent = 'ciphertext reconstruido · autenticación ✓';
    $('reconstructPreview').textContent = `rebuilt ${digestShort(result.reconstructed_wire_digest)}`;
    if (revealReceiver) {
      receiverText.textContent = result.receiver_text ?? '—';
      receiverText.classList.remove('blocked');
      receiverText.classList.add('revealed');
      receiverState.textContent = 'resultado autenticado · coincide con la entrada original';
    }
  } else {
    $('reconstructStatus').textContent = `${result.fragments_available}/${result.fragments_required} shards · reconstrucción bloqueada`;
    $('reconstructPreview').textContent = result.reconstruction_error || 'umbral no alcanzado';
    if (revealReceiver) {
      receiverText.textContent = 'NO DATA';
      receiverText.classList.remove('revealed');
      receiverText.classList.add('blocked');
      receiverState.textContent = `no alcanza el umbral: ${result.fragments_available}/${result.fragments_required} shards disponibles`;
    }
  }
}

function evaluateSession(revealReceiver = transportComplete) {
  if (!activeSession) return null;
  const result = JSON.parse(activeSession.run(missingCsv()));
  updateRecoveryUI(result, revealReceiver);
  return result;
}

function centerOf(element, rootRect) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left - rootRect.left + rect.width / 2,
    y: rect.top - rootRect.top + rect.height / 2,
  };
}

function cancelPacketsForNode(nodeIndex) {
  for (const packet of packetLayer.querySelectorAll(`[data-node-index="${nodeIndex}"]`)) {
    for (const animation of packet.getAnimations()) animation.cancel();
    packet.classList.add('killed');
    setTimeout(() => packet.remove(), 220);
  }
}

function toggleNode(index) {
  if (!nodeToggle.checked || !activeSession) return;
  if (failedNodes.has(index)) failedNodes.delete(index);
  else {
    failedNodes.add(index);
    cancelPacketsForNode(index);
  }
  evaluateSession(transportComplete);
  updateControls();
  $('nodeStatus').textContent = `${failedNodes.size} nodos caídos · reconstrucción ${currentResult?.reconstruction_possible ? 'todavía posible' : 'sin umbral'}`;
}

function failRandomNode() {
  if (!currentAssignments.length || !nodeToggle.checked) return;
  const used = [...new Set(currentAssignments.map(({ nodeIndex }) => nodeIndex))];
  const candidates = used.filter((index) => !failedNodes.has(index));
  if (!candidates.length) return;
  const index = candidates[Math.floor(Math.random() * candidates.length)];
  toggleNode(index);
}

function restoreNodes() {
  failedNodes.clear();
  evaluateSession(transportComplete);
  updateControls();
  $('nodeStatus').textContent = 'todos los nodos simulados restaurados';
}

async function animateVirtualTransport(assignments, serial) {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (serial !== runSerial || !nodeToggle.checked) return;

  const rootRect = nodeMap.getBoundingClientRect();
  const sender = centerOf(nodeMap.querySelector('.sim-endpoint.sender'), rootRect);
  const receiver = centerOf(nodeMap.querySelector('.sim-endpoint.receiver'), rootRect);
  const nodeEls = new Map(
    [...virtualNodes.querySelectorAll('.virtual-node')].map((node) => [Number(node.dataset.nodeIndex), node]),
  );
  const bySlot = resultBySlot(currentResult);
  const animations = [];

  assignments.forEach(({ fragment, nodeIndex, index }) => {
    const node = nodeEls.get(nodeIndex);
    if (!node) return;
    const target = centerOf(node, rootRect);
    const available = bySlot.get(fragment.display_slot)?.available && !failedNodes.has(nodeIndex);
    const packet = document.createElement('i');
    packet.className = `sim-packet ${available ? 'ok' : 'lost'}`;
    packet.dataset.nodeIndex = String(nodeIndex);
    packet.dataset.slot = String(fragment.display_slot);
    packet.title = `shard ${fragment.display_slot} → ${nodeLabel(nodeIndex)}`;
    packetLayer.append(packet);

    const start = { x: sender.x - 4, y: sender.y - 4 };
    const mid = { x: target.x - 4, y: target.y - 4 };
    const end = available
      ? { x: receiver.x - 4, y: receiver.y - 4 }
      : { x: target.x - 4, y: target.y - 4 };

    const delay = index * 32;
    const animation = packet.animate([
      { transform: `translate(${start.x}px, ${start.y}px) scale(.55)`, opacity: 0 },
      { transform: `translate(${start.x}px, ${start.y}px) scale(1)`, opacity: 1, offset: 0.08 },
      { transform: `translate(${mid.x}px, ${mid.y}px) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${end.x}px, ${end.y}px) scale(.72)`, opacity: available ? 0.92 : 0, offset: 0.93 },
      { transform: `translate(${end.x}px, ${end.y}px) scale(.35)`, opacity: 0 },
    ], {
      duration: available ? 940 : 720,
      delay,
      easing: 'cubic-bezier(.2,.7,.2,1)',
      fill: 'forwards',
    });

    animation.finished.then(() => {
      packet.remove();
      if (serial !== runSerial) return;
      node.classList.add(available ? 'touched' : 'dropped');
    }).catch(() => {});
    animations.push(animation.finished.catch(() => {}));
  });

  await Promise.all(animations);
}

async function revealStage(stageName, duration = 260, serial = runSerial) {
  const current = document.querySelector(`[data-stage="${stageName}"]`);
  if (!current || serial !== runSerial) return;
  current.classList.add('active');
  await wait(duration);
  if (serial !== runSerial) return;
  current.classList.remove('active');
  current.classList.add('done');
}

function scheduleLiveRun() {
  updateByteCount();
  clearTimeout(liveTimer);
  if (!liveToggle.checked) return;
  liveTimer = setTimeout(() => {
    if (running) {
      pendingAutoRun = true;
      return;
    }
    runDemo('live');
  }, 420);
}

function rebuildTopology() {
  if (!baseResult || !activeSession) return;
  const nodeCount = Number(nodeInput.value);
  failedNodes = new Set([...failedNodes].filter((index) => index < nodeCount));
  currentAssignments = nodeToggle.checked ? buildAssignments(baseResult, nodeCount) : [];
  const used = nodeToggle.checked ? renderVirtualNodes(currentAssignments) : 0;
  $('networkMetric').textContent = nodeToggle.checked ? `${nodeCount} pool · ${used} usados` : 'local';
  evaluateSession(transportComplete);
  updateControls();
}

async function runDemo(source = 'manual') {
  if (running) {
    if (source === 'live') pendingAutoRun = true;
    return;
  }

  const message = input.value;
  const byteLength = encoder.encode(message).length;
  if (!message.length) {
    input.focus();
    return;
  }
  if (byteLength > 512) {
    receiverState.textContent = 'límite de la demo superado: 512 bytes UTF-8';
    return;
  }

  running = true;
  pendingAutoRun = false;
  transportComplete = false;
  const serial = ++runSerial;
  const liveRun = source === 'live';
  sendButton.disabled = true;
  sendButton.textContent = liveRun ? 'Procesando…' : 'Ejecutando…';
  clearStageState();

  try {
    if (activeSession && typeof activeSession.free === 'function') activeSession.free();
    const started = performance.now();
    activeSession = new DemoSession(message);
    baseResult = JSON.parse(activeSession.run(''));
    const elapsed = performance.now() - started;

    if (serial !== runSerial) return;

    const nodeCount = Number(nodeInput.value);
    currentAssignments = nodeToggle.checked ? buildAssignments(baseResult, nodeCount) : [];
    const usedNodes = nodeToggle.checked ? renderVirtualNodes(currentAssignments) : 0;
    currentResult = evaluateSession(false);

    $('epochLabel').textContent = `WASM ${elapsed.toFixed(2)} ms`;
    $('coreVersion').textContent = `v${baseResult.version}`;
    $('wireBytes').textContent = `${baseResult.outer_wire_bytes} B`;
    $('networkMetric').textContent = nodeToggle.checked ? `${nodeCount} pool · ${usedNodes} usados` : 'local';

    $('symbolStatus').textContent = `${baseResult.symbol_count} símbolos internos · mapa nuevo`;
    $('symbolPreview').textContent = baseResult.symbol_codes.length
      ? baseResult.symbol_codes.slice(0, 3).map((value) => value.slice(0, 16)).join('  ·  ')
      : 'vacío';
    await revealStage('symbols', liveRun ? 115 : 260, serial);

    $('cryptoStatus').textContent = 'inner AEAD ✓ · outer AEAD ✓';
    $('wirePreview').textContent = `wire ${digestShort(baseResult.outer_wire_digest)}`;
    await revealStage('crypto', liveRun ? 115 : 260, serial);

    await revealStage('fragments', liveRun ? 180 : 430, serial);

    if (nodeToggle.checked) {
      $('nodeStatus').textContent = `${nodeCount} nodos en pool · ${usedNodes} seleccionados · tocá cualquiera para matarlo`;
      const nodeStage = document.querySelector('[data-stage="nodes"]');
      nodeStage.classList.add('active');
      await animateVirtualTransport(currentAssignments, serial);
      if (serial !== runSerial) return;
      nodeStage.classList.remove('active');
      nodeStage.classList.add('done');
      currentResult = evaluateSession(false);
      $('nodeStatus').textContent = `${currentResult.fragments_available} shards llegaron · ${currentResult.fragments_lost} no disponibles`;
    } else {
      const nodeStage = document.querySelector('[data-stage="nodes"]');
      nodeStage.classList.add('skipped', 'done');
      $('nodeStatus').textContent = 'simulación desactivada · salto directo a reconstrucción local';
      $('networkMetric').textContent = 'local';
      await wait(liveRun ? 70 : 150);
    }

    transportComplete = true;
    currentResult = evaluateSession(true);
    await revealStage('reconstruct', liveRun ? 130 : 320, serial);

    if (serial !== runSerial) return;

    $('previousDigest').textContent = previousRun ? digestShort(previousRun.digest) : 'ninguno';
    $('currentDigest').textContent = digestShort(baseResult.outer_wire_digest);

    if (previousRun && previousRun.message === message) {
      $('rotationState').textContent = previousRun.digest !== baseResult.outer_wire_digest
        ? 'Mismo mensaje. Nuevo envelope confirmado.'
        : 'Inesperado: se repitió el digest del envelope.';
    } else if (previousRun) {
      $('rotationState').textContent = 'Cambió la entrada. Ejecutá este mismo texto otra vez para comparar.';
    } else {
      $('rotationState').textContent = 'Ejecutá el mismo mensaje otra vez para verificar la rotación.';
    }

    previousRun = { message, digest: baseResult.outer_wire_digest };
  } catch (error) {
    console.error(error);
    receiverState.textContent = `error de protocolo: ${String(error)}`;
    $('epochLabel').textContent = 'error';
  } finally {
    if (serial === runSerial) {
      running = false;
      sendButton.disabled = false;
      sendButton.textContent = 'Ejecutar ahora';
      updateControls();
    }
    if (pendingAutoRun && liveToggle.checked) {
      pendingAutoRun = false;
      setTimeout(() => runDemo('live'), 0);
    }
  }
}

input.addEventListener('input', scheduleLiveRun);
lossInput.addEventListener('input', () => {
  updateControls();
  if (activeSession) evaluateSession(transportComplete);
});
nodeInput.addEventListener('input', () => {
  updateControls();
  rebuildTopology();
});
nodeToggle.addEventListener('change', () => {
  updateControls();
  rebuildTopology();
});
liveToggle.addEventListener('change', () => {
  updateControls();
  if (liveToggle.checked) scheduleLiveRun();
  else clearTimeout(liveTimer);
});
failNodeButton.addEventListener('click', failRandomNode);
restoreNodesButton.addEventListener('click', restoreNodes);
sendButton.addEventListener('click', () => runDemo('manual'));
input.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') runDemo('manual');
});

try {
  await init();
  runtime.classList.add('ready');
  runtimeLabel.textContent = `Rust/WASM real · v${sigil_demo_version()}`;
  updateByteCount();
  updateControls();
  await runDemo('manual');
} catch (error) {
  console.error(error);
  runtimeLabel.textContent = 'WASM no pudo cargar';
  sendButton.disabled = true;
  receiverState.textContent = 'No se pudo inicializar el core WebAssembly.';
}
