let inTitleScreen = true;
let _arenaParticlesReady = false;
let _shopUiReady = false;
let _championShowcaseReady = false;

function ensureArenaParticlesReady() {
  if (_arenaParticlesReady) return;
  if (
    userSettings.qualityPreset === "ultralight" &&
    !userSettings.particlesEnabled
  )
    return;
  _arenaParticlesReady = true;
  initWeatherParticles();
  initAmbientMotes();
}

function ensureShopUiReady() {
  if (_shopUiReady) return;
  _shopUiReady = true;
  renderShopTab("all");
}

function ensureChampionShowcaseReady(forceRebuild = false) {
  if (!_championShowcaseReady) {
    _championShowcaseReady = true;
    window.resetShowcaseCamera();
    renderHeroSelectionCards();
    updateSelectionPreview();
    rebuildPreviewHeroModel();
  } else if (forceRebuild) {
    window.resetShowcaseCamera();
    renderHeroSelectionCards();
    updateSelectionPreview();
    rebuildPreviewHeroModel();
  }
}

function isStaticIntroTier() {
  const q = userSettings.qualityPreset;
  return q === "ultralight" || q === "potato" || q === "performance";
}

let _cachedIntroBgSrc = null;
function setStaticIntroImgLoaded(shouldLoad) {
  const imgEl = document.getElementById("intro-static-bg-img");
  if (!imgEl) return;
  if (!_cachedIntroBgSrc && imgEl.getAttribute("src")) {
    _cachedIntroBgSrc = imgEl.getAttribute("src");
  }
  if (shouldLoad) {
    if (_cachedIntroBgSrc && !imgEl.getAttribute("src")) {
      imgEl.setAttribute("src", _cachedIntroBgSrc);
    }
  } else if (imgEl.getAttribute("src")) {
    imgEl.removeAttribute("src");
  }
}

window.enterChampionSelectFromIntro = function () {
  inTitleScreen = false;
  inHeroSelect = true;
  document.body.classList.remove("in-intro", "in-game");
  document.body.classList.add("in-hero-select");
  ensureArenaParticlesReady();
  ensureShopUiReady();
  const titleEl = document.getElementById("title-intro-overlay");
  const selectEl = document.getElementById("hero-select-overlay");
  if (titleEl) {
    if (isStaticIntroTier()) {
      titleEl.style.opacity = "0";
      titleEl.style.transform = "none";
      titleEl.style.pointerEvents = "none";
      titleEl.classList.add("hidden");
      setStaticIntroImgLoaded(false);
    } else {
      titleEl.style.opacity = "0";
      titleEl.style.transform = "scale(1.04)";
      titleEl.style.pointerEvents = "none";
      setTimeout(() => {
        titleEl.classList.add("hidden");
      }, 450);
    }
  }
  if (selectEl) {
    selectEl.classList.remove("hidden");
  }
  previewStageGroup.visible = true;
  stageKeyLight.intensity = 230;
  stageFillLight.intensity = 46;
  stageRimLight.intensity = 340;
  ensureChampionShowcaseReady(true);
  prevTime = performance.now();
  const h = HERO_ROSTER[selectedHeroId];
  if (h) {
    sfx.ensure();
    sfx.updateAmbience(999, currentWeather);
    sfx.speakHeroLine(h, h.voice.select, true, "triumph", {
      category: "select",
      force: true,
      chime: true,
    });
  }
};

window.returnToTitleIntro = function () {
  sfx.stopSpeech();
  inTitleScreen = true;
  inHeroSelect = true;
  document.body.classList.remove("in-hero-select", "in-game");
  document.body.classList.add("in-intro");
  previewStageGroup.visible = false;
  stageKeyLight.intensity = 0;
  stageFillLight.intensity = 0;
  stageRimLight.intensity = 0;
  const titleEl = document.getElementById("title-intro-overlay");
  const selectEl = document.getElementById("hero-select-overlay");
  if (selectEl) selectEl.classList.add("hidden");
  if (titleEl) {
    titleEl.classList.remove("hidden");
    if (isStaticIntroTier()) {
      setStaticIntroImgLoaded(true);
      titleEl.style.opacity = "1";
      titleEl.style.transform = "none";
      titleEl.style.pointerEvents = "auto";
    } else {
      requestAnimationFrame(() => {
        titleEl.style.opacity = "1";
        titleEl.style.transform = "scale(1)";
        titleEl.style.pointerEvents = "auto";
      });
    }
  }
};

document.getElementById("btn-start-match").onclick = () => {
  ensureArenaParticlesReady();
  ensureShopUiReady();
  if (
    mpState.role === "host" &&
    !mpState.active &&
    mpState.players.size > 1
  ) {
    mpState.active = true;
    mpState.players.set(mpState.myId, mpGetLocalPlayerRecord());
    mpBroadcast({
      type: "START_MATCH",
      players: Array.from(mpState.players.entries()),
      aiDifficulty,
      fillBots: mpState.fillBots,
    });
  }
  inTitleScreen = false;
  inHeroSelect = false;
  document.body.classList.remove("in-intro", "in-hero-select");
  document.body.classList.add("in-game");
  hoveredUnit = null;
  updateCanvasCursorState();
  sfx.setMusicScene("arena");
  previewStageGroup.visible = false;
  stageKeyLight.intensity = 0;
  stageFillLight.intensity = 0;
  stageRimLight.intensity = 0;
  if (
    LowRamOptimizer.profile.isLowRam ||
    userSettings.qualityPreset === "ultralight"
  ) {
    LowRamOptimizer.disposeObjectTree(previewStageGroup);
    previewStageRings = [];
    previewStageObelisks = [];
    previewHeroRig = null;
    _championShowcaseReady = false;
  }
  worldUiLayer.style.display = "block";
  const titleEl = document.getElementById("title-intro-overlay");
  if (titleEl) titleEl.classList.add("hidden");
  setStaticIntroImgLoaded(false);
  document.getElementById("hero-select-overlay").classList.add("hidden");
  document.getElementById("hud-layer").classList.add("active-hud");
  window.restartMatch();
  sfx.stopSpeech();
  const hCfg = HERO_ROSTER[selectedHeroId];
  sfx.announceSpree("The battle begins! Defend your Ancient!", 3, {
    afterAnnouncer: () => {
      if (!gameOver && !inHeroSelect && hCfg && hCfg.voice) {
        sfx.speakHeroLine(hCfg, hCfg.voice.select, true, "triumph", {
          category: "match_start",
          chime: true,
          minGapMs: 500,
          catGapMs: 500,
        });
      }
    },
  });
};

window.openHeroSelect = function () {
  inTitleScreen = false;
  inHeroSelect = true;
  ensureArenaParticlesReady();
  ensureShopUiReady();
  document.body.classList.remove("in-game", "in-intro");
  document.body.classList.add("in-hero-select");
  hoveredUnit = null;
  updateCanvasCursorState();
  sfx.setMusicScene("intro");
  previewStageGroup.visible = true;
  stageKeyLight.intensity = 230;
  stageFillLight.intensity = 46;
  stageRimLight.intensity = 340;
  worldUiLayer.style.display = "none";
  const titleEl = document.getElementById("title-intro-overlay");
  if (titleEl) titleEl.classList.add("hidden");
  document.getElementById("endgame-modal").classList.add("hidden");
  document.getElementById("hud-layer").classList.remove("active-hud");
  document
    .getElementById("hero-select-overlay")
    .classList.remove("hidden");
  ensureChampionShowcaseReady(true);
};

function endMatch(winner) {
  if (mpState.active && mpState.role === "host" && !gameOver) {
    mpQueueFxEvent(["W", winner]);
  }
  gameOver = true;
  const modal = document.getElementById("endgame-modal");
  const title = document.getElementById("end-title");
  const desc = document.getElementById("end-desc");
  const icon = document.getElementById("end-icon");

  if (winner === "radiant") {
    sfx.announceSpree("Radiant Victory!", 5);
    title.textContent = "RADIANT VICTORY!";
    title.className =
      "font-cinzel font-black text-3xl sm:text-4xl tracking-widest text-emerald-400 mb-2";
    desc.textContent =
      "The Dire Ancient has crumbled! Glory to the Radiant!";
    icon.innerHTML = '<i class="fa-solid fa-trophy text-amber-400"></i>';
  } else {
    sfx.announceSpree("Dire Victory!", 5);
    title.textContent = "DIRE VICTORY!";
    title.className =
      "font-cinzel font-black text-3xl sm:text-4xl tracking-widest text-rose-500 mb-2";
    desc.textContent = "The Radiant Ancient has fallen!";
    icon.innerHTML = '<i class="fa-solid fa-skull text-rose-500"></i>';
  }

  const humanTeam = playerHero ? playerHero.team : "radiant";
  if (winner === humanTeam && aiDifficulty === "immortal") {
    const newlyUnlockedUmax = !isUltraMaxUnlocked();
    const newlyUnlockedInf = !isInfinityUnlocked();
    setUltraMaxUnlocked(true);
    setInfinityUnlocked(true);
    desc.textContent +=
      " • INFINITY DIFFICULTY & ULTRA MAX GRAPHICS UNLOCKED!";
    if (newlyUnlockedUmax || newlyUnlockedInf) {
      setTimeout(() => {
        sfx.play("levelup");
        showBanner(
          "INFINITY MODE & ULTRA MAX UNLOCKED!",
          "Immortal Triumph! Infinity Difficulty & Ultra Max Graphics are now unlocked!",
          "text-fuchsia-300",
        );
      }, 800);
    }
  }

  if (playerHero) {
    document.getElementById("end-kda").textContent =
      `${playerHero.kills}/${playerHero.deaths}/${playerHero.assists}`;
    document.getElementById("end-lh").textContent = playerHero.lastHits;
  }
  document.getElementById("end-time").textContent =
    document.getElementById("game-clock").textContent;
  modal.classList.remove("hidden");
}

window.restartMatch = function () {
  document.getElementById("endgame-modal").classList.add("hidden");
  document.getElementById("talent-modal")?.classList.add("hidden");
  window.clearInspectedUnit();
  document.getElementById("respawn-box").classList.add("hidden");
  document.getElementById("aegis-hud-badge").classList.add("hidden");
  document.getElementById("dragon-hud-badge").classList.add("hidden");
  projectiles.forEach((p) => {
    scene.remove(p.mesh);
    disposeObject3D(p.mesh);
  });
  projectiles = [];
  fxList.forEach((f) => {
    scene.remove(f.mesh);
    if (!f.pooledMesh) disposeObject3D(f.mesh);
  });
  fxList = [];
  floatTexts.forEach((ft) => {
    if (ft.el) ft.el.remove();
  });
  floatTexts = [];
  LowRamOptimizer.FloatTextPool.reset();
  scheduledEvents = [];

  mpState.snapSeq = 0;
  mpState.lastRecvSeq = 0;
  mpState.lastSnapApplyTime = 0;
  if (mpState.knownNetIds) mpState.knownNetIds.clear();
  if (mpState.lastEntitySig) mpState.lastEntitySig.clear();
  if (mpState.lastHeroExtras) mpState.lastHeroExtras.clear();
  if (mpState.pendingRemovals) mpState.pendingRemovals.clear();
  matchTime = 0;
  cycleClock = 510.0;
  isNightTime = false;
  nightVampiresSpawnedThisNight = false;
  waveCountdown = 1.5;
  runeCountdown = 5.0;
  roshanRespawnTimer = 0;
  syncDayNightSettingsUI();
  radiantKills = 0;
  direKills = 0;
  firstBloodDone = false;
  gameOver = false;
  primedSkill = null;
  attackMovePrimed = false;
  swapSourceSlot = null;
  window.cancelTpTargetMode();
  const tpBox = document.getElementById("tp-channel-box");
  if (tpBox) tpBox.classList.add("hidden");
  document.getElementById("escalation-badge").textContent = "Tier 1";
  updatePrimedState();

  portraitStudio.resetState();
  if (
    portraitStudio.isStaticPortraitMode &&
    portraitStudio.isStaticPortraitMode() &&
    portraitStudio.disposeResources
  ) {
    portraitStudio.disposeResources();
  }
  initMatchEntities();
  spawnRiverRunes();
  refreshInventoryGrid();
  updateAbilityUpgradeButtons();
  cameraFocus.copy(playerHero.mesh.position);
  drawMinimap();
  const prof =
    AI_DIFFICULTY_PROFILES[aiDifficulty] ||
    AI_DIFFICULTY_PROFILES.veteran;
  const modeLabel =
    matchMode === "1v2"
      ? "1v2 HANDICAP"
      : matchMode === "2v1"
        ? "2v1 ALLIED"
        : "1v1 DUEL";
  showBanner(
    `THE ANCIENTS AWAKEN (${modeLabel} • ${prof.label.toUpperCase()})!`,
    `${playerHero.name} enters the battle for the Ancients!`,
    "text-emerald-400",
  );
};

let userManuallyToggledTouch = false;
const _origToggleTouch = window.toggleMobileTouchPad;
window.toggleMobileTouchPad = function (forceVal, isAuto = false) {
  if (!isAuto) userManuallyToggledTouch = true;
  _origToggleTouch(forceVal);
};
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyRendererResolution();
  if (!userManuallyToggledTouch) {
    const shouldShowTouch = isTouchCapableDevice();
    if (mobileTouchPadEnabled !== shouldShowTouch) {
      window.toggleMobileTouchPad(shouldShowTouch, true);
    }
  }
  _cachedStageWinRect = null;
});

let previewIdleClock = 0;
let _cachedStageWinRect = null;
let _cachedStageWinTime = 0;
function updateCameraRig(dt) {
  if (inTitleScreen) {
    previewIdleClock += dt;
    if (riverShaderUniforms) riverShaderUniforms.uTime.value += dt * 0.25;
    const sweepT =
      userSettings.qualityPreset === "ultralight"
        ? Math.max(0, previewIdleClock - 0.45)
        : previewIdleClock;
    const orbitAng = Math.PI * 0.25 + Math.sin(sweepT * 0.18) * 0.24;
    const orbitRad = 86;
    camera.position.set(
      Math.cos(orbitAng) * orbitRad,
      52 + Math.sin(sweepT * 0.32) * 3.5,
      Math.sin(orbitAng) * orbitRad,
    );
    camera.lookAt(0, 2.5, 0);
    return;
  }
  if (inHeroSelect) {
    previewIdleClock += dt;
    if (previewShowcaseTimer > 0) previewShowcaseTimer -= dt;
    if (!isDraggingPreview) previewYaw += dt * 0.45;
    if (riverShaderUniforms) riverShaderUniforms.uTime.value += dt * 0.22;
    previewStageRings.forEach((r) => {
      r.mesh.rotation.z += dt * r.speed;
    });
    previewStageObelisks.forEach((ob) => {
      ob.mesh.position.y =
        ob.baseY + Math.sin(previewIdleClock * 2.4 + ob.phase) * 0.22;
      ob.mesh.rotation.y += dt * 1.4;
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
    if (previewHeroRig) {
      previewHeroRig.group.rotation.y = previewYaw;
      const isRanged = HERO_ROSTER[selectedHeroId].rangeType === "Ranged";
      const pose = previewShowcaseTimer > 0 ? "CAST" : "IDLE";
      updateHeroSkeletalAnimation(
        previewHeroRig.parts,
        pose,
        previewIdleClock,
        dt,
        isRanged,
      );
    }
    const b = previewHeroBounds || {
      minY: 72.5,
      maxY: 80.0,
      height: 7.5,
      centerY: 76.25,
    };
    const baseStandY = 72.12;
    const subjectWorldH = Math.max(7.4, (b.maxY - baseStandY) * 1.28);
    const subjectWorldCenterY = baseStandY + (b.maxY - baseStandY) * 0.49;

    const fovTan = Math.tan((camera.fov * 0.5 * Math.PI) / 180);
    let heightRatio = 0.52;
    let ndcShiftY = 0.0;
    const nowMs = performance.now();
    if (!_cachedStageWinRect || nowMs - _cachedStageWinTime > 400) {
      const stageEl = getHudEl("hero-3d-stage-window");
      if (stageEl && window.innerHeight > 0) {
        _cachedStageWinRect = stageEl.getBoundingClientRect();
        _cachedStageWinTime = nowMs;
      }
    }
    const rect = _cachedStageWinRect;
    if (rect && rect.width > 0 && rect.height > 0 && window.innerHeight > 0) {
      const stageCenterY = rect.top + rect.height * 0.5;
      ndcShiftY = -(
        (stageCenterY - window.innerHeight * 0.5) /
        (window.innerHeight * 0.5)
      );
      heightRatio = THREE.MathUtils.clamp(
        rect.height / window.innerHeight,
        0.3,
        0.85,
      );
    }

    const autoDist = subjectWorldH / (2 * fovTan * heightRatio);
    const effectiveZoom = THREE.MathUtils.clamp(
      autoDist * previewZoomFactor,
      11.0,
      42.0,
    );
    const visHalfH = effectiveZoom * fovTan;
    const lookTargetY = subjectWorldCenterY - ndcShiftY * visHalfH;
    const camEyeY = lookTargetY + 1.35;

    camera.position.set(0, camEyeY, effectiveZoom);
    camera.lookAt(0, lookTargetY, 0);
    return;
  }

  const speed = userSettings.edgePanSpeed * dt;
  const edgeMargin = 14;
  const edgePan =
    userSettings.edgePanEnabled &&
    !cameraLocked &&
    (mouseClient.x < edgeMargin ||
      mouseClient.x > window.innerWidth - edgeMargin ||
      mouseClient.y < edgeMargin ||
      mouseClient.y > window.innerHeight - edgeMargin);

  if (panKeys.up || panKeys.down || panKeys.left || panKeys.right) {
    cameraLocked = false;
    syncCamLockLabel();
    if (panKeys.up) cameraFocus.z -= speed;
    if (panKeys.down) cameraFocus.z += speed;
    if (panKeys.left) cameraFocus.x -= speed;
    if (panKeys.right) cameraFocus.x += speed;
  } else if (edgePan) {
    if (mouseClient.x < edgeMargin) cameraFocus.x -= speed;
    if (mouseClient.x > window.innerWidth - edgeMargin)
      cameraFocus.x += speed;
    if (mouseClient.y < edgeMargin) cameraFocus.z -= speed;
    if (mouseClient.y > window.innerHeight - edgeMargin)
      cameraFocus.z += speed;
  }

  if (camZoomPunch > 0) {
    camZoomPunch = Math.max(0, camZoomPunch - dt * 5.5);
  }
  if (cameraLocked && playerHero && !playerHero.dead) {
    const camAlpha = 1 - Math.exp(-18 * dt);
    cameraFocus.x +=
      (playerHero.mesh.position.x - cameraFocus.x) * camAlpha;
    cameraFocus.z +=
      (playerHero.mesh.position.z - cameraFocus.z) * camAlpha;
    cameraFocus.y = 0;
  }

  cameraFocus.x = THREE.MathUtils.clamp(
    cameraFocus.x,
    -MAP_HALF + 12,
    MAP_HALF - 12,
  );
  cameraFocus.z = THREE.MathUtils.clamp(
    cameraFocus.z,
    -MAP_HALF + 12,
    MAP_HALF - 12,
  );

  // Texel-locked zero-slide shadow frustum: perfectly synchronized with shadowMap bake cadence
  if (userSettings.shadowsEnabled && sunLight && sunLight.shadow) {
    const shadowSkipVal =
      userSettings.qualityPreset === "ultramax"
        ? 2
        : userSettings.qualityPreset === "ultra"
          ? 3
          : userSettings.qualityPreset === "high"
            ? 4
            : 6;
    // Counter advances every frame (it used to advance only after a bake, so it stalled at 0
    // and in-match shadows were never re-rendered).
    _shadowFrameCounter++;
    const isShadowBakeFrame = _shadowFrameCounter % shadowSkipVal === 0;
    if (isShadowBakeFrame) {
      const ext = sunLight.shadow.camera.right || 66;
      const mapW = sunLight.shadow.mapSize.width || 1536;
      const texelWorld = (ext * 2) / mapW;
      const desiredX = Math.round(cameraFocus.x / texelWorld) * texelWorld;
      const desiredZ = Math.round(cameraFocus.z / texelWorld) * texelWorld;
      window._bakedShadowX = desiredX;
      window._bakedShadowZ = desiredZ;
      sunLight.target.position.set(desiredX, 0, desiredZ);
      sunLight.target.updateMatrixWorld();
      const sDir = window._activeSunDir;
      if (sDir) {
        sunLight.position.set(
          desiredX + sDir.x * 135,
          sDir.y * 135,
          desiredZ + sDir.z * 135,
        );
      } else {
        sunLight.position.set(desiredX + 60, 110, desiredZ + 62);
      }
      window._shadowNeedsUpdate = true;
    }
  }

  camera.position.copy(cameraFocus).add(CAMERA_OFFSET);
  if (cameraShake > 0) {
    camera.position.x += (Math.random() - 0.5) * cameraShake;
    camera.position.y += (Math.random() - 0.5) * cameraShake;
    camera.position.z += (Math.random() - 0.5) * cameraShake;
    cameraShake = Math.max(0, cameraShake - dt * 3.5);
  }
  camera.lookAt(cameraFocus.x, 0, cameraFocus.z);
}

let prevTime = performance.now();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (sfx && sfx.ctx && sfx.ctx.state === "running") {
      sfx.ctx.suspend().catch(() => {});
    }
  } else {
    prevTime = performance.now();
    if (
      sfx &&
      sfx.ctx &&
      sfx.ctx.state === "suspended" &&
      (sfx.musicEnabled || sfx.sfxEnabled)
    ) {
      sfx.ctx.resume().catch(() => {});
    }
  }
});
let _introShadowBaked = false;
let _firstFrameWarmed = false;
// A unit is a group of ~30 part meshes that three.js would otherwise visit and frustum-test one by
// one. Hide whole off-screen units for the duration of the draw only (restored right after), so
// gameplay code that reads/writes mesh.visible is unaffected. The margin keeps their shadows in view.
const _unitCullBuf = [];
const _unitCullFrustum = new THREE.Frustum();
const _unitCullMat = new THREE.Matrix4();
const _unitCullSphere = new THREE.Sphere();
function cullOffscreenUnitsForRender() {
  if (inHeroSelect || inTitleScreen) return 0;
  camera.updateMatrixWorld();
  _unitCullFrustum.setFromProjectionMatrix(
    _unitCullMat.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  let n = 0;
  for (let i = 0; i < units.length; i++) {
    const m = units[i].mesh;
    if (!m || !m.visible || m.parent !== scene) continue;
    _unitCullSphere.center.copy(m.position);
    _unitCullSphere.radius = 30;
    if (!_unitCullFrustum.intersectsSphere(_unitCullSphere)) {
      m.visible = false;
      _unitCullBuf[n++] = m;
    }
  }
  return n;
}
function mainLoop(now) {
  requestAnimationFrame(mainLoop);
  if (document.hidden) {
    prevTime = now;
    return;
  }
  const settingsModalEl = getHudEl("settings-modal");
  const mpModalEl = getHudEl("multiplayer-modal");
  if (
    (settingsModalEl && !settingsModalEl.classList.contains("hidden")) ||
    (mpModalEl && !mpModalEl.classList.contains("hidden"))
  ) {
    prevTime = now;
    return;
  }
  if (inTitleScreen && isStaticIntroTier()) {
    prevTime = now;
    return;
  }
  const elapsedMs = now - prevTime;
  const use30FpsCap =
    LowRamOptimizer.profile.isLowRam ||
    userSettings.qualityPreset === "ultralight";
  if (use30FpsCap && _firstFrameWarmed && elapsedMs < 31.5) {
    return;
  }
  const dt = Math.min(0.05, elapsedMs / 1000);
  prevTime = now;
  LowRamOptimizer.Vec3Pool.reset();

  if (_pointerRaycastDirty) {
    _pointerRaycastDirty = false;
    raycastGround(mouseClient.x, mouseClient.y);
    if ((primedSkill || attackMovePrimed) && skillReticle.visible) {
      skillReticle.position.set(worldCursor.x, 0.16, worldCursor.z);
    }
    if (
      !inHeroSelect &&
      !inTitleScreen &&
      now - _lastHoverCheckTime >= 64
    ) {
      _lastHoverCheckTime = now;
      const hoverMeshes =
        window._hoverMeshesBuf || (window._hoverMeshesBuf = []);
      hoverMeshes.length = 0;
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (
          !u.dead &&
          Math.abs(u.mesh.position.x - cameraFocus.x) <= 74 &&
          Math.abs(u.mesh.position.z - cameraFocus.z) <= 64
        ) {
          hoverMeshes.push(u.mesh);
        }
      }
      const hoverHits = raycaster.intersectObjects(hoverMeshes, true);
      const nextHover =
        hoverHits.length > 0 && hoverHits[0].object.userData.unit
          ? hoverHits[0].object.userData.unit
          : null;
      const shopHoverMeshes =
        window._shopHoverMeshesBuf || (window._shopHoverMeshesBuf = []);
      if (shopHoverMeshes.length !== shopEntities.length) {
        shopHoverMeshes.length = 0;
        for (let si = 0; si < shopEntities.length; si++) {
          if (shopEntities[si].mesh)
            shopHoverMeshes.push(shopEntities[si].mesh);
        }
      }
      const shopHits =
        shopHoverMeshes.length > 0
          ? raycaster.intersectObjects(shopHoverMeshes, true)
          : [];
      const isHoveringShop =
        shopHits.length > 0 ||
        shopEntities.some(
          (s) =>
            Math.hypot(worldCursor.x - s.x, worldCursor.z - s.z) < 7.0,
        );
      const isHoveringRune = runes.some(
        (r) => Math.hypot(worldCursor.x - r.x, worldCursor.z - r.z) < 3.4,
      );
      const isHoveringInteract = isHoveringShop || isHoveringRune;
      if (
        nextHover !== hoveredUnit ||
        window._lastHoveringShop !== isHoveringInteract
      ) {
        hoveredUnit = nextHover;
        window._lastHoveringShop = isHoveringInteract;
        updateCanvasCursorState();
        if (
          isHoveringInteract &&
          !primedSkill &&
          !attackMovePrimed &&
          !tpTargetMode
        ) {
          canvas.classList.add("cursor-ally");
        }
      }
    }
  }

  stepSimulation(dt);
  updateCameraRig(dt);
  syncHUDAndMinimap(dt);

  if (inTitleScreen) {
    if (userSettings.shadowsEnabled && !_introShadowBaked) {
      renderer.shadowMap.needsUpdate = true;
      _introShadowBaked = true;
    }
  } else {
    _introShadowBaked = false;
    if (userSettings.shadowsEnabled && window._shadowNeedsUpdate) {
      window._shadowNeedsUpdate = false;
      renderer.shadowMap.needsUpdate = true;
    }
  }
  nxgTick(dt);
  syncSceneLightBudget();
  updatePointLightPool();
  const culledUnitCount = cullOffscreenUnitsForRender();
  if (
    composer &&
    (userSettings.bloomEnabled ||
      userSettings.cinematicEnabled ||
      userSettings.aoEnabled)
  )
    composer.render();
  else renderer.render(scene, camera);
  for (let i = 0; i < culledUnitCount; i++)
    _unitCullBuf[i].visible = true;
  if (!_firstFrameWarmed) {
    _firstFrameWarmed = true;
    prevTime = performance.now();
  }
}

let gameBooted = false;
async function bootGameApp() {
  if (gameBooted) return;
  gameBooted = true;
  const tBoot0 = performance.now();

  syncUltraMaxLockUI();
  syncInfinityLockUI();
  LowRamOptimizer.syncSettingsUI();
  if (isTouchCapableDevice()) {
    window.toggleMobileTouchPad(true);
    window.setGraphicsQuality(nxgStartupPreset(true));
  } else {
    window.toggleMobileTouchPad(false);
    window.setGraphicsQuality(nxgStartupPreset(false));
  }

  // Stage 1: Core visible Title Screen world (sky dome + arena terrain)
  initAtmosphericSkyDome();
  const tSky = performance.now();
  buildArenaEnvironment();
  chunkStaticInstancedMeshes();
  nxgInit();
  nxgRestorePrefs();
  const tArena = performance.now();

  // Hide Sky-Altar stage during Title Screen so GPU skips unused altar draw calls
  previewStageGroup.visible = false;
  stageKeyLight.intensity = 0;
  stageFillLight.intensity = 0;
  stageRimLight.intensity = 0;

  syncSceneLightBudget();
  // Stage 2: Async shader pre-compilation (deferred on static low-tier intro for instant boot)
  if (
    !isStaticIntroTier() &&
    renderer &&
    typeof renderer.compileAsync === "function"
  ) {
    try {
      await renderer.compileAsync(scene, camera);
    } catch (e) {}
  }
  const tCompile = performance.now();

  prevTime = performance.now();
  mainLoop(prevTime);

  console.info(
    `[DotA 3D Boot] Sky: ${(tSky - tBoot0).toFixed(1)}ms | Arena: ${(tArena - tSky).toFixed(1)}ms | Shaders: ${(tCompile - tArena).toFixed(1)}ms | Total: ${(tCompile - tBoot0).toFixed(1)}ms`,
  );

  // Stage 3: Only pre-warm secondary systems on higher-tier hardware when not in Ultra Light mode
  if (
    userSettings.qualityPreset !== "ultralight" &&
    !_isLowEndMobileBoot
  ) {
    const scheduleIdleWarmup = (fn, delayMs) => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => fn(), { timeout: delayMs });
      } else {
        setTimeout(fn, delayMs);
      }
    };
    scheduleIdleWarmup(() => ensureArenaParticlesReady(), 1800);
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const autoRoom = (params.get("room") || "").trim().toUpperCase();
    if (autoRoom) {
      window.enterChampionSelectFromIntro();
      window.setMpTransport("online");
      window.openMultiplayerModal();
      window.joinMultiplayerRoom(autoRoom);
    }
  } catch (e) {}
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootGameApp);
  window.addEventListener("load", bootGameApp);
} else {
  bootGameApp();
}
