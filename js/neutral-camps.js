/***********************************************************************
 * 10. 12 ESCALATING NEUTRAL CAMPS (INCLUDING ANCIENT SANCTUMS), ROSHAN & APEX DRAGON
 ***********************************************************************/
let escalationTier = 1;
let nextEscalationTime = 60.0;
let radiantMegaCreeps = false;
let direMegaCreeps = false;

function getEscalationMults(tierOverride = escalationTier) {
  const t = Math.max(0, tierOverride - 1);
  const goldScale = 1 + t * 0.25;
  const xpScale = 1 + t * 0.28;
  return {
    hp: 1 + t * 0.28,
    dmg: 1 + t * 0.26,
    armor: t * 1.4,
    bounty: goldScale,
    goldBounty: goldScale,
    xpBounty: xpScale,
  };
}

const DRAGON_RANDOM_ZONES = [
  { x: 56, z: 56, region: "Eastern River Shallows" },
  { x: 92, z: 92, region: "Southeastern River Bend" },
  { x: -94, z: -94, region: "Northwestern River Bend" },
  { x: 24, z: 24, region: "Central River Crossing" },
  { x: -24, z: -24, region: "Upper River Rapids" },
  { x: -94, z: 16, region: "Radiant Emerald Glade" },
  { x: 94, z: -16, region: "Dire Crimson Flats" },
  { x: -16, z: 94, region: "Radiant Whispering Woods" },
  { x: 16, z: -94, region: "Dire Ashen Ridge" },
];
let lastDragonSpot = null;

function spawnElderDragonBoss() {
  if (elderDragonBoss && !elderDragonBoss.dead) return;
  const candidates = DRAGON_RANDOM_ZONES.filter((z) => {
    if (
      lastDragonSpot &&
      z.x === lastDragonSpot.x &&
      z.z === lastDragonSpot.z
    )
      return false;
    return !units.some(
      (u) =>
        !u.dead &&
        (u.type === "tower" || u.type === "ancient") &&
        Math.hypot(u.mesh.position.x - z.x, u.mesh.position.z - z.z) < 16,
    );
  });
  const pool = candidates.length > 0 ? candidates : DRAGON_RANDOM_ZONES;
  const spot = pool[Math.floor(Math.random() * pool.length)];
  lastDragonSpot = spot;

  const gy = getTerrainHeightAt(spot.x, spot.z);
  const m = getEscalationMults();
  const infMon = getInfinityMonsterMult();
  const infReward = infMon > 1 ? 1.65 : 1.0;
  const dragonBonusGold = Math.round(1200 * m.goldBounty * infReward);
  elderDragonBoss = new MobaEntity({
    name: `ELDER SKY-DRAGON (Tier ${escalationTier})`,
    team: "neutral",
    type: "dragon",
    subType: "dragon",
    x: spot.x,
    z: spot.z,
    maxHp: Math.round(7400 * m.hp * infMon),
    hpRegen: 26.0 * m.hp * infMon,
    atkDamage: Math.round(195 * m.dmg * infMon),
    atkRange: 10.5,
    atkCooldown: 1.05,
    moveSpeed: 11.4,
    armor: Math.round((20 + m.armor) * (infMon > 1 ? 1.35 : 1.0)),
    radius: 3.4,
    goldBounty: [
      Math.round(1150 * m.goldBounty * infReward),
      Math.round(1300 * m.goldBounty * infReward),
    ],
    xpBounty: Math.round(1250 * m.xpBounty * infReward),
  });
  elderDragonBoss.mesh.position.set(spot.x, gy + 24, spot.z);
  elderDragonBoss.dragonDescentTimer = 1.25;
  units.push(elderDragonBoss);
  document.getElementById("dragon-hud-badge").classList.remove("hidden");
  sfx.play("dragon_roar");
  setTimeout(() => {
    sfx.announceSpree(
      `An Elder Sky Dragon has descended upon the ${spot.region}!`,
      4,
    );
  }, 450);
  spawnOrbitalSkyBeam(spot.x, spot.z, 8.5, 0x38bdf8, 1.5);
  spawnShockwaveRing(spot.x, spot.z, 13.0, 0xfacc15, 0.9);
  triggerCameraShake(1.35);
  showBanner(
    "ELDER SKY-DRAGON APPEARS!",
    `Apex World Boss landed in the ${spot.region} (${spot.x}, ${spot.z}) • Slay it for Elder Dragon Soul & +${dragonBonusGold.toLocaleString()}g!`,
    "text-sky-300",
  );
}

function spawnRoshanBoss() {
  if (roshanBoss && !roshanBoss.dead && units.includes(roshanBoss))
    return;
  if (roshanBoss) {
    if (roshanBoss.mesh) scene.remove(roshanBoss.mesh);
    if (roshanBoss.bar && roshanBoss.bar.el) roshanBoss.bar.el.remove();
  }
  const m = getEscalationMults();
  const infMon = getInfinityMonsterMult();
  const infReward = infMon > 1 ? 1.65 : 1.0;
  roshanBoss = new MobaEntity({
    name: `ROSHAN (Tier ${escalationTier})`,
    team: "neutral",
    type: "boss",
    subType: "boss",
    x: -50,
    z: -50,
    maxHp: Math.round(6800 * m.hp * infMon),
    hpRegen: 26.0 * m.hp * infMon,
    atkDamage: Math.round(182 * m.dmg * infMon),
    atkRange: 4.8,
    atkCooldown: 1.1,
    moveSpeed: 10.2,
    armor: Math.round((20 + m.armor) * (infMon > 1 ? 1.35 : 1.0)),
    radius: 2.9,
    goldBounty: [
      Math.round(450 * m.goldBounty * infReward),
      Math.round(520 * m.goldBounty * infReward),
    ],
    xpBounty: Math.round(880 * m.xpBounty * infReward),
  });
  units.push(roshanBoss);
}

function spawnPPLabuGuardian(team) {
  if (ppLabuSpawned[team]) return;
  ppLabuSpawned[team] = true;
  const m = getEscalationMults();
  const infMon = getInfinityMonsterMult();
  const infReward = infMon > 1 ? 1.65 : 1.0;
  const isRad = team === "radiant";
  const spawnX = isRad ? -125 : 125;
  const spawnZ = isRad ? 125 : -125;
  const label = isRad ? "Radiant" : "Dire";

  const otherGuardHp = Math.round(7600 * m.hp * infMon);
  const otherGuardRegen = 28.0 * m.hp * infMon;
  const otherGuardArmor = Math.round(
    (22 + m.armor) * (infMon > 1 ? 1.35 : 1.0),
  );
  const kongAtk = Math.round(205 * m.dmg * infMon);
  const redmanAtk = Math.round(210 * m.dmg * infMon);

  const kong = new MobaEntity({
    name: `PP LABU • ${label.toUpperCase()} GUARDIAN (Tier ${escalationTier})`,
    team,
    type: "kong",
    subType: "kong",
    x: spawnX,
    z: spawnZ,
    maxHp: otherGuardHp,
    hpRegen: otherGuardRegen,
    atkDamage: kongAtk,
    atkRange: 5.4,
    atkCooldown: 1.02,
    moveSpeed: 11.6,
    armor: otherGuardArmor,
    radius: 3.3,
    goldBounty: [
      Math.round(1100 * m.goldBounty * infReward),
      Math.round(1250 * m.goldBounty * infReward),
    ],
    xpBounty: Math.round(1200 * m.xpBounty * infReward),
  });
  ppLabuGuardians[team] = kong;
  units.push(kong);

  const redmanX = spawnX + (isRad ? 4.5 : -4.5);
  const redmanZ = spawnZ + (isRad ? -4.5 : 4.5);
  const redMan = new MobaEntity({
    name: `RED MAN • ${label.toUpperCase()} GUARDIAN (Tier ${escalationTier})`,
    team,
    type: "redman",
    subType: "redman",
    x: redmanX,
    z: redmanZ,
    maxHp: otherGuardHp,
    hpRegen: otherGuardRegen,
    atkDamage: redmanAtk,
    atkRange: 5.8,
    atkCooldown: 0.98,
    moveSpeed: 11.8,
    armor: Math.round((23 + m.armor) * (infMon > 1 ? 1.35 : 1.0)),
    radius: 3.2,
    goldBounty: [
      Math.round(1100 * m.goldBounty * infReward),
      Math.round(1250 * m.goldBounty * infReward),
    ],
    xpBounty: Math.round(1200 * m.xpBounty * infReward),
  });
  redManGuardians[team] = redMan;
  units.push(redMan);

  let hasSneakyGolem = false;
  if (aiDifficulty === "infinity") {
    hasSneakyGolem = true;
    const golemX = isRad ? -89 : 89;
    const golemZ = isRad ? 89 : -89;
    const sneakyGolem = new MobaEntity({
      name: `SNEAKY GOLEM • ${label.toUpperCase()} COLOSSUS (Tier ${escalationTier})`,
      team,
      type: "sneakygolem",
      subType: "sneakygolem",
      x: golemX,
      z: golemZ,
      maxHp: Math.round(otherGuardHp * 8),
      hpRegen: otherGuardRegen * 2.0,
      atkDamage: Math.round(Math.max(kongAtk, redmanAtk) * 2),
      atkRange: 7.4,
      atkCooldown: 1.0,
      moveSpeed: 11.8,
      armor: Math.round(otherGuardArmor * 1.35),
      radius: 5.8,
      goldBounty: [
        Math.round(2200 * m.goldBounty * infReward),
        Math.round(2500 * m.goldBounty * infReward),
      ],
      xpBounty: Math.round(2400 * m.xpBounty * infReward),
    });
    sneakyGolem.golemSubduedAtOneHp = false;
    sneakyGolemGuardians[team] = sneakyGolem;
    units.push(sneakyGolem);
    spawnOrbitalSkyBeam(golemX, golemZ, 12.0, 0xff1493, 1.8);
  }

  const attackerLabel = isRad ? "Dire" : "Radiant";
  sfx.play("roshan_roar");
  if (hasSneakyGolem) {
    sfx.announceSpree(
      `All ${label} towers have fallen! ${attackerLabel} Mega Creeps march, and PP Labu, Red Man & the colossal Sneaky Golem awaken! Subdue Sneaky Golem to 1 HP to strike the ${label} Ancient!`,
      5,
    );
  } else {
    sfx.announceSpree(
      `All ${label} towers have fallen! ${attackerLabel} Mega Creeps are unleashed, and undying PP Labu & Red Man awaken to defend the ${label} Ancient!`,
      5,
    );
  }
  spawnOrbitalSkyBeam(
    spawnX,
    spawnZ,
    9.0,
    isRad ? 0x10b981 : 0xf43f5e,
    1.6,
  );
  spawnOrbitalSkyBeam(redmanX, redmanZ, 9.0, 0xef4444, 1.6);
  spawnShockwaveRing(spawnX, spawnZ, 14.0, 0xfacc15, 0.95);
  triggerCameraShake(1.25);
  showBanner(
    hasSneakyGolem
      ? `SNEAKY GOLEM, PP LABU & RED MAN AWAKEN!`
      : `PP LABU & RED MAN AWAKENS!`,
    hasSneakyGolem
      ? `Infinity Defense! Subdue the 2x Pink-Eyed Sneaky Golem to 1 HP before the ${label} Ancient can be damaged!`
      : `All ${label} towers fell! ${attackerLabel} Mega Creeps march while undying PP Labu & Red Man defend the ${label} Ancient!`,
    hasSneakyGolem
      ? "text-fuchsia-300"
      : isRad
        ? "text-emerald-300"
        : "text-rose-400",
  );
}

const _habitatTexCache = {};
function getNaturalClearingGroundTexture(biomeStyle) {
  if (_habitatTexCache[biomeStyle]) return _habitatTexCache[biomeStyle];
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const palettes = {
    woodland: {
      base: [58, 46, 34],
      mid: [44, 62, 38],
      accent: [78, 62, 42],
    },
    meadow: {
      base: [54, 68, 38],
      mid: [72, 60, 40],
      accent: [38, 82, 48],
    },
    swamp: {
      base: [36, 44, 34],
      mid: [48, 42, 30],
      accent: [28, 56, 44],
    },
    volcanic: {
      base: [42, 26, 28],
      mid: [58, 30, 26],
      accent: [28, 22, 24],
    },
    crag: { base: [52, 48, 46], mid: [68, 58, 48], accent: [40, 44, 48] },
    gothic: {
      base: [26, 18, 34],
      mid: [44, 20, 38],
      accent: [74, 18, 42],
    },
  };
  const pal = palettes[biomeStyle] || palettes.woodland;

  // Soft organic feathered clearing base
  const cx = size * 0.5,
    cy = size * 0.5;
  const grad = ctx.createRadialGradient(
    cx,
    cy,
    size * 0.14,
    cx,
    cy,
    size * 0.48,
  );
  grad.addColorStop(
    0.0,
    `rgba(${pal.base[0]}, ${pal.base[1]}, ${pal.base[2]}, 0.92)`,
  );
  grad.addColorStop(
    0.62,
    `rgba(${pal.mid[0]}, ${pal.mid[1]}, ${pal.mid[2]}, 0.72)`,
  );
  grad.addColorStop(
    1.0,
    `rgba(${pal.mid[0]}, ${pal.mid[1]}, ${pal.mid[2]}, 0.0)`,
  );
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Organic soil, fallen pine needles, moss patches & pebbles inside feathered radius
  for (let i = 0; i < 950; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.pow(Math.random(), 0.65) * (size * 0.44);
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    const fade = 1.0 - rad / (size * 0.46);
    const pick =
      i % 3 === 0 ? pal.accent : i % 2 === 0 ? pal.mid : pal.base;
    const jitter = ((i * 17) % 18) - 9;
    ctx.fillStyle = `rgba(${Math.max(0, pick[0] + jitter)}, ${Math.max(0, pick[1] + jitter)}, ${Math.max(0, pick[2] + jitter)}, ${(0.35 + fade * 0.45).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(
      px,
      py,
      2.5 + Math.random() * 5.5,
      1.8 + Math.random() * 4.0,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Subtle trampled animal path / paw-worn dirt ring in center
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const r = size * (0.16 + Math.random() * 0.14);
    ctx.fillStyle = `rgba(${pal.base[0] + 12}, ${pal.base[1] + 10}, ${pal.base[2] + 8}, 0.28)`;
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r,
      3 + Math.random() * 4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _habitatTexCache[biomeStyle] = tex;
  return tex;
}

function createMossyBoulderGeo(radius = 1.0, seed = 1) {
  const geo = new THREE.DodecahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i),
      vy = pos.getY(i),
      vz = pos.getZ(i);
    const n =
      1.0 +
      0.18 * Math.sin(vx * 3.1 + seed) * Math.cos(vz * 2.9 - vy * 2.4);
    pos.setXYZ(i, vx * n, vy * n, vz * n);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildNaturalCampHabitat(camp) {
  const g = new THREE.Group();
  const isAnc = !!camp.isAncient;
  const isDireSide = camp.x - camp.z > 0;
  const centerGy = getTerrainHeightAt(camp.x, camp.z);
  g.position.set(camp.x, 0, camp.z);

  const isVampCamp = camp.kind === "vampire";
  const biomeStyle = isVampCamp
    ? "gothic"
    : ["ancient_dragon"].includes(camp.kind)
      ? "volcanic"
      : ["troll", "basilisk"].includes(camp.kind)
        ? "swamp"
        : ["harpy", "wyvern", "golem"].includes(camp.kind)
          ? "crag"
          : ["centaur", "satyr"].includes(camp.kind)
            ? "meadow"
            : "woodland";

  // 1. Terrain-Conforming Natural Forest-Floor Clearing Patch (Feathered edges, zero artificial rings)
  const clearRadius = isVampCamp ? 11.4 : isAnc ? 7.6 : 6.4;
  const groundGeo = new THREE.CircleGeometry(clearRadius, 32);
  groundGeo.rotateX(-Math.PI / 2);
  const gPos = groundGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    const vx = gPos.getX(i);
    const vz = gPos.getZ(i);
    gPos.setY(i, getTerrainHeightAt(camp.x + vx, camp.z + vz) + 0.045);
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({
    map: getNaturalClearingGroundTexture(biomeStyle),
    transparent: true,
    depthWrite: false,
    roughness: 0.92,
    metalness: 0.02,
  });
  const groundPatch = new THREE.Mesh(groundGeo, groundMat);
  groundPatch.receiveShadow = true;
  g.add(groundPatch);

  // Shared Natural Materials
  const rockColor =
    biomeStyle === "volcanic"
      ? 0x292524
      : isDireSide
        ? 0x44403c
        : 0x57534e;
  const rockMat = new THREE.MeshStandardMaterial({
    color: rockColor,
    bumpMap: marblePBR.bumpMap,
    bumpScale: 0.28,
    roughness: 0.86,
    metalness: 0.08,
  });
  const mossMat = new THREE.MeshStandardMaterial({
    color: isDireSide ? 0x3f6212 : 0x15803d,
    roughness: 0.88,
    metalness: 0.02,
  });
  const logMat = new THREE.MeshStandardMaterial({
    map: barkPBR.map,
    bumpMap: barkPBR.bumpMap,
    bumpScale: 0.24,
    color: isDireSide ? 0x44362f : 0x6b4c35,
    roughness: 0.9,
  });
  const fernMat = new THREE.MeshStandardMaterial({
    color: isDireSide ? 0x4d7c0f : 0x16a34a,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });

  // Direction pointing outward into deep jungle (so dens/cliffs sit behind the camp and face inward toward paths)
  const outwardAng = Math.atan2(camp.z, camp.x);
  const foliageClusters = [];
  const animatedExtras = [];

  const placeAtLocal = (obj, lx, lz, yOff = 0) => {
    obj.position.set(
      lx,
      getTerrainHeightAt(camp.x + lx, camp.z + lz) + yOff,
      lz,
    );
    g.add(obj);
  };

  const addFernCluster = (lx, lz, scale = 1.0) => {
    const fernGrp = new THREE.Group();
    const fronds = 7;
    for (let f = 0; f < fronds; f++) {
      const a = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.18 * scale, 0.95 * scale, 4),
        fernMat,
      );
      blade.scale.set(1.3, 1.0, 0.24);
      blade.position.set(
        Math.cos(a) * 0.32 * scale,
        0.28 * scale,
        Math.sin(a) * 0.32 * scale,
      );
      blade.rotation.y = -a + Math.PI / 2;
      blade.rotation.x = 0.88;
      fernGrp.add(blade);
    }
    placeAtLocal(fernGrp, lx, lz, 0.02);
    foliageClusters.push({ mesh: fernGrp, phase: lx * 0.4 + lz * 0.3 });
  };

  const addFallenLog = (
    lx,
    lz,
    rotY,
    length = 3.4,
    radius = 0.34,
    withMushrooms = true,
  ) => {
    const logGrp = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.82, radius, length, 10),
      logMat,
    );
    trunk.rotation.z = Math.PI / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    logGrp.add(trunk);

    // Moss patch draped on top of log
    const mossStrip = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius * 0.55, length * 0.55, 4, 8),
      mossMat,
    );
    mossStrip.rotation.z = Math.PI / 2;
    mossStrip.position.set(0, radius * 0.52, 0);
    mossStrip.scale.set(1.0, 0.45, 0.85);
    logGrp.add(mossStrip);

    if (withMushrooms && !isDireSide) {
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        roughness: 0.6,
      });
      for (let m = 0; m < 3; m++) {
        const sh = new THREE.Mesh(
          new THREE.SphereGeometry(
            0.11 + (m % 2) * 0.04,
            8,
            6,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.55,
          ),
          capMat,
        );
        sh.position.set(
          -0.6 + m * 0.55,
          radius * 0.72,
          m % 2 === 0 ? 0.14 : -0.12,
        );
        logGrp.add(sh);
      }
    }
    logGrp.rotation.y = rotY;
    placeAtLocal(logGrp, lx, lz, radius * 0.58);
  };

  const addBoulderCluster = (lx, lz, mainScale = 1.0, mossy = true) => {
    const bGrp = new THREE.Group();
    const mainRock = new THREE.Mesh(
      createMossyBoulderGeo(1.15 * mainScale, lx + lz),
      rockMat,
    );
    mainRock.scale.set(1.25, 0.85, 1.05);
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    bGrp.add(mainRock);

    if (mossy && !isDireSide) {
      const mossCap = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.95 * mainScale,
          10,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.45,
        ),
        mossMat,
      );
      mossCap.scale.set(1.22, 0.55, 1.02);
      mossCap.position.y = 0.34 * mainScale;
      bGrp.add(mossCap);
    }

    const sideRock = new THREE.Mesh(
      createMossyBoulderGeo(0.68 * mainScale, lx * 2),
      rockMat,
    );
    sideRock.position.set(
      0.95 * mainScale,
      -0.18 * mainScale,
      0.55 * mainScale,
    );
    sideRock.castShadow = true;
    bGrp.add(sideRock);

    placeAtLocal(bGrp, lx, lz, 0.42 * mainScale);
  };

  // 2. Build Biome-Specific Natural Habitat Features
  if (
    camp.kind === "wolf" ||
    camp.kind === "werewolf" ||
    camp.kind === "hellbear"
  ) {
    // Rocky Woodland Cave Den / Grotto at back edge of clearing
    const denDist = 5.4;
    const dx = Math.cos(outwardAng) * denDist;
    const dz = Math.sin(outwardAng) * denDist;
    const denGrp = new THREE.Group();

    // Dark shadowed cave mouth interior
    const caveHollow = new THREE.Mesh(
      new THREE.SphereGeometry(
        1.75,
        14,
        12,
        0,
        Math.PI,
        0,
        Math.PI * 0.55,
      ),
      new THREE.MeshBasicMaterial({ color: 0x090b10 }),
    );
    caveHollow.rotation.y = -outwardAng - Math.PI / 2;
    caveHollow.position.y = 0.05;
    denGrp.add(caveHollow);

    // Arching craggy boulders forming the natural cave roof & flanks
    [
      { offA: -0.34, r: 1.55, y: 0.75, sc: 1.25 },
      { offA: 0.34, r: 1.55, y: 0.75, sc: 1.25 },
      { offA: 0.0, r: 1.35, y: 1.75, sc: 1.35 },
      { offA: -0.52, r: 2.1, y: 0.42, sc: 0.95 },
      { offA: 0.52, r: 2.1, y: 0.42, sc: 0.95 },
    ].forEach((b, idx) => {
      const rock = new THREE.Mesh(
        createMossyBoulderGeo(b.sc, idx + camp.id),
        rockMat,
      );
      rock.scale.set(1.25, 0.92, 1.15);
      rock.position.set(
        Math.cos(outwardAng + b.offA) * (b.r - 1.4),
        b.y,
        Math.sin(outwardAng + b.offA) * (b.r - 1.4),
      );
      rock.castShadow = true;
      denGrp.add(rock);
    });
    placeAtLocal(denGrp, dx, dz, 0);

    // Fallen timber logs & woodland ferns framing the clearing
    addFallenLog(
      Math.cos(outwardAng + 1.35) * 4.8,
      Math.sin(outwardAng + 1.35) * 4.8,
      outwardAng + 0.5,
      3.6,
      0.34,
    );
    addFallenLog(
      Math.cos(outwardAng - 1.45) * 5.0,
      Math.sin(outwardAng - 1.45) * 5.0,
      outwardAng - 0.6,
      3.0,
      0.28,
    );
    for (let f = 0; f < 6; f++) {
      const fa = outwardAng + (f - 2.5) * 0.55;
      addFernCluster(
        Math.cos(fa) * 5.3,
        Math.sin(fa) * 5.3,
        0.9 + (f % 3) * 0.2,
      );
    }
  } else if (camp.kind === "satyr" || camp.kind === "behemoth") {
    // Lush Sylvan Grove, Gnarled Roots & Woodland Mushroom Fairy-Ring
    const rootCount = camp.isAncient ? 4 : 3;
    for (let r = 0; r < rootCount; r++) {
      const ra = outwardAng + (r - (rootCount - 1) * 0.5) * 0.85;
      const rx = Math.cos(ra) * 5.2;
      const rz = Math.sin(ra) * 5.2;
      const archCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rx * 1.18, -0.2, rz * 1.18),
        new THREE.Vector3(rx * 0.98, 1.45, rz * 0.98),
        new THREE.Vector3(rx * 0.78, -0.2, rz * 0.78),
      ]);
      const rootMesh = new THREE.Mesh(
        new THREE.TubeGeometry(archCurve, 14, 0.28, 7, false),
        logMat,
      );
      rootMesh.castShadow = true;
      g.add(rootMesh);
    }

    // Natural woodland mushroom ring (spotted red/gold toadstools)
    const capColor = camp.isAncient ? 0x38bdf8 : 0xe11d48;
    const shroomCapMat = new THREE.MeshStandardMaterial({
      color: capColor,
      emissive: capColor,
      emissiveIntensity: camp.isAncient ? 0.65 : 0.18,
      roughness: 0.45,
    });
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.75,
    });
    for (let m = 0; m < 9; m++) {
      const ma = (m / 9) * Math.PI * 2 + 0.3;
      const mr = 3.6 + (m % 3) * 0.55;
      const mx = Math.cos(ma) * mr;
      const mz = Math.sin(ma) * mr;
      const sc = 0.75 + (m % 3) * 0.28;
      const shGrp = new THREE.Group();
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * sc, 0.12 * sc, 0.38 * sc, 7),
        stemMat,
      );
      stem.position.y = 0.19 * sc;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.28 * sc,
          10,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.55,
        ),
        shroomCapMat,
      );
      cap.position.y = 0.34 * sc;
      shGrp.add(stem, cap);
      placeAtLocal(shGrp, mx, mz, 0);
    }

    addFallenLog(
      Math.cos(outwardAng + 1.5) * 4.9,
      Math.sin(outwardAng + 1.5) * 4.9,
      outwardAng + 0.2,
      3.8,
      0.32,
    );
    for (let f = 0; f < 7; f++) {
      const fa = (f / 7) * Math.PI * 2;
      addFernCluster(
        Math.cos(fa) * 5.2,
        Math.sin(fa) * 5.2,
        0.95 + (f % 2) * 0.25,
      );
    }
  } else if (camp.kind === "centaur" || camp.kind === "golem") {
    // Highland Boulder Outcrop / Natural Granite Quarry with Embedded Raw Quartz Seams
    addBoulderCluster(
      Math.cos(outwardAng) * 5.4,
      Math.sin(outwardAng) * 5.4,
      camp.isAncient ? 1.45 : 1.18,
      true,
    );
    addBoulderCluster(
      Math.cos(outwardAng + 0.85) * 5.1,
      Math.sin(outwardAng + 0.85) * 5.1,
      0.95,
      true,
    );
    addBoulderCluster(
      Math.cos(outwardAng - 0.95) * 5.2,
      Math.sin(outwardAng - 0.95) * 5.2,
      0.88,
      true,
    );

    if (camp.isAncient) {
      // Raw natural amber-quartz crystals protruding directly out of the granite boulders
      const rawCrystalMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.75,
        roughness: 0.25,
        metalness: 0.2,
      });
      for (let c = 0; c < 5; c++) {
        const ca = outwardAng + (c - 2) * 0.32;
        const cr = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 0.95, 5),
          rawCrystalMat,
        );
        cr.rotation.z = c % 2 === 0 ? 0.45 : -0.45;
        cr.rotation.x = 0.35;
        placeAtLocal(cr, Math.cos(ca) * 4.6, Math.sin(ca) * 4.6, 0.65);
      }
    } else {
      // Natural spring watering hole lined with river pebbles
      const pondX = Math.cos(outwardAng - 1.55) * 3.8;
      const pondZ = Math.sin(outwardAng - 1.55) * 3.8;
      const pond = new THREE.Mesh(
        new THREE.CircleGeometry(1.55, 20),
        new THREE.MeshStandardMaterial({
          color: 0x0e7490,
          roughness: 0.15,
          metalness: 0.4,
        }),
      );
      pond.rotation.x = -Math.PI / 2;
      placeAtLocal(pond, pondX, pondZ, 0.06);
    }

    for (let f = 0; f < 5; f++) {
      const fa = outwardAng + 1.4 + f * 0.65;
      addFernCluster(Math.cos(fa) * 5.0, Math.sin(fa) * 5.0, 0.95);
    }
  } else if (camp.kind === "troll" || camp.kind === "basilisk") {
    // Murky Swamp Bog / Emerald Mineral Spring with Reeds, Driftwood & Smoldering Campfire
    const poolX = Math.cos(outwardAng + 0.45) * 3.6;
    const poolZ = Math.sin(outwardAng + 0.45) * 3.6;
    const poolCol = camp.kind === "basilisk" ? 0x15803d : 0x1e3a2f;
    const poolEmissive = camp.kind === "basilisk" ? 0x16a34a : 0x000000;
    const bogPool = new THREE.Mesh(
      new THREE.CircleGeometry(camp.isAncient ? 2.2 : 1.75, 22),
      new THREE.MeshStandardMaterial({
        color: poolCol,
        emissive: poolEmissive,
        emissiveIntensity: camp.kind === "basilisk" ? 0.55 : 0.0,
        roughness: 0.18,
        metalness: 0.35,
      }),
    );
    bogPool.rotation.x = -Math.PI / 2;
    placeAtLocal(bogPool, poolX, poolZ, 0.06);

    // Cattail reeds clustering around the bog bank
    const reedMat = new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      roughness: 0.75,
    });
    for (let r = 0; r < 10; r++) {
      const ra = (r / 10) * Math.PI * 2;
      const rx = poolX + Math.cos(ra) * 1.85;
      const rz = poolZ + Math.sin(ra) * 1.85;
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.06, 1.35 + (r % 3) * 0.25, 5),
        reedMat,
      );
      stalk.rotation.z = Math.cos(ra) * -0.15;
      placeAtLocal(stalk, rx, rz, 0.65);
    }

    addFallenLog(
      Math.cos(outwardAng - 1.1) * 4.6,
      Math.sin(outwardAng - 1.1) * 4.6,
      outwardAng + 0.7,
      3.6,
      0.32,
      false,
    );
    addBoulderCluster(
      Math.cos(outwardAng - 0.35) * 5.3,
      Math.sin(outwardAng - 0.35) * 5.3,
      1.05,
      false,
    );

    if (camp.kind === "troll") {
      // Small rustic stone-ringed campfire
      const fireX = Math.cos(outwardAng - 0.35) * 3.2;
      const fireZ = Math.sin(outwardAng - 0.35) * 3.2;
      for (let s = 0; s < 7; s++) {
        const sa = (s / 7) * Math.PI * 2;
        const st = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.22, 0),
          rockMat,
        );
        placeAtLocal(
          st,
          fireX + Math.cos(sa) * 0.52,
          fireZ + Math.sin(sa) * 0.52,
          0.12,
        );
      }
      const emberFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.65, 6),
        new THREE.MeshStandardMaterial({
          color: 0xf97316,
          emissive: 0xea580c,
          emissiveIntensity: 1.5,
        }),
      );
      placeAtLocal(emberFlame, fireX, fireZ, 0.34);
      animatedExtras.push({
        mesh: emberFlame,
        baseY: emberFlame.position.y,
        kind: "flame",
      });
    }
  } else if (camp.kind === "vampire") {
    // Large Outer-Forest River-Edge Vampire Sanctuary: Obsidian Menhirs, Gothic Ruin Archway, Crimson Blood-Brazier & Drifting Ground Fog
    const archDist = 8.4;
    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x181424,
      roughness: 0.72,
      metalness: 0.25,
    });
    const crimsonStoneMat = new THREE.MeshStandardMaterial({
      color: 0x881337,
      emissive: 0x4c0519,
      emissiveIntensity: 0.65,
      roughness: 0.45,
    });

    [-2.2, 2.2].forEach((sideOff) => {
      const px =
        Math.cos(outwardAng) * archDist - Math.sin(outwardAng) * sideOff;
      const pz =
        Math.sin(outwardAng) * archDist + Math.cos(outwardAng) * sideOff;
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.78, 5.4, 6),
        obsidianMat,
      );
      pillar.castShadow = true;
      placeAtLocal(pillar, px, pz, 2.7);
      const cap = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62, 0),
        crimsonStoneMat,
      );
      placeAtLocal(cap, px, pz, 5.65);
    });
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.72, 1.05),
      obsidianMat,
    );
    lintel.rotation.y = -outwardAng + Math.PI * 0.5;
    placeAtLocal(
      lintel,
      Math.cos(outwardAng) * archDist,
      Math.sin(outwardAng) * archDist,
      5.4,
    );

    // Ring of 7 weathered obsidian standing stones & mossy boulders around the large clearing
    for (let s = 0; s < 7; s++) {
      const sa = outwardAng + (s - 3) * 0.62;
      const sr = 9.0 + (s % 2) * 1.1;
      const sx = Math.cos(sa) * sr;
      const sz = Math.sin(sa) * sr;
      addBoulderCluster(sx, sz, 1.25 + (s % 3) * 0.2, false);
    }

    // Ornate Crimson Blood-Fountain / Brazier at camp center
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 0.95, 0.85, 10),
      obsidianMat,
    );
    placeAtLocal(bowl, 0, 0, 0.42);
    const bloodOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62, 1),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 1.65,
        roughness: 0.2,
      }),
    );
    placeAtLocal(bloodOrb, 0, 0, 1.45);
    animatedExtras.push({
      mesh: bloodOrb,
      baseY: bloodOrb.position.y,
      kind: "vamp_orb",
    });

    // 4 Wrought-Iron Gothic Crimson Candelabras framing the Vampire Sanctuary (fog removed for crisp visibility)
    const rubyFlameMat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xe11d48,
      emissiveIntensity: 1.75,
      roughness: 0.2,
    });
    for (let c = 0; c < 4; c++) {
      const ca = outwardAng + (c - 1.5) * 0.95;
      const cr = 6.2;
      const cx = Math.cos(ca) * cr;
      const cz = Math.sin(ca) * cr;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.18, 2.2, 6),
        obsidianMat,
      );
      placeAtLocal(post, cx, cz, 1.1);
      const brazierFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.52, 6),
        rubyFlameMat,
      );
      placeAtLocal(brazierFlame, cx, cz, 2.42);
      animatedExtras.push({
        mesh: brazierFlame,
        baseY: brazierFlame.position.y,
        kind: "flame",
      });
    }
  } else {
    // Harpy / Wyvern / Ancient Dragon: Craggy Cliff Outcrop, Twig Eyrie Nests & Scorched Caldera Rocks
    const cliffDist = 5.4;
    const cx = Math.cos(outwardAng) * cliffDist;
    const cz = Math.sin(outwardAng) * cliffDist;
    addBoulderCluster(cx, cz, camp.isAncient ? 1.55 : 1.22, false);
    addBoulderCluster(
      Math.cos(outwardAng + 0.75) * 5.2,
      Math.sin(outwardAng + 0.75) * 5.2,
      1.05,
      false,
    );
    addBoulderCluster(
      Math.cos(outwardAng - 0.8) * 5.0,
      Math.sin(outwardAng - 0.8) * 5.0,
      0.95,
      false,
    );

    if (camp.kind === "harpy" || camp.kind === "wyvern") {
      // Woven twig & feather cliffside eyrie nest
      const nestX = Math.cos(outwardAng - 0.15) * 4.2;
      const nestZ = Math.sin(outwardAng - 0.15) * 4.2;
      const nestGrp = new THREE.Group();
      const nestRim = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.28, 7, 16),
        logMat,
      );
      nestRim.rotation.x = Math.PI / 2;
      const nestFloor = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 0.85, 0.22, 12),
        new THREE.MeshStandardMaterial({
          color: 0x78350f,
          roughness: 0.9,
        }),
      );
      nestGrp.add(nestRim, nestFloor);
      // 3 speckled eggs inside the nest
      const eggMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        roughness: 0.4,
      });
      [
        [-0.28, -0.15],
        [0.26, -0.12],
        [0.0, 0.28],
      ].forEach(([ex, ez]) => {
        const egg = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 10, 10),
          eggMat,
        );
        egg.scale.set(0.85, 1.25, 0.85);
        egg.position.set(ex, 0.22, ez);
        nestGrp.add(egg);
      });
      placeAtLocal(nestGrp, nestX, nestZ, 0.22);
    } else {
      // Ancient Dragon: Natural volcanic magma fissures & charred deadwood
      const lavaMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 1.25,
      });
      for (let v = 0; v < 4; v++) {
        const va = outwardAng + (v - 1.5) * 0.55;
        const seam = new THREE.Mesh(
          new THREE.PlaneGeometry(0.28, 2.6),
          lavaMat,
        );
        seam.rotation.x = -Math.PI / 2;
        seam.rotation.z = va;
        placeAtLocal(seam, Math.cos(va) * 3.4, Math.sin(va) * 3.4, 0.06);
      }
      addFallenLog(
        Math.cos(outwardAng + 1.45) * 4.8,
        Math.sin(outwardAng + 1.45) * 4.8,
        outwardAng + 0.3,
        3.4,
        0.3,
        false,
      );
    }
  }

  scene.add(g);
  camp.altarMesh = g;
  camp.habitatParts = { foliageClusters, animatedExtras };
}

function setupNeutralCamps() {
  neutralCamps.forEach((c) => {
    if (c.altarMesh) {
      scene.remove(c.altarMesh);
      disposeObject3D(c.altarMesh);
    }
  });
  neutralCamps = [
    // 11 Radiant Jungle & Riverbank Camps spread across the expanded 380x380 arena
    {
      id: 1,
      name: "Radiant West-Woods Wolf Pack",
      kind: "wolf",
      isAncient: false,
      x: -158,
      z: 56,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 2,
      name: "Radiant River-Flank Satyrs",
      kind: "satyr",
      isAncient: false,
      x: -120,
      z: 46,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 3,
      name: "Radiant Deep Forest Centaurs",
      kind: "centaur",
      isAncient: false,
      x: -164,
      z: 10,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 4,
      name: "Radiant South-Woods Hellbears",
      kind: "hellbear",
      isAncient: false,
      x: -56,
      z: 158,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 5,
      name: "Radiant Ancient Sanctuary West",
      kind: "golem",
      isAncient: true,
      x: -144,
      z: -12,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 6,
      name: "Radiant Ancient Sanctuary South",
      kind: "behemoth",
      isAncient: true,
      x: -10,
      z: 164,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 13,
      name: "Radiant Mid-Flank Timber Wolves",
      kind: "wolf",
      isAncient: false,
      x: -84,
      z: 22,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 14,
      name: "Radiant East-Flank Satyr Glade",
      kind: "satyr",
      isAncient: false,
      x: -24,
      z: 86,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 15,
      name: "Radiant Inner-Woods Dark Trolls",
      kind: "troll",
      isAncient: false,
      x: -108,
      z: 66,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 16,
      name: "Radiant Northwest Ridge Harpies",
      kind: "harpy",
      isAncient: false,
      x: -124,
      z: -6,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 17,
      name: "Radiant Far-North Frost Wyverns",
      kind: "wyvern",
      isAncient: true,
      x: -94,
      z: -64,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },

    // 11 Dire Jungle & Riverbank Camps spread across the expanded 380x380 arena
    {
      id: 7,
      name: "Dire East-Woods Harpies",
      kind: "harpy",
      isAncient: false,
      x: 158,
      z: -56,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 8,
      name: "Dire River-Flank Dark Trolls",
      kind: "troll",
      isAncient: false,
      x: 120,
      z: -46,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 9,
      name: "Dire Deep Forest Basilisks",
      kind: "basilisk",
      isAncient: true,
      x: 164,
      z: -10,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 10,
      name: "Dire North-Woods Hellbears",
      kind: "hellbear",
      isAncient: false,
      x: 56,
      z: -158,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 11,
      name: "Dire Ancient Sanctuary East",
      kind: "ancient_dragon",
      isAncient: true,
      x: 144,
      z: 12,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 12,
      name: "Dire Ancient Sanctuary North",
      kind: "wyvern",
      isAncient: true,
      x: 10,
      z: -164,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 18,
      name: "Dire Mid-Flank Shadow Wolves",
      kind: "wolf",
      isAncient: false,
      x: 84,
      z: -22,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 19,
      name: "Dire West-Flank Satyr Hollow",
      kind: "satyr",
      isAncient: false,
      x: 24,
      z: -86,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 20,
      name: "Dire Inner-Ash Centaur Warband",
      kind: "centaur",
      isAncient: false,
      x: 108,
      z: -66,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 21,
      name: "Dire Southeast Crag Hellbears",
      kind: "hellbear",
      isAncient: false,
      x: 124,
      z: 6,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
    {
      id: 22,
      name: "Dire Far-South Granite Sanctum",
      kind: "golem",
      isAncient: true,
      x: 94,
      z: 64,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },

    // Single Radiant-Forest Vampire Coven placed at the marked map square (-158, -50)
    {
      id: 23,
      name: "Radiant West-Woods Vampire Coven",
      kind: "vampire",
      isAncient: true,
      isNightOnly: true,
      x: -158,
      z: -50,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },

    // Single Symmetrical Dire-Forest Bloodmoon Werewolf Den at (158, 50)
    {
      id: 24,
      name: "Dire East-Woods Bloodmoon Werewolves",
      kind: "werewolf",
      isAncient: true,
      isNightOnly: true,
      x: 158,
      z: 50,
      respawnTimer: 0,
      alive: false,
      altarMesh: null,
    },
  ];

  neutralCamps.forEach((camp) => {
    buildNaturalCampHabitat(camp);
    spawnCampCreeps(camp);
  });
}

function spawnCampCreeps(camp) {
  camp.alive = true;
  const m = getEscalationMults();
  const infMon = getInfinityMonsterMult();
  const infReward = infMon > 1 ? 1.65 : 1.0;
  const makeMob = (cfg) =>
    new MobaEntity({
      team: "neutral",
      type: "neutral",
      camp,
      isAncientNeutral: !!camp.isAncient,
      ...cfg,
      maxHp: Math.round(cfg.maxHp * m.hp * infMon),
      hpRegen: (cfg.hpRegen || 3.0) * infMon,
      atkDamage: Math.round(cfg.atkDamage * m.dmg * infMon),
      armor: Math.round(
        ((cfg.armor || 4) + m.armor) * (infMon > 1 ? 1.35 : 1.0),
      ),
      goldBounty: [
        Math.round(cfg.goldBounty[0] * m.goldBounty * infReward),
        Math.round(cfg.goldBounty[1] * m.goldBounty * infReward),
      ],
      xpBounty: Math.round(cfg.xpBounty * m.xpBounty * infReward),
    });

  if (camp.kind === "wolf") {
    [
      [-1.6, -1.2],
      [1.6, -1.2],
      [0, 1.6],
    ].forEach(([ox, oz], idx) => {
      units.push(
        makeMob({
          name: idx === 2 ? "Alpha Dire Wolf" : "Dire Wolf",
          subType: "wolf",
          x: camp.x + ox,
          z: camp.z + oz,
          maxHp: idx === 2 ? 780 : 490,
          hpRegen: 3.5,
          atkDamage: idx === 2 ? 64 : 42,
          atkRange: 3.1,
          atkCooldown: 1.0,
          moveSpeed: 10.8,
          armor: 4,
          radius: 1.05,
          goldBounty: idx === 2 ? [80, 98] : [48, 60],
          xpBounty: idx === 2 ? 115 : 75,
        }),
      );
    });
  } else if (camp.kind === "werewolf") {
    const halfPhase = DAY_CYCLE_DURATION * 0.5;
    const nightProg = isNightTime
      ? THREE.MathUtils.clamp(
          (cycleClock - halfPhase) / DAY_CYCLE_DURATION,
          0,
          1,
        )
      : 1.0;
    if (!isNightTime || nightProg >= 0.88) {
      camp.alive = false;
      return;
    }
    camp.leaderSlain = false;
    const wolfPack = [
      {
        ox: 0.0,
        oz: 0.0,
        name: "Alpha Moonfang Werewolf",
        isMiniBoss: true,
        leaderBonusType: "wolf_movespeed",
        maxHp: 2550,
        dmg: 148,
        rad: 1.65,
        gold: [265, 320],
        xp: 380,
      },
      {
        ox: -3.2,
        oz: -2.4,
        name: "Dire Alpha Werewolf",
        maxHp: 1750,
        dmg: 112,
        rad: 1.35,
        gold: [185, 225],
        xp: 265,
      },
      {
        ox: 3.4,
        oz: -1.8,
        name: "Muscular Dire Ravager",
        maxHp: 1280,
        dmg: 88,
        rad: 1.22,
        gold: [135, 165],
        xp: 195,
      },
      {
        ox: 0.4,
        oz: 3.6,
        name: "Bloodmoon Lycan",
        maxHp: 1280,
        dmg: 88,
        rad: 1.22,
        gold: [135, 165],
        xp: 195,
      },
    ];
    wolfPack.forEach((wp) => {
      const sx = camp.x + wp.ox;
      const sz = camp.z + wp.oz;
      if (isNearAnyStandingTower(sx, sz, VAMPIRE_TOWER_SAFE_DIST)) return;
      const w = makeMob({
        name: wp.name,
        type: "werewolf",
        subType: "werewolf",
        isMiniBoss: !!wp.isMiniBoss,
        leaderBonusType: wp.leaderBonusType || null,
        x: sx,
        z: sz,
        maxHp: wp.maxHp,
        hpRegen: wp.isMiniBoss ? 12.0 : 8.5,
        atkDamage: wp.dmg,
        atkRange: wp.isMiniBoss ? 4.0 : 3.6,
        atkCooldown: wp.isMiniBoss ? 0.86 : 0.92,
        moveSpeed: wp.isMiniBoss ? 12.8 : 12.2,
        armor: wp.isMiniBoss ? 11 : 8,
        radius: wp.rad,
        goldBounty: wp.gold,
        xpBounty: wp.xp,
      });
      w.type = "werewolf";
      w.homePos.set(camp.x, 0, camp.z);
      w.roamTarget = pickOuterEdgeVampirePoint(camp, sx, sz);
      w.roamPauseTimer = 0.3 + Math.random() * 0.8;
      w.vampPulseCd = 3.0;
      spawnParticleBurst(w.mesh.position, 0xd97706, 14);
      spawnShockwaveRing(sx, sz, 4.0, 0xf59e0b, 0.55);
      units.push(w);
    });
  } else if (camp.kind === "satyr") {
    [
      [-1.6, -1.2],
      [1.6, -1.2],
      [0, 1.6],
    ].forEach(([ox, oz], idx) => {
      units.push(
        makeMob({
          name: idx === 2 ? "Satyr Soulstealer" : "Satyr Trickster",
          subType: "satyr",
          x: camp.x + ox,
          z: camp.z + oz,
          maxHp: idx === 2 ? 800 : 500,
          hpRegen: 3.0,
          atkDamage: idx === 2 ? 62 : 40,
          atkRange: 3.2,
          atkCooldown: 1.1,
          moveSpeed: 10.0,
          armor: 4,
          radius: 1.0,
          goldBounty: idx === 2 ? [82, 100] : [48, 62],
          xpBounty: idx === 2 ? 118 : 78,
        }),
      );
    });
  } else if (camp.kind === "troll") {
    [
      [-1.6, 0],
      [1.6, 0],
    ].forEach(([ox, oz], idx) => {
      units.push(
        makeMob({
          name: idx === 0 ? "Dark Troll Warlord" : "Dark Troll Priest",
          subType: "troll",
          x: camp.x + ox,
          z: camp.z + oz,
          maxHp: idx === 0 ? 1020 : 620,
          hpRegen: 4.5,
          atkDamage: idx === 0 ? 74 : 46,
          atkRange: 8.5,
          atkCooldown: 1.08,
          moveSpeed: 10.2,
          armor: 5,
          radius: 1.2,
          goldBounty: idx === 0 ? [112, 136] : [60, 74],
          xpBounty: idx === 0 ? 155 : 92,
        }),
      );
    });
  } else if (camp.kind === "centaur") {
    units.push(
      makeMob({
        name: "Centaur Conqueror",
        subType: "centaur",
        x: camp.x - 1.2,
        z: camp.z,
        maxHp: 1240,
        hpRegen: 5.0,
        atkDamage: 84,
        atkRange: 3.3,
        atkCooldown: 1.18,
        moveSpeed: 9.8,
        armor: 6,
        radius: 1.45,
        goldBounty: [125, 150],
        xpBounty: 170,
      }),
    );
    units.push(
      makeMob({
        name: "Centaur Courser",
        subType: "satyr",
        x: camp.x + 1.8,
        z: camp.z + 1.0,
        maxHp: 580,
        hpRegen: 3.0,
        atkDamage: 44,
        atkRange: 2.8,
        atkCooldown: 1.12,
        moveSpeed: 10.4,
        armor: 4,
        radius: 0.95,
        goldBounty: [52, 65],
        xpBounty: 82,
      }),
    );
  } else if (camp.kind === "hellbear") {
    units.push(
      makeMob({
        name: "Hellbear Smasher",
        subType: "hellbear",
        x: camp.x - 1.0,
        z: camp.z,
        maxHp: 1320,
        hpRegen: 5.0,
        atkDamage: 90,
        atkRange: 3.3,
        atkCooldown: 1.15,
        moveSpeed: 9.8,
        armor: 6,
        radius: 1.45,
        goldBounty: [130, 156],
        xpBounty: 178,
      }),
    );
    units.push(
      makeMob({
        name: "Hellbear Bruiser",
        subType: "satyr",
        x: camp.x + 1.8,
        z: camp.z - 1.0,
        maxHp: 640,
        hpRegen: 3.0,
        atkDamage: 48,
        atkRange: 2.8,
        atkCooldown: 1.12,
        moveSpeed: 10.0,
        armor: 4,
        radius: 1.0,
        goldBounty: [56, 70],
        xpBounty: 86,
      }),
    );
  } else if (camp.kind === "harpy") {
    [
      [-1.6, 0],
      [1.6, 0],
    ].forEach(([ox, oz], idx) => {
      units.push(
        makeMob({
          name: idx === 0 ? "Harpy Stormcrafter" : "Harpy Scout",
          subType: "harpy",
          x: camp.x + ox,
          z: camp.z + oz,
          maxHp: idx === 0 ? 940 : 580,
          hpRegen: 4.0,
          atkDamage: idx === 0 ? 74 : 46,
          atkRange: 8.5,
          atkCooldown: 1.08,
          moveSpeed: 10.6,
          armor: 5,
          radius: 1.15,
          goldBounty: idx === 0 ? [105, 128] : [56, 68],
          xpBounty: idx === 0 ? 148 : 84,
        }),
      );
    });
  } else if (camp.kind === "ancient_dragon") {
    units.push(
      makeMob({
        name: "Ancient Black Dragon",
        subType: "ancient_dragon",
        x: camp.x - 1.2,
        z: camp.z,
        maxHp: 2350,
        hpRegen: 10.0,
        atkDamage: 142,
        atkRange: 9.2,
        atkCooldown: 1.15,
        moveSpeed: 10.0,
        armor: 13,
        radius: 1.8,
        goldBounty: [240, 290],
        xpBounty: 340,
      }),
    );
    units.push(
      makeMob({
        name: "Ancient Flame Drake",
        subType: "wyvern",
        x: camp.x + 2.2,
        z: camp.z + 1.2,
        maxHp: 1120,
        hpRegen: 5.5,
        atkDamage: 84,
        atkRange: 7.5,
        atkCooldown: 1.15,
        moveSpeed: 10.2,
        armor: 8,
        radius: 1.3,
        goldBounty: [110, 135],
        xpBounty: 165,
      }),
    );
  } else if (camp.kind === "golem") {
    units.push(
      makeMob({
        name: "Ancient Granite Golem",
        subType: "golem",
        x: camp.x - 1.2,
        z: camp.z,
        maxHp: 2150,
        hpRegen: 9.0,
        atkDamage: 128,
        atkRange: 3.5,
        atkCooldown: 1.25,
        moveSpeed: 9.2,
        armor: 12,
        radius: 1.7,
        goldBounty: [210, 250],
        xpBounty: 300,
      }),
    );
    units.push(
      makeMob({
        name: "Ancient Rock Golem",
        subType: "golem",
        x: camp.x + 2.1,
        z: camp.z + 1.2,
        maxHp: 1050,
        hpRegen: 5.0,
        atkDamage: 74,
        atkRange: 3.0,
        atkCooldown: 1.18,
        moveSpeed: 9.6,
        armor: 7,
        radius: 1.25,
        goldBounty: [95, 115],
        xpBounty: 145,
      }),
    );
  } else if (camp.kind === "wyvern") {
    units.push(
      makeMob({
        name: "Ancient Frost Wyvern",
        subType: "wyvern",
        x: camp.x - 1.0,
        z: camp.z,
        maxHp: 2050,
        hpRegen: 8.5,
        atkDamage: 132,
        atkRange: 9.2,
        atkCooldown: 1.15,
        moveSpeed: 10.0,
        armor: 11,
        radius: 1.65,
        goldBounty: [215, 255],
        xpBounty: 305,
      }),
    );
    units.push(
      makeMob({
        name: "Ancient Ice Drake",
        subType: "harpy",
        x: camp.x + 2.0,
        z: camp.z + 1.2,
        maxHp: 980,
        hpRegen: 4.5,
        atkDamage: 76,
        atkRange: 6.8,
        atkCooldown: 1.15,
        moveSpeed: 10.2,
        armor: 7,
        radius: 1.2,
        goldBounty: [95, 115],
        xpBounty: 145,
      }),
    );
  } else if (camp.kind === "basilisk") {
    units.push(
      makeMob({
        name: "Ancient Obsidian Basilisk",
        subType: "basilisk",
        x: camp.x - 1.0,
        z: camp.z,
        maxHp: 2220,
        hpRegen: 9.0,
        atkDamage: 136,
        atkRange: 7.8,
        atkCooldown: 1.18,
        moveSpeed: 9.8,
        armor: 12,
        radius: 1.7,
        goldBounty: [220, 260],
        xpBounty: 310,
      }),
    );
  } else if (camp.kind === "behemoth") {
    units.push(
      makeMob({
        name: "Ancient Thunderhide Behemoth",
        subType: "behemoth",
        x: camp.x - 1.0,
        z: camp.z,
        maxHp: 2450,
        hpRegen: 10.0,
        atkDamage: 148,
        atkRange: 4.2,
        atkCooldown: 1.18,
        moveSpeed: 9.8,
        armor: 13,
        radius: 1.8,
        goldBounty: [245, 295],
        xpBounty: 345,
      }),
    );
  } else if (camp.kind === "vampire") {
    const halfPhase = DAY_CYCLE_DURATION * 0.5;
    const nightProg = isNightTime
      ? THREE.MathUtils.clamp(
          (cycleClock - halfPhase) / DAY_CYCLE_DURATION,
          0,
          1,
        )
      : 1.0;
    if (!isNightTime || nightProg >= 0.88) {
      camp.alive = false;
      return;
    }
    camp.leaderSlain = false;
    const vampPack = [
      {
        ox: 0.0,
        oz: 0.0,
        name: "Crimson Vampire Lord",
        isMiniBoss: true,
        leaderBonusType: "vampire_lifesteal",
        maxHp: 2450,
        dmg: 142,
        rad: 1.6,
        gold: [265, 320],
        xp: 380,
      },
      {
        ox: -3.2,
        oz: -2.4,
        name: "Elder Night Vampire",
        maxHp: 1750,
        dmg: 112,
        rad: 1.35,
        gold: [185, 225],
        xp: 265,
      },
      {
        ox: 3.4,
        oz: -1.8,
        name: "Dread Vampire Stalker",
        maxHp: 1280,
        dmg: 88,
        rad: 1.22,
        gold: [135, 165],
        xp: 195,
      },
      {
        ox: 0.4,
        oz: 3.6,
        name: "Crimson Bloodfiend",
        maxHp: 1280,
        dmg: 88,
        rad: 1.22,
        gold: [135, 165],
        xp: 195,
      },
    ];
    vampPack.forEach((vp) => {
      const sx = camp.x + vp.ox;
      const sz = camp.z + vp.oz;
      if (isNearAnyStandingTower(sx, sz, VAMPIRE_TOWER_SAFE_DIST)) return;
      const v = makeMob({
        name: vp.name,
        type: "vampire",
        subType: "vampire",
        isMiniBoss: !!vp.isMiniBoss,
        leaderBonusType: vp.leaderBonusType || null,
        x: sx,
        z: sz,
        maxHp: vp.maxHp,
        hpRegen: vp.isMiniBoss ? 12.0 : 8.5,
        atkDamage: vp.dmg,
        atkRange: vp.isMiniBoss ? 4.0 : 3.6,
        atkCooldown: vp.isMiniBoss ? 0.86 : 0.92,
        moveSpeed: vp.isMiniBoss ? 12.8 : 12.2,
        armor: vp.isMiniBoss ? 11 : 8,
        radius: vp.rad,
        goldBounty: vp.gold,
        xpBounty: vp.xp,
      });
      v.type = "vampire";
      v.homePos.set(camp.x, 0, camp.z);
      v.roamTarget = pickOuterEdgeVampirePoint(camp, sx, sz);
      v.roamPauseTimer = 0.3 + Math.random() * 0.8;
      v.vampPulseCd = 3.0;
      spawnParticleBurst(v.mesh.position, 0x9f1239, 14);
      spawnShockwaveRing(sx, sz, 4.0, 0xe11d48, 0.55);
      units.push(v);
    });
  }
}

function executeNeutralOrBossSkill(mob, target, isVisualReplay = false) {
  if (!isVisualReplay && mpState.active && mpState.role === "host") {
    mpQueueFxEvent([
      "M",
      mob.netId || mob.id,
      target ? target.netId || target.id : 0,
    ]);
  }
  const p = mob.mesh.position;
  const dmgScale = getEscalationMults().dmg * getInfinityMonsterMult();
  const isBossEnraged = mob.hp < mob.maxHp * 0.45;
  const cdFactor = isBossEnraged ? 0.72 : 1.0;
  if (mob.type === "dragon") {
    const closeCount = units.filter(
      (u) =>
        !u.dead &&
        u.team !== "neutral" &&
        u.mesh.position.distanceToSquared(p) <= 132.25,
    ).length;
    const useTailSweep =
      closeCount >= 2 ? Math.random() < 0.65 : Math.random() < 0.35;
    mob.mobSkillCd = 4.6 * cdFactor;
    if (useTailSweep) {
      mob.dragonAnimState = "TAIL_SWEEP";
      mob.dragonAnimTimer = 0.65;
      sfx.play("spell_orbital_meteor");
      triggerCameraShake(0.75);
      spawnShockwaveRing(p.x, p.z, 11.5, 0xfacc15, 0.52);
      spawnFloatText(p, "APEX TAIL WHIRL!", "#facc15", 16);
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== "neutral" &&
          u.mesh.position.distanceTo(p) <= 11.5 + u.radius
        ) {
          if (!isVisualReplay) u.takeDamage(195 * dmgScale, mob);
          if (!isVisualReplay) u.stunTimer = 1.2;
          const pushDir = new THREE.Vector3()
            .subVectors(u.mesh.position, p)
            .setY(0)
            .normalize();
          if (!isVisualReplay)
            u.mesh.position.x = THREE.MathUtils.clamp(
              u.mesh.position.x + pushDir.x * 6.5,
              -MAP_HALF + 3,
              MAP_HALF - 3,
            );
          if (!isVisualReplay)
            u.mesh.position.z = THREE.MathUtils.clamp(
              u.mesh.position.z + pushDir.z * 6.5,
              -MAP_HALF + 3,
              MAP_HALF - 3,
            );
        }
      });
    } else {
      mob.dragonAnimState = "SKY_BREATH";
      mob.dragonAnimTimer = 0.85;
      sfx.play("spell_fire_wave");
      triggerCameraShake(0.8);
      spawnOrbitalSkyBeam(p.x, p.z, 4.2, 0xf97316, 0.7);
      spawnShockwaveRing(p.x, p.z, 12.2, 0xf97316, 0.6);
      spawnGroundRuneDecal(p.x, p.z, 10.5, 0xea580c, 2.0);
      spawnFloatText(p, "SOLAR DRAGONFIRE INFERNO!", "#fb923c", 17);
      units.forEach((u) => {
        if (
          !u.dead &&
          u.team !== "neutral" &&
          u.mesh.position.distanceTo(p) <= 12.2 + u.radius
        ) {
          if (!isVisualReplay) u.takeDamage(235 * dmgScale, mob, true);
          if (!isVisualReplay) u.slowTimer = 3.2;
          u.slowFactor = 0.45;
        }
      });
    }
  } else if (mob.type === "boss") {
    mob.mobSkillCd = 5.6 * cdFactor;
    mob.castAnim = 0.55;
    sfx.play("spell_orbital_meteor");
    triggerCameraShake(0.55);
    spawnShockwaveRing(p.x, p.z, 9.2, 0xf97316, 0.55);
    spawnParticleBurst(p, 0xf97316, 22);
    spawnFloatText(p, "ROSHAN EARTH SLAM!", "#fb923c", 16);
    units.forEach((u) => {
      if (
        !u.dead &&
        u.team !== "neutral" &&
        u.mesh.position.distanceTo(p) <= 9.2 + u.radius
      ) {
        if (!isVisualReplay) u.takeDamage(185 * dmgScale, mob);
        if (!isVisualReplay) u.slowTimer = 2.8;
        u.slowFactor = 0.5;
      }
    });
  } else if (mob.type === "kong") {
    const isFury = mob.ancientFuryTimer > 0;
    const prioHero = findGuardianTarget(
      mob,
      isFury ? 78.0 : 48.0,
      isFury ? 86.0 : 68.0,
    );
    if (prioHero && prioHero.type === "hero") {
      mob.targetUnit = prioHero;
      mob.mesh.rotation.y = Math.atan2(
        prioHero.mesh.position.x - p.x,
        prioHero.mesh.position.z - p.z,
      );
    }
    if (isFury && mob.targetUnit && !mob.targetUnit.dead && !mob.activeDash) {
      const dTarget = mob.mesh.position.distanceTo(mob.targetUnit.mesh.position);
      if (dTarget > 5.5 && dTarget <= 32.0) {
        const start = mob.mesh.position;
        const dir = new THREE.Vector3()
          .subVectors(mob.targetUnit.mesh.position, start)
          .setY(0)
          .normalize();
        const jumpDist = Math.min(dTarget - 1.5, 26.0);
        const endX = THREE.MathUtils.clamp(
          start.x + dir.x * jumpDist,
          -MAP_HALF + 4,
          MAP_HALF - 4,
        );
        const endZ = THREE.MathUtils.clamp(
          start.z + dir.z * jumpDist,
          -MAP_HALF + 4,
          MAP_HALF - 4,
        );
        mob.activeDash = {
          startX: start.x,
          startZ: start.z,
          endX: endX,
          endZ: endZ,
          t: 0,
          dur: 0.45,
          arcHeight: 5.5,
          colHex: 0xfacc15,
        };
        spawnFloatText(start, "PP LABU ENRAGED LEAP!", "#facc15", 17);
        sfx.play("spell_blink");
      }
    }
    mob.mobSkillCd = isFury ? 2.8 : 4.8;
    mob.castAnim = 0.65;
    sfx.play("spell_orbital_meteor");
    triggerCameraShake(isFury ? 1.15 : 0.95);
    spawnShockwaveRing(
      p.x,
      p.z,
      isFury ? 13.5 : 11.5,
      isFury ? 0xef4444 : 0xfacc15,
      0.58,
    );
    spawnGroundRuneDecal(p.x, p.z, 10.5, 0xf97316, 1.8);
    spawnParticleBurst(p, isFury ? 0xef4444 : 0xfacc15, 30);
    spawnFloatText(
      p,
      isFury
        ? "PP LABU ENRAGED KING SLAM!"
        : "PP LABU SEISMIC KING SLAM!",
      isFury ? "#fb7185" : "#facc15",
      17,
    );
    const blastR = isFury ? 13.5 : 11.5;
    const slamDmg = (isFury ? 290 : 225) * dmgScale;
    units.forEach((u) => {
      if (
        !u.dead &&
        u.team !== mob.team &&
        u.type !== "ancient" &&
        u.mesh.position.distanceTo(p) <= blastR + u.radius
      ) {
        if (!isVisualReplay) u.takeDamage(slamDmg, mob, true);
        if (!isVisualReplay) u.stunTimer = isFury ? 1.75 : 1.4;
        const pushDir = new THREE.Vector3()
          .subVectors(u.mesh.position, p)
          .setY(0)
          .normalize();
        if (!isVisualReplay)
          u.mesh.position.x = THREE.MathUtils.clamp(
            u.mesh.position.x + pushDir.x * 6.0,
            -MAP_HALF + 3,
            MAP_HALF - 3,
          );
        if (!isVisualReplay)
          u.mesh.position.z = THREE.MathUtils.clamp(
            u.mesh.position.z + pushDir.z * 6.0,
            -MAP_HALF + 3,
            MAP_HALF - 3,
          );
      }
    });
  } else if (mob.type === "redman") {
    const isFury = mob.ancientFuryTimer > 0;
    const prioHero = findGuardianTarget(
      mob,
      isFury ? 78.0 : 48.0,
      isFury ? 86.0 : 68.0,
    );
    if (prioHero && prioHero.type === "hero") {
      mob.targetUnit = prioHero;
      mob.mesh.rotation.y = Math.atan2(
        prioHero.mesh.position.x - p.x,
        prioHero.mesh.position.z - p.z,
      );
    }
    mob.mobSkillCd = isFury ? 2.6 : 4.5;
    mob.castAnim = 0.6;
    sfx.play("spell_laguna");
    triggerCameraShake(isFury ? 1.2 : 1.0);
    spawnShockwaveRing(p.x, p.z, isFury ? 14.5 : 12.5, 0xef4444, 0.6);
    spawnGroundRuneDecal(p.x, p.z, 11.5, 0x991b1b, 1.9);
    spawnParticleBurst(p, 0xef4444, 34);
    spawnFloatText(
      p,
      isFury
        ? "RED MAN APOCALYPSE BLADE STORM!"
        : "RED MAN HELLFIRE BLADE STORM!",
      "#ef4444",
      17,
    );
    const stormR = isFury ? 14.5 : 12.5;
    const stormDmg = (isFury ? 310 : 240) * dmgScale;
    units.forEach((u) => {
      if (
        !u.dead &&
        u.team !== mob.team &&
        u.type !== "ancient" &&
        u.mesh.position.distanceTo(p) <= stormR + u.radius
      ) {
        if (!isVisualReplay) u.takeDamage(stormDmg, mob, true);
        if (!isVisualReplay) u.slowTimer = 3.8;
        u.slowFactor = 0.35;
      }
    });
  } else if (mob.type === "sneakygolem") {
    const isFury = mob.ancientFuryTimer > 0;
    const prioHero = findGuardianTarget(
      mob,
      isFury ? 82.0 : 54.0,
      isFury ? 90.0 : 72.0,
    );
    if (prioHero && prioHero.type === "hero") {
      mob.targetUnit = prioHero;
      mob.mesh.rotation.y = Math.atan2(
        prioHero.mesh.position.x - p.x,
        prioHero.mesh.position.z - p.z,
      );
    }
    mob.mobSkillCd = isFury ? 2.5 : 4.2;
    mob.castAnim = 0.65;
    sfx.play("spell_orbital_meteor");
    triggerCameraShake(isFury ? 1.35 : 1.1);
    const quakeR = isFury ? 16.0 : 13.5;
    spawnOrbitalSkyBeam(p.x, p.z, 6.2, 0xff1493, 0.75);
    spawnShockwaveRing(p.x, p.z, quakeR, 0xff4dff, 0.65);
    spawnGroundRuneDecal(p.x, p.z, quakeR * 0.9, 0xbe185d, 2.0);
    spawnParticleBurst(p, 0xff4dff, 36);
    spawnFloatText(
      p,
      isFury
        ? "SNEAKY GOLEM ENRAGED PINK CATACLYSM!"
        : "SNEAKY GOLEM PINK OBLIVION SLAM!",
      "#f472b6",
      18,
    );
    const slamDmg = (isFury ? 340 : 265) * dmgScale;
    units.forEach((u) => {
      if (
        !u.dead &&
        u.team !== mob.team &&
        u.type !== "ancient" &&
        u.mesh.position.distanceTo(p) <= quakeR + u.radius
      ) {
        if (!isVisualReplay) u.takeDamage(slamDmg, mob, true);
        if (!isVisualReplay) u.stunTimer = isFury ? 1.85 : 1.5;
        const pushDir = new THREE.Vector3()
          .subVectors(u.mesh.position, p)
          .setY(0)
          .normalize();
        if (!isVisualReplay)
          u.mesh.position.x = THREE.MathUtils.clamp(
            u.mesh.position.x + pushDir.x * 7.5,
            -MAP_HALF + 3,
            MAP_HALF - 3,
          );
        if (!isVisualReplay)
          u.mesh.position.z = THREE.MathUtils.clamp(
            u.mesh.position.z + pushDir.z * 7.5,
            -MAP_HALF + 3,
            MAP_HALF - 3,
          );
      }
    });
  } else if (mob.subType === "ancient_dragon") {
    mob.mobSkillCd = 5.4;
    spawnFloatText(p, "ANCIENT FIREBALL!", "#fb923c", 14);
    spawnShockwaveRing(
      target.mesh.position.x,
      target.mesh.position.z,
      5.4,
      0xf97316,
      0.48,
    );
    spawnGroundRuneDecal(
      target.mesh.position.x,
      target.mesh.position.z,
      5.0,
      0xea580c,
      1.5,
    );
    units.forEach((u) => {
      if (
        !u.dead &&
        u.team !== "neutral" &&
        u.mesh.position.distanceTo(target.mesh.position) <= 5.4 + u.radius
      ) {
        if (!isVisualReplay) u.takeDamage(142 * dmgScale, mob);
      }
    });
  } else if (
    (mob.subType === "wolf" || mob.subType === "werewolf") &&
    mob.name.includes("Alpha")
  ) {
    mob.mobSkillCd = 6.5;
    mob.blinkBuffTimer = 4.8;
    // Empower entire nearby wolf pack!
    for (let wi = 0; wi < units.length; wi++) {
      const allyMob = units[wi];
      if (
        !allyMob.dead &&
        allyMob.type === "neutral" &&
        allyMob.camp === mob.camp
      ) {
        allyMob.blinkBuffTimer = Math.max(allyMob.blinkBuffTimer, 4.8);
      }
    }
    spawnShockwaveRing(p.x, p.z, 5.6, 0xf43f5e, 0.45);
    spawnFloatText(p, "PACK HOWL (+55% ATK SPD)!", "#fb7185", 13);
  } else if (mob.subType === "troll") {
    if (target.stunTimer > 0.3) {
      mob.mobSkillCd = 1.0;
      return;
    }
    mob.mobSkillCd = 6.5;
    spawnFloatText(p, "ENSNARE NET!", "#60a5fa", 13);
    if (!isVisualReplay)
      target.stunTimer = Math.max(target.stunTimer, 1.55);
    spawnShockwaveRing(
      target.mesh.position.x,
      target.mesh.position.z,
      2.8,
      0x60a5fa,
      0.4,
    );
  } else if (mob.subType === "centaur" || mob.subType === "behemoth") {
    // Wait until target is inside 5.8m AoE slam radius and not already stunned
    if (
      p.distanceToSquared(target.mesh.position) >
        (5.8 + target.radius) ** 2 ||
      target.stunTimer > 0.35
    ) {
      mob.mobSkillCd = 0.6;
      return;
    }
    mob.mobSkillCd = 6.2;
    spawnShockwaveRing(p.x, p.z, 5.8, 0xf59e0b, 0.45);
    spawnFloatText(
      p,
      mob.subType === "behemoth" ? "ANCIENT THUNDER SLAM!" : "WAR STOMP!",
      "#facc15",
      13,
    );
    units.forEach((u) => {
      if (
        !u.dead &&
        u.team !== "neutral" &&
        u.mesh.position.distanceTo(p) <= 5.8 + u.radius
      ) {
        if (!isVisualReplay)
          u.takeDamage(
            (mob.subType === "behemoth" ? 128 : 94) * dmgScale,
            mob,
          );
        if (!isVisualReplay) u.stunTimer = Math.max(u.stunTimer, 1.45);
      }
    });
  } else if (mob.subType === "hellbear") {
    if (
      p.distanceToSquared(target.mesh.position) >
      (5.6 + target.radius) ** 2
    ) {
      mob.mobSkillCd = 0.6;
      return;
    }
    mob.mobSkillCd = 6.0;
    spawnShockwaveRing(p.x, p.z, 5.6, 0xf87171, 0.45);
    spawnFloatText(p, "THUNDER CLAP!", "#f87171", 13);
    units.forEach((u) => {
      if (
        !u.dead &&
        u.team !== "neutral" &&
        u.mesh.position.distanceTo(p) <= 5.6 + u.radius
      ) {
        if (!isVisualReplay) u.takeDamage(94 * dmgScale, mob);
        if (!isVisualReplay) {
          u.slowTimer = Math.max(u.slowTimer, 3.2);
          u.slowFactor = Math.min(u.slowFactor, 0.48);
        }
      }
    });
  } else if (
    mob.subType === "satyr" &&
    mob.name.includes("Soulstealer")
  ) {
    mob.mobSkillCd = 5.6;
    if (target.mana >= 30) {
      spawnFloatText(p, "MANA BURN (-85 MP)!", "#c084fc", 12);
      if (!isVisualReplay) {
        target.takeDamage(82 * dmgScale, mob);
        target.mana = Math.max(0, target.mana - 85);
      }
    } else {
      spawnFloatText(p, "SOUL SHOCK!", "#e879f9", 12);
      if (!isVisualReplay) target.takeDamage(96 * dmgScale, mob);
    }
    spawnParticleBurst(target.mesh.position, 0xc084fc, 10);
  } else if (mob.subType === "golem") {
    mob.mobSkillCd = 6.5;
    spawnFloatText(p, "ANCIENT BOULDER!", "#fbbf24", 13);
    target.takeDamage(132 * dmgScale, mob);
    target.stunTimer = 1.3;
    spawnShockwaveRing(
      target.mesh.position.x,
      target.mesh.position.z,
      3.2,
      0xfbbf24,
      0.4,
    );
  } else if (["harpy", "wyvern", "basilisk"].includes(mob.subType)) {
    mob.mobSkillCd = 6.0;
    const label =
      mob.subType === "harpy"
        ? "CHAIN LIGHTNING!"
        : mob.subType === "wyvern"
          ? "ANCIENT FROST BREATH!"
          : "OBSIDIAN VENOM!";
    const col =
      mob.subType === "harpy"
        ? 0x38bdf8
        : mob.subType === "wyvern"
          ? 0x67e8f9
          : 0x4ade80;
    spawnFloatText(p, label, "#38bdf8", 13);
    spawnShockwaveRing(
      target.mesh.position.x,
      target.mesh.position.z,
      4.8,
      col,
      0.45,
    );
    units.forEach((u) => {
      if (
        !u.dead &&
        u.team !== "neutral" &&
        u.mesh.position.distanceTo(target.mesh.position) <= 4.8 + u.radius
      ) {
        if (!isVisualReplay) u.takeDamage(124 * dmgScale, mob);
        if (!isVisualReplay) u.slowTimer = 2.8;
        u.slowFactor = 0.52;
      }
    });
  }
}

let playerHero = null;
let aiHeroes = [];
let matchTime = 0;
let waveCountdown = 2.0;
const WAVE_PERIOD = 25.0;
let runeCountdown = 6.0;
let radiantKills = 0;
let direKills = 0;
let firstBloodDone = false;
let gameOver = false;
let primedSkill = null;

function scaleBotStatsByDifficulty(baseStats) {
  const prof =
    AI_DIFFICULTY_PROFILES[aiDifficulty] ||
    AI_DIFFICULTY_PROFILES.veteran;
  return {
    ...baseStats,
    maxHp: Math.round(baseStats.maxHp * prof.hpMult),
    hpRegen: baseStats.hpRegen * prof.hpMult,
    atkDamage: Math.round(baseStats.atkDamage * prof.dmgMult),
    moveSpeed: baseStats.moveSpeed * prof.spdMult,
    armor: Math.round(baseStats.armor * (0.85 + prof.hpMult * 0.25)),
  };
}

function initMatchEntities() {
  units.forEach((u) => {
    scene.remove(u.mesh);
    disposeObject3D(u.mesh);
    if (u.bar && u.bar.el) u.bar.el.remove();
  });
  units = [];
  staticStructures = [];
  clearZonesAndWalls();
  aiHeroes = [];
  roshanBoss = null;
  roshanRespawnTimer = 0;
  elderDragonBoss = null;
  elderDragonSpawnTimer = ELDER_DRAGON_INTERVAL;
  lastDragonSpot = null;
  ppLabuGuardians = { radiant: null, dire: null };
  ppLabuSpawned = { radiant: false, dire: false };
  redManGuardians = { radiant: null, dire: null };
  sneakyGolemGuardians = { radiant: null, dire: null };
  radiantMegaCreeps = false;
  direMegaCreeps = false;
  escalationTier = 1;
  nextEscalationTime = 60.0;
  window.clearInspectedUnit();
  document.getElementById("dragon-hud-badge").classList.add("hidden");

  localP2Hero = null;
  const statusPill = document.getElementById("mp-hud-status-pill");
  const statusText = document.getElementById("mp-hud-status-text");
  const p2Pill = document.getElementById("local-p2-hud-pill");

  if (mpState.active && mpState.role === "guest") {
    if (statusPill) statusPill.classList.remove("hidden");
    if (statusText)
      statusText.textContent = `MP GUEST • ${mpState.roomCode}${mpState.iceModeLabel ? " • " + mpState.iceModeLabel : ""}`;
    if (p2Pill) p2Pill.classList.add("hidden");
    const myCfg = HERO_ROSTER[selectedHeroId] || HERO_ROSTER.aurelius;
    applyHeroToHUD(myCfg, `Room ${mpState.roomCode}`);
    playerHero = new MobaEntity({
      name: `${myCfg.name} (${mpState.myName})`,
      team: mpState.myTeam,
      type: "hero",
      isPlayer: true,
      heroCfg: myCfg,
      x: mpState.myTeam === "radiant" ? -133 : 133,
      z: mpState.myTeam === "radiant" ? 133 : -133,
      ...myCfg.stats,
      radius: 1.4,
      gold: 650,
      tpCharges: 1,
    });
    playerHero.mesh.rotation.y =
      mpState.myTeam === "radiant" ? Math.PI * 0.75 : -Math.PI * 0.25;
    playerHero.ownerPeerId = mpState.myId;
    units.push(playerHero);
    spawnRiverRunes();
    setTimeout(() => {
      if (mpState.active && mpState.role === "guest")
        mpSendToHost({ type: "SYNC_REQ" });
    }, 120);
    return;
  }

  const radHeroCfg = HERO_ROSTER[selectedHeroId] || HERO_ROSTER.aurelius;
  const otherIds = Object.keys(HERO_ROSTER).filter(
    (id) => id !== radHeroCfg.id,
  );
  const direCfg1 = HERO_ROSTER[otherIds[0]];
  const direCfg2 = HERO_ROSTER[otherIds[1]];
  const allyCfg = HERO_ROSTER[otherIds[2]];
  const prof =
    AI_DIFFICULTY_PROFILES[aiDifficulty] ||
    AI_DIFFICULTY_PROFILES.veteran;

  // Symmetric Radiant Ancient + 3 High-Range, High-Damage Tier 3 Citadel Guardian Towers + Tier 2 & Tier 1 along main diagonal
  units.push(
    new MobaEntity({
      name: "Radiant Ancient",
      team: "radiant",
      type: "ancient",
      x: -140,
      z: 140,
      maxHp: 12000,
      hpRegen: 20.0,
      armor: 34,
      radius: 5.0,
      goldBounty: 500,
      xpBounty: 0,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Radiant Citadel Tower Front",
      team: "radiant",
      type: "tower",
      x: -114,
      z: 114,
      maxHp: 8200,
      hpRegen: 6.5,
      atkDamage: 545,
      atkRange: 26.0,
      atkCooldown: 0.65,
      armor: 38,
      radius: 2.8,
      goldBounty: [340, 400],
      xpBounty: 340,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Radiant Citadel Tower North",
      team: "radiant",
      type: "tower",
      x: -134,
      z: 100,
      maxHp: 7800,
      hpRegen: 6.0,
      atkDamage: 520,
      atkRange: 25.0,
      atkCooldown: 0.68,
      armor: 36,
      radius: 2.7,
      goldBounty: [320, 380],
      xpBounty: 320,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Radiant Citadel Tower East",
      team: "radiant",
      type: "tower",
      x: -100,
      z: 134,
      maxHp: 7800,
      hpRegen: 6.0,
      atkDamage: 520,
      atkRange: 25.0,
      atkCooldown: 0.68,
      armor: 36,
      radius: 2.7,
      goldBounty: [320, 380],
      xpBounty: 320,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Radiant Tier 2 Tower",
      team: "radiant",
      type: "tower",
      x: -78,
      z: 78,
      maxHp: 6000,
      hpRegen: 4.5,
      atkDamage: 285,
      atkRange: 16.5,
      atkCooldown: 0.92,
      armor: 25,
      radius: 2.5,
      goldBounty: [260, 310],
      xpBounty: 260,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Radiant Tier 1 Tower",
      team: "radiant",
      type: "tower",
      x: -36,
      z: 36,
      maxHp: 4500,
      hpRegen: 3.0,
      atkDamage: 215,
      atkRange: 16.5,
      atkCooldown: 0.95,
      armor: 20,
      radius: 2.5,
      goldBounty: [220, 260],
      xpBounty: 220,
    }),
  );

  // Symmetric Dire Ancient + 3 High-Range, High-Damage Tier 3 Citadel Guardian Towers + Tier 2 & Tier 1 along main diagonal
  units.push(
    new MobaEntity({
      name: "Dire Ancient",
      team: "dire",
      type: "ancient",
      x: 140,
      z: -140,
      maxHp: 12000,
      hpRegen: 20.0,
      armor: 34,
      radius: 5.0,
      goldBounty: 500,
      xpBounty: 0,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Dire Citadel Tower Front",
      team: "dire",
      type: "tower",
      x: 114,
      z: -114,
      maxHp: 8200,
      hpRegen: 6.5,
      atkDamage: 545,
      atkRange: 26.0,
      atkCooldown: 0.65,
      armor: 38,
      radius: 2.8,
      goldBounty: [340, 400],
      xpBounty: 340,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Dire Citadel Tower South",
      team: "dire",
      type: "tower",
      x: 134,
      z: -100,
      maxHp: 7800,
      hpRegen: 6.0,
      atkDamage: 520,
      atkRange: 25.0,
      atkCooldown: 0.68,
      armor: 36,
      radius: 2.7,
      goldBounty: [320, 380],
      xpBounty: 320,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Dire Citadel Tower West",
      team: "dire",
      type: "tower",
      x: 100,
      z: -134,
      maxHp: 7800,
      hpRegen: 6.0,
      atkDamage: 520,
      atkRange: 25.0,
      atkCooldown: 0.68,
      armor: 36,
      radius: 2.7,
      goldBounty: [320, 380],
      xpBounty: 320,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Dire Tier 2 Tower",
      team: "dire",
      type: "tower",
      x: 78,
      z: -78,
      maxHp: 6000,
      hpRegen: 4.5,
      atkDamage: 285,
      atkRange: 16.5,
      atkCooldown: 0.92,
      armor: 25,
      radius: 2.5,
      goldBounty: [260, 310],
      xpBounty: 260,
    }),
  );
  units.push(
    new MobaEntity({
      name: "Dire Tier 1 Tower",
      team: "dire",
      type: "tower",
      x: 36,
      z: -36,
      maxHp: 4500,
      hpRegen: 3.0,
      atkDamage: 215,
      atkRange: 16.5,
      atkCooldown: 0.95,
      armor: 20,
      radius: 2.5,
      goldBounty: [220, 260],
      xpBounty: 220,
    }),
  );
  staticStructures = units.filter(
    (s) => s.type === "tower" || s.type === "ancient",
  );

  // Spawn all heroes cleanly on their Base Fountain Sanctuary dais (-133, 133 Radiant | 133, -133 Dire), well clear of the lane creep gate (-104, 104)
  const FOUNTAIN_SLOTS_5V5 = [
    [0.0, 0.0],
    [-3.6, -2.2],
    [2.2, 3.6],
    [-5.2, 1.4],
    [-1.4, 5.2],
  ];
  const getFountainSpawn = (team, slotIdx = 0) => {
    const [ox, oz] =
      FOUNTAIN_SLOTS_5V5[Math.min(4, Math.max(0, slotIdx))];
    return team === "radiant"
      ? { x: -133 + ox, z: 133 + oz, yaw: Math.PI * 0.75 }
      : { x: 133 - ox, z: -133 - oz, yaw: -Math.PI * 0.25 };
  };

  if (mpState.active && mpState.role === "host") {
    if (statusPill) statusPill.classList.remove("hidden");
    if (statusText)
      statusText.textContent = `MP HOST • ${mpState.roomCode} (${mpState.players.size}P)${mpState.iceModeLabel ? " • " + mpState.iceModeLabel : ""}`;
    if (p2Pill) p2Pill.classList.add("hidden");

    const usedHeroIds = new Set();
    let radCount = 0;
    let direCount = 0;
    mpState.players.forEach((p) => {
      const isMe = p.id === mpState.myId;
      const hCfg =
        HERO_ROSTER[isMe ? selectedHeroId : p.heroId] ||
        HERO_ROSTER.aurelius;
      usedHeroIds.add(hCfg.id);
      const team = p.team === "dire" ? "dire" : "radiant";
      const idx = Math.min(
        4,
        team === "radiant" ? radCount++ : direCount++,
      );
      const sp = getFountainSpawn(team, idx);
      const heroEnt = new MobaEntity({
        name: `${hCfg.name} (${p.name})`,
        team,
        type: "hero",
        isPlayer: isMe,
        heroCfg: hCfg,
        x: sp.x,
        z: sp.z,
        ...hCfg.stats,
        radius: 1.4,
        gold: 650,
        tpCharges: aiDifficulty === "infinity" ? 0 : 1,
        goldBounty: [260, 320],
        xpBounty: 260,
      });
      heroEnt.mesh.rotation.y = sp.yaw;
      heroEnt.ownerPeerId = p.id;
      if (!isMe) {
        heroEnt.isRemoteHuman = true;
      } else {
        playerHero = heroEnt;
        applyHeroToHUD(
          hCfg,
          `Room ${mpState.roomCode} (${mpState.players.size}P)`,
        );
      }
      units.push(heroEnt);
    });

    if (mpState.fillBots) {
      const botPool = Object.values(HERO_ROSTER).filter(
        (h) => !usedHeroIds.has(h.id),
      );
      let poolIdx = 0;
      const spawnTeamBot = (team, slotIdx) => {
        const bCfg = botPool[poolIdx++ % botPool.length] || direCfg1;
        const sp = getFountainSpawn(team, slotIdx);
        const bot = new MobaEntity({
          name: `${bCfg.name} [${prof.label}]`,
          team,
          type: "hero",
          isPlayer: false,
          heroCfg: bCfg,
          x: sp.x,
          z: sp.z,
          ...scaleBotStatsByDifficulty(bCfg.stats),
          radius: 1.4,
          gold: 650,
          goldBounty: [280, 340],
          xpBounty: 280,
        });
        bot.mesh.rotation.y = sp.yaw;
        bot.atkSpeedMult += prof.atkSpdBonus;
        bot.abilityLevels.Q = 1;
        bot.skillPoints = 0;
        units.push(bot);
        aiHeroes.push(bot);
      };
      while (radCount < 5) spawnTeamBot("radiant", radCount++);
      while (direCount < 5) spawnTeamBot("dire", direCount++);
    }
  } else if (mpState.active && mpState.transport === "local2p") {
    if (statusPill) statusPill.classList.remove("hidden");
    if (statusText)
      statusText.textContent = "2-PLAYER LOCAL SHARED SCREEN";
    const p2Cfg = HERO_ROSTER[mpState.p2HeroId] || HERO_ROSTER.malakor;
    const p2IsRad = mpState.p2Team === "radiant";

    applyHeroToHUD(
      radHeroCfg,
      p2IsRad
        ? `${direCfg1.name} & ${direCfg2.name}`
        : `P2: ${p2Cfg.name}`,
    );
    if (p2Pill) {
      p2Pill.classList.remove("hidden");
      const p2NameEl = document.getElementById("p2-hud-name");
      if (p2NameEl)
        p2NameEl.textContent = `${p2Cfg.name} (${mpState.p2Team.toUpperCase()})`;
    }

    const p1Sp = getFountainSpawn("radiant", 0);
    playerHero = new MobaEntity({
      name: `${radHeroCfg.name} (P1)`,
      team: "radiant",
      type: "hero",
      isPlayer: true,
      heroCfg: radHeroCfg,
      x: p1Sp.x,
      z: p1Sp.z,
      ...radHeroCfg.stats,
      radius: 1.4,
      gold: 650,
      tpCharges: aiDifficulty === "infinity" ? 0 : 1,
      goldBounty: [260, 310],
      xpBounty: 260,
    });
    playerHero.mesh.rotation.y = p1Sp.yaw;
    units.push(playerHero);

    const p2Sp = getFountainSpawn(mpState.p2Team, p2IsRad ? 1 : 0);
    localP2Hero = new MobaEntity({
      name: `${p2Cfg.name} (P2)`,
      team: mpState.p2Team,
      type: "hero",
      isPlayer: false,
      heroCfg: p2Cfg,
      x: p2Sp.x,
      z: p2Sp.z,
      ...p2Cfg.stats,
      radius: 1.4,
      gold: 650,
      tpCharges: aiDifficulty === "infinity" ? 0 : 1,
      goldBounty: [260, 310],
      xpBounty: 260,
    });
    localP2Hero.mesh.rotation.y = p2Sp.yaw;
    localP2Hero.isLocalP2 = true;
    localP2Hero.abilityLevels.Q = 1;
    localP2Hero.skillPoints = 0;
    units.push(localP2Hero);

    if (p2IsRad) {
      [direCfg1, direCfg2].forEach((dc, idx) => {
        const dSp = getFountainSpawn("dire", idx);
        const dBot = new MobaEntity({
          name: `${dc.name} [${prof.label}]`,
          team: "dire",
          type: "hero",
          isPlayer: false,
          heroCfg: dc,
          x: dSp.x,
          z: dSp.z,
          ...scaleBotStatsByDifficulty(dc.stats),
          radius: 1.4,
          gold: 650,
          goldBounty: [280, 340],
          xpBounty: 280,
        });
        dBot.mesh.rotation.y = dSp.yaw;
        dBot.atkSpeedMult += prof.atkSpdBonus;
        dBot.abilityLevels.Q = 1;
        dBot.skillPoints = 0;
        units.push(dBot);
        aiHeroes.push(dBot);
      });
    }
  } else {
    if (statusPill) statusPill.classList.add("hidden");
    if (p2Pill) p2Pill.classList.add("hidden");
    const direTitle =
      matchMode === "1v2"
        ? `${direCfg1.name} & ${direCfg2.name}`
        : `${direCfg1.name} (${prof.label})`;
    applyHeroToHUD(radHeroCfg, direTitle);

    const radSp = getFountainSpawn("radiant", 0);
    playerHero = new MobaEntity({
      name: radHeroCfg.name,
      team: "radiant",
      type: "hero",
      isPlayer: true,
      heroCfg: radHeroCfg,
      x: radSp.x,
      z: radSp.z,
      ...radHeroCfg.stats,
      radius: 1.4,
      gold: 650,
      tpCharges: aiDifficulty === "infinity" ? 0 : 1,
      goldBounty: [250, 290],
      xpBounty: 250,
    });
    playerHero.mesh.rotation.y = radSp.yaw;
    units.push(playerHero);

    if (matchMode === "2v1") {
      const allySp = getFountainSpawn("radiant", 1);
      const allyHero = new MobaEntity({
        name: `${allyCfg.name} (Ally)`,
        team: "radiant",
        type: "hero",
        isPlayer: false,
        heroCfg: allyCfg,
        x: allySp.x,
        z: allySp.z,
        ...scaleBotStatsByDifficulty(allyCfg.stats),
        radius: 1.4,
        gold: 650,
        goldBounty: [250, 290],
        xpBounty: 250,
      });
      allyHero.mesh.rotation.y = allySp.yaw;
      allyHero.atkSpeedMult += prof.atkSpdBonus;
      allyHero.abilityLevels.Q = 1;
      allyHero.skillPoints = 0;
      units.push(allyHero);
      aiHeroes.push(allyHero);
    }

    const dSp1 = getFountainSpawn("dire", 0);
    const dHero1 = new MobaEntity({
      name: `${direCfg1.name} [${prof.label}]`,
      team: "dire",
      type: "hero",
      isPlayer: false,
      heroCfg: direCfg1,
      x: dSp1.x,
      z: dSp1.z,
      ...scaleBotStatsByDifficulty(direCfg1.stats),
      radius: 1.4,
      gold: 650,
      goldBounty: [280, 340],
      xpBounty: 280,
    });
    dHero1.mesh.rotation.y = dSp1.yaw;
    dHero1.atkSpeedMult += prof.atkSpdBonus;
    dHero1.abilityLevels.Q = 1;
    dHero1.skillPoints = 0;
    units.push(dHero1);
    aiHeroes.push(dHero1);

    if (matchMode === "1v2") {
      const dSp2 = getFountainSpawn("dire", 1);
      const dHero2 = new MobaEntity({
        name: `${direCfg2.name} [${prof.label}]`,
        team: "dire",
        type: "hero",
        isPlayer: false,
        heroCfg: direCfg2,
        x: dSp2.x,
        z: dSp2.z,
        ...scaleBotStatsByDifficulty(direCfg2.stats),
        radius: 1.4,
        gold: 650,
        goldBounty: [280, 340],
        xpBounty: 280,
      });
      dHero2.mesh.rotation.y = dSp2.yaw;
      dHero2.atkSpeedMult += prof.atkSpdBonus;
      dHero2.abilityLevels.Q = 1;
      dHero2.skillPoints = 0;
      units.push(dHero2);
      aiHeroes.push(dHero2);
    }
  }

  setupNeutralCamps();
  spawnRoshanBoss();
}

const _radFlankCache = {};
const _direFlankCache = {};
function getCachedFlankPath(isRad, sideOff) {
  const cache = isRad ? _radFlankCache : _direFlankCache;
  if (!cache[sideOff]) {
    const nx = 0.70710678 * sideOff;
    const nz = 0.70710678 * sideOff;
    const nodes = isRad
      ? [
          [-78, 78],
          [-36, 36],
          [0, 0],
          [36, -36],
          [78, -78],
          [114, -114],
          [134, -134],
        ]
      : [
          [78, -78],
          [36, -36],
          [0, 0],
          [-36, 36],
          [-78, 78],
          [-114, 114],
          [-134, 134],
        ];
    cache[sideOff] = nodes.map(([px, pz], idx) =>
      idx === nodes.length - 1
        ? new THREE.Vector3(px, 0, pz)
        : new THREE.Vector3(px + nx, 0, pz + nz),
    );
  }
  return cache[sideOff];
}

function spawnCreepWave() {
  if (gameOver) return;
  const m = getEscalationMults();

  [
    { dx: -2.2, dz: 0.4, sub: "melee", side: 3.35 },
    { dx: 0.4, dz: -2.2, sub: "melee", side: -3.35 },
    { dx: -1.0, dz: -1.0, sub: "melee", side: 2.35 },
    { dx: -3.2, dz: 3.2, sub: "ranged", side: -2.35 },
  ].forEach((f) => {
    const isR = f.sub === "ranged";
    const radPath = getCachedFlankPath(true, f.side);
    const direPath = getCachedFlankPath(false, -f.side);

    const radMegaMult = radiantMegaCreeps ? 2.15 : 1.0;
    const radMegaReward = radiantMegaCreeps ? 0.4 : 1.0;
    const radCreep = new MobaEntity({
      name: radiantMegaCreeps
        ? isR
          ? "Radiant Mega Arcanist"
          : "Radiant Mega Centurion"
        : isR
          ? "Radiant Arcanist"
          : "Radiant Footman",
      team: "radiant",
      type: "creep",
      subType: f.sub,
      isMega: radiantMegaCreeps,
      x: -104 + f.dx,
      z: 104 + f.dz,
      maxHp: Math.round((isR ? 350 : 490) * m.hp * radMegaMult),
      atkDamage: Math.round((isR ? 38 : 30) * m.dmg * radMegaMult),
      atkRange: isR ? 9.5 : 2.8,
      atkCooldown: 1.1,
      moveSpeed: radiantMegaCreeps ? 10.4 : 9.4,
      armor: Math.round(
        (isR ? 2 : 3) + m.armor + (radiantMegaCreeps ? 6 : 0),
      ),
      radius: radiantMegaCreeps ? 1.25 : 0.9,
      goldBounty: [
        Math.round((isR ? 48 : 38) * m.goldBounty * radMegaReward),
        Math.round((isR ? 58 : 48) * m.goldBounty * radMegaReward),
      ],
      xpBounty: Math.round((isR ? 65 : 52) * m.xpBounty * radMegaReward),
      waypoints: radPath,
    });
    radCreep.mesh.rotation.y = Math.atan2(
      radPath[0].x - radCreep.mesh.position.x,
      radPath[0].z - radCreep.mesh.position.z,
    );
    units.push(radCreep);

    const direMegaMult = direMegaCreeps ? 2.15 : 1.0;
    const direMegaReward = direMegaCreeps ? 0.4 : 1.0;
    const direCreep = new MobaEntity({
      name: direMegaCreeps
        ? isR
          ? "Dire Mega Warlock"
          : "Dire Mega Behemoth"
        : isR
          ? "Dire Warlock"
          : "Dire Ghoul",
      team: "dire",
      type: "creep",
      subType: f.sub,
      isMega: direMegaCreeps,
      x: 104 - f.dx,
      z: -104 - f.dz,
      maxHp: Math.round((isR ? 350 : 490) * m.hp * direMegaMult),
      atkDamage: Math.round((isR ? 38 : 30) * m.dmg * direMegaMult),
      atkRange: isR ? 9.5 : 2.8,
      atkCooldown: 1.1,
      moveSpeed: direMegaCreeps ? 10.4 : 9.4,
      armor: Math.round(
        (isR ? 2 : 3) + m.armor + (direMegaCreeps ? 6 : 0),
      ),
      radius: direMegaCreeps ? 1.25 : 0.9,
      goldBounty: [
        Math.round((isR ? 48 : 38) * m.goldBounty * direMegaReward),
        Math.round((isR ? 58 : 48) * m.goldBounty * direMegaReward),
      ],
      xpBounty: Math.round((isR ? 65 : 52) * m.xpBounty * direMegaReward),
      waypoints: direPath,
    });
    direCreep.mesh.rotation.y = Math.atan2(
      direPath[0].x - direCreep.mesh.position.x,
      direPath[0].z - direCreep.mesh.position.z,
    );
    units.push(direCreep);
  });
}

const RIVER_RUNE_DEFS = [
  {
    bit: 1,
    x: -28,
    z: -28,
    kind: "bounty",
    color: 0xfacc15,
    text: "BOUNTY RUNE (+140g & +180 HP/MP)",
  },
  {
    bit: 2,
    x: 28,
    z: 28,
    kind: "arcane",
    color: 0x34d399,
    text: "ARCANE RUNE (+240 HP/MP & Haste)",
  },
];

function createSingleRiverRune(s) {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.18, 0),
    new THREE.MeshStandardMaterial({
      color: s.color,
      emissive: s.color,
      emissiveIntensity: 1.5,
    }),
  );
  gem.position.y = 1.5;
  g.add(gem);
  const ped = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.85, 24),
    new THREE.MeshBasicMaterial({
      color: s.color,
      side: THREE.DoubleSide,
    }),
  );
  ped.rotation.x = -Math.PI / 2;
  ped.position.y = 0.12;
  g.add(ped);
  g.position.set(s.x, 0, s.z);
  scene.add(g);
  runes.push({ ...s, group: g, gem });
}

function spawnRiverRunes() {
  runes.forEach((r) => {
    scene.remove(r.group);
    disposeObject3D(r.group);
  });
  runes = [];
  RIVER_RUNE_DEFS.forEach((s) => createSingleRiverRune(s));
}

function syncGuestRiverRunesFromMask(mask) {
  for (let i = runes.length - 1; i >= 0; i--) {
    const r = runes[i];
    const bit = r.kind === "bounty" ? 1 : 2;
    if ((mask & bit) === 0) {
      scene.remove(r.group);
      disposeObject3D(r.group);
      runes.splice(i, 1);
    }
  }
  for (let i = 0; i < RIVER_RUNE_DEFS.length; i++) {
    const def = RIVER_RUNE_DEFS[i];
    if (
      (mask & def.bit) !== 0 &&
      !runes.some((r) => r.kind === def.kind)
    ) {
      createSingleRiverRune(def);
    }
  }
}

