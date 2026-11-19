/***********************************************************************
 * 13. HUD, MINIMAP, TARGET UNIT INSPECTOR & ITEM SELLING (60% REFUND)
 ***********************************************************************/
let _lastInspectedInvSig = "";
function renderInspectedHeroInventory(unit) {
  const invRow = document.getElementById("insp-inv-row");
  const invGrid = document.getElementById("insp-inv-grid");
  const goldEl = document.getElementById("insp-gold");
  if (!invRow || !invGrid) return;

  if (!unit || unit.type !== "hero") {
    invRow.classList.add("hidden");
    _lastInspectedInvSig = "";
    return;
  }

  invRow.classList.remove("hidden");
  if (goldEl)
    goldEl.textContent = Math.floor(unit.gold || 0).toLocaleString();

  const sig =
    `${unit.id}:` +
    unit.inventory
      .map(
        (it) =>
          it
            ? `${it.id}_${Math.ceil(unit.itemCooldowns && it.active ? unit.itemCooldowns[it.active] || 0 : 0)}`
            : "_",
      )
      .join(",");
  if (sig === _lastInspectedInvSig) return;
  _lastInspectedInvSig = sig;

  invGrid.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const it = unit.inventory[i];
    const slot = document.createElement("div");
    slot.dataset.hudTip = `insp_inv_${i}`;
    slot.className = `w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-950 border ${it ? "border-amber-500/65 hover:border-amber-300 cursor-pointer shadow-sm" : "border-slate-800 hover:border-slate-600"} flex items-center justify-center relative transition overflow-hidden`;
    if (it) {
      const cdLeft =
        unit.itemCooldowns && it.active
          ? unit.itemCooldowns[it.active] || 0
          : 0;
      const cdOverlay =
        cdLeft > 0
          ? `<div class="absolute inset-0 bg-slate-950/85 flex items-center justify-center font-mono font-bold text-amber-300 text-[8px] z-10">${cdLeft.toFixed(0)}s</div>`
          : "";
      slot.innerHTML = `${cdOverlay}<i class="fa-solid ${it.icon} ${it.color} text-xs pointer-events-none"></i>`;
    } else {
      slot.innerHTML = `<span class="text-[8px] font-mono text-slate-700 pointer-events-none">${i + 1}</span>`;
    }
    invGrid.appendChild(slot);
  }
}

let _lastInspectedAbilitySig = "";
function renderInspectedHeroAbilities(unit) {
  const container = document.getElementById("insp-abilities-row");
  const grid = document.getElementById("insp-abilities-grid");
  if (!container || !grid) return;
  if (
    !unit ||
    unit.type !== "hero" ||
    !unit.heroCfg ||
    !unit.heroCfg.skills
  ) {
    container.classList.add("hidden");
    _lastInspectedAbilitySig = "";
    return;
  }
  container.classList.remove("hidden");

  const sig =
    `${unit.id}:` +
    ["Q", "W", "E", "R"]
      .map(
        (k) =>
          `${unit.abilityLevels ? unit.abilityLevels[k] || 0 : 0}_${Math.ceil(unit.cooldowns ? unit.cooldowns[k] || 0 : 0)}`,
      )
      .join(",");
  if (sig === _lastInspectedAbilitySig) return;
  _lastInspectedAbilitySig = sig;

  grid.innerHTML = "";
  ["Q", "W", "E", "R"].forEach((k) => {
    const sk = unit.heroCfg.skills[k];
    if (!sk) return;
    const cd = unit.cooldowns ? unit.cooldowns[k] || 0 : 0;
    const lvl = unit.abilityLevels ? unit.abilityLevels[k] || 0 : 0;
    const maxLvl = k === "R" ? 3 : 4;

    const slot = document.createElement("div");
    slot.dataset.hudTip = `insp_ability_${k}`;
    slot.className =
      "relative rounded-lg bg-slate-950 border border-slate-700/80 hover:border-amber-400/80 p-1 flex flex-col items-center justify-between min-h-[50px] shadow transition cursor-help overflow-hidden group";

    // Cooldown overlay
    const cdOverlay =
      cd > 0
        ? `<div class="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center z-20 font-mono font-bold text-amber-300 text-[10.5px] backdrop-blur-xs"><i class="fa-solid fa-clock text-[8px] text-amber-400 mb-0.5"></i>${cd.toFixed(1)}s</div>`
        : "";

    // Rank pips
    let pipsHtml = `<div class="flex gap-0.5 mt-0.5 z-10">`;
    for (let p = 1; p <= maxLvl; p++) {
      pipsHtml += `<div class="w-1.5 h-1 rounded-xs ${p <= lvl ? "bg-amber-400 shadow-[0_0_4px_rgba(250,204,21,0.6)]" : "bg-slate-700"}"></div>`;
    }
    pipsHtml += `</div>`;

    slot.innerHTML = `
      ${cdOverlay}
      <div class="w-full flex items-center justify-between text-[8px] font-cinzel font-black text-amber-300 z-10 leading-none">
        <span class="px-1 py-0.5 rounded bg-slate-900 border border-slate-700">${k}</span>
        ${sk.mana > 0 ? `<span class="text-sky-300 flex items-center gap-0.5"><i class="fa-solid fa-droplet text-[6.5px]"></i>${sk.mana}</span>` : ""}
      </div>
      <div class="my-0.5 text-center z-10">
        <i class="fa-solid ${sk.icon} ${sk.color} text-sm group-hover:scale-110 transition-transform"></i>
      </div>
      <span class="text-[7.5px] font-sans font-bold text-slate-300 truncate w-full text-center z-10">${sk.name}</span>
      ${pipsHtml}
    `;
    grid.appendChild(slot);
  });
}

window.inspectUnit = function (unit) {
  if (!unit || unit.dead || unit.isPlayer || unit === playerHero) return;
  inspectedUnit = unit;
  _lastInspectedInvSig = "";
  _lastInspectedAbilitySig = "";
  const panel = document.getElementById("unit-inspector-panel");
  panel.classList.remove("hidden");

  const isHero = unit.type === "hero";
  document.getElementById("insp-name").textContent = isHero
    ? `Lv${unit.level} ${unit.name}`
    : unit.name;

  const tagEl = document.getElementById("insp-tag");
  const fillEl = document.getElementById("insp-hp-fill");
  const iconBox = document.getElementById("insp-icon-box");
  const iconEl = document.getElementById("insp-icon");
  const inspCanvas = document.getElementById("insp-portrait-canvas");
  const lvlBadge = document.getElementById("insp-lvl-badge");
  const lvlText = document.getElementById("insp-lvl-text");
  const subtitleEl = document.getElementById("insp-subtitle");
  const attrRow = document.getElementById("insp-attr-row");

  if (lvlBadge && lvlText) {
    if (isHero) {
      lvlBadge.classList.remove("hidden");
      lvlText.textContent = unit.level;
    } else {
      lvlBadge.classList.add("hidden");
    }
  }

  if (subtitleEl) {
    if (isHero && unit.heroCfg) {
      subtitleEl.textContent = `${unit.heroCfg.title || unit.heroCfg.name} • ${unit.heroCfg.attr || "Hero"} ${unit.heroCfg.rangeType || ""}`;
    } else if (unit.type === "tower") {
      subtitleEl.textContent = "Fortified Defense Tower";
    } else if (unit.type === "ancient") {
      subtitleEl.textContent = "Ancient Stronghold Core";
    } else if (unit.type === "boss") {
      subtitleEl.textContent = "Immortal Roshan World Boss";
    } else if (unit.type === "dragon") {
      subtitleEl.textContent = "Elder Sky Dragon World Boss";
    } else if (unit.type === "creep") {
      subtitleEl.textContent = unit.isMega
        ? "Super Siege Creep"
        : "Lane Combat Minion";
    } else {
      subtitleEl.textContent = "Neutral Creature";
    }
  }

  if (unit.team === "radiant") {
    tagEl.textContent = isHero
      ? "RADIANT HERO"
      : unit.isMega
        ? "RADIANT MEGA"
        : "RADIANT";
    tagEl.className =
      "text-[8.5px] sm:text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0";
    fillEl.className =
      "h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-100";
  } else if (unit.team === "dire") {
    tagEl.textContent = isHero
      ? "DIRE HERO"
      : unit.isMega
        ? "DIRE MEGA"
        : "DIRE";
    tagEl.className =
      "text-[8.5px] sm:text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0";
    fillEl.className =
      "h-full bg-gradient-to-r from-rose-600 to-rose-500 transition-all duration-100";
  } else {
    tagEl.textContent =
      unit.type === "vampire"
        ? unit.isMiniBoss
          ? "VAMPIRE LORD"
          : "NIGHT VAMPIRE"
        : unit.type === "werewolf"
          ? unit.isMiniBoss
            ? "ALPHA LYCAN"
            : "BLOODMOON LYCAN"
          : unit.type === "dragon"
            ? "WORLD BOSS"
            : unit.type === "boss"
              ? "ROSHAN BOSS"
              : unit.isAncientNeutral
                ? "ANCIENT"
                : "NEUTRAL";
    tagEl.className =
      "text-[8.5px] sm:text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-orange-500/20 text-orange-300 border border-orange-500/40 shrink-0";
    fillEl.className =
      "h-full bg-gradient-to-r from-amber-600 to-orange-500 transition-all duration-100";
  }

  const atkBtn = document.getElementById("insp-attack-btn");
  if (atkBtn) {
    atkBtn.classList.toggle(
      "hidden",
      !playerHero ||
        playerHero.dead ||
        playerHero.reincarnating ||
        unit.team === playerHero.team,
    );
  }

  // Portrait 3D Canvas or Fallback Icon
  if (isHero && unit.heroCfg) {
    iconBox.className = `relative w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-b ${unit.heroCfg.badgeBg} border-2 border-amber-400/80 flex items-center justify-center shrink-0 overflow-hidden shadow-inner`;
    iconEl.className = `fa-solid ${unit.heroCfg.icon} ${unit.heroCfg.accentColor} text-lg`;
    const rendered =
      inspCanvas &&
      portraitStudio.renderRigToCanvas(
        unit.heroCfg,
        unit.team,
        inspCanvas,
        matchTime,
        0.016,
        false,
        false,
      );
    iconEl.classList.toggle("hidden", !!rendered);
  } else {
    const bgGradient =
      unit.type === "sneakygolem"
        ? "from-fuchsia-950 via-slate-900 to-slate-950"
        : unit.team === "radiant"
          ? "from-emerald-950 via-slate-900 to-slate-950"
          : unit.team === "dire"
            ? "from-rose-950 via-slate-900 to-slate-950"
            : "from-amber-950 via-slate-900 to-slate-950";
    iconBox.className = `relative w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-b ${bgGradient} border-2 border-amber-400/60 flex items-center justify-center shrink-0 overflow-hidden shadow-inner`;
    if (unit.heroCfg)
      iconEl.className = `fa-solid ${unit.heroCfg.icon} ${unit.heroCfg.accentColor} text-lg`;
    else if (unit.type === "redman")
      iconEl.className = "fa-solid fa-fire text-red-500 text-lg";
    else if (unit.type === "kong")
      iconEl.className = "fa-solid fa-crown text-amber-400 text-lg";
    else if (unit.type === "sneakygolem")
      iconEl.className = "fa-solid fa-eye text-pink-400 text-lg";
    else if (unit.type === "dragon")
      iconEl.className = "fa-solid fa-dragon text-orange-400 text-lg";
    else if (unit.type === "boss")
      iconEl.className = "fa-solid fa-skull text-orange-400 text-lg";
    else if (unit.type === "tower" || unit.type === "ancient")
      iconEl.className = "fa-solid fa-chess-rook text-amber-300 text-lg";
    else if (unit.type === "vampire")
      iconEl.className = "fa-solid fa-skull text-rose-400 text-lg";
    else if (unit.type === "werewolf")
      iconEl.className = "fa-solid fa-paw text-amber-400 text-lg";
    else if (unit.type === "neutral")
      iconEl.className = "fa-solid fa-paw text-amber-300 text-lg";
    else
      iconEl.className =
        "fa-solid fa-shield-halved text-slate-300 text-lg";

    const renderedStatic =
      inspCanvas &&
      portraitStudio.renderStaticEntityPortrait(unit, inspCanvas);
    iconEl.classList.toggle("hidden", !!renderedStatic);
    iconEl._hidden = !!renderedStatic;
  }

  // Mana container: hide if unit has no mana (towers, standard creeps)
  const manaBox = document.getElementById("insp-mana-container");
  if (manaBox) {
    manaBox.classList.toggle("hidden", (unit.maxMana || 0) <= 0);
  }

  // Attributes row (STR / AGI / INT) - for heroes
  if (attrRow) {
    if (isHero) {
      attrRow.classList.remove("hidden");
      const strEl = document.getElementById("insp-str-val");
      const agiEl = document.getElementById("insp-agi-val");
      const intEl = document.getElementById("insp-int-val");
      if (strEl) strEl.textContent = Math.round(unit.str || 0);
      if (agiEl) agiEl.textContent = Math.round(unit.agi || 0);
      if (intEl) intEl.textContent = Math.round(unit.int || 0);

      // Highlight primary attribute
      const prim = unit.heroCfg ? unit.heroCfg.attr : "";
      const boxStr = document.getElementById("insp-attr-str");
      const boxAgi = document.getElementById("insp-attr-agi");
      const boxInt = document.getElementById("insp-attr-int");
      if (boxStr)
        boxStr.className = `flex items-center justify-center gap-1.5 py-0.5 px-1 rounded bg-rose-950/40 border cursor-help transition ${prim === "Strength" ? "border-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.5)] font-black" : "border-rose-500/30 hover:border-rose-400"}`;
      if (boxAgi)
        boxAgi.className = `flex items-center justify-center gap-1.5 py-0.5 px-1 rounded bg-emerald-950/40 border cursor-help transition ${prim === "Agility" ? "border-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.5)] font-black" : "border-emerald-500/30 hover:border-emerald-400"}`;
      if (boxInt)
        boxInt.className = `flex items-center justify-center gap-1.5 py-0.5 px-1 rounded bg-cyan-950/40 border cursor-help transition ${prim === "Intelligence" ? "border-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.5)] font-black" : "border-cyan-500/30 hover:border-cyan-400"}`;
    } else {
      attrRow.classList.add("hidden");
    }
  }

  renderInspectedHeroAbilities(unit);
  renderInspectedHeroInventory(unit);
};

window.clearInspectedUnit = function () {
  inspectedUnit = null;
  _lastInspectedInvSig = "";
  _lastInspectedAbilitySig = "";
  const panel = document.getElementById("unit-inspector-panel");
  if (panel) panel.classList.add("hidden");
};

function getNearbyShop() {
  if (!playerHero || playerHero.dead) return null;
  for (const s of shopEntities) {
    if (
      Math.hypot(
        playerHero.mesh.position.x - s.x,
        playerHero.mesh.position.z - s.z,
      ) <= 14.5
    )
      return s;
  }
  return null;
}

function isHeroNearSecretShop(hero) {
  if (!hero || hero.dead) return false;
  return shopEntities.some(
    (s) =>
      s.type === "secret" &&
      Math.hypot(
        hero.mesh.position.x - s.x,
        hero.mesh.position.z - s.z,
      ) <= 14.5,
  );
}

const _hudElCache = new Map();
function getHudEl(id) {
  let el = _hudElCache.get(id);
  if (!el) {
    el = document.getElementById(id);
    if (el) _hudElCache.set(id, el);
  }
  return el;
}
let _hudDomAccum = 0;
let _worldBarAccum = 0;
let _minimapRedrawAccum = 0;
let _fpsSmooth = 120;

function syncHUDAndMinimap(dt) {
  if (inHeroSelect || inTitleScreen) return;

  if (dt > 0.0005) {
    const instFps = Math.min(240, 1.0 / dt);
    _fpsSmooth += (instFps - _fpsSmooth) * Math.min(1, dt * 8.0);
  }

  const isUltraLightHud = userSettings.qualityPreset === "ultralight";
  portraitStudio.update(dt, matchTime);

  // World-Space Health Bars (30 Hz in Ultra Light, 60-120 Hz otherwise) & Floating Combat Text
  _worldBarAccum += dt;
  const runWorldBars = !isUltraLightHud || _worldBarAccum >= 0.032;
  if (runWorldBars) _worldBarAccum = 0;

  const winW = window.innerWidth;
  const winH = window.innerHeight;
  if (runWorldBars) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.dead) continue;
      // Fast world-space distance cull before 3D->2D matrix projection
      if (
        Math.abs(u.mesh.position.x - cameraFocus.x) > 74 ||
        Math.abs(u.mesh.position.z - cameraFocus.z) > 64
      ) {
        if (u.bar._vis !== false) {
          u.bar.el.style.opacity = "0";
          u.bar._vis = false;
        }
        continue;
      }
      const yOff =
        u.type === "sneakygolem"
          ? 14.8
          : u.type === "ancient"
            ? 9.6
            : u.type === "kong"
              ? 9.0
              : u.type === "dragon"
                ? 9.6
                : u.type === "boss"
                  ? 8.0
                  : u.type === "tower"
                    ? 9.5
                    : u.type === "hero"
                      ? 5.35
                      : u.isMiniBoss
                        ? 5.55
                        : u.type === "vampire" || u.type === "werewolf"
                          ? 4.35
                          : 3.35;
      const sc = projectToScreen(u.mesh.position, yOff);
      const isVis =
        sc.visible &&
        sc.x >= -90 &&
        sc.x <= winW + 90 &&
        sc.y >= -90 &&
        sc.y <= winH + 90;
      const bar = u.bar;
      if (!isVis) {
        if (bar._vis !== false) {
          bar.el.style.opacity = "0";
          bar._vis = false;
        }
      } else {
        if (bar._vis !== true) {
          bar.el.style.opacity = "1";
          bar._vis = true;
        }
        if (
          bar._lx === undefined ||
          Math.abs(sc.x - bar._lx) + Math.abs(sc.y - bar._ly) > 0.35
        ) {
          bar.el.style.transform = `translate3d(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
          bar._lx = sc.x;
          bar._ly = sc.y;
        }
        const hpPct = `${Math.max(0, (u.hp / u.maxHp) * 100).toFixed(1)}%`;
        if (bar._hp !== hpPct) {
          bar.hp.style.width = hpPct;
          bar._hp = hpPct;
        }
        if (bar.sh) {
          const shPct = `${Math.min(100, (u.shield / u.maxHp) * 100).toFixed(1)}%`;
          if (bar._sh !== shPct) {
            bar.sh.style.width = shPct;
            bar._sh = shPct;
          }
        }
        if (bar.mp && u.maxMana > 0) {
          const mpPct = `${Math.max(0, (u.mana / u.maxMana) * 100).toFixed(1)}%`;
          if (bar._mp !== mpPct) {
            bar.mp.style.width = mpPct;
            bar._mp = mpPct;
          }
        }
        if (bar.lvl && bar._lvl !== u.level) {
          bar.lvl.textContent = `Lv${u.level}`;
          bar._lvl = u.level;
        }
        if (bar.status) {
          let stSig = "";
          let stHtml = "";
          if (u.stunTimer > 0) {
            const sSec = u.stunTimer.toFixed(1);
            stSig += `STN:${sSec}|`;
            stHtml += `<span title="Stunned (${sSec}s)" class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-amber-500/95 text-slate-950 font-mono font-black text-[8px] leading-none shadow border border-yellow-200 animate-pulse"><i class="fa-solid fa-star text-[8px]"></i>${sSec}</span>`;
          }
          if (u.slowTimer > 0) {
            stSig += "SLW|";
            stHtml += `<span title="Slowed" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-900/95 text-sky-200 border border-sky-400/75 shadow"><i class="fa-solid fa-icicles text-[8px]"></i></span>`;
          }
          if (u.bkbTimer > 0) {
            stSig += "BKB|";
            stHtml += `<span title="Spell Immune" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-900/95 text-amber-200 border border-amber-400/80 shadow"><i class="fa-solid fa-crown text-[8px]"></i></span>`;
          }
          if (u.bladeMailTimer > 0) {
            stSig += "THN|";
            stHtml += `<span title="Thorns Reflect" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-900/95 text-orange-200 border border-orange-400/80 shadow"><i class="fa-solid fa-burst text-[8px]"></i></span>`;
          }
          if (u.ancientFuryTimer > 0) {
            stSig += "FRY|";
            stHtml += `<span title="Enraged" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-900/95 text-rose-200 border border-rose-400/80 shadow"><i class="fa-solid fa-fire text-[8px]"></i></span>`;
          }
          if (bar._stSig !== stSig) {
            bar._stSig = stSig;
            if (stHtml) {
              bar.status.innerHTML = stHtml;
              bar.status.classList.remove("hidden");
            } else {
              bar.status.innerHTML = "";
              bar.status.classList.add("hidden");
            }
          }
        }
      }
    }
  }

  LowRamOptimizer.FloatTextPool.update(performance.now());
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.life -= dt;
    f.pos.y += f.vy * dt;
    if (f.life <= 0) {
      f.el.remove();
      floatTexts.splice(i, 1);
      continue;
    }
    const sc = projectToScreen(f.pos, 0);
    f.el.style.transform = `translate3d(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    f.el.style.opacity = `${Math.max(0, f.life / f.maxLife).toFixed(2)}`;
  }

  if (tpBeaconMeshes.length > 0) {
    for (let i = 0; i < tpBeaconMeshes.length; i++) {
      const bm = tpBeaconMeshes[i];
      bm.rotation.z += dt * 2.4;
      const s = 1.0 + Math.sin(matchTime * 6.5) * 0.14;
      bm.scale.set(s, s, 1);
    }
  }

  // Decoupled HUD Panels & Inspector Sync (12 Hz in Ultra Light, 30 Hz on standard tiers)
  _hudDomAccum += dt;
  const hudTickInterval = isUltraLightHud ? 0.082 : 0.032;
  if (_hudDomAccum < hudTickInterval && !tpTargetMode) return;
  const hudStepDt = _hudDomAccum;
  _hudDomAccum = 0;

  const setTxt = (id, v) => {
    const el = getHudEl(id);
    if (el && el._t !== v) {
      el.textContent = v;
      el._t = v;
    }
  };
  const setW = (id, v) => {
    const el = getHudEl(id);
    if (el && el._w !== v) {
      el.style.width = v;
      el._w = v;
    }
  };

  const fpsVal = Math.round(_fpsSmooth);
  setTxt("hud-fps", `${fpsVal} FPS`);
  const fpsEl = getHudEl("hud-fps");
  if (fpsEl) {
    const fpsColor =
      fpsVal >= 45 ? "#67e8f9" : fpsVal >= 26 ? "#fbbf24" : "#fb7185";
    if (fpsEl._c !== fpsColor) {
      fpsEl.style.color = fpsColor;
      fpsEl._c = fpsColor;
    }
  }
  const pingEl = getHudEl("hud-ping");
  if (pingEl) {
    let pText = "LOCAL";
    let pColor = "#34d399";
    if (
      mpState.active &&
      (mpState.role === "host" || mpState.role === "guest")
    ) {
      if (typeof mpState.pingMs === "number") {
        const ms = Math.round(mpState.pingMs);
        pText = `${ms} ms`;
        pColor = ms < 85 ? "#34d399" : ms < 165 ? "#fbbf24" : "#fb7185";
      } else {
        pText = mpState.role === "host" ? "HOST" : "... ms";
        pColor = "#38bdf8";
      }
    }
    if (pingEl._t !== pText) {
      pingEl.textContent = pText;
      pingEl._t = pText;
    }
    if (pingEl._c !== pColor) {
      pingEl.style.color = pColor;
      pingEl._c = pColor;
    }
  }

  if (inspectedUnit) {
    if (inspectedUnit.dead || inspectedUnit.isPlayer)
      window.clearInspectedUnit();
    else {
      const atkBtn = getHudEl("insp-attack-btn");
      if (atkBtn) {
        const hideAtk =
          !playerHero ||
          playerHero.dead ||
          playerHero.reincarnating ||
          inspectedUnit.team === playerHero.team;
        atkBtn.classList.toggle("hidden", hideAtk);
      }
      if (inspectedUnit.type === "hero") {
        setTxt(
          "insp-name",
          `Lv${inspectedUnit.level} ${inspectedUnit.name}`,
        );
        const lvlText = getHudEl("insp-lvl-text");
        if (lvlText) lvlText.textContent = inspectedUnit.level;
        setTxt("insp-str-val", String(Math.round(inspectedUnit.str || 0)));
        setTxt("insp-agi-val", String(Math.round(inspectedUnit.agi || 0)));
        setTxt("insp-int-val", String(Math.round(inspectedUnit.int || 0)));
        renderInspectedHeroAbilities(inspectedUnit);
        renderInspectedHeroInventory(inspectedUnit);
      }
      const inspPct = `${Math.max(0, (inspectedUnit.hp / inspectedUnit.maxHp) * 100).toFixed(1)}%`;
      setW("insp-hp-fill", inspPct);
      setW("insp-hp-ghost", inspPct);
      setTxt(
        "insp-hp-text",
        `${Math.ceil(inspectedUnit.hp)} / ${Math.ceil(inspectedUnit.maxHp)}`,
      );
      setTxt(
        "insp-hp-regen",
        `+${(inspectedUnit.hpRegen || 0).toFixed(1)}/s`,
      );

      // Mana sync
      const manaBox = getHudEl("insp-mana-container");
      if (manaBox && (inspectedUnit.maxMana || 0) > 0) {
        const manaPct = `${Math.max(0, Math.min(100, (inspectedUnit.mana / inspectedUnit.maxMana) * 100)).toFixed(1)}%`;
        setW("insp-mana-fill", manaPct);
        setTxt(
          "insp-mana-text",
          `${Math.ceil(inspectedUnit.mana)} / ${Math.ceil(inspectedUnit.maxMana)}`,
        );
        setTxt(
          "insp-mana-regen",
          `+${(inspectedUnit.manaRegen || 0).toFixed(1)}/s`,
        );
      }

      setTxt("insp-atk", String(Math.round(inspectedUnit.atkDamage)));
      const effectiveArmor =
        inspectedUnit.armor + (inspectedUnit.towerBonusArmor || 0);
      const armMitPct = Math.round(
        ((effectiveArmor * 0.045) /
          (1 + Math.abs(effectiveArmor) * 0.045)) *
          100,
      );
      setTxt("insp-arm", `${Math.round(effectiveArmor)} (${armMitPct}%)`);
      setTxt(
        "insp-spd",
        String(Math.round(inspectedUnit.getEffectiveSpeed() * 25)),
      );
      setTxt(
        "insp-rng",
        inspectedUnit.atkRange <= 3.5
          ? "Melee"
          : `Ranged (${Math.round(inspectedUnit.atkRange)}m)`,
      );
      const itemsOwned =
        inspectedUnit.type === "hero"
          ? inspectedUnit.inventory.filter(Boolean).length
          : 0;
      let extraStatus = inspectedUnit.hasAegis
        ? "Aegis Immortal"
        : inspectedUnit.towerAuraActive
          ? `Tower Tough (+${inspectedUnit.towerBonusArmor} ARM)`
          : inspectedUnit.type === "hero"
            ? `${itemsOwned}/6 Items`
            : inspectedUnit.isMega
              ? "Mega Unit"
              : inspectedUnit.isAncientNeutral
                ? "Ancient Tier " + escalationTier
                : `Tier ${escalationTier}`;
      if (
        inspectedUnit.type === "kong" ||
        inspectedUnit.type === "redman"
      ) {
        extraStatus =
          inspectedUnit.ancientFuryTimer > 0
            ? "ANCIENT FURY! (ENRAGED)"
            : "Undying (Min 1 HP)";
      } else if (inspectedUnit.type === "sneakygolem") {
        extraStatus =
          inspectedUnit.ancientFuryTimer > 0
            ? "ANCIENT FURY! (ENRAGED)"
            : inspectedUnit.golemSubduedAtOneHp || inspectedUnit.hp <= 1
              ? "Subdued (1 HP • No Regen)"
              : "Shields Ancient (Reduce to 1 HP)";
      } else if (inspectedUnit.type === "tower") {
        const tLock = getStructureTierLockReason(inspectedUnit);
        extraStatus = tLock
          ? tLock.replace("INVULNERABLE! ", "Invulnerable • ")
          : "Active Tier • Siegeable";
      } else if (inspectedUnit.type === "ancient") {
        const towersLeft = units.filter(
          (t) =>
            !t.dead &&
            t.team === inspectedUnit.team &&
            t.type === "tower",
        ).length;
        const sgGuard = units.find(
          (g) =>
            !g.dead &&
            g.team === inspectedUnit.team &&
            g.type === "sneakygolem",
        );
        const kongGuard = units.some(
          (k) =>
            !k.dead && k.team === inspectedUnit.team && k.type === "kong",
        );
        extraStatus =
          inspectedUnit.ancientImmunityTimer > 0
            ? `Immune (${inspectedUnit.ancientImmunityTimer.toFixed(1)}s)`
            : towersLeft > 0
              ? `Invulnerable (${towersLeft} Towers)`
              : sgGuard && sgGuard.hp > 1
                ? "Invulnerable (Subdue Sneaky Golem)"
                : kongGuard
                  ? "Guarded by Guardians"
                  : "Vulnerable";
      }
      setTxt("insp-extra", extraStatus);
      const inspExtraEl = getHudEl("insp-extra");
      if (inspExtraEl) {
        inspExtraEl.title = extraStatus;
      }
      const inspStatusRow = getHudEl("insp-status-row");
      if (inspStatusRow) {
        const badges = [];
        if (inspectedUnit.stunTimer > 0)
          badges.push(
            `<span title="Stunned (${inspectedUnit.stunTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-950/90 border border-amber-400 text-amber-300 font-mono font-bold text-[9px]"><i class="fa-solid fa-star"></i>${inspectedUnit.stunTimer.toFixed(1)}s</span>`,
          );
        if (inspectedUnit.slowTimer > 0)
          badges.push(
            `<span title="Slowed (${inspectedUnit.slowTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-950/90 border border-sky-400/60 text-sky-200 font-mono font-bold text-[9px]"><i class="fa-solid fa-icicles"></i>${inspectedUnit.slowTimer.toFixed(1)}s</span>`,
          );
        if ((inspectedUnit._desolatorShred || 0) > 0)
          badges.push(
            `<span title="Armor Shred -${inspectedUnit._desolatorShred.toFixed(1)}" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-950/90 border border-rose-500/60 text-rose-300 font-mono font-bold text-[9px]"><i class="fa-solid fa-shield-halved"></i>-${inspectedUnit._desolatorShred.toFixed(1)}</span>`,
          );
        if (inspectedUnit.fatalBondTimer > 0)
          badges.push(
            `<span title="Fatal Bonds" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-950/90 border border-fuchsia-400/60 text-fuchsia-200 text-[9px]"><i class="fa-solid fa-link"></i></span>`,
          );
        if (inspectedUnit.isSleeping)
          badges.push(
            `<span title="Sleeping" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-950/90 border border-sky-400/50 text-sky-300 text-[9px]"><i class="fa-solid fa-moon"></i></span>`,
          );
        if (inspectedUnit.bkbTimer > 0)
          badges.push(
            `<span title="Spell Immune (${inspectedUnit.bkbTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-950/90 border border-amber-400 text-amber-200 font-mono font-bold text-[9px]"><i class="fa-solid fa-crown"></i>${inspectedUnit.bkbTimer.toFixed(1)}s</span>`,
          );
        if (inspectedUnit.shield > 0)
          badges.push(
            `<span title="Shield +${Math.ceil(inspectedUnit.shield)}" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-400/60 text-cyan-200 font-mono font-bold text-[9px]"><i class="fa-solid fa-shield"></i>+${Math.ceil(inspectedUnit.shield)}</span>`,
          );
        if (inspectedUnit.bladeMailTimer > 0)
          badges.push(
            `<span title="Thorns (${inspectedUnit.bladeMailTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-950/90 border border-orange-400/60 text-orange-200 font-mono font-bold text-[9px]"><i class="fa-solid fa-burst"></i>${inspectedUnit.bladeMailTimer.toFixed(1)}s</span>`,
          );
        if (inspectedUnit.blinkBuffTimer > 0)
          badges.push(
            `<span title="Haste (${inspectedUnit.blinkBuffTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-400/60 text-emerald-200 font-mono font-bold text-[9px]"><i class="fa-solid fa-wind"></i>${inspectedUnit.blinkBuffTimer.toFixed(1)}s</span>`,
          );
        if (inspectedUnit.towerAuraActive)
          badges.push(
            `<span title="Tower Protection Aura" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-950/90 border border-emerald-400/50 text-emerald-300 text-[9px]"><i class="fa-solid fa-chess-rook"></i></span>`,
          );
        if (inspectedUnit.ancientFuryTimer > 0)
          badges.push(
            `<span title="Ancient Fury" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-950/95 border border-rose-400 text-rose-200 text-[9px]"><i class="fa-solid fa-fire"></i></span>`,
          );
        const sig = badges.join("");
        if (inspStatusRow._sig !== sig) {
          inspStatusRow._sig = sig;
          inspStatusRow.innerHTML = sig;
          inspStatusRow.classList.toggle("hidden", badges.length === 0);
        }
      }
    }
  }

  const mm = Math.floor(matchTime / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(matchTime % 60)
    .toString()
    .padStart(2, "0");
  const prof =
    AI_DIFFICULTY_PROFILES[aiDifficulty] ||
    AI_DIFFICULTY_PROFILES.veteran;
  setTxt("game-clock", `${mm}:${ss}`);
  setTxt(
    "wave-timer-text",
    `${matchMode.toUpperCase()} ${prof.label} • ${Math.ceil(waveCountdown)}s`,
  );
  setTxt("score-radiant", String(radiantKills));
  setTxt("score-dire", String(direKills));

  const nearShop = getNearbyShop();
  const nearSecretNow = isHeroNearSecretShop(playerHero);
  if (window._lastNearSecretShop !== nearSecretNow) {
    window._lastNearSecretShop = nearSecretNow;
    refreshActiveShopIfOpen();
  }

  if (playerHero) {
    const aegisBadge = getHudEl("aegis-hud-badge");
    if (playerHero.hasAegis) {
      if (aegisBadge._vis !== true) {
        aegisBadge.classList.remove("hidden");
        aegisBadge._vis = true;
      }
      const am = Math.floor(playerHero.aegisTimer / 60)
        .toString()
        .padStart(2, "0");
      const as = Math.floor(playerHero.aegisTimer % 60)
        .toString()
        .padStart(2, "0");
      setTxt("aegis-timer-text", `${am}:${as}`);
    } else if (aegisBadge && aegisBadge._vis !== false) {
      aegisBadge.classList.add("hidden");
      aegisBadge._vis = false;
    }

    setTxt(
      "hud-kda",
      `${playerHero.kills} / ${playerHero.deaths} / ${playerHero.assists}`,
    );
    setTxt("hud-lh", String(playerHero.lastHits));
    setTxt("hud-lvl", String(playerHero.level));
    setTxt("stat-str", String(playerHero.str));
    setTxt("stat-agi", String(playerHero.agi));
    setTxt("stat-int", String(playerHero.int));
    setTxt("hud-stat-atk", String(Math.round(playerHero.atkDamage)));
    const effPlayerArm = Math.round(
      playerHero.armor + (playerHero.towerBonusArmor || 0),
    );
    setTxt(
      "hud-stat-arm",
      playerHero.towerAuraActive
        ? `${effPlayerArm}*`
        : String(effPlayerArm),
    );
    const armEl = getHudEl("hud-stat-arm");
    if (armEl)
      armEl.className = playerHero.towerAuraActive
        ? "font-mono font-bold text-emerald-300 text-[11px]"
        : "font-mono font-bold text-white text-[11px]";
    setTxt(
      "hud-stat-spd",
      String(Math.round(playerHero.getEffectiveSpeed() * 25)),
    );
    setW(
      "hud-xp-fill",
      `${playerHero.level >= MAX_HERO_LEVEL ? 100 : ((playerHero.xp / playerHero.xpToNext) * 100).toFixed(1)}%`,
    );

    const heroHpPct = `${((playerHero.hp / playerHero.maxHp) * 100).toFixed(1)}%`;
    setW("hud-hp-fill", heroHpPct);
    setW("hud-hp-ghost", heroHpPct);
    setW(
      "hud-shield-fill",
      `${Math.min(100, (playerHero.shield / playerHero.maxHp) * 100).toFixed(1)}%`,
    );
    setTxt(
      "hud-hp-str",
      `${Math.ceil(playerHero.hp)} / ${Math.ceil(playerHero.maxHp)}`,
    );
    setTxt("hud-hp-reg", `+${playerHero.hpRegen.toFixed(1)}/s`);

    setW(
      "hud-mp-fill",
      `${((playerHero.mana / playerHero.maxMana) * 100).toFixed(1)}%`,
    );
    setTxt(
      "hud-mp-str",
      `${Math.ceil(playerHero.mana)} / ${Math.ceil(playerHero.maxMana)}`,
    );
    setTxt("hud-mp-reg", `+${playerHero.manaRegen.toFixed(1)}/s`);

    // Update Player Active Positive & Negative Status Bar (Compact Icon Badges) + Screen Stun Vignette
    const statusBarEl = getHudEl("hud-status-bar");
    if (statusBarEl) {
      const pBadges = [];
      if (!playerHero.dead) {
        if (playerHero.stunTimer > 0) {
          pBadges.push(
            `<span title="Stunned (${playerHero.stunTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-950/95 border border-amber-400 text-amber-300 font-mono font-black text-[9.5px] shadow-[0_0_10px_rgba(250,204,21,0.55)] animate-pulse"><i class="fa-solid fa-star"></i>${playerHero.stunTimer.toFixed(1)}s</span>`,
          );
        }
        if (playerHero.slowTimer > 0) {
          const slowPct = Math.round(
            (1 - (playerHero.slowFactor || 0.6)) * 100,
          );
          pBadges.push(
            `<span title="Slowed -${slowPct}% (${playerHero.slowTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-950/95 border border-sky-400/70 text-sky-200 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-icicles"></i>${playerHero.slowTimer.toFixed(1)}s</span>`,
          );
        }
        if ((playerHero._desolatorShred || 0) > 0) {
          pBadges.push(
            `<span title="Armor Shred -${playerHero._desolatorShred.toFixed(1)}" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-950/90 border border-rose-500/70 text-rose-300 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-shield-halved"></i>-${playerHero._desolatorShred.toFixed(1)}</span>`,
          );
        }
        if (playerHero.fatalBondTimer > 0) {
          pBadges.push(
            `<span title="Fatal Bonds (${playerHero.fatalBondTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-950/90 border border-fuchsia-400/70 text-fuchsia-200 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-link"></i>${playerHero.fatalBondTimer.toFixed(1)}s</span>`,
          );
        }
        if (playerHero.bkbTimer > 0) {
          pBadges.push(
            `<span title="Spell Immune (${playerHero.bkbTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-950/95 border border-amber-400 text-amber-200 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-crown"></i>${playerHero.bkbTimer.toFixed(1)}s</span>`,
          );
        }
        if (playerHero.shield > 0) {
          pBadges.push(
            `<span title="Shield +${Math.ceil(playerHero.shield)}" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-400/70 text-cyan-200 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-shield"></i>+${Math.ceil(playerHero.shield)}</span>`,
          );
        }
        if (playerHero.bladeMailTimer > 0) {
          pBadges.push(
            `<span title="Thorns Reflect (${playerHero.bladeMailTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-950/90 border border-orange-400/70 text-orange-200 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-burst"></i>${playerHero.bladeMailTimer.toFixed(1)}s</span>`,
          );
        }
        if (playerHero.blinkBuffTimer > 0) {
          pBadges.push(
            `<span title="Haste (${playerHero.blinkBuffTimer.toFixed(1)}s)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-400/70 text-emerald-200 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-wind"></i>${playerHero.blinkBuffTimer.toFixed(1)}s</span>`,
          );
        }
        if (playerHero.towerAuraActive) {
          pBadges.push(
            `<span title="Tower Protection (+${playerHero.towerBonusArmor} Armor)" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-400/55 text-emerald-300 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-chess-rook"></i>+${playerHero.towerBonusArmor}</span>`,
          );
        }
        if (
          playerHero.fierySoulTimer > 0 &&
          playerHero.fierySoulStacks > 0
        ) {
          pBadges.push(
            `<span title="Fiery Soul x${playerHero.fierySoulStacks}" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-950/90 border border-orange-400/70 text-orange-200 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-fire"></i>x${playerHero.fierySoulStacks}</span>`,
          );
        }
        if (playerHero.hasRadiance) {
          pBadges.push(
            `<span title="Radiance Burn Aura" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-950/85 border border-yellow-400/55 text-yellow-200 text-[9.5px]"><i class="fa-solid fa-sun"></i></span>`,
          );
        }
        if (playerHero.hasAegis) {
          pBadges.push(
            `<span title="Aegis of the Immortal" class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-950/95 border border-amber-300 text-amber-200 text-[9.5px]"><i class="fa-solid fa-shield-heart"></i></span>`,
          );
        }
        if (playerHero.hasVampLeaderBuff) {
          pBadges.push(
            `<span title="Vampire Lord Blessing (Permanent): +6% Lifesteal" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-950/95 border border-rose-400 text-rose-200 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-droplet"></i>+6% LS</span>`,
          );
        }
        if (playerHero.hasWolfLeaderBuff) {
          pBadges.push(
            `<span title="Alpha Moonfang Blessing (Permanent): +8% Move Speed & +6% Attack Speed" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-950/95 border border-sky-400 text-sky-200 font-mono font-bold text-[9.5px]"><i class="fa-solid fa-paw"></i>+8% SPD</span>`,
          );
        }
      }
      const pSig = pBadges.join("");
      if (statusBarEl._sig !== pSig) {
        statusBarEl._sig = pSig;
        statusBarEl.innerHTML = pSig;
        statusBarEl.classList.toggle("hidden", pBadges.length === 0);
      }
    }
    let stunVigEl = document.getElementById("hud-stun-vignette");
    const isStunnedNow = !playerHero.dead && playerHero.stunTimer > 0;
    if (isStunnedNow) {
      if (!stunVigEl) {
        stunVigEl = document.createElement("div");
        stunVigEl.id = "hud-stun-vignette";
        stunVigEl.style.cssText =
          "position:fixed;inset:0;pointer-events:none;z-index:28;background:radial-gradient(ellipse at center, transparent 56%, rgba(245,158,11,0.28) 90%, rgba(225,29,72,0.52) 120%);transition:opacity 0.12s linear;";
        document.body.appendChild(stunVigEl);
      }
      stunVigEl.style.opacity = "1";
    } else if (stunVigEl && stunVigEl.style.opacity !== "0") {
      stunVigEl.style.opacity = "0";
    }

    const gInt = String(Math.floor(playerHero.gold));
    setTxt("hud-gold", gInt);
    setTxt("shop-gold", gInt);

    const skKeys = ["Q", "W", "E", "R"];
    for (let ki = 0; ki < 4; ki++) {
      const k = skKeys[ki];
      const cd = playerHero.cooldowns[k];
      const ov = getHudEl(`ab-cd-${k}`);
      const btn = getHudEl(`ab-btn-${k}`);
      const manaCost = playerHero.heroCfg
        ? playerHero.heroCfg.skills[k].mana
        : 0;
      const noMana = playerHero.mana < manaCost;
      if (btn._noMana !== noMana) {
        btn.classList.toggle("no-mana", noMana);
        const mSpan = getHudEl(`ab-mana-${k}`);
        if (mSpan)
          mSpan.className = `absolute bottom-0.5 right-1 text-[9px] font-mono font-bold ${noMana ? "text-rose-400" : "text-sky-200"} bg-slate-950/85 px-1 rounded tabular-nums`;
        btn._noMana = noMana;
      }
      if (cd > 0) {
        if (ov._vis !== true) {
          ov.classList.remove("hidden");
          btn.classList.add("on-cd");
          ov._vis = true;
        }
        const cdTxt = cd.toFixed(1);
        if (ov._t !== cdTxt) {
          ov.textContent = cdTxt;
          ov._t = cdTxt;
        }
      } else if (ov._vis !== false) {
        ov.classList.add("hidden");
        btn.classList.remove("on-cd");
        ov._vis = false;
      }
    }
    const shopBtn = getHudEl("btn-open-shop");
    if (shopBtn && shopBtn._inRange !== Boolean(nearShop)) {
      shopBtn.classList.toggle("shop-in-range-pulse", Boolean(nearShop));
      shopBtn._inRange = Boolean(nearShop);
    }

    const tpTotalCharges = playerHero.tpCharges || 0;
    setTxt("hud-tp-charges", `x${tpTotalCharges}`);
    const tpIconEl = getHudEl("hud-tp-icon");
    const hasTp = tpTotalCharges > 0;
    if (tpIconEl && tpIconEl._hasTp !== hasTp) {
      tpIconEl.className = hasTp
        ? "fa-solid fa-scroll text-base sm:text-lg text-cyan-300 group-hover:scale-110 transition-transform"
        : "fa-solid fa-scroll text-base sm:text-lg text-slate-500 group-hover:scale-110 transition-transform";
      tpIconEl._hasTp = hasTp;
    }
    const tpCd = playerHero.itemCooldowns.tp_scroll || 0;
    const tpCdEl = getHudEl("hud-tp-cd");
    const tpBtnEl = getHudEl("btn-tp-scroll");
    if (tpCdEl && tpBtnEl) {
      if (tpCd > 0) {
        if (tpCdEl._vis !== true) {
          tpCdEl.classList.remove("hidden");
          tpBtnEl.classList.add("on-cd");
          tpCdEl._vis = true;
        }
        const tTxt = tpCd.toFixed(1);
        if (tpCdEl._t !== tTxt) {
          tpCdEl.textContent = tTxt;
          tpCdEl._t = tTxt;
        }
      } else if (tpCdEl._vis !== false) {
        tpCdEl.classList.add("hidden");
        tpBtnEl.classList.remove("on-cd");
        tpCdEl._vis = false;
      }
    }

    const rBox = getHudEl("respawn-box");
    if (playerHero.dead) {
      if (rBox._vis !== true) {
        rBox.classList.remove("hidden");
        rBox._vis = true;
      }
      setTxt("respawn-sec", String(Math.ceil(playerHero.respawnTimer)));
    } else if (rBox && rBox._vis !== false) {
      rBox.classList.add("hidden");
      rBox._vis = false;
    }
  }

  _minimapRedrawAccum += hudStepDt;
  const mmInterval = isUltraLightHud ? 0.1 : 0.065;
  if (_minimapRedrawAccum >= mmInterval) {
    _minimapRedrawAccum = 0;
    drawMinimap();
  }
}

let _minimapAccum = 0;
let _minimapBgCanvas = null;
let _minimapBgShopCount = -1;
let _minimapCampCanvas = null;
let _minimapCampMask = -1;

function ensureMinimapBgCache(w, h) {
  if (
    _minimapBgCanvas &&
    _minimapBgCanvas.width === w &&
    _minimapBgCanvas.height === h &&
    _minimapBgShopCount === shopEntities.length
  ) {
    return _minimapBgCanvas;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0f2e22";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#2d131d";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h);
  ctx.stroke();
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(10, h - 10);
  ctx.lineTo(w - 10, 10);
  ctx.stroke();
  shopEntities.forEach((s) => {
    const sx = ((s.x + MAP_HALF) / (MAP_HALF * 2)) * w;
    const sy = ((s.z + MAP_HALF) / (MAP_HALF * 2)) * h;
    ctx.fillStyle = s.type === "secret" ? "#c084fc" : "#facc15";
    ctx.fillRect(sx - 3.5, sy - 3.5, 7, 7);
  });
  _minimapBgCanvas = c;
  _minimapBgShopCount = shopEntities.length;
  return c;
}

function ensureMinimapCampCache(w, h) {
  let mask = 0;
  for (let i = 0; i < neutralCamps.length; i++) {
    if (neutralCamps[i].alive) mask |= 1 << i;
  }
  if (
    _minimapCampCanvas &&
    _minimapCampCanvas.width === w &&
    _minimapCampCanvas.height === h &&
    _minimapCampMask === mask
  ) {
    return _minimapCampCanvas;
  }
  const c = _minimapCampCanvas || document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  const invMap = 1 / (MAP_HALF * 2);
  for (let i = 0; i < neutralCamps.length; i++) {
    const camp = neutralCamps[i];
    const px = (camp.x + MAP_HALF) * invMap * w;
    const py = (camp.z + MAP_HALF) * invMap * h;
    ctx.fillStyle = camp.alive
      ? camp.kind === "vampire"
        ? "#e11d48"
        : camp.kind === "werewolf"
          ? "#d97706"
          : camp.isAncient
            ? "#facc15"
            : "#a855f7"
      : "#334155";
    const sz =
      camp.kind === "vampire" || camp.kind === "werewolf"
        ? 6
        : camp.isAncient
          ? 5
          : 4;
    ctx.beginPath();
    ctx.moveTo(px, py - sz);
    ctx.lineTo(px + sz, py + sz - 1);
    ctx.lineTo(px - sz, py + sz - 1);
    ctx.closePath();
    ctx.fill();
  }
  _minimapCampCanvas = c;
  _minimapCampMask = mask;
  return c;
}

function drawMinimap() {
  if (!minimapCanvas || !minimapCtx) return;
  const w = minimapCanvas.width || 184,
    h = minimapCanvas.height || 184;
  minimapCtx.save();
  minimapCtx.drawImage(ensureMinimapBgCache(w, h), 0, 0);
  if (neutralCamps.length > 0) {
    minimapCtx.drawImage(ensureMinimapCampCache(w, h), 0, 0);
  }

  const invMapW = w / (MAP_HALF * 2);
  const invMapH = h / (MAP_HALF * 2);
  const mapPt = (wx, wz) => ({
    x: (wx + MAP_HALF) * invMapW,
    y: (wz + MAP_HALF) * invMapH,
  });

  // Roshan Boss Marker with 'R' emblem
  const rp = mapPt(-50, -50);
  minimapCtx.fillStyle =
    roshanBoss && !roshanBoss.dead ? "#f97316" : "#475569";
  minimapCtx.strokeStyle = "#fef08a";
  minimapCtx.lineWidth = 1.5;
  minimapCtx.beginPath();
  minimapCtx.arc(rp.x, rp.y, 6.5, 0, Math.PI * 2);
  minimapCtx.fill();
  minimapCtx.stroke();
  minimapCtx.fillStyle = "#fff";
  minimapCtx.font = "bold 8px sans-serif";
  minimapCtx.textAlign = "center";
  minimapCtx.fillText("R", rp.x, rp.y + 3);

  if (elderDragonBoss && !elderDragonBoss.dead) {
    const dp = mapPt(
      elderDragonBoss.mesh.position.x,
      elderDragonBoss.mesh.position.z,
    );
    minimapCtx.fillStyle = "#38bdf8";
    minimapCtx.strokeStyle = "#fef08a";
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.arc(dp.x, dp.y, 6.5, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.stroke();
    minimapCtx.fillStyle = "#0f172a";
    minimapCtx.font = "bold 8px sans-serif";
    minimapCtx.textAlign = "center";
    minimapCtx.fillText("D", dp.x, dp.y + 3);
  }
  runes.forEach((r) => {
    const p = mapPt(r.x, r.z);
    minimapCtx.fillStyle = "#fef08a";
    minimapCtx.beginPath();
    minimapCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  units.forEach((u) => {
    if (u.dead) return;
    const p = mapPt(u.mesh.position.x, u.mesh.position.z);
    const isRad = u.team === "radiant";
    if (u.type === "ancient") {
      minimapCtx.fillStyle = isRad ? "#10b981" : "#f43f5e";
      minimapCtx.fillRect(p.x - 5, p.y - 5, 10, 10);
    } else if (u.type === "tower") {
      minimapCtx.fillStyle = u.name.includes("Citadel")
        ? "#facc15"
        : isRad
          ? "#34d399"
          : "#fb7185";
      minimapCtx.fillRect(p.x - 3.5, p.y - 3.5, 7, 7);
    } else if (u.type === "creep") {
      minimapCtx.fillStyle = u.isMega
        ? "#facc15"
        : isRad
          ? "#4ade80"
          : "#f87171";
      minimapCtx.beginPath();
      minimapCtx.arc(p.x, p.y, u.isMega ? 3 : 2, 0, Math.PI * 2);
      minimapCtx.fill();
    } else if (u.type === "kong") {
      minimapCtx.fillStyle = "#facc15";
      minimapCtx.strokeStyle = isRad ? "#10b981" : "#f43f5e";
      minimapCtx.lineWidth = 2;
      minimapCtx.beginPath();
      minimapCtx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
      minimapCtx.fill();
      minimapCtx.stroke();
      minimapCtx.fillStyle = "#0f172a";
      minimapCtx.font = "bold 8px sans-serif";
      minimapCtx.textAlign = "center";
      minimapCtx.fillText("K", p.x, p.y + 3);
    } else if (u.type === "redman") {
      minimapCtx.fillStyle = "#ef4444";
      minimapCtx.strokeStyle = isRad ? "#10b981" : "#f43f5e";
      minimapCtx.lineWidth = 2;
      minimapCtx.beginPath();
      minimapCtx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
      minimapCtx.fill();
      minimapCtx.stroke();
      minimapCtx.fillStyle = "#fff";
      minimapCtx.font = "bold 8px sans-serif";
      minimapCtx.textAlign = "center";
      minimapCtx.fillText("RM", p.x, p.y + 3);
    } else if (u.type === "sneakygolem") {
      minimapCtx.fillStyle = "#ec4899";
      minimapCtx.strokeStyle = "#facc15";
      minimapCtx.lineWidth = 2.5;
      minimapCtx.beginPath();
      minimapCtx.arc(p.x, p.y, 8.0, 0, Math.PI * 2);
      minimapCtx.fill();
      minimapCtx.stroke();
      minimapCtx.fillStyle = "#fff";
      minimapCtx.font = "bold 8px sans-serif";
      minimapCtx.textAlign = "center";
      minimapCtx.fillText("SG", p.x, p.y + 3);
    } else if (u.type === "vampire") {
      minimapCtx.fillStyle = "#be123c";
      minimapCtx.strokeStyle = "#fda4af";
      minimapCtx.lineWidth = 1.4;
      minimapCtx.beginPath();
      minimapCtx.arc(p.x, p.y, 4.4, 0, Math.PI * 2);
      minimapCtx.fill();
      minimapCtx.stroke();
      minimapCtx.fillStyle = "#fff";
      minimapCtx.font = "bold 7px sans-serif";
      minimapCtx.textAlign = "center";
      minimapCtx.fillText("V", p.x, p.y + 2.5);
    } else if (u.type === "werewolf") {
      minimapCtx.fillStyle = "#b45309";
      minimapCtx.strokeStyle = "#fde68a";
      minimapCtx.lineWidth = 1.4;
      minimapCtx.beginPath();
      minimapCtx.arc(p.x, p.y, 4.4, 0, Math.PI * 2);
      minimapCtx.fill();
      minimapCtx.stroke();
      minimapCtx.fillStyle = "#fff";
      minimapCtx.font = "bold 7px sans-serif";
      minimapCtx.textAlign = "center";
      minimapCtx.fillText("W", p.x, p.y + 2.5);
    } else if (u.type === "hero") {
      minimapCtx.fillStyle = u.isPlayer
        ? "#38bdf8"
        : isRad
          ? "#34d399"
          : "#f43f5e";
      minimapCtx.beginPath();
      minimapCtx.arc(p.x, p.y, 4.8, 0, Math.PI * 2);
      minimapCtx.fill();
      minimapCtx.strokeStyle = "#fff";
      minimapCtx.lineWidth = 1.5;
      minimapCtx.stroke();
    }
  });

  if (tpTargetMode && playerHero) {
    const dests = getValidTeleportDestinations(playerHero.team);
    const pulse = 8 + Math.sin(matchTime * 8) * 2.5;
    dests.forEach((d) => {
      const dp = mapPt(d.x, d.z);
      minimapCtx.strokeStyle = "#22d3ee";
      minimapCtx.lineWidth = 2.2;
      minimapCtx.beginPath();
      minimapCtx.arc(dp.x, dp.y, pulse, 0, Math.PI * 2);
      minimapCtx.stroke();
    });
  }

  if (window._minimapTapPulse && window._minimapTapPulse.ttl > 0) {
    window._minimapTapPulse.ttl = Math.max(
      0,
      window._minimapTapPulse.ttl - 0.016,
    );
    const tp = mapPt(
      window._minimapTapPulse.wx,
      window._minimapTapPulse.wz,
    );
    const prog = 1 - window._minimapTapPulse.ttl / 0.85;
    minimapCtx.strokeStyle = window._minimapTapPulse.color || "#22d3ee";
    minimapCtx.lineWidth = 2.4 * (1 - prog * 0.5);
    minimapCtx.beginPath();
    minimapCtx.arc(tp.x, tp.y, 4 + prog * 14, 0, Math.PI * 2);
    minimapCtx.stroke();
  }

  const cp = mapPt(cameraFocus.x, cameraFocus.z);
  minimapCtx.strokeStyle = "rgba(255,255,255,0.92)";
  minimapCtx.lineWidth = 1.6;
  minimapCtx.strokeRect(cp.x - 16, cp.y - 12, 32, 24);
  if (window.innerWidth < 1024) {
    minimapCtx.strokeStyle = "rgba(250, 204, 21, 0.55)";
    minimapCtx.lineWidth = 4;
    minimapCtx.beginPath();
    minimapCtx.arc(w * 0.5, h * 0.5, w * 0.5 - 2, 0, Math.PI * 2);
    minimapCtx.stroke();
  }
  minimapCtx.restore();
}

