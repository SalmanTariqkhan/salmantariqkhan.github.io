/***********************************************************************
 * 11. VIBRANT, MULTI-LAYERED HERO ABILITY VFX & COMBAT MECHANICS
 ***********************************************************************/
window.levelUpAbility = function (key) {
  if (!canHeroLevelAbility(playerHero, key)) return;
  if (mpState.active && mpState.role === "guest") {
    sfx.play("levelup");
    mpSendToHost({ type: "CMD", cmd: "LEVEL_UP", key });
    return;
  }
  playerHero.abilityLevels[key]++;
  playerHero.skillPoints--;
  sfx.play("levelup");
  const skName = playerHero.heroCfg.skills[key].name;
  spawnFloatText(
    playerHero.mesh.position,
    `${skName} Lv.${playerHero.abilityLevels[key]}!`,
    "#facc15",
    15,
  );
  updateAbilityUpgradeButtons();
};

window.selectAbilityUI = function (key) {
  if (isCtrlHeld || (window.event && window.event.ctrlKey)) {
    window.levelUpAbility(key);
    return;
  }
  if (
    !playerHero ||
    playerHero.dead ||
    playerHero.reincarnating ||
    gameOver
  )
    return;
  if ((playerHero.abilityLevels[key] || 0) <= 0) {
    const msg =
      key === "R" && playerHero.level < 6
        ? "ULTIMATE UNLOCKS AT LVL 6!"
        : "ABILITY NOT LEARNED!";
    spawnFloatText(playerHero.mesh.position, msg, "#fb7185", 13);
    return;
  }
  const sk = playerHero.heroCfg.skills[key];
  if (sk.targetType === "self") {
    if (mpState.active && mpState.role === "guest") {
      if (
        playerHero.cooldowns[key] <= 0 &&
        playerHero.mana >= sk.mana &&
        playerHero.stunTimer <= 0
      ) {
        mpSendToHost({
          type: "CMD",
          cmd: "CAST",
          key,
          x: playerHero.mesh.position.x,
          z: playerHero.mesh.position.z,
        });
        playerHero.cooldowns[key] = sk.cd * playerHero.cdrMult;
        playerHero.mana = Math.max(0, playerHero.mana - sk.mana);
        playerHero.castAnim = 0.45;
      }
      return;
    }
    castHeroAbility(playerHero, key, playerHero.mesh.position);
  } else if (userSettings.smartCastEnabled) {
    const aimPt = worldCursor.clone();
    if (mpState.active && mpState.role === "guest") {
      if (
        playerHero.cooldowns[key] <= 0 &&
        playerHero.mana >= sk.mana &&
        playerHero.stunTimer <= 0
      ) {
        mpSendToHost({
          type: "CMD",
          cmd: "CAST",
          key,
          x: aimPt.x,
          z: aimPt.z,
        });
        playerHero.cooldowns[key] = sk.cd * playerHero.cdrMult;
        playerHero.mana = Math.max(0, playerHero.mana - sk.mana);
        playerHero.castAnim = 0.45;
        playerHero.mesh.rotation.y = Math.atan2(
          aimPt.x - playerHero.mesh.position.x,
          aimPt.z - playerHero.mesh.position.z,
        );
      }
      return;
    }
    castHeroAbility(playerHero, key, aimPt);
    return;
  } else if (primedSkill === key) {
    // Tapping a primed skill button a second time quick-casts at nearest enemy or forward facing direction!
    const nearEnemy = findNearestTarget(
      playerHero,
      sk.range,
      false,
      true,
    );
    let aimPt;
    if (nearEnemy) {
      aimPt = nearEnemy.mesh.position.clone();
    } else {
      const yaw = playerHero.mesh.rotation.y;
      aimPt = new THREE.Vector3(
        playerHero.mesh.position.x +
          Math.sin(yaw) * Math.min(sk.range * 0.85, 14),
        0,
        playerHero.mesh.position.z +
          Math.cos(yaw) * Math.min(sk.range * 0.85, 14),
      );
    }
    if (mpState.active && mpState.role === "guest") {
      if (
        playerHero.cooldowns[key] <= 0 &&
        playerHero.mana >= sk.mana &&
        playerHero.stunTimer <= 0
      ) {
        mpSendToHost({
          type: "CMD",
          cmd: "CAST",
          key,
          x: aimPt.x,
          z: aimPt.z,
        });
        playerHero.cooldowns[key] = sk.cd * playerHero.cdrMult;
        playerHero.mana = Math.max(0, playerHero.mana - sk.mana);
        playerHero.castAnim = 0.45;
        playerHero.mesh.rotation.y = Math.atan2(
          aimPt.x - playerHero.mesh.position.x,
          aimPt.z - playerHero.mesh.position.z,
        );
      }
      primedSkill = null;
      updatePrimedState();
      return;
    }
    castHeroAbility(playerHero, key, aimPt);
  } else {
    primedSkill = key;
    updatePrimedState();
  }
};

let attackMovePrimed = false;
let isAKeyHeld = false;
let hoveredUnit = null;
let _lastHoverCheckTime = 0;
let tpTargetMode = false;
let tpBeaconMeshes = [];

function updateCanvasCursorState() {
  if (!canvas) return;
  canvas.classList.remove(
    "cursor-attack",
    "cursor-ally",
    "cursor-cast",
    "cursor-tp",
  );
  if (inHeroSelect) return;
  if (tpTargetMode) {
    canvas.classList.add("cursor-tp");
  } else if (primedSkill) {
    canvas.classList.add("cursor-cast");
  } else if (attackMovePrimed || isAKeyHeld) {
    canvas.classList.add("cursor-attack");
  } else if (hoveredUnit && !hoveredUnit.dead && playerHero) {
    if (hoveredUnit.team !== playerHero.team)
      canvas.classList.add("cursor-attack");
    else if (hoveredUnit !== playerHero)
      canvas.classList.add("cursor-ally");
  }
}

function hasAnyAliveTower(team) {
  const list =
    staticStructures && staticStructures.length > 0
      ? staticStructures
      : units;
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (!u.dead && u.team === team && u.type === "tower") return true;
  }
  return false;
}

function getNextVulnerableStructure(enemyTeam, fromPos = null) {
  const list =
    staticStructures && staticStructures.length > 0
      ? staticStructures
      : units;
  // 1. Tier 1 Tower
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (
      !u.dead &&
      u.team === enemyTeam &&
      u.type === "tower" &&
      u.name &&
      u.name.includes("Tier 1")
    ) {
      return u;
    }
  }
  // 2. Tier 2 Tower
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (
      !u.dead &&
      u.team === enemyTeam &&
      u.type === "tower" &&
      u.name &&
      u.name.includes("Tier 2")
    ) {
      return u;
    }
  }
  // 3. Citadel Tower Front
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (
      !u.dead &&
      u.team === enemyTeam &&
      u.type === "tower" &&
      u.name &&
      u.name.includes("Citadel Tower Front")
    ) {
      return u;
    }
  }
  // 4. Citadel Side Towers (North/East or South/West)
  let bestSide = null;
  let bestSideDSq = Infinity;
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (
      !u.dead &&
      u.team === enemyTeam &&
      u.type === "tower" &&
      u.name &&
      u.name.includes("Citadel")
    ) {
      if (fromPos) {
        const dSq =
          (u.mesh.position.x - fromPos.x) ** 2 +
          (u.mesh.position.z - fromPos.z) ** 2;
        if (dSq < bestSideDSq) {
          bestSideDSq = dSq;
          bestSide = u;
        }
      } else {
        return u;
      }
    }
  }
  if (bestSide) return bestSide;

  // 5. Any other alive tower
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (!u.dead && u.team === enemyTeam && u.type === "tower") {
      return u;
    }
  }

  // 6. Ancient (only when ALL towers are dead!)
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (!u.dead && u.team === enemyTeam && u.type === "ancient") {
      return u;
    }
  }
  return null;
}

function getStructureTierLockReason(unit) {
  if (!unit || unit.dead) return null;
  if (unit.type === "tower") {
    if (unit.name.includes("Tier 2")) {
      const t1Alive = units.some(
        (u) =>
          !u.dead &&
          u.team === unit.team &&
          u.type === "tower" &&
          u.name.includes("Tier 1"),
      );
      if (t1Alive) return "INVULNERABLE! Destroy Tier 1 Tower First!";
    } else if (unit.name.includes("Citadel")) {
      const t1Alive = units.some(
        (u) =>
          !u.dead &&
          u.team === unit.team &&
          u.type === "tower" &&
          u.name.includes("Tier 1"),
      );
      if (t1Alive) return "INVULNERABLE! Destroy Tier 1 Tower First!";
      const t2Alive = units.some(
        (u) =>
          !u.dead &&
          u.team === unit.team &&
          u.type === "tower" &&
          u.name.includes("Tier 2"),
      );
      if (t2Alive) return "INVULNERABLE! Destroy Tier 2 Tower First!";
      if (!unit.name.includes("Front")) {
        const frontAlive = units.some(
          (u) =>
            !u.dead &&
            u.team === unit.team &&
            u.type === "tower" &&
            u.name.includes("Citadel Tower Front"),
        );
        if (frontAlive)
          return "INVULNERABLE! Destroy Citadel Front Tower First!";
      }
    }
  } else if (unit.type === "ancient") {
    const anyTowerAlive = hasAnyAliveTower(unit.team);
    if (anyTowerAlive) return "INVULNERABLE! Destroy All Towers First!";
  }
  return null;
}

// Only 4 dedicated siege/demolition abilities across the 16 champions can damage Towers & Ancients (at reduced siege scaling)
const STRUCTURE_SIEGE_ABILITIES = {
  terrakor: "W", // Enchant Totem seismic smash
  ignis: "R", // Laguna Railgun thermal beam
  aurelius: "R", // Orbital Sunbeam pillar
  garrick: "W", // Molten Slag Mortar artillery
};

function canAbilityAffectStructure(hid, key, target) {
  if (!target || (target.type !== "tower" && target.type !== "ancient"))
    return true;
  return STRUCTURE_SIEGE_ABILITIES[hid] === key;
}

function getStructureAbilityDmgMult(target) {
  if (!target) return 1.0;
  if (target.type === "ancient") return 0.26;
  if (target.type === "tower") return 0.38;
  return 1.0;
}

function findEnemyNearWorldPoint(pt, maxRadius = 3.6) {
  if (!playerHero) return null;
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.dead || u.reincarnating || u.team === playerHero.team) continue;
    if (getStructureTierLockReason(u)) continue;
    const d = Math.hypot(
      u.mesh.position.x - pt.x,
      u.mesh.position.z - pt.z,
    );
    if (d <= maxRadius + (u.radius || 1.2) * 0.65 && d < bestScore) {
      bestScore = d;
      best = u;
    }
  }
  return best;
}

function updatePrimedState() {
  ["Q", "W", "E", "R"].forEach((k) => {
    document
      .getElementById(`ab-btn-${k}`)
      .classList.toggle("primed", primedSkill === k);
  });
  const atkBtn = document.getElementById("btn-attack-cmd");
  if (atkBtn) atkBtn.classList.toggle("attack-primed", attackMovePrimed);
  const tpBtn = document.getElementById("btn-tp-scroll");
  if (tpBtn) tpBtn.classList.toggle("tp-primed", tpTargetMode);
  updateCanvasCursorState();

  const hint = document.getElementById("target-hint");
  if (tpTargetMode && playerHero) {
    hint.innerHTML = `<i class="fa-solid fa-scroll text-cyan-300 mr-1"></i> <span class="text-cyan-300 font-bold">Town Portal Scroll [V]:</span> Click any Allied Tower or Base Fountain (in 3D, Minimap, or bar below) • Double-tap [V] for Base`;
    hint.className =
      "mt-2 bg-cyan-950/92 border border-cyan-400/80 text-cyan-100 px-4 py-1 rounded-full text-xs font-semibold shadow-lg";
    hint.classList.remove("hidden");
    skillReticle.visible = false;
  } else if (attackMovePrimed && playerHero) {
    hint.innerHTML = `<i class="fa-solid fa-crosshairs text-rose-400 mr-1"></i> <span class="text-rose-300 font-bold">Attack Target [A]:</span> Left-Click enemy unit to attack, or Left-Click ground / minimap to Attack-Move • Press [A] again for Nearest`;
    hint.className =
      "mt-2 bg-rose-950/92 border border-rose-400/80 text-rose-100 px-4 py-1 rounded-full text-xs font-semibold shadow-lg";
    hint.classList.remove("hidden");
    skillReticle.material.color.setHex(0xf43f5e);
    skillReticle.scale.setScalar(0.55);
    skillReticle.position.set(worldCursor.x, 0.16, worldCursor.z);
    skillReticle.visible = true;
  } else if (primedSkill && playerHero) {
    const sk = playerHero.heroCfg.skills[primedSkill];
    const aoeScale =
      primedSkill === "R" ? 1.85 : primedSkill === "W" ? 1.35 : 0.95;
    hint.innerHTML = `Click ground or enemy to cast <span id="target-ability-label" class="text-amber-300 font-bold">${primedSkill}: ${sk.name}</span> • Range ${sk.range}m (Right-Click / ESC to cancel)`;
    hint.className =
      "mt-2 bg-sky-950/90 border border-sky-400/70 text-sky-200 px-4 py-1 rounded-full text-xs font-semibold shadow-lg";
    hint.classList.remove("hidden");
    skillReticle.material.color.setHex(
      playerHero.heroCfg.primaryHex || 0x38bdf8,
    );
    skillReticle.scale.setScalar(aoeScale);
    skillReticle.position.set(worldCursor.x, 0.16, worldCursor.z);
    skillReticle.visible = true;
  } else {
    hint.classList.add("hidden");
    skillReticle.visible = false;
  }
}

function spawnLightningBolt3D(
  pStart,
  pEnd,
  colorCore = 0xffffff,
  colorOuter = 0x38bdf8,
  duration = 0.45,
) {
  [0.32, 0.14].forEach((rad, bIdx) => {
    const pts = [];
    const segs = 10;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const pt = new THREE.Vector3().lerpVectors(pStart, pEnd, t);
      pt.y = THREE.MathUtils.lerp(pStart.y + 1.8, pEnd.y + 1.2, t);
      if (s > 0 && s < segs) {
        const jitter = bIdx === 0 ? 1.15 : 1.85;
        pt.x += (Math.random() - 0.5) * jitter;
        pt.y += (Math.random() - 0.3) * 0.9;
        pt.z += (Math.random() - 0.5) * jitter;
      }
      pts.push(pt);
    }
    const mat = new THREE.MeshBasicMaterial({
      color: bIdx === 0 ? colorOuter : colorCore,
      transparent: true,
      opacity: 1.0,
    });
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts),
        22,
        rad,
        7,
        false,
      ),
      mat,
    );
    scene.add(mesh);
    fxList.push({
      mesh,
      t: 0,
      dur: duration,
      update: (p) => {
        mat.opacity = 1 - p;
      },
    });
  });
}

function spawnRisingSpire(
  x,
  z,
  height = 4.2,
  radius = 0.65,
  colorHex = 0x38bdf8,
  duration = 1.15,
) {
  const gy = getTerrainHeightAt(x, z);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 1.4,
    roughness: 0.25,
    transparent: true,
    opacity: 0.94,
  });
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 6),
    mat,
  );
  spire.position.set(x, gy - height * 0.4, z);
  spire.rotation.y = Math.random() * Math.PI;
  scene.add(spire);
  fxList.push({
    mesh: spire,
    t: 0,
    dur: duration,
    update: (p) => {
      if (p < 0.2) {
        const k = p / 0.2;
        spire.position.y = gy - height * 0.4 + height * 0.85 * k;
      } else if (p > 0.75) {
        const k = (p - 0.75) / 0.25;
        spire.position.y = gy + height * 0.45 - height * 0.85 * k;
        mat.opacity = 0.94 * (1 - k);
      }
    },
  });
}

function spawnPersistentZone(cfg) {
  const gy = getTerrainHeightAt(cfg.x, cfg.z);
  const grp = new THREE.Group();
  grp.position.set(cfg.x, gy + 0.14, cfg.z);

  if (!nxg.ready) nxgInit();
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(cfg.radius - 0.35, cfg.radius, 48),
    new THREE.MeshBasicMaterial({
      color: cfg.colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  outerRing.material.color.multiplyScalar(1.2);
  outerRing.rotation.x = -Math.PI / 2;
  grp.add(outerRing);

  const innerDisk = new THREE.Mesh(
    new THREE.CircleGeometry(cfg.radius * 0.94, 36),
    new THREE.MeshBasicMaterial({
      color: cfg.secondaryHex || cfg.colorHex,
      map: nxg.tex.rune,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  innerDisk.material.color.multiplyScalar(1.35);
  innerDisk.rotation.x = -Math.PI / 2;
  innerDisk.position.y = 0.02;
  grp.add(innerDisk);

  if (cfg.zoneType === "chronosphere") {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(
        cfg.radius,
        24,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.52,
      ),
      new THREE.MeshBasicMaterial({
        color: cfg.colorHex,
        wireframe: true,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
      }),
    );
    grp.add(dome);
  } else if (cfg.zoneType === "smoke") {
    // Swirling dark shadow smoke clouds
    for (let s = 0; s < 6; s++) {
      const ang = (s / 6) * Math.PI * 2;
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(cfg.radius * 0.38, 1),
        new THREE.MeshBasicMaterial({
          color: 0x3b0764,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        }),
      );
      puff.position.set(
        Math.cos(ang) * cfg.radius * 0.45,
        1.4,
        Math.sin(ang) * cfg.radius * 0.45,
      );
      grp.add(puff);
    }
  } else if (cfg.zoneType === "gravity_well") {
    // Pitch-black Black Hole sphere + tilted golden accretion disc!
    const bhSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.85, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0x020617 }),
    );
    bhSphere.position.y = 2.2;
    const accDisc = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.32, 8, 36),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.92,
      }),
    );
    accDisc.rotation.x = Math.PI / 2.3;
    accDisc.position.y = 2.2;
    grp.add(bhSphere, accDisc);
  } else if (cfg.zoneType === "banner") {
    // 3D Golden War-Banner Pole & Pennant
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 5.2, 8),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.85,
      }),
    );
    pole.position.y = 2.6;
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 2.2, 1.45),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 }),
    );
    flag.position.set(0, 3.8, 0.72);
    grp.add(pole, flag);
  } else if (cfg.zoneType === "trap") {
    // Crystalline Frost Bear-Trap Jaws
    const trapCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.75, 0),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true }),
    );
    trapCore.position.y = 0.45;
    grp.add(trapCore);
  }

  scene.add(grp);
  const zObj = {
    ...cfg,
    mesh: grp,
    outerRing,
    innerDisk,
    t: 0,
    tickAccum: 0,
  };
  activeZones.push(zObj);
  return zObj;
}

function spawnPhysicalHook3D(
  caster,
  dir,
  maxRange,
  hookMode,
  damageAmt,
  colorHex,
  chainHex,
  isVisualReplay,
) {
  const startPos = caster.mesh.position
    .clone()
    .add(new THREE.Vector3(0, 1.55, 0));
  const hookHead = new THREE.Group();
  const claw = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.16, 8, 18, Math.PI * 1.45),
    new THREE.MeshBasicMaterial({ color: colorHex }),
  );
  claw.rotation.x = Math.PI / 2;
  const barb = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.95, 5),
    new THREE.MeshBasicMaterial({ color: chainHex }),
  );
  barb.rotation.x = Math.PI / 2;
  barb.position.z = 0.55;
  hookHead.add(claw, barb);
  hookHead.position.copy(startPos);
  hookHead.rotation.y = Math.atan2(dir.x, dir.z);
  scene.add(hookHead);

  // Segmented 3D Chain Links connecting caster to hookHead!
  const linkCount = 16;
  const chainLinks = [];
  for (let li = 0; li < linkCount; li++) {
    const lk = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.065, 6, 10),
      new THREE.MeshBasicMaterial({
        color: li % 2 === 0 ? chainHex : colorHex,
      }),
    );
    lk.rotation.x = li % 2 === 0 ? Math.PI / 2 : 0;
    scene.add(lk);
    chainLinks.push(lk);
  }

  projectiles.push({
    kind: "hook",
    owner: caster,
    team: caster.team,
    mesh: hookHead,
    chainLinks,
    dir: dir.clone(),
    speed: 48,
    distLeft: maxRange,
    phase: "out",
    hookMode, // 'pull_enemy' | 'pull_caster'
    hookedTarget: null,
    damage: damageAmt,
    colorHex,
    isVisualReplay,
  });
}

function spawnRailgunLaser3D(pStart, pEnd, coreHex, ringHex) {
  const s = new THREE.Vector3(pStart.x, pStart.y + 1.55, pStart.z);
  const e = new THREE.Vector3(pEnd.x, pEnd.y + 1.55, pEnd.z);
  const dist = Math.max(0.5, s.distanceTo(e));
  const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);

  const beamMat = new THREE.MeshBasicMaterial({
    color: coreHex,
    transparent: true,
    opacity: 0.98,
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, dist, 10),
    beamMat,
  );
  beam.position.copy(mid);
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3().subVectors(e, s).normalize(),
  );
  scene.add(beam);
  fxList.push({
    mesh: beam,
    t: 0,
    dur: 0.52,
    update: (p) => {
      beam.scale.set(1 - p * 0.7, 1, 1 - p * 0.7);
      beamMat.opacity = 1 - p;
    },
  });

  // Perpendicular shock-discs along the railgun path
  for (let d = 1; d <= 4; d++) {
    const pt = new THREE.Vector3().lerpVectors(s, e, d / 5);
    const discMat = new THREE.MeshBasicMaterial({
      color: ringHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 1.35, 24),
      discMat,
    );
    disc.position.copy(pt);
    disc.lookAt(e);
    scene.add(disc);
    fxList.push({
      mesh: disc,
      t: 0,
      dur: 0.45,
      update: (p) => {
        disc.scale.setScalar(1 + p * 1.4);
        discMat.opacity = 0.85 * (1 - p);
      },
    });
  }
}

function spawnIceCrystalPrison3D(unit, dur = 2.0) {
  const gy = getTerrainHeightAt(
    unit.mesh.position.x,
    unit.mesh.position.z,
  );
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.95,
    transparent: true,
    opacity: 0.62,
    roughness: 0.15,
    metalness: 0.3,
  });
  const prism = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.45, 3.6, 6),
    crystalMat,
  );
  prism.position.set(
    unit.mesh.position.x,
    gy + 1.8,
    unit.mesh.position.z,
  );
  scene.add(prism);
  fxList.push({
    mesh: prism,
    t: 0,
    dur,
    update: (p) => {
      prism.position.set(
        unit.mesh.position.x,
        getTerrainHeightAt(unit.mesh.position.x, unit.mesh.position.z) +
          1.8,
        unit.mesh.position.z,
      );
      if (p > 0.82) crystalMat.opacity = 0.62 * ((1 - p) / 0.18);
    },
  });
}

function spawnSpinningTornado3D(
  origin,
  dir,
  range,
  radius,
  primaryHex,
  secondaryHex,
) {
  const tornadoGrp = new THREE.Group();
  for (let r = 0; r < 7; r++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.75 + r * 0.48, 0.18, 8, 24),
      new THREE.MeshBasicMaterial({
        color: r % 2 === 0 ? primaryHex : secondaryHex,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4 + r * 0.85;
    tornadoGrp.add(ring);
  }
  tornadoGrp.position.copy(origin).add(new THREE.Vector3(0, 0.2, 0));
  scene.add(tornadoGrp);
  return tornadoGrp;
}

function castHeroAbility(caster, key, targetPt, isVisualReplay = false) {
  if (caster.dead || caster.reincarnating || gameOver || !caster.heroCfg)
    return false;
  if (!isVisualReplay && caster.stunTimer > 0) return false;
  const hCfg = caster.heroCfg;
  const sk = hCfg.skills[key];
  const lvl = Math.max(1, caster.abilityLevels[key] || 0);
  if (!isVisualReplay) {
    if ((caster.abilityLevels[key] || 0) <= 0) {
      if (caster.isPlayer) {
        const msg =
          key === "R" && caster.level < 6
            ? "ULTIMATE UNLOCKS AT LVL 6!"
            : "ABILITY NOT LEARNED!";
        spawnFloatText(caster.mesh.position, msg, "#fb7185", 13);
      }
      return false;
    }
    if (caster.cooldowns[key] > 0) {
      if (caster.isPlayer)
        spawnFloatText(
          caster.mesh.position,
          "ON COOLDOWN",
          "#94a3b8",
          13,
        );
      return false;
    }
    if (caster.mana < sk.mana) {
      if (caster.isPlayer)
        spawnFloatText(caster.mesh.position, "NO MANA", "#38bdf8", 13);
      return false;
    }
    caster.mana -= sk.mana;
    caster.cooldowns[key] = sk.cd * caster.cdrMult;
    if (mpState.active && mpState.role === "host") {
      mpQueueFxEvent([
        "C",
        caster.netId || caster.id,
        key,
        Math.round(targetPt.x * 10) / 10,
        Math.round(targetPt.z * 10) / 10,
      ]);
    }
  }
  caster.castAnim = 0.45;
  nxgCastFx(caster, key);

  if (caster.isPlayer) {
    if (key === "R") {
      sfx.speakHeroLine(hCfg, hCfg.voice.cast.R, true, "commanding", {
        category: "cast_ult",
        chance: 0.85,
        chime: true,
        minGapMs: 6500,
        catGapMs: 14000,
      });
    } else {
      sfx.speakHeroLine(hCfg, hCfg.voice.cast[key], false, "triumph", {
        category: "cast",
        chance: 0.38,
        minGapMs: 13000,
        catGapMs: 16000,
      });
    }
  }

  const perRankScale = key === "R" ? 0.36 : 0.25;
  const powerMult =
    (1 + caster.int * 0.015 + caster.spellAmpBonus) *
    (1 + (lvl - 1) * perRankScale);
  const hid = hCfg.id;

  const dir = new THREE.Vector3().subVectors(
    targetPt,
    caster.mesh.position,
  );
  dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(1, 0, -1);
  dir.normalize();
  caster.mesh.rotation.y = Math.atan2(dir.x, dir.z);

  const deltaClamped = new THREE.Vector3().subVectors(
    targetPt,
    caster.mesh.position,
  );
  deltaClamped.y = 0;
  if (deltaClamped.length() > sk.range)
    deltaClamped.normalize().multiplyScalar(sk.range);
  const targetSpot = caster.mesh.position.clone().add(deltaClamped);
  targetSpot.y = getTerrainHeightAt(targetSpot.x, targetSpot.z);

  if (
    !isVisualReplay &&
    caster.isPlayer &&
    !canAbilityAffectStructure(hid, key, { type: "tower" })
  ) {
    const aimedStruct = units.find(
      (u) =>
        !u.dead &&
        u.team !== caster.team &&
        (u.type === "tower" || u.type === "ancient") &&
        u.mesh.position.distanceTo(targetSpot) <= u.radius + 1.8,
    );
    if (aimedStruct) {
      spawnFloatText(
        aimedStruct.mesh.position,
        "IMMUNE TO ABILITY!",
        "#94a3b8",
        13,
      );
    }
  }

  if (key === "Q") {
    if (hid === "malakor") {
      // BUTCHER'S MEAT HOOK: Launches real extending 3D chain & hook that reels victim back to Malakor!
      if (caster.isPlayer) sfx.play("spell_shadow_coil");
      spawnPhysicalHook3D(
        caster,
        dir,
        26,
        "pull_enemy",
        185 * powerMult,
        0x10b981,
        0xa855f7,
        isVisualReplay,
      );
    } else if (hid === "solenne") {
      // REFRACTING PRISM LASER: Instantaneous railgun laser that splits into 3 beams on first hit!
      if (caster.isPlayer) sfx.play("spell_laguna");
      const endPt = caster.mesh.position
        .clone()
        .addScaledVector(dir, sk.range);
      endPt.y = getTerrainHeightAt(endPt.x, endPt.z);
      let firstHit = null;
      let bestProj = sk.range;
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient"
        ) {
          const toU = new THREE.Vector3().subVectors(
            u.mesh.position,
            caster.mesh.position,
          );
          toU.y = 0;
          const proj = toU.dot(dir);
          if (
            proj > 0 &&
            proj <= bestProj &&
            Math.abs(toU.x * dir.z - toU.z * dir.x) <= 2.4 + u.radius
          ) {
            bestProj = proj;
            firstHit = u;
          }
        }
      });
      const impactPt = firstHit ? firstHit.mesh.position.clone() : endPt;
      spawnRailgunLaser3D(
        caster.mesh.position,
        impactPt,
        0xf472b6,
        0x38bdf8,
      );
      if (firstHit) {
        if (!isVisualReplay)
          firstHit.takeDamage(170 * powerMult, caster, true);
        [-0.52, 0, 0.52].forEach((sAng) => {
          const sDir = dir
            .clone()
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), sAng);
          const splitEnd = impactPt.clone().addScaledVector(sDir, 13);
          splitEnd.y = getTerrainHeightAt(splitEnd.x, splitEnd.z);
          spawnRailgunLaser3D(impactPt, splitEnd, 0x38bdf8, 0xf472b6);
          units.forEach((other) => {
            if (
              other !== firstHit &&
              !other.dead &&
              other.team !== caster.team &&
              other.type !== "tower" &&
              other.type !== "ancient"
            ) {
              const toO = new THREE.Vector3().subVectors(
                other.mesh.position,
                impactPt,
              );
              toO.y = 0;
              const pr = toO.dot(sDir);
              if (
                pr > 0 &&
                pr <= 13 &&
                Math.abs(toO.x * sDir.z - toO.z * sDir.x) <=
                  2.2 + other.radius
              ) {
                if (!isVisualReplay)
                  other.takeDamage(105 * powerMult, caster, false);
              }
            }
          });
        });
      }
    } else if (hid === "terrakor") {
      // FISSURE BOULDER WALL: Raises an impassable 9-boulder Granite Wall (5.0s)
      if (caster.isPlayer) {
        sfx.play("spell_orbital_meteor");
        triggerCameraShake(0.65);
      }
      const steps = 9;
      const wallPillars = [];
      const wallPoints = [];
      for (let s = 1; s <= steps; s++) {
        const dist = (s / steps) * sk.range;
        const fxX = THREE.MathUtils.clamp(
          caster.mesh.position.x + dir.x * dist,
          -MAP_HALF + 3,
          MAP_HALF - 3,
        );
        const fxZ = THREE.MathUtils.clamp(
          caster.mesh.position.z + dir.z * dist,
          -MAP_HALF + 3,
          MAP_HALF - 3,
        );
        const gy = getTerrainHeightAt(fxX, fxZ);
        const pMat = new THREE.MeshStandardMaterial({
          color: s % 2 === 0 ? 0x059669 : 0x292524,
          emissive: s % 2 === 0 ? 0xfbbf24 : 0x10b981,
          emissiveIntensity: 0.65,
          roughness: 0.6,
        });
        const pillar = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.5, 0),
          pMat,
        );
        pillar.scale.set(1.15, 2.4, 1.15);
        pillar.position.set(fxX, gy + 1.4, fxZ);
        pillar.rotation.y = s * 0.7;
        scene.add(pillar);
        wallPillars.push(pillar);
        wallPoints.push({ x: fxX, z: fxZ });
      }
      fissureWalls.push({
        team: caster.team,
        pillars: wallPillars,
        points: wallPoints,
        radius: 2.35,
        timer: 5.0,
      });
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient"
        ) {
          const toU = new THREE.Vector3().subVectors(
            u.mesh.position,
            caster.mesh.position,
          );
          toU.y = 0;
          const proj = toU.dot(dir);
          if (
            proj > 0 &&
            proj <= sk.range + u.radius &&
            Math.abs(toU.x * dir.z - toU.z * dir.x) <= 3.4 + u.radius
          ) {
            if (!isVisualReplay) {
              u.takeDamage(155 * powerMult, caster, true);
              u.stunTimer = 1.45;
            }
            spawnFloatText(
              u.mesh.position,
              "FISSURE WALL!",
              "#34d399",
              14,
            );
          }
        }
      });
    } else if (hid === "garrick") {
      // BLADESTORM WHIRLWIND: 2.5s moving spell-immune cyclone of slash ribbons!
      if (caster.isPlayer) sfx.play("spell_fire_wave");
      caster.bladeFuryTimer = 2.5;
      caster.bladeFuryTick = 0;
      caster.bladeFuryDmg = 56 * powerMult;
      caster.blinkBuffTimer = Math.max(caster.blinkBuffTimer, 2.5);
      if (!isVisualReplay)
        caster.bkbTimer = Math.max(caster.bkbTimer, 2.5);
      spawnFloatText(caster.mesh.position, "BLADESTORM!", "#fb923c", 15);
    } else if (hid === "seraphina") {
      // TWIN MOON CHAKRAMS: Dual curving boomerangs that arc outward and return!
      if (caster.isPlayer) sfx.play("spell_frost_volley");
      [-0.36, 0.36].forEach((angOff, idx) => {
        const cDir = dir
          .clone()
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), angOff);
        const chakGrp = new THREE.Group();
        const outer = new THREE.Mesh(
          new THREE.TorusGeometry(1.4, 0.22, 8, 24),
          new THREE.MeshBasicMaterial({
            color: idx === 0 ? 0x2dd4bf : 0xfef08a,
          }),
        );
        outer.rotation.x = Math.PI / 2;
        chakGrp.add(outer);
        chakGrp.position
          .copy(caster.mesh.position)
          .add(new THREE.Vector3(0, 1.48, 0));
        scene.add(chakGrp);
        projectiles.push({
          kind: "wave",
          owner: caster,
          team: caster.team,
          mesh: chakGrp,
          trailColor: 0x2dd4bf,
          spinMesh: true,
          boomerang: true,
          boomerangPhase: "out",
          curveSign: idx === 0 ? 1 : -1,
          dir: cDir,
          speed: 42,
          distLeft: sk.range * 0.85,
          hitRadius: 2.9,
          damage: 122 * powerMult,
          slowDur: 3.2,
          healOwner: 45 * powerMult,
          hitIds: new Set(),
        });
      });
    } else if (hid === "nyxia") {
      // BRIAR SEED RICOCHET: Bounces up to 5 times between enemies!
      if (caster.isPlayer) sfx.play("spell_frost_volley");
      const seedGrp = new THREE.Group();
      seedGrp.add(
        new THREE.Mesh(
          new THREE.OctahedronGeometry(0.95, 1),
          new THREE.MeshBasicMaterial({ color: 0x10b981 }),
        ),
      );
      seedGrp.position
        .copy(caster.mesh.position)
        .add(new THREE.Vector3(0, 1.5, 0));
      scene.add(seedGrp);
      projectiles.push({
        kind: "wave",
        owner: caster,
        team: caster.team,
        mesh: seedGrp,
        trailColor: 0x10b981,
        spinMesh: true,
        ricochetBounces: 5,
        dir,
        speed: 42,
        distLeft: sk.range,
        hitRadius: 2.9,
        damage: 142 * powerMult,
        slowDur: 3.6,
        hitIds: new Set(),
      });
    } else if (hid === "ignis") {
      if (caster.isPlayer) sfx.play("spell_fire_wave");
      [-0.25, 0, 0.25].forEach((angOff) => {
        const fDir = dir
          .clone()
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), angOff);
        const orbGrp = new THREE.Group();
        orbGrp.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(0.85, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xf97316 }),
          ),
        );
        orbGrp.position
          .copy(caster.mesh.position)
          .add(new THREE.Vector3(0, 1.45, 0));
        scene.add(orbGrp);
        projectiles.push({
          kind: "wave",
          owner: caster,
          team: caster.team,
          mesh: orbGrp,
          trailColor: 0xf97316,
          leaveFissure: true,
          dir: fDir,
          speed: 38,
          distLeft: sk.range,
          hitRadius: 2.6,
          damage: 132 * powerMult,
          hitIds: new Set(),
        });
      });
    } else if (hid === "sylphira") {
      if (caster.isPlayer) sfx.play("spell_frost_volley");
      [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45].forEach((angOff) => {
        const sDir = dir
          .clone()
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), angOff);
        const shard = new THREE.Mesh(
          new THREE.ConeGeometry(0.36, 2.35, 6),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
        );
        shard.rotation.x = Math.PI / 2;
        const arrowGrp = new THREE.Group();
        arrowGrp.add(shard);
        arrowGrp.rotation.y = Math.atan2(sDir.x, sDir.z);
        arrowGrp.position
          .copy(caster.mesh.position)
          .add(new THREE.Vector3(0, 1.45, 0));
        scene.add(arrowGrp);
        projectiles.push({
          kind: "wave",
          owner: caster,
          team: caster.team,
          mesh: arrowGrp,
          trailColor: 0x38bdf8,
          dir: sDir,
          speed: 43,
          distLeft: sk.range,
          hitRadius: 2.1,
          damage: 102 * powerMult,
          slowDur: 3.4,
          hitIds: new Set(),
        });
      });
    } else {
      // Directional signature projectile for Aurelius, Zephyros, Vespera, Aurelia, Kael'Thar, Valkyra, Dravenor, Thalindor
      if (caster.isPlayer)
        sfx.play(hid === "zephyros" ? "spell_laguna" : "spell_fire_wave");
      const projGrp = new THREE.Group();
      const col = hCfg.primaryHex;
      if (["aurelius", "valkyra", "thalindor"].includes(hid)) {
        const arc = new THREE.Mesh(
          new THREE.TorusGeometry(3.3, 0.52, 8, 30, Math.PI),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        arc.rotation.x = Math.PI / 2;
        arc.rotation.z = -Math.atan2(dir.z, dir.x) - Math.PI * 0.5;
        projGrp.add(arc);
      } else if (["aurelia", "vespera"].includes(hid)) {
        const spear = new THREE.Mesh(
          new THREE.ConeGeometry(0.45, 3.4, 5),
          new THREE.MeshBasicMaterial({ color: col }),
        );
        spear.rotation.x = Math.PI / 2;
        projGrp.add(spear);
        projGrp.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        projGrp.add(
          new THREE.Mesh(
            new THREE.OctahedronGeometry(1.15, 0),
            new THREE.MeshBasicMaterial({ color: col }),
          ),
        );
      }
      projGrp.position
        .copy(caster.mesh.position)
        .add(new THREE.Vector3(0, 1.45, 0));
      scene.add(projGrp);
      projectiles.push({
        kind: "wave",
        owner: caster,
        team: caster.team,
        mesh: projGrp,
        trailColor: col,
        leaveFissure: hid === "aurelius",
        chainLightning: hid === "zephyros" || hid === "dravenor",
        stasisLockDur: hid === "kaelthar" ? 1.45 : 0,
        knockback: hid === "thalindor" ? 7.5 : 0,
        healOwner: ["aurelia", "valkyra"].includes(hid)
          ? 95 * powerMult
          : 0,
        slowDur: [
          "vespera",
          "kaelthar",
          "dravenor",
          "thalindor",
        ].includes(hid)
          ? 3.5
          : 0,
        dir,
        speed: 42,
        distLeft: sk.range,
        hitRadius: 3.3,
        damage: 156 * powerMult,
        hitIds: new Set(),
      });
    }
  } else if (key === "W") {
    if (hid === "thalindor") {
      // LEVIATHAN ANCHOR GRAPPLE: Launches 3D Sea-Anchor & Chain that winches Thalindor onto target!
      if (caster.isPlayer) sfx.play("spell_shadow_coil");
      spawnPhysicalHook3D(
        caster,
        dir,
        24,
        "pull_caster",
        165 * powerMult,
        0x06b6d4,
        0x38bdf8,
        isVisualReplay,
      );
    } else if (hid === "aurelius") {
      // SUNFIRE WAR-BANNER: Plants a 3D Golden War-Banner (8s) buffing allies!
      if (caster.isPlayer) sfx.play("spell_shield_nova");
      spawnPersistentZone({
        zoneType: "banner",
        owner: caster,
        team: caster.team,
        x: targetSpot.x,
        z: targetSpot.z,
        radius: 8.5,
        duration: 8.0,
        colorHex: 0xfacc15,
        secondaryHex: 0xdc2626,
        allyHealTick: 32 * powerMult,
        allyHaste: true,
      });
      spawnFloatText(targetSpot, "SUNFIRE WAR-BANNER!", "#facc15", 15);
    } else if (hid === "sylphira" || hid === "zephyros") {
      if (hid === "zephyros") {
        // BALL LIGHTNING: Zips along a jagged lightning bolt zapping enemies in path!
        if (caster.isPlayer) {
          sfx.play("spell_laguna");
          triggerCameraShake(0.5);
        }
        const start = caster.mesh.position.clone();
        const nx = THREE.MathUtils.clamp(
          targetSpot.x,
          -MAP_HALF + 4,
          MAP_HALF - 4,
        );
        const nz = THREE.MathUtils.clamp(
          targetSpot.z,
          -MAP_HALF + 4,
          MAP_HALF - 4,
        );
        const ny = getTerrainHeightAt(nx, nz);
        spawnLightningBolt3D(
          start,
          new THREE.Vector3(nx, ny, nz),
          0xffffff,
          0x38bdf8,
          0.55,
        );
        units.forEach((u) => {
          if (
            !u.dead &&
            u.team !== caster.team &&
            u.type !== "tower" &&
            u.type !== "ancient"
          ) {
            const seg = new THREE.Vector3(nx - start.x, 0, nz - start.z);
            const len = seg.length();
            if (len > 0.1) {
              const sDir = seg.clone().divideScalar(len);
              const toU = new THREE.Vector3(
                u.mesh.position.x - start.x,
                0,
                u.mesh.position.z - start.z,
              );
              const proj = toU.dot(sDir);
              if (
                proj >= 0 &&
                proj <= len &&
                Math.abs(toU.x * sDir.z - toU.z * sDir.x) <=
                  3.6 + u.radius
              ) {
                if (!isVisualReplay)
                  u.takeDamage(145 * powerMult, caster);
              }
            }
          }
        });
        caster.mesh.position.set(nx, ny, nz);
        if (isVisualReplay) {
          caster._netX = nx;
          caster._netZ = nz;
        }
        caster.targetPos = null;
      } else {
        // SYLPHIRA GALE VORTEX TORNADO: 3D spinning wind funnel tossing enemies airborne!
        if (caster.isPlayer) sfx.play("spell_frost_volley");
        const tornadoGrp = spawnSpinningTornado3D(
          caster.mesh.position,
          dir,
          sk.range,
          4.0,
          0x2dd4bf,
          0xbae6fd,
        );
        projectiles.push({
          kind: "wave",
          owner: caster,
          team: caster.team,
          mesh: tornadoGrp,
          trailColor: 0x2dd4bf,
          spinMesh: true,
          dir,
          speed: 37,
          distLeft: sk.range,
          hitRadius: 4.0,
          damage: 140 * powerMult,
          slowDur: 3.5,
          knockback: 9.0,
          hitIds: new Set(),
        });
      }
    } else if (hid === "ignis") {
      // VOLCANIC ERUPTION: Cracks magma crater -> twisting flame column & boulders
      if (caster.isPlayer) sfx.play("spell_fire_wave");
      spawnGroundRuneDecal(
        targetSpot.x,
        targetSpot.z,
        5.8,
        0xf97316,
        1.5,
      );
      scheduledEvents.push({
        delay: 0.3,
        fn: () => {
          if (gameOver) return;
          if (caster.isPlayer) triggerCameraShake(0.6);
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            spawnRisingSpire(
              targetSpot.x + Math.cos(a) * 2.6,
              targetSpot.z + Math.sin(a) * 2.6,
              5.0,
              0.68,
              k % 2 === 0 ? 0xf97316 : 0xfacc15,
              0.85,
            );
          }
          spawnParticleBurst(targetSpot, 0xfacc15, 32);
          units.forEach((u) => {
            if (
              !u.dead &&
              u.team !== caster.team &&
              u.type !== "tower" &&
              u.type !== "ancient" &&
              u.mesh.position.distanceTo(targetSpot) <= 6.0 + u.radius
            ) {
              if (!isVisualReplay) {
                u.takeDamage(195 * powerMult, caster);
                u.stunTimer = 1.65;
              }
              spawnFloatText(
                u.mesh.position,
                "ERUPTION STUN!",
                "#fb923c",
                14,
              );
            }
          });
        },
      });
    } else if (hid === "malakor") {
      // DISMEMBER SOUL BITE: Melee/short-range chomp suppressing target & healing Malakor 100%!
      if (caster.isPlayer) sfx.play("spell_shadow_coil");
      const biteTarget = findNearestTarget(caster, 7.5, false, true);
      if (biteTarget) {
        const dmg = 210 * powerMult;
        spawnParticleBurst(biteTarget.mesh.position, 0x10b981, 26);
        if (!isVisualReplay) {
          biteTarget.takeDamage(dmg, caster, true);
          biteTarget.stunTimer = Math.max(biteTarget.stunTimer, 1.45);
          caster.hp = Math.min(caster.maxHp, caster.hp + dmg);
        }
        spawnFloatText(
          biteTarget.mesh.position,
          `DISMEMBERED +${Math.round(dmg)} HP!`,
          "#10b981",
          15,
        );
      } else {
        spawnFloatText(
          caster.mesh.position,
          "NO TARGET IN BITE RANGE",
          "#94a3b8",
          13,
        );
      }
    } else if (hid === "terrakor") {
      // ENCHANT TOTEM: Empowers crit +40% & seismic ground-slam cleave
      if (caster.isPlayer) {
        sfx.play("spell_orbital_meteor");
        triggerCameraShake(0.6);
      }
      const p = caster.mesh.position;
      caster.blinkBuffTimer = 4.8;
      if (!isVisualReplay)
        caster.critChance = Math.min(0.9, caster.critChance + 0.4);
      scheduledEvents.push({
        delay: 4.8,
        fn: () => {
          if (!caster.dead)
            caster.critChance = Math.max(0, caster.critChance - 0.4);
        },
      });
      spawnGroundRuneDecal(p.x, p.z, 6.8, 0x10b981, 1.5);
      spawnFloatText(p, "TOTEM ENCHANTED (+40% CRIT)!", "#fbbf24", 15);
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.mesh.position.distanceTo(p) <= 7.5 + u.radius
        ) {
          if (!isVisualReplay) {
            const isStruct = u.type === "tower" || u.type === "ancient";
            u.takeDamage(
              155 * powerMult * getStructureAbilityDmgMult(u),
              caster,
              true,
            );
            if (!isStruct) u.stunTimer = 1.15;
          }
        }
      });
    } else if (hid === "aurelia") {
      // PURIFYING LIGHT RAY: Dual-effect beam healing allies & damaging enemies!
      if (caster.isPlayer) sfx.play("spell_laguna");
      const endPt = caster.mesh.position
        .clone()
        .addScaledVector(dir, sk.range);
      endPt.y = getTerrainHeightAt(endPt.x, endPt.z);
      spawnRailgunLaser3D(
        caster.mesh.position,
        endPt,
        0xfef08a,
        0x38bdf8,
      );
      units.forEach((u) => {
        if (!u.dead && u.type !== "tower" && u.type !== "ancient") {
          const toU = new THREE.Vector3().subVectors(
            u.mesh.position,
            caster.mesh.position,
          );
          toU.y = 0;
          const proj = toU.dot(dir);
          if (
            proj >= 0 &&
            proj <= sk.range &&
            Math.abs(toU.x * dir.z - toU.z * dir.x) <= 3.2 + u.radius
          ) {
            if (u.team === caster.team && !isVisualReplay) {
              u.hp = Math.min(u.maxHp, u.hp + 185 * powerMult);
              spawnFloatText(
                u.mesh.position,
                `+${Math.round(185 * powerMult)} PURIFY!`,
                "#fef08a",
                14,
              );
            } else if (u.team !== caster.team && !isVisualReplay) {
              u.takeDamage(165 * powerMult, caster, false);
            }
          }
        }
      });
    } else if (hid === "kaelthar") {
      // TEMPORAL REWIND: Restores 28% missing HP/Mana, trims Q CD, and leaves a golden clock-ring!
      if (caster.isPlayer) sfx.play("spell_shield_nova");
      const p = caster.mesh.position;
      if (!isVisualReplay) {
        caster.hp = Math.min(
          caster.maxHp,
          caster.hp + (caster.maxHp - caster.hp) * 0.28 + 120,
        );
        caster.mana = Math.min(
          caster.maxMana,
          caster.mana + (caster.maxMana - caster.mana) * 0.28 + 90,
        );
        caster.cooldowns.Q = Math.max(0, (caster.cooldowns.Q || 0) - 3.0);
      }
      spawnGroundRuneDecal(p.x, p.z, 5.5, 0x22d3ee, 1.5);
      spawnParticleBurst(p, 0xfacc15, 24);
      spawnFloatText(p, "TEMPORAL REWIND!", "#22d3ee", 15);
    } else if (hid === "valkyra") {
      // CRIPPLING AXE THROW: Hurls spinning sanguine axe in a line!
      if (caster.isPlayer) sfx.play("spell_frost_volley");
      const axeMesh = new THREE.Mesh(
        new THREE.TorusGeometry(1.25, 0.24, 6, 16),
        new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
      );
      axeMesh.rotation.x = Math.PI / 2;
      axeMesh.position
        .copy(caster.mesh.position)
        .add(new THREE.Vector3(0, 1.45, 0));
      scene.add(axeMesh);
      projectiles.push({
        kind: "wave",
        owner: caster,
        team: caster.team,
        mesh: axeMesh,
        trailColor: 0xf43f5e,
        spinMesh: true,
        dir,
        speed: 44,
        distLeft: sk.range,
        hitRadius: 2.8,
        damage: 165 * powerMult,
        slowDur: 4.0,
        hitIds: new Set(),
      });
    } else if (hid === "dravenor") {
      // FATAL BONDS: Soul-chains up to 4 enemies sharing 35% of all damage taken!
      if (caster.isPlayer) sfx.play("spell_shadow_coil");
      const bonded = [];
      units.forEach((u) => {
        if (
          bonded.length < 4 &&
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(targetSpot) <= 9.5 + u.radius
        ) {
          bonded.push(u);
        }
      });
      bonded.forEach((u, idx) => {
        u.fatalBondGroup = bonded;
        u.fatalBondTimer = 6.5;
        spawnFloatText(u.mesh.position, "FATAL BOND!", "#e879f9", 14);
        if (idx > 0)
          spawnLightningBolt3D(
            bonded[idx - 1].mesh.position,
            u.mesh.position,
            0xf97316,
            0xa855f7,
            1.1,
          );
      });
      if (bonded.length > 1)
        spawnLightningBolt3D(
          bonded[bonded.length - 1].mesh.position,
          bonded[0].mesh.position,
          0xf97316,
          0xa855f7,
          1.1,
        );
    } else if (hid === "nyxia") {
      // BRIAR VINE SNARE: Coiling 3D thorny vines rooting enemies for 2.0s!
      if (caster.isPlayer) sfx.play("spell_shield_nova");
      spawnGroundRuneDecal(
        targetSpot.x,
        targetSpot.z,
        6.4,
        0xbef264,
        1.9,
      );
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        spawnRisingSpire(
          targetSpot.x + Math.cos(a) * 4.4,
          targetSpot.z + Math.sin(a) * 4.4,
          4.4,
          0.62,
          k % 2 === 0 ? 0x10b981 : 0xbef264,
          1.85,
        );
      }
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(targetSpot) <= 6.6 + u.radius
        ) {
          if (!isVisualReplay) {
            u.takeDamage(165 * powerMult, caster);
            u.stunTimer = 2.0;
          }
          spawnFloatText(u.mesh.position, "VINE ROOTED!", "#34d399", 14);
        }
      });
    } else if (hid === "solenne") {
      // CRYSTAL HALLUCINATION: Summons 2 holographic 3D Mirror Clones around Solenne!
      if (caster.isPlayer) sfx.play("spell_shield_nova");
      const p = caster.mesh.position;
      if (!isVisualReplay) {
        [-2.8, 2.8].forEach((ox) => {
          spawnSummonedUnit(caster, {
            name: "Prism Mirror Clone",
            subType: "ranged",
            x: THREE.MathUtils.clamp(
              p.x + ox,
              -MAP_HALF + 4,
              MAP_HALF - 4,
            ),
            z: p.z,
            maxHp: 460 * powerMult,
            atkDamage: Math.round(caster.atkDamage * 0.6),
            atkRange: 12.5,
            moveSpeed: 13.5,
            duration: 11.0,
            colorHex: 0xf472b6,
            scale: 1.05,
          });
        });
      }
      spawnFloatText(p, "CRYSTAL HALLUCINATION!", "#f472b6", 15);
    } else if (hid === "garrick") {
      // MOLTEN SLAG MORTAR: Lobbed magma shell creating a 4.5s burning lava pool!
      if (caster.isPlayer) sfx.play("spell_fire_wave");
      spawnPersistentZone({
        zoneType: "sunbeam",
        owner: caster,
        team: caster.team,
        x: targetSpot.x,
        z: targetSpot.z,
        radius: 5.8,
        duration: 4.5,
        colorHex: 0xfb923c,
        secondaryHex: 0xef4444,
        tickDmg: 95 * powerMult,
        allowStructures: true,
      });
      spawnParticleBurst(targetSpot, 0xfb923c, 28);
      spawnFloatText(targetSpot, "MOLTEN SLAG POOL!", "#fb923c", 15);
    } else {
      // Vespera & Seraphina: True Shadow/Astral Phase Blink!
      if (caster.isPlayer) sfx.play("spell_blink");
      const start = caster.mesh.position.clone();
      const col = hCfg.primaryHex;
      spawnParticleBurst(start, col, 20);
      const nx = THREE.MathUtils.clamp(
        targetSpot.x,
        -MAP_HALF + 4,
        MAP_HALF - 4,
      );
      const nz = THREE.MathUtils.clamp(
        targetSpot.z,
        -MAP_HALF + 4,
        MAP_HALF - 4,
      );
      caster.activeDash = {
        startX: start.x,
        startZ: start.z,
        endX: nx,
        endZ: nz,
        t: 0,
        dur: 0.22,
        arcHeight: 2.2,
        colHex: col,
      };
      if (isVisualReplay) {
        caster._netX = nx;
        caster._netZ = nz;
        caster._dashLockTimer = 0.26;
      }
      caster.targetPos = null;
      caster.blinkBuffTimer = 4.8;
      if (!isVisualReplay)
        caster.critChance = Math.min(0.9, caster.critChance + 0.3);
      scheduledEvents.push({
        delay: 4.5,
        fn: () => {
          if (!caster.dead)
            caster.critChance = Math.max(0, caster.critChance - 0.3);
        },
      });
      spawnParticleBurst(caster.mesh.position, col, 24);
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(caster.mesh.position) <=
            6.2 + u.radius
        ) {
          if (!isVisualReplay) {
            u.takeDamage(135 * powerMult, caster, true);
            u.slowTimer = 3.2;
            u.slowFactor = 0.45;
          }
        }
      });
    }
  } else if (key === "E") {
    if (caster.isPlayer) sfx.play("spell_shield_nova");
    const p = caster.mesh.position;
    if (["aurelius", "thalindor", "aurelia"].includes(hid)) {
      // Only the 3 dedicated Tank/Support heroes get a Shield on E!
      const shieldBase = hid === "thalindor" ? 280 : 245;
      if (!isVisualReplay) {
        caster.shield = shieldBase * powerMult;
        caster.shieldTimer = 6.0;
        if (hid !== "aurelia") caster.bladeMailTimer = 4.5;
      }
      if (hid === "aurelia") {
        spawnPersistentZone({
          zoneType: "sanctuary",
          owner: caster,
          team: caster.team,
          x: p.x,
          z: p.z,
          radius: 8.2,
          duration: 5.0,
          colorHex: 0xfef08a,
          secondaryHex: 0x38bdf8,
          tickDmg: 50 * powerMult,
          allyHealTick: 48 * powerMult,
        });
      } else {
        spawnGroundRuneDecal(p.x, p.z, sk.range, hCfg.primaryHex, 1.5);
        units.forEach((u) => {
          if (
            !u.dead &&
            u.team !== caster.team &&
            u.type !== "tower" &&
            u.type !== "ancient" &&
            u.mesh.position.distanceTo(p) <= sk.range + u.radius
          ) {
            if (!isVisualReplay) {
              u.takeDamage(130 * powerMult, caster);
              u.slowTimer = 3.2;
              u.slowFactor = 0.5;
            }
          }
        });
      }
    } else if (hid === "sylphira") {
      // FROST BEAR-TRAP SNARE (20s persistent ground trap!)
      spawnPersistentZone({
        zoneType: "trap",
        owner: caster,
        team: caster.team,
        x: p.x,
        z: p.z,
        radius: 4.2,
        duration: 20.0,
        colorHex: 0x38bdf8,
        secondaryHex: 0xbae6fd,
        trapDamage: 185 * powerMult,
        trapRootDur: 2.2,
      });
      spawnFloatText(p, "FROST TRAP PLACED!", "#38bdf8", 14);
    } else if (hid === "ignis") {
      // CINDER RUSH: Speed + Wildfire Carpet Trail (no shield!)
      caster.fireTrailTimer = 5.0;
      caster.fireTrailTick = 0;
      caster.fireTrailDmg = 58 * powerMult;
      caster.blinkBuffTimer = 5.0;
      if (!isVisualReplay) caster.atkSpeedMult += 0.75;
      scheduledEvents.push({
        delay: 5.0,
        fn: () => {
          if (!caster.dead)
            caster.atkSpeedMult = Math.max(
              0.5,
              caster.atkSpeedMult - 0.75,
            );
        },
      });
      spawnFloatText(p, "CINDER RUSH!", "#f97316", 15);
    } else if (hid === "malakor") {
      // PLAGUE ROT CLOUD: 4.5s toxic miasma DPS aura (no shield!)
      spawnPersistentZone({
        zoneType: "smoke",
        owner: caster,
        team: caster.team,
        x: p.x,
        z: p.z,
        radius: 7.8,
        duration: 4.5,
        colorHex: 0x10b981,
        secondaryHex: 0x064e3b,
        tickDmg: 82 * powerMult,
        slowEnemies: true,
      });
      spawnFloatText(p, "PLAGUE ROT MIASMA!", "#10b981", 15);
    } else if (hid === "zephyros" && !isVisualReplay) {
      // STATIC REMNANT CLONE (no shield!)
      spawnSummonedUnit(caster, {
        name: "Static Remnant",
        subType: "ranged",
        x: p.x,
        z: p.z,
        maxHp: 350,
        atkDamage: 1,
        atkRange: 0.1,
        moveSpeed: 0,
        duration: 9.0,
        isStaticRemnant: true,
        remnantBurstDmg: 210 * powerMult,
        colorHex: 0x38bdf8,
        scale: 1.15,
      });
      spawnFloatText(p, "STATIC REMNANT!", "#38bdf8", 15);
    } else if (hid === "vespera") {
      // UMBRAL SMOKE BOMB (no shield!)
      spawnPersistentZone({
        zoneType: "smoke",
        owner: caster,
        team: caster.team,
        x: p.x,
        z: p.z,
        radius: 7.8,
        duration: 5.0,
        colorHex: 0xd946ef,
        secondaryHex: 0x3b0764,
        tickDmg: 42 * powerMult,
        slowEnemies: true,
        allyHaste: true,
      });
      caster.blinkBuffTimer = 5.0;
      spawnFloatText(p, "UMBRAL SMOKE BOMB!", "#e879f9", 15);
    } else if (hid === "terrakor") {
      // TECTONIC MAGNETIZE: Pulls all enemies within 12m inward (no shield!)
      if (caster.isPlayer) triggerCameraShake(0.6);
      spawnGroundRuneDecal(p.x, p.z, 11.5, 0x34d399, 1.6);
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient"
        ) {
          const d = u.mesh.position.distanceTo(p);
          if (d <= 12.0 + u.radius) {
            if (!isVisualReplay) {
              u.takeDamage(150 * powerMult, caster);
              u.stunTimer = 1.25;
            }
            if (d > 2.2 && u.type !== "tower") {
              u.mesh.position.x = THREE.MathUtils.lerp(
                u.mesh.position.x,
                p.x,
                0.65,
              );
              u.mesh.position.z = THREE.MathUtils.lerp(
                u.mesh.position.z,
                p.z,
                0.65,
              );
            }
            spawnFloatText(u.mesh.position, "MAGNETIZED!", "#34d399", 14);
          }
        }
      });
    } else if (hid === "kaelthar") {
      // TIME DILATION CURSE: 65% enemy slow (no shield!)
      spawnGroundRuneDecal(p.x, p.z, 10.5, 0x22d3ee, 1.8);
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(p) <= 10.5 + u.radius
        ) {
          if (!isVisualReplay) {
            u.takeDamage(120 * powerMult, caster);
            u.slowTimer = 4.5;
            u.slowFactor = 0.35;
          }
          spawnFloatText(
            u.mesh.position,
            "TIME DILATED (-65%)!",
            "#22d3ee",
            14,
          );
        }
      });
    } else if (hid === "valkyra") {
      // BLOODRAGE FRENZY: Sacrifices 10% HP for +85 ATK, +55% Atk Spd & +35% Lifesteal (no shield!)
      if (!isVisualReplay) {
        caster.hp = Math.max(50, caster.hp * 0.9);
        caster.atkDamage += 85;
        caster.atkSpeedMult += 0.55;
        caster.lifesteal += 0.35;
      }
      scheduledEvents.push({
        delay: 5.0,
        fn: () => {
          if (!caster.dead) {
            caster.atkDamage = Math.max(20, caster.atkDamage - 85);
            caster.atkSpeedMult = Math.max(
              0.5,
              caster.atkSpeedMult - 0.55,
            );
            caster.lifesteal = Math.max(0, caster.lifesteal - 0.35);
          }
        },
      });
      spawnParticleBurst(p, 0xf43f5e, 26);
      spawnFloatText(p, "BLOODRAGE (+85 ATK)!", "#f43f5e", 15);
    } else if (hid === "dravenor") {
      // SOUL PACT DRAIN: Restores +220 Mana & +180 HP instantly (no shield!)
      if (!isVisualReplay) {
        caster.mana = Math.min(caster.maxMana, caster.mana + 220);
        caster.hp = Math.min(caster.maxHp, caster.hp + 180);
      }
      spawnParticleBurst(p, 0xa855f7, 26);
      spawnFloatText(p, "+220 MANA & +180 HP PACT!", "#c084fc", 15);
    } else if (hid === "nyxia") {
      // ENCHANTED HEALING WISPS: 5.0s healing aura (no shield!)
      spawnPersistentZone({
        zoneType: "sanctuary",
        owner: caster,
        team: caster.team,
        x: p.x,
        z: p.z,
        radius: 8.5,
        duration: 5.0,
        colorHex: 0x10b981,
        secondaryHex: 0xbef264,
        allyHealTick: 65 * powerMult,
        allyHaste: true,
      });
      spawnFloatText(p, "ENCHANTED HEALING WISPS!", "#34d399", 15);
    } else if (hid === "solenne") {
      // SOLAR BLIND FLASH: Blinds & scorches enemies (no shield!)
      spawnParticleBurst(p, 0xf472b6, 30);
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(p) <= 9.5 + u.radius
        ) {
          if (!isVisualReplay) {
            u.takeDamage(145 * powerMult, caster);
            u.slowTimer = 4.0;
            u.slowFactor = 0.45;
          }
          spawnFloatText(
            u.mesh.position,
            "SOLAR BLINDED!",
            "#f472b6",
            14,
          );
        }
      });
    } else if (hid === "garrick" && !isVisualReplay) {
      // FORGE HEALING WARD (no shield!)
      spawnSummonedUnit(caster, {
        name: "Forge Healing Ward",
        subType: "ranged",
        x: p.x,
        z: p.z,
        maxHp: 450,
        atkDamage: 1,
        atkRange: 0.1,
        moveSpeed: 0,
        duration: 8.0,
        isWardTotem: true,
        wardHealPerSec: 75 * powerMult,
        colorHex: 0xfb923c,
        scale: 1.05,
      });
      spawnFloatText(p, "FORGE HEALING WARD!", "#fb923c", 15);
    } else {
      // SERAPHINA: Astral Mana & Haste Pulse (no shield!)
      if (!isVisualReplay)
        caster.mana = Math.min(caster.maxMana, caster.mana + 150);
      caster.blinkBuffTimer = 5.0;
      spawnParticleBurst(p, 0x2dd4bf, 24);
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(p) <= 9.2 + u.radius
        ) {
          if (!isVisualReplay) {
            u.takeDamage(135 * powerMult, caster);
            u.slowTimer = 3.5;
            u.slowFactor = 0.45;
          }
        }
      });
      spawnFloatText(p, "+150 MANA & TWILIGHT HASTE!", "#2dd4bf", 15);
    }
  } else if (key === "R") {
    const impactPos = targetSpot.clone();

    if (hid === "ignis") {
      // LAGUNA RAILGUN LASER: Pure piercing high-voltage railgun beam (no stun!)
      if (caster.isPlayer) {
        sfx.play("spell_laguna");
        triggerCameraShake(0.95);
      }
      const endPt = caster.mesh.position
        .clone()
        .addScaledVector(dir, sk.range);
      endPt.y = getTerrainHeightAt(endPt.x, endPt.z);
      spawnRailgunLaser3D(
        caster.mesh.position,
        endPt,
        0xfef08a,
        0xef4444,
      );
      units.forEach((u) => {
        if (!u.dead && u.team !== caster.team) {
          const toU = new THREE.Vector3().subVectors(
            u.mesh.position,
            caster.mesh.position,
          );
          toU.y = 0;
          const proj = toU.dot(dir);
          if (
            proj >= 0 &&
            proj <= sk.range &&
            Math.abs(toU.x * dir.z - toU.z * dir.x) <= 3.0 + u.radius
          ) {
            if (!isVisualReplay)
              u.takeDamage(
                465 * powerMult * getStructureAbilityDmgMult(u),
                caster,
                true,
              );
          }
        }
      });
    } else if (hid === "sylphira") {
      // ABSOLUTE ZERO: Encases enemies in 3D Hexagonal Ice Crystal Prisons!
      if (caster.isPlayer) {
        sfx.play("spell_frost_volley");
        triggerCameraShake(0.8);
      }
      spawnGroundRuneDecal(impactPos.x, impactPos.z, 8.8, 0x38bdf8, 2.2);
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(impactPos) <= 8.5 + u.radius
        ) {
          spawnIceCrystalPrison3D(u, 2.1);
          if (!isVisualReplay) {
            u.takeDamage(340 * powerMult, caster, true);
            u.stunTimer = 2.1;
          }
          spawnFloatText(u.mesh.position, "FROZEN SOLID!", "#38bdf8", 15);
        }
      });
    } else if (hid === "kaelthar") {
      // CHRONOSPHERE DOME
      if (caster.isPlayer) {
        sfx.play("spell_orbital_meteor");
        triggerCameraShake(0.95);
      }
      spawnPersistentZone({
        zoneType: "chronosphere",
        owner: caster,
        team: caster.team,
        x: impactPos.x,
        z: impactPos.z,
        radius: 8.8,
        duration: 3.2,
        colorHex: 0x22d3ee,
        secondaryHex: 0xfacc15,
        tickDmg: 95 * powerMult,
      });
      caster.blinkBuffTimer = 4.0;
      spawnFloatText(impactPos, "CHRONOSPHERE!", "#22d3ee", 18);
    } else if (hid === "seraphina") {
      // BLACK HOLE SINGULARITY: Pitch-black core + golden accretion disc pulling foes in!
      if (caster.isPlayer) {
        sfx.play("spell_orbital_meteor");
        triggerCameraShake(0.95);
      }
      spawnPersistentZone({
        zoneType: "gravity_well",
        owner: caster,
        team: caster.team,
        x: impactPos.x,
        z: impactPos.z,
        radius: 9.2,
        duration: 3.2,
        colorHex: 0x2dd4bf,
        secondaryHex: 0xfef08a,
        tickDmg: 85 * powerMult,
        detonateDmg: 265 * powerMult,
      });
      spawnFloatText(impactPos, "BLACK HOLE SINGULARITY!", "#2dd4bf", 18);
    } else if (hid === "aurelia") {
      // GUARDIAN ANGEL WINGS: +999 Armor & Regen aura for Aurelia & allies (no stun!)
      if (caster.isPlayer) sfx.play("spell_shield_nova");
      const p = caster.mesh.position;
      units.forEach((ally) => {
        if (
          !ally.dead &&
          ally.team === caster.team &&
          ally.type !== "tower" &&
          ally.type !== "ancient" &&
          ally.mesh.position.distanceTo(p) <= 14.0
        ) {
          if (!isVisualReplay) {
            ally.armor += 999;
            ally.hp = Math.min(ally.maxHp, ally.hp + 260 * powerMult);
          }
          spawnFloatText(
            ally.mesh.position,
            "GUARDIAN ANGEL (+999 ARMOR)!",
            "#fef08a",
            15,
          );
          scheduledEvents.push({
            delay: 4.5,
            fn: () => {
              if (!ally.dead) ally.armor = Math.max(2, ally.armor - 999);
            },
          });
        }
      });
    } else if (hid === "valkyra") {
      // HEMORRHAGE GUILLOTINE: Pure lethal execute with 75% CD refund on kill (no stun!)
      if (caster.isPlayer) {
        sfx.play("spell_laguna");
        triggerCameraShake(1.0);
      }
      spawnParticleBurst(impactPos, 0xf43f5e, 36);
      let gotKill = false;
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(impactPos) <= 6.8 + u.radius
        ) {
          const execMult = u.hp < u.maxHp * 0.5 ? 1.55 : 1.0;
          const dmg = 440 * powerMult * execMult;
          if (!isVisualReplay) {
            u.takeDamage(dmg, caster, true);
            if (u.dead) gotKill = true;
            caster.hp = Math.min(caster.maxHp, caster.hp + dmg * 0.35);
          }
        }
      });
      if (gotKill && !isVisualReplay) {
        caster.cooldowns.R *= 0.25;
        spawnFloatText(
          caster.mesh.position,
          "GUILLOTINE RESET (-75% CD)!",
          "#f43f5e",
          16,
        );
      }
    } else if (hid === "vespera") {
      // SHADOW DANCE FRENZY: +100% Atk Spd, +35% Lifesteal + X-Slash (no stun!)
      if (caster.isPlayer) sfx.play("spell_laguna");
      if (!isVisualReplay) {
        caster.atkSpeedMult += 1.0;
        caster.lifesteal += 0.35;
      }
      caster.blinkBuffTimer = 4.5;
      scheduledEvents.push({
        delay: 4.5,
        fn: () => {
          if (!caster.dead) {
            caster.atkSpeedMult = Math.max(
              0.5,
              caster.atkSpeedMult - 1.0,
            );
            caster.lifesteal = Math.max(0, caster.lifesteal - 0.35);
          }
        },
      });
      [-Math.PI / 4, Math.PI / 4].forEach((rot) => {
        const slash = new THREE.Mesh(
          new THREE.BoxGeometry(11.5, 0.38, 0.9),
          new THREE.MeshBasicMaterial({
            color: 0xd946ef,
            transparent: true,
            opacity: 0.95,
          }),
        );
        slash.position.set(impactPos.x, impactPos.y + 1.5, impactPos.z);
        slash.rotation.y = rot;
        scene.add(slash);
        fxList.push({
          mesh: slash,
          t: 0,
          dur: 0.55,
          update: (p) => {
            slash.scale.set(1 + p * 0.35, 1, 1);
            slash.material.opacity = 1 - p;
          },
        });
      });
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(impactPos) <= 7.2 + u.radius
        ) {
          if (!isVisualReplay)
            u.takeDamage(380 * powerMult, caster, true);
        }
      });
    } else if (hid === "garrick") {
      // OMNISLASH CATACLYSM: 6-hit invulnerable teleport slash blitz (no stun!)
      if (caster.isPlayer) {
        sfx.play("spell_laguna");
        triggerCameraShake(1.0);
      }
      for (let sIdx = 0; sIdx < 6; sIdx++) {
        scheduledEvents.push({
          delay: sIdx * 0.14,
          fn: () => {
            if (gameOver || caster.dead) return;
            const targets = units.filter(
              (u) =>
                !u.dead &&
                u.team !== caster.team &&
                u.type !== "tower" &&
                u.type !== "ancient" &&
                u.mesh.position.distanceTo(impactPos) <= 10.5 + u.radius,
            );
            const hitTgt = targets[sIdx % Math.max(1, targets.length)];
            const sx = hitTgt
              ? hitTgt.mesh.position.x + (Math.random() - 0.5) * 2.2
              : impactPos.x + (Math.random() - 0.5) * 4.0;
            const sz = hitTgt
              ? hitTgt.mesh.position.z + (Math.random() - 0.5) * 2.2
              : impactPos.z + (Math.random() - 0.5) * 4.0;
            caster.mesh.position.set(sx, getTerrainHeightAt(sx, sz), sz);
            if (isVisualReplay) {
              caster._netX = sx;
              caster._netZ = sz;
              caster._dashLockTimer = 0.22;
            }
            caster.swingAnim = 0.3;
            spawnMeleeSlashArc(
              caster.mesh.position,
              Math.random() * Math.PI * 2,
              5.2,
              0xfb923c,
              0.28,
            );
            if (hitTgt && !isVisualReplay)
              hitTgt.takeDamage(98 * powerMult, caster, true);
          },
        });
      }
    } else if (hid === "zephyros") {
      // THUNDERGOD'S WRATH: Global sky-lightning striking EVERY enemy hero on the map!
      if (caster.isPlayer) {
        sfx.play("spell_laguna");
        triggerCameraShake(1.0);
      }
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== caster.team &&
          (u.type === "hero" ||
            u.mesh.position.distanceTo(impactPos) <= 7.0 + u.radius)
        ) {
          spawnLightningBolt3D(
            new THREE.Vector3(u.mesh.position.x, 36, u.mesh.position.z),
            u.mesh.position,
            0xffffff,
            0x38bdf8,
            0.75,
          );
          if (!isVisualReplay)
            u.takeDamage(365 * powerMult, caster, true);
        }
      });
    } else if (hid === "solenne") {
      // SUPERNOVA PRISM ARRAY: 3 floating mirror prisms firing converging crossfire lasers!
      if (caster.isPlayer) {
        sfx.play("spell_laguna");
        triggerCameraShake(0.95);
      }
      const prismPts = [];
      for (let pIdx = 0; pIdx < 3; pIdx++) {
        const a = (pIdx / 3) * Math.PI * 2;
        const px = impactPos.x + Math.cos(a) * 6.8;
        const pz = impactPos.z + Math.sin(a) * 6.8;
        prismPts.push(
          new THREE.Vector3(px, getTerrainHeightAt(px, pz), pz),
        );
        spawnRisingSpire(px, pz, 5.2, 0.75, 0xf472b6, 1.45);
        spawnRailgunLaser3D(
          new THREE.Vector3(px, getTerrainHeightAt(px, pz) + 2.0, pz),
          impactPos,
          0xf472b6,
          0x38bdf8,
        );
      }
      scheduledEvents.push({
        delay: 0.45,
        fn: () => {
          if (gameOver) return;
          spawnParticleBurst(impactPos, 0xf472b6, 36);
          units.forEach((u) => {
            if (
              !u.dead &&
              u.team !== caster.team &&
              u.type !== "tower" &&
              u.type !== "ancient" &&
              u.mesh.position.distanceTo(impactPos) <= 7.8 + u.radius
            ) {
              if (!isVisualReplay) {
                u.takeDamage(420 * powerMult, caster, true);
                u.stunTimer = 1.5;
              }
            }
          });
        },
      });
    } else if (hid === "terrakor" || hid === "thalindor") {
      // ECHO SLAM / RAVAGE OF THE DEEP
      if (caster.isPlayer) {
        sfx.play("spell_orbital_meteor");
        triggerCameraShake(1.15);
      }
      const p = caster.mesh.position;
      const blastR = 13.0;
      const rCol = hid === "thalindor" ? 0x06b6d4 : 0x34d399;
      const rSec = hid === "thalindor" ? 0x38bdf8 : 0xfbbf24;
      spawnGroundRuneDecal(p.x, p.z, blastR, rCol, 2.2);
      spawnParticleBurst(p, rSec, 38);
      if (hid === "thalindor") {
        for (let g = 0; g < 9; g++) {
          const ga = (g / 9) * Math.PI * 2;
          spawnRisingSpire(
            p.x + Math.cos(ga) * 7.5,
            p.z + Math.sin(ga) * 7.5,
            4.8,
            0.72,
            0x06b6d4,
            1.15,
          );
        }
      }
      const nearbyFoes = units.filter(
        (u) =>
          !u.dead &&
          u.team !== caster.team &&
          u.type !== "tower" &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(p) <= blastR + u.radius,
      );
      const echoBonus = nearbyFoes.length * 58 * powerMult;
      nearbyFoes.forEach((u) => {
        if (!isVisualReplay) {
          u.takeDamage(245 * powerMult + echoBonus, caster, true);
          u.stunTimer = Math.max(
            u.stunTimer,
            hid === "thalindor" ? 1.9 : 1.65,
          );
        }
        spawnRisingSpire(
          u.mesh.position.x,
          u.mesh.position.z,
          4.0,
          0.58,
          rSec,
          0.95,
        );
      });
    } else {
      // Aurelius (Orbital Sunbeam), Malakor (Army of 3 Skeleton Wraiths), Dravenor (Summon Infernal Golem), Nyxia (7 World-Tree Spirits)
      if (caster.isPlayer) sfx.play("spell_orbital_meteor");
      const blastR = 7.8;
      const ultCol = hCfg.primaryHex || 0xfacc15;
      if (hid === "aurelius") {
        spawnPersistentZone({
          zoneType: "sunbeam",
          owner: caster,
          team: caster.team,
          x: impactPos.x,
          z: impactPos.z,
          radius: 7.8,
          duration: 3.0,
          colorHex: 0xfacc15,
          secondaryHex: 0xf59e0b,
          tickDmg: 130 * powerMult,
          allowStructures: true,
        });
        spawnFloatText(impactPos, "ORBITAL SUNBEAM!", "#facc15", 18);
      } else {
        const meteorCount = hid === "nyxia" ? 7 : 1;
        for (let mIdx = 0; mIdx < meteorCount; mIdx++) {
          const offA = (mIdx / Math.max(1, meteorCount)) * Math.PI * 2;
          const offR = mIdx === 0 ? 0 : 4.2;
          const mx = impactPos.x + Math.cos(offA) * offR;
          const mz = impactPos.z + Math.sin(offA) * offR;
          const meteorMesh = new THREE.Mesh(
            new THREE.DodecahedronGeometry(mIdx === 0 ? 2.1 : 1.25, 1),
            new THREE.MeshBasicMaterial({ color: ultCol }),
          );
          meteorMesh.position.set(mx, 32 + mIdx * 4, mz);
          scene.add(meteorMesh);
          fxList.push({
            mesh: meteorMesh,
            t: 0,
            dur: 0.3 + mIdx * 0.05,
            update: (p) => {
              meteorMesh.position.y = (32 + mIdx * 4) * (1 - p);
              meteorMesh.rotation.x += 0.25;
              meteorMesh.rotation.y += 0.32;
            },
          });
        }
        scheduledEvents.push({
          delay: 0.3,
          fn: () => {
            if (gameOver) return;
            if (caster.isPlayer) triggerCameraShake(1.05);
            spawnGroundRuneDecal(
              impactPos.x,
              impactPos.z,
              blastR,
              ultCol,
              2.2,
            );
            spawnParticleBurst(impactPos, ultCol, 38);
            units.forEach((u) => {
              if (
                !u.dead &&
                u.team !== caster.team &&
                u.type !== "tower" &&
                u.type !== "ancient" &&
                u.mesh.position.distanceTo(impactPos) <= blastR + u.radius
              ) {
                const dmg = 350 * powerMult;
                if (!isVisualReplay) {
                  u.takeDamage(dmg, caster);
                  if (hid === "nyxia")
                    caster.hp = Math.min(
                      caster.maxHp,
                      caster.hp + dmg * 0.3,
                    );
                  u.stunTimer = 1.55;
                }
              }
            });
            if (!isVisualReplay && hid === "malakor") {
              [-2.8, 0, 2.8].forEach((ox) => {
                spawnSummonedUnit(caster, {
                  name: "Skeleton Wraith",
                  subType: "melee",
                  x: THREE.MathUtils.clamp(
                    impactPos.x + ox,
                    -MAP_HALF + 4,
                    MAP_HALF - 4,
                  ),
                  z: impactPos.z,
                  maxHp: 560 * powerMult,
                  atkDamage: Math.round(58 * powerMult),
                  moveSpeed: 13.8,
                  duration: 18.0,
                  colorHex: 0x10b981,
                  scale: 1.15,
                });
              });
            } else if (!isVisualReplay && hid === "dravenor") {
              spawnSummonedUnit(caster, {
                name: "Chaotic Infernal Golem",
                subType: "siege",
                x: impactPos.x,
                z: impactPos.z,
                maxHp: 1450 * powerMult,
                atkDamage: Math.round(122 * powerMult),
                armor: 14,
                moveSpeed: 12.6,
                duration: 22.0,
                colorHex: 0xf97316,
                scale: 1.5,
              });
            }
          },
        });
      }
    }
  }

  if (!isVisualReplay && caster.heroCfg) {
    caster.spellCastCount = (caster.spellCastCount || 0) + 1;
    if (hid === "ignis") {
      caster.fierySoulStacks = Math.min(
        3,
        (caster.fierySoulStacks || 0) + 1,
      );
      caster.fierySoulTimer = 5.0;
      caster.blinkBuffTimer = Math.max(caster.blinkBuffTimer, 5.0);
      spawnFloatText(
        caster.mesh.position,
        `FIERY SOUL x${caster.fierySoulStacks}!`,
        "#f97316",
        13,
      );
    } else if (hid === "zephyros") {
      caster.staticOverloadReady = true;
    } else if (hid === "seraphina") {
      caster.lunarEmpowerReady = true;
    } else if (hid === "terrakor") {
      const p = caster.mesh.position;
      spawnShockwaveRing(p.x, p.z, 4.8, 0x34d399, 0.35);
      units.forEach((foe) => {
        if (
          !foe.dead &&
          foe.team !== caster.team &&
          foe.type !== "ancient" &&
          foe.mesh.position.distanceTo(p) <= 4.8 + foe.radius
        ) {
          foe.takeDamage(45 + caster.str * 1.4, caster, false);
          foe.stunTimer = Math.max(foe.stunTimer, 0.35);
        }
      });
    } else if (hid === "kaelthar" && caster.spellCastCount % 4 === 0) {
      caster.mana = Math.min(caster.maxMana, caster.mana + sk.mana * 0.4);
      ["Q", "W", "E"].forEach((ck) => {
        caster.cooldowns[ck] = Math.max(
          0,
          (caster.cooldowns[ck] || 0) - 1.2,
        );
      });
      spawnFloatText(
        caster.mesh.position,
        "TEMPORAL ECHO!",
        "#22d3ee",
        14,
      );
    }
  }
  if (caster.isPlayer && key === "R") {
    triggerCombatImpactFeel(0.032, 0.95, 0.65);
  }

  if (caster.isPlayer && primedSkill === key) {
    primedSkill = null;
    updatePrimedState();
  }
  return true;
}

