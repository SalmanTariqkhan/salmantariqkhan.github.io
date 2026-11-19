/***********************************************************************
 * 12. COMBAT, TACTICAL GRANDMASTER AI ENGINE & SIMULATION LOOP
 ***********************************************************************/
const _sparkleDiamondGeo = registerSharedAsset(
  new THREE.OctahedronGeometry(0.18, 0),
);
const _sparkleFlareHGeo = registerSharedAsset(
  new THREE.PlaneGeometry(0.68, 0.1),
);
const _sparkleFlareVGeo = registerSharedAsset(
  new THREE.PlaneGeometry(0.1, 0.68),
);
const _umaxStarHaloMat = registerSharedAsset(
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);

function spawnHeroAttackSparkles(
  pos,
  primaryHex,
  secondaryHex,
  isCrit = false,
) {
  const count = isCrit ? 18 : 11;
  const palette = [
    0xffffff,
    0xfef08a,
    primaryHex || 0xfacc15,
    secondaryHex || 0x38bdf8,
  ];
  const baseY = (pos.y || getTerrainHeightAt(pos.x, pos.z)) + 1.55;

  // Crisp 4-point starlight cross-flare at strike/launch origin
  const flareGroup = new THREE.Group();
  flareGroup.position.set(pos.x, baseY, pos.z);
  const fMat1 = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fMat2 = new THREE.MeshBasicMaterial({
    color: primaryHex || 0xfacc15,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fh = new THREE.Mesh(_sparkleFlareHGeo, fMat1);
  const fv = new THREE.Mesh(_sparkleFlareVGeo, fMat1);
  const fd1 = new THREE.Mesh(_sparkleFlareHGeo, fMat2);
  const fd2 = new THREE.Mesh(_sparkleFlareVGeo, fMat2);
  fd1.rotation.z = Math.PI / 4;
  fd2.rotation.z = Math.PI / 4;
  flareGroup.add(fh, fv, fd1, fd2);
  flareGroup.scale.setScalar(isCrit ? 2.4 : 1.65);
  scene.add(flareGroup);
  fxList.push({
    mesh: flareGroup,
    t: 0,
    dur: isCrit ? 0.36 : 0.26,
    update: (p) => {
      flareGroup.rotation.y += 0.22;
      flareGroup.rotation.z += 0.18;
      const pulse = (1 - p) * (1.0 + Math.sin(p * 18) * 0.25);
      flareGroup.scale.setScalar(
        (isCrit ? 2.5 : 1.7) * Math.max(0.05, pulse),
      );
      fMat1.opacity = (1 - p) * 0.95;
      fMat2.opacity = (1 - p) * 0.88;
    },
  });

  // Twinkling 3D diamond star-glints scattering outward
  for (let i = 0; i < count; i++) {
    const col = palette[i % palette.length];
    const sMat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spark = new THREE.Mesh(_sparkleDiamondGeo, sMat);
    const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const rad = 0.25 + Math.random() * 0.55;
    spark.position.set(
      pos.x + Math.cos(ang) * rad,
      baseY + (Math.random() - 0.5) * 0.7,
      pos.z + Math.sin(ang) * rad,
    );
    spark.scale.set(0.65, 1.45, 0.65);
    scene.add(spark);
    const spd = (isCrit ? 7.5 : 5.2) + Math.random() * 6.5;
    const vy = 2.6 + Math.random() * 5.2;
    const phase = i * 1.7 + Math.random() * 2.0;
    fxList.push({
      mesh: spark,
      t: 0,
      dur: (isCrit ? 0.48 : 0.36) + Math.random() * 0.16,
      update: (p) => {
        spark.position.x += Math.cos(ang) * spd * 0.016;
        spark.position.z += Math.sin(ang) * spd * 0.016;
        spark.position.y += (vy - p * 9.5) * 0.016;
        spark.rotation.y += 0.28;
        spark.rotation.x += 0.22;
        const twinkle =
          (0.45 + 0.75 * Math.abs(Math.sin(p * 24 + phase))) *
          (1 - p * 0.85);
        spark.scale.set(0.65 * twinkle, 1.55 * twinkle, 0.65 * twinkle);
        sMat.opacity = (1 - p) * 0.96;
      },
    });
  }
}

function spawnUltraMaxSlashArc(hero) {
  if (!hero || !hero.heroCfg) return;
  const isRanged = hero.heroCfg.rangeType === "Ranged";
  const group = new THREE.Group();
  const arcGeo1 = new THREE.RingGeometry(
    isRanged ? 1.4 : 2.15,
    isRanged ? 1.95 : 3.45,
    28,
    1,
    -Math.PI * 0.46,
    Math.PI * 0.92,
  );
  arcGeo1.rotateX(-Math.PI / 2);
  const arcMat1 = new THREE.MeshBasicMaterial({
    color: hero.heroCfg.primaryHex,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const m1 = new THREE.Mesh(arcGeo1, arcMat1);
  group.add(m1);

  const arcGeo2 = new THREE.RingGeometry(
    isRanged ? 1.15 : 1.75,
    isRanged ? 1.5 : 2.55,
    24,
    1,
    -Math.PI * 0.38,
    Math.PI * 0.76,
  );
  arcGeo2.rotateX(-Math.PI / 2);
  const arcMat2 = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const m2 = new THREE.Mesh(arcGeo2, arcMat2);
  m2.position.y = 0.12;
  group.add(m2);

  // Sparkling Stardust Glints arrayed along the Ultra Max attack arc
  const sparkCount = isRanged ? 10 : 16;
  const sparkMeshes = [];
  const sparkMats = [];
  const rMin = isRanged ? 1.25 : 1.9;
  const rMax = isRanged ? 2.1 : 3.65;
  for (let si = 0; si < sparkCount; si++) {
    const frac = si / Math.max(1, sparkCount - 1) - 0.5;
    const theta = frac * Math.PI * 0.92;
    const rad = THREE.MathUtils.lerp(rMin, rMax, (si % 3) / 2);
    const sCol =
      si % 3 === 0
        ? 0xffffff
        : si % 3 === 1
          ? hero.heroCfg.primaryHex
          : hero.heroCfg.secondaryHex || 0xfef08a;
    const sMat = new THREE.MeshBasicMaterial({
      color: sCol,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sp = new THREE.Mesh(_sparkleDiamondGeo, sMat);
    sp.position.set(
      Math.cos(theta) * rad,
      0.14 + ((si % 3) - 1) * 0.16,
      Math.sin(theta) * rad,
    );
    sp.scale.set(0.65, 1.45, 0.65);
    group.add(sp);
    sparkMeshes.push(sp);
    sparkMats.push(sMat);
  }

  const comboTilt = ((hero.atkComboIndex || 0) - 1) * 0.42;
  group.position
    .copy(hero.mesh.position)
    .add(new THREE.Vector3(0, 1.65, 0));
  group.rotation.y = hero.mesh.rotation.y - Math.PI / 2;
  group.rotation.z = comboTilt;
  scene.add(group);

  fxList.push({
    mesh: group,
    t: 0,
    dur: 0.32,
    update: (p) => {
      group.scale.setScalar(0.85 + p * 0.6);
      group.rotation.y += 0.18;
      arcMat1.opacity = (1 - p) * 0.94;
      arcMat2.opacity = (1 - p) * 0.82;
      for (let si = 0; si < sparkMeshes.length; si++) {
        const sp = sparkMeshes[si];
        const tw =
          (0.45 + 0.85 * Math.abs(Math.sin(p * 26 + si * 1.5))) *
          (1 - p * 0.7);
        sp.scale.set(0.65 * tw, 1.55 * tw, 0.65 * tw);
        sp.rotation.y += 0.35;
        sp.position.y += 0.015;
        sparkMats[si].opacity = (1 - p) * 0.96;
      }
    },
  });
}

function executeAutoAttack(
  attacker,
  target,
  isVisualReplay = false,
  forcedCrit = false,
) {
  if (!isVisualReplay) {
    if (target.type === "ancient" && hasAnyAliveTower(target.team)) {
      attacker.targetUnit = null;
      attacker._inAttackRange = false;
      return;
    }
    attacker.atkTimer = attacker.getEffectiveAtkCd();
  }
  attacker.swingAnim = 0.34;
  attacker.atkComboIndex = ((attacker.atkComboIndex || 0) + 1) % 3;

  const dx = target.mesh.position.x - attacker.mesh.position.x;
  const dz = target.mesh.position.z - attacker.mesh.position.z;
  if (
    [
      "hero",
      "creep",
      "neutral",
      "vampire",
      "werewolf",
      "boss",
      "dragon",
      "kong",
      "redman",
      "sneakygolem",
    ].includes(attacker.type)
  ) {
    attacker.mesh.rotation.y = Math.atan2(dx, dz);
  }
  if (
    attacker.type === "hero" &&
    attacker.heroCfg &&
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax"
  ) {
    spawnUltraMaxSlashArc(attacker);
  }

  // Dota 2 Uphill High-Ground Miss Mechanic (20% miss when attacking from river y < 0.15 up to y > 1.15)
  if (
    !isVisualReplay &&
    attacker.type === "hero" &&
    target.type !== "tower" &&
    target.type !== "ancient"
  ) {
    const attY = getTerrainHeightAt(
      attacker.mesh.position.x,
      attacker.mesh.position.z,
    );
    const tgtY = getTerrainHeightAt(
      target.mesh.position.x,
      target.mesh.position.z,
    );
    if (attY < 0.15 && tgtY > 1.15 && Math.random() < 0.2) {
      spawnFloatText(target.mesh.position, "UPHILL MISS!", "#94a3b8", 13);
      return;
    }
  }

  if (!isVisualReplay) {
    if (attacker.type === "dragon") {
      attacker.dragonAnimState = "LUNGE_BITE";
      attacker.dragonAnimTimer = 0.55;
      if (Math.random() < 0.28) {
        target.stunTimer = Math.max(target.stunTimer, 1.15);
        spawnFloatText(
          target.mesh.position,
          "DRAGON JAW CRUSH!",
          "#fb923c",
          15,
        );
        mpQueueFxEvent([
          "T",
          Math.round(target.mesh.position.x),
          Math.round(target.mesh.position.z),
          "DRAGON JAW CRUSH!",
          "#fb923c",
          15,
        ]);
      }
    } else if (attacker.type === "boss" && Math.random() < 0.25) {
      target.stunTimer = Math.max(target.stunTimer, 1.2);
      spawnFloatText(target.mesh.position, "ROSHAN BASH!", "#fb923c", 14);
      mpQueueFxEvent([
        "T",
        Math.round(target.mesh.position.x),
        Math.round(target.mesh.position.z),
        "ROSHAN BASH!",
        "#fb923c",
        14,
      ]);
    } else if (
      attacker.type === "kong" &&
      Math.random() < (attacker.ancientFuryTimer > 0 ? 0.45 : 0.25)
    ) {
      target.stunTimer = Math.max(
        target.stunTimer,
        attacker.ancientFuryTimer > 0 ? 1.45 : 1.1,
      );
      const kTxt =
        attacker.ancientFuryTimer > 0
          ? "ENRAGED KONG CRUSH!"
          : "KING KONG CRUSH!";
      spawnFloatText(target.mesh.position, kTxt, "#facc15", 15);
      mpQueueFxEvent([
        "T",
        Math.round(target.mesh.position.x),
        Math.round(target.mesh.position.z),
        kTxt,
        "#facc15",
        15,
      ]);
    } else if (
      attacker.type === "redman" &&
      Math.random() < (attacker.ancientFuryTimer > 0 ? 0.48 : 0.28)
    ) {
      target.stunTimer = Math.max(
        target.stunTimer,
        attacker.ancientFuryTimer > 0 ? 1.5 : 1.2,
      );
      const rTxt =
        attacker.ancientFuryTimer > 0
          ? "ENRAGED HELLFIRE CLEAVE!"
          : "RED MAN CLEAVE!";
      spawnFloatText(target.mesh.position, rTxt, "#ef4444", 15);
      mpQueueFxEvent([
        "T",
        Math.round(target.mesh.position.x),
        Math.round(target.mesh.position.z),
        rTxt,
        "#ef4444",
        15,
      ]);
    } else if (
      attacker.type === "sneakygolem" &&
      Math.random() < (attacker.ancientFuryTimer > 0 ? 0.52 : 0.32)
    ) {
      target.stunTimer = Math.max(
        target.stunTimer,
        attacker.ancientFuryTimer > 0 ? 1.65 : 1.3,
      );
      const sgTxt =
        attacker.ancientFuryTimer > 0
          ? "ENRAGED SNEAKY GOLEM CRUSH!"
          : "SNEAKY GOLEM SLAM!";
      spawnFloatText(target.mesh.position, sgTxt, "#f472b6", 16);
      mpQueueFxEvent([
        "T",
        Math.round(target.mesh.position.x),
        Math.round(target.mesh.position.z),
        sgTxt,
        "#f472b6",
        16,
      ]);
    }
  } else if (attacker.type === "dragon") {
    attacker.dragonAnimState = "LUNGE_BITE";
    attacker.dragonAnimTimer = 0.55;
  }

  const hid =
    attacker.type === "hero" && attacker.heroCfg
      ? attacker.heroCfg.id
      : "";
  let bonusCritChance = 0;
  let bonusDamageMult = 1.0;
  let flatBonusDmg = 0;

  if (hid === "sylphira") {
    const nearFoe = findNearestTarget(attacker, 6.5, false, true);
    if (!nearFoe) {
      bonusDamageMult *= 1.22;
      bonusCritChance += 0.15;
    }
  } else if (hid === "vespera") {
    const tgtFwdX = Math.sin(target.mesh.rotation.y);
    const tgtFwdZ = Math.cos(target.mesh.rotation.y);
    const toTgtLen = Math.max(0.01, Math.hypot(dx, dz));
    const dotBack = (dx / toTgtLen) * tgtFwdX + (dz / toTgtLen) * tgtFwdZ;
    if (dotBack > 0.35) {
      bonusDamageMult *= 1.35;
      if (!isVisualReplay)
        spawnFloatText(target.mesh.position, "BACKSTAB!", "#e879f9", 13);
    }
  } else if (hid === "garrick") {
    bonusCritChance += 0.24;
  } else if (hid === "seraphina" && attacker.lunarEmpowerReady) {
    attacker.lunarEmpowerReady = false;
    flatBonusDmg += 60;
    if (
      !isVisualReplay &&
      target.type !== "tower" &&
      target.type !== "ancient"
    ) {
      target.slowTimer = Math.max(target.slowTimer, 2.2);
      target.slowFactor = Math.min(target.slowFactor, 0.7);
    }
    spawnShockwaveRing(
      target.mesh.position.x,
      target.mesh.position.z,
      2.8,
      0x2dd4bf,
      0.32,
    );
  }

  const totalCritChance = Math.min(
    0.95,
    (attacker.critChance || 0) + bonusCritChance,
  );
  const isCrit = isVisualReplay
    ? forcedCrit
    : totalCritChance > 0 && Math.random() < totalCritChance;
  if (!isVisualReplay && mpState.active && mpState.role === "host") {
    mpQueueFxEvent([
      "A",
      attacker.netId || attacker.id,
      target.netId || target.id,
      isCrit ? 1 : 0,
    ]);
  }

  const guardianFuryMult =
    (attacker.type === "kong" ||
      attacker.type === "redman" ||
      attacker.type === "sneakygolem") &&
    attacker.ancientFuryTimer > 0
      ? 1.35
      : 1.0;
  const dmg =
    ((isCrit
      ? attacker.atkDamage * attacker.critMult
      : attacker.atkDamage) *
      bonusDamageMult +
      flatBonusDmg) *
    guardianFuryMult;

  if (attacker.isPlayer) {
    sfx.play(
      isCrit
        ? "crit"
        : attacker.atkRange > 4.0
          ? "attack_ranged"
          : "attack_melee",
    );
    if (isCrit) triggerCombatImpactFeel(0.025, 0.65, 0.38);
  }

  if (attacker.atkRange <= 4.6) {
    if (!isVisualReplay) {
      target.takeDamage(dmg, attacker, isCrit);
      if (target.type === "tower") {
        const camDist = Math.hypot(
          target.mesh.position.x - cameraFocus.x,
          target.mesh.position.z - cameraFocus.z,
        );
        const heroDist =
          playerHero && !playerHero.dead
            ? Math.hypot(
                target.mesh.position.x - playerHero.mesh.position.x,
                target.mesh.position.z - playerHero.mesh.position.z,
              )
            : Infinity;
        const nearDist = Math.min(camDist, heroDist);
        if (nearDist <= 42.0) sfx.play("tower_hit", nearDist);
      }
      if (
        attacker.hasSkadi &&
        target.type !== "tower" &&
        target.type !== "ancient"
      ) {
        target.slowTimer = Math.max(target.slowTimer, 2.6);
        target.slowFactor = Math.min(target.slowFactor, 0.55);
      }
      if (attacker.hasDesolator && target.type !== "ancient") {
        target._desolatorShred = Math.min(
          5.0,
          (target._desolatorShred || 0) + 0.8,
        );
        if ((target._desolatorShred || 0) <= 5.0) {
          target.armor = Math.max(-6, target.armor - 0.8);
        }
      }
      if (
        attacker.hasAbyssalBash &&
        target.type !== "tower" &&
        target.type !== "ancient" &&
        Math.random() < 0.22
      ) {
        target.stunTimer = Math.max(target.stunTimer, 0.9);
        target.takeDamage(95, attacker, false);
        spawnFloatText(
          target.mesh.position,
          "ABYSSAL BASH!",
          "#fb7185",
          14,
        );
      }
      if (attacker.hasMjollnir && attacker.atkComboIndex === 0) {
        let bounced = 0;
        units.forEach((foe) => {
          if (
            bounced < 4 &&
            foe !== target &&
            !foe.dead &&
            foe.team !== attacker.team &&
            foe.type !== "ancient" &&
            foe.mesh.position.distanceTo(target.mesh.position) <=
              11.0 + foe.radius
          ) {
            bounced++;
            foe.takeDamage(140, attacker, false);
            spawnLightningBolt3D(
              target.mesh.position,
              foe.mesh.position,
              0x38bdf8,
              0xe0f2fe,
              0.28,
            );
          }
        });
      }
      if (attacker.hasStarforge) {
        spawnShockwaveRing(
          target.mesh.position.x,
          target.mesh.position.z,
          6.5,
          0xfacc15,
          0.35,
        );
        units.forEach((foe) => {
          if (
            foe !== target &&
            !foe.dead &&
            foe.team !== attacker.team &&
            foe.type !== "ancient" &&
            foe.mesh.position.distanceTo(target.mesh.position) <=
              6.5 + foe.radius
          ) {
            foe.takeDamage(115, attacker, false);
            foe.slowTimer = Math.max(foe.slowTimer, 1.5);
            foe.slowFactor = Math.min(foe.slowFactor, 0.75);
          }
        });
      }
      const totalLifesteal =
        (attacker.lifesteal || 0) +
        (attacker.hasVampLeaderBuff ? 0.06 : 0);
      if (
        totalLifesteal > 0 &&
        target.type !== "tower" &&
        target.type !== "ancient"
      )
        attacker.hp = Math.min(
          attacker.maxHp,
          attacker.hp + dmg * totalLifesteal,
        );
      if (
        (attacker.type === "vampire" || attacker.type === "werewolf") &&
        target.type !== "tower" &&
        target.type !== "ancient"
      )
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * 0.35);

      if (hid === "aurelius" && attacker.atkComboIndex === 0) {
        spawnShockwaveRing(
          attacker.mesh.position.x,
          attacker.mesh.position.z,
          4.4,
          0xfacc15,
          0.36,
        );
        units.forEach((other) => {
          if (
            other !== target &&
            !other.dead &&
            other.team !== attacker.team &&
            other.type !== "ancient" &&
            other.mesh.position.distanceTo(attacker.mesh.position) <=
              4.4 + other.radius
          ) {
            other.takeDamage(dmg * 0.45, attacker, false);
          }
        });
      }
    }
    const slashCol =
      attacker.type === "sneakygolem"
        ? 0xff4dff
        : attacker.heroCfg
          ? attacker.heroCfg.primaryHex
          : attacker.team === "radiant"
            ? 0x34d399
            : attacker.team === "neutral"
              ? 0xf59e0b
              : 0xf43f5e;
    if (
      attacker.type === "hero" ||
      attacker.type === "vampire" ||
      attacker.type === "werewolf" ||
      attacker.type === "boss" ||
      attacker.type === "kong" ||
      attacker.type === "redman" ||
      attacker.type === "sneakygolem"
    ) {
      const slashYaw =
        attacker.mesh.rotation.y +
        (attacker.atkComboIndex === 1
          ? -0.35
          : attacker.atkComboIndex === 2
            ? 0.25
            : 0);
      spawnMeleeSlashArc(
        attacker.mesh.position,
        slashYaw,
        attacker.atkRange + 1.25,
        slashCol,
        0.26,
      );
    }
    if (
      attacker.type === "hero" &&
      attacker.heroCfg &&
      typeof userSettings !== "undefined" &&
      userSettings.qualityPreset === "ultramax"
    ) {
      spawnHeroAttackSparkles(
        target.mesh.position,
        attacker.heroCfg.primaryHex,
        attacker.heroCfg.secondaryHex,
        isCrit,
      );
    }
    spawnShockwaveRing(
      target.mesh.position.x,
      target.mesh.position.z,
      isCrit ? 2.1 : 1.35,
      slashCol,
      0.24,
    );
  } else {
    const isTower = attacker.type === "tower";
    const isUmaxHeroProj =
      attacker.type === "hero" &&
      attacker.heroCfg &&
      typeof userSettings !== "undefined" &&
      userSettings.qualityPreset === "ultramax";
    const col = isCrit
      ? 0xfb923c
      : attacker.heroCfg
        ? attacker.heroCfg.primaryHex
        : attacker.type === "dragon"
          ? 0xf97316
          : attacker.team === "radiant"
            ? 0x38bdf8
            : 0xf43f5e;
    const orbRad = isTower
      ? 0.68
      : attacker.type === "dragon"
        ? 0.85
        : isCrit
          ? 0.5
          : 0.38;
    const launchPos = new THREE.Vector3(
      attacker.mesh.position.x,
      isTower ? 7.8 : attacker.type === "dragon" ? 5.2 : 1.85,
      attacker.mesh.position.z,
    );
    const orb = new THREE.Mesh(
      SHARED_GEO.orb,
      getCachedBasicMat(col, false, 1.0, false),
    );
    orb.scale.setScalar(orbRad);
    orb.position.copy(launchPos);
    if (isUmaxHeroProj) {
      const starHalo = new THREE.Mesh(
        _sparkleDiamondGeo,
        _umaxStarHaloMat,
      );
      starHalo.scale.set(2.8, 2.8, 2.8);
      orb.add(starHalo);
      spawnHeroAttackSparkles(
        launchPos,
        attacker.heroCfg.primaryHex,
        attacker.heroCfg.secondaryHex,
        false,
      );
    }
    scene.add(orb);
    const totalDist = Math.max(
      1.0,
      launchPos.distanceTo(target.mesh.position),
    );
    projectiles.push({
      kind: "homing",
      owner: attacker,
      target,
      mesh: orb,
      speed: isTower ? 31 : 36,
      damage: dmg,
      isCrit,
      shared: true,
      startPos: launchPos.clone(),
      totalDist,
      arcHeight: isTower ? 0.6 : Math.min(2.2, totalDist * 0.11),
      trailCol: col,
      isUmaxHeroProj,
    });

    if (!isVisualReplay && hid === "aurelia") {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + 18);
      let lowestAlly = null;
      let lowestRatio = 1.0;
      units.forEach((ally) => {
        if (
          ally !== attacker &&
          !ally.dead &&
          ally.team === attacker.team &&
          ally.type === "hero" &&
          ally.mesh.position.distanceTo(attacker.mesh.position) <= 14
        ) {
          const r = ally.hp / ally.maxHp;
          if (r < lowestRatio) {
            lowestRatio = r;
            lowestAlly = ally;
          }
        }
      });
      if (lowestAlly)
        lowestAlly.hp = Math.min(lowestAlly.maxHp, lowestAlly.hp + 18);
    }

    if (
      !isVisualReplay &&
      hid === "solenne" &&
      attacker.atkComboIndex === 0
    ) {
      const secondTgt = units.find(
        (u) =>
          u !== target &&
          !u.dead &&
          u.team !== attacker.team &&
          u.type !== "ancient" &&
          u.mesh.position.distanceTo(attacker.mesh.position) <=
            attacker.atkRange + 3.0,
      );
      if (secondTgt) {
        const orb2 = new THREE.Mesh(
          SHARED_GEO.orb,
          getCachedBasicMat(0x38bdf8, false, 1.0, false),
        );
        orb2.scale.setScalar(0.32);
        orb2.position.copy(launchPos);
        scene.add(orb2);
        const d2 = Math.max(
          1.0,
          launchPos.distanceTo(secondTgt.mesh.position),
        );
        projectiles.push({
          kind: "homing",
          owner: attacker,
          target: secondTgt,
          mesh: orb2,
          speed: 38,
          damage: dmg * 0.65,
          isCrit: false,
          shared: true,
          startPos: launchPos.clone(),
          totalDist: d2,
          arcHeight: 1.2,
          trailCol: 0x38bdf8,
        });
      }
    }

    if (
      !isVisualReplay &&
      hid === "zephyros" &&
      attacker.staticOverloadReady
    ) {
      attacker.staticOverloadReady = false;
      let zaps = 0;
      units.forEach((foe) => {
        if (
          zaps < 2 &&
          !foe.dead &&
          foe.team !== attacker.team &&
          foe.type !== "ancient" &&
          foe.mesh.position.distanceTo(target.mesh.position) <= 10.0
        ) {
          zaps++;
          spawnLightningBolt3D(
            target.mesh.position,
            foe.mesh.position,
            0xffffff,
            0x38bdf8,
            0.35,
          );
          foe.takeDamage(55, attacker, false);
        }
      });
    }
  }
}

let _radTowersAliveCache = true;
let _direTowersAliveCache = true;
const _vFountainRad = new THREE.Vector3(-138, 0, 138);
const _vFountainDire = new THREE.Vector3(138, 0, -138);
const _vFountainHealRad = new THREE.Vector3(-140, 0, 140);
const _vFountainHealDire = new THREE.Vector3(140, 0, -140);
const _vRetreatRad = new THREE.Vector3(-52, 0, 52);
const _vRetreatDire = new THREE.Vector3(52, 0, -52);
const _vBaseRad = new THREE.Vector3(-134, 0, 134);
const _vBaseDire = new THREE.Vector3(134, 0, -134);
const _vScratch1 = new THREE.Vector3();
const _vScratch2 = new THREE.Vector3();
const _heroLoopList = [];

const _TOWER_AURA_HERO_STD = Object.freeze({
  bonusArmor: 6,
  dmgReduction: 0.22,
  bonusRegen: 5.0,
  isCitadel: false,
});
const _TOWER_AURA_HERO_CIT = Object.freeze({
  bonusArmor: 9,
  dmgReduction: 0.28,
  bonusRegen: 7.5,
  isCitadel: true,
});
const _TOWER_AURA_UNIT_STD = Object.freeze({
  bonusArmor: 6,
  dmgReduction: 0.22,
  bonusRegen: 2.5,
  isCitadel: false,
});
const _TOWER_AURA_UNIT_CIT = Object.freeze({
  bonusArmor: 9,
  dmgReduction: 0.28,
  bonusRegen: 2.5,
  isCitadel: true,
});

function getAlliedTowerAuraBuff(unit) {
  if (!unit || unit.dead || unit.team === "neutral") return null;
  if (unit.type === "tower" || unit.type === "ancient") return null;
  const ux = unit.mesh.position.x;
  const uz = unit.mesh.position.z;
  let bestCitadel = false;
  let found = false;
  const srcList = staticStructures.length > 0 ? staticStructures : units;
  for (let i = 0; i < srcList.length; i++) {
    const t = srcList[i];
    if (t.dead || t.type !== "tower" || t.team !== unit.team) continue;
    if (t._isCitadelCached === undefined)
      t._isCitadelCached = Boolean(t.name && t.name.includes("Citadel"));
    const auraRad = Math.max(18.5, t.atkRange || 16.5);
    const dx = ux - t.mesh.position.x;
    if (dx > auraRad || dx < -auraRad) continue;
    const dz = uz - t.mesh.position.z;
    if (dz > auraRad || dz < -auraRad) continue;
    if (dx * dx + dz * dz <= auraRad * auraRad) {
      found = true;
      if (t._isCitadelCached) bestCitadel = true;
    }
  }
  if (!found) return null;
  if (unit.type === "hero")
    return bestCitadel ? _TOWER_AURA_HERO_CIT : _TOWER_AURA_HERO_STD;
  return bestCitadel ? _TOWER_AURA_UNIT_CIT : _TOWER_AURA_UNIT_STD;
}

// 24x24 Spatial Hash Grid (16m cells across 380x380 arena) for O(1) neighbor target queries
const _SPATIAL_CELL = 16.0;
const _SPATIAL_DIM = 24;
const _spatialBuckets = Array.from(
  { length: _SPATIAL_DIM * _SPATIAL_DIM },
  () => [],
);
let _spatialGridValid = false;

function rebuildUnitSpatialGrid() {
  for (let b = 0; b < _spatialBuckets.length; b++)
    _spatialBuckets[b].length = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.dead || u.reincarnating) continue;
    const cx = Math.max(
      0,
      Math.min(
        _SPATIAL_DIM - 1,
        ((u.mesh.position.x + MAP_HALF) / _SPATIAL_CELL) | 0,
      ),
    );
    const cz = Math.max(
      0,
      Math.min(
        _SPATIAL_DIM - 1,
        ((u.mesh.position.z + MAP_HALF) / _SPATIAL_CELL) | 0,
      ),
    );
    _spatialBuckets[cz * _SPATIAL_DIM + cx].push(u);
  }
  _spatialGridValid = true;
}

const _spatialQueryBufA = [];
const _spatialQueryBufB = [];
function querySpatialUnits(
  cxWorld,
  czWorld,
  radius,
  outBuf = _spatialQueryBufA,
) {
  outBuf.length = 0;
  if (!_spatialGridValid || radius > 40) {
    for (let i = 0; i < units.length; i++) outBuf.push(units[i]);
    return outBuf;
  }
  const minCx = Math.max(
    0,
    Math.min(
      _SPATIAL_DIM - 1,
      ((cxWorld - radius + MAP_HALF) / _SPATIAL_CELL) | 0,
    ),
  );
  const maxCx = Math.max(
    0,
    Math.min(
      _SPATIAL_DIM - 1,
      ((cxWorld + radius + MAP_HALF) / _SPATIAL_CELL) | 0,
    ),
  );
  const minCz = Math.max(
    0,
    Math.min(
      _SPATIAL_DIM - 1,
      ((czWorld - radius + MAP_HALF) / _SPATIAL_CELL) | 0,
    ),
  );
  const maxCz = Math.max(
    0,
    Math.min(
      _SPATIAL_DIM - 1,
      ((czWorld + radius + MAP_HALF) / _SPATIAL_CELL) | 0,
    ),
  );
  for (let cz = minCz; cz <= maxCz; cz++) {
    const rowOff = cz * _SPATIAL_DIM;
    for (let cx = minCx; cx <= maxCx; cx++) {
      const bucket = _spatialBuckets[rowOff + cx];
      for (let i = 0; i < bucket.length; i++) outBuf.push(bucket[i]);
    }
  }
  return outBuf;
}

function findNearestTarget(
  unit,
  range,
  preferLowHp = false,
  includeNeutrals = false,
) {
  let best = null;
  let bestScore = Infinity;
  const rangeSq = range * range;
  const ux = unit.mesh.position.x;
  const uz = unit.mesh.position.z;
  if (_spatialGridValid && range <= 40) {
    const minCx = Math.max(
      0,
      Math.min(
        _SPATIAL_DIM - 1,
        ((ux - range + MAP_HALF) / _SPATIAL_CELL) | 0,
      ),
    );
    const maxCx = Math.max(
      0,
      Math.min(
        _SPATIAL_DIM - 1,
        ((ux + range + MAP_HALF) / _SPATIAL_CELL) | 0,
      ),
    );
    const minCz = Math.max(
      0,
      Math.min(
        _SPATIAL_DIM - 1,
        ((uz - range + MAP_HALF) / _SPATIAL_CELL) | 0,
      ),
    );
    const maxCz = Math.max(
      0,
      Math.min(
        _SPATIAL_DIM - 1,
        ((uz + range + MAP_HALF) / _SPATIAL_CELL) | 0,
      ),
    );
    for (let cz = minCz; cz <= maxCz; cz++) {
      const rowOff = cz * _SPATIAL_DIM;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = _spatialBuckets[rowOff + cx];
        for (let i = 0; i < bucket.length; i++) {
          const other = bucket[i];
          if (
            other.dead ||
            other.reincarnating ||
            other.team === unit.team
          )
            continue;
          if (other.team === "neutral" && !includeNeutrals) continue;
          if (other.type === "ancient" && hasAnyAliveTower(other.team)) continue;
          if (getStructureTierLockReason(other)) continue;
          const dx = ux - other.mesh.position.x;
          if (dx > range || dx < -range) continue;
          const dz = uz - other.mesh.position.z;
          if (dz > range || dz < -range) continue;
          const dSq = dx * dx + dz * dz;
          if (dSq <= rangeSq) {
            let score = preferLowHp
              ? other.hp + Math.sqrt(dSq) * 7
              : dSq;
            if (unit.type === "creep" && other.type === "tower") {
              score *= 0.45;
            }
            if (score < bestScore) {
              bestScore = score;
              best = other;
            }
          }
        }
      }
    }
    return best;
  }
  for (let i = 0; i < units.length; i++) {
    const other = units[i];
    if (other.dead || other.reincarnating || other.team === unit.team)
      continue;
    if (other.team === "neutral" && !includeNeutrals) continue;
    if (other.type === "ancient" && hasAnyAliveTower(other.team)) continue;
    if (getStructureTierLockReason(other)) continue;
    const dx = ux - other.mesh.position.x;
    if (dx > range || dx < -range) continue;
    const dz = uz - other.mesh.position.z;
    if (dz > range || dz < -range) continue;
    const dSq = dx * dx + dz * dz;
    if (dSq <= rangeSq) {
      let score = preferLowHp ? other.hp + Math.sqrt(dSq) * 7 : dSq;
      if (unit.type === "creep" && other.type === "tower") {
        score *= 0.45;
      }
      if (score < bestScore) {
        bestScore = score;
        best = other;
      }
    }
  }
  return best;
}

function findGuardianTarget(guardian, range, guardRadius) {
  let bestHero = null;
  let bestHeroDistSq = Infinity;
  let bestOther = null;
  let bestOtherDistSq = Infinity;
  const rangeSq = range * range;
  const maxHomeSq = (guardRadius + 8.0) * (guardRadius + 8.0);
  const ancientX = guardian.team === "radiant" ? -96 : 96;
  const ancientZ = guardian.team === "radiant" ? 96 : -96;
  const ancientWatchSq = 48.0 * 48.0;
  const gx = guardian.mesh.position.x;
  const gz = guardian.mesh.position.z;
  const hx = guardian.homePos.x;
  const hz = guardian.homePos.z;
  for (let i = 0; i < units.length; i++) {
    const other = units[i];
    if (
      other.dead ||
      other.reincarnating ||
      other.team === guardian.team ||
      other.team === "neutral"
    )
      continue;
    if (getStructureTierLockReason(other)) continue;
    const ox = other.mesh.position.x;
    const oz = other.mesh.position.z;
    const dGSq = (gx - ox) * (gx - ox) + (gz - oz) * (gz - oz);
    const dHSq = (hx - ox) * (hx - ox) + (hz - oz) * (hz - oz);
    const dAncientSq =
      (ancientX - ox) * (ancientX - ox) +
      (ancientZ - oz) * (ancientZ - oz);
    const nearAncient = dAncientSq <= ancientWatchSq;
    if (dGSq > rangeSq && !nearAncient) continue;
    if (dHSq <= maxHomeSq || nearAncient) {
      if (other.type === "hero") {
        const scoreSq = nearAncient ? Math.min(dGSq, dAncientSq) : dGSq;
        if (scoreSq < bestHeroDistSq) {
          bestHeroDistSq = scoreSq;
          bestHero = other;
        }
      } else if (dGSq < bestOtherDistSq) {
        bestOtherDistSq = dGSq;
        bestOther = other;
      }
    }
  }
  return bestHero || bestOther;
}

// Tactical Grandmaster & Infinity Apex Hero AI: Velocity-Lead Skillshots, Active Relic Chains, Orb-Walking Kiting, Objective & Base Defense
function updateAIHeroes(dt) {
  const prof =
    AI_DIFFICULTY_PROFILES[aiDifficulty] ||
    AI_DIFFICULTY_PROFILES.veteran;
  const isInfinityMode = aiDifficulty === "infinity";
  const stdItemBuild = [
    "treads",
    "vanguard",
    "desolator",
    "kaya_sange",
    "mjollnir",
    "heart",
  ];
  const infCarryBuild = [
    "travel_boots",
    "bkb",
    "abyssal_blade",
    "daedalus",
    "satanic",
    "apocalypse_starforge",
  ];
  const infCasterBuild = [
    "travel_boots",
    "bkb",
    "vyse",
    "octarine_core",
    "dagon_5",
    "crown_of_infinity",
  ];

  const _aiUpAxis = _vScratch2.set(0, 1, 0);
  // Track real-time velocity of all heroes for predictive skillshot leading in Infinity mode
  for (let i = 0; i < _heroLoopList.length; i++) {
    const h = _heroLoopList[i];
    if (!h || h.dead) continue;
    const hx = h.mesh.position.x;
    const hz = h.mesh.position.z;
    if (h._aiLastX !== undefined && dt > 0.0005) {
      const instVx = (hx - h._aiLastX) / dt;
      const instVz = (hz - h._aiLastZ) / dt;
      h._aiVx = (h._aiVx || 0) * 0.65 + instVx * 0.35;
      h._aiVz = (h._aiVz || 0) * 0.65 + instVz * 0.35;
    }
    h._aiLastX = hx;
    h._aiLastZ = hz;
  }

  const getLeadAimPos = (caster, target, projSpeed = 28) => {
    if (!isInfinityMode || !target) return target.mesh.position;
    const dist = caster.mesh.position.distanceTo(target.mesh.position);
    const travelT = Math.min(0.85, dist / Math.max(12, projSpeed));
    const px = THREE.MathUtils.clamp(
      target.mesh.position.x + (target._aiVx || 0) * travelT,
      -MAP_HALF + 3,
      MAP_HALF - 3,
    );
    const pz = THREE.MathUtils.clamp(
      target.mesh.position.z + (target._aiVz || 0) * travelT,
      -MAP_HALF + 3,
      MAP_HALF - 3,
    );
    if (!caster._aiLeadVec) caster._aiLeadVec = new THREE.Vector3();
    caster._aiLeadVec.set(px, 0, pz);
    return caster._aiLeadVec;
  };

  const triggerBotActiveItem = (bot, activeKey, aimPos) => {
    const slotIdx = bot.inventory.findIndex(
      (it) => it && it.active === activeKey,
    );
    if (slotIdx === -1) return false;
    if ((bot.itemCooldowns[activeKey] || 0) > 0) return false;
    executeHeroInventoryItem(bot, slotIdx, aimPos || bot.mesh.position);
    return true;
  };

  aiHeroes.forEach((bot) => {
    if (
      !bot ||
      bot.dead ||
      bot.reincarnating ||
      bot.stunTimer > 0 ||
      gameOver
    )
      return;

    if (prof.autoBuy) {
      const nextSlot = bot.inventory.findIndex((s) => s === null);
      if (nextSlot !== -1) {
        const isCaster =
          bot.heroCfg && bot.heroCfg.attr === "Intelligence";
        const buildArr = isInfinityMode
          ? isCaster
            ? infCasterBuild
            : infCarryBuild
          : stdItemBuild;
        const candidateId = buildArr.find(
          (id) =>
            !bot.inventory.some((invIt) => invIt && invIt.id === id),
        );
        const targetItem = candidateId
          ? SHOP_ITEM_BY_ID.get(candidateId)
          : null;
        if (
          targetItem &&
          !isItemAlreadyOwned(bot, targetItem) &&
          bot.gold >= targetItem.cost
        ) {
          bot.gold -= targetItem.cost;
          bot.inventory[nextSlot] = targetItem;
          applyItemStatsToHero(bot, targetItem);
          spawnFloatText(
            bot.mesh.position,
            `${bot.name} acquired ${targetItem.name}!`,
            "#fb7185",
            14,
          );
        }
      }
    }

    bot.aiThinkTimer -= dt;
    if (bot.aiThinkTimer > 0) return;
    bot.aiThinkTimer = prof.reactionDelay;

    const isRad = bot.team === "radiant";
    const pos = bot.mesh.position;
    const fountain = isRad ? _vFountainRad : _vFountainDire;
    const retreatPt = isRad ? _vRetreatRad : _vRetreatDire;
    const inFountain = pos.distanceToSquared(fountain) <= 81;

    // 0. In Infinity Mode: Heal in fountain until > 84% HP before re-engaging
    if (isInfinityMode && inFountain && bot.hp < bot.maxHp * 0.84) {
      bot.targetUnit = null;
      bot.targetPos = fountain;
      return;
    }

    // 1. Tactical Retreat when Low HP (with Blink/Mobility escape in Infinity)
    const retreatThreshold = isInfinityMode ? 0.3 : 0.34;
    if (
      bot.hp < bot.maxHp * retreatThreshold &&
      pos.distanceToSquared(fountain) > 49
    ) {
      bot.targetUnit = null;
      bot.targetPos = fountain;
      if (isInfinityMode) {
        triggerBotActiveItem(bot, "manta", pos);
        triggerBotActiveItem(bot, "blink", fountain);
      }
      if (bot.cooldowns.W <= 0 && bot.mana >= 60)
        castHeroAbility(bot, "W", fountain);
      return;
    }

    // 2. Dodge Incoming Wave Skillshots & Active Enemy Ground Hazard Zones
    if (prof.comboSmart) {
      const incomingWave = projectiles.find(
        (p) =>
          p.kind === "wave" &&
          p.team !== bot.team &&
          p.mesh.position.distanceToSquared(pos) <
            (isInfinityMode ? 225.0 : 144.0),
      );
      if (incomingWave) {
        _vScratch1
          .set(-incomingWave.dir.z, 0, incomingWave.dir.x)
          .normalize();
        if (isInfinityMode && (bot.id + Math.floor(matchTime)) % 2 === 1)
          _vScratch1.negate();
        bot.targetUnit = null;
        if (!bot._aiDodgePos) bot._aiDodgePos = new THREE.Vector3();
        bot._aiDodgePos
          .copy(pos)
          .addScaledVector(_vScratch1, isInfinityMode ? 7.8 : 6.5);
        bot.targetPos = bot._aiDodgePos;
        return;
      }
      if (
        isInfinityMode &&
        typeof activeZones !== "undefined" &&
        Array.isArray(activeZones)
      ) {
        const dangerZone = activeZones.find(
          (z) =>
            z &&
            z.team !== bot.team &&
            z.damagePerSec > 0 &&
            Math.hypot(pos.x - z.x, pos.z - z.z) <=
              (z.radius || 5.0) + 1.5,
        );
        if (dangerZone) {
          _vScratch1.set(pos.x - dangerZone.x, 0, pos.z - dangerZone.z);
          if (_vScratch1.lengthSq() < 0.01)
            _vScratch1.set(retreatPt.x - pos.x, 0, retreatPt.z - pos.z);
          _vScratch1.normalize();
          if (!bot._aiDodgePos) bot._aiDodgePos = new THREE.Vector3();
          bot._aiDodgePos
            .copy(pos)
            .addScaledVector(
              _vScratch1,
              (dangerZone.radius || 5.0) + 4.5,
            );
          bot.targetUnit = null;
          bot.targetPos = bot._aiDodgePos;
          return;
        }
      }
    }

    // 3. Tower Aggro Safety Check (Infinity AI dives only for guaranteed low-HP hero executes)
    const enemyTower = units.find(
      (u) =>
        !u.dead &&
        u.team !== bot.team &&
        u.type === "tower" &&
        u.mesh.position.distanceToSquared(pos) <
          (u.atkRange + 1.8) * (u.atkRange + 1.8),
    );
    if (enemyTower) {
      const tRangeSq = enemyTower.atkRange * enemyTower.atkRange;
      const hasCreepCover = units.some(
        (u) =>
          !u.dead &&
          u.team === bot.team &&
          u.type === "creep" &&
          u.mesh.position.distanceToSquared(enemyTower.mesh.position) <
            tRangeSq,
      );
      const diveKillTarget =
        isInfinityMode &&
        units.find(
          (u) =>
            !u.dead &&
            u.team !== bot.team &&
            u.type === "hero" &&
            u.hp < bot.atkDamage * 2.1 &&
            u.mesh.position.distanceToSquared(pos) < 100,
        );
      if (!hasCreepCover && !diveKillTarget) {
        bot.targetUnit = null;
        const hasAlliedCreepsNearby = units.some(
          (u) =>
            !u.dead &&
            u.team === bot.team &&
            u.type === "creep" &&
            u.mesh.position.distanceToSquared(enemyTower.mesh.position) <=
              (enemyTower.atkRange + 14.0) ** 2,
        );
        if (hasAlliedCreepsNearby) {
          if (!bot._aiTowerSafePos)
            bot._aiTowerSafePos = new THREE.Vector3();
          _vScratch1
            .subVectors(pos, enemyTower.mesh.position)
            .setY(0)
            .normalize();
          bot._aiTowerSafePos
            .copy(enemyTower.mesh.position)
            .addScaledVector(_vScratch1, enemyTower.atkRange + 3.8);
          bot.targetPos = bot._aiTowerSafePos;
        } else {
          bot.targetPos = retreatPt;
        }
        return;
      }
    }

    // 4. Emergency Base & Tower Defense in Infinity Mode
    if (isInfinityMode) {
      const ancX = bot.team === "radiant" ? -96 : 96;
      const ancZ = bot.team === "radiant" ? 96 : -96;
      let baseThreat = null;
      for (let hi = 0; hi < _heroLoopList.length; hi++) {
        const h = _heroLoopList[hi];
        if (!h.dead && h.team !== bot.team) {
          const adx = h.mesh.position.x - ancX,
            adz = h.mesh.position.z - ancZ;
          if (adx * adx + adz * adz <= 1369.0) {
            baseThreat = h;
            break;
          }
        }
      }
      if (
        baseThreat &&
        pos.distanceToSquared(baseThreat.mesh.position) > 225.0
      ) {
        bot.targetUnit = baseThreat;
        bot.targetPos = null;
        return;
      }
    }

    // 5. Predictive Last-Hitting & Denying (higher priority when no enemy hero is dueling in melee range)
    if (prof.comboSmart) {
      let closeDuelist = false;
      if (isInfinityMode) {
        for (let hi = 0; hi < _heroLoopList.length; hi++) {
          const h = _heroLoopList[hi];
          if (
            !h.dead &&
            !h.reincarnating &&
            h.team !== bot.team &&
            h.mesh.position.distanceToSquared(pos) <= 144.0
          ) {
            closeDuelist = true;
            break;
          }
        }
      }
      if (!closeDuelist) {
        const lhRangeSq = (bot.atkRange + 4.5) * (bot.atkRange + 4.5);
        let killableCreep = null;
        for (let ui = 0; ui < units.length; ui++) {
          const u = units[ui];
          if (
            !u.dead &&
            u.type === "creep" &&
            u.hp <= bot.atkDamage * 1.18 &&
            u.mesh.position.distanceToSquared(pos) <= lhRangeSq
          ) {
            killableCreep = u;
            break;
          }
        }
        if (killableCreep) {
          bot.targetUnit = killableCreep;
          bot.targetPos = null;
          if (
            killableCreep.team !== bot.team &&
            killableCreep.hp <= bot.atkDamage * 0.92 &&
            bot.cooldowns.Q <= 0 &&
            bot.mana >= 90
          ) {
            castHeroAbility(bot, "Q", killableCreep.mesh.position);
          }
          return;
        }
      }
    }

    // 6. Enemy Hero Punish Combos, Active Relic Chains & Orb-Walking Kiting
    const heroScanSq = isInfinityMode ? 784.0 : 529.0;
    let enemyHero = null;
    let bestHeroSq = heroScanSq;
    for (let hi = 0; hi < _heroLoopList.length; hi++) {
      const h = _heroLoopList[hi];
      if (!h.dead && !h.reincarnating && h.team !== bot.team) {
        const dSq = h.mesh.position.distanceToSquared(pos);
        if (dSq <= bestHeroSq) {
          bestHeroSq = dSq;
          enemyHero = h;
        }
      }
    }
    if (enemyHero) {
      const distP = Math.sqrt(bestHeroSq);
      const isRangedBot =
        bot.heroCfg && bot.heroCfg.rangeType === "Ranged";

      // Interrupt channeling / teleporting enemy heroes immediately
      if (enemyHero.tpChannel && distP <= 20.0) {
        if (distP <= 14.0)
          triggerBotActiveItem(bot, "hex", enemyHero.mesh.position);
        if (distP <= 8.5)
          triggerBotActiveItem(bot, "abyssal", enemyHero.mesh.position);
        if (bot.cooldowns.Q <= 0 && bot.mana >= 60)
          castHeroAbility(bot, "Q", enemyHero.mesh.position);
        else if (bot.cooldowns.W <= 0 && bot.mana >= 60)
          castHeroAbility(bot, "W", enemyHero.mesh.position);
      }
      if (bot.hp < bot.maxHp * 0.48 && prof.consumableLimit > 0) {
        triggerBotActiveItem(bot, "vitality_elixir", pos);
      }
      if (isInfinityMode) {
        // Active Relic Combo Chain: Hex / Abyssal Stun -> BKB Spell Immunity -> Shiva / Satanic
        if (distP <= 14.0)
          triggerBotActiveItem(bot, "hex", enemyHero.mesh.position);
        if (distP <= 8.5)
          triggerBotActiveItem(bot, "abyssal", enemyHero.mesh.position);
        if (
          distP <= 15.0 &&
          (bot.hp < bot.maxHp * 0.8 || bot.slowTimer > 0)
        ) {
          triggerBotActiveItem(bot, "bkb", pos);
        }
        if (distP <= 11.0) triggerBotActiveItem(bot, "shiva", pos);
        if (distP <= 10.0 && bot.hp < bot.maxHp * 0.65)
          triggerBotActiveItem(bot, "satanic", pos);
        if (bot.slowTimer > 0) triggerBotActiveItem(bot, "manta", pos);
      }

      // Ranged Orb-Walking (kite & strafe between attack cooldowns) vs Melee Lateral Strafe
      if (
        isRangedBot &&
        prof.comboSmart &&
        distP < (isInfinityMode ? 8.2 : 6.8) &&
        bot.atkTimer > 0.14
      ) {
        _vScratch1
          .subVectors(pos, enemyHero.mesh.position)
          .setY(0)
          .normalize();
        if (isInfinityMode) {
          const strafeAngle = (bot.id % 2 === 0 ? 1 : -1) * 0.55;
          _vScratch1.applyAxisAngle(_aiUpAxis, strafeAngle);
        }
        bot.targetUnit = null;
        if (!bot._aiKitePos) bot._aiKitePos = new THREE.Vector3();
        bot._aiKitePos.copy(pos).addScaledVector(_vScratch1, 7.2);
        bot.targetPos = bot._aiKitePos;
      } else if (
        !isRangedBot &&
        isInfinityMode &&
        distP > bot.atkRange + 1.5 &&
        bot.atkTimer > 0.15
      ) {
        // Lateral weave while closing distance to dodge linear skillshots
        _vScratch1
          .subVectors(enemyHero.mesh.position, pos)
          .setY(0)
          .normalize();
        const weaveSign =
          Math.sin(matchTime * 3.5 + bot.id) >= 0 ? 1 : -1;
        _vScratch1.applyAxisAngle(_aiUpAxis, weaveSign * 0.36);
        bot.targetUnit = null;
        if (!bot._aiKitePos) bot._aiKitePos = new THREE.Vector3();
        bot._aiKitePos
          .copy(pos)
          .addScaledVector(_vScratch1, Math.min(distP, 8.0));
        bot.targetPos = bot._aiKitePos;
      }

      const aimW = getLeadAimPos(bot, enemyHero, 26);
      const aimQ = getLeadAimPos(bot, enemyHero, 30);
      const aimR = getLeadAimPos(bot, enemyHero, 34);

      if (
        prof.comboSmart &&
        distP > (isInfinityMode ? 4.5 : 6.5) &&
        distP <= 20.0 &&
        bot.cooldowns.W <= 0 &&
        bot.mana >= 60
      ) {
        castHeroAbility(bot, "W", aimW);
      }
      if (distP <= 9.2 && bot.cooldowns.E <= 0 && bot.mana >= 75) {
        castHeroAbility(bot, "E", pos);
      }
      if (distP <= 22.0 && bot.cooldowns.Q <= 0 && bot.mana >= 60) {
        castHeroAbility(bot, "Q", aimQ);
      }
      const ultThreshold = isInfinityMode
        ? 0.96
        : prof.comboSmart
          ? 0.92
          : 0.65;
      if (
        distP <= 23.0 &&
        enemyHero.hp < enemyHero.maxHp * ultThreshold &&
        bot.cooldowns.R <= 0 &&
        bot.mana >= 125
      ) {
        castHeroAbility(bot, "R", aimR);
      }
      // Infinity Double-Ultimate Refresher Combo!
      if (
        isInfinityMode &&
        distP <= 22.0 &&
        bot.cooldowns.R > 4.0 &&
        enemyHero.hp > 180 &&
        enemyHero.hp < enemyHero.maxHp * 0.72
      ) {
        if (triggerBotActiveItem(bot, "refresher", pos)) {
          if (bot.mana >= 125) castHeroAbility(bot, "R", aimR);
        }
      }

      bot.targetUnit = enemyHero;
      return;
    }

    // 7. Opportunistic River Rune Pickup in Infinity Mode
    if (isInfinityMode && runes.length > 0) {
      const nearRune = runes.find(
        (r) =>
          r &&
          r.group &&
          pos.distanceToSquared(r.group.position) <= 1024.0,
      );
      if (nearRune) {
        bot.targetUnit = null;
        bot.targetPos = nearRune.group.position;
        return;
      }
    }

    // 8. Active Tower, Sneaky Golem & Ancient Siege
    const botEnemyTeam = isRad ? "dire" : "radiant";
    const enemyHasTowers = hasAnyAliveTower(botEnemyTeam);
    let siegeStructure = null;

    if (enemyHasTowers) {
      const nextTower = getNextVulnerableStructure(botEnemyTeam, pos);
      if (nextTower && nextTower.type === "tower") {
        const distToTower = pos.distanceTo(nextTower.mesh.position);
        const hasCreepSupport = units.some(
          (c) =>
            !c.dead &&
            c.team === bot.team &&
            c.type === "creep" &&
            c.mesh.position.distanceTo(nextTower.mesh.position) <=
              nextTower.atkRange + 5.5,
        );
        if (
          distToTower <= 32.0 &&
          (hasCreepSupport || nextTower.hp < 1500)
        ) {
          siegeStructure = nextTower;
        }
      }
    } else {
      // Only when ALL towers are destroyed: target Sneaky Golem (Infinity) or Ancient!
      const sneakyGolem = units.find(
        (u) =>
          !u.dead &&
          u.team === botEnemyTeam &&
          u.type === "sneakygolem" &&
          u.hp > 1 &&
          u.mesh.position.distanceTo(pos) <= 32.0,
      );
      if (sneakyGolem) {
        siegeStructure = sneakyGolem;
      } else {
        const enemyAncient = units.find(
          (u) =>
            !u.dead &&
            u.team === botEnemyTeam &&
            u.type === "ancient" &&
            u.mesh.position.distanceTo(pos) <= 34.0,
        );
        if (enemyAncient && !getStructureTierLockReason(enemyAncient)) {
          siegeStructure = enemyAncient;
        }
      }
    }
    if (siegeStructure) {
      bot.targetUnit = siegeStructure;
      bot.targetPos = null;
      if (
        bot.cooldowns.E <= 0 &&
        bot.mana >= 95 &&
        bot.mesh.position.distanceTo(siegeStructure.mesh.position) <=
          bot.atkRange + 3.0
      ) {
        castHeroAbility(bot, "E", pos);
      }
      return;
    }

    // 7. Secure Nearby River Runes (Bounty / Arcane) when uncontested
    if (runes.length > 0) {
      let bestRune = null;
      let bestRuneSq = 1296.0; // 36m scan
      for (let ri = 0; ri < runes.length; ri++) {
        const rn = runes[ri];
        const rdx = rn.x - pos.x,
          rdz = rn.z - pos.z;
        const rSq = rdx * rdx + rdz * rdz;
        if (rSq < bestRuneSq) {
          bestRuneSq = rSq;
          bestRune = rn;
        }
      }
      if (bestRune) {
        bot.targetUnit = null;
        if (!bot._aiRunePos) bot._aiRunePos = new THREE.Vector3();
        bot._aiRunePos.set(bestRune.x, 0, bestRune.z);
        bot.targetPos = bot._aiRunePos;
        return;
      }
    }

    // 8. Standard Lane Push / Creep Farming / Smart Jungle Rotation
    const tgt = findNearestTarget(bot, 22.0, true, false);
    if (tgt) {
      // Don't chase a target under an enemy tower without creep cover
      if (tgt.type !== "tower" && tgt.type !== "ancient") {
        const guardingTower = staticStructures.find(
          (st) =>
            !st.dead &&
            st.type === "tower" &&
            st.team !== bot.team &&
            st.mesh.position.distanceToSquared(tgt.mesh.position) <=
              (st.atkRange + 1.5) ** 2,
        );
        if (guardingTower) {
          const hasCreepsAtTower = units.some(
            (c) =>
              !c.dead &&
              c.type === "creep" &&
              c.team === bot.team &&
              c.mesh.position.distanceToSquared(
                guardingTower.mesh.position,
              ) <=
                guardingTower.atkRange ** 2,
          );
          if (!hasCreepsAtTower) {
            // Farm nearest alive friendly jungle camp while waiting for next creep wave!
            let bestCamp = null;
            let bestCampSq = 3600.0;
            for (let ci = 0; ci < neutralCamps.length; ci++) {
              const cp = neutralCamps[ci];
              if (!cp.alive || cp.isAncient) continue;
              const isFriendlySide = isRad
                ? cp.x - cp.z < 10
                : cp.x - cp.z > -10;
              if (!isFriendlySide) continue;
              const cdSq = (cp.x - pos.x) ** 2 + (cp.z - pos.z) ** 2;
              if (cdSq < bestCampSq) {
                bestCampSq = cdSq;
                bestCamp = cp;
              }
            }
            if (bestCamp && bot.hp > bot.maxHp * 0.62) {
              const campMob = findNearestTarget(bot, 14.0, true, true);
              if (campMob && campMob.team === "neutral") {
                bot.targetUnit = campMob;
                bot.targetPos = null;
              } else {
                bot.targetUnit = null;
                if (!bot._aiCampPos) bot._aiCampPos = new THREE.Vector3();
                bot._aiCampPos.set(bestCamp.x, 0, bestCamp.z);
                bot.targetPos = bot._aiCampPos;
              }
              return;
            }
            bot.targetUnit = null;
            bot.targetPos = retreatPt;
            return;
          }
        }
      }
      bot.targetUnit = tgt;
      bot.targetPos = null;
    } else {
      bot.targetUnit = null;
      const botEnemyTeam = isRad ? "dire" : "radiant";
      const nextObj = getNextVulnerableStructure(botEnemyTeam, pos);
      if (nextObj && nextObj.type === "tower") {
        const distToTower = pos.distanceTo(nextObj.mesh.position);
        if (distToTower > nextObj.atkRange + 2.5) {
          if (!bot._aiTowerPushPos)
            bot._aiTowerPushPos = new THREE.Vector3();
          _vScratch1
            .subVectors(pos, nextObj.mesh.position)
            .setY(0)
            .normalize();
          bot._aiTowerPushPos
            .copy(nextObj.mesh.position)
            .addScaledVector(_vScratch1, nextObj.atkRange + 1.2);
          bot.targetPos = bot._aiTowerPushPos;
        } else {
          bot.targetPos = null;
        }
      } else {
        const enemyBasePt = isRad ? _vBaseDire : _vBaseRad;
        if (pos.distanceToSquared(enemyBasePt) > 100)
          bot.targetPos = enemyBasePt;
      }
    }
  });
}

let riverSplashAccum = 0;
let nightVampiresSpawnedThisNight = false;
const VAMPIRE_TOWER_SAFE_DIST = 44.0;

function isNearAnyStandingTower(
  wx,
  wz,
  minDist = VAMPIRE_TOWER_SAFE_DIST,
) {
  const minDistSq = minDist * minDist;
  const list =
    staticStructures && staticStructures.length > 0
      ? staticStructures
      : units;
  for (let i = 0; i < list.length; i++) {
    const st = list[i];
    if (!st || st.dead || (st.type !== "tower" && st.type !== "ancient"))
      continue;
    const dx = wx - st.mesh.position.x;
    const dz = wz - st.mesh.position.z;
    if (dx * dx + dz * dz < minDistSq) return true;
  }
  return false;
}

function pickOuterEdgeVampirePoint(
  campOrX = 0,
  curXOrZ = 0,
  maybeCurZ = 0,
) {
  const hasCamp = campOrX && typeof campOrX === "object";
  const isDireSide = hasCamp ? campOrX.x > 0 : campOrX > 0;
  const cx = hasCamp ? campOrX.x : isDireSide ? 158 : -158;
  const cz = hasCamp ? campOrX.z : isDireSide ? 50 : -50;
  const curX = hasCamp ? curXOrZ : campOrX;
  const curZ = hasCamp ? maybeCurZ : curXOrZ;

  for (let attempt = 0; attempt < 28; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 3.5 + Math.random() * 11.5; // Roam inside and around their forest sanctuary
    const wx = THREE.MathUtils.clamp(cx + Math.cos(ang) * rad, -172, 172);
    const wz = THREE.MathUtils.clamp(cz + Math.sin(ang) * rad, -172, 172);
    if (!isDireSide && wx - wz > -18.0) continue; // Keep Vampire Coven in Radiant Forest
    if (isDireSide && wx - wz < 18.0) continue; // Keep Werewolf Den in Dire Forest
    if (Math.hypot(wx - curX, wz - curZ) < 4.5) continue;
    if (isNearAnyStandingTower(wx, wz, VAMPIRE_TOWER_SAFE_DIST + 4.0))
      continue;
    return new THREE.Vector3(wx, 0, wz);
  }
  return new THREE.Vector3(cx, 0, cz);
}

function despawnNightVampires(announceDawn = false) {
  let removedAny = false;
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u && (u.type === "vampire" || u.type === "werewolf")) {
      removedAny = true;
      if (!u.dead) {
        const burstCol = u.type === "werewolf" ? 0xd97706 : 0x9f1239;
        const ringCol = u.type === "werewolf" ? 0xf59e0b : 0xf43f5e;
        spawnParticleBurst(u.mesh.position, burstCol, 18);
        spawnShockwaveRing(
          u.mesh.position.x,
          u.mesh.position.z,
          3.8,
          ringCol,
          0.55,
        );
        spawnFloatText(
          u.mesh.position,
          "VANISHING BEFORE DAWN!",
          "#fda4af",
          13,
        );
      }
      if (inspectedUnit === u) window.clearInspectedUnit();
      if (u.mesh) {
        scene.remove(u.mesh);
        disposeObject3D(u.mesh);
      }
      if (u.bar && u.bar.el) u.bar.el.remove();
      units.splice(i, 1);
    }
  }
  neutralCamps.forEach((c) => {
    if (c.kind === "vampire" || c.kind === "werewolf") {
      c.alive = false;
      if (!c.leaderSlain) c.respawnTimer = 0;
      c._playerNearHowl = false;
      c._playerNearVampSound = false;
    }
  });
  if (removedAny && announceDawn && !inHeroSelect && !inTitleScreen) {
    showBanner(
      "PRE-DAWN RETREAT",
      "The Night Vampires and Bloodmoon Werewolves vanish into the mist before dawn!",
      "text-amber-300",
    );
  }
}

function updateNightVampires(dt) {
  if (!isNightTime) {
    nightVampiresSpawnedThisNight = false;
    despawnNightVampires(false);
    return;
  }
  const halfPhase = DAY_CYCLE_DURATION * 0.5;
  const nightProgress = THREE.MathUtils.clamp(
    (cycleClock - halfPhase) / DAY_CYCLE_DURATION,
    0,
    1,
  );

  // Disappear before morning arrives (last ~12% of night / ~36s before dawn)
  if (nightProgress >= 0.88) {
    despawnNightVampires(true);
    return;
  }

  if (!nightVampiresSpawnedThisNight && nightProgress < 0.8) {
    nightVampiresSpawnedThisNight = true;
    let spawnedCount = 0;
    neutralCamps.forEach((camp) => {
      if (camp.kind === "vampire" || camp.kind === "werewolf") {
        if ((camp.respawnTimer || 0) <= 0) {
          spawnCampCreeps(camp);
          if (camp.alive) spawnedCount++;
        }
      }
    });
    if (spawnedCount > 0 && !inHeroSelect && !inTitleScreen) {
      showBanner(
        "NOCTURNAL HUNTERS AWAKEN",
        "The Radiant Vampire Coven and Dire Bloodmoon Werewolves prowl the night with heightened senses!",
        "text-rose-400",
      );
    }
  }
}

const _aliveCampSet = new Set();
const _scratchHookVec = new THREE.Vector3();
const _scratchHookVec2 = new THREE.Vector3();

function stepSimulation(dt) {
  if (hitstopTimer > 0) {
    hitstopTimer = Math.max(0, hitstopTimer - dt);
    dt *= 0.18;
  }
  updateDayNightAndWeather(dt);
  updateNightVampires(dt);
  updateAmbientWildlife(dt, matchTime);
  mpStepNetwork(dt);

  if (gameOver || inHeroSelect) return;
  if (mpState.active && mpState.role === "guest") {
    stepGuestVisualsAndPrediction(dt);
    return;
  }
  rebuildUnitSpatialGrid();
  matchTime += dt;
  riverSplashAccum += dt;

  for (let i = scheduledEvents.length - 1; i >= 0; i--) {
    scheduledEvents[i].delay -= dt;
    if (scheduledEvents[i].delay <= 0) {
      const ev = scheduledEvents.splice(i, 1)[0];
      try {
        ev.fn();
      } catch (e) {}
    }
  }

  if (riverShaderUniforms)
    riverShaderUniforms.uTime.value = matchTime * 0.22;
  updateUltraMaxEnvironmentAnimations(matchTime, dt);
  animatedFoliageMaterials.forEach((fm) => {
    if (fm.userData && fm.userData.windShader) {
      fm.userData.windShader.uniforms.uWindTime.value = matchTime;
    }
  });

  if (matchTime >= nextEscalationTime) {
    const prevM = getEscalationMults(escalationTier);
    escalationTier++;
    const nextM = getEscalationMults(escalationTier);
    nextEscalationTime += 60.0;
    const badge = document.getElementById("escalation-badge");
    if (badge) badge.textContent = `Tier ${escalationTier}`;

    const hpRatio = nextM.hp / prevM.hp;
    const dmgRatio = nextM.dmg / prevM.dmg;
    const goldRatio = nextM.goldBounty / prevM.goldBounty;
    const xpRatio = nextM.xpBounty / prevM.xpBounty;
    units.forEach((u) => {
      if (
        !u.dead &&
        ["neutral", "boss", "dragon"].includes(u.type) &&
        !u.targetUnit &&
        u.hp >= u.maxHp * 0.96
      ) {
        u.maxHp = Math.round(u.maxHp * hpRatio);
        u.hp = u.maxHp;
        u.hpRegen *= hpRatio;
        u.atkDamage = Math.round(u.atkDamage * dmgRatio);
        u.armor = Math.round(u.armor + (nextM.armor - prevM.armor));
        if (Array.isArray(u.goldBounty)) {
          u.goldBounty = [
            Math.round(u.goldBounty[0] * goldRatio),
            Math.round(u.goldBounty[1] * goldRatio),
          ];
        } else if (typeof u.goldBounty === "number") {
          u.goldBounty = Math.round(u.goldBounty * goldRatio);
        }
        if (typeof u.xpBounty === "number") {
          u.xpBounty = Math.round(u.xpBounty * xpRatio);
        }
        u.name = u.name.replace(
          /\(Tier \d+\)/,
          `(Tier ${escalationTier})`,
        );
      }
    });

    showBanner(
      `MONSTER ESCALATION: TIER ${escalationTier}`,
      "Monsters, Bosses & Creeps now have +28% HP, +26% DMG, +25% Gold & +28% XP!",
      "text-orange-400",
    );
  }

  if (!elderDragonBoss && elderDragonSpawnTimer > 0) {
    const prevTimer = elderDragonSpawnTimer;
    elderDragonSpawnTimer -= dt;
    if (prevTimer > 30.0 && elderDragonSpawnTimer <= 30.0) {
      sfx.playNoiseBurst(1.4, "lowpass", 320, 50, 0.22, 0.8);
      showBanner(
        "ELDER SKY-DRAGON APPROACHING",
        "A celestial beast stirs in the skies • Descends in 30 seconds!",
        "text-amber-300",
      );
    }
    if (elderDragonSpawnTimer <= 0) {
      spawnElderDragonBoss();
    }
  }

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

  const prof =
    AI_DIFFICULTY_PROFILES[aiDifficulty] ||
    AI_DIFFICULTY_PROFILES.veteran;
  if (playerHero) playerHero.gold += 2.6 * dt;
  aiHeroes.forEach((b) => {
    b.gold += 2.6 * prof.goldMult * dt;
  });

  waveCountdown -= dt;
  if (waveCountdown <= 0) {
    spawnCreepWave();
    waveCountdown = WAVE_PERIOD;
  }

  if (!roshanBoss && roshanRespawnTimer > 0) {
    roshanRespawnTimer -= dt;
    if (roshanRespawnTimer <= 0) {
      spawnRoshanBoss();
      showBanner(
        "ROSHAN HAS RESPAWNED!",
        "The Immortal Titan awaits challengers in the River Pit (-34, -34)!",
        "text-orange-400",
      );
    }
  }

  _aliveCampSet.clear();
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.dead && u.camp) _aliveCampSet.add(u.camp);
  }
  const isUltraLightSim = userSettings.qualityPreset === "ultralight";
  for (let ci = 0; ci < neutralCamps.length; ci++) {
    const camp = neutralCamps[ci];
    const anyAlive = _aliveCampSet.has(camp);
    if (camp.habitatParts && !isUltraLightSim) {
      const hp = camp.habitatParts;
      const fList = hp.foliageClusters;
      for (let fi = 0; fi < fList.length; fi++) {
        const fc = fList[fi];
        fc.mesh.rotation.z = Math.sin(matchTime * 1.9 + fc.phase) * 0.05;
        fc.mesh.rotation.x = Math.cos(matchTime * 1.5 + fc.phase) * 0.04;
      }
      const eList = hp.animatedExtras;
      for (let ei = 0; ei < eList.length; ei++) {
        const ex = eList[ei];
        if (ex.kind === "flame") {
          ex.mesh.visible = anyAlive;
          if (anyAlive) {
            ex.mesh.rotation.y += dt * 3.2;
            ex.mesh.scale.setScalar(
              0.92 + Math.sin(matchTime * 11.0 + camp.id) * 0.14,
            );
          }
        } else if (ex.kind === "vamp_orb") {
          ex.mesh.visible = isNightTime && anyAlive;
          if (ex.mesh.visible) {
            ex.mesh.rotation.y += dt * 1.8;
            ex.mesh.position.y =
              ex.baseY + Math.sin(matchTime * 2.6 + camp.id) * 0.22;
          }
        } else if (ex.kind === "vamp_fog") {
          ex.mesh.rotation.z += ex.speed * dt * 0.35;
          ex.mesh.position.x =
            ex.baseX + Math.cos(matchTime * 0.45 + ex.phase) * 1.45;
          ex.mesh.position.z =
            ex.baseZ + Math.sin(matchTime * 0.38 + ex.phase) * 1.45;
          if (ex.mat) {
            const targetOp = isNightTime ? 0.26 : 0.06;
            ex.mat.opacity +=
              (targetOp - ex.mat.opacity) * Math.min(1, dt * 1.5);
          }
        } else if (ex.kind === "vamp_wisp") {
          ex.mesh.position.x =
            ex.baseX + Math.sin(matchTime * 0.6 + ex.phase) * 1.8;
          ex.mesh.position.z =
            ex.baseZ + Math.cos(matchTime * 0.5 + ex.phase) * 1.8;
          ex.mesh.position.y =
            ex.baseY + Math.sin(matchTime * 1.4 + ex.phase) * 0.25;
          if (ex.mat) {
            ex.mat.opacity = isNightTime ? 0.16 : 0.04;
          }
        }
      }
    }
    if (
      camp.kind === "werewolf" &&
      playerHero &&
      !playerHero.dead &&
      !inHeroSelect &&
      !inTitleScreen
    ) {
      const distToWolfCamp = Math.hypot(
        playerHero.mesh.position.x - camp.x,
        playerHero.mesh.position.z - camp.z,
      );
      camp.howlCooldown = Math.max(0, (camp.howlCooldown || 0) - dt);
      if (!isNightTime || !anyAlive || distToWolfCamp > 50.0) {
        camp._playerNearHowl = false;
      } else if (
        distToWolfCamp <= 36.0 &&
        !camp._playerNearHowl &&
        camp.howlCooldown <= 0
      ) {
        camp._playerNearHowl = true;
        camp.howlCooldown = 20.0;
        sfx.play("wolf_howl", distToWolfCamp);
        for (let wi = 0; wi < units.length; wi++) {
          const wu = units[wi];
          if (
            wu &&
            !wu.dead &&
            wu.type === "werewolf" &&
            wu.camp === camp
          ) {
            wu.howlAnimTimer = 1.9;
          }
        }
      }
    }
    if (
      camp.kind === "vampire" &&
      playerHero &&
      !playerHero.dead &&
      !inHeroSelect &&
      !inTitleScreen
    ) {
      const distToVampCamp = Math.hypot(
        playerHero.mesh.position.x - camp.x,
        playerHero.mesh.position.z - camp.z,
      );
      camp.vampSoundCooldown = Math.max(
        0,
        (camp.vampSoundCooldown || 0) - dt,
      );
      if (!isNightTime || !anyAlive || distToVampCamp > 50.0) {
        camp._playerNearVampSound = false;
      } else if (
        distToVampCamp <= 36.0 &&
        !camp._playerNearVampSound &&
        camp.vampSoundCooldown <= 0
      ) {
        camp._playerNearVampSound = true;
        camp.vampSoundCooldown = 20.0;
        sfx.play("vampire_coven", distToVampCamp);
      }
    }
    if (!anyAlive) {
      const NORMAL_NEUTRAL_RESPAWN = 45.0;
      const isNocturnalBossCamp =
        camp.kind === "vampire" || camp.kind === "werewolf";
      const targetRespawn =
        isNocturnalBossCamp && camp.leaderSlain
          ? NORMAL_NEUTRAL_RESPAWN * 1.5
          : NORMAL_NEUTRAL_RESPAWN;
      if (camp.alive) {
        camp.alive = false;
        camp.respawnTimer = Math.max(
          camp.respawnTimer || 0,
          targetRespawn,
        );
      } else if (camp.respawnTimer > 0) {
        camp.respawnTimer = Math.max(0, camp.respawnTimer - dt);
        if (
          camp.respawnTimer <= 0 &&
          (!camp.isNightOnly || isNightTime)
        ) {
          spawnCampCreeps(camp);
          if (camp.alive)
            spawnShockwaveRing(
              camp.x,
              camp.z,
              4.5,
              camp.kind === "vampire"
                ? 0xf43f5e
                : camp.kind === "werewolf"
                  ? 0xf59e0b
                  : 0x34d399,
              0.6,
            );
        }
      } else if (!camp.isNightOnly || isNightTime) {
        spawnCampCreeps(camp);
        if (camp.alive)
          spawnShockwaveRing(
            camp.x,
            camp.z,
            4.5,
            camp.kind === "vampire"
              ? 0xf43f5e
              : camp.kind === "werewolf"
                ? 0xf59e0b
                : 0x34d399,
            0.6,
          );
      }
    }
  }

  _radTowersAliveCache = false;
  _direTowersAliveCache = false;
  for (let i = 0; i < units.length; i++) {
    const tu = units[i];
    if (!tu.dead && tu.type === "tower") {
      if (tu.team === "radiant") _radTowersAliveCache = true;
      else if (tu.team === "dire") _direTowersAliveCache = true;
    }
  }

  _heroLoopList.length = 0;
  for (let i = 0; i < units.length; i++) {
    if (units[i].type === "hero") _heroLoopList.push(units[i]);
  }

  runeCountdown -= dt;
  if (runeCountdown <= 0) {
    if (runes.length === 0) spawnRiverRunes();
    runeCountdown = 40.0;
  }
  for (let i = runes.length - 1; i >= 0; i--) {
    const r = runes[i];
    r.gem.rotation.y += 2.4 * dt;
    r.gem.position.y = 1.5 + Math.sin(matchTime * 3.5) * 0.25;
    for (let hi = 0; hi < _heroLoopList.length; hi++) {
      const h = _heroLoopList[hi];
      if (
        h &&
        !h.dead &&
        h.mesh.position.distanceToSquared(r.group.position) < 9.61
      ) {
        h.hp = Math.min(h.maxHp, h.hp + 220);
        h.mana = Math.min(h.maxMana, h.mana + 180);
        if (r.kind === "bounty") h.gold += 140;
        else h.blinkBuffTimer = 6.0;
        if (h.isPlayer) {
          sfx.play("gold");
          spawnFloatText(h.mesh.position, r.text, "#facc15", 15);
        }
        if (mpState.active && mpState.role === "host") {
          mpQueueFxEvent([
            "R",
            Math.round(r.x),
            Math.round(r.z),
            r.color,
            h.netId || h.id,
            r.text,
          ]);
        }
        spawnShockwaveRing(r.x, r.z, 4.0, r.color, 0.5);
        scene.remove(r.group);
        disposeObject3D(r.group);
        runes.splice(i, 1);
        break;
      }
    }
  }

  updateAIHeroes(dt);

  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u.dead) {
      if (u.type === "hero") {
        if (u.deathAnimTimer > 0) {
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
        u.respawnTimer -= dt;
        if (u.respawnTimer <= 0) u.respawn();
      } else {
        if (u.mesh) {
          scene.remove(u.mesh);
          disposeObject3D(u.mesh);
        }
        if (u.bar && u.bar.el) u.bar.el.remove();
        units.splice(i, 1);
      }
      continue;
    }

    if (u.atkTimer > 0) u.atkTimer -= dt;
    if (u.stunTimer > 0) u.stunTimer -= dt;
    if (u.slowTimer > 0) u.slowTimer -= dt;
    if (u.blinkBuffTimer > 0) u.blinkBuffTimer -= dt;
    if (u.bladeMailTimer > 0) u.bladeMailTimer -= dt;
    if (u.bkbTimer > 0) u.bkbTimer -= dt;
    if (u.ancientFuryTimer > 0)
      u.ancientFuryTimer = Math.max(0, u.ancientFuryTimer - dt);
    if (u.ancientUnderAttackTimer > 0)
      u.ancientUnderAttackTimer = Math.max(
        0,
        u.ancientUnderAttackTimer - dt,
      );
    if (u.ancientImmunityTimer > 0)
      u.ancientImmunityTimer = Math.max(0, u.ancientImmunityTimer - dt);
    if (u.golemImmunityCd > 0)
      u.golemImmunityCd = Math.max(0, u.golemImmunityCd - dt);
    if (u.labuJumpCd > 0)
      u.labuJumpCd = Math.max(0, u.labuJumpCd - dt);
    if (u.vampLeaderBuffTimer > 0)
      u.vampLeaderBuffTimer = Math.max(0, u.vampLeaderBuffTimer - dt);
    if (u.wolfLeaderBuffTimer > 0)
      u.wolfLeaderBuffTimer = Math.max(0, u.wolfLeaderBuffTimer - dt);
    if (u.swingAnim > 0) u.swingAnim = Math.max(0, u.swingAnim - dt);
    if (u.castAnim > 0) u.castAnim = Math.max(0, u.castAnim - dt);
    if (u.celebrateTimer > 0)
      u.celebrateTimer = Math.max(0, u.celebrateTimer - dt);
    const entityBaseScale = u.baseScale || 1.0;
    const baseGuardianScale =
      (u.type === "kong" ||
        u.type === "redman" ||
        u.type === "sneakygolem") &&
      u.ancientFuryTimer > 0
        ? 1.12 + Math.sin(matchTime * 12.0) * 0.03
        : entityBaseScale;
    if (
      Math.abs(u.hitFlinchX || 0) > 0.005 ||
      Math.abs(u.hitFlinchZ || 0) > 0.005
    ) {
      u.mesh.position.x = THREE.MathUtils.clamp(
        u.mesh.position.x + u.hitFlinchX * dt * 10,
        -MAP_HALF + 3,
        MAP_HALF - 3,
      );
      u.mesh.position.z = THREE.MathUtils.clamp(
        u.mesh.position.z + u.hitFlinchZ * dt * 10,
        -MAP_HALF + 3,
        MAP_HALF - 3,
      );
      const decay = Math.max(0, 1 - dt * 14);
      u.hitFlinchX *= decay;
      u.hitFlinchZ *= decay;
    }
    if (u.hitFlashTimer > 0) {
      u.hitFlashTimer = Math.max(0, u.hitFlashTimer - dt);
      if (u.type !== "tower" && u.type !== "ancient") {
        const pulse =
          baseGuardianScale *
          (1.0 + Math.sin((u.hitFlashTimer / 0.13) * Math.PI) * 0.085);
        u.mesh.scale.setScalar(pulse);
      }
    } else if (
      !u.isSleeping &&
      u.type !== "tower" &&
      u.type !== "ancient" &&
      Math.abs(u.mesh.scale.x - baseGuardianScale) > 0.002
    ) {
      u.mesh.scale.setScalar(baseGuardianScale);
    }
    u.turnRoll *= Math.max(0, 1 - dt * 10);
    if (u.shieldTimer > 0) {
      u.shieldTimer -= dt;
      if (u.shieldTimer <= 0) u.shield = 0;
    }

    if (u.hasAegis) {
      u.aegisTimer -= dt;
      if (u.aegisTimer <= 0) {
        u.hasAegis = false;
        if (u.isPlayer)
          spawnFloatText(u.mesh.position, "Aegis Expired", "#94a3b8", 13);
      }
    }

    for (const ik in u.itemCooldowns) {
      if (u.itemCooldowns[ik] > 0)
        u.itemCooldowns[ik] = Math.max(0, u.itemCooldowns[ik] - dt);
    }

    // 3D Orbiting Stun Halo Ring over stunned units (heroes, creeps, neutrals & bosses)
    if (u.stunTimer > 0) {
      if (!u.parts.stunHalo && u.mesh) {
        const haloGroup = new THREE.Group();
        const hY =
          u.type === "sneakygolem"
            ? 11.2
            : u.type === "dragon" ||
                u.type === "boss" ||
                u.type === "kong" ||
                u.type === "redman"
              ? 7.2
              : u.type === "hero"
                ? 4.25
                : 2.6;
        const hRad =
          u.type === "hero" ? 0.95 : Math.max(0.75, u.radius * 0.72);
        const ringM = new THREE.Mesh(
          new THREE.TorusGeometry(hRad, 0.06, 6, 20),
          new THREE.MeshBasicMaterial({
            color: 0xfacc15,
            transparent: true,
            opacity: 0.92,
          }),
        );
        ringM.rotation.x = Math.PI / 2;
        haloGroup.add(ringM);
        const starGeo = new THREE.OctahedronGeometry(0.18, 0);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        for (let si = 0; si < 3; si++) {
          const ang = (si / 3) * Math.PI * 2;
          const st = new THREE.Mesh(starGeo, starMat);
          st.position.set(
            Math.cos(ang) * hRad,
            0.08,
            Math.sin(ang) * hRad,
          );
          haloGroup.add(st);
        }
        haloGroup.position.y = hY;
        u.mesh.add(haloGroup);
        u.parts.stunHalo = haloGroup;
      }
      if (u.parts.stunHalo) {
        u.parts.stunHalo.visible = true;
        u.parts.stunHalo.rotation.y += 5.2 * dt;
      }
    } else if (u.parts.stunHalo && u.parts.stunHalo.visible) {
      u.parts.stunHalo.visible = false;
    }

    if (u.type === "hero") {
      if (u.cooldowns.Q > 0)
        u.cooldowns.Q = Math.max(0, u.cooldowns.Q - dt);
      if (u.cooldowns.W > 0)
        u.cooldowns.W = Math.max(0, u.cooldowns.W - dt);
      if (u.cooldowns.E > 0)
        u.cooldowns.E = Math.max(0, u.cooldowns.E - dt);
      if (u.cooldowns.R > 0)
        u.cooldowns.R = Math.max(0, u.cooldowns.R - dt);
      if (u.parts.shieldBubble) {
        u.parts.shieldBubble.visible =
          u.shield > 0 || u.bladeMailTimer > 0 || u.bkbTimer > 0;
        u.parts.shieldBubble.rotation.y += 1.6 * dt;
      }
      if (u.parts.radAura) {
        u.parts.radAura.visible = u.hasRadiance;
        u.parts.radAura.rotation.z += 0.8 * dt;
      }

      if (u.hasRadiance) {
        u.radianceTick += dt;
        if (u.radianceTick >= 0.5) {
          u.radianceTick = 0;
          const ux = u.mesh.position.x,
            uz = u.mesh.position.z;
          for (let ei = 0; ei < units.length; ei++) {
            const enemy = units[ei];
            if (
              !enemy.dead &&
              enemy.team !== u.team &&
              enemy.type !== "ancient"
            ) {
              const maxR = 7.2 + enemy.radius;
              const dx = enemy.mesh.position.x - ux,
                dz = enemy.mesh.position.z - uz;
              if (dx * dx + dz * dz <= maxR * maxR)
                enemy.takeDamage(28, u, false);
            }
          }
        }
      }

      const towerAura = getAlliedTowerAuraBuff(u);
      u.towerAuraActive = Boolean(towerAura);
      u.towerBonusArmor = towerAura ? towerAura.bonusArmor : 0;

      const fPos =
        u.team === "radiant" ? _vFountainHealRad : _vFountainHealDire;
      const inFountain = u.mesh.position.distanceToSquared(fPos) < 182.25;
      const towerRegen = towerAura ? towerAura.bonusRegen : 0;
      const heartPctRegen = u.hasHeartRegen ? u.maxHp * 0.03 : 0;
      u.hp = Math.min(
        u.maxHp,
        u.hp +
          (u.hpRegen +
            heartPctRegen +
            towerRegen +
            (inFountain ? 110 : 0)) *
            dt,
      );
      u.mana = Math.min(
        u.maxMana,
        u.mana + (u.manaRegen + (inFountain ? 80 : 0)) * dt,
      );
      if (u.hp > u.maxHp * 0.45) u.lowHpWarned = false;
    } else {
      const towerAura = getAlliedTowerAuraBuff(u);
      u.towerAuraActive = Boolean(towerAura);
      u.towerBonusArmor = towerAura ? towerAura.bonusArmor : 0;
      const golemLockedAtOne =
        u.type === "sneakygolem" && (u.golemSubduedAtOneHp || u.hp <= 1);
      if (golemLockedAtOne) {
        u.hp = 1;
        u.hpRegen = 0;
      } else {
        const totalRegen =
          (u.hpRegen || 0) + (towerAura ? towerAura.bonusRegen : 0);
        if (totalRegen > 0) {
          u.hp = Math.min(u.maxHp, u.hp + totalRegen * dt);
        }
      }
    }

    if (u.parts.crystal) {
      u.parts.crystal.rotation.y += (u.swingAnim > 0 ? 5.5 : 1.7) * dt;
      if (u.parts.crystalBaseY) {
        u.parts.crystal.position.y =
          u.parts.crystalBaseY + Math.sin(matchTime * 2.6 + u.id) * 0.28;
      }
      const flare =
        u.swingAnim > 0
          ? 1.0 + Math.sin((u.swingAnim / 0.34) * Math.PI) * 0.32
          : 1.0;
      u.parts.crystal.scale.setScalar(flare);
    }
    if (u.parts.haloRing) {
      u.parts.haloRing.rotation.z -= 2.1 * dt;
      u.parts.haloRing.rotation.y += 1.2 * dt;
    }
    if (u.parts.orbitRing) {
      u.parts.orbitRing.rotation.z += 1.15 * dt;
      u.parts.orbitRing.rotation.y += 0.65 * dt;
    }
    if (u.parts.orbitRing2) {
      u.parts.orbitRing2.rotation.x += 0.95 * dt;
      u.parts.orbitRing2.rotation.z -= 0.85 * dt;
    }
    if (u.parts.wardDome) {
      const anyTowers =
        u.team === "radiant"
          ? _radTowersAliveCache
          : _direTowersAliveCache;
      const sgGuard = sneakyGolemGuardians[u.team];
      const golemShieldActive = Boolean(
        sgGuard && !sgGuard.dead && sgGuard.hp > 1,
      );
      const isAncientImmune = (u.ancientImmunityTimer || 0) > 0;
      const shieldActive = anyTowers || golemShieldActive || isAncientImmune;
      u.parts.wardDome.visible = shieldActive;
      if (shieldActive) {
        u.parts.wardDome.rotation.y +=
          (isAncientImmune ? 3.2 : golemShieldActive && !anyTowers ? 0.95 : 0.45) * dt;
        if (u.parts.wardDome.material) {
          u.parts.wardDome.material.color.setHex(
            isAncientImmune
              ? 0xf472b6
              : golemShieldActive && !anyTowers
                ? 0xff4dff
                : u.team === "radiant"
                  ? 0x10b981
                  : 0xf43f5e,
          );
          u.parts.wardDome.material.opacity =
            isAncientImmune
              ? 0.65
              : golemShieldActive && !anyTowers
                ? 0.28
                : 0.15;
        }
      }
    }
    if (u.tpChannel) {
      if (u.stunTimer > 0 || u.dead || u.reincarnating) {
        if (u.isPlayer)
          window.cancelTeleportChannel("Teleport interrupted!");
        else u.tpChannel = null;
      } else {
        u.tpChannel.timer -= dt;
        const prog = Math.min(
          1,
          1 - u.tpChannel.timer / u.tpChannel.duration,
        );
        if (u.isPlayer) {
          const tpBox = getHudEl("tp-channel-box");
          if (tpBox) {
            tpBox.classList.remove("hidden");
            const tpLbl = getHudEl("tp-channel-label");
            const tpFill = getHudEl("tp-channel-fill");
            const tpSec = getHudEl("tp-channel-sec");
            if (tpLbl)
              tpLbl.textContent = `TELEPORTING TO ${u.tpChannel.label.toUpperCase()}...`;
            if (tpFill) tpFill.style.width = `${prog * 100}%`;
            if (tpSec)
              tpSec.textContent = Math.max(0, u.tpChannel.timer).toFixed(
                1,
              );
          }
        }
        if (Math.random() < 0.35) {
          spawnShockwaveRing(
            u.mesh.position.x,
            u.mesh.position.z,
            2.4,
            0x22d3ee,
            0.35,
          );
          spawnShockwaveRing(
            u.tpChannel.dest.x,
            u.tpChannel.dest.z,
            2.8,
            0xfacc15,
            0.35,
          );
        }
        if (u.type === "hero") {
          const isRanged = u.heroCfg && u.heroCfg.rangeType === "Ranged";
          updateHeroSkeletalAnimation(
            u.parts,
            "CAST",
            matchTime + u.animPhase,
            dt,
            isRanged,
            0,
            0,
          );
        }
        if (u.tpChannel.timer <= 0) {
          completeTeleportChannel(u);
        }
        continue;
      }
    }

    if (u.stunTimer > 0 || u.reincarnating) continue;

    if (u.type === "tower") {
      if (
        !u.targetUnit ||
        u.targetUnit.dead ||
        u.mesh.position.distanceToSquared(u.targetUnit.mesh.position) >
          u.atkRange * u.atkRange
      ) {
        u.targetUnit = findNearestTarget(u, u.atkRange, false, false);
      }
      if (u.targetUnit && u.atkTimer <= 0)
        executeAutoAttack(u, u.targetUnit);
      continue;
    }
    if (u.type === "ancient") continue;

    if (u.type === "vampire" || u.type === "werewolf") {
      const NORMAL_NEUTRAL_AGGRO = 9.2;
      const tripleNeutralAggroR = NORMAL_NEUTRAL_AGGRO * 3.0; // 27.6m (3x normal neutral aggro radius)
      const campLeash = 34.0;
      const distCampSq = u.mesh.position.distanceToSquared(u.homePos);
      if (
        distCampSq > campLeash * campLeash ||
        isNearAnyStandingTower(
          u.mesh.position.x,
          u.mesh.position.z,
          VAMPIRE_TOWER_SAFE_DIST,
        )
      ) {
        u.targetUnit = null;
        u.roamTarget = pickOuterEdgeVampirePoint(
          u.camp || u.homePos,
          u.mesh.position.x,
          u.mesh.position.z,
        );
        u.targetPos = u.roamTarget;
        u.hp = Math.min(u.maxHp, u.hp + 90 * dt);
      } else {
        if (
          u.targetUnit &&
          (u.targetUnit.dead ||
            isNearAnyStandingTower(
              u.targetUnit.mesh.position.x,
              u.targetUnit.mesh.position.z,
              VAMPIRE_TOWER_SAFE_DIST,
            ) ||
            u.targetUnit.mesh.position.distanceToSquared(u.homePos) >
              (campLeash + 4.0) ** 2)
        ) {
          u.targetUnit = null;
        }
        if (!u.targetUnit) {
          const prey = findNearestTarget(
            u,
            tripleNeutralAggroR,
            true,
            false,
          );
          if (
            prey &&
            prey.mesh.position.distanceToSquared(u.homePos) <=
              campLeash * campLeash &&
            !isNearAnyStandingTower(
              prey.mesh.position.x,
              prey.mesh.position.z,
              VAMPIRE_TOWER_SAFE_DIST,
            )
          ) {
            u.targetUnit = prey;
            u.targetPos = null;
            // Alert all pack/coven allies when any member spots prey within 3x aggro range
            for (let vi = 0; vi < units.length; vi++) {
              const allyV = units[vi];
              if (
                !allyV.dead &&
                allyV.type === u.type &&
                allyV.camp === u.camp &&
                !allyV.targetUnit
              ) {
                allyV.targetUnit = prey;
                allyV.targetPos = null;
              }
            }
          }
        }
        if (u.targetUnit && !u.targetUnit.dead) {
          u.vampPulseCd = Math.max(0, (u.vampPulseCd || 0) - dt);
          if (
            u.vampPulseCd <= 0 &&
            u.mesh.position.distanceToSquared(
              u.targetUnit.mesh.position,
            ) <= 30.25
          ) {
            u.vampPulseCd = 5.5;
            const ringHex = u.type === "werewolf" ? 0xf59e0b : 0xe11d48;
            spawnShockwaveRing(
              u.mesh.position.x,
              u.mesh.position.z,
              5.5,
              ringHex,
              0.45,
            );
            u.targetUnit.slowTimer = Math.max(
              u.targetUnit.slowTimer,
              2.0,
            );
            u.targetUnit.slowFactor = Math.min(
              u.targetUnit.slowFactor,
              0.65,
            );
            u.targetUnit.takeDamage(55, u, false);
            u.hp = Math.min(u.maxHp, u.hp + 55);
          }
        } else {
          if (u.roamPauseTimer > 0) {
            u.roamPauseTimer -= dt;
            u.targetPos = null;
          } else {
            if (
              !u.roamTarget ||
              u.mesh.position.distanceToSquared(u.roamTarget) <= 9.0 ||
              isNearAnyStandingTower(
                u.roamTarget.x,
                u.roamTarget.z,
                VAMPIRE_TOWER_SAFE_DIST,
              )
            ) {
              u.roamTarget = pickOuterEdgeVampirePoint(
                u.camp || u.homePos,
                u.mesh.position.x,
                u.mesh.position.z,
              );
              u.roamPauseTimer = 0.7 + Math.random() * 1.2;
            }
            u.targetPos = u.roamTarget;
          }
        }
      }
    }

    if (
      u.type === "neutral" ||
      u.type === "boss" ||
      u.type === "dragon"
    ) {
      const maxLeash = u.type === "neutral" ? 14.5 : 18.0;
      const distFromHomeSq = u.mesh.position.distanceToSquared(u.homePos);

      // Dota 2 Nighttime Sleep Mechanic for Neutral Creeps
      if (u.type === "neutral") {
        if (!isNightTime && u.isSleeping) {
          u.setSleepingState(false);
        } else if (
          isNightTime &&
          !u.isSleeping &&
          !u.targetUnit &&
          distFromHomeSq <= 4.84
        ) {
          u.setSleepingState(true);
        }
      }

      if (distFromHomeSq > maxLeash * maxLeash) {
        u.targetUnit = null;
        u.targetPos = u.homePos;
        u.hp = Math.min(u.maxHp, u.hp + 110 * dt);
      } else if (!u.targetUnit || u.targetUnit.dead) {
        u.targetUnit = null;
        const aggroR =
          u.type === "boss" || u.type === "dragon"
            ? 11.5
            : u.isSleeping
              ? 3.5
              : 9.2;
        // Prefer lowest-HP hero intruder for smarter camp/boss focus
        const intruder = findNearestTarget(u, aggroR, true, false);
        if (intruder) {
          if (u.type === "neutral") u.wakeCamp(intruder);
          u.targetUnit = intruder;
          u.targetPos = null;
        } else if (distFromHomeSq > 2.1025) {
          u.targetPos = u.homePos;
        } else {
          u.targetPos = null;
          if (u.type === "neutral" && isNightTime && !u.isSleeping) {
            u.setSleepingState(true);
          }
        }
      } else if (u.targetUnit && !u.targetUnit.dead) {
        // Drop aggro if target runs far outside camp leash
        const leashDrop = maxLeash + 4.0;
        if (
          u.targetUnit.mesh.position.distanceToSquared(u.homePos) >
          leashDrop * leashDrop
        ) {
          u.targetUnit = null;
          u.targetPos = u.homePos;
        } else {
          u.mobSkillCd -= dt;
          if (
            u.mobSkillCd <= 0 &&
            u.mesh.position.distanceToSquared(
              u.targetUnit.mesh.position,
            ) <= 125.44
          ) {
            executeNeutralOrBossSkill(u, u.targetUnit);
          }
        }
      }
    }

    if (
      u.type === "kong" ||
      u.type === "redman" ||
      u.type === "sneakygolem"
    ) {
      const isFury = u.ancientFuryTimer > 0;
      const guardRadius = isFury ? 86.0 : 68.0;
      const aggroRange = isFury ? 84.0 : 66.0;
      const guardOutSq = (guardRadius + 8.0) * (guardRadius + 8.0);
      const distFromPostSq = u.mesh.position.distanceToSquared(u.homePos);
      if (distFromPostSq > guardRadius * guardRadius) {
        u.targetUnit = null;
        u.targetPos = u.homePos;
        if (
          !(
            u.type === "sneakygolem" &&
            (u.golemSubduedAtOneHp || u.hp <= 1)
          )
        ) {
          u.hp = Math.min(u.maxHp, u.hp + 120 * dt);
        }
      } else {
        // Always re-evaluate if not currently locked onto an enemy hero so Heroes near the Ancient take top priority
        if (
          !u.targetUnit ||
          u.targetUnit.dead ||
          u.targetUnit.mesh.position.distanceToSquared(u.homePos) >
            guardOutSq ||
          u.targetUnit.type !== "hero"
        ) {
          const prioTarget = findGuardianTarget(
            u,
            aggroRange,
            guardRadius,
          );
          if (prioTarget) {
            u.targetUnit = prioTarget;
            u.targetPos = null;
          } else if (
            !u.targetUnit ||
            u.targetUnit.dead ||
            u.targetUnit.mesh.position.distanceToSquared(u.homePos) >
              guardOutSq
          ) {
            u.targetUnit = null;
            u.targetPos = distFromPostSq > 2.25 ? u.homePos : null;
          }
        }
        if (u.targetUnit && !u.targetUnit.dead) {
          // PP Labu Rage Mode Leap to target
          if (
            u.type === "kong" &&
            isFury &&
            !u.activeDash &&
            (u.labuJumpCd || 0) <= 0
          ) {
            const dTarget = u.mesh.position.distanceTo(
              u.targetUnit.mesh.position,
            );
            if (dTarget > 6.0 && dTarget <= 32.0) {
              u.labuJumpCd = 4.0;
              const start = u.mesh.position;
              const dir = new THREE.Vector3()
                .subVectors(u.targetUnit.mesh.position, start)
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
              u.activeDash = {
                startX: start.x,
                startZ: start.z,
                endX: endX,
                endZ: endZ,
                t: 0,
                dur: 0.52,
                arcHeight: 5.5,
                colHex: 0xfacc15,
              };
              u.castAnim = 0.55;
              sfx.play("spell_blink");
              spawnShockwaveRing(start.x, start.z, 5.0, 0xfacc15, 0.4);
              spawnFloatText(start, "PP LABU LEAP!", "#facc15", 16);
            }
          }

          // Sneaky Golem Rage Mode Ancient Immunity Cast (4s duration, 10s cooldown)
          if (
            u.type === "sneakygolem" &&
            isFury &&
            (u.golemImmunityCd || 0) <= 0
          ) {
            const myAncient = units.find(
              (a) => !a.dead && a.type === "ancient" && a.team === u.team,
            );
            if (
              myAncient &&
              (myAncient.ancientImmunityTimer || 0) <= 0 &&
              (myAncient.ancientUnderAttackTimer || 0) > 0
            ) {
              u.golemImmunityCd = 10.0;
              myAncient.ancientImmunityTimer = 4.0;
              spawnShockwaveRing(
                myAncient.mesh.position.x,
                myAncient.mesh.position.z,
                14.0,
                0xf472b6,
                0.9,
              );
              spawnOrbitalSkyBeam(
                myAncient.mesh.position.x,
                myAncient.mesh.position.z,
                8.0,
                0xf472b6,
                1.8,
              );
              spawnFloatText(
                myAncient.mesh.position,
                "ANCIENT IMMUNE (4s)! SNEAKY GOLEM WARD!",
                "#f472b6",
                18,
              );
              spawnFloatText(
                u.mesh.position,
                "ANCIENT WARD CAST!",
                "#f472b6",
                16,
              );
              sfx.play("spell_shield");
              triggerCameraShake(1.1);
              showBanner(
                "ANCIENT IMMUNITY ACTIVATED!",
                "Sneaky Golem grants Ancient total damage immunity for 4 seconds!",
                "text-pink-400",
              );
            }
          }

          u.mobSkillCd -= dt * (isFury ? 2.0 : 1.0);
          const skillCastSq = isFury ? 169.0 : 110.25;
          if (
            u.mobSkillCd <= 0 &&
            u.mesh.position.distanceToSquared(
              u.targetUnit.mesh.position,
            ) <= skillCastSq
          ) {
            executeNeutralOrBossSkill(u, u.targetUnit);
          }
        }
      }
    }

    if (u.type === "creep") {
      const enemyTeam = u.team === "radiant" ? "dire" : "radiant";
      const enemyTowersAlive = hasAnyAliveTower(enemyTeam);
      const activeObj = getNextVulnerableStructure(
        enemyTeam,
        u.mesh.position,
      );

      // Advance past any waypoint reached or overshot in 2D XZ, but DO NOT advance past a standing active enemy tower!
      while (u.waypoints.length > 1) {
        const wp0 = u.waypoints[0];
        const wp1 = u.waypoints[1];
        // If wp0 is near an active standing enemy tower, hold here until the tower falls!
        if (activeObj && activeObj.type === "tower") {
          const dObjWp0Sq =
            (activeObj.mesh.position.x - wp0.x) ** 2 +
            (activeObj.mesh.position.z - wp0.z) ** 2;
          if (dObjWp0Sq <= 256.0) {
            // within 16m of active tower
            break;
          }
        }
        const dist2DSq =
          (u.mesh.position.x - wp0.x) ** 2 +
          (u.mesh.position.z - wp0.z) ** 2;
        const segX = wp1.x - wp0.x;
        const segZ = wp1.z - wp0.z;
        const passedPlane =
          (u.mesh.position.x - wp0.x) * segX +
            (u.mesh.position.z - wp0.z) * segZ >
          0;
        if (dist2DSq < 30.25 || passedPlane) {
          u.waypoints.shift();
        } else {
          break;
        }
      }
      u.targetSwitchTimer = Math.max(0, (u.targetSwitchTimer || 0) - dt);
      const curValid =
        u.targetUnit &&
        !u.targetUnit.dead &&
        !u.targetUnit.reincarnating &&
        !(u.targetUnit.type === "ancient" && enemyTowersAlive) &&
        (u.targetUnit.mesh.position.x - u.mesh.position.x) ** 2 +
          (u.targetUnit.mesh.position.z - u.mesh.position.z) ** 2 <=
          169.0;
      if (!curValid) {
        u.targetUnit = null;
        u._inAttackRange = false;
        if (u.targetSwitchTimer <= 0) {
          u.targetSwitchTimer = 0.22;
          const foe = findNearestTarget(u, 11.2, false, false);
          if (foe && !(foe.type === "ancient" && enemyTowersAlive)) {
            u.targetUnit = foe;
          } else if (activeObj && activeObj.type === "tower") {
            const dObjSq =
              (activeObj.mesh.position.x - u.mesh.position.x) ** 2 +
              (activeObj.mesh.position.z - u.mesh.position.z) ** 2;
            if (dObjSq <= (u.atkRange + activeObj.radius + 6.5) ** 2) {
              u.targetUnit = activeObj;
            }
          }
        }
      }
      if (!u.targetUnit) {
        if (activeObj && activeObj.type === "tower") {
          const isSideCitadel =
            activeObj.name &&
            activeObj.name.includes("Citadel") &&
            !activeObj.name.includes("Front");
          if (isSideCitadel || u.waypoints.length <= 1) {
            u.targetPos = activeObj.mesh.position;
          } else if (u.waypoints.length > 0) {
            u.targetPos = u.waypoints[0];
          }
        } else if (u.waypoints.length > 0) {
          u.targetPos = u.waypoints[0];
        }
      }
    }

    if (
      u.isPlayer &&
      mobileTouchPadEnabled &&
      mobileJoyState.active &&
      (Math.abs(mobileJoyState.nx) > 0.01 ||
        Math.abs(mobileJoyState.ny) > 0.01)
    ) {
      if (u.tpChannel) window.cancelTeleportChannel("Teleport Canceled");
      u.targetUnit = null;
      u.attackMovePos = null;
      const mag = Math.min(
        1,
        Math.hypot(mobileJoyState.nx, mobileJoyState.ny),
      );
      const jx =
        u.mesh.position.x +
        (mobileJoyState.nx / Math.max(0.001, mag)) * 8.0;
      const jz =
        u.mesh.position.z +
        (mobileJoyState.ny / Math.max(0.001, mag)) * 8.0;
      if (mpState.active && mpState.role === "guest") {
        mpState.joySendAccum += dt;
        if (mpState.joySendAccum >= 0.08) {
          mpState.joySendAccum = 0;
          mpSendToHost({ type: "CMD", cmd: "MOVE", x: jx, z: jz });
        }
      }
      if (!u._joyTargetVec) u._joyTargetVec = new THREE.Vector3();
      u._joyTargetVec.set(
        THREE.MathUtils.clamp(jx, -MAP_HALF + 3, MAP_HALF - 3),
        0,
        THREE.MathUtils.clamp(jz, -MAP_HALF + 3, MAP_HALF - 3),
      );
      u.targetPos = u._joyTargetVec;
    }

    if (
      u.type === "hero" &&
      u.attackMovePos &&
      (!u.targetUnit || u.targetUnit.dead)
    ) {
      const aggroFoe = findNearestTarget(
        u,
        Math.max(u.atkRange + 4.0, 14.5),
        false,
        true,
      );
      if (aggroFoe) {
        u.targetUnit = aggroFoe;
      }
    }

    if (
      u.type === "hero" &&
      !u.targetUnit &&
      !u.targetPos &&
      !u.attackMovePos
    ) {
      const auto = findNearestTarget(u, u.atkRange, false, false);
      if (auto && u.atkTimer <= 0) executeAutoAttack(u, auto);
    }

    const prevX = u.mesh.position.x;
    const prevZ = u.mesh.position.z;
    let moveIntent = false;
    if (u.targetUnit) {
      if (
        u.targetUnit.dead ||
        (u.targetUnit.type === "ancient" &&
          hasAnyAliveTower(u.targetUnit.team))
      ) {
        u.targetUnit = null;
        u._inAttackRange = false;
      } else {
        const reach = u.atkRange + u.targetUnit.radius;
        const tdx = u.targetUnit.mesh.position.x - prevX;
        const tdz = u.targetUnit.mesh.position.z - prevZ;
        const distSq = tdx * tdx + tdz * tdz;
        const activeReach = u._inAttackRange ? reach + 0.55 : reach;
        if (distSq <= activeReach * activeReach) {
          u._inAttackRange = true;
          const aimYaw = Math.atan2(tdx, tdz);
          let yDiff = aimYaw - u.mesh.rotation.y;
          while (yDiff > Math.PI) yDiff -= Math.PI * 2;
          while (yDiff < -Math.PI) yDiff += Math.PI * 2;
          u.mesh.rotation.y += yDiff * Math.min(1, dt * 12);
          if (u.atkTimer <= 0) executeAutoAttack(u, u.targetUnit);
        } else {
          u._inAttackRange = false;
          stepMove(u, u.targetUnit.mesh.position, dt);
          moveIntent = true;
        }
      }
    } else {
      u._inAttackRange = false;
      if (u.attackMovePos) {
        const adx = u.attackMovePos.x - prevX;
        const adz = u.attackMovePos.z - prevZ;
        if (adx * adx + adz * adz <= 0.5625) {
          u.attackMovePos = null;
        } else {
          stepMove(u, u.attackMovePos, dt);
          moveIntent = true;
        }
      } else if (u.targetPos) {
        const pdx = u.targetPos.x - prevX;
        const pdz = u.targetPos.z - prevZ;
        if (pdx * pdx + pdz * pdz <= 0.4225) u.targetPos = null;
        else {
          stepMove(u, u.targetPos, dt);
          moveIntent = true;
        }
      }
    }

    // Measure true horizontal displacement with brief grace buffer to eliminate RUN/IDLE flickering
    const movedDist = Math.hypot(
      u.mesh.position.x - prevX,
      u.mesh.position.z - prevZ,
    );
    const actualMoveSpeed = movedDist / Math.max(0.001, dt);
    if (moveIntent && actualMoveSpeed > 1.25) {
      u._moveGraceTimer = 0.09;
    } else if ((u._moveGraceTimer || 0) > 0) {
      u._moveGraceTimer = Math.max(0, u._moveGraceTimer - dt);
    }
    const isMoving = moveIntent && (u._moveGraceTimer || 0) > 0;
    u.isActuallyMoving = isMoving;

    if (
      moveIntent &&
      !isMoving &&
      u.stunTimer <= 0 &&
      (u.targetPos || u.attackMovePos) &&
      !u.targetUnit
    ) {
      u.stuckTimer = (u.stuckTimer || 0) + dt;
      if (u.stuckTimer > 0.45) {
        u.targetPos = null;
        u.attackMovePos = null;
        u.stuckTimer = 0;
      }
    } else {
      u.stuckTimer = 0;
    }

    const onScreen =
      Math.abs(u.mesh.position.x - cameraFocus.x) <= 72 &&
      Math.abs(u.mesh.position.z - cameraFocus.z) <= 62;
    if (onScreen && isMoving && riverSplashAccum > 0.28) {
      const distRiver =
        Math.abs(u.mesh.position.x - u.mesh.position.z) / Math.SQRT2;
      const distLane =
        Math.abs(u.mesh.position.x + u.mesh.position.z) / Math.SQRT2;
      if (distRiver < 7.8 && distLane > 7.2) {
        spawnShockwaveRing(
          u.mesh.position.x,
          u.mesh.position.z,
          2.2,
          0xbae6fd,
          0.45,
        );
      }
    }
    const doSkeletalStep = onScreen;
    const animDt = dt;

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
      const gy = getTerrainHeightAt(
        u.mesh.position.x,
        u.mesh.position.z,
      );
      u.mesh.position.y =
        gy + Math.sin(dp * Math.PI) * (u.activeDash.arcHeight || 1.8);
      if (Math.random() < 0.55) {
        spawnShockwaveRing(
          u.mesh.position.x,
          u.mesh.position.z,
          u.type === "kong" ? 3.5 : 1.8,
          u.activeDash.colHex || 0xd946ef,
          0.24,
        );
      }
      if (dp >= 1) {
        u.mesh.position.y = gy;
        u.activeDash = null;
        if (u.type === "kong") {
          spawnShockwaveRing(
            u.mesh.position.x,
            u.mesh.position.z,
            9.5,
            0xfacc15,
            0.65,
          );
          triggerCameraShake(0.8);
          sfx.playNoiseBurst(0.45, "lowpass", 450, 50, 0.38, 0.65);
        }
      }
    }

    if (u.type === "hero") {
      if (u.heroCfg) {
        const hid = u.heroCfg.id;
        if (hid === "ignis" && u.fierySoulTimer > 0) {
          u.fierySoulTimer = Math.max(0, u.fierySoulTimer - dt);
          if (u.fierySoulTimer === 0) u.fierySoulStacks = 0;
        } else if (hid === "nyxia") {
          const distRiver =
            Math.abs(u.mesh.position.x - u.mesh.position.z) / Math.SQRT2;
          if (distRiver < 9.5) {
            u.hp = Math.min(u.maxHp, u.hp + 12 * dt);
            u.mana = Math.min(u.maxMana, u.mana + 8 * dt);
          }
        } else if (hid === "valkyra") {
          let woundedFoe = false;
          for (let hi = 0; hi < _heroLoopList.length; hi++) {
            const f = _heroLoopList[hi];
            if (!f.dead && f.team !== u.team && f.hp < f.maxHp * 0.5) {
              const fdx = f.mesh.position.x - u.mesh.position.x;
              const fdz = f.mesh.position.z - u.mesh.position.z;
              if (fdx * fdx + fdz * fdz <= 484) {
                woundedFoe = true;
                break;
              }
            }
          }
          if (woundedFoe)
            u.blinkBuffTimer = Math.max(u.blinkBuffTimer, 0.25);
        }
      }
      if (doSkeletalStep) {
        const animState =
          u.celebrateTimer > 0
            ? "CELEBRATE"
            : u.stunTimer > 0
              ? "STUNNED"
              : u.castAnim > 0
                ? "CAST"
                : u.swingAnim > 0
                  ? "ATTACK"
                  : isMoving
                    ? "RUN"
                    : "IDLE";
        const isRanged = u.heroCfg && u.heroCfg.rangeType === "Ranged";
        const atkProg = u.swingAnim > 0 ? 1 - u.swingAnim / 0.34 : 0;
        const spdRatio = isMoving
          ? THREE.MathUtils.clamp(actualMoveSpeed / 12.8, 0.55, 1.75)
          : 1.0;
        updateHeroSkeletalAnimation(
          u.parts,
          animState,
          matchTime + u.animPhase,
          animDt,
          isRanged,
          atkProg,
          isMoving ? u.turnRoll : 0,
          u.atkComboIndex || 0,
          spdRatio,
        );
      }
    } else if (u.type === "creep") {
      if (doSkeletalStep)
        updateCreepAnimation(
          u,
          matchTime + u.animPhase,
          animDt,
          isMoving,
        );
    } else if (u.type === "vampire") {
      if (doSkeletalStep)
        updateVampireAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "werewolf") {
      if (doSkeletalStep)
        updateWerewolfAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "neutral") {
      if (doSkeletalStep)
        updateNeutralAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "kong") {
      if (doSkeletalStep)
        updatePPLabuAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "redman") {
      if (doSkeletalStep)
        updateRedManAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "sneakygolem") {
      if (doSkeletalStep)
        updateSneakyGolemAnimation(u, matchTime, animDt, isMoving);
    } else if (u.type === "dragon") {
      if (u.dragonDescentTimer > 0) {
        const prevDescent = u.dragonDescentTimer;
        u.dragonDescentTimer = Math.max(0, u.dragonDescentTimer - dt);
        const gy = getTerrainHeightAt(
          u.mesh.position.x,
          u.mesh.position.z,
        );
        u.mesh.position.y = gy + (u.dragonDescentTimer / 1.25) * 24;
        if (prevDescent > 0 && u.dragonDescentTimer === 0) {
          spawnShockwaveRing(
            u.mesh.position.x,
            u.mesh.position.z,
            10.5,
            0x38bdf8,
            0.75,
          );
          triggerCameraShake(0.85);
          sfx.playNoiseBurst(0.7, "lowpass", 340, 48, 0.38, 0.7);
        }
      }
      updateElderDragonAnimation(u, matchTime, dt);
    } else if (u.type === "boss") {
      updateRoshanAnimation(u, matchTime, dt, isMoving);
    } else if (u.type === "tower" && u.parts && u.parts.crystal) {
      if (onScreen) {
        u.parts.crystal.rotation.y += dt * 1.45;
        u.parts.crystal.position.y =
          u.parts.crystalBaseY + Math.sin(matchTime * 2.6 + u.id) * 0.24;
        if (u.parts.haloRing) {
          u.parts.haloRing.rotation.z += dt * 1.1;
          u.parts.haloRing.rotation.y += dt * 0.65;
        }
      }
    } else if (u.type === "ancient" && u.parts && u.parts.crystal) {
      if (onScreen) {
        u.parts.crystal.rotation.y += dt * 0.95;
        u.parts.crystal.position.y =
          u.parts.crystalBaseY + Math.sin(matchTime * 2.0 + u.id) * 0.34;
        if (u.parts.orbitRing) {
          u.parts.orbitRing.rotation.z += dt * 0.85;
          u.parts.orbitRing.rotation.y += dt * 0.45;
        }
        if (u.parts.orbitRing2) {
          u.parts.orbitRing2.rotation.x -= dt * 0.75;
          u.parts.orbitRing2.rotation.z -= dt * 0.55;
        }
        if (u.parts.wardDome) {
          u.parts.wardDome.rotation.y += dt * 0.22;
        }
      }
    }
  }
  if (riverSplashAccum > 0.28) riverSplashAccum = 0;

  const resolvePairSep = (a, b) => {
    if (b.dead || a === b) return;
    const minD = (a.radius + b.radius) * 0.78;
    const dx = a.mesh.position.x - b.mesh.position.x;
    if (dx >= minD || dx <= -minD) return;
    const dz = a.mesh.position.z - b.mesh.position.z;
    if (dz >= minD || dz <= -minD) return;
    const dSq = dx * dx + dz * dz;
    if (dSq > 0.0001 && dSq < minD * minD) {
      const d = Math.sqrt(dSq);
      const rawPush = Math.min(0.18, (minD - d) * 0.22);
      const push = rawPush / d;
      const aImmovable = a.type === "tower" || a.type === "ancient";
      const bImmovable = b.type === "tower" || b.type === "ancient";
      // Creeps yield around Heroes so creeps never shove a standing or moving Hero
      let aWeight = aImmovable ? 0.0 : 1.0;
      let bWeight = bImmovable ? 0.0 : 1.0;
      if (a.type === "hero" && b.type === "creep") {
        aWeight = 0.0;
        bWeight = 1.65;
      } else if (b.type === "hero" && a.type === "creep") {
        aWeight = 1.65;
        bWeight = 0.0;
      }
      if (aWeight > 0) {
        a.mesh.position.x += dx * push * aWeight;
        a.mesh.position.z += dz * push * aWeight;
      }
      if (bWeight > 0) {
        b.mesh.position.x -= dx * push * bWeight;
        b.mesh.position.z -= dz * push * bWeight;
      }
    }
  };
  for (let cz = 0; cz < _SPATIAL_DIM; cz++) {
    const rowOff = cz * _SPATIAL_DIM;
    for (let cx = 0; cx < _SPATIAL_DIM; cx++) {
      const cellA = _spatialBuckets[rowOff + cx];
      const lenA = cellA.length;
      if (lenA === 0) continue;
      for (let i = 0; i < lenA; i++) {
        const a = cellA[i];
        if (a.dead || a.type === "tower" || a.type === "ancient")
          continue;
        for (let j = i + 1; j < lenA; j++) resolvePairSep(a, cellA[j]);
        if (cx + 1 < _SPATIAL_DIM) {
          const cellE = _spatialBuckets[rowOff + cx + 1];
          for (let j = 0; j < cellE.length; j++)
            resolvePairSep(a, cellE[j]);
        }
        if (cz + 1 < _SPATIAL_DIM) {
          const nextRow = (cz + 1) * _SPATIAL_DIM;
          if (cx > 0) {
            const cellSW = _spatialBuckets[nextRow + cx - 1];
            for (let j = 0; j < cellSW.length; j++)
              resolvePairSep(a, cellSW[j]);
          }
          const cellS = _spatialBuckets[nextRow + cx];
          for (let j = 0; j < cellS.length; j++)
            resolvePairSep(a, cellS[j]);
          if (cx + 1 < _SPATIAL_DIM) {
            const cellSE = _spatialBuckets[nextRow + cx + 1];
            for (let j = 0; j < cellSE.length; j++)
              resolvePairSep(a, cellSE[j]);
          }
        }
      }
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.kind === "hook") {
      const step = p.speed * dt;
      const ownerPos =
        p.owner && !p.owner.dead
          ? p.owner.mesh.position
              .clone()
              .add(new THREE.Vector3(0, 1.55, 0))
          : p.mesh.position.clone();

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
              if (!p.isVisualReplay) {
                u.takeDamage(p.damage, p.owner, true);
                u.stunTimer = Math.max(u.stunTimer, 1.45);
              }
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
            // Anchor Grapple pulls Thalindor to the hook point even on terrain!
            p.phase = "winch_caster";
          } else {
            p.phase = "return";
          }
        }
      } else if (p.phase === "winch_caster") {
        if (!p.owner || p.owner.dead) {
          p.chainLinks.forEach((lk) => {
            scene.remove(lk);
            disposeObject3D(lk);
          });
          scene.remove(p.mesh);
          disposeObject3D(p.mesh);
          projectiles.splice(i, 1);
          continue;
        }
        const toHook = _scratchHookVec.subVectors(
          p.mesh.position,
          ownerPos,
        );
        toHook.y = 0;
        const d = toHook.length();
        if (d <= 2.6) {
          spawnParticleBurst(p.owner.mesh.position, p.colorHex, 24);
          p.chainLinks.forEach((lk) => {
            scene.remove(lk);
            disposeObject3D(lk);
          });
          scene.remove(p.mesh);
          disposeObject3D(p.mesh);
          projectiles.splice(i, 1);
          continue;
        }
        toHook.normalize();
        p.owner.mesh.position.x = THREE.MathUtils.clamp(
          p.owner.mesh.position.x + toHook.x * step * 1.25,
          -MAP_HALF + 3,
          MAP_HALF - 3,
        );
        p.owner.mesh.position.z = THREE.MathUtils.clamp(
          p.owner.mesh.position.z + toHook.z * step * 1.25,
          -MAP_HALF + 3,
          MAP_HALF - 3,
        );
        p.owner.mesh.position.y = getTerrainHeightAt(
          p.owner.mesh.position.x,
          p.owner.mesh.position.z,
        );
        p.owner.targetPos = null;
      } else {
        // phase === 'return': reel hook (and hooked enemy!) back to caster
        const toOwner = _scratchHookVec.subVectors(
          ownerPos,
          p.mesh.position,
        );
        toOwner.y = 0;
        const d = toOwner.length();
        if (d <= 2.6 || !p.owner || p.owner.dead) {
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
          // Winch Thalindor directly onto the hooked victim!
          const toVictim = _scratchHookVec2.subVectors(
            p.hookedTarget.mesh.position,
            p.owner.mesh.position,
          );
          toVictim.y = 0;
          if (toVictim.length() <= 2.8) {
            p.chainLinks.forEach((lk) => {
              scene.remove(lk);
              disposeObject3D(lk);
            });
            scene.remove(p.mesh);
            disposeObject3D(p.mesh);
            projectiles.splice(i, 1);
            continue;
          }
          toVictim.normalize();
          p.owner.mesh.position.x = THREE.MathUtils.clamp(
            p.owner.mesh.position.x + toVictim.x * step * 1.25,
            -MAP_HALF + 3,
            MAP_HALF - 3,
          );
          p.owner.mesh.position.z = THREE.MathUtils.clamp(
            p.owner.mesh.position.z + toVictim.z * step * 1.25,
            -MAP_HALF + 3,
            MAP_HALF - 3,
          );
          p.owner.mesh.position.y = getTerrainHeightAt(
            p.owner.mesh.position.x,
            p.owner.mesh.position.z,
          );
          p.owner.targetPos = null;
          p.mesh.position
            .copy(p.hookedTarget.mesh.position)
            .add(new THREE.Vector3(0, 1.55, 0));
        } else {
          p.mesh.position.addScaledVector(toOwner, step * 1.18);
          if (p.hookedTarget && !p.hookedTarget.dead) {
            p.hookedTarget.mesh.position.x = THREE.MathUtils.clamp(
              p.mesh.position.x,
              -MAP_HALF + 3,
              MAP_HALF - 3,
            );
            p.hookedTarget.mesh.position.z = THREE.MathUtils.clamp(
              p.mesh.position.z,
              -MAP_HALF + 3,
              MAP_HALF - 3,
            );
            p.hookedTarget.mesh.position.y = getTerrainHeightAt(
              p.hookedTarget.mesh.position.x,
              p.hookedTarget.mesh.position.z,
            );
            p.hookedTarget.targetPos = null;
          }
        }
      }

      // Position all 16 3D chain links evenly between caster's hand and hook head!
      if (p.owner && !p.owner.dead) {
        _vScratch2.set(
          p.owner.mesh.position.x,
          p.owner.mesh.position.y + 1.55,
          p.owner.mesh.position.z,
        );
      } else {
        _vScratch2.copy(p.mesh.position);
      }
      const curOwnerHand = _vScratch2;
      for (let li = 0; li < p.chainLinks.length; li++) {
        const frac = (li + 1) / (p.chainLinks.length + 1);
        p.chainLinks[li].position.lerpVectors(
          curOwnerHand,
          p.mesh.position,
          frac,
        );
        p.chainLinks[li].rotation.y = Math.atan2(p.dir.x, p.dir.z);
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
        p.target.takeDamage(p.damage, p.owner, p.isCrit);
        if (
          p.owner &&
          p.owner.hasDesolator &&
          p.target.type !== "ancient"
        ) {
          p.target._desolatorShred = Math.min(
            5.0,
            (p.target._desolatorShred || 0) + 0.8,
          );
          if ((p.target._desolatorShred || 0) <= 5.0)
            p.target.armor = Math.max(-6, p.target.armor - 0.8);
        }
        if (p.owner && p.owner.hasMjollnir && Math.random() < 0.34) {
          let bounced = 0;
          units.forEach((foe) => {
            if (
              bounced < 4 &&
              foe !== p.target &&
              !foe.dead &&
              foe.team !== p.owner.team &&
              foe.type !== "ancient" &&
              foe.mesh.position.distanceTo(p.target.mesh.position) <=
                11.0 + foe.radius
            ) {
              bounced++;
              foe.takeDamage(140, p.owner, false);
              spawnLightningBolt3D(
                p.target.mesh.position,
                foe.mesh.position,
                0x38bdf8,
                0xe0f2fe,
                0.28,
              );
            }
          });
        }
        if (p.owner && p.owner.hasStarforge) {
          spawnShockwaveRing(
            p.target.mesh.position.x,
            p.target.mesh.position.z,
            6.5,
            0xfacc15,
            0.35,
          );
          units.forEach((foe) => {
            if (
              foe !== p.target &&
              !foe.dead &&
              foe.team !== p.owner.team &&
              foe.type !== "ancient" &&
              foe.mesh.position.distanceTo(p.target.mesh.position) <=
                6.5 + foe.radius
            ) {
              foe.takeDamage(115, p.owner, false);
            }
          });
        }
        if (
          p.owner &&
          p.owner.hasSkadi &&
          p.target.type !== "tower" &&
          p.target.type !== "ancient"
        ) {
          p.target.slowTimer = Math.max(p.target.slowTimer, 2.5);
          p.target.slowFactor = Math.min(p.target.slowFactor, 0.65);
        }
        if (
          p.owner &&
          p.owner.lifesteal > 0 &&
          p.target.type !== "tower" &&
          p.target.type !== "ancient"
        )
          p.owner.hp = Math.min(
            p.owner.maxHp,
            p.owner.hp + p.damage * p.owner.lifesteal,
          );
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
        if (p.isUmaxHeroProj) {
          p.mesh.rotation.y += 14 * dt;
          p.mesh.rotation.z += 11 * dt;
          if (nxg.ready && Math.random() < 0.65) {
            nxgEmit(
              p.mesh.position,
              Math.random() < 0.45 ? 0xffffff : p.trailCol || 0xfacc15,
              2,
              {
                speed: 1.4,
                up: 1.6,
                life: 0.24,
                size: 0.34,
                gravity: 1.5,
                spread: 0.35,
                yOff: 0,
              },
            );
          }
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
            u.takeDamage(p.damage, p.owner, false);
            if (p.stasisLockDur) {
              u.stunTimer = Math.max(u.stunTimer, p.stasisLockDur);
              spawnFloatText(
                u.mesh.position,
                "TIME LOCK!",
                "#22d3ee",
                14,
              );
            }
            if (p.slowDur) {
              u.slowTimer = p.slowDur;
              u.slowFactor = 0.45;
            }
            if (p.knockback) {
              u.mesh.position.x = THREE.MathUtils.clamp(
                u.mesh.position.x + p.dir.x * p.knockback,
                -MAP_HALF + 3,
                MAP_HALF - 3,
              );
              u.mesh.position.z = THREE.MathUtils.clamp(
                u.mesh.position.z + p.dir.z * p.knockback,
                -MAP_HALF + 3,
                MAP_HALF - 3,
              );
            }
            if (
              p.hookPullToCaster &&
              p.owner &&
              !p.owner.dead &&
              u.type !== "tower"
            ) {
              spawnLightningBolt3D(
                p.owner.mesh.position,
                u.mesh.position,
                0x34d399,
                0xa855f7,
                0.55,
              );
              const pullPt = p.owner.mesh.position
                .clone()
                .addScaledVector(p.dir, 2.6);
              u.mesh.position.x = THREE.MathUtils.clamp(
                pullPt.x,
                -MAP_HALF + 3,
                MAP_HALF - 3,
              );
              u.mesh.position.z = THREE.MathUtils.clamp(
                pullPt.z,
                -MAP_HALF + 3,
                MAP_HALF - 3,
              );
              u.mesh.position.y = getTerrainHeightAt(
                u.mesh.position.x,
                u.mesh.position.z,
              );
              u.stunTimer = Math.max(u.stunTimer, 1.15);
              spawnFloatText(
                u.mesh.position,
                "SOUL HOOKED!",
                "#10b981",
                15,
              );
            }
            if (p.healOwner && p.owner && !p.owner.dead)
              p.owner.hp = Math.min(
                p.owner.maxHp,
                p.owner.hp + p.healOwner,
              );
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
                  damage: p.damage * 0.58,
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
                    other.takeDamage(p.damage * 0.65, p.owner, false);
                    other.stunTimer = Math.max(other.stunTimer, 0.45);
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

  // Update Persistent Zones (Chronosphere, Gravity Well, Blizzard, Smoke Cloud, Sunbeam, Sanctuary)
  for (let zi = activeZones.length - 1; zi >= 0; zi--) {
    const z = activeZones[zi];
    z.t += dt;
    z.tickAccum += dt;
    z.outerRing.rotation.z += dt * 1.4;
    if (z.tickAccum >= 0.35) {
      z.tickAccum = 0;
      const zoneCandidates = querySpatialUnits(
        z.x,
        z.z,
        z.radius + 5.5,
        _spatialQueryBufA,
      );
      for (let ui = 0; ui < zoneCandidates.length; ui++) {
        const u = zoneCandidates[ui];
        if (u.dead) continue;
        const dx = u.mesh.position.x - z.x;
        const dz = u.mesh.position.z - z.z;
        const rSum = z.radius + u.radius;
        const dSq = dx * dx + dz * dz;
        if (dSq <= rSum * rSum) {
          if (u.team === z.team) {
            if (z.allyHealTick)
              u.hp = Math.min(u.maxHp, u.hp + z.allyHealTick * 0.35);
            if (z.allyHaste)
              u.blinkBuffTimer = Math.max(u.blinkBuffTimer, 0.5);
          } else {
            const isStruct = u.type === "tower" || u.type === "ancient";
            if (isStruct && !z.allowStructures) continue;
            if (z.zoneType === "trap") {
              u.takeDamage(z.trapDamage || 185, z.owner, true);
              u.stunTimer = Math.max(u.stunTimer, z.trapRootDur || 2.2);
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
            if (
              u.type === "hero" &&
              z.owner &&
              z.owner.type === "hero" &&
              z.owner.team !== u.team
            ) {
              u.recordHeroInvolvement(z.owner);
            }
            if (z.tickDmg)
              u.takeDamage(
                z.tickDmg * 0.35 * getStructureAbilityDmgMult(u),
                z.owner,
                false,
              );
            if (!isStruct) {
              if (z.zoneType === "chronosphere") {
                u.stunTimer = Math.max(u.stunTimer, 0.45);
              } else if (z.zoneType === "gravity_well") {
                if (dSq > 1.96) {
                  u.mesh.position.x = THREE.MathUtils.lerp(
                    u.mesh.position.x,
                    z.x,
                    0.28,
                  );
                  u.mesh.position.z = THREE.MathUtils.lerp(
                    u.mesh.position.z,
                    z.z,
                    0.28,
                  );
                }
                u.slowTimer = Math.max(u.slowTimer, 0.55);
                u.slowFactor = 0.42;
              } else if (z.zoneType === "blizzard") {
                u.slowTimer = Math.max(u.slowTimer, 0.65);
                u.slowFactor = 0.38;
                if (z.t > 1.6) u.stunTimer = Math.max(u.stunTimer, 0.45);
              } else if (z.slowEnemies || z.zoneType === "sunbeam") {
                u.slowTimer = Math.max(u.slowTimer, 0.55);
                u.slowFactor = 0.48;
              }
            }
          }
        }
      }
    }
    if (z.t >= z.duration) {
      if (z.detonateDmg) {
        spawnShockwaveRing(z.x, z.z, z.radius * 1.25, z.colorHex, 0.65);
        spawnParticleBurst(
          LowRamOptimizer.Vec3Pool.get(
            z.x,
            getTerrainHeightAt(z.x, z.z) + 1.2,
            z.z,
          ),
          z.colorHex,
          32,
        );
        const detCandidates = querySpatialUnits(
          z.x,
          z.z,
          z.radius + 5.5,
          _spatialQueryBufB,
        );
        for (let ui2 = 0; ui2 < detCandidates.length; ui2++) {
          const u = detCandidates[ui2];
          if (
            u.dead ||
            u.team === z.team ||
            u.type === "tower" ||
            u.type === "ancient"
          )
            continue;
          const rLim = z.radius + u.radius;
          const dxZ = u.mesh.position.x - z.x;
          const dzZ = u.mesh.position.z - z.z;
          if (dxZ * dxZ + dzZ * dzZ <= rLim * rLim) {
            u.takeDamage(z.detonateDmg, z.owner, true);
            u.stunTimer = Math.max(u.stunTimer, 1.35);
          }
        }
      }
      scene.remove(z.mesh);
      disposeObject3D(z.mesh);
      activeZones.splice(zi, 1);
    }
  }

  // Update Impassable Fissure Walls (Terrakor Q)
  for (let wi = fissureWalls.length - 1; wi >= 0; wi--) {
    const w = fissureWalls[wi];
    w.timer -= dt;
    for (let ui = 0; ui < units.length; ui++) {
      const u = units[ui];
      if (
        u.dead ||
        u.team === w.team ||
        u.type === "tower" ||
        u.type === "ancient"
      )
        continue;
      for (let pi = 0; pi < w.points.length; pi++) {
        const pt = w.points[pi];
        const dx = u.mesh.position.x - pt.x;
        const dz = u.mesh.position.z - pt.z;
        const minD = w.radius + u.radius;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.0001 && dSq < minD * minD) {
          const d = Math.sqrt(dSq);
          const push = (minD - d) / d;
          u.mesh.position.x += dx * push;
          u.mesh.position.z += dz * push;
        }
      }
    }
    if (w.timer <= 0) {
      w.pillars.forEach((pm) => {
        scene.remove(pm);
        disposeObject3D(pm);
      });
      fissureWalls.splice(wi, 1);
    }
  }

  // Hero Ongoing Buffs (Blade Fury Whirlwind, Wildfire Trail, Fatal Bonds) & Summoned Units
  for (let ui = units.length - 1; ui >= 0; ui--) {
    const u = units[ui];
    if (u.dead) continue;
    if (u.fatalBondTimer > 0) {
      u.fatalBondTimer -= dt;
      if (u.fatalBondTimer <= 0) u.fatalBondGroup = null;
    }
    if (u.bladeFuryTimer > 0) {
      u.bladeFuryTimer -= dt;
      u.bladeFuryTick = (u.bladeFuryTick || 0) + dt;
      if (u.parts)
        updateHeroSkeletalAnimation(
          u.parts,
          "WHIRLWIND",
          matchTime,
          dt,
          false,
          0,
          0,
        );
      if (u.bladeFuryTick >= 0.25) {
        u.bladeFuryTick = 0;
        spawnMeleeSlashArc(
          u.mesh.position,
          matchTime * 14,
          5.8,
          0xfb923c,
          0.22,
        );
        const bfCandidates = querySpatialUnits(
          u.mesh.position.x,
          u.mesh.position.z,
          11.5,
          _spatialQueryBufB,
        );
        for (let fi = 0; fi < bfCandidates.length; fi++) {
          const foe = bfCandidates[fi];
          if (foe.dead || foe.team === u.team || foe.type === "ancient")
            continue;
          const bfLim = 5.8 + foe.radius;
          if (
            foe.mesh.position.distanceToSquared(u.mesh.position) <=
            bfLim * bfLim
          ) {
            foe.takeDamage(u.bladeFuryDmg || 50, u, false);
          }
        }
      }
    }
    if (u.fireTrailTimer > 0) {
      u.fireTrailTimer -= dt;
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
          tickDmg: u.fireTrailDmg || 55,
        });
      }
    }
    if (u.summonLife !== undefined) {
      u.summonLife -= dt;
      if (u.isWardTotem) {
        u.wardPulseAccum = (u.wardPulseAccum || 0) + dt;
        if (u.wardPulseAccum >= 0.5) {
          u.wardPulseAccum = 0;
          spawnShockwaveRing(
            u.mesh.position.x,
            u.mesh.position.z,
            7.5,
            u.remnantColor,
            0.35,
          );
          const wardCandidates = querySpatialUnits(
            u.mesh.position.x,
            u.mesh.position.z,
            8.0,
            _spatialQueryBufB,
          );
          for (let ai = 0; ai < wardCandidates.length; ai++) {
            const ally = wardCandidates[ai];
            if (
              !ally.dead &&
              ally.team === u.team &&
              ally.type !== "tower" &&
              ally.type !== "ancient" &&
              ally.mesh.position.distanceToSquared(u.mesh.position) <=
                56.25
            ) {
              ally.hp = Math.min(
                ally.maxHp,
                ally.hp + (u.wardHealPerSec || 60) * 0.5,
              );
            }
          }
        }
      } else if (u.isStaticRemnant) {
        const intruder = findNearestTarget(u, 4.8, false, false);
        if (intruder) {
          spawnShockwaveRing(
            u.mesh.position.x,
            u.mesh.position.z,
            6.8,
            0x38bdf8,
            0.55,
          );
          spawnLightningBolt3D(
            u.mesh.position,
            intruder.mesh.position,
            0xffffff,
            0x38bdf8,
            0.45,
          );
          const remCandidates = querySpatialUnits(
            u.mesh.position.x,
            u.mesh.position.z,
            12.5,
            _spatialQueryBufB,
          );
          for (let ri = 0; ri < remCandidates.length; ri++) {
            const foe = remCandidates[ri];
            if (foe.dead || foe.team === u.team || foe.type === "ancient")
              continue;
            const remLim = 6.8 + foe.radius;
            if (
              foe.mesh.position.distanceToSquared(u.mesh.position) <=
              remLim * remLim
            ) {
              foe.takeDamage(
                u.remnantBurstDmg || 195,
                u.summonOwner || u,
                true,
              );
              foe.stunTimer = Math.max(foe.stunTimer, 1.1);
            }
          }
          u.summonLife = 0;
        }
      }
      if (u.summonLife <= 0) {
        spawnParticleBurst(
          u.mesh.position,
          u.remnantColor || 0x38bdf8,
          14,
        );
        scene.remove(u.mesh);
        disposeObject3D(u.mesh);
        if (u.bar && u.bar.el) u.bar.el.remove();
        units.splice(ui, 1);
      }
    }
  }

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

function stepMove(u, target, dt) {
  const spd = u.getEffectiveSpeed();
  if (spd <= 0) return;
  const dx = target.x - u.mesh.position.x;
  const dz = target.z - u.mesh.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.08) return;

  let dirX = dx / d;
  let dirZ = dz / d;
  const st = Math.min(d, spd * dt);

  // Smooth tangent deflection around towers, ancients & enemy Fissure boulder walls
  if (u.type !== "dragon") {
    const nextX = u.mesh.position.x + dirX * st;
    const nextZ = u.mesh.position.z + dirZ * st;
    const obsList =
      staticStructures.length > 0 ? staticStructures : units;
    for (let i = 0; i < obsList.length; i++) {
      const obs = obsList[i];
      if (
        obs.dead ||
        obs === u ||
        (obs.type !== "tower" && obs.type !== "ancient")
      )
        continue;
      const ox = nextX - obs.mesh.position.x;
      const oz = nextZ - obs.mesh.position.z;
      const safeR =
        u.type === "vampire" || u.type === "werewolf"
          ? VAMPIRE_TOWER_SAFE_DIST
          : obs.radius + u.radius * 0.85;
      const oDist = Math.hypot(ox, oz);
      if (oDist > 0.001 && oDist < safeR) {
        const nx = ox / oDist;
        const nz = oz / oDist;
        const t1x = -nz;
        const t1z = nx;
        const sign = t1x * dirX + t1z * dirZ >= 0 ? 1 : -1;
        dirX = nx * 0.24 + t1x * sign * 0.96;
        dirZ = nz * 0.24 + t1z * sign * 0.96;
        const norm = Math.hypot(dirX, dirZ) || 1;
        dirX /= norm;
        dirZ /= norm;
      }
    }
    for (let wi = 0; wi < fissureWalls.length; wi++) {
      const fw = fissureWalls[wi];
      if (fw.team === u.team) continue;
      for (let pi = 0; pi < fw.points.length; pi++) {
        const pt = fw.points[pi];
        const ox = nextX - pt.x;
        const oz = nextZ - pt.z;
        const safeR = fw.radius + u.radius * 0.75;
        const oDist = Math.hypot(ox, oz);
        if (oDist > 0.001 && oDist < safeR) {
          const nx = ox / oDist;
          const nz = oz / oDist;
          const t1x = -nz;
          const t1z = nx;
          const sign = t1x * dirX + t1z * dirZ >= 0 ? 1 : -1;
          dirX = nx * 0.28 + t1x * sign * 0.95;
          dirZ = nz * 0.28 + t1z * sign * 0.95;
          const norm = Math.hypot(dirX, dirZ) || 1;
          dirX /= norm;
          dirZ /= norm;
        }
      }
    }
  }

  u.mesh.position.x = THREE.MathUtils.clamp(
    u.mesh.position.x + dirX * st,
    -MAP_HALF + 3,
    MAP_HALF - 3,
  );
  u.mesh.position.z = THREE.MathUtils.clamp(
    u.mesh.position.z + dirZ * st,
    -MAP_HALF + 3,
    MAP_HALF - 3,
  );
  const targetGy = getTerrainHeightAt(
    u.mesh.position.x,
    u.mesh.position.z,
  );
  u.mesh.position.y +=
    (targetGy - u.mesh.position.y) * Math.min(1, dt * 16);

  if (d > 0.16) {
    const targetYaw = Math.atan2(dirX, dirZ);
    let diff = targetYaw - u.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    u.mesh.rotation.y += diff * Math.min(1, dt * 13);
    u.turnRoll = THREE.MathUtils.clamp(-diff * 0.25, -0.24, 0.24);
  }
}

