/***********************************************************************
 * 7. GLOBAL WORLD ARRAYS, WAYPOINT MARKERS & VFX HELPERS
 ***********************************************************************/
let units = [];
let staticStructures = [];
let projectiles = [];
let fxList = [];
let activeZones = [];
let fissureWalls = [];

function clearZonesAndWalls() {
  for (let i = activeZones.length - 1; i >= 0; i--) {
    const z = activeZones[i];
    if (z.mesh) {
      scene.remove(z.mesh);
      disposeObject3D(z.mesh);
    }
  }
  activeZones = [];
  for (let i = fissureWalls.length - 1; i >= 0; i--) {
    const w = fissureWalls[i];
    if (w.pillars)
      w.pillars.forEach((pm) => {
        scene.remove(pm);
        disposeObject3D(pm);
      });
  }
  fissureWalls = [];
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.chainLinks)
      p.chainLinks.forEach((lk) => {
        scene.remove(lk);
        disposeObject3D(lk);
      });
    if (p.mesh) {
      scene.remove(p.mesh);
      disposeObject3D(p.mesh);
    }
  }
  projectiles = [];
  for (let i = fxList.length - 1; i >= 0; i--) {
    const fx = fxList[i];
    if (fx.mesh) {
      scene.remove(fx.mesh);
      if (fx.pooledMat) releaseFxMat(fx.pooledMat);
      else disposeObject3D(fx.mesh);
    }
  }
  fxList = [];
  scheduledEvents = [];
}

function spawnSummonedUnit(owner, cfg) {
  if (!owner || owner.dead || gameOver) return null;
  const gy = getTerrainHeightAt(cfg.x, cfg.z);
  const sumUnit = new MobaEntity({
    name: cfg.name,
    team: owner.team,
    type: "creep",
    subType: cfg.subType || "melee",
    isMega: true,
    x: cfg.x,
    z: cfg.z,
    maxHp: cfg.maxHp || 650,
    hpRegen: cfg.hpRegen || 8,
    atkDamage: cfg.atkDamage || 65,
    atkRange: cfg.atkRange || 3.6,
    atkCooldown: cfg.atkCooldown || 0.85,
    moveSpeed: cfg.moveSpeed || 13.0,
    armor: cfg.armor || 6,
    radius: cfg.radius || 1.25,
    goldBounty: [25, 35],
    xpBounty: 25,
  });
  sumUnit.mesh.position.set(cfg.x, gy, cfg.z);
  sumUnit.mesh.scale.setScalar(cfg.scale || 1.15);
  sumUnit.summonLife = cfg.duration || 16.0;
  sumUnit.summonOwner = owner;
  sumUnit.isWardTotem = !!cfg.isWardTotem;
  sumUnit.wardHealPerSec = cfg.wardHealPerSec || 0;
  sumUnit.wardArmorBonus = cfg.wardArmorBonus || 0;
  sumUnit.isStaticRemnant = !!cfg.isStaticRemnant;
  sumUnit.remnantBurstDmg = cfg.remnantBurstDmg || 0;
  sumUnit.remnantColor = cfg.colorHex || 0x38bdf8;
  sumUnit.mesh.traverse((child) => {
    if (child.isMesh && child.material && child.material.emissive) {
      child.material = child.material.clone();
      child.material.emissive.setHex(cfg.colorHex || 0x38bdf8);
      child.material.emissiveIntensity = 0.85;
    }
  });
  units.push(sumUnit);
  spawnShockwaveRing(cfg.x, cfg.z, 3.8, cfg.colorHex || 0x38bdf8, 0.45);
  return sumUnit;
}
let floatTexts = [];
let scheduledEvents = [];
let neutralCamps = [];
let runes = [];
let roshanBoss = null;
let roshanRespawnTimer = 0;
const ELDER_DRAGON_INTERVAL = 300.0; // 5 minutes (300 seconds)
let elderDragonBoss = null;
let elderDragonSpawnTimer = ELDER_DRAGON_INTERVAL;
let ppLabuGuardians = { radiant: null, dire: null };
let ppLabuSpawned = { radiant: false, dire: false };
let redManGuardians = { radiant: null, dire: null };
let sneakyGolemGuardians = { radiant: null, dire: null };
let inspectedUnit = null;

const moveRingGroup = new THREE.Group();
const moveRingOuter = new THREE.Mesh(
  new THREE.RingGeometry(0.95, 1.25, 28),
  new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    side: THREE.DoubleSide,
  }),
);
moveRingOuter.rotation.x = -Math.PI / 2;
moveRingOuter.position.y = 0.12;
moveRingGroup.add(moveRingOuter);
moveRingGroup.visible = false;
scene.add(moveRingGroup);
let moveRingTimer = 0;
let hitstopTimer = 0;
let camZoomPunch = 0;

function triggerCombatImpactFeel(
  hitstopSec = 0.028,
  zoomPunch = 0.85,
  shakeAmt = 0.45,
) {
  hitstopTimer = Math.max(hitstopTimer, hitstopSec);
  camZoomPunch = Math.max(camZoomPunch, zoomPunch);
  triggerCameraShake(shakeAmt);
}

const skillReticle = new THREE.Mesh(
  new THREE.RingGeometry(4.2, 4.6, 36),
  new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
  }),
);
skillReticle.rotation.x = -Math.PI / 2;
skillReticle.position.y = 0.16;
skillReticle.visible = false;
scene.add(skillReticle);

function triggerMoveWaypoint(x, z, colorHex = 0x22c55e) {
  const gy = getTerrainHeightAt(x, z);
  moveRingOuter.material.color.setHex(colorHex);
  moveRingGroup.position.set(x, gy + 0.06, z);
  moveRingGroup.visible = true;
  moveRingTimer = 0.65;
}

const _fxMatPool = [];
function acquireFxMat(colorHex, opacity = 0.9, polygonOffset = false) {
  const mat =
    _fxMatPool.pop() ||
    registerSharedAsset(
      new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    );
  mat.color.setHex(colorHex);
  // Bright effect colours add light (and bloom); dark ones keep normal blending so they stay visible
  const fxGlow =
    mat.color.r * 0.3 + mat.color.g * 0.5 + mat.color.b * 0.2 > 0.08;
  mat.blending = fxGlow ? THREE.AdditiveBlending : THREE.NormalBlending;
  if (fxGlow) mat.color.multiplyScalar(1.4);
  mat.opacity = opacity;
  mat.polygonOffset = polygonOffset;
  mat.polygonOffsetFactor = polygonOffset ? -2 : 0;
  mat.polygonOffsetUnits = polygonOffset ? -2 : 0;
  return mat;
}
function releaseFxMat(mat) {
  if (mat && _fxMatPool.length < 160) {
    _fxMatPool.push(mat);
  }
}

const _slashArcGeoCache = new Map();
function spawnMeleeSlashArc(pos, yaw, radius, colorHex, duration = 0.24) {
  if (!nxg.ready) nxgInit();
  const rKey = Math.round(radius * 4) / 4;
  let geo = _slashArcGeoCache.get(rKey);
  if (!geo) {
    geo = registerSharedAsset(
      new THREE.RingGeometry(
        rKey * 0.34,
        rKey * 1.08,
        32,
        1,
        -Math.PI * 0.46,
        Math.PI * 0.92,
      ).rotateX(-Math.PI / 2),
    );
    _slashArcGeoCache.set(rKey, geo);
  }
  const mat = nxgGlowMat("slash", colorHex, 1.0, 2.1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, (pos.y || 0) + 1.55, pos.z);
  mesh.rotation.y = yaw - Math.PI / 2;
  scene.add(mesh);
  fxList.push({
    mesh,
    t: 0,
    dur: duration,
    update: (p) => {
      const s = 0.7 + (1 - (1 - p) * (1 - p)) * 0.52;
      mesh.scale.set(s, 1, s);
      mesh.rotation.y += 0.16;
      mat.opacity = (1 - p) * (1 - p);
      if (p >= 1) nxgReleaseMat(mat);
    },
  });
}

const SHARED_GEO = {
  ring: registerSharedAsset(
    new THREE.RingGeometry(0.35, 0.75, 32).rotateX(-Math.PI / 2),
  ),
  decal: registerSharedAsset(
    new THREE.CircleGeometry(1.0, 32).rotateX(-Math.PI / 2),
  ),
  beam: registerSharedAsset(
    new THREE.CylinderGeometry(1.0, 1.15, 38, 24, 1, true),
  ),
  octa: registerSharedAsset(new THREE.OctahedronGeometry(0.26, 0)),
  orb: registerSharedAsset(new THREE.SphereGeometry(1.0, 10, 10)),
};
const SHARED_BASIC_MATS = new Map();
function getCachedBasicMat(
  colorHex,
  transparent = false,
  opacity = 1.0,
  polygonOffset = false,
) {
  const key = `${colorHex}_${transparent}_${opacity}_${polygonOffset}`;
  let mat = SHARED_BASIC_MATS.get(key);
  if (!mat) {
    mat = registerSharedAsset(
      new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent,
        opacity,
        depthWrite: !transparent,
        polygonOffset,
        polygonOffsetFactor: polygonOffset ? -2 : 0,
        polygonOffsetUnits: polygonOffset ? -2 : 0,
      }),
    );
    SHARED_BASIC_MATS.set(key, mat);
  }
  return mat;
}

const _shockwaveMeshPool = [];
function spawnShockwaveRing(x, z, maxRadius, colorHex, duration = 0.48) {
  if (!nxg.ready) nxgInit();
  const gy = getTerrainHeightAt(x, z);
  const mat = nxgGlowMat("ring", colorHex, 1.0, 1.9);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;
  const mesh =
    _shockwaveMeshPool.pop() || new THREE.Mesh(SHARED_GEO.decal, mat);
  mesh.material = mat;
  mesh.visible = true;
  mesh.position.set(x, gy + 0.16, z);
  const rMax = maxRadius / 0.88;
  mesh.scale.set(rMax * 0.12, 1, rMax * 0.12);
  scene.add(mesh);
  fxList.push({
    mesh,
    t: 0,
    dur: duration,
    pooledMesh: true,
    update: (p) => {
      const e = 1 - (1 - p) * (1 - p) * (1 - p);
      const s = rMax * (0.12 + 0.88 * e);
      mesh.scale.set(s, 1, s);
      mat.opacity = Math.pow(1 - p, 1.4);
      if (p >= 1) {
        nxgReleaseMat(mat);
        mesh.visible = false;
        if (_shockwaveMeshPool.length < 64) _shockwaveMeshPool.push(mesh);
      }
    },
  });
  if (maxRadius >= 3.5) {
    nxgEmit(
      { x, y: gy, z },
      colorHex,
      Math.min(22, 6 + Math.floor(maxRadius * 1.6)),
      {
        speed: maxRadius * 1.9,
        up: 3.5,
        life: Math.max(0.4, duration),
        size: 0.34,
        gravity: 9,
        spread: maxRadius * 0.18,
        yOff: 0.35,
      },
    );
  }
  if (maxRadius >= 5.5)
    nxgFlash(
      x,
      gy + 2.6,
      z,
      colorHex,
      12 + maxRadius * 1.6,
      10 + maxRadius * 2.2,
      0.32,
    );
}

function spawnGroundRuneDecal(x, z, radius, colorHex, duration = 1.6) {
  if (!nxg.ready) nxgInit();
  const gy = getTerrainHeightAt(x, z);
  const mat = nxgGlowMat("rune", colorHex, 0.0, 1.5);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;
  const mesh = new THREE.Mesh(SHARED_GEO.decal, mat);
  mesh.scale.set(radius * 1.08, 1, radius * 1.08);
  mesh.position.set(x, gy + 0.13, z);
  mesh.rotation.y = Math.random() * 6.28;
  const spin = (Math.random() < 0.5 ? -1 : 1) * 0.011;
  scene.add(mesh);
  fxList.push({
    mesh,
    t: 0,
    dur: duration,
    update: (p) => {
      mesh.rotation.y += spin;
      mat.opacity = 0.82 * Math.min(1, p * 9) * Math.pow(1 - p, 0.7);
      if (p >= 1) nxgReleaseMat(mat);
    },
  });
}

function spawnOrbitalSkyBeam(x, z, radius, colorHex, duration = 0.85) {
  if (!nxg.ready) nxgInit();
  const gy = getTerrainHeightAt(x, z);
  const group = new THREE.Group();
  const outerMat = nxgGlowMat("beam", colorHex, 0.9, 1.6);
  const coreMat = nxgGlowMat("beam", 0xffffff, 0.95, 2.4);
  const flareMat = nxgGlowMat("glow", colorHex, 0.9, 2.0);
  outerMat.polygonOffset =
    coreMat.polygonOffset =
    flareMat.polygonOffset =
      false;
  const outer = new THREE.Mesh(SHARED_GEO.beam, outerMat);
  const core = new THREE.Mesh(SHARED_GEO.beam, coreMat);
  const flare = new THREE.Mesh(SHARED_GEO.decal, flareMat);
  outer.position.y = 19;
  core.position.y = 19;
  flare.position.y = gy + 0.2;
  group.add(outer, core, flare);
  group.position.set(x, 0, z);
  scene.add(group);
  fxList.push({
    mesh: group,
    t: 0,
    dur: duration,
    update: (p) => {
      const grow = 1 - Math.pow(1 - Math.min(1, p * 5), 2);
      const s = radius * (0.25 + 0.75 * grow) * (1 + p * 0.3);
      outer.scale.set(s, 1, s);
      core.scale.set(s * 0.42, 1, s * 0.42);
      flare.scale.set(s * 2.4, 1, s * 2.4);
      const fade = Math.pow(1 - p, 1.3);
      outerMat.opacity = 0.9 * fade;
      coreMat.opacity = 0.95 * fade;
      flareMat.opacity = 0.9 * fade;
      if (p >= 1) {
        nxgReleaseMat(outerMat);
        nxgReleaseMat(coreMat);
        nxgReleaseMat(flareMat);
      }
    },
  });
  nxgEmit({ x, y: gy, z }, colorHex, 26, {
    speed: radius * 1.3,
    up: 16,
    life: duration * 1.1,
    size: 0.46,
    gravity: -3,
    spread: radius * 0.7,
    yOff: 0.3,
  });
  nxgFlash(
    x,
    gy + 4,
    z,
    colorHex,
    40 + radius * 4,
    22 + radius * 3,
    Math.min(0.7, duration),
  );
}

function spawnParticleBurst(pos, colorHex, count = 16) {
  if (!nxg.ready) nxgInit();
  const n = Math.min(54, Math.round(count * 1.8));
  nxgEmit(pos, colorHex, n, {
    speed: 11,
    up: 9,
    life: 0.72,
    size: 0.42,
    gravity: 17,
    spread: 0.3,
    yOff: 1.4,
  });
  nxgEmit(pos, colorHex, 2, {
    speed: 0.6,
    up: 0.6,
    life: 0.3,
    size: 2.6 + count * 0.05,
    gravity: 0,
    spread: 0.1,
    yOff: 1.4,
  });
  if (count >= 22)
    nxgFlash(
      pos.x,
      (pos.y || 0) + 2.2,
      pos.z,
      colorHex,
      16 + count * 0.4,
      20,
      0.26,
    );
}

const _projScratch = new THREE.Vector3();
const _projOut = { x: 0, y: 0, visible: false };
function projectToScreen(pos3D, yOff = 0) {
  _projScratch.set(pos3D.x, pos3D.y + yOff, pos3D.z).project(camera);
  _projOut.x = (_projScratch.x * 0.5 + 0.5) * window.innerWidth;
  _projOut.y = (-_projScratch.y * 0.5 + 0.5) * window.innerHeight;
  _projOut.visible = _projScratch.z < 1.0;
  return _projOut;
}

function spawnFloatText(pos3D, text, color = "#facc15", fontSize = 15) {
  if (!userSettings.floatingTextEnabled) return;
  const sc = projectToScreen(pos3D, 2.4);
  if (sc.visible) {
    LowRamOptimizer.FloatTextPool.spawn(
      sc.x + (Math.random() - 0.5) * 18,
      sc.y,
      text,
      color,
      fontSize,
    );
  }
}

function showBanner(title, subtitle, colorClass = "text-amber-400") {
  if (mpState.active && mpState.role === "host") {
    mpBroadcast({ type: "BANNER_EVENT", title, subtitle, colorClass });
  }
  const box = document.getElementById("announce-box");
  const tEl = document.getElementById("announce-title");
  const sEl = document.getElementById("announce-sub");
  tEl.className = `font-cinzel font-black text-lg sm:text-4xl tracking-wider sm:tracking-widest uppercase drop-shadow-[0_4px_14px_rgba(0,0,0,0.95)] ${colorClass}`;
  tEl.textContent = title;
  sEl.textContent = subtitle;
  box.classList.remove("opacity-0", "-translate-y-4");
  box.classList.add("opacity-100", "translate-y-0");
  clearTimeout(window._bannerTimer);
  window._bannerTimer = setTimeout(() => {
    box.classList.remove("opacity-100", "translate-y-0");
    box.classList.add("opacity-0", "-translate-y-4");
  }, 3500);
}

