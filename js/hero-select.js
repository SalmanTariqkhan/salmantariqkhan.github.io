/***********************************************************************
 * 9. UNOBSTRUCTED SKY-ALTAR HERO SELECTOR, DIFFICULTY, MODES & TALENTS
 ***********************************************************************/
const previewStageGroup = new THREE.Group();
previewStageGroup.position.set(0, 72, 0);
scene.add(previewStageGroup);

const stageKeyLight = new THREE.PointLight(0xfffbeb, 4.2, 48);
stageKeyLight.position.set(6, 80, 11);
scene.add(stageKeyLight);

const stageFillLight = new THREE.PointLight(0xe0f2fe, 2.2, 42);
stageFillLight.position.set(-7, 76, 9);
scene.add(stageFillLight);

const stageRimLight = new THREE.PointLight(0xfacc15, 3.8, 42);
stageRimLight.position.set(-6, 79, -7);
scene.add(stageRimLight);

let previewHeroRig = null;
let previewYaw = 0.25;
let previewZoomDist = 14.8;
let previewShowcaseTimer = 0;
let isDraggingPreview = false;
let lastDragX = 0;

let previewStageRings = [];
let previewStageObelisks = [];

function rebuildPreviewHeroModel() {
  while (previewStageGroup.children.length > 0) {
    const child = previewStageGroup.children[0];
    previewStageGroup.remove(child);
    disposeObject3D(child);
  }
  previewStageRings = [];
  previewStageObelisks = [];

  const cfg = HERO_ROSTER[selectedHeroId];
  stageRimLight.color.setHex(cfg.primaryHex);
  stageKeyLight.color.setHex(cfg.secondaryHex || 0xfffbeb);

  const daisMat = new THREE.MeshStandardMaterial({
    map: marblePBR.map,
    bumpMap: marblePBR.bumpMap,
    bumpScale: 0.24,
    roughness: 0.36,
    metalness: 0.32,
  });
  const daisLower = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 5.4, 0.32, 48),
    daisMat,
  );
  daisLower.position.y = 0.14;
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(3.85, 4.35, 0.36, 48),
    daisMat,
  );
  dais.position.y = 0.34;
  const goldRim = new THREE.Mesh(
    new THREE.TorusGeometry(3.88, 0.07, 12, 64),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.52,
      metalness: 0.88,
      roughness: 0.2,
    }),
  );
  goldRim.rotation.x = Math.PI / 2;
  goldRim.position.y = 0.524;
  const altarBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.6, 16, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: cfg.primaryHex,
      map: nxg.tex.beam || null,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  altarBeam.position.y = 8.53;
  previewStageGroup.add(daisLower, dais, goldRim, altarBeam);

  const ringInner = new THREE.Mesh(
    new THREE.RingGeometry(3.45, 3.82, 64),
    new THREE.MeshBasicMaterial({
      color: cfg.primaryHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  ringInner.rotation.x = -Math.PI / 2;
  ringInner.position.y = 0.528;
  previewStageGroup.add(ringInner);
  previewStageRings.push({ mesh: ringInner, speed: 0.65 });

  const ringOuter = new THREE.Mesh(
    new THREE.RingGeometry(4.45, 4.72, 6),
    new THREE.MeshBasicMaterial({
      color: cfg.secondaryHex || 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  ringOuter.rotation.x = -Math.PI / 2;
  ringOuter.position.y = 0.534;
  previewStageGroup.add(ringOuter);
  previewStageRings.push({ mesh: ringOuter, speed: -0.45 });

  // 4 Floating Elemental Crystal Obelisks Framing the Champion Altar
  const obMat = new THREE.MeshStandardMaterial({
    color: cfg.primaryHex,
    emissive: cfg.primaryHex,
    emissiveIntensity: 0.85,
    roughness: 0.25,
  });
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const ob = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      obMat,
    );
    ob.scale.set(0.75, 2.2, 0.75);
    ob.position.set(Math.cos(ang) * 4.55, 1.58, Math.sin(ang) * 4.55);
    previewStageGroup.add(ob);
    previewStageObelisks.push({ mesh: ob, baseY: 1.58, phase: i * 1.57 });
  }

  previewHeroRig = buildSculptedHeroMesh(cfg, "radiant", true, true);
  previewHeroRig.group.scale.setScalar(1.92);
  previewHeroRig.group.position.y = 0.522;
  previewStageGroup.add(previewHeroRig.group);

  // Compute exact head-to-toe world height so camera frames the FULL character cleanly
  previewStageGroup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(previewHeroRig.group);
  if (!box.isEmpty()) {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    previewHeroBounds = {
      minY: box.min.y,
      maxY: box.max.y,
      height: Math.max(5.5, size.y),
      centerY: center.y,
    };
  } else {
    previewHeroBounds = {
      minY: 72.5,
      maxY: 80.0,
      height: 7.5,
      centerY: 76.25,
    };
  }
  previewShowcaseTimer = 0.85;
}

let heroRosterFilter = "all";
let previewHeroBounds = {
  minY: 72.5,
  maxY: 80.0,
  height: 7.5,
  centerY: 76.25,
};
let previewZoomFactor = 1.0;

window.resetShowcaseCamera = function () {
  previewYaw = 0.25;
  previewZoomFactor = 1.0;
};

function getFilteredHeroes() {
  return Object.values(HERO_ROSTER).filter((h) => {
    if (heroRosterFilter === "all") return true;
    return (
      h.attr.includes(heroRosterFilter) ||
      h.rangeType === heroRosterFilter
    );
  });
}

let _heroSelectVoiceTimer = null;
window.selectHeroById = function (heroId, speakLine = true) {
  const h = HERO_ROSTER[heroId];
  if (!h) return;
  selectedHeroId = h.id;
  clearTimeout(_heroSelectVoiceTimer);
  updateSelectionPreview();
  renderHeroSelectionCards();
  rebuildPreviewHeroModel();
  spawnAltarPreviewRing(0.05, 3.6, h.primaryHex, 0.55);
  if (mpState.role === "host" || mpState.role === "guest") {
    window.syncMpLobbyMeta();
  }
  if (speakLine) {
    requestAnimationFrame(() => {
      _heroSelectVoiceTimer = setTimeout(() => {
        const cur = HERO_ROSTER[selectedHeroId];
        if (cur && inHeroSelect && !inTitleScreen) {
          sfx.speakHeroLine(cur, cur.voice.select, true, "triumph", {
            category: "select",
            force: true,
          });
        }
      }, 120);
    });
  }
};

window.cycleHeroSelection = function (dir = 1) {
  const list = getFilteredHeroes();
  if (list.length === 0) return;
  const curIdx = list.findIndex((h) => h.id === selectedHeroId);
  const nextIdx =
    curIdx === -1 ? 0 : (curIdx + dir + list.length) % list.length;
  window.selectHeroById(list[nextIdx].id, true);
};

window.setHeroRosterFilter = function (filterVal) {
  heroRosterFilter = filterVal || "all";
  document.querySelectorAll(".hfilter-pill").forEach((btn) => {
    btn.classList.toggle(
      "active-setting",
      btn.dataset.hfilter === heroRosterFilter,
    );
  });
  const list = getFilteredHeroes();
  if (list.length > 0 && !list.some((h) => h.id === selectedHeroId)) {
    window.selectHeroById(list[0].id, true);
    return;
  }
  renderHeroSelectionCards();
  updateSelectionPreview();
};

let activeSpotlightTab = "abilities";
window.setSpotlightTab = function (tabName) {
  activeSpotlightTab = ["abilities", "stats", "lore"].includes(tabName)
    ? tabName
    : "abilities";
  document.querySelectorAll(".sptab-btn").forEach((btn) => {
    btn.classList.toggle(
      "active-setting",
      btn.dataset.sptab === activeSpotlightTab,
    );
  });
  ["abilities", "stats", "lore"].forEach((t) => {
    const panel = document.getElementById(`spotlight-panel-${t}`);
    if (panel) panel.classList.toggle("hidden", t !== activeSpotlightTab);
  });
  if (activeSpotlightTab === "lore") renderPreMatchTalentDrawer();
};

window.togglePreMatchTalents = function () {
  window.setSpotlightTab(
    activeSpotlightTab === "lore" ? "abilities" : "lore",
  );
};

function renderPreMatchTalentDrawer() {
  const drawer = document.getElementById("prematch-talent-drawer");
  const h = HERO_ROSTER[selectedHeroId];
  if (!drawer || !h || !h.talents) return;
  drawer.innerHTML = [10, 15, 20, 25]
    .map((lv) => {
      const pair = h.talents[lv] || [];
      return `<div class="bg-slate-900/90 border border-slate-800 rounded p-1">
              <div class="font-cinzel font-black text-amber-300 text-[9px] mb-0.5">LEVEL ${lv} TALENTS</div>
              <div class="text-emerald-200 truncate">• ${pair[0] ? pair[0].label : ""}</div>
              <div class="text-sky-200 truncate">• ${pair[1] ? pair[1].label : ""}</div>
          </div>`;
    })
    .join("");
}

function spawnAltarPreviewRing(yOff, maxR, colHex, dur = 0.65) {
  const geo = new THREE.RingGeometry(0.4, 0.85, 36);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: colHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.set(0, 72.58 + yOff, 0);
  scene.add(ring);
  fxList.push({
    mesh: ring,
    t: 0,
    dur,
    update: (p) => {
      const s = 1 + p * (maxR / 0.85);
      ring.scale.set(s, 1, s);
      mat.opacity = 0.92 * (1 - p);
    },
  });
}

window.previewSelectedHeroSkill = function (skillKey = "R") {
  const cfg = HERO_ROSTER[selectedHeroId];
  if (!cfg) return;
  const k = ["Q", "W", "E", "R"].includes(skillKey) ? skillKey : "R";
  previewShowcaseTimer = k === "R" ? 1.15 : 0.85;
  const soundMap = {
    Q: "spell_fire_wave",
    W: "spell_blink",
    E: "spell_shield_nova",
    R: "spell_orbital_meteor",
  };
  sfx.play(soundMap[k] || "spell_orbital_meteor");
  const voicePool =
    cfg.voice && cfg.voice.cast && cfg.voice.cast[k]
      ? cfg.voice.cast[k]
      : cfg.voice.select;
  sfx.speakHeroLine(cfg, voicePool, true, "commanding", {
    category: "preview",
    force: true,
    chime: true,
  });

  const center = new THREE.Vector3(0, 73.2, 0);
  const pCol = cfg.primaryHex;
  const sCol = cfg.secondaryHex || 0xfacc15;
  const fwdX = Math.sin(previewYaw);
  const fwdZ = Math.cos(previewYaw);

  spawnAltarPreviewRing(0.06, k === "R" ? 4.4 : 3.2, pCol, 0.65);
  spawnAltarPreviewRing(0.14, k === "R" ? 3.2 : 2.1, sCol, 0.5);

  if (cfg.id === "aurelius" && k === "R") {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.55, 16, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    beam.position.set(0, 80.5, 0);
    scene.add(beam);
    fxList.push({
      mesh: beam,
      t: 0,
      dur: 0.85,
      update: (p) => {
        beam.rotation.y += 0.14;
        beam.scale.set(1 - p * 0.35, 1, 1 - p * 0.35);
        beam.material.opacity = 0.72 * (1 - p);
      },
    });
    spawnParticleBurst(center, pCol, 24);
    return;
  }
  if (cfg.id === "kaelthar" && k === "R") {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.1, 24, 18),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
      }),
    );
    dome.position.set(0, 74.2, 0);
    scene.add(dome);
    fxList.push({
      mesh: dome,
      t: 0,
      dur: 0.9,
      update: (p) => {
        dome.rotation.y += 0.12;
        dome.rotation.z -= 0.08;
        dome.scale.setScalar(0.5 + Math.sin(p * Math.PI) * 0.65);
        dome.material.opacity = 0.75 * (1 - p * 0.85);
      },
    });
    spawnParticleBurst(center, 0xfacc15, 22);
    return;
  }
  if (cfg.id === "malakor" && k === "Q") {
    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.12, 8, 16, Math.PI * 1.4),
      new THREE.MeshBasicMaterial({ color: 0x10b981 }),
    );
    hook.rotation.x = Math.PI / 2;
    hook.position.set(fwdX * 1.2, 74.0, fwdZ * 1.2);
    scene.add(hook);
    fxList.push({
      mesh: hook,
      t: 0,
      dur: 0.65,
      update: (p) => {
        const ext = Math.sin(p * Math.PI) * 4.5;
        hook.position.set(fwdX * (1.2 + ext), 74.0, fwdZ * (1.2 + ext));
        hook.rotation.z += 0.35;
      },
    });
    spawnParticleBurst(center, pCol, 18);
    return;
  }

  if (k === "Q") {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.24, 8, 28, Math.PI),
      new THREE.MeshBasicMaterial({
        color: pCol,
        transparent: true,
        opacity: 0.95,
      }),
    );
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = previewYaw - Math.PI * 0.5;
    arc.position.set(0, 73.6, 0);
    scene.add(arc);
    fxList.push({
      mesh: arc,
      t: 0,
      dur: 0.58,
      update: (p) => {
        arc.position.x = fwdX * p * 5.2;
        arc.position.z = fwdZ * p * 5.2;
        arc.scale.setScalar(1 + p * 0.65);
        arc.material.opacity = 0.95 * (1 - p);
      },
    });
  } else if (k === "W") {
    const funnel = new THREE.Group();
    for (let tr = 0; tr < 6; tr++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.45 + tr * 0.28, 0.08, 6, 20),
        new THREE.MeshBasicMaterial({
          color: tr % 2 === 0 ? pCol : sCol,
          transparent: true,
          opacity: 0.9,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = tr * 0.55;
      funnel.add(ring);
    }
    funnel.position.set(fwdX * 2.2, 72.6, fwdZ * 2.2);
    scene.add(funnel);
    fxList.push({
      mesh: funnel,
      t: 0,
      dur: 0.72,
      update: (p) => {
        funnel.rotation.y += 0.25;
        funnel.position.x = fwdX * (2.2 + p * 2.8);
        funnel.position.z = fwdZ * (2.2 + p * 2.8);
        funnel.children.forEach((c) => {
          c.material.opacity = 0.9 * (1 - p);
        });
      },
    });
  } else if (k === "E") {
    const trapRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.14, 6, 6),
      new THREE.MeshBasicMaterial({
        color: pCol,
        transparent: true,
        opacity: 0.9,
      }),
    );
    trapRing.rotation.x = Math.PI / 2;
    trapRing.position.set(0, 72.75, 0);
    scene.add(trapRing);
    fxList.push({
      mesh: trapRing,
      t: 0,
      dur: 0.75,
      update: (p) => {
        trapRing.rotation.z += 0.12;
        trapRing.position.y = 72.75 + p * 2.4;
        trapRing.material.opacity = 0.9 * (1 - p);
      },
    });
  } else {
    const coreSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 20, 16),
      new THREE.MeshBasicMaterial({
        color: cfg.id === "seraphina" ? 0x020617 : pCol,
        transparent: true,
        opacity: 0.88,
      }),
    );
    const accRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.9, 0.22, 8, 32),
      new THREE.MeshBasicMaterial({
        color: sCol,
        transparent: true,
        opacity: 0.95,
      }),
    );
    accRing.rotation.x = Math.PI / 2.4;
    coreSphere.add(accRing);
    coreSphere.position.set(0, 74.6, 0);
    scene.add(coreSphere);
    fxList.push({
      mesh: coreSphere,
      t: 0,
      dur: 0.88,
      update: (p) => {
        coreSphere.rotation.y += 0.18;
        accRing.rotation.z -= 0.24;
        coreSphere.scale.setScalar(0.65 + Math.sin(p * Math.PI) * 0.75);
        coreSphere.material.opacity = 0.88 * (1 - p * 0.8);
      },
    });
  }
  spawnParticleBurst(center, pCol, k === "R" ? 28 : 16);
};

const stageWin = document.getElementById("hero-3d-stage-window");
const activeStagePointers = new Map();
let lastStagePinchDist = 0;

stageWin.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  try {
    stageWin.setPointerCapture(e.pointerId);
  } catch (err) {}
  activeStagePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activeStagePointers.size === 1) {
    isDraggingPreview = true;
    stageWin.classList.add("is-grabbing");
    lastDragX = e.clientX;
    lastStagePinchDist = 0;
  } else if (activeStagePointers.size === 2) {
    const pts = Array.from(activeStagePointers.values());
    lastStagePinchDist = Math.hypot(
      pts[0].x - pts[1].x,
      pts[0].y - pts[1].y,
    );
  }
});
stageWin.addEventListener("pointermove", (e) => {
  if (!activeStagePointers.has(e.pointerId) || !inHeroSelect) return;
  activeStagePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activeStagePointers.size >= 2) {
    const pts = Array.from(activeStagePointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (lastStagePinchDist > 0 && dist > 0) {
      const delta = (lastStagePinchDist - dist) * 0.004;
      previewZoomFactor = THREE.MathUtils.clamp(
        previewZoomFactor + delta,
        0.72,
        1.45,
      );
    }
    lastStagePinchDist = dist;
  } else if (isDraggingPreview) {
    previewYaw += (e.clientX - lastDragX) * 0.016;
    lastDragX = e.clientX;
  }
});
const releaseStagePointer = (e) => {
  activeStagePointers.delete(e.pointerId);
  if (activeStagePointers.size < 2) lastStagePinchDist = 0;
  if (activeStagePointers.size === 1) {
    const rem = Array.from(activeStagePointers.values())[0];
    lastDragX = rem.x;
    isDraggingPreview = true;
  } else if (activeStagePointers.size === 0) {
    isDraggingPreview = false;
    stageWin.classList.remove("is-grabbing");
  }
};
stageWin.addEventListener("pointerup", releaseStagePointer);
stageWin.addEventListener("pointercancel", releaseStagePointer);
stageWin.addEventListener("lostpointercapture", releaseStagePointer);
stageWin.addEventListener(
  "wheel",
  (e) => {
    if (!inHeroSelect) return;
    if (e.target.closest("#hero-carousel-dots")) return;
    e.preventDefault();
    previewZoomFactor = THREE.MathUtils.clamp(
      previewZoomFactor + (e.deltaY > 0 ? 0.08 : -0.08),
      0.72,
      1.45,
    );
  },
  { passive: false },
);

document.querySelectorAll(".mode-pill[data-mode]").forEach((btn) => {
  btn.onclick = () => {
    if (!btn.dataset.mode) return;
    matchMode = btn.dataset.mode;
    document
      .querySelectorAll(".mode-pill[data-mode]")
      .forEach((b) => b.classList.toggle("active-mode", b === btn));
  };
});
const openMpBtnEl = document.getElementById("btn-open-multiplayer");
if (openMpBtnEl)
  openMpBtnEl.onclick = () => window.openMultiplayerModal();

document.querySelectorAll(".diff-pill").forEach((btn) => {
  btn.onclick = () => {
    if (btn.dataset.diff === "infinity" && !isInfinityUnlocked()) {
      syncInfinityLockUI();
      if (typeof sfx !== "undefined" && sfx.play) sfx.play("error");
      if (typeof showBanner === "function") {
        showBanner(
          "INFINITY DIFFICULTY LOCKED!",
          "Win 1 match on IMMORTAL difficulty to unlock Infinity Mode!",
          "text-fuchsia-300",
        );
      }
      return;
    }
    aiDifficulty = btn.dataset.diff;
    document
      .querySelectorAll(".diff-pill")
      .forEach((b) => b.classList.toggle("active-diff", b === btn));
  };
});

const _heroPortraitThumbCache = new Map();
const _idlePortraitQueue = [];
let _idlePortraitWorkerScheduled = false;

function _pumpIdlePortraitQueue(deadline) {
  _idlePortraitWorkerScheduled = false;
  while (_idlePortraitQueue.length > 0) {
    if (
      deadline &&
      typeof deadline.timeRemaining === "function" &&
      deadline.timeRemaining() < 4
    ) {
      break;
    }
    const task = _idlePortraitQueue.shift();
    if (!task || !task.dot || !task.dot.isConnected) continue;
    if (
      !_heroPortraitThumbCache.has(`${task.heroCfg.id}_radiant`) &&
      !_heroPortraitThumbCache.has(task.heroCfg.id)
    ) {
      paintHeroCardPortrait(task.heroCfg, task.canvasEl, task.iconEl);
      // Yield after building a new 3D rig so UI stays at 60+ FPS
      break;
    } else {
      paintHeroCardPortrait(task.heroCfg, task.canvasEl, task.iconEl);
    }
  }
  if (_idlePortraitQueue.length > 0 && !_idlePortraitWorkerScheduled) {
    _idlePortraitWorkerScheduled = true;
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(_pumpIdlePortraitQueue, {
        timeout: 220,
      });
    } else {
      setTimeout(() => _pumpIdlePortraitQueue(null), 45);
    }
  }
}

function _enqueueIdlePortraitThumb(heroCfg, canvasEl, iconEl, dot) {
  _idlePortraitQueue.push({ heroCfg, canvasEl, iconEl, dot });
  if (!_idlePortraitWorkerScheduled) {
    _idlePortraitWorkerScheduled = true;
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(_pumpIdlePortraitQueue, {
        timeout: 220,
      });
    } else {
      setTimeout(() => _pumpIdlePortraitQueue(null), 45);
    }
  }
}
function paintHeroCardPortrait(heroCfg, canvasEl, iconEl) {
  if (!heroCfg || !canvasEl) return;
  const cacheKey = `${heroCfg.id}_radiant`;
  const cached =
    _heroPortraitThumbCache.get(cacheKey) ||
    _heroPortraitThumbCache.get(heroCfg.id);
  if (cached) {
    if (
      canvasEl.width !== cached.width ||
      canvasEl.height !== cached.height
    ) {
      canvasEl.width = cached.width;
      canvasEl.height = cached.height;
    }
    const ctx = canvasEl.getContext("2d");
    if (ctx) {
      ctx.putImageData(cached, 0, 0);
      canvasEl.classList.remove("hidden");
      canvasEl._shown = true;
      canvasEl.style.filter = "none";
      canvasEl._deadFilter = false;
      if (iconEl) {
        iconEl.classList.add("hidden");
        iconEl._hidden = true;
      }
    }
    return;
  }
  if (
    typeof portraitStudio !== "undefined" &&
    portraitStudio &&
    typeof portraitStudio.renderStatic3DPortrait === "function"
  ) {
    const ok = portraitStudio.renderStatic3DPortrait(
      heroCfg,
      "radiant",
      canvasEl,
      false,
    );
    if (ok && iconEl) {
      iconEl.classList.add("hidden");
      iconEl._hidden = true;
    }
  }
}

function renderHeroSelectionCards() {
  const heroArr = getFilteredHeroes();
  if (heroArr.length === 0) return;

  const dotsBox = document.getElementById("hero-carousel-dots");
  const counterEl = document.getElementById("hero-carousel-counter");
  const prevHint = document.getElementById("prev-hero-hint");
  const nextHint = document.getElementById("next-hero-hint");
  const prevIcon = document.getElementById("prev-hero-icon");
  const nextIcon = document.getElementById("next-hero-icon");

  let curIdx = heroArr.findIndex((h) => h.id === selectedHeroId);
  if (curIdx === -1) curIdx = 0;
  const prevHero =
    heroArr[(curIdx - 1 + heroArr.length) % heroArr.length];
  const nextHero = heroArr[(curIdx + 1) % heroArr.length];

  if (counterEl)
    counterEl.textContent = `${curIdx + 1} / ${heroArr.length}`;
  if (prevHint && prevHero) prevHint.textContent = prevHero.name;
  if (nextHint && nextHero) nextHint.textContent = nextHero.name;
  if (prevIcon && prevHero)
    prevIcon.className = `hidden sm:block fa-solid ${prevHero.icon} ${prevHero.accentColor} text-xs`;
  if (nextIcon && nextHero)
    nextIcon.className = `hidden sm:block fa-solid ${nextHero.icon} ${nextHero.accentColor} text-xs`;

  if (dotsBox) {
    const filterSig = heroArr.map((h) => h.id).join(",");
    if (dotsBox.dataset.filterSig !== filterSig) {
      dotsBox.dataset.filterSig = filterSig;
      dotsBox.innerHTML = "";
      heroArr.forEach((h, idx) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.dataset.heroId = h.id;
        dot.title = `${h.name} • ${h.title}`;
        dot.innerHTML = `
                      <canvas width="192" height="192" class="hidden w-full h-full object-cover"></canvas>
                      <i class="fa-solid ${h.icon} ${h.accentColor} text-[10px]"></i>
                  `;
        const cEl = dot.querySelector("canvas");
        const iEl = dot.querySelector("i");
        if (
          h.id === selectedHeroId ||
          _heroPortraitThumbCache.has(h.id)
        ) {
          paintHeroCardPortrait(h, cEl, iEl);
        } else {
          _enqueueIdlePortraitThumb(h, cEl, iEl, dot);
        }
        dot.onclick = (ev) => {
          ev.stopPropagation();
          window.selectHeroById(h.id, true);
        };
        dotsBox.appendChild(dot);
      });
    }

    Array.from(dotsBox.children).forEach((dot) => {
      const hid = dot.dataset.heroId;
      const h = HERO_ROSTER[hid];
      if (!h) return;
      const isSel = hid === selectedHeroId;
      dot.className = isSel
        ? "relative shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 border-2 border-amber-300 shadow-[0_0_14px_rgba(250,204,21,0.9)] flex items-center justify-center scale-110 transition cursor-pointer overflow-hidden"
        : "relative shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/75 flex items-center justify-center opacity-80 hover:opacity-100 transition cursor-pointer overflow-hidden";
      if (isSel) {
        const cEl = dot.querySelector("canvas");
        const iEl = dot.querySelector("i");
        if (cEl && cEl.classList.contains("hidden"))
          paintHeroCardPortrait(h, cEl, iEl);
        try {
          dot.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
          });
        } catch (e) {}
      }
    });
  }
}

function updateSelectionPreview() {
  const h = HERO_ROSTER[selectedHeroId];
  const quote = Array.isArray(h.voice.select)
    ? h.voice.select[0]
    : h.voice.select;
  const spotCanvas = document.getElementById("select-spotlight-portrait");
  const spotIcon = document.getElementById("select-spotlight-icon");
  if (spotIcon) {
    spotIcon.className = `fa-solid ${h.icon} ${h.accentColor} text-2xl`;
  }
  if (spotCanvas) {
    paintHeroCardPortrait(h, spotCanvas, spotIcon);
  }
  document.getElementById("select-hero-name").textContent = h.name;
  document.getElementById("select-hero-role").textContent =
    `${h.attr} • ${h.rangeType}`;

  const quoteEl = document.getElementById("select-hero-quote");
  if (quoteEl) quoteEl.textContent = `"${quote}"`;
  const titlePill = document.getElementById("stage-hero-title-pill");
  if (titlePill) titlePill.textContent = `${h.archetype || h.title}`;

  const ratingsEl = document.getElementById("select-hero-ratings");
  if (ratingsEl && h.ratings) {
    const r = h.ratings;
    ratingsEl.innerHTML = [
      ["OFF", r.offense, "bg-rose-400", "text-rose-300"],
      ["DEF", r.defense, "bg-emerald-400", "text-emerald-300"],
      ["MOB", r.mobility, "bg-cyan-400", "text-cyan-300"],
      ["CTRL", r.control, "bg-amber-400", "text-amber-300"],
    ]
      .map(
        ([lbl, val, barCol, txtCol]) => `
              <div>
                  <div class="flex justify-between text-[9px]"><span class="text-slate-400">${lbl}</span><strong class="${txtCol}">${val}/10</strong></div>
                  <div class="h-1 bg-slate-900 rounded-full overflow-hidden mt-0.5"><div class="h-full ${barCol}" style="width:${val * 10}%"></div></div>
              </div>
          `,
      )
      .join("");
  }
  const coreStatsEl = document.getElementById("select-hero-core-stats");
  if (coreStatsEl && h.stats) {
    coreStatsEl.innerHTML = [
      ["HP", h.stats.maxHp, "text-emerald-300"],
      ["MANA", h.stats.maxMana, "text-sky-300"],
      ["ATK", h.stats.atkDamage, "text-amber-300"],
      ["ARMOR", h.stats.armor, "text-slate-200"],
      ["SPEED", Math.round(h.stats.moveSpeed * 25), "text-cyan-300"],
    ]
      .map(
        ([lbl, val, col]) =>
          `<div><div class="text-[8px] text-slate-400">${lbl}</div><div class="font-bold ${col}">${val}</div></div>`,
      )
      .join("");
  }
  renderPreMatchTalentDrawer();

  const originEl = document.getElementById("select-hero-origin");
  if (originEl) originEl.textContent = h.origin || "The Confluence";
  const pNameEl = document.getElementById("select-passive-name");
  const pDescEl = document.getElementById("select-passive-desc");
  if (pNameEl && h.passive) pNameEl.textContent = h.passive.name;
  if (pDescEl && h.passive) pDescEl.textContent = h.passive.desc;
  const loreEl = document.getElementById("select-hero-lore-text");
  if (loreEl) loreEl.textContent = h.lore || "";

  const mobDetail = document.getElementById("mobile-skill-detail-line");
  if (mobDetail)
    mobDetail.textContent =
      "Tap any [Q/W/E/R] card below to preview 3D FX";

  const strip = document.getElementById("select-hero-skills-strip");
  if (strip) {
    strip.innerHTML = ["Q", "W", "E", "R"]
      .map(
        (k) => `
              <button type="button" data-skill-key="${k}" class="bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-400/70 rounded-lg px-2 py-1 text-left transition group" title="Click to preview [${k}] ${h.skills[k].name} 3D VFX on Sky-Altar">
                  <div class="flex items-center justify-between gap-1 text-[9px] sm:text-[10px] font-bold text-slate-100">
                      <div class="flex items-center gap-1 min-w-0">
                          <span class="font-mono text-amber-300">[${k}]</span>
                          <i class="fa-solid ${h.skills[k].icon} ${h.skills[k].color} text-[9px]"></i>
                          <span class="truncate">${h.skills[k].name}</span>
                      </div>
                  </div>
                  <div class="hidden sm:block text-[9px] text-slate-400 group-hover:text-slate-200 leading-tight line-clamp-2 mt-0.5">${h.skills[k].desc}</div>
              </button>
          `,
      )
      .join("");
    strip.querySelectorAll("[data-skill-key]").forEach((btn) => {
      btn.onclick = () => {
        const k = btn.dataset.skillKey;
        const sk = h.skills[k];
        if (mobDetail && sk) {
          mobDetail.textContent = `[${k}] ${sk.name}: ${sk.desc}`;
        }
        window.previewSelectedHeroSkill(k);
      };
    });
  }
}

window.auditionSelectedHeroVoice = function () {
  const h = HERO_ROSTER[selectedHeroId];
  if (!h) return;
  const pool = [
    ...(Array.isArray(h.voice.select)
      ? h.voice.select
      : [h.voice.select]),
    ...(Array.isArray(h.voice.levelup)
      ? h.voice.levelup
      : [h.voice.levelup]),
    ...(Array.isArray(h.voice.kill) ? h.voice.kill : [h.voice.kill]),
  ];
  const chosenLine = sfx._resolveLine(`audition:${h.id}`, pool);
  document.getElementById("select-hero-quote").textContent =
    `"${chosenLine}"`;
  sfx.speakHeroLine(h, chosenLine, true, "triumph", {
    category: "audition",
    force: true,
    chime: true,
  });
};

const portraitStudio = (() => {
  let pRenderer = null;
  let useDedicatedRenderer = false;
  let pScene = null;
  let pCamera = null;
  let pRimLight = null;
  let pKeyLight = null;
  let pFillLight = null;
  let pBackdropMesh = null;
  let pBackdropMat = null;
  let pRenderTarget = null;
  let pPixelBuffer = null;
  let pCachedImgData = null;
  let pTmpCanvas = null;
  let pTmpCtx = null;
  const rigCache = new Map();
  let currentVisibleKey = null;
  let hudAccum = 0;
  let inspAccum = 0;
  let portraitClock = 0;
  let hudRenderedDead = false;
  let lastInspectedUnitId = null;
  const RT_SIZE = 192;
  const _savedClearCol = new THREE.Color();
  const _headWorldPos = new THREE.Vector3();
  const _headBox = new THREE.Box3();
  const _headSize = new THREE.Vector3();
  const _headCenter = new THREE.Vector3();

  // Per-champion portrait framing tuned to their unique bodyScaleX/Y/Z, head crowns/horns & silhouettes
  const HERO_PORTRAIT_FOCUS = {
    aurelius: { camY: 3.16, lookY: 3.1, dist: 3.6, pad: 1.28 },
    ignis: { camY: 3.15, lookY: 3.09, dist: 3.45, pad: 1.26 },
    sylphira: { camY: 3.15, lookY: 3.09, dist: 3.45, pad: 1.26 },
    malakor: { camY: 3.58, lookY: 3.5, dist: 4.35, pad: 1.32 },
    zephyros: { camY: 3.48, lookY: 3.4, dist: 3.9, pad: 1.3 },
    vespera: { camY: 3.02, lookY: 2.96, dist: 3.25, pad: 1.24 },
    terrakor: { camY: 4.02, lookY: 3.92, dist: 5.1, pad: 1.35 },
    aurelia: { camY: 3.16, lookY: 3.1, dist: 3.65, pad: 1.28 },
    kaelthar: { camY: 3.16, lookY: 3.1, dist: 3.6, pad: 1.28 },
    valkyra: { camY: 3.15, lookY: 3.09, dist: 3.48, pad: 1.26 },
    dravenor: { camY: 3.18, lookY: 3.12, dist: 3.72, pad: 1.28 },
    nyxia: { camY: 3.24, lookY: 3.18, dist: 3.55, pad: 1.28 },
    thalindor: { camY: 3.76, lookY: 3.68, dist: 4.65, pad: 1.34 },
    solenne: { camY: 3.16, lookY: 3.1, dist: 3.5, pad: 1.28 },
    garrick: { camY: 2.54, lookY: 2.48, dist: 3.75, pad: 1.32 },
    seraphina: { camY: 3.16, lookY: 3.1, dist: 3.5, pad: 1.28 },
  };

  let _staticDisposeTimer = null;

  function isStaticPortraitMode() {
    const q = userSettings.qualityPreset || "balanced";
    return (
      q === "ultralight" ||
      q === "potato" ||
      q === "performance" ||
      !userSettings.portraits3dEnabled
    );
  }

  function scheduleStaticStudioCleanup() {
    if (!isStaticPortraitMode()) return;
    clearTimeout(_staticDisposeTimer);
    _staticDisposeTimer = setTimeout(() => {
      if (isStaticPortraitMode()) {
        disposeResources();
      }
    }, 450);
  }

  function renderStatic3DPortrait(
    heroCfg,
    team,
    targetCanvas,
    isDead = false,
  ) {
    if (!targetCanvas || !heroCfg) return false;
    const ctx2d = targetCanvas.getContext("2d");
    if (!ctx2d) return false;
    const effTeam = team || "radiant";
    const cacheKey = `${heroCfg.id}_${effTeam}`;
    let cached = _heroPortraitThumbCache.get(cacheKey);
    if (!cached && effTeam === "radiant") {
      cached = _heroPortraitThumbCache.get(heroCfg.id);
    }

    if (!cached) {
      // Render 1 single static 3D hero portrait frame (matching Hero Selection Mode) and cache it
      const ok = renderLiveRigFrame(
        heroCfg,
        effTeam,
        targetCanvas,
        0.35,
        0.16,
        false,
        false,
      );
      if (!ok) return false;
      try {
        cached = ctx2d.getImageData(
          0,
          0,
          targetCanvas.width,
          targetCanvas.height,
        );
        _heroPortraitThumbCache.set(cacheKey, cached);
        if (effTeam === "radiant")
          _heroPortraitThumbCache.set(heroCfg.id, cached);
      } catch (e) {}
      // In low graphics / 1GB RAM modes, immediately free the 3D rig & schedule WebGL context release
      if (isStaticPortraitMode()) {
        const rig = rigCache.get(cacheKey);
        if (rig) {
          if (pScene && rig.group) pScene.remove(rig.group);
          if (rig.group) disposeObject3D(rig.group);
          rigCache.delete(cacheKey);
          if (currentVisibleKey === cacheKey) currentVisibleKey = null;
        }
        scheduleStaticStudioCleanup();
      }
    } else {
      if (
        targetCanvas.width !== cached.width ||
        targetCanvas.height !== cached.height
      ) {
        targetCanvas.width = cached.width;
        targetCanvas.height = cached.height;
      }
      ctx2d.putImageData(cached, 0, 0);
    }

    if (targetCanvas._shown !== true) {
      targetCanvas.classList.remove("hidden");
      targetCanvas._shown = true;
    }
    if (targetCanvas._deadFilter !== isDead) {
      targetCanvas.style.filter = isDead
        ? "grayscale(100%) brightness(0.55)"
        : "none";
      targetCanvas._deadFilter = isDead;
    }
    return true;
  }

  function disposeResources() {
    clearTimeout(_staticDisposeTimer);
    clearRigCache();
    if (pRenderTarget) {
      try {
        pRenderTarget.dispose();
      } catch (e) {}
      pRenderTarget = null;
    }
    pPixelBuffer = null;
    if (pRenderer) {
      try {
        pRenderer.dispose();
        if (typeof pRenderer.forceContextLoss === "function")
          pRenderer.forceContextLoss();
      } catch (e) {}
      pRenderer = null;
    }
    useDedicatedRenderer = false;
    pScene = null;
    pCamera = null;
  }

  function ensure() {
    if (pScene) return true;
    if (!renderer) return false;

    // Dedicated lightweight 128x128 1x-DPR WebGLRenderer eliminates full-screen EffectComposer
    // swapchain stalls and synchronous gl.readPixels GPU pipeline flushes.
    try {
      pRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      });
      pRenderer.setPixelRatio(1);
      pRenderer.setSize(RT_SIZE, RT_SIZE, false);
      pRenderer.outputColorSpace =
        renderer.outputColorSpace || THREE.SRGBColorSpace;
      pRenderer.shadowMap.enabled = false;
      pRenderer.setClearColor(0x000000, 0);
      useDedicatedRenderer = true;
    } catch (e) {
      pRenderer = null;
      useDedicatedRenderer = false;
    }

    pScene = new THREE.Scene();
    if (typeof scene !== "undefined" && scene.environment) {
      pScene.environment = scene.environment;
      pScene.environmentIntensity = 1.15;
    }
    pCamera = new THREE.PerspectiveCamera(29, 1.0, 0.2, 28);
    pCamera.position.set(0.0, 3.16, 3.5);
    pCamera.lookAt(0.0, 3.1, 0.0);

    // Luminous radial studio backdrop positioned dynamically behind each hero's calibrated head height
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = 128;
    bgCanvas.height = 128;
    const bCtx = bgCanvas.getContext("2d");
    const grad = bCtx.createRadialGradient(64, 58, 6, 64, 64, 62);
    grad.addColorStop(0.0, "rgba(255, 255, 255, 0.54)");
    grad.addColorStop(0.55, "rgba(148, 163, 184, 0.22)");
    grad.addColorStop(1.0, "rgba(15, 23, 42, 0.0)");
    bCtx.fillStyle = grad;
    bCtx.fillRect(0, 0, 128, 128);
    const bgTex = new THREE.CanvasTexture(bgCanvas);
    pBackdropMat = new THREE.MeshBasicMaterial({
      map: bgTex,
      color: 0xfacc15,
      transparent: true,
      depthWrite: false,
    });
    pBackdropMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 5.2),
      pBackdropMat,
    );
    pBackdropMesh.position.set(0, 3.18, -1.35);
    pScene.add(pBackdropMesh);

    const hemi = new THREE.HemisphereLight(0xf0f9ff, 0x334155, 1.65);
    pScene.add(hemi);

    pKeyLight = new THREE.DirectionalLight(0xfffbeb, 1.95);
    pKeyLight.position.set(1.8, 4.4, 4.2);
    pScene.add(pKeyLight);

    pFillLight = new THREE.DirectionalLight(0xbae6fd, 0.85);
    pFillLight.position.set(-2.4, 3.4, 2.8);
    pScene.add(pFillLight);

    pRimLight = new THREE.PointLight(0xfacc15, 3.6, 14);
    pRimLight.position.set(-1.5, 3.9, -1.3);
    pScene.add(pRimLight);
    return true;
  }

  function getOrCreateRig(heroCfg, team) {
    const key = `${heroCfg.id}_${team}`;
    let rig = rigCache.get(key);
    if (!rig) {
      rig = buildSculptedHeroMesh(
        heroCfg,
        team,
        team === "radiant",
        true,
        true,
      );
      rig.group.rotation.y = -0.1;
      rig.group.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      if (rig.parts) {
        rig.parts.leftShoulder.rotation.set(0.06, 0, -0.26);
        rig.parts.rightShoulder.rotation.set(0.06, 0, 0.26);
        rig.parts.leftElbow.rotation.x = -0.06;
        rig.parts.rightElbow.rotation.x = -0.06;
      }
      rig.group.visible = false;
      pScene.add(rig.group);
      rigCache.set(key, rig);
    }
    if (currentVisibleKey !== key) {
      if (currentVisibleKey && rigCache.has(currentVisibleKey)) {
        rigCache.get(currentVisibleKey).group.visible = false;
      }
      rig.group.visible = true;
      currentVisibleKey = key;
    }
    return rig;
  }

  function computeCalibratedFocus(rig, heroCfg) {
    if (rig._calibratedFocus) return rig._calibratedFocus;
    const preset = HERO_PORTRAIT_FOCUS[heroCfg.id] || {
      camY: 3.16,
      lookY: 3.1,
      dist: 3.55,
      pad: 1.28,
    };
    rig.group.updateMatrixWorld(true);
    if (rig.parts && rig.parts.neckPivot) {
      rig.parts.neckPivot.getWorldPosition(_headWorldPos);
      _headBox.setFromObject(rig.parts.neckPivot);
      if (!_headBox.isEmpty()) {
        _headBox.getSize(_headSize);
        _headBox.getCenter(_headCenter);
        const headSpan = Math.max(_headSize.x, _headSize.y, 0.95);
        const fovRad = THREE.MathUtils.degToRad(pCamera.fov);
        const autoDist =
          (headSpan * (preset.pad || 1.28)) /
          (2 * Math.tan(fovRad * 0.5));
        const finalDist = THREE.MathUtils.clamp(
          Math.max(preset.dist * 0.88, autoDist),
          3.15,
          5.45,
        );
        const centerY = _headCenter.y - 0.04;
        rig._calibratedFocus = {
          camY: centerY + 0.06,
          lookY: centerY,
          dist: finalDist,
        };
        return rig._calibratedFocus;
      }
    }
    rig._calibratedFocus = preset;
    return preset;
  }

  function renderLiveRigFrame(
    heroCfg,
    team,
    targetCanvas,
    clockTime,
    dt,
    isHit = false,
    isDead = false,
  ) {
    if (!targetCanvas || !heroCfg || !ensure()) return false;
    const ctx2d = targetCanvas.getContext("2d");
    if (!ctx2d) return false;
    const effRtSize =
      userSettings.qualityPreset === "ultralight" || _is1GbMobileBoot
        ? 128
        : RT_SIZE;
    if (
      targetCanvas.width !== effRtSize ||
      targetCanvas.height !== effRtSize
    ) {
      targetCanvas.width = effRtSize;
      targetCanvas.height = effRtSize;
    }

    const rig = getOrCreateRig(heroCfg, team);
    const animTime = isDead ? 0.15 : clockTime;
    updateHeroSkeletalAnimation(
      rig.parts,
      "PORTRAIT",
      animTime,
      dt || 0.033,
      heroCfg.rangeType === "Ranged",
      0,
      0,
    );

    // Subtle reactive head/torso recoil on hit without mutating skeletal cache
    rig.group.rotation.y =
      -0.1 +
      Math.sin(animTime * 1.15) * 0.09 +
      (isHit ? Math.sin(animTime * 38) * 0.08 : 0);
    rig.group.rotation.x = isHit ? -0.07 : 0;

    const focus = computeCalibratedFocus(rig, heroCfg);
    pCamera.position.set(0.0, focus.camY, focus.dist);
    pCamera.lookAt(0.0, focus.lookY, 0.0);

    const accentHex = isHit ? 0xf43f5e : heroCfg.primaryHex || 0xfacc15;
    pRimLight.color.setHex(accentHex);
    pRimLight.position.set(-1.5, focus.lookY + 0.8, -1.3);
    if (pBackdropMat) pBackdropMat.color.setHex(accentHex);
    if (pBackdropMesh) {
      pBackdropMesh.position.set(0, focus.lookY + 0.05, -1.35);
      pBackdropMesh.scale.setScalar(focus.dist / 3.55);
    }
    pKeyLight.color.setHex(isHit ? 0xfda4af : 0xfffbeb);

    if (useDedicatedRenderer && pRenderer) {
      // Direct GPU-to-2D canvas surface copy scaled cleanly to effRtSize (prevents 128px crop offset)
      pRenderer.clear();
      pRenderer.render(pScene, pCamera);
      ctx2d.clearRect(0, 0, effRtSize, effRtSize);
      ctx2d.drawImage(
        pRenderer.domElement,
        0,
        0,
        RT_SIZE,
        RT_SIZE,
        0,
        0,
        effRtSize,
        effRtSize,
      );
    } else {
      if (!pRenderTarget) {
        pRenderTarget = new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
          depthBuffer: true,
          stencilBuffer: false,
        });
        pPixelBuffer = new Uint8Array(RT_SIZE * RT_SIZE * 4);
      }
      const prevTarget = renderer.getRenderTarget();
      const prevAutoClear = renderer.autoClear;
      renderer.getClearColor(_savedClearCol);
      const prevClearAlpha = renderer.getClearAlpha();

      renderer.setRenderTarget(pRenderTarget);
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(pScene, pCamera);
      renderer.readRenderTargetPixels(
        pRenderTarget,
        0,
        0,
        RT_SIZE,
        RT_SIZE,
        pPixelBuffer,
      );

      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(_savedClearCol, prevClearAlpha);
      renderer.autoClear = prevAutoClear;

      if (!pCachedImgData)
        pCachedImgData = ctx2d.createImageData(RT_SIZE, RT_SIZE);
      const dst = pCachedImgData.data;
      const rowBytes = RT_SIZE * 4;
      for (let y = 0; y < RT_SIZE; y++) {
        const srcOff = (RT_SIZE - 1 - y) * rowBytes;
        const dstOff = y * rowBytes;
        dst.set(pPixelBuffer.subarray(srcOff, srcOff + rowBytes), dstOff);
      }
      if (effRtSize === RT_SIZE) {
        ctx2d.putImageData(pCachedImgData, 0, 0);
      } else {
        if (!pTmpCanvas) {
          pTmpCanvas = document.createElement("canvas");
          pTmpCanvas.width = RT_SIZE;
          pTmpCanvas.height = RT_SIZE;
          pTmpCtx = pTmpCanvas.getContext("2d");
        }
        if (pTmpCtx) {
          pTmpCtx.putImageData(pCachedImgData, 0, 0);
          ctx2d.clearRect(0, 0, effRtSize, effRtSize);
          ctx2d.drawImage(
            pTmpCanvas,
            0,
            0,
            RT_SIZE,
            RT_SIZE,
            0,
            0,
            effRtSize,
            effRtSize,
          );
        }
      }
    }

    if (targetCanvas._shown !== true) {
      targetCanvas.classList.remove("hidden");
      targetCanvas._shown = true;
    }
    if (targetCanvas._deadFilter !== isDead) {
      targetCanvas.style.filter = isDead
        ? "grayscale(100%) brightness(0.55)"
        : "none";
      targetCanvas._deadFilter = isDead;
    }
    return true;
  }

  function renderRigToCanvas(
    heroCfg,
    team,
    targetCanvas,
    clockTime,
    dt,
    isHit = false,
    isDead = false,
  ) {
    if (!targetCanvas || !heroCfg) return false;
    if (isStaticPortraitMode()) {
      return renderStatic3DPortrait(heroCfg, team, targetCanvas, isDead);
    }
    return renderLiveRigFrame(
      heroCfg,
      team,
      targetCanvas,
      clockTime,
      dt,
      isHit,
      isDead,
    );
  }

  let _lastStaticHudSig = "";
  function update(dt, clockTime) {
    portraitClock += Math.min(0.1, Math.max(0, dt || 0));
    if (isStaticPortraitMode()) {
      if (playerHero && playerHero.heroCfg) {
        const hudSig = `${playerHero.heroCfg.id}_${playerHero.team}_${playerHero.dead ? 1 : 0}`;
        if (_lastStaticHudSig !== hudSig) {
          _lastStaticHudSig = hudSig;
          const hudC = document.getElementById("hud-portrait-canvas");
          const iconEl = document.getElementById("hud-portrait-icon");
          const ok = renderStatic3DPortrait(
            playerHero.heroCfg,
            playerHero.team,
            hudC,
            playerHero.dead,
          );
          if (iconEl && iconEl._hidden !== ok) {
            iconEl.classList.toggle("hidden", ok);
            iconEl._hidden = ok;
          }
        }
      }
      const inspPanel = getHudEl("unit-inspector-panel");
      if (
        inspPanel &&
        !inspPanel.classList.contains("hidden") &&
        inspectedUnit &&
        inspectedUnit.type === "hero" &&
        inspectedUnit.heroCfg
      ) {
        const inspSig = `${inspectedUnit.id}_${inspectedUnit.dead ? 1 : 0}`;
        if (lastInspectedUnitId !== inspSig) {
          lastInspectedUnitId = inspSig;
          const inspC = document.getElementById("insp-portrait-canvas");
          const okInsp = renderStatic3DPortrait(
            inspectedUnit.heroCfg,
            inspectedUnit.team,
            inspC,
            inspectedUnit.dead,
          );
          const inspIconEl = document.getElementById("insp-icon");
          if (inspIconEl && inspIconEl._hidden !== okInsp) {
            inspIconEl.classList.toggle("hidden", okInsp);
            inspIconEl._hidden = okInsp;
          }
        }
      } else {
        lastInspectedUnitId = null;
      }
      return;
    }
    _lastStaticHudSig = "";

    const isUltraMax = userSettings.qualityPreset === "ultramax";
    const isLowTier =
      userSettings.qualityPreset === "potato" ||
      userSettings.qualityPreset === "performance";
    const hudInterval = isUltraMax ? 1 / 30 : isLowTier ? 1 / 18 : 1 / 24;
    const inspInterval = isUltraMax
      ? 1 / 24
      : isLowTier
        ? 1 / 14
        : 1 / 20;

    // 1. Main Player Hero Portrait (#hud-portrait-canvas)
    if (playerHero && playerHero.heroCfg) {
      const hudC = document.getElementById("hud-portrait-canvas");
      const iconEl = document.getElementById("hud-portrait-icon");
      if (playerHero.dead) {
        if (!hudRenderedDead) {
          const okDead = renderRigToCanvas(
            playerHero.heroCfg,
            playerHero.team,
            hudC,
            clockTime,
            0.016,
            false,
            true,
          );
          if (iconEl && iconEl._hidden !== okDead) {
            iconEl.classList.toggle("hidden", okDead);
            iconEl._hidden = okDead;
          }
          hudRenderedDead = true;
        }
      } else {
        if (hudRenderedDead) hudRenderedDead = false;
        const isHeroBusy =
          playerHero.isActuallyMoving ||
          playerHero.swingAnim > 0 ||
          playerHero.castAnim > 0 ||
          playerHero.hitFlashTimer > 0 ||
          playerHero.celebrateTimer > 0;
        const effHudInterval = !useDedicatedRenderer
          ? 1 / 10
          : isHeroBusy
            ? hudInterval
            : Math.max(hudInterval, 1 / 12);
        hudAccum += dt;
        if (hudAccum >= effHudInterval) {
          const stepDt = hudAccum;
          hudAccum = 0;
          const ok = renderRigToCanvas(
            playerHero.heroCfg,
            playerHero.team,
            hudC,
            portraitClock,
            stepDt,
            playerHero.hitFlashTimer > 0,
            false,
          );
          if (iconEl && iconEl._hidden !== ok) {
            iconEl.classList.toggle("hidden", ok);
            iconEl._hidden = ok;
          }
        }
      }
    }

    // 2. Unit Inspector Portrait (#insp-portrait-canvas) — only when panel is open on a hero
    const inspPanel = getHudEl("unit-inspector-panel");
    if (
      inspPanel &&
      !inspPanel.classList.contains("hidden") &&
      inspectedUnit &&
      inspectedUnit.type === "hero" &&
      inspectedUnit.heroCfg
    ) {
      const targetChanged = lastInspectedUnitId !== inspectedUnit.id;
      lastInspectedUnitId = inspectedUnit.id;
      inspAccum += dt;
      if (targetChanged || inspAccum >= inspInterval) {
        const stepDt = targetChanged ? 0.016 : inspAccum;
        inspAccum = 0;
        const inspC = document.getElementById("insp-portrait-canvas");
        const okInsp = renderRigToCanvas(
          inspectedUnit.heroCfg,
          inspectedUnit.team,
          inspC,
          portraitClock + 1.7,
          stepDt,
          inspectedUnit.hitFlashTimer > 0,
          inspectedUnit.dead,
        );
        const inspIconEl = document.getElementById("insp-icon");
        if (inspIconEl && inspIconEl._hidden !== okInsp) {
          inspIconEl.classList.toggle("hidden", okInsp);
          inspIconEl._hidden = okInsp;
        }
      }
    } else {
      lastInspectedUnitId = null;
    }
  }

  function resetState() {
    hudAccum = 0;
    inspAccum = 0;
    hudRenderedDead = false;
    lastInspectedUnitId = null;
    _lastStaticHudSig = "";
  }

  function clearRigCache() {
    rigCache.forEach((rig) => {
      if (pScene && rig.group) pScene.remove(rig.group);
      if (rig.group) disposeObject3D(rig.group);
    });
    rigCache.clear();
    currentVisibleKey = null;
    resetState();
  }

  const _entBox = new THREE.Box3();
  const _entSize = new THREE.Vector3();
  const _entCenter = new THREE.Vector3();

  function buildEntityPreviewMesh(unit) {
    if (!unit) return null;
    if (unit.type === "boss") return buildRefinedRoshanMesh().group;
    if (unit.type === "dragon") return buildElderDragonMesh().group;
    if (unit.type === "kong")
      return buildPPLabuMesh(unit.team || "radiant").group;
    if (unit.type === "redman")
      return buildRedManMesh(unit.team || "radiant").group;
    if (unit.type === "sneakygolem")
      return buildSneakyGolemMesh(unit.team || "radiant").group;
    if (unit.type === "vampire" || unit.subType === "vampire")
      return buildVampireMesh(unit.name).group;
    if (unit.type === "werewolf" || unit.subType === "werewolf")
      return buildWerewolfMesh(unit.name).group;
    if (unit.type === "neutral")
      return buildRefinedNeutralMesh(unit.subType || "wolf").group;
    if (unit.type === "creep")
      return buildDetailedCreepMesh(
        unit.team || "radiant",
        unit.subType || "melee",
        !!unit.isMega,
      ).group;
    if (unit.type === "tower" || unit.type === "ancient") {
      const g = new THREE.Group();
      const isRad = unit.team === "radiant";
      if (unit.type === "tower")
        nxgBuildTower(
          { team: unit.team, name: unit.name, parts: {} },
          g,
          isRad,
        );
      else
        nxgBuildAncient(
          { team: unit.team, name: unit.name, parts: {} },
          g,
          isRad,
        );
      return g;
    }
    return null;
  }

  function renderStaticEntityPortrait(unit, targetCanvas) {
    if (!targetCanvas || !unit) return false;
    if (unit.type === "hero" && unit.heroCfg) {
      return renderStatic3DPortrait(
        unit.heroCfg,
        unit.team,
        targetCanvas,
        !!unit.dead,
      );
    }
    const ctx2d = targetCanvas.getContext("2d");
    if (!ctx2d) return false;

    const subKey =
      unit.subType ||
      (unit.name && unit.name.includes("Citadel") ? "citadel" : "std");
    const cacheKey = `ent_${unit.type}_${subKey}_${unit.team || "neutral"}_${unit.isMega ? 1 : 0}`;
    let cached = _heroPortraitThumbCache.get(cacheKey);

    const effRtSize =
      userSettings.qualityPreset === "ultralight" || _is1GbMobileBoot
        ? 128
        : RT_SIZE;
    if (
      targetCanvas.width !== effRtSize ||
      targetCanvas.height !== effRtSize
    ) {
      targetCanvas.width = effRtSize;
      targetCanvas.height = effRtSize;
    }

    if (!cached) {
      if (!ensure()) return false;
      const prevHeroKey = currentVisibleKey;
      if (prevHeroKey && rigCache.has(prevHeroKey)) {
        rigCache.get(prevHeroKey).group.visible = false;
      }

      const meshGroup = buildEntityPreviewMesh(unit);
      if (!meshGroup) return false;
      meshGroup.traverse((ch) => {
        if (ch.isMesh) {
          ch.castShadow = false;
          ch.receiveShadow = false;
        }
      });
      meshGroup.rotation.y =
        unit.type === "dragon" ||
        unit.subType === "wolf" ||
        unit.subType === "werewolf" ||
        unit.subType === "wyvern" ||
        unit.subType === "basilisk" ||
        unit.subType === "ancient_dragon"
          ? -0.42
          : -0.22;
      pScene.add(meshGroup);
      meshGroup.updateMatrixWorld(true);

      _entBox.setFromObject(meshGroup);
      if (_entBox.isEmpty()) {
        pScene.remove(meshGroup);
        disposeObject3D(meshGroup);
        return false;
      }
      _entBox.getSize(_entSize);
      _entBox.getCenter(_entCenter);

      const isCreature = [
        "boss",
        "dragon",
        "kong",
        "redman",
        "sneakygolem",
        "vampire",
        "neutral",
        "creep",
      ].includes(unit.type);
      const focusY = isCreature
        ? _entBox.min.y + _entSize.y * 0.66
        : _entBox.min.y + _entSize.y * 0.56;
      const span = Math.max(
        _entSize.x * 0.85,
        _entSize.y * (isCreature ? 0.62 : 0.78),
        1.1,
      );
      const fovRad = THREE.MathUtils.degToRad(pCamera.fov);
      const dist = THREE.MathUtils.clamp(
        (span * 1.24) / (2 * Math.tan(fovRad * 0.5)),
        2.2,
        24.0,
      );

      const prevFar = pCamera.far;
      if (dist + span > pCamera.far) {
        pCamera.far = dist + span + 12;
        pCamera.updateProjectionMatrix();
      }
      pCamera.position.set(0.0, focusY + _entSize.y * 0.05, dist);
      pCamera.lookAt(0.0, focusY, 0.0);

      const accentHex =
        unit.type === "sneakygolem"
          ? 0xf472b6
          : unit.team === "radiant"
            ? 0x34d399
            : unit.team === "dire"
              ? 0xf43f5e
              : 0xf97316;
      pRimLight.color.setHex(accentHex);
      pRimLight.position.set(-1.8, focusY + 1.2, -1.5);
      if (pBackdropMat) pBackdropMat.color.setHex(accentHex);
      if (pBackdropMesh) {
        pBackdropMesh.position.set(
          0,
          focusY,
          -Math.max(1.5, dist * 0.45),
        );
        pBackdropMesh.scale.setScalar(dist / 3.55);
      }
      pKeyLight.color.setHex(0xfffbeb);

      if (useDedicatedRenderer && pRenderer) {
        pRenderer.clear();
        pRenderer.render(pScene, pCamera);
        ctx2d.clearRect(0, 0, effRtSize, effRtSize);
        ctx2d.drawImage(
          pRenderer.domElement,
          0,
          0,
          RT_SIZE,
          RT_SIZE,
          0,
          0,
          effRtSize,
          effRtSize,
        );
      } else {
        if (!pRenderTarget) {
          pRenderTarget = new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            depthBuffer: true,
            stencilBuffer: false,
          });
          pPixelBuffer = new Uint8Array(RT_SIZE * RT_SIZE * 4);
        }
        const prevTarget = renderer.getRenderTarget();
        const prevAutoClear = renderer.autoClear;
        renderer.getClearColor(_savedClearCol);
        const prevClearAlpha = renderer.getClearAlpha();

        renderer.setRenderTarget(pRenderTarget);
        renderer.autoClear = true;
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(pScene, pCamera);
        renderer.readRenderTargetPixels(
          pRenderTarget,
          0,
          0,
          RT_SIZE,
          RT_SIZE,
          pPixelBuffer,
        );

        renderer.setRenderTarget(prevTarget);
        renderer.setClearColor(_savedClearCol, prevClearAlpha);
        renderer.autoClear = prevAutoClear;

        if (!pCachedImgData)
          pCachedImgData = ctx2d.createImageData(RT_SIZE, RT_SIZE);
        const dst = pCachedImgData.data;
        const rowBytes = RT_SIZE * 4;
        for (let y = 0; y < RT_SIZE; y++) {
          const srcOff = (RT_SIZE - 1 - y) * rowBytes;
          const dstOff = y * rowBytes;
          dst.set(
            pPixelBuffer.subarray(srcOff, srcOff + rowBytes),
            dstOff,
          );
        }
        if (effRtSize === RT_SIZE) {
          ctx2d.putImageData(pCachedImgData, 0, 0);
        } else {
          if (!pTmpCanvas) {
            pTmpCanvas = document.createElement("canvas");
            pTmpCanvas.width = RT_SIZE;
            pTmpCanvas.height = RT_SIZE;
            pTmpCtx = pTmpCanvas.getContext("2d");
          }
          if (pTmpCtx) {
            pTmpCtx.putImageData(pCachedImgData, 0, 0);
            ctx2d.clearRect(0, 0, effRtSize, effRtSize);
            ctx2d.drawImage(
              pTmpCanvas,
              0,
              0,
              RT_SIZE,
              RT_SIZE,
              0,
              0,
              effRtSize,
              effRtSize,
            );
          }
        }
      }

      if (pCamera.far !== prevFar) {
        pCamera.far = prevFar;
        pCamera.updateProjectionMatrix();
      }
      pScene.remove(meshGroup);
      disposeObject3D(meshGroup);
      if (prevHeroKey && rigCache.has(prevHeroKey)) {
        rigCache.get(prevHeroKey).group.visible = true;
      }

      try {
        cached = ctx2d.getImageData(
          0,
          0,
          targetCanvas.width,
          targetCanvas.height,
        );
        _heroPortraitThumbCache.set(cacheKey, cached);
      } catch (e) {}
      scheduleStaticStudioCleanup();
    } else {
      if (
        targetCanvas.width !== cached.width ||
        targetCanvas.height !== cached.height
      ) {
        targetCanvas.width = cached.width;
        targetCanvas.height = cached.height;
      }
      ctx2d.putImageData(cached, 0, 0);
    }

    if (targetCanvas._shown !== true) {
      targetCanvas.classList.remove("hidden");
      targetCanvas._shown = true;
    }
    targetCanvas.style.filter = "none";
    targetCanvas._deadFilter = false;
    return true;
  }

  return {
    renderRigToCanvas,
    renderStatic3DPortrait,
    renderStaticEntityPortrait,
    update,
    resetState,
    clearRigCache,
    disposeResources,
    isStaticPortraitMode,
  };
})();

function applyHeroToHUD(radCfg, direLabel) {
  document.getElementById("top-rad-name").textContent =
    matchMode === "2v1" ? `${radCfg.name} + Ally` : radCfg.name;
  document.getElementById("top-rad-badge").innerHTML =
    `<i class="fa-solid ${radCfg.icon} ${radCfg.accentColor} text-sm"></i>`;
  document.getElementById("top-dire-name").textContent = direLabel;

  const pBox = document.getElementById("hud-portrait-box");
  pBox.className = `relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-b ${radCfg.badgeBg} border-2 border-amber-400/80 flex flex-col items-center justify-center overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.85)]`;
  const pIcon = document.getElementById("hud-portrait-icon");
  pIcon.className = `fa-solid ${radCfg.icon} text-3xl sm:text-4xl ${radCfg.accentColor} drop-shadow-[0_0_12px_rgba(251,191,36,0.85)]`;
  document.getElementById("hud-portrait-name").textContent =
    radCfg.shortName;

  const hudTeam =
    playerHero && playerHero.team
      ? playerHero.team
      : mpState.active
        ? mpState.myTeam
        : "radiant";
  const hudC = document.getElementById("hud-portrait-canvas");
  if (
    hudC &&
    portraitStudio.renderRigToCanvas(
      radCfg,
      hudTeam,
      hudC,
      0.2,
      0.016,
      false,
      false,
    )
  ) {
    pIcon.classList.add("hidden");
  }

  ["Q", "W", "E", "R"].forEach((k) => {
    const sk = radCfg.skills[k];
    const btn = document.getElementById(`ab-btn-${k}`);
    btn.className = `ability-card mob-skill-btn w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${sk.bg} border-2 ${k === "R" ? "border-amber-500/80" : "border-slate-600"} flex flex-col items-center justify-center relative group`;
    btn.removeAttribute("title");
    document.getElementById(`ab-icon-${k}`).className =
      `fa-solid ${sk.icon} text-xl ${sk.color} group-hover:scale-110 transition-transform`;
    document.getElementById(`ab-mana-${k}`).textContent = sk.mana;
  });
}

function getAbilityMaxRank(key) {
  return key === "R" ? 3 : 4;
}

function getRequiredHeroLevelForNextRank(hero, key) {
  const cur = hero.abilityLevels[key] || 0;
  if (cur >= getAbilityMaxRank(key)) return null;
  const nextRank = cur + 1;
  return key === "R" ? nextRank * 6 : nextRank * 2 - 1;
}

const MAX_HERO_LEVEL = 30;
const TALENT_TIERS = [10, 15, 20, 25];
const MAX_ATTR_RANK = 11;
let isCtrlHeld = false;

function getNextAvailableTalentTier(hero) {
  if (
    !hero ||
    !hero.heroCfg ||
    !hero.heroCfg.talents ||
    (hero.skillPoints || 0) <= 0
  )
    return null;
  for (let i = 0; i < TALENT_TIERS.length; i++) {
    const tier = TALENT_TIERS[i];
    if (
      hero.level >= tier &&
      (!hero.chosenTalents || !hero.chosenTalents[tier])
    )
      return tier;
  }
  return null;
}

function canHeroLevelAttributes(hero) {
  return Boolean(
    hero &&
    (hero.skillPoints || 0) > 0 &&
    (hero.attrBonusRank || 0) < MAX_ATTR_RANK,
  );
}

function setCtrlQuickUpgradeVisuals(active) {
  isCtrlHeld = Boolean(active);
  const hud = document.getElementById("hud-layer");
  if (hud) hud.classList.toggle("ctrl-upgrade-active", isCtrlHeld);
  updateAbilityUpgradeButtons();
}

function canHeroLevelAbility(hero, key) {
  if (!hero || hero.skillPoints <= 0) return false;
  const reqLvl = getRequiredHeroLevelForNextRank(hero, key);
  return reqLvl !== null && hero.level >= reqLvl;
}

window.levelUpAttributes = function () {
  if (!canHeroLevelAttributes(playerHero)) {
    if (playerHero && (playerHero.skillPoints || 0) <= 0) {
      spawnFloatText(
        playerHero.mesh.position,
        "NEED 1 SKILL POINT!",
        "#fb7185",
        13,
      );
    }
    return false;
  }
  if (mpState.active && mpState.role === "guest") {
    sfx.play("levelup");
    mpSendToHost({ type: "CMD", cmd: "LEVEL_ATTR" });
    return true;
  }
  playerHero.skillPoints--;
  playerHero.attrBonusRank++;
  playerHero.str += 2;
  playerHero.agi += 2;
  playerHero.int += 2;
  playerHero.maxHp += 44;
  playerHero.hp += 44;
  playerHero.maxMana += 28;
  playerHero.mana += 28;
  playerHero.atkDamage += 4;
  playerHero.armor += 0.4;
  playerHero.atkSpeedMult += 0.03;

  sfx.play("levelup");
  spawnFloatText(
    playerHero.mesh.position,
    "+2 All Attributes!",
    "#34d399",
    15,
  );
  updateAbilityUpgradeButtons();
  return true;
};

window.openTalentModal = function () {
  if (!playerHero || !playerHero.heroCfg) return;
  playerHero.chosenTalents = playerHero.chosenTalents || {};
  window._talentOpenedAtTs = performance.now();
  document.getElementById("talent-modal-title").textContent =
    `${playerHero.name.toUpperCase()} — TALENT TREE (${playerHero.skillPoints || 0} SP)`;
  const container = document.getElementById("talent-tiers-container");
  container.innerHTML = "";
  const sp = playerHero.skillPoints || 0;
  const nextCtrlTier = getNextAvailableTalentTier(playerHero);

  [25, 20, 15, 10].forEach((tierLvl) => {
    const pair = playerHero.heroCfg.talents
      ? playerHero.heroCfg.talents[tierLvl]
      : null;
    if (!pair) return;
    const unlocked = playerHero.level >= tierLvl;
    const chosenId = playerHero.chosenTalents[tierLvl];
    const canSpendTier = unlocked && !chosenId && sp > 0;
    const isNextTier = tierLvl === nextCtrlTier;

    const row = document.createElement("div");
    row.className = `grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-2 rounded-xl border ${
      chosenId
        ? "bg-amber-950/35 border-amber-400/60"
        : canSpendTier
          ? "bg-slate-900/95 border-amber-400/80 shadow-[0_0_16px_rgba(250,204,21,0.24)]"
          : unlocked
            ? "bg-slate-900/85 border-amber-500/35"
            : "bg-slate-950/70 border-slate-800 opacity-65"
    }`;

    const makeBranchBtn = (opt, idx) => {
      const isPicked = chosenId === opt.id;
      const canPick = canSpendTier;
      const keyBadge = isNextTier
        ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-300 text-slate-950 font-mono font-black text-[9px] shrink-0">CTRL+${idx + 1}</span>`
        : "";
      return `<button type="button" ${canPick ? `onclick="window.pickTalent(${tierLvl}, '${opt.id}')"` : "disabled"}
                  class="p-2.5 rounded-lg text-xs font-bold text-center border transition flex items-center justify-center gap-1 ${isPicked ? "bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(250,204,21,0.3)]" : canPick ? "bg-slate-800 hover:bg-amber-950/60 border-amber-500/65 text-white cursor-pointer" : "bg-slate-950 border-slate-800 text-slate-500"}">
                  <span>${opt.label}</span>
                  ${isPicked ? '<i class="fa-solid fa-check text-amber-300 ml-1"></i>' : keyBadge}
              </button>`;
    };

    row.innerHTML = `
              ${makeBranchBtn(pair[0], 0)}
              <div class="w-10 h-10 rounded-full ${unlocked ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-400"} font-cinzel font-black text-xs flex items-center justify-center border-2 border-slate-950 shadow">
                  Lv${tierLvl}
              </div>
              ${makeBranchBtn(pair[1], 1)}
          `;
    container.appendChild(row);
  });

  document.getElementById("talent-modal").classList.remove("hidden");
};

window.pickTalent = function (tierLvl, talentId) {
  if (!playerHero) return false;
  playerHero.chosenTalents = playerHero.chosenTalents || {};
  if (
    playerHero.level < tierLvl ||
    playerHero.chosenTalents[tierLvl]
  )
    return false;
  if ((playerHero.skillPoints || 0) <= 0) {
    spawnFloatText(
      playerHero.mesh.position,
      "NEED 1 SKILL POINT!",
      "#fb7185",
      14,
    );
    return false;
  }
  if (mpState.active && mpState.role === "guest") {
    sfx.play("levelup");
    mpSendToHost({ type: "CMD", cmd: "PICK_TALENT", tierLvl, talentId });
    const modal = document.getElementById("talent-modal");
    if (modal) modal.classList.add("hidden");
    return true;
  }
  const pair = playerHero.heroCfg?.talents?.[tierLvl];
  const opt = pair?.find((o) => o.id === talentId);
  if (!opt) return false;

  playerHero.skillPoints--;
  playerHero.chosenTalents[tierLvl] = talentId;
  opt.apply(playerHero);
  sfx.play("levelup");
  spawnFloatText(
    playerHero.mesh.position,
    `TALENT: ${opt.label}`,
    "#facc15",
    16,
  );
  spawnShockwaveRing(
    playerHero.mesh.position.x,
    playerHero.mesh.position.z,
    3.8,
    0xfacc15,
    0.55,
  );
  updateAbilityUpgradeButtons();
  const modal = document.getElementById("talent-modal");
  const nextAvailTier = getNextAvailableTalentTier(playerHero);
  if (modal && !modal.classList.contains("hidden")) {
    if (nextAvailTier !== null && (playerHero.skillPoints || 0) > 0) {
      window.openTalentModal();
    } else {
      modal.classList.add("hidden");
    }
  }
  return true;
};

window.quickPickNextTalentBranch = function (branchIdx) {
  if (!playerHero || !playerHero.heroCfg) return false;
  const tierLvl = getNextAvailableTalentTier(playerHero);
  if (!tierLvl) {
    spawnFloatText(
      playerHero.mesh.position,
      (playerHero.skillPoints || 0) <= 0
        ? "NO SKILL POINTS!"
        : "NO TALENT TIER UNLOCKED!",
      "#fb7185",
      13,
    );
    return false;
  }
  const pair = playerHero.heroCfg.talents[tierLvl];
  const chosen = pair && pair[branchIdx];
  if (!chosen) return false;
  return window.pickTalent(tierLvl, chosen.id);
};

function updateAbilityUpgradeButtons() {
  if (!playerHero) return;
  const sp = playerHero.skillPoints || 0;
  const banner = document.getElementById("skill-points-banner");
  if (sp > 0) {
    banner.classList.remove("hidden");
    document.getElementById("skill-points-count").textContent = sp;
  } else {
    banner.classList.add("hidden");
  }

  const attrBtn = document.getElementById("lvlup-ATTR");
  const statsCard = document.getElementById("btn-stats-cmd");
  const canStats = canHeroLevelAttributes(playerHero);
  if (canStats) attrBtn.classList.remove("hidden");
  else attrBtn.classList.add("hidden");
  if (statsCard)
    statsCard.classList.toggle(
      "ctrl-eligible-card",
      isCtrlHeld && canStats,
    );
  document.getElementById("attr-rank-text").textContent =
    `${playerHero.attrBonusRank}/${MAX_ATTR_RANK}`;

  const nextTalentTier = getNextAvailableTalentTier(playerHero);
  const canTalent = nextTalentTier !== null;
  const talUpBtn = document.getElementById("lvlup-TALENT");
  const talCard = document.getElementById("btn-open-talents");
  const talDot = document.getElementById("talent-notif-dot");
  if (talUpBtn) talUpBtn.classList.toggle("hidden", !canTalent);
  if (talCard)
    talCard.classList.toggle(
      "ctrl-eligible-card",
      isCtrlHeld && canTalent,
    );
  if (talDot) talDot.classList.toggle("hidden", !canTalent);

  ["Q", "W", "E", "R"].forEach((k) => {
    const lvl = playerHero.abilityLevels[k] || 0;
    const maxR = getAbilityMaxRank(k);
    const btn = document.getElementById(`lvlup-${k}`);
    const cardBtn = document.getElementById(`ab-btn-${k}`);
    const canUpSkill = canHeroLevelAbility(playerHero, k);
    if (canUpSkill) btn.classList.remove("hidden");
    else btn.classList.add("hidden");
    if (cardBtn)
      cardBtn.classList.toggle(
        "ctrl-eligible-card",
        isCtrlHeld && canUpSkill,
      );

    if (cardBtn) {
      cardBtn.classList.toggle("opacity-55", lvl === 0);
      cardBtn.classList.toggle("saturate-50", lvl === 0);
      let lockTag = cardBtn.querySelector(".ult-lock-tag");
      if (k === "R" && lvl === 0 && playerHero.level < 6) {
        if (!lockTag) {
          lockTag = document.createElement("span");
          lockTag.className =
            "ult-lock-tag absolute inset-0 bg-slate-950/75 flex items-center justify-center font-cinzel font-black text-[10px] text-amber-300 tracking-wider pointer-events-none";
          lockTag.textContent = "LV 6";
          cardBtn.appendChild(lockTag);
        }
      } else if (lockTag) {
        lockTag.remove();
      }
    }

    const pips = document.getElementById(`pips-${k}`);
    pips.innerHTML = "";
    for (let i = 1; i <= maxR; i++) {
      const dot = document.createElement("span");
      dot.className = `w-2.5 h-1 rounded-full transition-all ${i <= lvl ? "bg-gradient-to-r from-amber-300 to-yellow-500 shadow-[0_0_6px_#facc15]" : "bg-slate-800 border border-slate-700/80"}`;
      pips.appendChild(dot);
    }
  });

  playerHero.chosenTalents = playerHero.chosenTalents || {};
  const tPips = document.getElementById("talent-pips");
  if (tPips) {
    tPips.innerHTML = "";
    [10, 15, 20, 25].forEach((tl) => {
      const picked = Boolean(playerHero.chosenTalents[tl]);
      const canPickThis = playerHero.level >= tl && !picked && sp > 0;
      const dot = document.createElement("span");
      dot.className = `w-2 h-1 rounded-xs ${picked ? "bg-amber-400" : canPickThis ? "bg-emerald-400 animate-ping" : playerHero.level >= tl ? "bg-amber-500/40" : "bg-slate-700"}`;
      tPips.appendChild(dot);
    });
  }
  if (talDot) talDot.classList.toggle("hidden", !canTalent);
}

