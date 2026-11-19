/***********************************************************************
 * 1B. MULTIPLAYER ENGINE (CROSS-TAB LAN, ONLINE P2P WEBRTC & LOCAL 2P)
 ***********************************************************************/
const mpState = {
  active: false,
  transport: "lan", // 'lan' | 'online' | 'local2p'
  role: "solo", // 'solo' | 'host' | 'guest'
  roomCode: "",
  myId: "p_" + Math.random().toString(36).slice(2, 8),
  myName: "Sovereign",
  myTeam: "radiant",
  fillBots: true,
  p2HeroId: "malakor",
  p2Team: "dire",
  bc: null,
  peer: null,
  conns: new Map(),
  fastDataChannels: new Map(),
  players: new Map(),
  discoveredRooms: new Map(),
  syncAccum: 0,
  announceAccum: 0,
  joySendAccum: 0,
  pingAccum: 0,
  pingMs: null,
  peerPings: new Map(),
  knownNetIds: new Set(),
  lastEntitySig: new Map(),
  lastHeroExtras: new Map(),
  pendingRemovals: new Set(),
  lastSyncReqTime: 0,
  lastSnapApplyTime: 0,
  cmdSeq: 0,
  lastCmdSentAt: 0,
  staggerCursor: 0,
  staggerSkip: 0,
  heartbeatAccum: 0,
  bytesSent: 0,
  bytesRecv: 0,
  iceModeLabel: "",
  turnProvider: "cloudflare", // 'cloudflare' | 'express' | 'metered'
  cfIceServers: null,
  cfIceExpiresAt: 0,
  fxEventQueue: [],
};

function mpQueueFxEvent(evTuple) {
  if (!mpState.active || mpState.role !== "host") return;
  if (!mpState.fxEventQueue) mpState.fxEventQueue = [];
  if (mpState.fxEventQueue.length < 42)
    mpState.fxEventQueue.push(evTuple);
}
let localP2Hero = null;
const p2MoveKeys = { up: false, down: false, left: false, right: false };

function initBroadcastChannel() {
  if (!mpState._storageHooked) {
    mpState._storageHooked = true;
    window.addEventListener("storage", (ev) => {
      if (ev.key === "dota3d_sovereign_mp_pkt_v60" && ev.newValue) {
        try {
          const parsed = JSON.parse(ev.newValue);
          if (parsed && parsed.payload) mpHandlePacket(parsed.payload);
        } catch (e) {}
      }
    });
  }
  if (mpState.bc || typeof BroadcastChannel === "undefined") return;
  try {
    mpState.bc = new BroadcastChannel("dota3d_sovereign_mp_v60");
    mpState.bc.onmessage = (ev) => mpHandlePacket(ev.data);
  } catch (e) {}
}
initBroadcastChannel();

function mpGenerateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function mpGetLocalPlayerRecord() {
  const nameEl = document.getElementById("mp-player-name");
  const teamEl = document.getElementById("mp-team-select");
  mpState.myName =
    nameEl && nameEl.value.trim() ? nameEl.value.trim() : mpState.myName;
  mpState.myTeam = teamEl ? teamEl.value : mpState.myTeam;
  return {
    id: mpState.myId,
    name: mpState.myName,
    heroId: selectedHeroId,
    team: mpState.myTeam,
    isHost: mpState.role === "host",
  };
}

function updateMpRelayUsageDisplay() {
  const pill = document.getElementById("mp-relay-usage-pill");
  if (!pill) return;
  const totalMb =
    ((mpState.bytesSent || 0) + (mpState.bytesRecv || 0)) / (1024 * 1024);
  pill.textContent = `${totalMb.toFixed(2)} MB`;
}

function estimatePacketBytes(packet) {
  if (!packet) return 64;
  if (packet.type === "WORLD_SNAP" && packet.snap) {
    const s = packet.snap;
    return (
      96 +
      (s.sp ? s.sp.length * 140 : 0) +
      (s.m ? s.m.length * 46 : 0) +
      (s.h ? s.h.length * 115 : 0) +
      (s.ev ? s.ev.length * 32 : 0)
    );
  }
  return 140;
}

function mpSendNativeFastDc(dc, packet, estBytes = 0) {
  if (!dc || dc.readyState !== "open") return false;
  if (dc.bufferedAmount > 16384) return true; // Drop delta cleanly under congestion
  try {
    const raw = JSON.stringify(packet);
    if (raw.length > 12000) return false; // Fall back to reliable chunked channel for huge packets
    mpState.bytesSent =
      (mpState.bytesSent || 0) + (estBytes || raw.length);
    dc.send(raw);
    return true;
  } catch (e) {
    return false;
  }
}

function mpSendOverConn(
  conn,
  packet,
  preSerializedRaw = null,
  estBytes = 0,
) {
  if (!conn || !conn.open) return;
  const isDeltaSnap =
    packet &&
    packet.type === "WORLD_SNAP" &&
    (!packet.snap || !packet.snap.full);
  if (isDeltaSnap) {
    const dc = conn.dataChannel || conn._dc;
    if (dc && dc.bufferedAmount > 16384) return;
  }
  try {
    const mayNeedChunk =
      packet &&
      ((packet.type === "WORLD_SNAP" &&
        packet.snap &&
        packet.snap.full) ||
        packet.type === "LOBBY_SYNC");
    if (!mayNeedChunk && preSerializedRaw === null) {
      mpState.bytesSent =
        (mpState.bytesSent || 0) +
        (estBytes || estimatePacketBytes(packet));
      conn.send(packet);
      return;
    }
    const raw =
      preSerializedRaw !== null
        ? preSerializedRaw
        : JSON.stringify(packet);
    mpState.bytesSent = (mpState.bytesSent || 0) + raw.length;
    const MAX_CHUNK = 11000;
    if (raw.length <= MAX_CHUNK) {
      conn.send(packet);
      return;
    }
    const cid = Math.random().toString(36).slice(2, 9);
    const tot = Math.ceil(raw.length / MAX_CHUNK);
    for (let idx = 0; idx < tot; idx++) {
      conn.send({
        type: "CHUNK",
        senderId: mpState.myId,
        roomCode: mpState.roomCode,
        cid,
        idx,
        tot,
        data: raw.slice(idx * MAX_CHUNK, (idx + 1) * MAX_CHUNK),
      });
    }
  } catch (e) {}
}

function mpBroadcast(msg) {
  const packet = {
    ...msg,
    senderId: mpState.myId,
    roomCode: mpState.roomCode,
  };
  if (mpState.transport === "lan") {
    if (mpState.bc) {
      try {
        mpState.bc.postMessage(packet);
      } catch (e) {}
    } else {
      try {
        localStorage.setItem(
          "dota3d_sovereign_mp_pkt_v60",
          JSON.stringify({ nonce: Math.random(), payload: packet }),
        );
      } catch (e) {}
    }
  }
  if (mpState.conns.size > 0) {
    const useFastChannel =
      (packet.type === "WORLD_SNAP" &&
        (!packet.snap || !packet.snap.full)) ||
      packet.type === "PING_REQ" ||
      packet.type === "PING_PONG";
    const raw = JSON.stringify(packet);
    const est = raw.length;
    mpState.conns.forEach((conn, key) => {
      if (useFastChannel && est <= 12000) {
        const fastDc = mpState.fastDataChannels.get(key);
        if (fastDc && fastDc.readyState === "open") {
          if (fastDc.bufferedAmount <= 24576) {
            try {
              mpState.bytesSent = (mpState.bytesSent || 0) + est;
              fastDc.send(raw);
            } catch (e) {}
          }
          return;
        }
      }
      mpSendOverConn(conn, packet, raw, est);
    });
  }
}

function mpSendToHost(msg) {
  if (mpState.role !== "guest") return;
  if (msg && msg.type === "CMD") {
    mpState.cmdSeq = (mpState.cmdSeq || 0) + 1;
    mpState.lastCmdSentAt = performance.now();
    msg = { ...msg, cmdSeq: mpState.cmdSeq };
  }
  mpBroadcast(msg);
}

function mpAppendChatMessage(sender, text, team = "radiant") {
  const feed = document.getElementById("mp-chat-feed");
  if (!feed) return;
  const row = document.createElement("div");
  const colCls =
    team === "dire"
      ? "text-rose-300 border-rose-500/45"
      : "text-emerald-300 border-emerald-500/45";
  row.className = `px-3 py-1 rounded-full bg-slate-950/90 border ${colCls} text-[11px] font-semibold shadow-lg backdrop-blur-xs transition-opacity duration-500`;
  row.innerHTML = `<span class="font-cinzel font-black mr-1">${sender}:</span><span class="text-slate-100 font-sans">${text.replace(/</g, "&lt;")}</span>`;
  feed.appendChild(row);
  while (feed.children.length > 4) feed.removeChild(feed.firstChild);
  setTimeout(() => {
    row.style.opacity = "0";
    setTimeout(() => row.remove(), 500);
  }, 5500);
}

window.toggleMpChatBar = function (forceVal) {
  const bar = document.getElementById("mp-chat-bar");
  const inp = document.getElementById("mp-chat-input");
  if (!bar) return;
  const show =
    typeof forceVal === "boolean"
      ? forceVal
      : bar.classList.contains("hidden");
  bar.classList.toggle("hidden", !show);
  if (show && inp) {
    inp.focus();
  } else if (inp) {
    inp.blur();
  }
};

window.sendMpQuickChat = function (text) {
  if (!text) return;
  const sender =
    mpState.myName || (playerHero ? playerHero.name : "Champion");
  const team = playerHero ? playerHero.team : mpState.myTeam;
  mpAppendChatMessage(sender, text, team);
  if (playerHero && !playerHero.dead)
    spawnFloatText(playerHero.mesh.position, `"${text}"`, "#38bdf8", 14);
  if (mpState.active)
    mpBroadcast({ type: "CHAT_MSG", sender, text, team });
  window.toggleMpChatBar(false);
};

window.submitMpChatInput = function () {
  const inp = document.getElementById("mp-chat-input");
  if (!inp) return;
  const txt = inp.value.trim();
  inp.value = "";
  if (txt) window.sendMpQuickChat(txt);
  else window.toggleMpChatBar(false);
};

function renderDiscoveredRooms() {
  const box = document.getElementById("mp-discovered-rooms");
  if (!box) return;
  const now = performance.now();
  for (const [code, info] of mpState.discoveredRooms.entries()) {
    if (now - info.ts > 6000) mpState.discoveredRooms.delete(code);
  }
  if (mpState.discoveredRooms.size === 0 || mpState.role !== "solo") {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = "";
  mpState.discoveredRooms.forEach((info, code) => {
    const div = document.createElement("div");
    div.className =
      "flex items-center justify-between bg-cyan-950/45 border border-cyan-400/50 rounded-lg px-2.5 py-1.5";
    div.innerHTML = `
              <div>
                  <span class="font-cinzel font-bold text-cyan-200">LIVE LAN ROOM [${code}]</span>
                  <span class="text-slate-300 ml-2">Host: ${info.hostName} (${info.count} Player${info.count > 1 ? "s" : ""})</span>
              </div>
              <button type="button" onclick="window.joinMultiplayerRoom('${code}')" class="px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-cinzel font-black text-[10px]">JOIN ROOM</button>
          `;
    box.appendChild(div);
  });
}

function renderMpRoster() {
  const list = document.getElementById("mp-roster-list");
  const badge = document.getElementById("mp-room-badge");
  const btnLabel = document.getElementById("mp-lobby-btn-label");
  const launchBtn = document.getElementById("btn-mp-launch");
  if (!list) return;

  list.innerHTML = "";
  if (mpState.transport === "local2p") {
    const p1Cfg = HERO_ROSTER[selectedHeroId] || HERO_ROSTER.aurelius;
    const p2Sel = document.getElementById("mp-p2-hero");
    const p2TeamSel = document.getElementById("mp-p2-team");
    if (p2Sel && p2Sel.value) mpState.p2HeroId = p2Sel.value;
    if (p2TeamSel && p2TeamSel.value) mpState.p2Team = p2TeamSel.value;
    const p2Cfg = HERO_ROSTER[mpState.p2HeroId] || HERO_ROSTER.malakor;

    if (badge) badge.textContent = "Local 2-Player Shared Screen";
    if (btnLabel) btnLabel.textContent = "2P Local Ready";
    if (launchBtn) {
      launchBtn.disabled = false;
      launchBtn.classList.remove("opacity-50");
    }

    [
      {
        label: "Player 1 (Mouse + QWER)",
        name: p1Cfg.name,
        team: "radiant",
      },
      {
        label: "Player 2 (Arrows + U/I/O/P)",
        name: p2Cfg.name,
        team: mpState.p2Team,
      },
    ].forEach((row) => {
      const el = document.createElement("div");
      el.className =
        "flex items-center justify-between bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-1.5";
      el.innerHTML = `<span class="font-bold text-slate-200">${row.label} • <span class="text-amber-300">${row.name}</span></span>
                  <span class="uppercase font-cinzel font-black text-[10px] px-2 py-0.5 rounded ${row.team === "radiant" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}">${row.team}</span>`;
      list.appendChild(el);
    });
    return;
  }

  if (mpState.role === "solo") {
    if (badge) badge.textContent = "Not Connected (Click Host or Join)";
    if (btnLabel) btnLabel.textContent = "Multiplayer";
    if (launchBtn) {
      launchBtn.disabled = false;
      launchBtn.classList.remove("opacity-50");
    }
    const p = mpGetLocalPlayerRecord();
    const hCfg = HERO_ROSTER[p.heroId] || HERO_ROSTER.aurelius;
    list.innerHTML = `<div class="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300">
              <span>${p.name} (You) • <strong class="text-amber-300">${hCfg.name}</strong></span>
              <span class="uppercase font-bold text-[10px] ${p.team === "radiant" ? "text-emerald-400" : "text-rose-400"}">${p.team}</span>
          </div>`;
    return;
  }

  const balBtn = document.getElementById("btn-mp-autobalance");
  if (balBtn)
    balBtn.classList.toggle(
      "hidden",
      !(mpState.role === "host" && mpState.players.size >= 2),
    );

  let radP = 0,
    direP = 0;
  mpState.players.forEach((pl) => {
    if (pl.team === "dire") direP++;
    else radP++;
  });
  const modeTag = mpState.players.size >= 2 ? ` • ${radP}v${direP}` : "";
  if (badge)
    badge.textContent = `${mpState.role.toUpperCase()} • ROOM [${mpState.roomCode}] (${mpState.players.size}/10P${modeTag})`;
  if (btnLabel)
    btnLabel.textContent = `Room ${mpState.roomCode} (${mpState.players.size}P)`;
  if (launchBtn) {
    launchBtn.disabled = mpState.role === "guest";
    launchBtn.classList.toggle("opacity-50", mpState.role === "guest");
    launchBtn.querySelector("span").textContent =
      mpState.role === "guest"
        ? "WAITING FOR HOST TO START..."
        : "LAUNCH MULTIPLAYER ARENA";
  }

  mpState.players.forEach((p) => {
    const hCfg = HERO_ROSTER[p.heroId] || HERO_ROSTER.aurelius;
    const el = document.createElement("div");
    el.className =
      "flex items-center justify-between bg-slate-900/95 border border-cyan-500/35 rounded-lg px-3 py-1.5";
    el.innerHTML = `
              <div class="flex items-center gap-2">
                  <i class="fa-solid ${p.isHost ? "fa-crown text-amber-400" : "fa-user text-cyan-300"}"></i>
                  <span class="font-bold text-white">${p.name}${p.id === mpState.myId ? " (You)" : ""}</span>
                  <span class="text-amber-300 font-semibold">• ${hCfg.name}</span>
              </div>
              <span class="uppercase font-cinzel font-black text-[10px] px-2 py-0.5 rounded ${p.team === "radiant" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}">${p.team}</span>
          `;
    const pPing =
      p.id === mpState.myId
        ? mpState.pingMs
        : mpState.peerPings.get(p.id);
    if (typeof pPing === "number") {
      const pingSpan = document.createElement("span");
      const pCls =
        pPing < 85
          ? "text-emerald-300"
          : pPing < 165
            ? "text-amber-300"
            : "text-rose-400";
      pingSpan.className = `font-mono text-[10px] font-bold ml-2 ${pCls}`;
      pingSpan.textContent = `${Math.round(pPing)} ms`;
      el.querySelector("div").appendChild(pingSpan);
    }
    list.appendChild(el);
  });
}

window.openMultiplayerModal = function () {
  ensurePeerJsLoaded();
  const p2Sel = document.getElementById("mp-p2-hero");
  if (p2Sel && p2Sel.options.length === 0) {
    Object.values(HERO_ROSTER).forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h.id;
      opt.textContent = `${h.name} (${h.title})`;
      if (h.id === mpState.p2HeroId) opt.selected = true;
      p2Sel.appendChild(opt);
    });
  }
  window.syncMpLobbyMeta();
  renderDiscoveredRooms();
  renderMpRoster();
  if (mpState.turnProvider === "cloudflare") {
    ensureCloudflareIceServers(true);
  }
  document.getElementById("multiplayer-modal").classList.remove("hidden");
};

window.closeMultiplayerModal = function () {
  document.getElementById("multiplayer-modal").classList.add("hidden");
};

window.setMpTransport = function (mode) {
  mpState.transport = mode;
  ["lan", "online", "local2p"].forEach((m) => {
    const btn = document.getElementById(`mp-tab-${m}`);
    if (btn) btn.classList.toggle("active-setting", m === mode);
  });
  const netPanel = document.getElementById("mp-network-panel");
  const l2Panel = document.getElementById("mp-local2p-panel");
  const hint = document.getElementById("mp-network-hint");
  if (netPanel) netPanel.classList.toggle("hidden", mode === "local2p");
  if (l2Panel) l2Panel.classList.toggle("hidden", mode !== "local2p");
  if (hint) {
    hint.innerHTML =
      mode === "online"
        ? "Click <strong>Host Room</strong> to generate a 4-character Online P2P Room Code via WebRTC, and share it with your friend!"
        : "Open this HTML file in a second browser tab/window and click <strong>Host Room</strong> in one tab and <strong>Join</strong> in the other!";
  }
  renderMpRoster();
};

window.autoBalanceMpTeams = function () {
  if (mpState.role !== "host" || mpState.players.size < 2) return;
  let idx = 0;
  mpState.players.forEach((p, id) => {
    const nextTeam = idx % 2 === 0 ? "radiant" : "dire";
    p.team = nextTeam;
    if (id === mpState.myId) {
      mpState.myTeam = nextTeam;
      const teamEl = document.getElementById("mp-team-select");
      if (teamEl) teamEl.value = nextTeam;
    }
    idx++;
  });
  mpBroadcast({
    type: "LOBBY_SYNC",
    players: Array.from(mpState.players.entries()),
    aiDifficulty,
    fillBots: mpState.fillBots,
  });
  renderMpRoster();
};

window.syncMpLobbyMeta = function () {
  const fillCb = document.getElementById("mp-fill-bots");
  if (fillCb) mpState.fillBots = fillCb.checked;
  const me = mpGetLocalPlayerRecord();
  if (mpState.role === "host") {
    mpState.players.set(mpState.myId, me);
    mpBroadcast({
      type: "LOBBY_SYNC",
      players: Array.from(mpState.players.entries()),
      aiDifficulty,
      fillBots: mpState.fillBots,
    });
  } else if (mpState.role === "guest") {
    mpSendToHost({ type: "PLAYER_UPDATE", player: me });
  }
  renderMpRoster();
};

function setMpConnStatus(state, text) {
  const dot = document.getElementById("mp-conn-dot");
  const lbl = document.getElementById("mp-conn-status-text");
  if (lbl) lbl.textContent = text;
  if (dot) {
    const colorMap = {
      idle: "bg-slate-500",
      connecting: "bg-amber-400 animate-ping",
      ready: "bg-emerald-400 animate-pulse",
      connected: "bg-cyan-400 animate-pulse",
      error: "bg-rose-500",
    };
    dot.className = `w-2.5 h-2.5 rounded-full shrink-0 ${colorMap[state] || "bg-slate-500"}`;
  }
}

const CF_TURN_WORKER_URL = "https://moba.takdevs01.workers.dev/";

const RELAY_PROVIDER_META = {
  cloudflare: {
    label: "Cloudflare TURN",
    shortTag: "CF",
    readyText:
      "Ready • Cloudflare Global Anycast TURN + Dual-Channel Low-Ping Active",
    panelTitle:
      "TURN Relay Controls & Optional Override (Cloudflare Anycast Active):",
  },
  express: {
    label: "ExpressTURN",
    shortTag: "EXP",
    readyText:
      "Ready • ExpressTURN (UDP + TCP 3478/443) + Dual-Channel Active",
    panelTitle:
      "TURN Relay Controls & Optional Override (ExpressTURN Active):",
  },
  metered: {
    label: "Metered (Old)",
    shortTag: "MTR",
    readyText: "Ready • Metered Legacy TURN + Dual-Channel Active",
    panelTitle:
      "TURN Relay Controls & Optional Override (Metered Old Active):",
  },
};

function getRelayProviderLabel(prov = mpState.turnProvider) {
  return (RELAY_PROVIDER_META[prov] || RELAY_PROVIDER_META.cloudflare)
    .label;
}

function updateRelayProviderButtonsUI() {
  const cur = mpState.turnProvider || "cloudflare";
  ["cloudflare", "express", "metered"].forEach((p) => {
    const btn = document.getElementById(`mp-relay-btn-${p}`);
    if (btn) btn.classList.toggle("active-setting", p === cur);
  });
  const titleEl = document.getElementById("mp-active-relay-title");
  if (titleEl && RELAY_PROVIDER_META[cur]) {
    titleEl.textContent = RELAY_PROVIDER_META[cur].panelTitle;
  }
}

window.setMpTurnProvider = function (provider, silent = false) {
  const valid = ["cloudflare", "express", "metered"].includes(provider)
    ? provider
    : "cloudflare";
  mpState.turnProvider = valid;
  try {
    localStorage.setItem("dota3d_turn_provider_v77", valid);
  } catch (e) {}
  updateRelayProviderButtonsUI();
  if (!silent && mpState.role === "solo") {
    setMpConnStatus("ready", RELAY_PROVIDER_META[valid].readyText);
  }
  if (valid === "cloudflare") {
    ensureCloudflareIceServers(true);
  }
};

async function ensureCloudflareIceServers(silent = false) {
  const now = Date.now();
  if (
    Array.isArray(mpState.cfIceServers) &&
    mpState.cfIceServers.length > 0 &&
    now < mpState.cfIceExpiresAt
  ) {
    return mpState.cfIceServers;
  }
  try {
    const cachedRaw = localStorage.getItem("dota3d_cf_ice_cache_v77");
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (
        cached &&
        Array.isArray(cached.iceServers) &&
        cached.iceServers.length > 0 &&
        now < (cached.expiresAt || 0)
      ) {
        mpState.cfIceServers = cached.iceServers;
        mpState.cfIceExpiresAt = cached.expiresAt;
        return mpState.cfIceServers;
      }
    }
  } catch (e) {}

  if (!silent) {
    setMpConnStatus(
      "connecting",
      "Minting short-lived Cloudflare Anycast TURN credentials...",
    );
  }
  try {
    const ctrl =
      typeof AbortController !== "undefined"
        ? new AbortController()
        : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 4500) : null;
    const res = await fetch(CF_TURN_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (
      data &&
      Array.isArray(data.iceServers) &&
      data.iceServers.length > 0
    ) {
      const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // Cache 12h (24h TTL)
      mpState.cfIceServers = data.iceServers;
      mpState.cfIceExpiresAt = expiresAt;
      try {
        localStorage.setItem(
          "dota3d_cf_ice_cache_v77",
          JSON.stringify({
            iceServers: data.iceServers,
            expiresAt,
          }),
        );
      } catch (e) {}
      if (!silent && mpState.role === "solo") {
        setMpConnStatus(
          "ready",
          "Cloudflare Anycast TURN Credentials Ready (1,000 GB/mo)!",
        );
      }
      return data.iceServers;
    }
  } catch (err) {
    if (!silent) {
      setMpConnStatus(
        "connecting",
        "Cloudflare API unreachable from browser — using ExpressTURN backup...",
      );
    }
  }
  return null;
}

window.saveMpTurnPrefs = function () {
  try {
    const cUrl = document.getElementById("mp-custom-turn-url");
    const cUser = document.getElementById("mp-custom-turn-user");
    const cPass = document.getElementById("mp-custom-turn-pass");
    localStorage.setItem(
      "dota3d_turn_prefs_v71",
      JSON.stringify({
        url: cUrl ? cUrl.value.trim() : "",
        user: cUser ? cUser.value.trim() : "",
        pass: cPass ? cPass.value.trim() : "",
      }),
    );
  } catch (e) {}
};

window.resetMpTurnPrefs = function () {
  try {
    localStorage.removeItem("dota3d_turn_prefs_v71");
    localStorage.removeItem("dota3d_cf_ice_cache_v77");
  } catch (e) {}
  mpState.cfIceServers = null;
  mpState.cfIceExpiresAt = 0;
  const cUrl = document.getElementById("mp-custom-turn-url");
  const cUser = document.getElementById("mp-custom-turn-user");
  const cPass = document.getElementById("mp-custom-turn-pass");
  const fRelay = document.getElementById("mp-force-relay");
  if (cUrl) cUrl.value = "";
  if (cUser) cUser.value = "";
  if (cPass) cPass.value = "";
  if (fRelay) fRelay.checked = false;
  window.setMpTurnProvider("cloudflare", false);
};

(function restoreMpTurnPrefs() {
  try {
    const savedProv = localStorage.getItem("dota3d_turn_provider_v77");
    if (
      savedProv &&
      ["cloudflare", "express", "metered"].includes(savedProv)
    ) {
      mpState.turnProvider = savedProv;
    }
    updateRelayProviderButtonsUI();
    const raw = localStorage.getItem("dota3d_turn_prefs_v71");
    if (raw) {
      const prefs = JSON.parse(raw);
      const cUrl = document.getElementById("mp-custom-turn-url");
      const cUser = document.getElementById("mp-custom-turn-user");
      const cPass = document.getElementById("mp-custom-turn-pass");
      if (cUrl && prefs.url) cUrl.value = prefs.url;
      if (cUser && prefs.user) cUser.value = prefs.user;
      if (cPass && prefs.pass) cPass.value = prefs.pass;
    }
  } catch (e) {}
})();

function getExpressTurnEntries() {
  return {
    urls: [
      "turn:free.expressturn.com:3478?transport=udp",
      "turn:free.expressturn.com:3478?transport=tcp",
      "turn:free.expressturn.com:443?transport=udp",
      "turn:free.expressturn.com:443?transport=tcp",
    ],
    username: "000000002110078584",
    credential: "Vlg3xY13QbYMFkldofvLpO2CCrw=",
  };
}

function getMeteredTurnEntries() {
  return [
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "411fc0a2ffc61a5ad7d64b54",
      credential: "pPjyQknn9vnGzG1d",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "411fc0a2ffc61a5ad7d64b54",
      credential: "pPjyQknn9vnGzG1d",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "411fc0a2ffc61a5ad7d64b54",
      credential: "pPjyQknn9vnGzG1d",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "411fc0a2ffc61a5ad7d64b54",
      credential: "pPjyQknn9vnGzG1d",
    },
  ];
}

function getMpPeerOptions(useBackupRelay = false) {
  const fRelay = document.getElementById("mp-force-relay");
  const forceRelay = Boolean(fRelay && fRelay.checked);
  const prov = mpState.turnProvider || "cloudflare";
  const iceServers = [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.expressturn.com:3478" },
  ];

  if (prov === "cloudflare") {
    if (
      Array.isArray(mpState.cfIceServers) &&
      mpState.cfIceServers.length > 0
    ) {
      mpState.cfIceServers.forEach((srv) => iceServers.push(srv));
    } else {
      iceServers.push(getExpressTurnEntries());
    }
    if (useBackupRelay) {
      iceServers.push(getExpressTurnEntries());
    }
  } else if (prov === "express") {
    iceServers.push(getExpressTurnEntries());
    if (useBackupRelay) {
      getMeteredTurnEntries().forEach((srv) => iceServers.push(srv));
    }
  } else {
    getMeteredTurnEntries().forEach((srv) => iceServers.push(srv));
    if (useBackupRelay) {
      iceServers.push(getExpressTurnEntries());
    }
  }

  const cUrl = document.getElementById("mp-custom-turn-url");
  const cUser = document.getElementById("mp-custom-turn-user");
  const cPass = document.getElementById("mp-custom-turn-pass");
  if (cUrl && cUrl.value.trim()) {
    let rawTurnUrl = cUrl.value.trim();
    if (!/^turns?:/i.test(rawTurnUrl)) rawTurnUrl = `turn:${rawTurnUrl}`;
    iceServers.unshift({
      urls: rawTurnUrl,
      username: cUser ? cUser.value.trim() : "",
      credential: cPass ? cPass.value.trim() : "",
    });
  }
  const rtcConfig = {
    iceServers,
    iceCandidatePoolSize: 4,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
  if (forceRelay) {
    rtcConfig.iceTransportPolicy = "relay";
  }
  return {
    debug: 1,
    secure: true,
    pingInterval: 4000,
    config: rtcConfig,
  };
}

window.testTurnRelayAllocation = async function () {
  const prov = mpState.turnProvider || "cloudflare";
  const provName = getRelayProviderLabel(prov);
  if (prov === "cloudflare") {
    await ensureCloudflareIceServers(false);
  }
  const opts = getMpPeerOptions(false);
  setMpConnStatus(
    "connecting",
    `Testing ${provName} candidate allocation...`,
  );
  try {
    const pc = new RTCPeerConnection({
      iceServers: opts.config.iceServers,
      iceTransportPolicy: "relay",
    });
    pc.createDataChannel("turn-probe");
    let gotRelay = false;
    const finish = (ok, detail) => {
      if (pc._done) return;
      pc._done = true;
      try {
        pc.close();
      } catch (e) {}
      if (ok)
        setMpConnStatus(
          "ready",
          `${provName} Verified (${detail}) • Ready for Online P2P!`,
        );
      else
        setMpConnStatus(
          "error",
          `${provName} Probe Failed (${detail}) • Try switching Relay Server`,
        );
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate && ev.candidate.candidate) {
        const c = ev.candidate.candidate;
        if (c.includes("typ relay")) {
          gotRelay = true;
          const proto = c.includes(" tcp ") ? "TCP" : "UDP";
          finish(true, `${proto} Relay Allocated`);
        }
      } else if (!ev.candidate && !gotRelay) {
        finish(false, "No relay candidate returned");
      }
    };
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch((err) => finish(false, err.message || "Offer error"));
    setTimeout(() => {
      if (!pc._done)
        finish(
          gotRelay,
          gotRelay ? "Relay Allocated" : "Timed out after 7s",
        );
    }, 7000);
  } catch (e) {
    setMpConnStatus("error", "WebRTC not supported in this browser");
  }
};

function attachFastDataChannelOnHost(conn) {
  const pc = conn && conn.peerConnection;
  if (!pc || pc._fastDcHooked) return;
  pc._fastDcHooked = true;
  pc.addEventListener("datachannel", (ev) => {
    const dc = ev.channel;
    if (dc && dc.label === "fast-state") {
      const bindDc = () => {
        mpState.fastDataChannels.set(conn.peer, dc);
      };
      if (dc.readyState === "open") bindDc();
      else dc.addEventListener("open", bindDc);
      dc.addEventListener("message", (mev) => {
        try {
          const data =
            typeof mev.data === "string"
              ? JSON.parse(mev.data)
              : mev.data;
          if (data && data.senderId) conn._playerId = data.senderId;
          mpState.bytesRecv =
            (mpState.bytesRecv || 0) +
            (typeof mev.data === "string" ? mev.data.length : 96);
          mpHandlePacket(data);
        } catch (e) {}
      });
      dc.addEventListener("close", () => {
        mpState.fastDataChannels.delete(conn.peer);
      });
    }
  });
}

function bindGuestFastDc(dc) {
  if (!dc) return;
  const markOpen = () => {
    mpState.fastDataChannels.set("host", dc);
  };
  if (dc.readyState === "open") markOpen();
  else dc.addEventListener("open", markOpen);
  dc.addEventListener("message", (mev) => {
    try {
      const data =
        typeof mev.data === "string" ? JSON.parse(mev.data) : mev.data;
      mpState.bytesRecv =
        (mpState.bytesRecv || 0) +
        (typeof mev.data === "string" ? mev.data.length : 120);
      mpHandlePacket(data);
    } catch (e) {}
  });
  dc.addEventListener("close", () => {
    mpState.fastDataChannels.delete("host");
  });
}

function prepareFastDataChannelBeforeOffer(conn) {
  const pc = conn && conn.peerConnection;
  if (!pc || pc._fastOfferHooked) return;
  pc._fastOfferHooked = true;
  if (typeof pc.createOffer === "function") {
    const origCreateOffer = pc.createOffer.bind(pc);
    pc.createOffer = function (...args) {
      if (
        !pc._fastDcCreated &&
        typeof pc.createDataChannel === "function"
      ) {
        pc._fastDcCreated = true;
        try {
          const dc = pc.createDataChannel("fast-state", {
            ordered: false,
            maxRetransmits: 0,
          });
          bindGuestFastDc(dc);
        } catch (e) {}
      }
      return origCreateOffer(...args);
    };
  }
}

function attachIceDiagnostics(conn, roleLabel, code) {
  const pc = conn && conn.peerConnection;
  if (!pc || pc._diagAttached) return;
  pc._diagAttached = true;
  pc._sawRelay = false;
  pc._sawSrflx = false;

  pc.addEventListener("icecandidate", (ev) => {
    if (ev.candidate && ev.candidate.candidate) {
      const c = ev.candidate.candidate;
      if (c.includes("typ relay")) pc._sawRelay = true;
      if (c.includes("typ srflx")) pc._sawSrflx = true;
    }
  });

  pc.addEventListener("iceconnectionstatechange", () => {
    const st = pc.iceConnectionState;
    if (st === "checking" && !conn.open) {
      const candTag = pc._sawRelay
        ? "TURN Relay Ready"
        : pc._sawSrflx
          ? "STUN Ready"
          : "Gathering Candidates";
      setMpConnStatus(
        "connecting",
        `ICE Checking (${candTag}) for Room [${code}]...`,
      );
    } else if (st === "failed") {
      setMpConnStatus(
        "connecting",
        "ICE Path Stalled — Restarting ICE...",
      );
      try {
        if (typeof pc.restartIce === "function") pc.restartIce();
      } catch (e) {}
    } else if (
      (st === "connected" || st === "completed") &&
      typeof pc.getStats === "function"
    ) {
      pc.getStats()
        .then((stats) => {
          let pairType = pc._sawRelay ? "TURN Relay" : "Direct P2P";
          stats.forEach((rep) => {
            if (
              rep.type === "candidate-pair" &&
              rep.state === "succeeded" &&
              rep.nominated
            ) {
              const loc = stats.get(rep.localCandidateId);
              const rem = stats.get(rep.remoteCandidateId);
              if (
                (loc && loc.candidateType === "relay") ||
                (rem && rem.candidateType === "relay")
              ) {
                pairType = "TURN Relay";
              } else if (loc && loc.candidateType === "srflx") {
                pairType = "STUN P2P";
              }
            }
          });
          mpState.iceModeLabel = pairType;
          const hudPillTxt =
            document.getElementById("mp-hud-status-text");
          const pTag = (
            RELAY_PROVIDER_META[mpState.turnProvider] ||
            RELAY_PROVIDER_META.cloudflare
          ).shortTag;
          if (hudPillTxt && mpState.active) {
            hudPillTxt.textContent =
              roleLabel === "host"
                ? `MP HOST • ${mpState.roomCode} • ${pairType} (${pTag})`
                : `MP GUEST • ${mpState.roomCode} • ${pairType} (${pTag})`;
          }
          if (roleLabel === "host") {
            setMpConnStatus(
              "connected",
              `Connected (${pairType}) • ${mpState.conns.size}/9 Guests (${mpState.conns.size + 1}P Total)`,
            );
          } else {
            setMpConnStatus(
              "connected",
              `Connected to Room [${code}] via ${pairType}! Waiting for Host...`,
            );
          }
        })
        .catch(() => {});
    }
  });
}

async function setupPeerHost(code, attempt = 1) {
  if (window.location.protocol === "content:") {
    setMpConnStatus(
      "error",
      "Opened in WhatsApp viewer (content://) — save HTML to Downloads and open in Chrome/Safari!",
    );
    return;
  }
  if (typeof Peer === "undefined") {
    setMpConnStatus("connecting", "Loading Online P2P engine...");
    await ensurePeerJsLoaded();
  }
  if (typeof Peer === "undefined") {
    setMpConnStatus(
      "error",
      "Online P2P script unavailable (check internet) • Local LAN still works",
    );
    return;
  }
  try {
    if (mpState.peer) {
      try {
        mpState.peer.destroy();
      } catch (e) {}
    }
    mpState.conns.clear();
    mpState.fastDataChannels.clear();
    const provName = getRelayProviderLabel();
    if (mpState.turnProvider === "cloudflare") {
      await ensureCloudflareIceServers(false);
    }
    setMpConnStatus(
      "connecting",
      `Registering Room [${code}] on Signaling + ${provName}${attempt > 1 ? ` (Backup Relay ${attempt}/2)` : ""}...`,
    );
    const peer = new Peer(
      `dota3d-sov-v68-${code}`,
      getMpPeerOptions(attempt >= 2),
    );
    mpState.peer = peer;
    let opened = false;

    peer.on("open", () => {
      opened = true;
      const isLocalHost = /^localhost$|^127\.0\.0\.1$/i.test(
        window.location.hostname,
      );
      const hostNote = isLocalHost
        ? `Room [${code}] LIVE Online (${provName} Ready)! Share HTML + Code ${code}`
        : `Room [${code}] LIVE Online (${provName} Ready)! Friends join with Code ${code}`;
      setMpConnStatus("ready", hostNote);
    });

    peer.on("connection", (conn) => {
      attachIceDiagnostics(conn, "host", code);
      attachFastDataChannelOnHost(conn);
      const bindConn = () => {
        mpState.conns.set(conn.peer, conn);
        setMpConnStatus(
          "connected",
          `Remote Players Connected: ${mpState.conns.size}/9 Guests (${mpState.conns.size + 1}P Total)`,
        );
        mpSendOverConn(conn, {
          type: "LOBBY_SYNC",
          senderId: mpState.myId,
          roomCode: code,
          players: Array.from(mpState.players.entries()),
          aiDifficulty,
          fillBots: mpState.fillBots,
        });
        if (!inHeroSelect && mpState.active) {
          mpSendOverConn(conn, {
            type: "START_MATCH",
            senderId: mpState.myId,
            roomCode: code,
            players: Array.from(mpState.players.entries()),
            aiDifficulty,
            fillBots: mpState.fillBots,
          });
          mpSendOverConn(conn, {
            type: "WORLD_SNAP",
            senderId: mpState.myId,
            roomCode: code,
            snap: buildAuthoritativeSnapshot(true),
          });
        }
      };
      if (conn.open) bindConn();
      else conn.on("open", bindConn);

      conn.on("data", (data) => {
        if (data && data.senderId) conn._playerId = data.senderId;
        mpState.bytesRecv =
          (mpState.bytesRecv || 0) +
          (typeof data === "string"
            ? data.length
            : estimatePacketBytes(data));
        mpHandlePacket(data);
      });
      conn.on("close", () => {
        mpState.conns.delete(conn.peer);
        mpState.fastDataChannels.delete(conn.peer);
        if (conn._playerId) {
          mpState.players.delete(conn._playerId);
          mpState.peerPings.delete(conn._playerId);
          mpBroadcast({
            type: "LOBBY_SYNC",
            players: Array.from(mpState.players.entries()),
            aiDifficulty,
            fillBots: mpState.fillBots,
          });
          renderMpRoster();
        }
        if (mpState.conns.size > 0) {
          setMpConnStatus(
            "connected",
            `Remote Players Connected: ${mpState.conns.size}/9 Guests (${mpState.conns.size + 1}P Total)`,
          );
        } else {
          setMpConnStatus(
            "ready",
            `Room [${code}] LIVE Online! Waiting for players to join...`,
          );
        }
      });
      conn.on("error", (err) => {
        setMpConnStatus(
          "error",
          `Peer Connection Error: ${err && err.type ? err.type : "NAT blocked"}`,
        );
      });
    });

    peer.on("disconnected", () => {
      if (
        mpState.role === "host" &&
        mpState.peer &&
        !mpState.peer.destroyed
      ) {
        setMpConnStatus(
          "connecting",
          "Signaling paused — reconnecting...",
        );
        setTimeout(() => {
          try {
            if (mpState.peer && !mpState.peer.destroyed)
              mpState.peer.reconnect();
          } catch (e) {}
        }, 1200);
      }
    });

    peer.on("error", (err) => {
      if (
        err &&
        err.type === "unavailable-id" &&
        mpState.role === "host"
      ) {
        const freshCode = mpGenerateRoomCode();
        mpState.roomCode = freshCode;
        const codeDisp = document.getElementById("mp-room-code-display");
        if (codeDisp) codeDisp.textContent = freshCode;
        setupPeerHost(freshCode, 1);
        return;
      }
      if (
        !opened &&
        attempt < 3 &&
        mpState.role === "host" &&
        mpState.roomCode === code
      ) {
        setMpConnStatus(
          "connecting",
          `Signaling busy (${err && err.type ? err.type : "network"}) — retrying (${attempt + 1}/3)...`,
        );
        setTimeout(() => setupPeerHost(code, attempt + 1), 2200);
        return;
      }
      setMpConnStatus(
        "error",
        `Signaling Error (${err && err.type ? err.type : "network"}): Check internet/firewall`,
      );
    });
  } catch (e) {
    setMpConnStatus("error", "Failed to initialize WebRTC Peer");
  }
}

async function setupPeerGuest(code, attempt = 1) {
  if (window.location.protocol === "content:") {
    setMpConnStatus(
      "error",
      "Opened in WhatsApp viewer (content://) — save HTML to Downloads and open in Chrome/Safari!",
    );
    return;
  }
  if (typeof Peer === "undefined") {
    setMpConnStatus("connecting", "Loading Online P2P engine...");
    await ensurePeerJsLoaded();
  }
  if (typeof Peer === "undefined") {
    setMpConnStatus(
      "error",
      "Online P2P script unavailable (check internet)",
    );
    return;
  }
  try {
    if (mpState.peer) {
      try {
        mpState.peer.destroy();
      } catch (e) {}
    }
    mpState.conns.clear();
    mpState.fastDataChannels.clear();
    const provName = getRelayProviderLabel();
    if (mpState.turnProvider === "cloudflare") {
      await ensureCloudflareIceServers(false);
    }
    setMpConnStatus(
      "connecting",
      `Connecting to Room [${code}] via ${provName} (Attempt ${attempt}/3)...`,
    );
    const peer = new Peer(getMpPeerOptions(attempt >= 2));
    mpState.peer = peer;
    let connected = false;
    let retryScheduled = false;

    const scheduleRetry = (reason) => {
      if (
        connected ||
        retryScheduled ||
        mpState.role !== "guest" ||
        mpState.roomCode !== code
      )
        return;
      retryScheduled = true;
      if (attempt < 3) {
        setMpConnStatus(
          "connecting",
          `${reason} — retrying with backup relay (${attempt + 1}/3)...`,
        );
        setTimeout(() => setupPeerGuest(code, attempt + 1), 1800);
      } else {
        setMpConnStatus(
          "error",
          `Could not reach Room [${code}] (${reason}). Ensure both players use v77.`,
        );
      }
    };

    peer.on("open", () => {
      setMpConnStatus(
        "connecting",
        `Negotiating WebRTC & TURN Relay with [${code}]...`,
      );
      const conn = peer.connect(`dota3d-sov-v68-${code}`, {
        reliable: true,
        serialization: "json",
      });
      mpState.conns.set("host", conn);
      prepareFastDataChannelBeforeOffer(conn);
      attachIceDiagnostics(conn, "guest", code);

      conn.on("open", () => {
        connected = true;
        const via = mpState.iceModeLabel || "STUN/TURN";
        setMpConnStatus(
          "connected",
          `Connected to Host Room [${code}] (${via})! Waiting for Host...`,
        );
        mpSendOverConn(conn, {
          type: "JOIN_REQ",
          senderId: mpState.myId,
          roomCode: code,
          player: mpGetLocalPlayerRecord(),
        });
      });

      conn.on("data", (data) => {
        mpState.bytesRecv =
          (mpState.bytesRecv || 0) +
          (typeof data === "string"
            ? data.length
            : estimatePacketBytes(data));
        mpHandlePacket(data);
      });
      conn.on("close", () => {
        mpState.fastDataChannels.delete("host");
        if (mpState.role === "guest") {
          setMpConnStatus("error", "Disconnected from Host Room");
        }
      });
      conn.on("error", () => {
        scheduleRetry("DataChannel error");
      });

      const handshakeTimeout = attempt === 1 ? 9000 : 14000;
      setTimeout(() => {
        if (
          !connected &&
          mpState.role === "guest" &&
          mpState.roomCode === code
        ) {
          scheduleRetry("TURN/ICE handshake timeout");
        }
      }, handshakeTimeout);
    });

    peer.on("disconnected", () => {
      if (
        mpState.role === "guest" &&
        mpState.peer &&
        !mpState.peer.destroyed &&
        !connected
      ) {
        try {
          mpState.peer.reconnect();
        } catch (e) {}
      }
    });

    peer.on("error", (err) => {
      if (err && err.type === "peer-unavailable") {
        setMpConnStatus(
          "error",
          `Room [${code}] not found! Ask Host to click "Host Room" first.`,
        );
      } else {
        scheduleRetry(
          `Signaling ${err && err.type ? err.type : "network"}`,
        );
      }
    });
  } catch (e) {
    setMpConnStatus("error", "Failed to connect to remote room");
  }
}

window.hostMultiplayerRoom = function () {
  initBroadcastChannel();
  const code = mpGenerateRoomCode();
  mpState.role = "host";
  mpState.roomCode = code;
  mpState.bytesSent = 0;
  mpState.bytesRecv = 0;
  mpState.players.clear();
  mpState.players.set(mpState.myId, mpGetLocalPlayerRecord());
  const codeBox = document.getElementById("mp-host-code-box");
  const codeDisp = document.getElementById("mp-room-code-display");
  if (codeBox) codeBox.classList.remove("hidden");
  if (codeDisp) codeDisp.textContent = code;
  setupPeerHost(code, 1);
  mpBroadcast({
    type: "ROOM_ANNOUNCE",
    hostName: mpState.myName,
    count: mpState.players.size,
  });
  renderMpRoster();
};

window.copyMpRoomCode = function () {
  if (!mpState.roomCode) return;
  if (navigator.clipboard)
    navigator.clipboard.writeText(mpState.roomCode).catch(() => {});
  const disp = document.getElementById("mp-room-code-display");
  if (disp) {
    const orig = disp.textContent;
    disp.textContent = "COPIED!";
    setTimeout(() => {
      disp.textContent = orig;
    }, 1100);
  }
};

window.copyMpInviteLink = function () {
  if (!mpState.roomCode) return;
  const isHttp =
    /^https?:$/i.test(window.location.protocol) &&
    !/^localhost$|^127\.0\.0\.1$/i.test(window.location.hostname);
  let shareText = `Join my Infinite War match! Room Code: ${mpState.roomCode}`;
  if (isHttp) {
    const u = new URL(window.location.href);
    u.searchParams.set("room", mpState.roomCode);
    shareText = u.toString();
  }
  if (navigator.clipboard)
    navigator.clipboard.writeText(shareText).catch(() => {});
  setMpConnStatus(
    "ready",
    isHttp
      ? `Copied Invite URL with ?room=${mpState.roomCode}!`
      : `Copied Room Code ${mpState.roomCode}! Send HTML file + Code to friend.`,
  );
};

window.joinMultiplayerRoom = function (overrideCode) {
  initBroadcastChannel();
  const inp = document.getElementById("mp-join-code");
  let code = (overrideCode || (inp ? inp.value : ""))
    .trim()
    .toUpperCase();
  if (!code && mpState.discoveredRooms.size > 0) {
    code = Array.from(mpState.discoveredRooms.keys())[0];
  }
  if (!code) {
    const hint = document.getElementById("mp-network-hint");
    if (hint)
      hint.innerHTML =
        '<span class="text-amber-300 font-bold">Enter the 4-character Room Code from the Host tab/player, or click Host Room first!</span>';
    return;
  }
  if (inp) inp.value = code;
  if (mpState.discoveredRooms.has(code)) {
    window.setMpTransport("lan");
  } else if (mpState.transport === "local2p") {
    window.setMpTransport("online");
  }
  mpState.role = "guest";
  mpState.roomCode = code;
  mpState.bytesSent = 0;
  mpState.bytesRecv = 0;
  mpState.players.clear();
  const me = mpGetLocalPlayerRecord();
  mpState.players.set(mpState.myId, me);
  setupPeerGuest(code, 1);
  mpSendToHost({ type: "JOIN_REQ", player: me });
  renderMpRoster();
};

window.leaveMultiplayerRoom = function () {
  mpState.active = false;
  mpState.role = "solo";
  mpState.roomCode = "";
  mpState.players.clear();
  mpState.conns.clear();
  mpState.fastDataChannels.clear();
  mpState.pingMs = null;
  mpState.peerPings.clear();
  if (mpState.peer) {
    try {
      mpState.peer.destroy();
    } catch (e) {}
    mpState.peer = null;
  }
  const codeBox = document.getElementById("mp-host-code-box");
  if (codeBox) codeBox.classList.add("hidden");
  const pill = document.getElementById("mp-hud-status-pill");
  if (pill) pill.classList.add("hidden");
  const p2Pill = document.getElementById("local-p2-hud-pill");
  if (p2Pill) p2Pill.classList.add("hidden");
  renderMpRoster();
};

window.startMultiplayerMatch = function () {
  if (mpState.transport === "local2p") {
    mpState.active = true;
    mpState.role = "local2p";
    const p2Sel = document.getElementById("mp-p2-hero");
    const p2TeamSel = document.getElementById("mp-p2-team");
    if (p2Sel && p2Sel.value) mpState.p2HeroId = p2Sel.value;
    if (p2TeamSel && p2TeamSel.value) mpState.p2Team = p2TeamSel.value;
  } else {
    if (mpState.role === "solo") window.hostMultiplayerRoom();
    mpState.active = true;
    mpState.players.set(mpState.myId, mpGetLocalPlayerRecord());
    mpBroadcast({
      type: "START_MATCH",
      players: Array.from(mpState.players.entries()),
      aiDifficulty,
      fillBots: mpState.fillBots,
    });
  }
  window.closeMultiplayerModal();
  document.getElementById("btn-start-match").click();
};

function mpHandlePacket(msg) {
  if (!msg || msg.senderId === mpState.myId) return;

  if (msg.type === "ROOM_ANNOUNCE") {
    if (mpState.role === "solo" && msg.roomCode) {
      mpState.discoveredRooms.set(msg.roomCode, {
        hostName: msg.hostName || "Host",
        count: msg.count || 1,
        ts: performance.now(),
      });
      renderDiscoveredRooms();
    }
    return;
  }

  if (msg.roomCode !== mpState.roomCode) return;

  if (msg.type === "CHUNK" && msg.cid) {
    if (!mpState.chunkBuffers) mpState.chunkBuffers = new Map();
    const now = performance.now();
    for (const [k, v] of mpState.chunkBuffers.entries()) {
      if (now - v.ts > 4000) mpState.chunkBuffers.delete(k);
    }
    const key = `${msg.senderId}:${msg.cid}`;
    let entry = mpState.chunkBuffers.get(key);
    if (!entry) {
      entry = { parts: new Array(msg.tot), got: 0, ts: now };
      mpState.chunkBuffers.set(key, entry);
    }
    if (typeof entry.parts[msg.idx] !== "string") {
      entry.parts[msg.idx] = msg.data;
      entry.got++;
    }
    if (entry.got >= msg.tot) {
      mpState.chunkBuffers.delete(key);
      try {
        const fullMsg = JSON.parse(entry.parts.join(""));
        mpHandlePacket(fullMsg);
      } catch (e) {}
    }
    return;
  }

  if (msg.type === "ROOM_FULL" && mpState.role === "guest") {
    window.leaveMultiplayerRoom();
    setMpConnStatus("error", "Room is full (10/10 players maximum).");
    return;
  }
  if (msg.type === "JOIN_REQ" && mpState.role === "host") {
    if (
      mpState.players.size >= 10 &&
      !mpState.players.has(msg.senderId)
    ) {
      const pendingConn = Array.from(mpState.conns.values()).find(
        (c) => !c._playerId,
      );
      if (pendingConn) {
        mpSendOverConn(pendingConn, {
          type: "ROOM_FULL",
          senderId: mpState.myId,
          roomCode: mpState.roomCode,
        });
      }
      return;
    }
    const pRec = { ...msg.player, id: msg.senderId, isHost: false };
    mpState.players.set(msg.senderId, pRec);
    mpBroadcast({
      type: "LOBBY_SYNC",
      players: Array.from(mpState.players.entries()),
      aiDifficulty,
      fillBots: mpState.fillBots,
    });
    renderMpRoster();
    if (!inHeroSelect && mpState.active) {
      let existing = units.find(
        (u) => u.type === "hero" && u.ownerPeerId === msg.senderId,
      );
      if (!existing) {
        const hCfg = HERO_ROSTER[pRec.heroId] || HERO_ROSTER.aurelius;
        const team = pRec.team === "dire" ? "dire" : "radiant";
        const sx = team === "radiant" ? -70 : 70;
        const sz = team === "radiant" ? 78 : -78;
        existing = new MobaEntity({
          name: `${hCfg.name} (${pRec.name})`,
          team,
          type: "hero",
          isPlayer: false,
          heroCfg: hCfg,
          x: sx,
          z: sz,
          ...hCfg.stats,
          radius: 1.4,
          gold: 650,
          tpCharges: aiDifficulty === "infinity" ? 0 : 1,
          goldBounty: [260, 320],
          xpBounty: 260,
        });
        existing.ownerPeerId = pRec.id;
        existing.isRemoteHuman = true;
        units.push(existing);
      }
      const targetConn = Array.from(mpState.conns.values()).find(
        (c) => c._playerId === msg.senderId,
      );
      const startPkt = {
        type: "START_MATCH",
        senderId: mpState.myId,
        roomCode: mpState.roomCode,
        players: Array.from(mpState.players.entries()),
        aiDifficulty,
        fillBots: mpState.fillBots,
      };
      const kfPkt = {
        type: "WORLD_SNAP",
        senderId: mpState.myId,
        roomCode: mpState.roomCode,
        snap: buildAuthoritativeSnapshot(true),
      };
      if (targetConn) {
        mpSendOverConn(targetConn, startPkt);
        mpSendOverConn(targetConn, kfPkt);
      } else {
        mpBroadcast(startPkt);
        mpBroadcast(kfPkt);
      }
    }
  } else if (msg.type === "PLAYER_UPDATE" && mpState.role === "host") {
    if (mpState.players.has(msg.senderId)) {
      mpState.players.set(msg.senderId, {
        ...msg.player,
        id: msg.senderId,
        isHost: false,
      });
      mpBroadcast({
        type: "LOBBY_SYNC",
        players: Array.from(mpState.players.entries()),
        aiDifficulty,
        fillBots: mpState.fillBots,
      });
      renderMpRoster();
    }
  } else if (msg.type === "LOBBY_SYNC" && mpState.role === "guest") {
    mpState.players = new Map(msg.players);
    const myRec = mpState.players.get(mpState.myId);
    if (myRec && myRec.team && myRec.team !== mpState.myTeam) {
      mpState.myTeam = myRec.team;
      const teamEl = document.getElementById("mp-team-select");
      if (teamEl) teamEl.value = myRec.team;
    }
    if (msg.aiDifficulty) aiDifficulty = msg.aiDifficulty;
    if (typeof msg.fillBots === "boolean")
      mpState.fillBots = msg.fillBots;
    renderMpRoster();
  } else if (msg.type === "SYNC_REQ" && mpState.role === "host") {
    const targetConn = Array.from(mpState.conns.values()).find(
      (c) => c._playerId === msg.senderId,
    );
    const kfPkt = {
      type: "WORLD_SNAP",
      senderId: mpState.myId,
      roomCode: mpState.roomCode,
      snap: buildAuthoritativeSnapshot(true),
    };
    if (targetConn) mpSendOverConn(targetConn, kfPkt);
    else mpBroadcast(kfPkt);
  } else if (msg.type === "START_MATCH" && mpState.role === "guest") {
    mpState.active = true;
    mpState.lastRecvSeq = 0;
    mpState.lastSnapApplyTime = 0;
    mpState.cmdSeq = 0;
    mpState.players = new Map(msg.players);
    if (msg.aiDifficulty) aiDifficulty = msg.aiDifficulty;
    if (typeof msg.fillBots === "boolean")
      mpState.fillBots = msg.fillBots;
    window.closeMultiplayerModal();
    document.getElementById("btn-start-match").click();
  } else if (msg.type === "CHAT_MSG") {
    mpAppendChatMessage(msg.sender, msg.text, msg.team);
    const speaker = units.find(
      (u) => u.type === "hero" && u.ownerPeerId === msg.senderId,
    );
    if (speaker && !speaker.dead)
      spawnFloatText(
        speaker.mesh.position,
        `"${msg.text}"`,
        "#38bdf8",
        14,
      );
  } else if (msg.type === "BANNER_EVENT" && mpState.role === "guest") {
    showBanner(msg.title, msg.subtitle, msg.colorClass);
  } else if (msg.type === "CMD" && mpState.role === "host") {
    const actor = units.find(
      (u) => u.type === "hero" && u.ownerPeerId === msg.senderId,
    );
    if (!actor || gameOver) return;
    if (typeof msg.cmdSeq === "number") {
      if (msg.cmdSeq < (actor.lastProcessedCmdSeq || 0)) return; // Ignore out-of-order stale command
      actor.lastProcessedCmdSeq = msg.cmdSeq;
    }
    if (msg.cmd === "MOVE" && !actor.dead) {
      if (actor.tpChannel) actor.tpChannel = null;
      actor.targetUnit = null;
      actor.attackMovePos = null;
      actor.targetPos = new THREE.Vector3(
        THREE.MathUtils.clamp(msg.x, -MAP_HALF + 3, MAP_HALF - 3),
        0,
        THREE.MathUtils.clamp(msg.z, -MAP_HALF + 3, MAP_HALF - 3),
      );
    } else if (msg.cmd === "ATTACK_MOVE" && !actor.dead) {
      if (actor.tpChannel) actor.tpChannel = null;
      actor.targetUnit = null;
      actor.targetPos = null;
      actor.attackMovePos = new THREE.Vector3(
        THREE.MathUtils.clamp(msg.x, -MAP_HALF + 3, MAP_HALF - 3),
        0,
        THREE.MathUtils.clamp(msg.z, -MAP_HALF + 3, MAP_HALF - 3),
      );
    } else if (msg.cmd === "ATTACK_UNIT" && !actor.dead) {
      const tgt = units.find(
        (u) =>
          !u.dead &&
          (u.netId === msg.targetNetId || u.id === msg.targetNetId),
      );
      if (tgt && tgt.team !== actor.team) {
        if (actor.tpChannel) actor.tpChannel = null;
        actor.targetUnit = tgt;
        actor.targetPos = null;
        actor.attackMovePos = null;
      }
    } else if (msg.cmd === "CAST" && !actor.dead) {
      if (actor.tpChannel) actor.tpChannel = null;
      castHeroAbility(actor, msg.key, new THREE.Vector3(msg.x, 0, msg.z));
    } else if (msg.cmd === "STOP") {
      actor.tpChannel = null;
      actor.targetPos = null;
      actor.targetUnit = null;
      actor.attackMovePos = null;
    } else if (
      msg.cmd === "LEVEL_UP" &&
      canHeroLevelAbility(actor, msg.key)
    ) {
      actor.abilityLevels[msg.key]++;
      actor.skillPoints--;
      if (mpState.lastHeroExtras)
        mpState.lastHeroExtras.delete(actor.netId);
    } else if (
      msg.cmd === "LEVEL_ATTR" &&
      actor.skillPoints > 0 &&
      actor.attrBonusRank < MAX_ATTR_RANK
    ) {
      actor.skillPoints--;
      actor.attrBonusRank++;
      actor.str += 2;
      actor.agi += 2;
      actor.int += 2;
      actor.maxHp += 44;
      actor.hp += 44;
      actor.maxMana += 28;
      actor.mana += 28;
      actor.atkDamage += 4;
      actor.armor += 0.4;
      actor.atkSpeedMult += 0.03;
      if (mpState.lastHeroExtras)
        mpState.lastHeroExtras.delete(actor.netId);
    } else if (
      msg.cmd === "PICK_TALENT" &&
      actor.heroCfg &&
      actor.skillPoints > 0 &&
      actor.level >= msg.tierLvl &&
      !actor.chosenTalents[msg.tierLvl]
    ) {
      const pair = actor.heroCfg.talents[msg.tierLvl];
      const opt = pair && pair.find((o) => o.id === msg.talentId);
      if (opt) {
        actor.skillPoints--;
        actor.chosenTalents[msg.tierLvl] = msg.talentId;
        opt.apply(actor);
        if (mpState.lastHeroExtras)
          mpState.lastHeroExtras.delete(actor.netId);
      }
    } else if (msg.cmd === "BUY_ITEM") {
      const item = SHOP_ITEMS.find((it) => it.id === msg.itemId);
      if (item && actor.gold >= item.cost) {
        if (item.shop === "secret" && !isHeroNearSecretShop(actor))
          return;
        if (isConsumableItem(item)) {
          const cState = getConsumableUsageState(actor, item);
          if (cState.exhausted) return;
        }
        if (item.isTpScroll || item.id === "tp_scroll") {
          actor.gold -= item.cost;
          actor.tpCharges = (actor.tpCharges || 0) + 1;
        } else if (item.consumeOnBuy) {
          actor.gold -= item.cost;
          if (!actor.consumableUsedCount) actor.consumableUsedCount = {};
          actor.consumableUsedCount[item.id] =
            (actor.consumableUsedCount[item.id] || 0) + 1;
          applyItemStatsToHero(actor, item);
        } else if (!isItemAlreadyOwned(actor, item)) {
          const emptyIdx = actor.inventory.findIndex((s) => s === null);
          if (emptyIdx !== -1) {
            actor.gold -= item.cost;
            actor.inventory[emptyIdx] = item;
            applyItemStatsToHero(actor, item);
            if (mpState.lastHeroExtras)
              mpState.lastHeroExtras.delete(actor.netId);
          }
        }
      }
    } else if (msg.cmd === "USE_ITEM" && !actor.dead) {
      executeHeroInventoryItem(
        actor,
        msg.slotIdx,
        new THREE.Vector3(
          msg.x || actor.mesh.position.x,
          0,
          msg.z || actor.mesh.position.z,
        ),
      );
      if (mpState.lastHeroExtras)
        mpState.lastHeroExtras.delete(actor.netId);
    } else if (msg.cmd === "SWAP_ITEM") {
      const idxA = msg.idxA;
      const idxB = msg.idxB;
      if (
        idxA >= 0 &&
        idxA <= 5 &&
        idxB >= 0 &&
        idxB <= 5 &&
        idxA !== idxB
      ) {
        const tmp = actor.inventory[idxA];
        actor.inventory[idxA] = actor.inventory[idxB];
        actor.inventory[idxB] = tmp;
        if (mpState.lastHeroExtras)
          mpState.lastHeroExtras.delete(actor.netId);
      }
    } else if (msg.cmd === "SELL_ITEM") {
      const slotIdx = msg.slotIdx;
      const it =
        slotIdx >= 0 && slotIdx <= 5 ? actor.inventory[slotIdx] : null;
      if (it) {
        const refund = Math.max(50, Math.round((it.cost || 400) * 0.6));
        actor.gold += refund;
        const st = it.stats || {};
        if (st.str) actor.str = Math.max(10, actor.str - st.str);
        if (st.agi) actor.agi = Math.max(10, actor.agi - st.agi);
        if (st.int) actor.int = Math.max(10, actor.int - st.int);
        if (st.moveSpeed)
          actor.moveSpeed = Math.max(8, actor.moveSpeed - st.moveSpeed);
        if (st.atkSpeedMult)
          actor.atkSpeedMult = Math.max(
            0.5,
            actor.atkSpeedMult - st.atkSpeedMult,
          );
        if (st.atkDamage)
          actor.atkDamage = Math.max(20, actor.atkDamage - st.atkDamage);
        if (st.maxHp) {
          actor.maxHp = Math.max(300, actor.maxHp - st.maxHp);
          actor.hp = Math.min(actor.hp, actor.maxHp);
        }
        if (st.hpRegen)
          actor.hpRegen = Math.max(1, actor.hpRegen - st.hpRegen);
        if (st.armor) actor.armor = Math.max(0, actor.armor - st.armor);
        if (st.maxMana) {
          actor.maxMana = Math.max(150, actor.maxMana - st.maxMana);
          actor.mana = Math.min(actor.mana, actor.maxMana);
        }
        if (st.manaRegen)
          actor.manaRegen = Math.max(1, actor.manaRegen - st.manaRegen);
        if (st.lifesteal)
          actor.lifesteal = Math.max(0, actor.lifesteal - st.lifesteal);
        if (st.spellAmpBonus)
          actor.spellAmpBonus = Math.max(
            0,
            actor.spellAmpBonus - st.spellAmpBonus,
          );
        if (st.critChance)
          actor.critChance = Math.max(
            0,
            actor.critChance - st.critChance,
          );
        actor.inventory[slotIdx] = null;
        syncHeroUniqueItemFlags(actor);
        if (mpState.lastHeroExtras)
          mpState.lastHeroExtras.delete(actor.netId);
      }
    } else if (msg.cmd === "TP_DEST" && !actor.dead) {
      const dests = getValidTeleportDestinations(actor.team);
      const chosen = dests.find((d) => d.id === msg.destId) || dests[0];
      if (
        chosen &&
        (actor.tpCharges || 0) > 0 &&
        !(actor.itemCooldowns.tp_scroll > 0)
      ) {
        actor.targetPos = null;
        actor.targetUnit = null;
        actor.attackMovePos = null;
        actor.tpChannel = {
          timer: 2.5,
          duration: 2.5,
          dest: new THREE.Vector3(chosen.x, 0, chosen.z),
          label: chosen.shortLabel,
        };
      }
    }
  } else if (msg.type === "PING_REQ") {
    const reply = {
      type: "PING_PONG",
      senderId: mpState.myId,
      roomCode: mpState.roomCode,
      ts: msg.ts,
      rtt: msg.lastRtt ?? null,
    };
    if (mpState.role === "guest") {
      const fastDc = mpState.fastDataChannels.get("host");
      if (!fastDc || !mpSendNativeFastDc(fastDc, reply, 96)) {
        mpSendOverConn(mpState.conns.get("host"), reply, null, 96);
      }
    } else if (mpState.role === "host") {
      if (typeof msg.lastRtt === "number") {
        mpState.peerPings.set(msg.senderId, msg.lastRtt);
        let worst = 0;
        mpState.peerPings.forEach((v) => {
          if (v > worst) worst = v;
        });
        if (worst > 0) mpState.pingMs = worst;
      }
      let replied = false;
      mpState.conns.forEach((conn, peerKey) => {
        if (conn._playerId === msg.senderId) {
          const fastDc = mpState.fastDataChannels.get(peerKey);
          if (!fastDc || !mpSendNativeFastDc(fastDc, reply, 96)) {
            mpSendOverConn(conn, reply, null, 96);
          }
          replied = true;
        }
      });
      if (!replied) mpBroadcast(reply);
    }
  } else if (msg.type === "PING_PONG") {
    if (typeof msg.ts === "number") {
      const rtt = Math.max(
        1,
        Math.min(999, Math.round(performance.now() - msg.ts)),
      );
      if (mpState.role === "guest") {
        if (!mpState.rttSamples) mpState.rttSamples = [];
        mpState.rttSamples.push(rtt);
        if (mpState.rttSamples.length > 4) mpState.rttSamples.shift();
        const minRtt = Math.min(...mpState.rttSamples);
        const blend =
          rtt <= minRtt * 1.25
            ? rtt
            : Math.round(minRtt * 0.75 + rtt * 0.25);
        mpState.pingMs =
          mpState.pingMs === null
            ? blend
            : Math.round(mpState.pingMs * 0.6 + blend * 0.4);
      } else if (mpState.role === "host") {
        mpState.peerPings.set(msg.senderId, rtt);
        let worst = 0;
        mpState.peerPings.forEach((v) => {
          if (v > worst) worst = v;
        });
        mpState.pingMs = worst > 0 ? worst : null;
      }
    }
  } else if (msg.type === "WORLD_SNAP" && mpState.role === "guest") {
    applyAuthoritativeSnapshot(msg.snap);
  }
}

function getActiveRuneMask() {
  let mask = 0;
  for (let i = 0; i < runes.length; i++) {
    if (runes[i].kind === "bounty") mask |= 1;
    else if (runes[i].kind === "arcane") mask |= 2;
  }
  return mask;
}

function serializeFullUnitRow(u) {
  const flags =
    (u.dead ? 1 : 0) |
    (u.stunTimer > 0 ? 2 : 0) |
    (u.slowTimer > 0 ? 4 : 0) |
    (u.swingAnim > 0 ? 8 : 0) |
    (u.castAnim > 0 ? 16 : 0) |
    (u.hasAegis ? 32 : 0) |
    (u.celebrateTimer > 0 ? 64 : 0) |
    (u.reincarnating ? 128 : 0) |
    (u.blinkBuffTimer > 0 ? 256 : 0) |
    (u.hasVampLeaderBuff ? 512 : 0) |
    (u.hasWolfLeaderBuff ? 1024 : 0);
  const isHero = u.type === "hero";
  return [
    u.netId, // 0
    u.name, // 1
    u.team, // 2
    u.type, // 3
    u.subType || "melee", // 4
    u.isMega ? 1 : 0, // 5
    u.heroCfg ? u.heroCfg.id : null, // 6
    u.ownerPeerId || null, // 7
    Math.round(u.mesh.position.x * 100) / 100, // 8
    Math.round(u.mesh.position.z * 100) / 100, // 9
    Math.round(u.mesh.rotation.y * 100) / 100, // 10
    Math.round(u.hp), // 11
    Math.round(u.maxHp), // 12
    Math.round(u.mana), // 13
    Math.round(u.maxMana), // 14
    Math.round(u.shield || 0), // 15
    Math.round(u.atkDamage), // 16
    u.atkRange, // 17
    Math.round(u.moveSpeed * 10) / 10, // 18
    Math.round(u.armor), // 19
    u.radius, // 20
    u.level, // 21
    Math.round(u.xp), // 22
    Math.round(u.xpToNext), // 23
    u.skillPoints, // 24
    isHero
      ? [
          u.abilityLevels.Q,
          u.abilityLevels.W,
          u.abilityLevels.E,
          u.abilityLevels.R,
        ]
      : null, // 25
    isHero
      ? [
          Math.round((u.cooldowns.Q || 0) * 10) / 10,
          Math.round((u.cooldowns.W || 0) * 10) / 10,
          Math.round((u.cooldowns.E || 0) * 10) / 10,
          Math.round((u.cooldowns.R || 0) * 10) / 10,
        ]
      : null, // 26
    isHero ? Math.floor(u.gold) : 0, // 27
    isHero ? [u.kills, u.deaths, u.assists, u.lastHits] : null, // 28
    flags, // 29
    Math.round((u.respawnTimer || 0) * 10) / 10, // 30
    u.tpCharges || 0, // 31
    isHero ? u.inventory.map((it) => (it ? it.id : null)) : null, // 32
    isHero ? u.lastProcessedCmdSeq || 0 : 0, // 33
    isHero ? u.attrBonusRank || 0 : 0, // 34
    isHero ? u.chosenTalents || {} : null, // 35
  ];
}

function buildAuthoritativeSnapshot(forceKeyframe = false) {
  mpState.snapSeq = (mpState.snapSeq || 0) + 1;
  const isFullKeyframe = Boolean(forceKeyframe);
  if (!mpState.knownNetIds) mpState.knownNetIds = new Set();
  if (!mpState.lastEntitySig) mpState.lastEntitySig = new Map();
  if (!mpState.lastHeroExtras) mpState.lastHeroExtras = new Map();
  if (!mpState.pendingRemovals) mpState.pendingRemovals = new Set();

  // Quota-saver staggered refresh (1 unit every 3rd tick = ~6.6 units/sec) keeps TURN bandwidth tiny
  const staggerIndices = new Set();
  if (!isFullKeyframe && units.length > 0) {
    mpState.staggerSkip = ((mpState.staggerSkip || 0) + 1) % 3;
    if (mpState.staggerSkip === 0) {
      const base = (mpState.staggerCursor || 0) % units.length;
      staggerIndices.add(base);
      mpState.staggerCursor = (base + 1) % units.length;
    }
  }

  const activeIds = new Set();
  const spawnRows = [];
  const deltaMobs = [];
  const deltaHeroes = [];

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.netId) u.netId = u.id;
    activeIds.add(u.netId);

    const isNew = !mpState.knownNetIds.has(u.netId);
    if (isFullKeyframe || isNew) {
      mpState.knownNetIds.add(u.netId);
      spawnRows.push(serializeFullUnitRow(u));
      continue;
    }

    const flags =
      (u.dead ? 1 : 0) |
      (u.stunTimer > 0 ? 2 : 0) |
      (u.slowTimer > 0 ? 4 : 0) |
      (u.swingAnim > 0 ? 8 : 0) |
      (u.castAnim > 0 ? 16 : 0) |
      (u.hasAegis ? 32 : 0) |
      (u.celebrateTimer > 0 ? 64 : 0) |
      (u.reincarnating ? 128 : 0) |
      (u.blinkBuffTimer > 0 ? 256 : 0) |
      (u.hasVampLeaderBuff ? 512 : 0) |
      (u.hasWolfLeaderBuff ? 1024 : 0);
    const rx = Math.round(u.mesh.position.x * 100) / 100;
    const rz = Math.round(u.mesh.position.z * 100) / 100;
    const ry = Math.round(u.mesh.rotation.y * 100) / 100;
    const rHp = Math.round(u.hp);
    const rMaxHp = Math.round(u.maxHp);
    const rSpd = Math.round(u.moveSpeed * 10) / 10;
    const forceRow = staggerIndices.has(i);

    if (u.type !== "hero") {
      const sig = `${rx},${rz},${ry},${rHp},${rMaxHp},${flags}`;
      if (!forceRow && mpState.lastEntitySig.get(u.netId) === sig)
        continue;
      mpState.lastEntitySig.set(u.netId, sig);
      deltaMobs.push([u.netId, rx, rz, ry, rHp, rMaxHp, rSpd, flags]);
    } else {
      const rMana = Math.round(u.mana);
      const rMaxMana = Math.round(u.maxMana);
      const rShield = Math.round(u.shield || 0);
      const rAtk = Math.round(u.atkDamage);
      const rArm = Math.round(u.armor);
      const rXp = Math.round(u.xp);
      const rGold = Math.floor(u.gold);
      const rResp = Math.round((u.respawnTimer || 0) * 10) / 10;
      const ackSeq = u.lastProcessedCmdSeq || 0;
      const abArr = [
        u.abilityLevels.Q,
        u.abilityLevels.W,
        u.abilityLevels.E,
        u.abilityLevels.R,
      ];
      const cdArr = [
        Math.round((u.cooldowns.Q || 0) * 10) / 10,
        Math.round((u.cooldowns.W || 0) * 10) / 10,
        Math.round((u.cooldowns.E || 0) * 10) / 10,
        Math.round((u.cooldowns.R || 0) * 10) / 10,
      ];
      const kdaArr = [u.kills, u.deaths, u.assists, u.lastHits];
      const invArr = u.inventory.map((it) => (it ? it.id : null));
      const talStr = Object.values(u.chosenTalents || {}).join(",");

      const extraSig = `${abArr.join(",")}|${kdaArr.join(",")}|${invArr.join(",")}|${u.attrBonusRank || 0}|${talStr}`;
      const prevExtra = mpState.lastHeroExtras.get(u.netId);
      const sendExtras = forceRow || prevExtra !== extraSig;
      if (sendExtras) mpState.lastHeroExtras.set(u.netId, extraSig);

      const heroSig = `${rx},${rz},${ry},${rHp},${rMana},${rShield},${u.level},${rGold},${flags},${ackSeq},${cdArr.join(",")},${extraSig}`;
      if (!forceRow && mpState.lastEntitySig.get(u.netId) === heroSig)
        continue;
      mpState.lastEntitySig.set(u.netId, heroSig);

      deltaHeroes.push([
        u.netId,
        rx,
        rz,
        ry,
        rHp,
        rMaxHp,
        rMana,
        rMaxMana,
        rShield,
        rAtk,
        rArm,
        rSpd,
        u.level,
        rXp,
        Math.round(u.xpToNext),
        u.skillPoints,
        sendExtras ? abArr : null,
        cdArr,
        rGold,
        sendExtras ? kdaArr : null,
        flags,
        rResp,
        u.tpCharges || 0,
        sendExtras ? invArr : null,
        ackSeq,
        u.attrBonusRank || 0,
        sendExtras ? u.chosenTalents || {} : null,
      ]);
    }
  }

  mpState.knownNetIds.forEach((kid) => {
    if (!activeIds.has(kid)) {
      mpState.knownNetIds.delete(kid);
      mpState.lastEntitySig.delete(kid);
      mpState.lastHeroExtras.delete(kid);
      mpState.pendingRemovals.add(kid);
    }
  });

  const remList = Array.from(mpState.pendingRemovals);
  mpState.pendingRemovals.clear();

  const evBatch =
    mpState.fxEventQueue && mpState.fxEventQueue.length > 0
      ? mpState.fxEventQueue.splice(0, 42)
      : null;

  return {
    seq: mpState.snapSeq,
    full: isFullKeyframe ? 1 : 0,
    t: Math.round(matchTime * 100) / 100,
    rk: radiantKills,
    dk: direKills,
    et: escalationTier,
    go: gameOver ? 1 : 0,
    rn: getActiveRuneMask(),
    sp: spawnRows.length > 0 ? spawnRows : null,
    m: deltaMobs.length > 0 ? deltaMobs : null,
    h: deltaHeroes.length > 0 ? deltaHeroes : null,
    rem: remList.length > 0 ? remList : null,
    ev: evBatch,
  };
}

function applyAuthoritativeSnapshot(snap) {
  if (!snap) return;
  if (typeof snap.seq === "number") {
    if (
      mpState.lastRecvSeq &&
      snap.seq < mpState.lastRecvSeq &&
      mpState.lastRecvSeq - snap.seq < 120
    ) {
      return; // Drop out-of-order stale snapshot
    }
    mpState.lastRecvSeq = snap.seq;
  }
  const nowMs = performance.now();
  mpState.lastSnapApplyTime = nowMs;

  if (typeof snap.t === "number" && Math.abs(snap.t - matchTime) > 0.3) {
    matchTime = snap.t;
  }
  radiantKills = snap.rk;
  direKills = snap.dk;
  if (snap.et && snap.et !== escalationTier) {
    escalationTier = snap.et;
    const badge = document.getElementById("escalation-badge");
    if (badge) badge.textContent = `Tier ${escalationTier}`;
  }
  if (typeof snap.rn === "number") {
    syncGuestRiverRunesFromMask(snap.rn);
  }

  const seenIds = new Set();
  let missingEntity = false;

  const updateNetTarget = (u, nx, nz, nyaw) => {
    const now = performance.now();
    if (u._netHasPos && u._netTs) {
      const dtSnap = Math.max(
        0.025,
        Math.min(0.25, (now - u._netTs) / 1000),
      );
      const dx = nx - u._netRawX;
      const dz = nz - u._netRawZ;
      const dist = Math.hypot(dx, dz);
      u._netMoving = dist > 0.03;
      if (dist > 0.02 && dist < 14.0) {
        const maxSpd = Math.max(12, (u.moveSpeed || 12) * 1.25);
        const rawVx = dx / dtSnap;
        const rawVz = dz / dtSnap;
        const spd = Math.hypot(rawVx, rawVz);
        const scale = spd > maxSpd ? maxSpd / spd : 1;
        u._netVx = rawVx * scale;
        u._netVz = rawVz * scale;
      } else {
        u._netVx = 0;
        u._netVz = 0;
      }
    } else {
      u._netVx = 0;
      u._netVz = 0;
      u._netMoving = false;
    }
    u._netRawX = nx;
    u._netRawZ = nz;
    u._netX = nx;
    u._netZ = nz;
    u._netYaw = nyaw;
    u._netTs = now;
    u._netHasPos = true;
  };

  const applyFlagsAndVis = (u, flags, wasDead, nx, nz, nyaw) => {
    const prevFlags = u._prevNetFlags || 0;
    u._prevNetFlags = flags;
    u.dead = !!(flags & 1);
    u.stunTimer = flags & 2 ? Math.max(u.stunTimer, 0.14) : 0;
    u.slowTimer = flags & 4 ? Math.max(u.slowTimer, 0.14) : 0;
    u.hasAegis = !!(flags & 32);
    u.reincarnating = !!(flags & 128);
    u.blinkBuffTimer =
      flags & 256 ? Math.max(u.blinkBuffTimer || 0, 0.2) : 0;
    u.hasVampLeaderBuff = !!(flags & 512);
    u.hasWolfLeaderBuff = !!(flags & 1024);
    if (flags & 64 && !(prevFlags & 64)) {
      u.celebrateTimer = 1.45;
    } else if (flags & 64) {
      u.celebrateTimer = Math.max(u.celebrateTimer || 0, 0.3);
    }
    if (flags & 8 && !(prevFlags & 8) && u.swingAnim <= 0.05) {
      u.swingAnim = 0.34;
    }
    if (flags & 16 && !(prevFlags & 16) && u.castAnim <= 0.05) {
      u.castAnim = 0.45;
    }

    if (!wasDead && u.dead) {
      if (u.type === "hero") {
        u.deathAnimTimer = 1.25;
        u.mesh.visible = true;
      } else {
        u.mesh.visible = false;
      }
      if (u.bar && u.bar.el) u.bar.el.style.display = "none";
    } else if (wasDead && !u.dead) {
      u.deathAnimTimer = 0;
      if (u.parts && u.parts.hips) {
        u.parts.hips.position.y = 1.42;
        u.parts.hips.rotation.set(0, 0, 0);
      }
      u.mesh.visible = true;
      if (u.bar && u.bar.el) u.bar.el.style.display = "flex";
      spawnShockwaveRing(
        nx,
        nz,
        4.5,
        u.team === "radiant" ? 0x34d399 : 0xf43f5e,
        0.7,
      );
      if (
        u.isPlayer &&
        u.heroCfg &&
        u.heroCfg.voice &&
        u.heroCfg.voice.respawn
      ) {
        sfx.speakHeroLine(
          u.heroCfg,
          u.heroCfg.voice.respawn,
          true,
          "triumph",
          { category: "respawn", minGapMs: 3000, catGapMs: 8000 },
        );
      }
    } else if (u.dead) {
      u.mesh.visible = u.type === "hero" && (u.deathAnimTimer || 0) > 0;
      if (u.bar && u.bar.el) u.bar.el.style.display = "none";
    } else {
      u.mesh.visible = true;
      if (u.bar && u.bar.el) u.bar.el.style.display = "flex";
    }

    const errDist = Math.hypot(
      nx - u.mesh.position.x,
      nz - u.mesh.position.z,
    );
    if ((wasDead && !u.dead) || errDist > 14.0) {
      u.mesh.position.x = nx;
      u.mesh.position.z = nz;
      u.mesh.position.y = getTerrainHeightAt(nx, nz);
      u.mesh.rotation.y = nyaw;
      if (u.isPlayer) {
        u.targetPos = null;
        u.targetUnit = null;
        u.attackMovePos = null;
      }
    }
  };

  // 1. Process full spawn/keyframe rows
  if (Array.isArray(snap.sp)) {
    for (let i = 0; i < snap.sp.length; i++) {
      const su = snap.sp[i];
      const id = su[0];
      seenIds.add(id);
      let u = units.find((x) => x.netId === id);
      if (!u) {
        const heroId = su[6];
        const cfg = heroId ? HERO_ROSTER[heroId] : null;
        const isMe = su[7] === mpState.myId;
        u = new MobaEntity({
          name: su[1],
          team: su[2],
          type: su[3],
          subType: su[4] || "melee",
          isMega: !!su[5],
          heroCfg: cfg,
          isPlayer: isMe,
          x: su[8],
          z: su[9],
          maxHp: su[12],
          maxMana: su[14],
          atkDamage: su[16] || 40,
          atkRange: su[17] || 3.5,
          moveSpeed: su[18] || 10,
          armor: su[19] || 4,
          radius: su[20] || 1.2,
        });
        u.netId = id;
        u.ownerPeerId = su[7] || null;
        u._netRawX = su[8];
        u._netRawZ = su[9];
        u._netX = su[8];
        u._netZ = su[9];
        u._netYaw = su[10];
        u._netVx = 0;
        u._netVz = 0;
        u._netTs = nowMs;
        u._netHasPos = true;
        units.push(u);
        if (isMe && cfg) {
          if (playerHero && playerHero !== u && !playerHero.netId) {
            const oldIdx = units.indexOf(playerHero);
            if (oldIdx !== -1) units.splice(oldIdx, 1);
            scene.remove(playerHero.mesh);
            disposeObject3D(playerHero.mesh);
            if (playerHero.bar && playerHero.bar.el)
              playerHero.bar.el.remove();
          }
          playerHero = u;
          applyHeroToHUD(cfg, `Room ${mpState.roomCode}`);
          cameraFocus.copy(u.mesh.position);
        }
      }

      updateNetTarget(u, su[8], su[9], su[10]);
      const wasDead = u.dead;
      u.hp = su[11];
      u.maxHp = su[12];
      u.mana = su[13];
      u.maxMana = su[14];
      u.shield = su[15];
      u.atkDamage = su[16];
      u.armor = su[19];
      u.moveSpeed = su[18];
      const prevLvlFull = u.level;
      u.level = su[21];
      u.xp = su[22];
      u.xpToNext = su[23];
      u.skillPoints = su[24];
      if (su[25])
        u.abilityLevels = {
          Q: su[25][0],
          W: su[25][1],
          E: su[25][2],
          R: su[25][3],
        };
      if (su[26])
        u.cooldowns = {
          Q: su[26][0],
          W: su[26][1],
          E: su[26][2],
          R: su[26][3],
        };
      u.gold = su[27];
      if (su[28]) {
        u.kills = su[28][0];
        u.deaths = su[28][1];
        u.assists = su[28][2];
        u.lastHits = su[28][3];
      }
      u.respawnTimer = su[30];
      u.tpCharges = su[31];
      if (typeof su[33] === "number") {
        u._ackCmdSeq = Math.max(u._ackCmdSeq || 0, su[33]);
      }
      if (typeof su[34] === "number") u.attrBonusRank = su[34];
      if (su[35]) u.chosenTalents = { ...su[35] };
      if (u.isPlayer && u.level > prevLvlFull && prevLvlFull >= 1) {
        sfx.play("levelup");
        const ultNote = u.level === 6 ? " • ULTIMATE UNLOCKED!" : "";
        spawnFloatText(
          u.mesh.position,
          `LEVEL ${u.level}!${ultNote}`,
          "#facc15",
          18,
        );
        spawnShockwaveRing(
          u.mesh.position.x,
          u.mesh.position.z,
          4.4,
          0xfacc15,
          0.7,
        );
      }

      if (Array.isArray(su[32])) {
        let changed = false;
        for (let s = 0; s < 6; s++) {
          const curId = u.inventory[s] ? u.inventory[s].id : null;
          if (curId !== su[32][s]) {
            u.inventory[s] = su[32][s]
              ? SHOP_ITEMS.find((it) => it.id === su[32][s]) || null
              : null;
            changed = true;
          }
        }
        if (changed) {
          if (u.isPlayer) refreshInventoryGrid();
          if (inspectedUnit === u) renderInspectedHeroInventory(u);
        }
      }
      if (u.isPlayer) updateAbilityUpgradeButtons();

      applyFlagsAndVis(u, su[29] || 0, wasDead, su[8], su[9], su[10]);
    }
  }

  // 2. Process compact non-hero delta rows [id, x, z, yaw, hp, maxHp, spd, flags]
  if (Array.isArray(snap.m)) {
    for (let i = 0; i < snap.m.length; i++) {
      const dm = snap.m[i];
      const u = units.find((x) => x.netId === dm[0]);
      if (!u) {
        missingEntity = true;
        continue;
      }
      updateNetTarget(u, dm[1], dm[2], dm[3]);
      const wasDead = u.dead;
      u.hp = dm[4];
      u.maxHp = dm[5];
      u.moveSpeed = dm[6];
      applyFlagsAndVis(u, dm[7] || 0, wasDead, dm[1], dm[2], dm[3]);
    }
  }

  // 3. Process compact hero delta rows
  if (Array.isArray(snap.h)) {
    for (let i = 0; i < snap.h.length; i++) {
      const dh = snap.h[i];
      const u = units.find((x) => x.netId === dh[0]);
      if (!u) {
        missingEntity = true;
        continue;
      }
      updateNetTarget(u, dh[1], dh[2], dh[3]);
      const wasDead = u.dead;
      u.hp = dh[4];
      u.maxHp = dh[5];
      u.mana = dh[6];
      u.maxMana = dh[7];
      u.shield = dh[8];
      u.atkDamage = dh[9];
      u.armor = dh[10];
      u.moveSpeed = dh[11];
      const prevLvlDelta = u.level;
      u.level = dh[12];
      u.xp = dh[13];
      u.xpToNext = dh[14];
      u.skillPoints = dh[15];
      if (dh[16])
        u.abilityLevels = {
          Q: dh[16][0],
          W: dh[16][1],
          E: dh[16][2],
          R: dh[16][3],
        };
      if (dh[17])
        u.cooldowns = {
          Q: dh[17][0],
          W: dh[17][1],
          E: dh[17][2],
          R: dh[17][3],
        };
      u.gold = dh[18];
      if (dh[19]) {
        u.kills = dh[19][0];
        u.deaths = dh[19][1];
        u.assists = dh[19][2];
        u.lastHits = dh[19][3];
      }
      u.respawnTimer = dh[21];
      u.tpCharges = dh[22];
      if (typeof dh[24] === "number") {
        u._ackCmdSeq = Math.max(u._ackCmdSeq || 0, dh[24]);
      }
      if (typeof dh[25] === "number") u.attrBonusRank = dh[25];
      if (dh[26]) u.chosenTalents = { ...dh[26] };
      if (u.isPlayer && u.level > prevLvlDelta && prevLvlDelta >= 1) {
        sfx.play("levelup");
        const ultNote = u.level === 6 ? " • ULTIMATE UNLOCKED!" : "";
        spawnFloatText(
          u.mesh.position,
          `LEVEL ${u.level}!${ultNote}`,
          "#facc15",
          18,
        );
        spawnShockwaveRing(
          u.mesh.position.x,
          u.mesh.position.z,
          4.4,
          0xfacc15,
          0.7,
        );
      }
      if (Array.isArray(dh[23])) {
        let changed = false;
        for (let s = 0; s < 6; s++) {
          const curId = u.inventory[s] ? u.inventory[s].id : null;
          if (curId !== dh[23][s]) {
            u.inventory[s] = dh[23][s]
              ? SHOP_ITEMS.find((it) => it.id === dh[23][s]) || null
              : null;
            changed = true;
          }
        }
        if (changed) {
          if (u.isPlayer) refreshInventoryGrid();
          if (inspectedUnit === u) renderInspectedHeroInventory(u);
        }
      }
      if (u.isPlayer) updateAbilityUpgradeButtons();
      applyFlagsAndVis(u, dh[20] || 0, wasDead, dh[1], dh[2], dh[3]);
    }
  }

  // 4. Process explicit despawns & full-keyframe reconciliation
  if (Array.isArray(snap.rem) && snap.rem.length > 0) {
    const remSet = new Set(snap.rem);
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.netId && remSet.has(u.netId)) {
        scene.remove(u.mesh);
        disposeObject3D(u.mesh);
        if (u.bar && u.bar.el) u.bar.el.remove();
        units.splice(i, 1);
      }
    }
  }
  if (snap.full === 1) {
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.netId && !seenIds.has(u.netId)) {
        scene.remove(u.mesh);
        disposeObject3D(u.mesh);
        if (u.bar && u.bar.el) u.bar.el.remove();
        units.splice(i, 1);
      }
    }
  } else if (
    missingEntity &&
    nowMs - (mpState.lastSyncReqTime || 0) > 800
  ) {
    mpState.lastSyncReqTime = nowMs;
    mpSendToHost({ type: "SYNC_REQ" });
  }

  // 5. Replay combat visuals, projectiles, QWER abilities, damage popups & endgame on Guest
  if (Array.isArray(snap.ev)) {
    for (let ei = 0; ei < snap.ev.length; ei++) {
      const ev = snap.ev[ei];
      if (!Array.isArray(ev)) continue;
      const kind = ev[0];
      if (kind === "A") {
        const att = units.find((x) => x.netId === ev[1]);
        const tgt = units.find((x) => x.netId === ev[2]);
        if (att && tgt && !att.dead && !tgt.dead) {
          executeAutoAttack(att, tgt, true, !!ev[3]);
        }
      } else if (kind === "C") {
        const caster = units.find((x) => x.netId === ev[1]);
        if (caster && !caster.dead) {
          castHeroAbility(
            caster,
            ev[2],
            new THREE.Vector3(ev[3], 0, ev[4]),
            true,
          );
        }
      } else if (kind === "M") {
        const mob = units.find((x) => x.netId === ev[1]);
        const tgt = ev[2] ? units.find((x) => x.netId === ev[2]) : null;
        if (mob && !mob.dead) {
          executeNeutralOrBossSkill(mob, tgt || mob, true);
        }
      } else if (kind === "D") {
        const tgt = units.find((x) => x.netId === ev[1]);
        if (tgt && !tgt.dead) {
          const dmgVal = ev[2];
          const isCrit = !!ev[3];
          tgt.hitFlashTimer = 0.12;
          spawnFloatText(
            tgt.mesh.position,
            isCrit ? `CRIT -${dmgVal}!` : `-${dmgVal}`,
            isCrit
              ? "#fb923c"
              : tgt.team === "radiant"
                ? "#fb7185"
                : "#f8fafc",
            isCrit
              ? 18
              : tgt.type === "hero" ||
                  tgt.type === "boss" ||
                  tgt.type === "dragon" ||
                  tgt.type === "kong" ||
                  tgt.type === "redman" ||
                  tgt.type === "sneakygolem"
                ? 15
                : 12,
          );
        }
      } else if (kind === "T") {
        const gy = getTerrainHeightAt(ev[1], ev[2]);
        spawnFloatText(
          new THREE.Vector3(ev[1], gy, ev[2]),
          ev[3],
          ev[4] || "#facc15",
          ev[5] || 15,
        );
        if (typeof ev[3] === "string" && ev[3].startsWith("+")) {
          const distCam = Math.hypot(
            ev[1] - cameraFocus.x,
            ev[2] - cameraFocus.z,
          );
          if (distCam < 55) sfx.play("gold");
        }
      } else if (kind === "R") {
        const picker = units.find((x) => x.netId === ev[4]);
        spawnShockwaveRing(ev[1], ev[2], 4.2, ev[3] || 0xfacc15, 0.55);
        if (picker && !picker.dead) {
          spawnFloatText(
            picker.mesh.position,
            ev[5] || "RUNE ACTIVATED!",
            "#facc15",
            15,
          );
          if (picker.isPlayer) sfx.play("gold");
        }
      } else if (kind === "X") {
        const gy = getTerrainHeightAt(ev[1], ev[2]);
        const burstCol =
          ev[3] === "radiant"
            ? 0x34d399
            : ev[3] === "neutral"
              ? 0xf59e0b
              : 0xf43f5e;
        const isMajor = [
          "hero",
          "boss",
          "dragon",
          "kong",
          "redman",
          "sneakygolem",
          "tower",
        ].includes(ev[4]);
        spawnParticleBurst(
          new THREE.Vector3(ev[1], gy, ev[2]),
          burstCol,
          isMajor ? 32 : 12,
        );
        if (ev[4] === "tower") {
          spawnShockwaveRing(ev[1], ev[2], 9.0, 0xfacc15, 0.9);
          triggerCameraShake(0.7);
        }
      } else if (kind === "B") {
        const killer = units.find((x) => x.netId === ev[1]);
        if (killer && !killer.dead) {
          killer.celebrateTimer = 1.45;
          spawnShockwaveRing(
            killer.mesh.position.x,
            killer.mesh.position.z,
            5.2,
            0xfacc15,
            0.65,
          );
          if (killer.isPlayer && killer.heroCfg && killer.heroCfg.voice) {
            sfx.speakHeroLine(
              killer.heroCfg,
              killer.heroCfg.voice.kill,
              true,
              "triumph",
              {
                category: "kill",
                chime: true,
                minGapMs: 2500,
                catGapMs: 4000,
              },
            );
          }
        }
        if (ev[2]) sfx.announceSpree(ev[2], ev[3] || 1);
      } else if (kind === "G") {
        if (ev[3] === 0) {
          sfx.play("aegis_reborn");
          spawnOrbitalSkyBeam(ev[1], ev[2], 5.5, 0xfacc15, 2.2);
          spawnShockwaveRing(ev[1], ev[2], 7.0, 0xfacc15, 1.5);
        } else {
          const gy = getTerrainHeightAt(ev[1], ev[2]);
          spawnShockwaveRing(ev[1], ev[2], 8.0, 0xfacc15, 0.8);
          spawnFloatText(
            new THREE.Vector3(ev[1], gy, ev[2]),
            "IMMORTAL REBIRTH!",
            "#facc15",
            20,
          );
        }
      } else if (kind === "W" && !gameOver) {
        endMatch(ev[1]);
      }
    }
  }
}

function stepGuestVisualsAndPrediction(dt) {
  matchTime += dt;
  if (riverShaderUniforms)
    riverShaderUniforms.uTime.value = matchTime * 0.22;
  updateUltraMaxEnvironmentAnimations(matchTime, dt);
  animatedFoliageMaterials.forEach((fm) => {
    if (fm.userData && fm.userData.windShader) {
      fm.userData.windShader.uniforms.uWindTime.value = matchTime;
    }
  });
  shopEntities.forEach((s, idx) => {
    if (s.signMesh) {
      s.signMesh.rotation.y += 1.6 * dt;
      s.signMesh.position.y =
        6.7 + Math.sin(matchTime * 2.5 + idx) * 0.25;
    }
    if (s.npcMesh)
      s.npcMesh.rotation.y = Math.sin(matchTime * 1.4 + idx) * 0.35;
  });
  fountainPillars.forEach((fp) => {
    if (fp.auraRing) fp.auraRing.rotation.z += 0.65 * dt;
    fp.crystals.forEach((c) => {
      c.mesh.rotation.y += 1.8 * dt;
      c.mesh.position.y =
        c.baseY + Math.sin(matchTime * 2.8 + c.phase) * 0.32;
    });
  });
  const sunMidday =
    !isNightTime &&
    (Math.cos((cycleClock / DAY_CYCLE_DURATION) * Math.PI) + 1) * 0.5 >
      0.78;
  const torchCap = getTorchLightCap();
  for (let ti = 0; ti < torchLights.length; ti++) {
    const tl = torchLights[ti];
    tl.phase += dt * 11;
    tl.flame.scale.y = 0.92 + Math.sin(tl.phase * 1.3) * 0.14;
    const nightBoost =
      ti < torchCap ? (isNightTime ? 1.55 : sunMidday ? 0.0 : 1.0) : 0.0;
    tl.light.intensity =
      (tl.baseIntensity + Math.sin(tl.phase) * 0.35) * nightBoost;
  }
  sfx.updateAmbience(
    Math.abs(cameraFocus.x - cameraFocus.z) / Math.SQRT2,
    currentWeather,
  );

  // 1. Guest Mobile Virtual Joystick (60 FPS local prediction + 16 Hz command sync)
  let localHeroMoving = false;
  if (playerHero && !playerHero.dead) {
    if (
      mobileTouchPadEnabled &&
      mobileJoyState.active &&
      (Math.abs(mobileJoyState.nx) > 0.01 ||
        Math.abs(mobileJoyState.ny) > 0.01)
    ) {
      playerHero.targetUnit = null;
      playerHero.attackMovePos = null;
      const mag = Math.min(
        1,
        Math.hypot(mobileJoyState.nx, mobileJoyState.ny),
      );
      const jx = THREE.MathUtils.clamp(
        playerHero.mesh.position.x +
          (mobileJoyState.nx / Math.max(0.001, mag)) * 8.0,
        -MAP_HALF + 3,
        MAP_HALF - 3,
      );
      const jz = THREE.MathUtils.clamp(
        playerHero.mesh.position.z +
          (mobileJoyState.ny / Math.max(0.001, mag)) * 8.0,
        -MAP_HALF + 3,
        MAP_HALF - 3,
      );
      playerHero.targetPos = new THREE.Vector3(jx, 0, jz);
      mpState.joySendAccum += dt;
      if (mpState.joySendAccum >= 0.06) {
        mpState.joySendAccum = 0;
        mpSendToHost({ type: "CMD", cmd: "MOVE", x: jx, z: jz });
      }
    }

    // 2. Client-side movement prediction for Guest's own hero (strictly 2D XZ distance so terrain height never stalls arrival)
    const gPrevX = playerHero.mesh.position.x;
    const gPrevZ = playerHero.mesh.position.z;
    if (playerHero.stunTimer > 0) {
      playerHero.targetUnit = null;
      playerHero.targetPos = null;
      playerHero.attackMovePos = null;
    } else if (playerHero.targetUnit) {
      if (playerHero.targetUnit.dead) {
        playerHero.targetUnit = null;
      } else {
        const reach = playerHero.atkRange + playerHero.targetUnit.radius;
        const tdx = playerHero.targetUnit.mesh.position.x - gPrevX;
        const tdz = playerHero.targetUnit.mesh.position.z - gPrevZ;
        if (tdx * tdx + tdz * tdz > reach * reach) {
          stepMove(playerHero, playerHero.targetUnit.mesh.position, dt);
        }
      }
    } else if (playerHero.attackMovePos) {
      const adx = playerHero.attackMovePos.x - gPrevX;
      const adz = playerHero.attackMovePos.z - gPrevZ;
      if (adx * adx + adz * adz <= 0.64) {
        playerHero.attackMovePos = null;
      } else {
        stepMove(playerHero, playerHero.attackMovePos, dt);
      }
    } else if (playerHero.targetPos) {
      const pdx = playerHero.targetPos.x - gPrevX;
      const pdz = playerHero.targetPos.z - gPrevZ;
      if (pdx * pdx + pdz * pdz <= 0.49) {
        playerHero.targetPos = null;
      } else {
        stepMove(playerHero, playerHero.targetPos, dt);
      }
    }
    const gActualMoved = Math.hypot(
      playerHero.mesh.position.x - gPrevX,
      playerHero.mesh.position.z - gPrevZ,
    );
    localHeroMoving = gActualMoved > 0.006;

    // Latency-aware anti-rubberband reconciliation:
    // Guest predicts locally at t=0 and arrives at targetPos ~RTT/2 earlier than Host.
    const nowPerf = performance.now();
    const estRttSec = Math.min(
      0.65,
      Math.max(0.06, (mpState.pingMs || 140) / 1000),
    );
    const awaitingAck =
      (mpState.cmdSeq || 0) > (playerHero._ackCmdSeq || 0) &&
      nowPerf - (mpState.lastCmdSentAt || 0) < 1400;

    if (localHeroMoving || awaitingAck) {
      playerHero._stopGraceTimer = estRttSec + 0.35;
    } else if ((playerHero._stopGraceTimer || 0) > 0) {
      playerHero._stopGraceTimer = Math.max(
        0,
        playerHero._stopGraceTimer - dt,
      );
    }

    if (
      playerHero._netHasPos &&
      !awaitingAck &&
      !playerHero.activeDash &&
      (playerHero._dashLockTimer || 0) <= 0
    ) {
      const errX = playerHero._netX - playerHero.mesh.position.x;
      const errZ = playerHero._netZ - playerHero.mesh.position.z;
      const errDist = Math.hypot(errX, errZ);
      // Expected network transit lead = hero speed * (RTT * 0.65) + 2.2m margin
      const expectedLead = Math.max(
        3.2,
        playerHero.getEffectiveSpeed() * (estRttSec * 0.65) + 2.2,
      );

      if (localHeroMoving) {
        // Only pull if error exceeds expected network transit lead (prevents backward snap while moving)
        if (errDist > expectedLead) {
          const excess = (errDist - expectedLead) / errDist;
          const alpha = Math.min(1, dt * 4.0) * excess;
          playerHero.mesh.position.x += errX * alpha;
          playerHero.mesh.position.z += errZ * alpha;
          playerHero.mesh.position.y = getTerrainHeightAt(
            playerHero.mesh.position.x,
            playerHero.mesh.position.z,
          );
        }
      } else if ((playerHero._stopGraceTimer || 0) <= 0) {
        // Wait until Host has also finished arriving (_netMoving === false) before snapping to final resting spot
        if (!playerHero._netMoving && errDist > 0.35) {
          const alpha = 1 - Math.exp(-10.0 * dt);
          playerHero.mesh.position.x += errX * alpha;
          playerHero.mesh.position.z += errZ * alpha;
          playerHero.mesh.position.y = getTerrainHeightAt(
            playerHero.mesh.position.x,
            playerHero.mesh.position.z,
          );
        }
        if (!playerHero._netMoving) {
          let diff = playerHero._netYaw - playerHero.mesh.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          playerHero.mesh.rotation.y += diff * Math.min(1, dt * 12.0);
        }
      }
    }
  }

  if (playerHero) {
    ["Q", "W", "E", "R"].forEach((k) => {
      if (playerHero.cooldowns[k] > 0)
        playerHero.cooldowns[k] = Math.max(
          0,
          playerHero.cooldowns[k] - dt,
        );
    });
    for (const ik in playerHero.itemCooldowns) {
      if (playerHero.itemCooldowns[ik] > 0)
        playerHero.itemCooldowns[ik] = Math.max(
          0,
          playerHero.itemCooldowns[ik] - dt,
        );
    }
    if (playerHero.tpChannel) {
      playerHero.tpChannel.timer = Math.max(
        0,
        playerHero.tpChannel.timer - dt,
      );
      const tpBox = getHudEl("tp-channel-box");
      if (tpBox) {
        tpBox.classList.remove("hidden");
        const pct = Math.min(
          100,
          ((playerHero.tpChannel.duration - playerHero.tpChannel.timer) /
            playerHero.tpChannel.duration) *
            100,
        );
        const fill = getHudEl("tp-channel-fill");
        const secEl = getHudEl("tp-channel-sec");
        if (fill) fill.style.width = `${pct.toFixed(1)}%`;
        if (secEl)
          secEl.textContent = playerHero.tpChannel.timer.toFixed(1);
      }
      if (playerHero.tpChannel.timer <= 0 || playerHero.dead) {
        playerHero.tpChannel = null;
        const tpBox = getHudEl("tp-channel-box");
        if (tpBox) tpBox.classList.add("hidden");
      }
    }
  }

  // 3. Smooth 60 FPS critical-damped interpolation, ongoing hero ability visuals & skeletal animations
  const interpAlpha = 1 - Math.exp(-18.0 * dt);
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.hitFlashTimer > 0)
      u.hitFlashTimer = Math.max(0, u.hitFlashTimer - dt);
    if (u.swingAnim > 0) u.swingAnim = Math.max(0, u.swingAnim - dt);
    if (u.castAnim > 0) u.castAnim = Math.max(0, u.castAnim - dt);
    if (u.celebrateTimer > 0)
      u.celebrateTimer = Math.max(0, u.celebrateTimer - dt);
    if (u.stunTimer > 0) u.stunTimer = Math.max(0, u.stunTimer - dt);
    if (u.slowTimer > 0) u.slowTimer = Math.max(0, u.slowTimer - dt);
    if (u.blinkBuffTimer > 0)
      u.blinkBuffTimer = Math.max(0, u.blinkBuffTimer - dt);
    if (u._dashLockTimer > 0)
      u._dashLockTimer = Math.max(0, u._dashLockTimer - dt);
    if (u.fatalBondTimer > 0) {
      u.fatalBondTimer = Math.max(0, u.fatalBondTimer - dt);
      if (u.fatalBondTimer === 0) u.fatalBondGroup = null;
    }
    if (u.dead) {
      u.activeDash = null;
      u.bladeFuryTimer = 0;
      u.fireTrailTimer = 0;
      if (u.type === "hero" && u.deathAnimTimer > 0) {
        u.deathAnimTimer -= dt;
        const prog = 1 - Math.max(0, u.deathAnimTimer / 1.25);
        updateHeroSkeletalAnimation(
          u.parts,
          "DEATH",
          matchTime,
          dt,
          false,
          prog,
        );
        if (u.deathAnimTimer <= 0) u.mesh.visible = false;
      }
      continue;
    }

    if (u.type === "hero" && u.parts) {
      if (u.parts.shieldBubble) {
        u.parts.shieldBubble.visible =
          (u.shield || 0) > 0 ||
          (u.bladeMailTimer || 0) > 0 ||
          (u.bkbTimer || 0) > 0;
        u.parts.shieldBubble.rotation.y += 1.6 * dt;
      }
      if (u.parts.radAura) {
        u.parts.radAura.visible = Boolean(u.hasRadiance);
        u.parts.radAura.rotation.z += 0.8 * dt;
      }
    }

    let isMoving = false;
    let guestTurnRoll = 0;
    if (u.activeDash) {
      u.activeDash.t += dt;
      const dp = Math.min(1, u.activeDash.t / u.activeDash.dur);
      const ease = 1 - Math.pow(1 - dp, 2.2);
      u.mesh.position.x = THREE.MathUtils.lerp(
        u.activeDash.startX,
        u.activeDash.endX,
        ease,
      );
      u.mesh.position.z = THREE.MathUtils.lerp(
        u.activeDash.startZ,
        u.activeDash.endZ,
        ease,
      );
      const gy = getTerrainHeightAt(u.mesh.position.x, u.mesh.position.z);
      u.mesh.position.y =
        gy + Math.sin(dp * Math.PI) * (u.activeDash.arcHeight || 1.8);
      if (Math.random() < 0.55) {
        spawnShockwaveRing(
          u.mesh.position.x,
          u.mesh.position.z,
          1.8,
          u.activeDash.colHex || 0xd946ef,
          0.24,
        );
      }
      if (dp >= 1) {
        u.mesh.position.y = gy;
        u.activeDash = null;
      }
    } else if (u.isPlayer) {
      isMoving = localHeroMoving;
    } else if (u._netHasPos && (u._dashLockTimer || 0) <= 0) {
      const ageSec = u._netTs ? (performance.now() - u._netTs) / 1000 : 1;
      if (ageSec > 0.14) u._netMoving = false;
      const netSpd = Math.hypot(u._netVx || 0, u._netVz || 0);
      if (ageSec < 0.14 && netSpd > 1.5) {
        u._netX = THREE.MathUtils.clamp(
          u._netX + u._netVx * dt,
          -MAP_HALF + 3,
          MAP_HALF - 3,
        );
        u._netZ = THREE.MathUtils.clamp(
          u._netZ + u._netVz * dt,
          -MAP_HALF + 3,
          MAP_HALF - 3,
        );
      }
      const dx = u._netX - u.mesh.position.x;
      const dz = u._netZ - u.mesh.position.z;
      isMoving = dx * dx + dz * dz > 0.012 || !!u._netMoving;
      u.mesh.position.x += dx * interpAlpha;
      u.mesh.position.z += dz * interpAlpha;
      u.mesh.position.y = getTerrainHeightAt(
        u.mesh.position.x,
        u.mesh.position.z,
      );
      let diff = u._netYaw - u.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.mesh.rotation.y += diff * Math.min(1, dt * 16.0);
      guestTurnRoll = THREE.MathUtils.clamp(-diff * 0.28, -0.26, 0.26);
    }

    if (u.bladeFuryTimer > 0) {
      u.bladeFuryTimer = Math.max(0, u.bladeFuryTimer - dt);
      u.bladeFuryTick = (u.bladeFuryTick || 0) + dt;
      if (u.bladeFuryTick >= 0.25) {
        u.bladeFuryTick = 0;
        spawnMeleeSlashArc(
          u.mesh.position,
          matchTime * 14,
          5.8,
          0xfb923c,
          0.22,
        );
      }
    }
    if (u.fireTrailTimer > 0) {
      u.fireTrailTimer = Math.max(0, u.fireTrailTimer - dt);
      u.fireTrailTick = (u.fireTrailTick || 0) + dt;
      if (u.fireTrailTick >= 0.32) {
        u.fireTrailTick = 0;
        spawnPersistentZone({
          zoneType: "sunbeam",
          owner: u,
          team: u.team,
          x: u.mesh.position.x,
          z: u.mesh.position.z,
          radius: 3.2,
          duration: 2.2,
          colorHex: 0xf97316,
          secondaryHex: 0xfacc15,
          tickDmg: 0,
        });
      }
    }

    const onScreen =
      Math.abs(u.mesh.position.x - cameraFocus.x) <= 72 &&
      Math.abs(u.mesh.position.z - cameraFocus.z) <= 62;
    const doSkeletalStep = onScreen;
    const animDt = dt;
    if (!doSkeletalStep) continue;

    if (u.type === "hero" && u.parts) {
      const pose =
        u.bladeFuryTimer > 0
          ? "WHIRLWIND"
          : u.celebrateTimer > 0
            ? "CELEBRATE"
            : u.castAnim > 0 || u.reincarnating
              ? "CAST"
              : u.swingAnim > 0
                ? "ATTACK"
                : isMoving
                  ? "RUN"
                  : "IDLE";
      const isRanged = u.heroCfg && u.heroCfg.rangeType === "Ranged";
      const atkProg = u.swingAnim > 0 ? 1 - u.swingAnim / 0.34 : 0;
      const spdRatio = isMoving
        ? THREE.MathUtils.clamp(
            (u.getEffectiveSpeed ? u.getEffectiveSpeed() : 12.8) / 12.8,
            0.55,
            1.75,
          )
        : 1.0;
      updateHeroSkeletalAnimation(
        u.parts,
        pose,
        matchTime + u.animPhase,
        animDt,
        isRanged,
        atkProg,
        isMoving ? guestTurnRoll : 0,
        0,
        spdRatio,
      );
    } else if (u.type === "creep") {
      updateCreepAnimation(u, matchTime + u.animPhase, animDt, isMoving);
    } else if (u.type === "neutral") {
      updateNeutralAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "kong") {
      updatePPLabuAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "redman") {
      updateRedManAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "sneakygolem") {
      updateSneakyGolemAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "dragon") {
      updateElderDragonAnimation(u, matchTime, dt);
    } else if (u.type === "boss") {
      updateRoshanAnimation(u, matchTime, dt, isMoving);
    } else if (u.type === "tower" && u.parts && u.parts.crystal) {
      u.parts.crystal.rotation.y += dt * 1.45;
      u.parts.crystal.position.y =
        u.parts.crystalBaseY + Math.sin(matchTime * 2.6 + u.id) * 0.24;
    } else if (u.type === "ancient" && u.parts && u.parts.crystal) {
      u.parts.crystal.rotation.y += dt * 0.95;
      u.parts.crystal.position.y =
        u.parts.crystalBaseY + Math.sin(matchTime * 2.0 + u.id) * 0.34;
    }
  }

  // 4. Step delayed spell impacts (meteors / Light Strike Array / Omnislash / Supernova)
  for (let i = scheduledEvents.length - 1; i >= 0; i--) {
    scheduledEvents[i].delay -= dt;
    if (scheduledEvents[i].delay <= 0) {
      const ev = scheduledEvents.splice(i, 1)[0];
      try {
        ev.fn();
      } catch (e) {}
    }
  }

  // 5. Step & clean up ALL visual projectiles on Guest (hook, homing, wave, boomerang, prismSplit, ricochet)
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.kind === "hook") {
      const step = p.speed * dt;
      if (p.owner && !p.owner.dead) {
        _vScratch1.set(
          p.owner.mesh.position.x,
          p.owner.mesh.position.y + 1.55,
          p.owner.mesh.position.z,
        );
      } else {
        _vScratch1.copy(p.mesh.position);
      }
      const ownerPos = _vScratch1;

      if (p.phase === "out") {
        p.mesh.position.addScaledVector(p.dir, step);
        p.distLeft -= step;
        const px = p.mesh.position.x;
        const pz = p.mesh.position.z;
        for (let ui = 0; ui < units.length; ui++) {
          const u = units[ui];
          if (
            !u.dead &&
            u.team !== p.team &&
            u.type !== "ancient" &&
            u.type !== "tower"
          ) {
            const rSum = 2.5 + u.radius;
            const dx = u.mesh.position.x - px;
            const dz = u.mesh.position.z - pz;
            if (dx * dx + dz * dz <= rSum * rSum) {
              p.hookedTarget = u;
              p.phase = "return";
              spawnParticleBurst(u.mesh.position, p.colorHex, 24);
              spawnFloatText(
                u.mesh.position,
                p.hookMode === "pull_caster"
                  ? "ANCHOR LATCHED!"
                  : "MEAT HOOKED!",
                "#10b981",
                16,
              );
              break;
            }
          }
        }
        if (p.phase === "out" && p.distLeft <= 0) {
          if (p.hookMode === "pull_caster" && p.owner && !p.owner.dead) {
            p.phase = "winch_caster";
            p.winchTime = 0;
          } else {
            p.phase = "return";
          }
        }
      } else if (p.phase === "winch_caster") {
        p.winchTime = (p.winchTime || 0) + dt;
        if (!p.owner || p.owner.dead || p.winchTime > 0.75) {
          if (p.chainLinks)
            p.chainLinks.forEach((lk) => {
              scene.remove(lk);
              disposeObject3D(lk);
            });
          scene.remove(p.mesh);
          disposeObject3D(p.mesh);
          projectiles.splice(i, 1);
          continue;
        }
        const d = Math.hypot(
          p.mesh.position.x - ownerPos.x,
          p.mesh.position.z - ownerPos.z,
        );
        if (d <= 2.8) {
          spawnParticleBurst(p.owner.mesh.position, p.colorHex, 24);
          if (p.chainLinks)
            p.chainLinks.forEach((lk) => {
              scene.remove(lk);
              disposeObject3D(lk);
            });
          scene.remove(p.mesh);
          disposeObject3D(p.mesh);
          projectiles.splice(i, 1);
          continue;
        }
      } else {
        const toOwner = new THREE.Vector3().subVectors(
          ownerPos,
          p.mesh.position,
        );
        toOwner.y = 0;
        const d = toOwner.length();
        if (d <= 2.6 || !p.owner || p.owner.dead) {
          if (p.chainLinks)
            p.chainLinks.forEach((lk) => {
              scene.remove(lk);
              disposeObject3D(lk);
            });
          scene.remove(p.mesh);
          disposeObject3D(p.mesh);
          projectiles.splice(i, 1);
          continue;
        }
        toOwner.normalize();
        if (
          p.hookMode === "pull_caster" &&
          p.hookedTarget &&
          !p.hookedTarget.dead
        ) {
          const distOwnerVictim = Math.hypot(
            p.hookedTarget.mesh.position.x - p.owner.mesh.position.x,
            p.hookedTarget.mesh.position.z - p.owner.mesh.position.z,
          );
          if (distOwnerVictim <= 3.0) {
            if (p.chainLinks)
              p.chainLinks.forEach((lk) => {
                scene.remove(lk);
                disposeObject3D(lk);
              });
            scene.remove(p.mesh);
            disposeObject3D(p.mesh);
            projectiles.splice(i, 1);
            continue;
          }
          p.mesh.position
            .copy(p.hookedTarget.mesh.position)
            .add(new THREE.Vector3(0, 1.55, 0));
        } else {
          p.mesh.position.addScaledVector(toOwner, step * 1.18);
        }
      }

      if (p.chainLinks) {
        const curOwnerHand =
          p.owner && !p.owner.dead
            ? p.owner.mesh.position
                .clone()
                .add(new THREE.Vector3(0, 1.55, 0))
            : p.mesh.position;
        for (let li = 0; li < p.chainLinks.length; li++) {
          const frac = (li + 1) / (p.chainLinks.length + 1);
          p.chainLinks[li].position.lerpVectors(
            curOwnerHand,
            p.mesh.position,
            frac,
          );
          p.chainLinks[li].rotation.y = Math.atan2(p.dir.x, p.dir.z);
        }
      }
    } else if (p.kind === "homing") {
      if (!p.target || p.target.dead) {
        scene.remove(p.mesh);
        disposeObject3D(p.mesh);
        projectiles.splice(i, 1);
        continue;
      }
      _vScratch1.set(
        p.target.mesh.position.x,
        p.target.mesh.position.y + 1.6,
        p.target.mesh.position.z,
      );
      _vScratch2.subVectors(_vScratch1, p.mesh.position);
      const step = p.speed * dt;
      const dist = _vScratch2.length();
      if (dist <= step + 0.5) {
        if (
          (p.owner && p.owner.type === "tower") ||
          (p.target && p.target.type === "tower")
        ) {
          const refPos =
            p.owner && p.owner.type === "tower"
              ? p.owner.mesh.position
              : p.target.mesh.position;
          const camDist = Math.hypot(
            refPos.x - cameraFocus.x,
            refPos.z - cameraFocus.z,
          );
          const heroDist =
            playerHero && !playerHero.dead
              ? Math.hypot(
                  refPos.x - playerHero.mesh.position.x,
                  refPos.z - playerHero.mesh.position.z,
                )
              : Infinity;
          const nearDist = Math.min(camDist, heroDist);
          if (nearDist <= 42.0) sfx.play("tower_hit", nearDist);
          if (p.owner && p.owner.type === "tower") {
            spawnShockwaveRing(
              p.target.mesh.position.x,
              p.target.mesh.position.z,
              2.1,
              p.owner.team === "radiant" ? 0x34d399 : 0xf43f5e,
              0.26,
            );
          }
        }
        if (p.isUmaxHeroProj && p.owner && p.owner.heroCfg) {
          spawnHeroAttackSparkles(
            p.target.mesh.position,
            p.owner.heroCfg.primaryHex,
            p.owner.heroCfg.secondaryHex,
            p.isCrit,
          );
        }
        scene.remove(p.mesh);
        disposeObject3D(p.mesh);
        projectiles.splice(i, 1);
      } else {
        _vScratch2.multiplyScalar(step / dist);
        p.mesh.position.add(_vScratch2);
        if (p.arcHeight && p.totalDist > 0.5) {
          const remDist = Math.hypot(
            p.target.mesh.position.x - p.mesh.position.x,
            p.target.mesh.position.z - p.mesh.position.z,
          );
          const frac = THREE.MathUtils.clamp(
            1 - remDist / p.totalDist,
            0,
            1,
          );
          const baseLineY = THREE.MathUtils.lerp(
            p.startPos.y,
            p.target.mesh.position.y + 1.6,
            frac,
          );
          p.mesh.position.y =
            baseLineY + Math.sin(frac * Math.PI) * p.arcHeight;
        }
        if (p.trailCol && Math.random() < 0.35) {
          spawnShockwaveRing(
            p.mesh.position.x,
            p.mesh.position.z,
            0.75,
            p.trailCol,
            0.16,
          );
        }
      }
    } else if (p.kind === "wave") {
      const step = p.speed * dt;
      if (p.boomerang && p.boomerangPhase === "return") {
        if (p.owner && !p.owner.dead) {
          _vScratch1.subVectors(p.owner.mesh.position, p.mesh.position);
          _vScratch1.y = 0;
          const distBack = _vScratch1.length();
          if (distBack <= 2.2) {
            p.distLeft = 0;
          } else {
            _vScratch1.normalize();
            p.dir.lerp(_vScratch1, Math.min(1, dt * 10)).normalize();
            p.mesh.position.addScaledVector(p.dir, step * 1.12);
            p.distLeft -= step;
          }
        } else {
          p.distLeft = 0;
        }
      } else {
        if (p.boomerang && p.curveSign) {
          const ang = p.curveSign * 0.95 * dt;
          const ca = Math.cos(ang),
            sa = Math.sin(ang);
          const nx = p.dir.x * ca + p.dir.z * sa;
          const nz = -p.dir.x * sa + p.dir.z * ca;
          p.dir.x = nx;
          p.dir.z = nz;
        }
        p.mesh.position.addScaledVector(p.dir, step);
        p.distLeft -= step;
      }
      if (p.spinMesh) p.mesh.rotation.y += 14 * dt;
      if (p.trailColor && Math.random() < 0.5) {
        spawnShockwaveRing(
          p.mesh.position.x,
          p.mesh.position.z,
          1.45,
          p.trailColor,
          0.24,
        );
        if (p.leaveFissure)
          spawnGroundRuneDecal(
            p.mesh.position.x,
            p.mesh.position.z,
            1.35,
            p.trailColor,
            0.65,
          );
      }
      const px = p.mesh.position.x;
      const pz = p.mesh.position.z;
      const waveCandidates = querySpatialUnits(
        px,
        pz,
        p.hitRadius + 5.5,
        _spatialQueryBufA,
      );
      for (let ui = 0; ui < waveCandidates.length; ui++) {
        const u = waveCandidates[ui];
        if (
          !u.dead &&
          u.team !== p.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          !p.hitIds.has(u.id)
        ) {
          const rSum = p.hitRadius + u.radius;
          const dx = u.mesh.position.x - px;
          const dz = u.mesh.position.z - pz;
          if (dx * dx + dz * dz <= rSum * rSum) {
            p.hitIds.add(u.id);
            if (p.prismSplit) {
              const { geo: spGeo, mat: spMat } = getPrismShardAssets();
              [-0.45, 0, 0.45].forEach((sAng) => {
                const spDir = p.dir
                  .clone()
                  .applyAxisAngle(_yUpAxis, sAng);
                const spMesh = new THREE.Mesh(spGeo, spMat);
                spMesh.rotation.x = Math.PI / 2;
                spMesh.rotation.y = Math.atan2(spDir.x, spDir.z);
                spMesh.position.set(px, 1.5, pz);
                scene.add(spMesh);
                projectiles.push({
                  kind: "wave",
                  owner: p.owner,
                  team: p.team,
                  mesh: spMesh,
                  trailColor: 0x38bdf8,
                  dir: spDir,
                  speed: 46,
                  distLeft: 14,
                  hitRadius: 2.2,
                  damage: 0,
                  hitIds: new Set([u.id]),
                });
              });
            }
            if (p.ricochetBounces && p.ricochetBounces > 0) {
              let nextTarget = null;
              let bestD = 14.0;
              for (let oi = 0; oi < units.length; oi++) {
                const cand = units[oi];
                if (
                  !cand.dead &&
                  cand.team !== p.team &&
                  cand.type !== "ancient" &&
                  !p.hitIds.has(cand.id)
                ) {
                  const dCand = Math.hypot(
                    cand.mesh.position.x - u.mesh.position.x,
                    cand.mesh.position.z - u.mesh.position.z,
                  );
                  if (dCand < bestD) {
                    bestD = dCand;
                    nextTarget = cand;
                  }
                }
              }
              if (nextTarget) {
                p.ricochetBounces--;
                p.dir
                  .subVectors(nextTarget.mesh.position, p.mesh.position)
                  .setY(0)
                  .normalize();
                p.distLeft = Math.max(p.distLeft, bestD + 4.0);
                spawnLightningBolt3D(
                  u.mesh.position,
                  nextTarget.mesh.position,
                  0xbef264,
                  0x10b981,
                  0.35,
                );
                break;
              }
            }
            if (p.chainLightning) {
              let hops = 0;
              for (let oi = 0; oi < units.length; oi++) {
                const other = units[oi];
                if (
                  hops < 3 &&
                  other !== u &&
                  !other.dead &&
                  other.team !== p.team &&
                  other.type !== "ancient"
                ) {
                  const cRad = 11.0 + other.radius;
                  const cdx = other.mesh.position.x - u.mesh.position.x;
                  const cdz = other.mesh.position.z - u.mesh.position.z;
                  if (cdx * cdx + cdz * cdz <= cRad * cRad) {
                    hops++;
                    spawnLightningBolt3D(
                      u.mesh.position,
                      other.mesh.position,
                      0xffffff,
                      0x38bdf8,
                      0.42,
                    );
                  }
                }
              }
            }
            spawnParticleBurst(
              u.mesh.position,
              p.trailColor || 0x38bdf8,
              12,
            );
            if (p.stopOnFirstHit) {
              p.distLeft = 0;
              break;
            }
          }
        }
      }
      if (p.distLeft <= 0) {
        if (
          p.boomerang &&
          p.boomerangPhase === "out" &&
          p.owner &&
          !p.owner.dead
        ) {
          p.boomerangPhase = "return";
          p.hitIds.clear();
          p.distLeft = 36;
        } else {
          scene.remove(p.mesh);
          disposeObject3D(p.mesh);
          projectiles.splice(i, 1);
        }
      }
    }
  }

  // 6. Step & expire Persistent Zones on Guest (Chronosphere, Black Hole, Sunbeam, Banner, Trap, Smoke, Slag Pool)
  for (let zi = activeZones.length - 1; zi >= 0; zi--) {
    const z = activeZones[zi];
    z.t += dt;
    z.tickAccum += dt;
    if (z.outerRing) z.outerRing.rotation.z += dt * 1.4;
    if (z.zoneType === "trap" && z.tickAccum >= 0.25) {
      z.tickAccum = 0;
      for (let ui = 0; ui < units.length; ui++) {
        const u = units[ui];
        if (
          !u.dead &&
          u.team !== z.team &&
          u.type !== "tower" &&
          u.type !== "ancient"
        ) {
          const rSum = z.radius + u.radius;
          const dx = u.mesh.position.x - z.x;
          const dz = u.mesh.position.z - z.z;
          if (dx * dx + dz * dz <= rSum * rSum) {
            spawnIceCrystalPrison3D(u, z.trapRootDur || 2.2);
            spawnFloatText(
              u.mesh.position,
              "FROST TRAP SNARED!",
              "#38bdf8",
              15,
            );
            z.t = z.duration + 1;
            break;
          }
        }
      }
    }
    if (z.t >= z.duration) {
      if (z.detonateDmg) {
        spawnShockwaveRing(z.x, z.z, z.radius * 1.25, z.colorHex, 0.65);
        spawnParticleBurst(
          new THREE.Vector3(z.x, getTerrainHeightAt(z.x, z.z) + 1.2, z.z),
          z.colorHex,
          32,
        );
      }
      if (z.mesh) {
        scene.remove(z.mesh);
        disposeObject3D(z.mesh);
      }
      activeZones.splice(zi, 1);
    }
  }

  // 7. Step & expire Terrakor Granite Fissure Walls on Guest
  for (let wi = fissureWalls.length - 1; wi >= 0; wi--) {
    const w = fissureWalls[wi];
    w.timer -= dt;
    if (w.timer <= 0) {
      if (w.pillars)
        w.pillars.forEach((pm) => {
          scene.remove(pm);
          disposeObject3D(pm);
        });
      fissureWalls.splice(wi, 1);
    }
  }

  runes.forEach((r) => {
    r.gem.rotation.y += 2.2 * dt;
    r.gem.position.y = 1.5 + Math.sin(matchTime * 3.5) * 0.25;
  });

  for (let i = fxList.length - 1; i >= 0; i--) {
    const fx = fxList[i];
    fx.t += dt;
    const prog = Math.min(1, fx.t / fx.dur);
    fx.update(prog);
    if (prog >= 1) {
      scene.remove(fx.mesh);
      if (!fx.pooledMesh) {
        if (fx.pooledMat) releaseFxMat(fx.pooledMat);
        else disposeObject3D(fx.mesh);
      }
      fxList.splice(i, 1);
    }
  }
  if (moveRingTimer > 0) {
    moveRingTimer -= dt;
    const s = 0.55 + moveRingTimer * 1.15;
    moveRingGroup.scale.set(s, 1, s);
    if (moveRingTimer <= 0) moveRingGroup.visible = false;
  }
}

function mpStepNetwork(dt) {
  if (inHeroSelect && mpState.role === "host") {
    mpState.announceAccum += dt;
    if (mpState.announceAccum >= 1.5) {
      mpState.announceAccum = 0;
      mpBroadcast({
        type: "ROOM_ANNOUNCE",
        hostName: mpState.myName,
        count: mpState.players.size,
      });
    }
    return;
  }
  if (!mpState.active) return;

  if (mpState.role === "host") {
    const remoteCount = Math.max(1, mpState.conns.size);
    const targetInterval =
      mpState.transport === "online"
        ? remoteCount >= 5
          ? 0.1
          : remoteCount >= 2
            ? 0.085
            : 0.075
        : 0.05;
    mpState.syncAccum += dt;
    mpState.heartbeatAccum = (mpState.heartbeatAccum || 0) + dt;
    if (mpState.syncAccum >= targetInterval) {
      // Only pause if ALL remote peers are simultaneously congested; otherwise mpBroadcast skips slow peers individually
      let openPeers = 0;
      let congestedPeers = 0;
      mpState.conns.forEach((conn, key) => {
        const fastDc = mpState.fastDataChannels.get(key);
        const dc =
          fastDc && fastDc.readyState === "open"
            ? fastDc
            : conn.dataChannel || conn._dc;
        if (dc && dc.readyState === "open") {
          openPeers++;
          if (dc.bufferedAmount > 24576) congestedPeers++;
        }
      });
      if (openPeers === 0 || congestedPeers < openPeers) {
        mpState.syncAccum = 0;
        const snap = buildAuthoritativeSnapshot();
        const hasChanges = Boolean(
          snap.sp || snap.m || snap.h || snap.rem || snap.ev || snap.full,
        );
        if (hasChanges || mpState.heartbeatAccum >= 1.0) {
          mpState.heartbeatAccum = 0;
          mpBroadcast({ type: "WORLD_SNAP", snap });
        }
      }
    }
    mpState.pingAccum += dt;
    if (mpState.pingAccum >= 1.0 && mpState.conns.size > 0) {
      mpState.pingAccum = 0;
      updateMpRelayUsageDisplay();
    }
  } else if (mpState.role === "guest") {
    mpState.pingAccum += dt;
    if (mpState.pingAccum >= 1.0) {
      mpState.pingAccum = 0;
      mpSendToHost({
        type: "PING_REQ",
        ts: performance.now(),
        lastRtt: mpState.pingMs,
      });
      updateMpRelayUsageDisplay();
    }
  } else if (
    mpState.role === "local2p" &&
    localP2Hero &&
    !localP2Hero.dead &&
    !gameOver
  ) {
    const p2HpEl = document.getElementById("p2-hud-hp");
    const p2MpEl = document.getElementById("p2-hud-mp");
    if (p2HpEl)
      p2HpEl.textContent = Math.max(0, Math.round(localP2Hero.hp));
    if (p2MpEl)
      p2MpEl.textContent = Math.max(0, Math.round(localP2Hero.mana));

    let mx = (p2MoveKeys.right ? 1 : 0) - (p2MoveKeys.left ? 1 : 0);
    let mz = (p2MoveKeys.down ? 1 : 0) - (p2MoveKeys.up ? 1 : 0);
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      localP2Hero.targetUnit = null;
      localP2Hero.attackMovePos = null;
      localP2Hero.targetPos = new THREE.Vector3(
        THREE.MathUtils.clamp(
          localP2Hero.mesh.position.x + mx * 6.0,
          -MAP_HALF + 3,
          MAP_HALF - 3,
        ),
        0,
        THREE.MathUtils.clamp(
          localP2Hero.mesh.position.z + mz * 6.0,
          -MAP_HALF + 3,
          MAP_HALF - 3,
        ),
      );
    }
  }
}

const INFINITY_UNLOCK_KEY = "dota3d_infinity_unlocked_v1";
const INFINITY_TEST_UNLOCK_BYPASS = false;

function isInfinityUnlocked() {
  if (INFINITY_TEST_UNLOCK_BYPASS) return true;
  try {
    return localStorage.getItem(INFINITY_UNLOCK_KEY) === "1";
  } catch (e) {
    return Boolean(window._infinityUnlockedMem);
  }
}
function setInfinityUnlocked(val) {
  window._infinityUnlockedMem = Boolean(val);
  try {
    if (val) localStorage.setItem(INFINITY_UNLOCK_KEY, "1");
    else localStorage.removeItem(INFINITY_UNLOCK_KEY);
  } catch (e) {}
  syncInfinityLockUI();
}
function syncInfinityLockUI() {
  const unlocked = isInfinityUnlocked();
  const btn = document.querySelector('.diff-pill[data-diff="infinity"]');
  const icon = document.getElementById("infinity-lock-icon");
  if (btn) {
    btn.title = unlocked
      ? "Infinity Mode: 2x Monsters, No Consumables, Sneaky Golem Ancient Defender & Apex Enemy AI!"
      : "LOCKED: Win 1 match on Immortal difficulty to unlock Infinity Mode!";
    btn.classList.toggle("opacity-65", !unlocked);
  }
  if (icon) {
    icon.className = unlocked
      ? "fa-solid fa-infinity text-[8.5px] mr-0.5 text-fuchsia-300"
      : "fa-solid fa-lock text-[8px] mr-0.5 text-rose-400";
  }
}

const AI_DIFFICULTY_PROFILES = {
  squire: {
    label: "Squire",
    hpMult: 0.85,
    dmgMult: 0.85,
    goldMult: 0.95,
    xpMult: 0.95,
    spdMult: 0.95,
    atkSpdBonus: 0.0,
    reactionDelay: 1.15,
    comboSmart: false,
    autoBuy: false,
    consumableLimit: 5,
    monsterMult: 1.0,
  },
  veteran: {
    label: "Veteran",
    hpMult: 1.25,
    dmgMult: 1.22,
    goldMult: 1.18,
    xpMult: 1.18,
    spdMult: 1.04,
    atkSpdBonus: 0.16,
    reactionDelay: 0.45,
    comboSmart: true,
    autoBuy: true,
    consumableLimit: 3,
    monsterMult: 1.0,
  },
  grandmaster: {
    label: "Grandmaster",
    hpMult: 1.72,
    dmgMult: 1.65,
    goldMult: 1.42,
    xpMult: 1.38,
    spdMult: 1.12,
    atkSpdBonus: 0.34,
    reactionDelay: 0.18,
    comboSmart: true,
    autoBuy: true,
    consumableLimit: 2,
    monsterMult: 1.0,
  },
  immortal: {
    label: "Immortal",
    hpMult: 2.35,
    dmgMult: 2.25,
    goldMult: 1.75,
    xpMult: 1.65,
    spdMult: 1.22,
    atkSpdBonus: 0.55,
    reactionDelay: 0.04,
    comboSmart: true,
    autoBuy: true,
    consumableLimit: 1,
    monsterMult: 1.0,
  },
  infinity: {
    label: "Infinity",
    hpMult: 3.1,
    dmgMult: 2.95,
    goldMult: 2.15,
    xpMult: 1.95,
    spdMult: 1.32,
    atkSpdBonus: 0.78,
    reactionDelay: 0.02,
    comboSmart: true,
    autoBuy: true,
    consumableLimit: 0,
    monsterMult: 2.0,
  },
};

function getInfinityMonsterMult() {
  return aiDifficulty === "infinity" ? 2.0 : 1.0;
}

function getModeConsumableLimit() {
  const prof =
    AI_DIFFICULTY_PROFILES[aiDifficulty] ||
    AI_DIFFICULTY_PROFILES.veteran;
  return typeof prof.consumableLimit === "number"
    ? prof.consumableLimit
    : 3;
}

function isConsumableItem(item) {
  if (!item) return false;
  return Boolean(
    item.cat === "consumable" ||
    item.isTpScroll ||
    item.id === "tp_scroll" ||
    item.active === "vitality_elixir" ||
    item.active === "cheese",
  );
}

