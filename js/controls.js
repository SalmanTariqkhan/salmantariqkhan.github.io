/***********************************************************************
 * 14. INVENTORY ACTIVE ITEMS, 60% SELLING, MULTI-CLASS SHOP & CONTROLS
 ***********************************************************************/
let draggedInvSlot = null;
let swapSourceSlot = null;
let inventorySwapMode = false;
let inventorySellMode = false;

window.toggleInventorySellMode = function () {
  inventorySellMode = !inventorySellMode;
  if (inventorySellMode && inventorySwapMode) {
    inventorySwapMode = false;
    swapSourceSlot = null;
    const swBtn = document.getElementById("btn-inv-swap-mode");
    if (swBtn)
      swBtn.classList.remove(
        "bg-cyan-900",
        "border-cyan-400",
        "text-cyan-200",
      );
  }
  const btn = document.getElementById("btn-inv-sell-mode");
  if (btn) {
    btn.classList.toggle("bg-rose-900", inventorySellMode);
    btn.classList.toggle("border-rose-400", inventorySellMode);
    btn.classList.toggle("text-rose-100", inventorySellMode);
  }
  refreshInventoryGrid();
  if (inventorySellMode && playerHero) {
    spawnFloatText(
      playerHero.mesh.position,
      "Sell Mode: Tap Item for 60% Gold",
      "#fb7185",
      13,
    );
  }
};

window.toggleInventorySwapMode = function () {
  inventorySwapMode = !inventorySwapMode;
  swapSourceSlot = null;
  if (inventorySwapMode && inventorySellMode) {
    inventorySellMode = false;
    const sellBtn = document.getElementById("btn-inv-sell-mode");
    if (sellBtn)
      sellBtn.classList.remove(
        "bg-rose-900",
        "border-rose-400",
        "text-rose-100",
      );
  }
  const btn = document.getElementById("btn-inv-swap-mode");
  if (btn) {
    btn.classList.toggle("bg-cyan-900", inventorySwapMode);
    btn.classList.toggle("border-cyan-400", inventorySwapMode);
    btn.classList.toggle("text-cyan-200", inventorySwapMode);
  }
  refreshInventoryGrid();
  if (inventorySwapMode && playerHero) {
    spawnFloatText(
      playerHero.mesh.position,
      "Swap Mode: Tap 2 Slots",
      "#22d3ee",
      13,
    );
  }
};

window.swapInventorySlots = function (idxA, idxB) {
  if (
    !playerHero ||
    idxA === null ||
    idxB === null ||
    idxA === idxB ||
    idxA < 0 ||
    idxB < 0 ||
    idxA > 5 ||
    idxB > 5
  )
    return;
  const temp = playerHero.inventory[idxA];
  playerHero.inventory[idxA] = playerHero.inventory[idxB];
  playerHero.inventory[idxB] = temp;
  swapSourceSlot = null;
  if (mpState.active && mpState.role === "guest") {
    mpSendToHost({ type: "CMD", cmd: "SWAP_ITEM", idxA, idxB });
  }
  sfx.play("move");
  refreshInventoryGrid();
  spawnFloatText(
    playerHero.mesh.position,
    `Swapped Slot ${idxA + 1} ↔ ${idxB + 1}`,
    "#38bdf8",
    13,
  );
};

window.sellInventorySlot = function (slotIdx) {
  if (!playerHero || gameOver) return;
  const it = playerHero.inventory[slotIdx];
  if (!it) return;

  if (mpState.active && mpState.role === "guest") {
    playerHero.inventory[slotIdx] = null;
    if (swapSourceSlot === slotIdx) swapSourceSlot = null;
    mpSendToHost({ type: "CMD", cmd: "SELL_ITEM", slotIdx });
    sfx.play("gold");
    refreshInventoryGrid();
    const refundEst = Math.max(50, Math.round((it.cost || 400) * 0.6));
    spawnFloatText(
      playerHero.mesh.position,
      `Sold ${it.name} (+${refundEst}g)`,
      "#facc15",
      15,
    );
    return;
  }

  const refund = Math.max(50, Math.round((it.cost || 400) * 0.6));
  playerHero.gold += refund;

  const st = it.stats || {};
  if (st.str) playerHero.str = Math.max(10, playerHero.str - st.str);
  if (st.agi) playerHero.agi = Math.max(10, playerHero.agi - st.agi);
  if (st.int) playerHero.int = Math.max(10, playerHero.int - st.int);
  if (st.moveSpeed)
    playerHero.moveSpeed = Math.max(
      8,
      playerHero.moveSpeed - st.moveSpeed,
    );
  if (st.atkSpeedMult)
    playerHero.atkSpeedMult = Math.max(
      0.5,
      playerHero.atkSpeedMult - st.atkSpeedMult,
    );
  if (st.atkDamage)
    playerHero.atkDamage = Math.max(
      20,
      playerHero.atkDamage - st.atkDamage,
    );
  if (st.maxHp) {
    playerHero.maxHp = Math.max(300, playerHero.maxHp - st.maxHp);
    playerHero.hp = Math.min(playerHero.hp, playerHero.maxHp);
  }
  if (st.hpRegen)
    playerHero.hpRegen = Math.max(1, playerHero.hpRegen - st.hpRegen);
  if (st.armor)
    playerHero.armor = Math.max(0, playerHero.armor - st.armor);
  if (st.maxMana) {
    playerHero.maxMana = Math.max(150, playerHero.maxMana - st.maxMana);
    playerHero.mana = Math.min(playerHero.mana, playerHero.maxMana);
  }
  if (st.manaRegen)
    playerHero.manaRegen = Math.max(
      1,
      playerHero.manaRegen - st.manaRegen,
    );
  if (st.lifesteal)
    playerHero.lifesteal = Math.max(
      0,
      playerHero.lifesteal - st.lifesteal,
    );
  if (st.spellAmpBonus)
    playerHero.spellAmpBonus = Math.max(
      0,
      playerHero.spellAmpBonus - st.spellAmpBonus,
    );
  if (st.critChance)
    playerHero.critChance = Math.max(
      0,
      playerHero.critChance - st.critChance,
    );

  playerHero.inventory[slotIdx] = null;
  syncHeroUniqueItemFlags(playerHero);
  if (swapSourceSlot === slotIdx) swapSourceSlot = null;
  refreshActiveShopIfOpen();

  sfx.play("gold");
  refreshInventoryGrid();
  spawnFloatText(
    playerHero.mesh.position,
    `Sold ${it.name} (+${refund}g)`,
    "#facc15",
    15,
  );
};

window.toggleMobileBagDrawer = function (forceOpen) {
  const card = document.getElementById("hud-inventory-card");
  if (!card) return;
  const nextState =
    typeof forceOpen === "boolean"
      ? forceOpen
      : !card.classList.contains("mobile-bag-open");
  card.classList.toggle("mobile-bag-open", nextState);
  const btn = document.getElementById("btn-toggle-mobile-bag");
  if (btn) {
    btn.classList.toggle("bg-amber-500/25", nextState);
    btn.classList.toggle("border-amber-300", nextState);
  }
};

function refreshInventoryGrid() {
  const grid = document.getElementById("inv-grid");
  grid.innerHTML = "";
  if (!playerHero) return;
  const ownedCount = playerHero.inventory.filter(Boolean).length;
  const bagCountEl = document.getElementById("mobile-bag-count");
  if (bagCountEl) bagCountEl.textContent = `${ownedCount}/6`;
  for (let i = 0; i < 6; i++) {
    const it = playerHero.inventory[i];
    const slot = document.createElement("button");
    const isSelectedSwap = swapSourceSlot === i;
    slot.className = `w-11 h-10 sm:w-12 sm:h-11 rounded-lg bg-slate-950/95 border ${it ? "border-amber-500/70 hover:border-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" : "border-slate-800/90 hover:border-slate-600"} ${isSelectedSwap ? "inv-slot-swap-selected" : ""} flex items-center justify-center relative group transition-all`;
    slot.dataset.hudTip = `inv_${i}`;
    slot.draggable = Boolean(it);

    slot.ondragstart = (e) => {
      if (!playerHero.inventory[i]) {
        e.preventDefault();
        return;
      }
      draggedInvSlot = i;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    };
    slot.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      slot.classList.add("inv-slot-dragover");
    };
    slot.ondragleave = () => {
      slot.classList.remove("inv-slot-dragover");
    };
    slot.ondrop = (e) => {
      e.preventDefault();
      slot.classList.remove("inv-slot-dragover");
      const fromIdx =
        draggedInvSlot !== null
          ? draggedInvSlot
          : parseInt(e.dataTransfer.getData("text/plain"), 10);
      draggedInvSlot = null;
      if (!Number.isNaN(fromIdx)) window.swapInventorySlots(fromIdx, i);
    };
    slot.ondragend = () => {
      draggedInvSlot = null;
      slot.classList.remove("inv-slot-dragover");
    };

    if (it) {
      const sellVal = Math.max(50, Math.round((it.cost || 400) * 0.6));
      const activePip = it.active
        ? `<span class="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_#22d3ee] pointer-events-none"></span>`
        : "";
      const sellBadge = inventorySellMode
        ? `<span class="absolute inset-x-0 bottom-0 bg-rose-950/90 text-[8px] font-mono font-bold text-amber-300 text-center leading-tight pointer-events-none">+${sellVal}g</span>`
        : "";
      if (inventorySellMode) slot.classList.add("border-rose-400");
      slot.innerHTML = `<i class="fa-solid ${it.icon} ${it.color} text-sm sm:text-base pointer-events-none group-hover:scale-110 transition-transform"></i><span class="hud-keycap absolute top-0.5 left-0.5 text-[8px] font-mono font-bold text-amber-300 px-1 py-0.2 rounded pointer-events-none">${i + 1}</span>${activePip}${sellBadge}`;

      let longPressTimer = null;
      let longPressed = false;
      slot.onpointerdown = (pe) => {
        longPressed = false;
        if (pe.pointerType === "touch") {
          longPressTimer = setTimeout(() => {
            longPressed = true;
            window.sellInventorySlot(i);
          }, 550);
        }
      };
      const cancelLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      };
      slot.onpointerup = cancelLongPress;
      slot.onpointerleave = cancelLongPress;
      slot.onpointercancel = cancelLongPress;

      slot.onclick = (e) => {
        if (longPressed) {
          longPressed = false;
          return;
        }
        if (inventorySellMode) {
          window.sellInventorySlot(i);
          return;
        }
        if (inventorySwapMode || e.altKey || swapSourceSlot !== null) {
          if (swapSourceSlot === null) {
            swapSourceSlot = i;
            refreshInventoryGrid();
          } else {
            window.swapInventorySlots(swapSourceSlot, i);
          }
          return;
        }
        if (it.active) useInventorySlot(i);
      };
      slot.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.sellInventorySlot(i);
      };
    } else {
      slot.innerHTML = `<span class="text-[9px] font-mono text-slate-700 pointer-events-none">${i + 1}</span>`;
      slot.title = `Empty Slot [${i + 1}] • Drop item here to move/swap`;
      slot.onclick = () => {
        if (swapSourceSlot !== null) {
          window.swapInventorySlots(swapSourceSlot, i);
        }
      };
    }
    grid.appendChild(slot);
  }
}

// Rich Sovereign HUD Tooltip System
(function initHudTooltipSystem() {
  const tt = document.getElementById("hud-tooltip");
  if (!tt) return;
  const ttTitle = document.getElementById("hud-tt-title");
  const ttBadge = document.getElementById("hud-tt-badge");
  const ttRank = document.getElementById("hud-tt-rank");
  const ttMeta = document.getElementById("hud-tt-meta");
  const ttDesc = document.getElementById("hud-tt-desc");
  const ttHint = document.getElementById("hud-tt-hint");

  function populateTooltip(tipId) {
    if (!playerHero || !playerHero.heroCfg) return false;
    const cfg = playerHero.heroCfg;
    if (
      tipId === "Q" ||
      tipId === "W" ||
      tipId === "E" ||
      tipId === "R"
    ) {
      const sk = cfg.skills[tipId];
      const lvl = playerHero.abilityLevels[tipId] || 0;
      const maxR = getAbilityMaxRank(tipId);
      const reqLvl = getRequiredHeroLevelForNextRank(playerHero, tipId);
      const effCd = (sk.cd * (playerHero.cdrMult || 1)).toFixed(1);
      ttTitle.textContent = sk.name;
      ttBadge.textContent = tipId;
      ttRank.textContent =
        lvl === 0
          ? tipId === "R"
            ? "Unlocks Lv.6"
            : "Not Learned"
          : `Rank ${lvl} / ${maxR}`;
      ttMeta.innerHTML = `<span class="text-sky-300"><i class="fa-solid fa-droplet mr-1"></i>${sk.mana} Mana</span><span class="text-amber-300"><i class="fa-solid fa-clock mr-1"></i>${effCd}s CD</span><span class="text-emerald-300">${sk.targetType === "self" ? "Self / Aura" : "Targeted"}</span>`;
      ttDesc.textContent = sk.desc;
      if (canHeroLevelAbility(playerHero, tipId)) {
        ttHint.textContent = `[Ctrl+${tipId}], Ctrl+Click, or [+1] to ${lvl === 0 ? "learn" : "upgrade"} • [${tipId}] to cast`;
      } else if (lvl === 0) {
        ttHint.textContent = reqLvl
          ? `Requires Hero Level ${reqLvl} & 1 Skill Point`
          : "Not learned";
      } else if (reqLvl && playerHero.level < reqLvl) {
        ttHint.textContent = `Next rank unlocks at Hero Level ${reqLvl} • Press [${tipId}] to cast`;
      } else {
        ttHint.textContent = `Click or press [${tipId}] to cast`;
      }
      return true;
    }
    if (tipId === "talent") {
      playerHero.chosenTalents = playerHero.chosenTalents || {};
      const unlocked = [10, 15, 20, 25].filter(
        (l) => playerHero.chosenTalents && playerHero.chosenTalents[l],
      ).length;
      const nextTier = getNextAvailableTalentTier(playerHero);
      ttTitle.textContent = "Hero Talent Tree";
      ttBadge.textContent = "T";
      ttRank.textContent = `${unlocked} / 4 Chosen`;
      ttMeta.innerHTML = `<span class="text-amber-300">Cost: 1 Skill Point • Tiers: Lv 10, 15, 20, 25</span>`;
      ttDesc.textContent =
        "Spend 1 Skill Point per milestone tier to unlock permanent specialization perks.";
      ttHint.textContent = nextTier
        ? `Lv ${nextTier} Ready! Press [Ctrl+1] Left or [Ctrl+2] Right • [T] to view tree`
        : "Press [T] to open Talent Tree • Quick-pick: [Ctrl+1] / [Ctrl+2]";
      return true;
    }
    if (tipId === "stats") {
      ttTitle.textContent = "Attribute Bonus";
      ttBadge.textContent = "CTRL+U";
      ttRank.textContent = `Rank ${playerHero.attrBonusRank} / ${MAX_ATTR_RANK}`;
      ttMeta.innerHTML = `<span class="text-emerald-300">+2 STR • +2 AGI • +2 INT per rank</span>`;
      ttDesc.textContent =
        "Grants +44 Max HP, +28 Max Mana, +4 Attack Damage, +0.4 Armor, and +3% Attack Speed.";
      ttHint.textContent = canHeroLevelAttributes(playerHero)
        ? "Click, press [Ctrl+U], or Ctrl+Click to spend 1 Skill Point (+2 All Stats)"
        : "Earn Skill Points by leveling up";
      return true;
    }
    if (tipId === "attrs") {
      ttTitle.textContent = `${cfg.name} (${cfg.attr})`;
      ttBadge.textContent = cfg.rangeType.toUpperCase();
      ttRank.textContent = `Lv ${playerHero.level} / ${MAX_HERO_LEVEL}`;
      ttMeta.innerHTML = `<span class="text-rose-300">STR ${playerHero.str}</span><span class="text-emerald-300">AGI ${playerHero.agi}</span><span class="text-sky-300">INT ${playerHero.int}</span>`;
      ttDesc.textContent =
        "Strength boosts HP & Regen • Agility boosts Armor & Attack Speed • Intelligence boosts Mana & Spell Amp.";
      ttHint.textContent =
        "Purchase artifacts in Shop [B] to empower attributes";
      return true;
    }
    if (tipId === "attack") {
      ttTitle.textContent = "Attack / Attack-Move";
      ttBadge.textContent = "A";
      ttRank.textContent = `${Math.round(playerHero.atkDamage)} DMG`;
      ttMeta.innerHTML = `<span class="text-rose-300">Range: ${playerHero.heroCfg.stats.atkRange}m</span>`;
      ttDesc.textContent =
        "Click an enemy to focus-attack, or click ground to advance and engage enemies along the path.";
      ttHint.textContent =
        "Double-tap [A] to immediately attack the nearest enemy";
      return true;
    }
    if (tipId === "stop") {
      ttTitle.textContent = "Stop / Hold Position";
      ttBadge.textContent = "S";
      ttRank.textContent = "Instant";
      ttMeta.innerHTML = `<span class="text-slate-300">Cancels Movement & Channeling</span>`;
      ttDesc.textContent =
        "Immediately halts current movement, auto-attacks, or Town Portal channeling.";
      ttHint.textContent = "Hotkey: [S]";
      return true;
    }
    if (tipId === "tp") {
      const tpLim = getModeConsumableLimit();
      const tpUsed =
        (playerHero.consumableUsedCount &&
          playerHero.consumableUsedCount.tp_scroll) ||
        0;
      ttTitle.textContent = "Town Portal Scroll";
      ttBadge.textContent = "V";
      ttRank.textContent = `${playerHero.tpCharges || 0} Charges (${tpUsed}/${tpLim} Used)`;
      ttMeta.innerHTML = `<span class="text-cyan-300">2.5s Channel</span><span class="text-amber-300">35s CD</span>`;
      ttDesc.textContent =
        "Dedicated TP slot (frees all 6 inventory slots). Teleport to your Base Fountain or any standing Allied Tower.";
      ttHint.textContent =
        "Press [V] to choose destination • Double-tap [V] for Base Fountain";
      return true;
    }
    if (tipId === "buytp") {
      const tpLim = getModeConsumableLimit();
      const tpUsed =
        (playerHero.consumableUsedCount &&
          playerHero.consumableUsedCount.tp_scroll) ||
        0;
      const tpTotal = tpUsed + (playerHero.tpCharges || 0);
      ttTitle.textContent = "Quick-Buy TP Scroll";
      ttBadge.textContent = "100g";
      ttRank.textContent = `${tpTotal}/${tpLim} Mode Limit`;
      ttMeta.innerHTML = `<span class="text-amber-300"><i class="fa-solid fa-coins mr-1"></i>100 Gold</span>`;
      ttDesc.textContent =
        "Purchases +1 Town Portal Scroll directly into your dedicated [V] TP slot (subject to game-mode consumable limit).";
      ttHint.textContent =
        tpTotal >= tpLim
          ? "Consumable limit reached for current game mode"
          : "Click to purchase (+1 Charge)";
      return true;
    }
    if (tipId.startsWith("inv_")) {
      const idx = parseInt(tipId.split("_")[1], 10);
      const it = playerHero.inventory[idx];
      if (!it) {
        ttTitle.textContent = `Inventory Slot ${idx + 1}`;
        ttBadge.textContent = String(idx + 1);
        ttRank.textContent = "Empty";
        ttMeta.innerHTML = `<span class="text-slate-400">6-Slot Artifact Carry</span>`;
        ttDesc.textContent =
          "Purchase relics in the Ancient Armory [B] or drag existing items here to reorganize hotkeys.";
        ttHint.textContent = "Press [B] to open Shop";
        return true;
      }
      const sellVal = Math.max(50, Math.round((it.cost || 400) * 0.6));
      const remCd = it.active
        ? playerHero.itemCooldowns[it.active] || 0
        : 0;
      const cdTagHtml =
        typeof it.cd === "number" && it.cd > 0
          ? `<span class="${remCd > 0 ? "text-rose-300" : "text-sky-300"}"><i class="fa-solid fa-clock mr-1"></i>${remCd > 0 ? remCd.toFixed(1) + "s / " : ""}${it.cd}s CD</span>`
          : "";
      ttTitle.textContent = it.name;
      ttBadge.textContent = `Key ${idx + 1}`;
      ttRank.textContent = it.active ? "Active Relic" : "Passive Relic";
      ttMeta.innerHTML = `<span class="text-amber-300">Sell: +${sellVal}g</span>${cdTagHtml}${it.active ? '<span class="text-cyan-300">Press [' + (idx + 1) + "]</span>" : ""}`;
      ttDesc.textContent = it.desc;
      ttHint.textContent =
        "Drag or Alt+Click to swap • Right-Click to sell for 60% gold";
      return true;
    }
    if (tipId.startsWith("insp_inv_")) {
      if (!inspectedUnit || inspectedUnit.type !== "hero") return false;
      const idx = parseInt(tipId.split("_")[2], 10);
      const it = inspectedUnit.inventory[idx];
      if (!it) {
        ttTitle.textContent = `${inspectedUnit.name} • Slot ${idx + 1}`;
        ttBadge.textContent = "EMPTY";
        ttRank.textContent = "Unoccupied";
        ttMeta.innerHTML = `<span class="text-slate-400">Inspected Hero Inventory</span>`;
        ttDesc.textContent = "This inventory slot is currently empty.";
        ttHint.textContent = "Inspecting hero loadout";
        return true;
      }
      ttTitle.textContent = it.name;
      ttBadge.textContent = `Slot ${idx + 1}`;
      ttRank.textContent = it.active ? "Active Relic" : "Passive Relic";
      ttMeta.innerHTML = `<span class="text-amber-300"><i class="fa-solid fa-coins mr-1"></i>${it.cost || 0}g Value</span><span class="text-slate-300">${inspectedUnit.name}</span>`;
      ttDesc.textContent = it.desc;
      ttHint.textContent = it.active
        ? "Active item owned by inspected hero"
        : "Grants permanent passive bonuses to owner";
      return true;
    }
    if (tipId.startsWith("insp_ability_")) {
      if (!inspectedUnit || !inspectedUnit.heroCfg) return false;
      const key = tipId.split("_")[2];
      const sk =
        inspectedUnit.heroCfg.skills && inspectedUnit.heroCfg.skills[key]
          ? inspectedUnit.heroCfg.skills[key]
          : null;
      if (!sk) return false;
      const lvl =
        inspectedUnit.abilityLevels && inspectedUnit.abilityLevels[key]
          ? inspectedUnit.abilityLevels[key]
          : 0;
      const cdLeft =
        inspectedUnit.cooldowns && inspectedUnit.cooldowns[key]
          ? inspectedUnit.cooldowns[key]
          : 0;
      ttTitle.textContent = `${sk.name} [${key}]`;
      ttBadge.textContent = sk.tag || "HERO ABILITY";
      ttRank.textContent =
        lvl > 0
          ? `Rank ${lvl}/${key === "R" ? 3 : 4}`
          : "Unlearned (Rank 0)";
      const cdText =
        cdLeft > 0
          ? `<span class="text-rose-400 font-bold"><i class="fa-solid fa-clock mr-1"></i>Cooldown: ${cdLeft.toFixed(1)}s</span>`
          : `<span class="text-amber-300"><i class="fa-solid fa-clock mr-1"></i>${sk.cd || 0}s CD</span>`;
      ttMeta.innerHTML = `<span class="text-sky-300"><i class="fa-solid fa-droplet mr-1"></i>${sk.mana || 0} Mana</span>${cdText}`;
      ttDesc.textContent = sk.desc || "";
      ttHint.textContent = `Inspecting ${inspectedUnit.name}'s [${key}] Ability`;
      return true;
    }
    if (tipId === "insp_str") {
      if (!inspectedUnit) return false;
      const isPrim =
        inspectedUnit.heroCfg &&
        inspectedUnit.heroCfg.attr === "Strength";
      ttTitle.textContent = "Strength (STR)";
      ttBadge.textContent = isPrim
        ? "PRIMARY ATTRIBUTE"
        : "HERO ATTRIBUTE";
      ttRank.textContent = `${Math.round(inspectedUnit.str || 0)} Total Strength`;
      ttMeta.innerHTML = `<span class="text-rose-400 font-semibold">+22 HP per point</span><span class="text-rose-300 font-semibold">+0.1 HP/s Regen</span>`;
      ttDesc.textContent = isPrim
        ? "Strength is this hero's Primary Attribute! Each point grants +22 maximum Health, +0.1 HP/s Regeneration, and +1 Base Attack Damage."
        : "Each point of Strength grants +22 maximum Health and +0.1 Health Regeneration per second.";
      ttHint.textContent = "Dota 2 Hero Core Attribute";
      return true;
    }
    if (tipId === "insp_agi") {
      if (!inspectedUnit) return false;
      const isPrim =
        inspectedUnit.heroCfg &&
        inspectedUnit.heroCfg.attr === "Agility";
      ttTitle.textContent = "Agility (AGI)";
      ttBadge.textContent = isPrim
        ? "PRIMARY ATTRIBUTE"
        : "HERO ATTRIBUTE";
      ttRank.textContent = `${Math.round(inspectedUnit.agi || 0)} Total Agility`;
      ttMeta.innerHTML = `<span class="text-emerald-400 font-semibold">+0.16 Armor per point</span><span class="text-emerald-300 font-semibold">+1% Attack Speed</span>`;
      ttDesc.textContent = isPrim
        ? "Agility is this hero's Primary Attribute! Each point grants +0.16 Physical Armor, +1% Attack Speed, and +1 Base Attack Damage."
        : "Each point of Agility grants +0.16 Physical Armor and +1% Attack Speed.";
      ttHint.textContent = "Dota 2 Hero Core Attribute";
      return true;
    }
    if (tipId === "insp_int") {
      if (!inspectedUnit) return false;
      const isPrim =
        inspectedUnit.heroCfg &&
        inspectedUnit.heroCfg.attr === "Intelligence";
      ttTitle.textContent = "Intelligence (INT)";
      ttBadge.textContent = isPrim
        ? "PRIMARY ATTRIBUTE"
        : "HERO ATTRIBUTE";
      ttRank.textContent = `${Math.round(inspectedUnit.int || 0)} Total Intelligence`;
      ttMeta.innerHTML = `<span class="text-cyan-400 font-semibold">+12 Mana per point</span><span class="text-cyan-300 font-semibold">+0.05 MP/s Regen</span>`;
      ttDesc.textContent = isPrim
        ? "Intelligence is this hero's Primary Attribute! Each point grants +12 maximum Mana, +0.05 MP/s Regeneration, +0.1% Spell Amp, and +1 Base Attack Damage."
        : "Each point of Intelligence grants +12 maximum Mana, +0.05 Mana Regeneration per second, and +0.1% Spell Amplification.";
      ttHint.textContent = "Dota 2 Hero Core Attribute";
      return true;
    }
    if (tipId === "dragon") {
      ttTitle.textContent = "Elder Sky Dragon Active";
      ttBadge.textContent = "BOSS";
      ttRank.textContent = lastDragonSpot
        ? lastDragonSpot.region
        : "River Shallows";
      ttMeta.innerHTML = `<span class="text-orange-300"><i class="fa-solid fa-fire mr-1"></i>Elder Dragon Soul</span><span class="text-amber-300"><i class="fa-solid fa-coins mr-1"></i>+1,200g</span>`;
      ttDesc.textContent = lastDragonSpot
        ? `The Apex World Boss has landed in the ${lastDragonSpot.region} (${lastDragonSpot.x}, ${lastDragonSpot.z}). Slay it for Elder Dragon Soul & +1,200 gold!`
        : "The Apex World Boss has landed on the map. Slay it for Elder Dragon Soul & +1,200 gold!";
      ttHint.textContent =
        "Spawns every 5 minutes • Click badge or tap minimap icon to locate";
      return true;
    }
    return false;
  }

  let activeTarget = null;
  let touchTipTimer = null;
  function showTooltipFor(el) {
    if (!populateTooltip(el.dataset.hudTip)) return;
    tt.classList.remove("hidden");
    const rect = el.getBoundingClientRect();
    const ttRect = tt.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(
        window.innerWidth - ttRect.width - 8,
        rect.left + rect.width * 0.5 - ttRect.width * 0.5,
      ),
    );
    const preferredTop = rect.top - ttRect.height - 10;
    const top =
      preferredTop >= 8
        ? preferredTop
        : Math.min(
            window.innerHeight - ttRect.height - 8,
            rect.bottom + 10,
          );
    tt.style.left = `${left}px`;
    tt.style.top = `${top}px`;
  }

  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const el = e.target.closest("[data-hud-tip]");
    if (!el) return;
    activeTarget = el;
    showTooltipFor(el);
  });
  document.addEventListener("pointerout", (e) => {
    if (!activeTarget || e.pointerType === "touch") return;
    const rel =
      e.relatedTarget && e.relatedTarget.closest
        ? e.relatedTarget.closest("[data-hud-tip]")
        : null;
    if (rel !== activeTarget) {
      activeTarget = null;
      tt.classList.add("hidden");
    }
  });
  document.addEventListener("click", (e) => {
    const inspItemSlot = e.target.closest('[data-hud-tip^="insp_inv_"]');
    if (inspItemSlot) {
      e.stopPropagation();
      if (
        activeTarget === inspItemSlot &&
        !tt.classList.contains("hidden")
      ) {
        activeTarget = null;
        tt.classList.add("hidden");
      } else {
        activeTarget = inspItemSlot;
        showTooltipFor(inspItemSlot);
        clearTimeout(touchTipTimer);
        touchTipTimer = setTimeout(() => {
          if (activeTarget === inspItemSlot) {
            activeTarget = null;
            tt.classList.add("hidden");
          }
        }, 3800);
      }
      return;
    }
    const dragonBtn = e.target.closest("#dragon-hud-badge");
    if (dragonBtn) {
      e.stopPropagation();
      if (
        elderDragonBoss &&
        !elderDragonBoss.dead &&
        elderDragonBoss.mesh
      ) {
        cameraFocus.copy(elderDragonBoss.mesh.position);
        cameraLocked = false;
        syncCamLockLabel();
      }
      if (
        activeTarget === dragonBtn &&
        !tt.classList.contains("hidden")
      ) {
        activeTarget = null;
        tt.classList.add("hidden");
      } else {
        activeTarget = dragonBtn;
        showTooltipFor(dragonBtn);
        clearTimeout(touchTipTimer);
        touchTipTimer = setTimeout(() => {
          if (activeTarget === dragonBtn) {
            activeTarget = null;
            tt.classList.add("hidden");
          }
        }, 3800);
      }
      return;
    }
    if (activeTarget === document.getElementById("dragon-hud-badge")) {
      activeTarget = null;
      tt.classList.add("hidden");
    }
  });
})();

function getValidTeleportDestinations(team) {
  const isRad = team === "radiant";
  const dests = [
    {
      id: "base",
      label: isRad ? "Radiant Base Fountain" : "Dire Base Fountain",
      shortLabel: "Base Fountain",
      x: isRad ? -134 : 134,
      z: isRad ? 134 : -134,
      isBase: true,
    },
  ];
  units.forEach((u) => {
    if (!u.dead && u.team === team && u.type === "tower") {
      const cleanShort = u.name
        .replace(/^Radiant\s+|^Dire\s+/i, "")
        .replace(/\s+Tower/i, "");
      dests.push({
        id: `tower_${u.id}`,
        label: u.name,
        shortLabel: cleanShort,
        x: u.mesh.position.x + (isRad ? -2.8 : 2.8),
        z: u.mesh.position.z + (isRad ? 2.8 : -2.8),
        towerPos: u.mesh.position.clone(),
        isBase: false,
      });
    }
  });
  return dests;
}

function clearTpBeacons() {
  tpBeaconMeshes.forEach((bm) => {
    scene.remove(bm);
    if (bm.geometry) bm.geometry.dispose();
    if (bm.material) bm.material.dispose();
  });
  tpBeaconMeshes = [];
}

window.cancelTpTargetMode = function () {
  tpTargetMode = false;
  clearTpBeacons();
  const bar = document.getElementById("tp-dest-bar");
  if (bar) bar.classList.add("hidden");
  updatePrimedState();
};

window.cancelTeleportChannel = function (reason = "Teleport Canceled") {
  if (!playerHero || !playerHero.tpChannel) return;
  playerHero.tpChannel = null;
  playerHero.itemCooldowns.tp_scroll = Math.max(
    playerHero.itemCooldowns.tp_scroll || 0,
    5.0,
  );
  const tpBox = document.getElementById("tp-channel-box");
  if (tpBox) tpBox.classList.add("hidden");
  spawnFloatText(playerHero.mesh.position, reason, "#94a3b8", 13);
};

function completeTeleportChannel(hero) {
  if (!hero || !hero.tpChannel) return;
  const ch = hero.tpChannel;
  hero.tpChannel = null;

  if (hero.isPlayer) {
    const tpBox = document.getElementById("tp-channel-box");
    if (tpBox) tpBox.classList.add("hidden");
  }

  // Consume 1 Town Portal Scroll charge from dedicated TP Slot (not inventory)
  hero.tpCharges = Math.max(0, (hero.tpCharges || 1) - 1);
  if (!hero.consumableUsedCount) hero.consumableUsedCount = {};
  hero.consumableUsedCount.tp_scroll =
    (hero.consumableUsedCount.tp_scroll || 0) + 1;
  refreshActiveShopIfOpen();

  hero.itemCooldowns.tp_scroll = hero.hasTravelBoots ? 17.5 : 35.0;
  const nx = THREE.MathUtils.clamp(
    ch.dest.x,
    -MAP_HALF + 4,
    MAP_HALF - 4,
  );
  const nz = THREE.MathUtils.clamp(
    ch.dest.z,
    -MAP_HALF + 4,
    MAP_HALF - 4,
  );
  const ny = getTerrainHeightAt(nx, nz);

  spawnShockwaveRing(
    hero.mesh.position.x,
    hero.mesh.position.z,
    4.5,
    0x22d3ee,
    0.55,
  );
  hero.mesh.position.set(nx, ny, nz);
  hero.targetPos = null;
  hero.targetUnit = null;
  hero.attackMovePos = null;
  hero.blinkBuffTimer = Math.max(hero.blinkBuffTimer, 2.0);

  sfx.play("spell_blink");
  spawnOrbitalSkyBeam(nx, nz, 4.8, 0x22d3ee, 0.85);
  spawnShockwaveRing(nx, nz, 6.2, 0xfacc15, 0.65);
  spawnParticleBurst(hero.mesh.position, 0x22d3ee, 20);
  spawnFloatText(
    hero.mesh.position,
    `ARRIVED: ${ch.label.toUpperCase()}!`,
    "#22d3ee",
    16,
  );

  if (hero.isPlayer) {
    if (cameraLocked) cameraFocus.copy(hero.mesh.position);
    if (hero.heroCfg) {
      sfx.speakHeroLine(
        hero.heroCfg,
        hero.heroCfg.voice.moves,
        false,
        "normal",
        {
          category: "move",
          chance: 0.55,
          minGapMs: 10000,
          catGapMs: 15000,
        },
      );
    }
  }
}

window.quickBuyTpScroll = function () {
  if (!playerHero || gameOver || inHeroSelect) return;
  const tpDef = SHOP_ITEMS.find((it) => it.id === "tp_scroll");
  if (tpDef) purchaseItem(tpDef);
};

window.startTeleportToDestination = function (destId) {
  if (
    !playerHero ||
    playerHero.dead ||
    playerHero.reincarnating ||
    gameOver
  )
    return;
  const dests = getValidTeleportDestinations(playerHero.team);
  const chosen = dests.find((d) => d.id === destId) || dests[0];
  if (!chosen) return;

  if ((playerHero.tpCharges || 0) <= 0) {
    window.cancelTpTargetMode();
    spawnFloatText(
      playerHero.mesh.position,
      "No Town Portal Scroll!",
      "#fb7185",
      14,
    );
    return;
  }

  const cdLeft = playerHero.itemCooldowns.tp_scroll || 0;
  if (cdLeft > 0) {
    window.cancelTpTargetMode();
    spawnFloatText(
      playerHero.mesh.position,
      `TP Scroll CD: ${cdLeft.toFixed(1)}s`,
      "#94a3b8",
      13,
    );
    return;
  }

  window.cancelTpTargetMode();
  primedSkill = null;
  attackMovePrimed = false;
  updatePrimedState();

  playerHero.targetPos = null;
  playerHero.targetUnit = null;
  playerHero.attackMovePos = null;
  playerHero.mesh.rotation.y = Math.atan2(
    chosen.x - playerHero.mesh.position.x,
    chosen.z - playerHero.mesh.position.z,
  );

  if (mpState.active && mpState.role === "guest") {
    mpSendToHost({ type: "CMD", cmd: "TP_DEST", destId: chosen.id });
    playerHero.tpChannel = {
      timer: 2.5,
      duration: 2.5,
      dest: new THREE.Vector3(chosen.x, 0, chosen.z),
      label: chosen.shortLabel,
    };
    sfx.play("spell_shield_nova");
    spawnOrbitalSkyBeam(
      playerHero.mesh.position.x,
      playerHero.mesh.position.z,
      3.6,
      0x22d3ee,
      2.5,
    );
    spawnFloatText(
      playerHero.mesh.position,
      `Teleporting to ${chosen.shortLabel}...`,
      "#22d3ee",
      15,
    );
    return;
  }

  playerHero.tpChannel = {
    timer: 2.5,
    duration: 2.5,
    dest: new THREE.Vector3(chosen.x, 0, chosen.z),
    label: chosen.shortLabel,
  };

  sfx.play("spell_shield_nova");
  spawnOrbitalSkyBeam(
    playerHero.mesh.position.x,
    playerHero.mesh.position.z,
    3.6,
    0x22d3ee,
    2.5,
  );
  spawnOrbitalSkyBeam(chosen.x, chosen.z, 4.2, 0xfacc15, 2.5);
  spawnFloatText(
    playerHero.mesh.position,
    `Teleporting to ${chosen.shortLabel}...`,
    "#22d3ee",
    15,
  );
};

window.activateTownPortalScroll = function () {
  if (
    !playerHero ||
    playerHero.dead ||
    playerHero.reincarnating ||
    gameOver ||
    inHeroSelect
  )
    return;

  // Double-pressing TP key/button immediately teleports to Base Fountain!
  if (tpTargetMode) {
    window.startTeleportToDestination("base");
    return;
  }

  if ((playerHero.tpCharges || 0) <= 0) {
    if (aiDifficulty === "infinity") {
      spawnFloatText(
        playerHero.mesh.position,
        "INFINITY MODE: NO CONSUMABLES ALLOWED!",
        "#fb7185",
        14,
      );
      return;
    }
    const tpLimit = getModeConsumableLimit();
    const tpUsed =
      (playerHero.consumableUsedCount &&
        playerHero.consumableUsedCount.tp_scroll) ||
      0;
    if (tpUsed >= tpLimit) {
      const prof =
        AI_DIFFICULTY_PROFILES[aiDifficulty] ||
        AI_DIFFICULTY_PROFILES.veteran;
      spawnFloatText(
        playerHero.mesh.position,
        `TP Limit Reached (${tpUsed}/${tpLimit} in ${prof.label})!`,
        "#fb7185",
        14,
      );
      return;
    }
    const tpDef = SHOP_ITEMS.find((it) => it.id === "tp_scroll");
    if (tpDef && playerHero.gold >= tpDef.cost) {
      purchaseItem(tpDef);
    } else {
      spawnFloatText(
        playerHero.mesh.position,
        "No TP Scroll! Need 100g",
        "#fb7185",
        14,
      );
      return;
    }
  }

  const cdLeft = playerHero.itemCooldowns.tp_scroll || 0;
  if (cdLeft > 0) {
    spawnFloatText(
      playerHero.mesh.position,
      `TP Scroll CD: ${cdLeft.toFixed(1)}s`,
      "#94a3b8",
      13,
    );
    return;
  }

  primedSkill = null;
  attackMovePrimed = false;
  tpTargetMode = true;
  clearTpBeacons();

  const dests = getValidTeleportDestinations(playerHero.team);
  const btnContainer = document.getElementById("tp-dest-buttons");
  if (btnContainer) {
    btnContainer.innerHTML = "";
    dests.forEach((d) => {
      const b = document.createElement("button");
      b.className = d.isBase
        ? "px-2.5 py-1 rounded bg-emerald-900/90 hover:bg-emerald-700 border border-emerald-400 text-[11px] font-cinzel font-bold text-emerald-100 flex items-center gap-1 transition"
        : "px-2.5 py-1 rounded bg-sky-950/90 hover:bg-sky-800 border border-cyan-400/70 text-[11px] font-cinzel font-bold text-cyan-100 flex items-center gap-1 transition";
      b.innerHTML = `<i class="fa-solid ${d.isBase ? "fa-house-chimney" : "fa-chess-rook"} text-amber-300"></i> ${d.shortLabel}`;
      b.onclick = () => window.startTeleportToDestination(d.id);
      btnContainer.appendChild(b);

      const bx = d.towerPos ? d.towerPos.x : d.x;
      const bz = d.towerPos ? d.towerPos.z : d.z;
      const gy = getTerrainHeightAt(bx, bz);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3.4, 4.3, 36),
        new THREE.MeshBasicMaterial({
          color: d.isBase ? 0x34d399 : 0x22d3ee,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(bx, gy + 0.25, bz);
      scene.add(ring);
      tpBeaconMeshes.push(ring);
    });
  }

  const bar = document.getElementById("tp-dest-bar");
  if (bar) bar.classList.remove("hidden");
  updatePrimedState();
};

function executeHeroInventoryItem(hero, slotIdx, aimPos) {
  if (!hero || hero.dead || hero.reincarnating || gameOver) return;
  const it = hero.inventory[slotIdx];
  if (!it || !it.active) return;

  const cdLeft = hero.itemCooldowns[it.active] || 0;
  if (cdLeft > 0) {
    if (hero.isPlayer)
      spawnFloatText(
        hero.mesh.position,
        `${it.name} CD: ${cdLeft.toFixed(1)}s`,
        "#94a3b8",
        13,
      );
    return;
  }

  const p = hero.mesh.position;
  const aim = aimPos || p;
  if (it.active === "blink") {
    hero.itemCooldowns.blink = 10.0;
    if (hero.isPlayer) sfx.play("spell_blink");
    spawnParticleBurst(p, 0x38bdf8, 16);
    const delta = new THREE.Vector3().subVectors(aim, p);
    delta.y = 0;
    const d = Math.min(delta.length(), 24);
    if (delta.lengthSq() > 0.001) delta.normalize();
    const nx = THREE.MathUtils.clamp(
      p.x + delta.x * d,
      -MAP_HALF + 4,
      MAP_HALF - 4,
    );
    const nz = THREE.MathUtils.clamp(
      p.z + delta.z * d,
      -MAP_HALF + 4,
      MAP_HALF - 4,
    );
    hero.mesh.position.set(nx, getTerrainHeightAt(nx, nz), nz);
    hero.targetPos = null;
    hero.attackMovePos = null;
    spawnShockwaveRing(nx, nz, 4.0, 0x38bdf8, 0.45);
  } else if (it.active === "blademail") {
    hero.itemCooldowns.blademail = 12.0;
    hero.bladeMailTimer = 4.5;
    if (hero.isPlayer) sfx.play("spell_shield_nova");
    spawnShockwaveRing(p.x, p.z, 3.8, 0xf97316, 0.45);
    spawnFloatText(p, "SPIKED CARAPACE!", "#fb923c", 14);
  } else if (it.active === "satanic") {
    hero.itemCooldowns.satanic = 14.0;
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.45);
    if (hero.isPlayer) sfx.play("spell_shadow_coil");
    spawnShockwaveRing(p.x, p.z, 4.2, 0xf43f5e, 0.5);
    spawnFloatText(p, "UNHOLY RAGE HEAL!", "#fb7185", 15);
  } else if (it.active === "shiva") {
    hero.itemCooldowns.shiva = 12.0;
    if (hero.isPlayer) sfx.play("spell_frost_volley");
    spawnShockwaveRing(p.x, p.z, 11.0, 0x38bdf8, 0.65);
    units.forEach((u) => {
      if (
        !u.dead &&
        u.team !== hero.team &&
        u.type !== "ancient" &&
        u.mesh.position.distanceTo(p) <= 11.0 + u.radius
      ) {
        u.takeDamage(210, hero);
        u.slowTimer = 4.0;
        u.slowFactor = 0.45;
      }
    });
  } else if (it.active === "hex") {
    const target = findNearestTarget(hero, 18.0, false, true);
    if (!target) {
      if (hero.isPlayer)
        spawnFloatText(p, "No target in range!", "#94a3b8", 13);
      return;
    }
    hero.itemCooldowns.hex = 13.0;
    if (hero.isPlayer) sfx.play("spell_shadow_coil");
    target.stunTimer = 2.4;
    spawnOrbitalSkyBeam(
      target.mesh.position.x,
      target.mesh.position.z,
      2.2,
      0xe879f9,
      0.6,
    );
    spawnFloatText(target.mesh.position, "HEXED (2.4s)!", "#e879f9", 15);
  } else if (it.active === "vitality_elixir") {
    const limit = getModeConsumableLimit();
    const usedSoFar =
      (hero.consumableUsedCount && hero.consumableUsedCount[it.id]) || 0;
    if (usedSoFar >= limit) {
      const prof =
        AI_DIFFICULTY_PROFILES[aiDifficulty] ||
        AI_DIFFICULTY_PROFILES.veteran;
      if (hero.isPlayer)
        spawnFloatText(
          p,
          `${prof.label.toUpperCase()} LIMIT (${usedSoFar}/${limit} USED)!`,
          "#fb7185",
          14,
        );
      return;
    }
    if (!hero.consumableUsedCount) hero.consumableUsedCount = {};
    hero.consumableUsedCount[it.id] = usedSoFar + 1;
    hero.inventory[slotIdx] = null;
    hero.hp = Math.min(hero.maxHp, hero.hp + 450);
    hero.mana = Math.min(hero.maxMana, hero.mana + 280);
    hero.str += 10;
    hero.agi += 10;
    hero.int += 10;
    hero.moveSpeed += 2.6;
    scheduledEvents.push({
      delay: 16.0,
      fn: () => {
        if (!hero) return;
        hero.str = Math.max(10, hero.str - 10);
        hero.agi = Math.max(10, hero.agi - 10);
        hero.int = Math.max(10, hero.int - 10);
        hero.moveSpeed = Math.max(8, hero.moveSpeed - 2.6);
      },
    });
    if (hero.isPlayer) sfx.play("buy");
    spawnShockwaveRing(p.x, p.z, 4.5, 0x34d399, 0.55);
    const remText =
      aiDifficulty === "immortal"
        ? " [1/1 IMMORTAL USE]"
        : ` [${usedSoFar + 1}/${limit} USED]`;
    spawnFloatText(
      p,
      `ELIXIR SURGE (+450 HP/MP & +10 STATS)!${remText}`,
      "#34d399",
      15,
    );
    if (hero.isPlayer) {
      refreshInventoryGrid();
      refreshActiveShopIfOpen();
    }
  } else if (it.active === "bkb") {
    hero.itemCooldowns.bkb = 16.0;
    hero.bkbTimer = 6.0;
    hero.stunTimer = 0;
    hero.slowTimer = 0;
    hero.slowFactor = 1.0;
    if (hero.isPlayer) sfx.play("aegis_reborn");
    spawnOrbitalSkyBeam(p.x, p.z, 3.8, 0xfacc15, 0.8);
    spawnFloatText(p, "AVATAR SPELL IMMUNITY (6s)!", "#facc15", 16);
  } else if (it.active === "manta") {
    hero.itemCooldowns.manta = 13.0;
    hero.stunTimer = 0;
    hero.slowTimer = 0;
    hero.blinkBuffTimer = Math.max(hero.blinkBuffTimer, 3.5);
    if (hero.isPlayer) sfx.play("spell_blink");
    spawnShockwaveRing(p.x, p.z, 4.5, 0x38bdf8, 0.45);
    spawnFloatText(p, "MIRROR CLEANSE & HASTE!", "#38bdf8", 15);
  } else if (it.active === "abyssal") {
    const target = findNearestTarget(hero, 8.5, false, true);
    if (!target) {
      if (hero.isPlayer)
        spawnFloatText(p, "No target in range!", "#94a3b8", 13);
      return;
    }
    hero.itemCooldowns.abyssal = 14.0;
    target.stunTimer = 2.0;
    target.takeDamage(220, hero, true);
    if (hero.isPlayer) sfx.play("crit");
    spawnOrbitalSkyBeam(
      target.mesh.position.x,
      target.mesh.position.z,
      2.4,
      0xf43f5e,
      0.55,
    );
    spawnFloatText(
      target.mesh.position,
      "OVERWHELM STUN (2.0s)!",
      "#fb7185",
      16,
    );
  } else if (it.active === "bloodstone") {
    hero.itemCooldowns.bloodstone = 15.0;
    hero.hp = Math.min(hero.maxHp, hero.hp + 500);
    hero.mana = Math.min(hero.maxMana, hero.mana + 500);
    if (hero.isPlayer) sfx.play("spell_shadow_coil");
    spawnShockwaveRing(p.x, p.z, 5.0, 0xf43f5e, 0.55);
    spawnFloatText(p, "BLOODPACT (+500 HP & MANA)!", "#fb7185", 16);
  } else if (it.active === "crimson_guard") {
    hero.itemCooldowns.crimson_guard = 15.0;
    if (hero.isPlayer) sfx.play("spell_shield_nova");
    spawnShockwaveRing(p.x, p.z, 14.0, 0xf43f5e, 0.65);
    units.forEach((ally) => {
      if (
        !ally.dead &&
        ally.team === hero.team &&
        ally.type === "hero" &&
        ally.mesh.position.distanceTo(p) <= 14.0
      ) {
        ally.shield = (ally.shield || 0) + 340;
        spawnFloatText(
          ally.mesh.position,
          "CRIMSON GUARD (+340 SHIELD)!",
          "#fb7185",
          14,
        );
      }
    });
  } else if (it.active === "dagon_5") {
    const target = findNearestTarget(hero, 20.0, false, true);
    if (!target) {
      if (hero.isPlayer)
        spawnFloatText(p, "No target in range!", "#94a3b8", 13);
      return;
    }
    hero.itemCooldowns.dagon_5 = 12.0;
    if (hero.isPlayer) sfx.play("crit");
    const burstDmg = 680 * (1 + (hero.spellAmpBonus || 0));
    target.takeDamage(burstDmg, hero, true);
    spawnLightningBolt3D(
      p,
      target.mesh.position,
      0xf43f5e,
      0xfacc15,
      0.45,
    );
    spawnShockwaveRing(
      target.mesh.position.x,
      target.mesh.position.z,
      3.6,
      0xf43f5e,
      0.45,
    );
    spawnFloatText(
      target.mesh.position,
      `DAGON V (-${Math.round(burstDmg)})!`,
      "#fb7185",
      16,
    );
  } else if (it.active === "chrono_aegis") {
    hero.itemCooldowns.chrono_aegis = 22.0;
    hero.bkbTimer = Math.max(hero.bkbTimer || 0, 2.5);
    hero.shield = (hero.shield || 0) + 650;
    hero.stunTimer = 0;
    hero.slowTimer = 0;
    hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.4);
    hero.mana = Math.min(hero.maxMana, hero.mana + hero.maxMana * 0.4);
    if (hero.isPlayer) sfx.play("aegis_reborn");
    spawnOrbitalSkyBeam(p.x, p.z, 4.6, 0x22d3ee, 0.9);
    spawnShockwaveRing(p.x, p.z, 6.5, 0xfacc15, 0.65);
    spawnFloatText(
      p,
      "CHRONO-AEGIS STASIS (+40% HP/MP & SHIELD)!",
      "#22d3ee",
      16,
    );
  } else if (it.active === "refresher") {
    hero.itemCooldowns.refresher = 28.0;
    ["Q", "W", "E", "R"].forEach((k) => {
      hero.cooldowns[k] = 0;
    });
    if (hero.isPlayer) sfx.play("aegis_reborn");
    spawnOrbitalSkyBeam(p.x, p.z, 4.4, 0x34d399, 0.85);
    spawnFloatText(p, "ALL ABILITIES REFRESHED!", "#34d399", 17);
  } else if (it.active === "cheese") {
    if (!hero.consumableUsedCount) hero.consumableUsedCount = {};
    hero.consumableUsedCount.divine_cheese =
      (hero.consumableUsedCount.divine_cheese || 0) + 1;
    hero.inventory[slotIdx] = null;
    hero.hp = hero.maxHp;
    hero.mana = hero.maxMana;
    ["Q", "W", "E", "R"].forEach((k) => {
      hero.cooldowns[k] = 0;
    });
    if (hero.isPlayer) sfx.play("aegis_reborn");
    spawnOrbitalSkyBeam(p.x, p.z, 4.5, 0xfacc15, 0.9);
    spawnFloatText(p, "DIVINE REFRESH!", "#facc15", 18);
    if (hero.isPlayer) refreshInventoryGrid();
  }
}

function useInventorySlot(slotIdx) {
  if (
    !playerHero ||
    playerHero.dead ||
    playerHero.reincarnating ||
    gameOver
  )
    return;
  const it = playerHero.inventory[slotIdx];
  if (!it || !it.active) return;

  if (mpState.active && mpState.role === "guest") {
    const cdLeft = playerHero.itemCooldowns[it.active] || 0;
    if (cdLeft > 0) {
      spawnFloatText(
        playerHero.mesh.position,
        `${it.name} CD: ${cdLeft.toFixed(1)}s`,
        "#94a3b8",
        13,
      );
      return;
    }
    mpSendToHost({
      type: "CMD",
      cmd: "USE_ITEM",
      slotIdx,
      x: worldCursor.x,
      z: worldCursor.z,
    });
    const cdMap = {
      blink: 10.0,
      blademail: 12.0,
      satanic: 14.0,
      shiva: 12.0,
      hex: 13.0,
      bkb: 16.0,
      manta: 13.0,
      abyssal: 14.0,
      bloodstone: 15.0,
      refresher: 28.0,
      crimson_guard: 15.0,
      dagon_5: 12.0,
      chrono_aegis: 22.0,
    };
    if (cdMap[it.active])
      playerHero.itemCooldowns[it.active] = cdMap[it.active];
    if (it.active === "vitality_elixir" || it.active === "cheese") {
      playerHero.inventory[slotIdx] = null;
      refreshInventoryGrid();
    }
    spawnFloatText(
      playerHero.mesh.position,
      `Activated ${it.name}!`,
      "#38bdf8",
      14,
    );
    return;
  }

  executeHeroInventoryItem(playerHero, slotIdx, worldCursor);
}

let currentShopTab = "all";
function refreshActiveShopIfOpen() {
  const modal = document.getElementById("shop-modal");
  if (modal && !modal.classList.contains("hidden")) {
    renderShopTab(currentShopTab);
  }
}

function getConsumableUsageState(hero, item) {
  if (aiDifficulty === "infinity") {
    return {
      used: 0,
      held: 0,
      totalCommitted: 0,
      limit: 0,
      exhausted: true,
    };
  }
  const limit = getModeConsumableLimit();
  if (!hero)
    return {
      used: 0,
      held: 0,
      totalCommitted: 0,
      limit,
      exhausted: false,
    };
  const used =
    (hero.consumableUsedCount && hero.consumableUsedCount[item.id]) || 0;
  let held = 0;
  if (item.isTpScroll || item.id === "tp_scroll") {
    held = hero.tpCharges || 0;
  } else if (!item.consumeOnBuy) {
    held = hero.inventory.filter((x) => x && x.id === item.id).length;
  }
  const totalCommitted = used + held;
  return {
    used,
    held,
    totalCommitted,
    limit,
    exhausted: totalCommitted >= limit,
  };
}

function renderShopTab(cat) {
  currentShopTab = cat || "all";
  document.querySelectorAll(".shop-tab-btn").forEach((btn) => {
    const active = btn.dataset.shopTab === cat;
    btn.classList.toggle("bg-slate-800", active);
    btn.classList.toggle("border-t", active);
    btn.classList.toggle("border-x", active);
    btn.classList.toggle("border-amber-500/40", active);
  });

  const grid = document.getElementById("shop-grid");
  grid.innerHTML = "";

  const prof =
    AI_DIFFICULTY_PROFILES[aiDifficulty] ||
    AI_DIFFICULTY_PROFILES.veteran;
  const cLimit = getModeConsumableLimit();
  const nearSecret = isHeroNearSecretShop(playerHero);

  const secretBanner = document.createElement("div");
  secretBanner.className = `sm:col-span-2 ${nearSecret ? "bg-purple-950/85 border-purple-400/60" : "bg-slate-950/90 border-purple-500/40"} border rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs`;
  secretBanner.innerHTML = nearSecret
    ? `<span class="font-cinzel font-bold text-purple-200"><i class="fa-solid fa-crown text-amber-300 mr-1.5"></i>SECRET SHOP IN RANGE</span>
             <span class="font-mono font-bold text-emerald-300">All Secret &amp; Mythic Relics Unlocked!</span>`
    : `<span class="font-cinzel font-bold text-purple-200"><i class="fa-solid fa-location-dot text-purple-400 mr-1.5"></i>SECRET ITEMS REQUIRE SECRET SHOP PROXIMITY</span>
             <button type="button" id="btn-banner-walk-secret" class="px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-cinzel font-bold text-[10px] shadow transition">
                 <i class="fa-solid fa-person-walking mr-1"></i>Walk to Secret Shop
             </button>`;
  grid.appendChild(secretBanner);
  const bannerWalkBtn = secretBanner.querySelector(
    "#btn-banner-walk-secret",
  );
  if (bannerWalkBtn) {
    bannerWalkBtn.onclick = () => window.walkToNearestSecretShop();
  }

  if (cat === "consumable" || cat === "all") {
    const infoBar = document.createElement("div");
    infoBar.className =
      "sm:col-span-2 bg-slate-950/90 border border-amber-500/35 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs";
    infoBar.innerHTML = `
              <span class="font-cinzel font-bold text-amber-300"><i class="fa-solid fa-flask mr-1.5"></i>${prof.label.toUpperCase()} MODE CONSUMABLE LIMIT</span>
              <span class="font-mono font-bold ${aiDifficulty === "immortal" || aiDifficulty === "infinity" ? "text-rose-300" : "text-emerald-300"}">
                  ${aiDifficulty === "infinity" ? "NO CONSUMABLES AVAILABLE (0 / 0 DISABLED)" : aiDifficulty === "immortal" ? "SINGLE USE ONLY (1 / 1 Max per Consumable)" : `Max ${cLimit} Uses per Consumable this Match`}
              </span>
          `;
    grid.appendChild(infoBar);
  }

  const list =
    cat === "all"
      ? SHOP_ITEMS
      : cat === "secret"
        ? SHOP_ITEMS.filter((i) => i.shop === "secret")
        : cat === "consumable"
          ? SHOP_ITEMS.filter(
              (i) => i.cat === "consumable" || i.isTpScroll,
            )
          : SHOP_ITEMS.filter((i) => i.cat === cat || i.cat === "all");
  list.forEach((item) => {
    const isCons = isConsumableItem(item);
    const cState = isCons
      ? getConsumableUsageState(playerHero, item)
      : null;
    const isExhausted = Boolean(cState && cState.exhausted);
    const alreadyOwned = isItemAlreadyOwned(playerHero, item);
    const secretLocked = item.shop === "secret" && !nearSecret;
    const isLocked = isExhausted || alreadyOwned || secretLocked;

    const card = document.createElement("div");
    card.className = `bg-gradient-to-br ${item.bg} border ${isLocked ? "border-slate-700/70 opacity-75" : "border-amber-500/25 hover:border-amber-400"} rounded-xl p-3 flex items-center justify-between gap-3 transition`;

    let badgeTag = item.consumeOnBuy
      ? '<span class="text-[10px] font-sans font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">Instant Tome</span>'
      : item.shop === "secret"
        ? `<span class="text-[10px] font-sans font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${nearSecret ? "bg-purple-500/25 text-purple-200 border-purple-400/50" : "bg-purple-950/90 text-purple-300 border-purple-500/45"}">Secret Shop</span>`
        : "";

    if (typeof item.cd === "number" && item.cd > 0) {
      badgeTag += `<span class="text-[11px] font-sans font-extrabold tabular-nums tracking-wide px-2 py-0.5 rounded bg-cyan-500/25 text-cyan-100 border border-cyan-400/60 shadow-xs"><i class="fa-solid fa-clock mr-1 text-cyan-300"></i>${item.cd}s CD</span>`;
    }

    if (alreadyOwned) {
      badgeTag +=
        '<span class="text-[10px] font-sans font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-200 border border-emerald-400/50">Unique • Owned</span>';
    }

    if (isCons && cState) {
      const quotaCls = isExhausted
        ? "bg-rose-500/20 text-rose-300 border-rose-400/45"
        : "bg-amber-500/20 text-amber-200 border-amber-400/40";
      const quotaLabel =
        aiDifficulty === "infinity"
          ? "Disabled in Infinity"
          : aiDifficulty === "immortal"
            ? isExhausted
              ? "1/1 Single-Use Max"
              : "1/1 Immortal Use"
            : `${cState.totalCommitted}/${cState.limit} ${prof.label}`;
      badgeTag += `<span class="text-[10px] font-sans font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${quotaCls}">${quotaLabel}</span>`;
    }

    const btnHtml = alreadyOwned
      ? `<button disabled class="buy-action bg-emerald-950/85 text-emerald-300 border border-emerald-500/45 font-sans font-black text-xs px-3 py-2 rounded-lg shrink-0 flex items-center gap-1 cursor-not-allowed">
                  <i class="fa-solid fa-check"></i> OWNED
                 </button>`
      : isExhausted
        ? `<button disabled class="buy-action bg-slate-800 text-slate-400 border border-slate-700 font-sans font-black text-xs px-3 py-2 rounded-lg shrink-0 flex items-center gap-1 cursor-not-allowed">
                      <i class="fa-solid fa-ban"></i> ${aiDifficulty === "infinity" ? "DISABLED" : aiDifficulty === "immortal" ? "USED (1/1)" : `MAX (${cState.limit}/${cState.limit})`}
                     </button>`
        : secretLocked
          ? `<button type="button" class="buy-action bg-purple-950/90 hover:bg-purple-900 text-purple-200 border border-purple-400/50 font-sans font-extrabold tabular-nums text-xs px-2.5 py-2 rounded-lg shrink-0 flex items-center gap-1" title="Move near the East or West Secret Shop to purchase">
                          <i class="fa-solid fa-lock"></i> ${item.cost}
                         </button>`
          : `<button class="buy-action bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-black tabular-nums text-xs px-3 py-2 rounded-lg shrink-0 flex items-center gap-1 shadow">
                          <i class="fa-solid fa-coins"></i> ${item.cost}
                         </button>`;

    card.innerHTML = `
              <div class="flex items-center gap-3 min-w-0">
                  <div class="w-11 h-11 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0">
                      <i class="fa-solid ${item.icon} ${item.color} text-xl"></i>
                  </div>
                  <div class="min-w-0">
                      <div class="font-bold text-sm text-white flex items-center flex-wrap gap-1.5"><span>${item.name}</span>${badgeTag}</div>
                      <div class="text-xs text-slate-300 mt-0.5">${item.desc}</div>
                  </div>
              </div>
              ${btnHtml}
          `;
    card.querySelector(".buy-action").onclick = () => purchaseItem(item);
    grid.appendChild(card);
  });
}

function isItemAlreadyOwned(hero, item) {
  if (
    !hero ||
    !item ||
    isConsumableItem(item) ||
    item.isTpScroll ||
    item.consumeOnBuy
  )
    return false;
  return (
    Array.isArray(hero.inventory) &&
    hero.inventory.some((slot) => slot && slot.id === item.id)
  );
}

function syncHeroUniqueItemFlags(hero) {
  if (!hero) return;
  const inv = hero.inventory || [];
  hero.hasRadiance = inv.some((x) => x && x.stats && x.stats.hasRadiance);
  hero.hasSkadi = inv.some((x) => x && x.stats && x.stats.hasSkadi);
  hero.hasTravelBoots = inv.some(
    (x) => x && x.stats && x.stats.hasTravelBoots,
  );
  hero.hasMjollnir = inv.some((x) => x && x.stats && x.stats.hasMjollnir);
  hero.hasDesolator = inv.some(
    (x) => x && x.stats && x.stats.hasDesolator,
  );
  hero.hasHeartRegen = inv.some(
    (x) => x && x.stats && x.stats.hasHeartRegen,
  );
  hero.hasAbyssalBash = inv.some(
    (x) => x && x.stats && x.stats.hasAbyssalBash,
  );
  hero.hasStarforge = inv.some(
    (x) => x && x.stats && x.stats.hasStarforge,
  );
}

function applyItemStatsToHero(hero, item) {
  const st = item.stats || {};
  if (st.str) hero.str += st.str;
  if (st.agi) hero.agi += st.agi;
  if (st.int) hero.int += st.int;
  if (st.moveSpeed) hero.moveSpeed += st.moveSpeed;
  if (st.atkSpeedMult) hero.atkSpeedMult += st.atkSpeedMult;
  if (st.atkDamage) hero.atkDamage += st.atkDamage;
  if (st.maxHp) {
    hero.maxHp += st.maxHp;
    hero.hp += st.maxHp;
  }
  if (st.hpRegen) hero.hpRegen += st.hpRegen;
  if (st.armor) hero.armor += st.armor;
  if (st.maxMana) {
    hero.maxMana += st.maxMana;
    hero.mana += st.maxMana;
  }
  if (st.manaRegen) hero.manaRegen += st.manaRegen;
  if (st.lifesteal)
    hero.lifesteal = Math.min(0.65, hero.lifesteal + st.lifesteal);
  if (st.hasRadiance) hero.hasRadiance = true;
  if (st.hasSkadi) hero.hasSkadi = true;
  if (st.hasTravelBoots) hero.hasTravelBoots = true;
  if (st.hasMjollnir) hero.hasMjollnir = true;
  if (st.hasDesolator) hero.hasDesolator = true;
  if (st.hasHeartRegen) hero.hasHeartRegen = true;
  if (st.hasAbyssalBash) hero.hasAbyssalBash = true;
  if (st.hasStarforge) hero.hasStarforge = true;
  if (st.cdrMult) hero.cdrMult *= st.cdrMult;
  if (st.spellAmpBonus) hero.spellAmpBonus += st.spellAmpBonus;
  if (st.critChance) {
    hero.critChance = Math.min(0.85, hero.critChance + st.critChance);
    hero.critMult = Math.max(hero.critMult, st.critMult || 2.0);
  }
  if (item.xpGrant) hero.gainXp(item.xpGrant);
}

function purchaseItem(item) {
  if (!playerHero || gameOver) return;
  if (item.shop === "secret" && !isHeroNearSecretShop(playerHero)) {
    sfx.play("move");
    spawnFloatText(
      playerHero.mesh.position,
      "MUST BE NEAR SECRET SHOP TO BUY!",
      "#c084fc",
      15,
    );
    return;
  }
  if (isItemAlreadyOwned(playerHero, item)) {
    spawnFloatText(
      playerHero.mesh.position,
      "UNIQUE RELIC: ALREADY OWNED!",
      "#fb7185",
      14,
    );
    return;
  }
  if (mpState.active && mpState.role === "guest") {
    if (playerHero.gold < item.cost) {
      spawnFloatText(
        playerHero.mesh.position,
        "NOT ENOUGH GOLD!",
        "#fb7185",
        14,
      );
      return;
    }
    mpSendToHost({ type: "CMD", cmd: "BUY_ITEM", itemId: item.id });
    sfx.play("buy");
    spawnFloatText(
      playerHero.mesh.position,
      `Requested ${item.name}!`,
      "#facc15",
      14,
    );
    return;
  }

  if (isConsumableItem(item)) {
    const cState = getConsumableUsageState(playerHero, item);
    if (cState.exhausted) {
      const prof =
        AI_DIFFICULTY_PROFILES[aiDifficulty] ||
        AI_DIFFICULTY_PROFILES.veteran;
      const msg =
        aiDifficulty === "infinity"
          ? "INFINITY MODE: NO CONSUMABLES AVAILABLE!"
          : aiDifficulty === "immortal"
            ? `IMMORTAL MODE: ${item.name.toUpperCase()} SINGLE USE ONLY (1/1)!`
            : `${prof.label.toUpperCase()} LIMIT REACHED (${cState.totalCommitted}/${cState.limit})!`;
      spawnFloatText(playerHero.mesh.position, msg, "#fb7185", 14);
      return;
    }
  }

  if (playerHero.gold < item.cost) {
    spawnFloatText(
      playerHero.mesh.position,
      "NOT ENOUGH GOLD!",
      "#fb7185",
      14,
    );
    return;
  }

  // Town Portal Scrolls go directly into the dedicated TP Slot (never taking up Inventory slots!)
  if (item.isTpScroll || item.id === "tp_scroll") {
    playerHero.gold -= item.cost;
    playerHero.tpCharges = (playerHero.tpCharges || 0) + 1;
    sfx.play("buy");
    const cState = getConsumableUsageState(playerHero, item);
    spawnFloatText(
      playerHero.mesh.position,
      `+1 Town Portal Scroll (${cState.totalCommitted}/${cState.limit} Mode Limit)!`,
      "#38bdf8",
      15,
    );
    refreshActiveShopIfOpen();
    return;
  }

  // Permanent Stat Tomes & Shards consume immediately without occupying an inventory slot
  if (item.consumeOnBuy) {
    playerHero.gold -= item.cost;
    if (!playerHero.consumableUsedCount)
      playerHero.consumableUsedCount = {};
    playerHero.consumableUsedCount[item.id] =
      (playerHero.consumableUsedCount[item.id] || 0) + 1;
    applyItemStatsToHero(playerHero, item);
    sfx.play("levelup");
    if (playerHero.heroCfg && playerHero.heroCfg.voice.buy) {
      sfx.speakHeroLine(
        playerHero.heroCfg,
        playerHero.heroCfg.voice.buy,
        false,
        "triumph",
        {
          category: "buy",
          chance: 0.65,
          minGapMs: 11000,
          catGapMs: 14000,
        },
      );
    }
    const limit = getModeConsumableLimit();
    const usedNow = playerHero.consumableUsedCount[item.id];
    spawnOrbitalSkyBeam(
      playerHero.mesh.position.x,
      playerHero.mesh.position.z,
      3.2,
      0xfacc15,
      0.75,
    );
    spawnShockwaveRing(
      playerHero.mesh.position.x,
      playerHero.mesh.position.z,
      4.2,
      0x34d399,
      0.55,
    );
    spawnFloatText(
      playerHero.mesh.position,
      `ABSORBED ${item.name.toUpperCase()} (${usedNow}/${limit})!`,
      "#34d399",
      16,
    );
    refreshActiveShopIfOpen();
    return;
  }

  const emptyIdx = playerHero.inventory.findIndex((s) => s === null);
  if (emptyIdx === -1) {
    spawnFloatText(
      playerHero.mesh.position,
      "INVENTORY FULL (6/6)!",
      "#fb7185",
      14,
    );
    return;
  }

  playerHero.gold -= item.cost;
  playerHero.inventory[emptyIdx] = item;
  applyItemStatsToHero(playerHero, item);

  sfx.play("buy");
  if (playerHero.heroCfg && playerHero.heroCfg.voice.buy) {
    sfx.speakHeroLine(
      playerHero.heroCfg,
      playerHero.heroCfg.voice.buy,
      false,
      "triumph",
      { category: "buy", chance: 0.65, minGapMs: 11000, catGapMs: 14000 },
    );
  }
  refreshInventoryGrid();
  if (window.innerWidth < 1024) window.toggleMobileBagDrawer(true);
  refreshActiveShopIfOpen();
  spawnFloatText(
    playerHero.mesh.position,
    `Equipped ${item.name}!`,
    "#facc15",
    15,
  );
  spawnShockwaveRing(
    playerHero.mesh.position.x,
    playerHero.mesh.position.z,
    3.6,
    0xfacc15,
    0.5,
  );
}

function raycastGround(cx, cy) {
  mouseNDC.x = (cx / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(cy / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseNDC, camera);
  raycaster.ray.intersectPlane(groundPlane, worldCursor);
}

function orderHeroAttackTarget(target) {
  if (
    !playerHero ||
    !target ||
    target.dead ||
    target.team === playerHero.team
  )
    return;
  if (mpState.active && mpState.role === "guest") {
    playerHero.targetUnit = target;
    playerHero.targetPos = null;
    playerHero.attackMovePos = null;
    attackMovePrimed = false;
    updatePrimedState();
    mpSendToHost({
      type: "CMD",
      cmd: "ATTACK_UNIT",
      targetNetId: target.netId || target.id,
    });
    triggerMoveWaypoint(
      target.mesh.position.x,
      target.mesh.position.z,
      0xf43f5e,
    );
    sfx.play("move");
    return;
  }
  if (playerHero.tpChannel)
    window.cancelTeleportChannel("Teleport Canceled");
  playerHero.targetUnit = target;
  playerHero.targetPos = null;
  playerHero.attackMovePos = null;
  attackMovePrimed = false;
  updatePrimedState();
  triggerMoveWaypoint(
    target.mesh.position.x,
    target.mesh.position.z,
    0xf43f5e,
  );
  sfx.play("move");
  if (
    playerHero.heroCfg &&
    playerHero._lastSpokenAtkTargetId !== target.id
  ) {
    playerHero._lastSpokenAtkTargetId = target.id;
    sfx.speakHeroLine(
      playerHero.heroCfg,
      playerHero.heroCfg.voice.attack,
      false,
      "normal",
      {
        category: "attack",
        chance: 0.28,
        minGapMs: 16000,
        catGapMs: 20000,
      },
    );
  }
}

window.attackInspectedUnit = function () {
  if (
    inspectedUnit &&
    !inspectedUnit.dead &&
    playerHero &&
    inspectedUnit.team !== playerHero.team
  ) {
    orderHeroAttackTarget(inspectedUnit);
  }
};

window.toggleAttackMoveMode = function () {
  if (
    !playerHero ||
    playerHero.dead ||
    playerHero.reincarnating ||
    gameOver ||
    inHeroSelect
  )
    return;
  // If an enemy target is currently selected/inspected (via left-click) or hovered, immediately attack that target!
  if (
    inspectedUnit &&
    !inspectedUnit.dead &&
    inspectedUnit.team !== playerHero.team
  ) {
    orderHeroAttackTarget(inspectedUnit);
    return;
  }
  if (
    hoveredUnit &&
    !hoveredUnit.dead &&
    hoveredUnit.team !== playerHero.team
  ) {
    orderHeroAttackTarget(hoveredUnit);
    return;
  }
  if (attackMovePrimed) {
    attackMovePrimed = false;
    updatePrimedState();
    window.attackNearest();
    return;
  }
  window.cancelTpTargetMode();
  primedSkill = null;
  attackMovePrimed = true;
  updatePrimedState();
};

window.stopHeroCommand = function () {
  if (!playerHero) return;
  if (mpState.active && mpState.role === "guest") {
    playerHero.targetPos = null;
    playerHero.targetUnit = null;
    playerHero.attackMovePos = null;
    attackMovePrimed = false;
    primedSkill = null;
    window.cancelTpTargetMode();
    updatePrimedState();
    mpSendToHost({ type: "CMD", cmd: "STOP" });
    return;
  }
  if (playerHero.tpChannel)
    window.cancelTeleportChannel("Teleport Stopped");
  playerHero.targetPos = null;
  playerHero.targetUnit = null;
  playerHero.attackMovePos = null;
  attackMovePrimed = false;
  primedSkill = null;
  window.cancelTpTargetMode();
  updatePrimedState();
};

function issueCanvasOrder(cx, cy, isRight, isTouchTap = false) {
  if (!playerHero || gameOver || inHeroSelect) return;
  raycastGround(cx, cy);

  const detectClickedShop = () => {
    const shopMeshes = shopEntities.map((s) => s.mesh).filter(Boolean);
    if (shopMeshes.length > 0) {
      const sHits = raycaster.intersectObjects(shopMeshes, true);
      if (sHits.length > 0 && sHits[0].object.userData.shopEntity) {
        return sHits[0].object.userData.shopEntity;
      }
    }
    for (const s of shopEntities) {
      if (Math.hypot(worldCursor.x - s.x, worldCursor.z - s.z) < 7.2)
        return s;
    }
    return null;
  };

  if (isRight || isTouchTap) {
    const clickedShop = detectClickedShop();
    if (clickedShop) {
      window.openShopForEntity(clickedShop);
      return;
    }
  }

  // Allow inspecting units (and clearing inspection) on left click even while player hero is dead or reincarnating
  if (playerHero.dead || playerHero.reincarnating) {
    if (!isRight) {
      const allUnitMeshes = units.filter((u) => !u.dead).map((u) => u.mesh);
      const allHits = raycaster.intersectObjects(allUnitMeshes, true);
      if (allHits.length > 0 && allHits[0].object.userData.unit) {
        const clickedUnit = allHits[0].object.userData.unit;
        if (!clickedUnit.isPlayer && clickedUnit !== playerHero) {
          window.inspectUnit(clickedUnit);
        } else if (inspectedUnit) {
          window.clearInspectedUnit();
        }
      } else if (inspectedUnit) {
        window.clearInspectedUnit();
      }
    }
    return;
  }

  if (tpTargetMode) {
    if (isRight) {
      window.cancelTpTargetMode();
      return;
    }
    const dests = getValidTeleportDestinations(playerHero.team);
    let closestDest = null;
    let bestD = 12.0;
    dests.forEach((d) => {
      const bx = d.towerPos ? d.towerPos.x : d.x;
      const bz = d.towerPos ? d.towerPos.z : d.z;
      const dist = Math.hypot(worldCursor.x - bx, worldCursor.z - bz);
      if (dist < bestD) {
        bestD = dist;
        closestDest = d;
      }
    });
    if (closestDest) {
      window.startTeleportToDestination(closestDest.id);
    } else {
      spawnFloatText(
        worldCursor,
        "Select Allied Tower or Base!",
        "#22d3ee",
        13,
      );
    }
    return;
  }

  if (attackMovePrimed || (isAKeyHeld && !isRight)) {
    if (isRight) {
      attackMovePrimed = false;
      updatePrimedState();
      return;
    }
    const enemyRoots = units
      .filter((u) => !u.dead && u.team !== playerHero.team)
      .map((u) => u.mesh);
    const hits = raycaster.intersectObjects(enemyRoots, true);
    if (hits.length > 0 && hits[0].object.userData.unit) {
      orderHeroAttackTarget(hits[0].object.userData.unit);
      return;
    }
    const nearbyEnemy = findEnemyNearWorldPoint(worldCursor, 3.6);
    if (nearbyEnemy) {
      orderHeroAttackTarget(nearbyEnemy);
      return;
    }
    if (inspectedUnit) window.clearInspectedUnit();
    if (playerHero.tpChannel)
      window.cancelTeleportChannel("Teleport Canceled");
    const gx = THREE.MathUtils.clamp(
      worldCursor.x,
      -MAP_HALF + 3,
      MAP_HALF - 3,
    );
    const gz = THREE.MathUtils.clamp(
      worldCursor.z,
      -MAP_HALF + 3,
      MAP_HALF - 3,
    );
    if (mpState.active && mpState.role === "guest") {
      mpSendToHost({ type: "CMD", cmd: "ATTACK_MOVE", x: gx, z: gz });
    }
    playerHero.targetUnit = null;
    playerHero.targetPos = null;
    playerHero.attackMovePos = new THREE.Vector3(gx, 0, gz);
    attackMovePrimed = false;
    updatePrimedState();
    triggerMoveWaypoint(gx, gz, 0xf43f5e);
    sfx.play("move");
    if (playerHero.heroCfg) {
      sfx.speakHeroLine(
        playerHero.heroCfg,
        playerHero.heroCfg.voice.attack,
        false,
        "normal",
        {
          category: "attack",
          chance: 0.25,
          minGapMs: 17000,
          catGapMs: 22000,
        },
      );
    }
    return;
  }

  if (primedSkill && !isRight) {
    if (mpState.active && mpState.role === "guest") {
      mpSendToHost({
        type: "CMD",
        cmd: "CAST",
        key: primedSkill,
        x: worldCursor.x,
        z: worldCursor.z,
      });
      playerHero.castAnim = 0.3;
      playerHero.mesh.rotation.y = Math.atan2(
        worldCursor.x - playerHero.mesh.position.x,
        worldCursor.z - playerHero.mesh.position.z,
      );
      primedSkill = null;
      updatePrimedState();
      return;
    }
    if (playerHero.tpChannel)
      window.cancelTeleportChannel("Teleport Canceled");
    castHeroAbility(playerHero, primedSkill, worldCursor);
    return;
  }
  if (primedSkill && isRight) {
    primedSkill = null;
    updatePrimedState();
    return;
  }

  if (!isRight) {
    if (!isTouchTap) {
      // Desktop Left-Click: Dota 2 style hero & unit selection / inspection.
      // Left click NEVER issues an attack or move command.
      const allUnitMeshes = units.filter((u) => !u.dead).map((u) => u.mesh);
      const allHits = raycaster.intersectObjects(allUnitMeshes, true);
      if (allHits.length > 0 && allHits[0].object.userData.unit) {
        const clickedUnit = allHits[0].object.userData.unit;
        if (!clickedUnit.isPlayer && clickedUnit !== playerHero) {
          window.inspectUnit(clickedUnit);
        } else if (inspectedUnit) {
          window.clearInspectedUnit();
        }
      } else if (inspectedUnit) {
        window.clearInspectedUnit();
      }
      return;
    } else {
      // Mobile Touch Tap: If tapping an ally unit, inspect it.
      const allyMeshes = units
        .filter(
          (u) =>
            !u.dead &&
            u.team === playerHero.team &&
            !u.isPlayer &&
            u !== playerHero,
        )
        .map((u) => u.mesh);
      const allyHits = raycaster.intersectObjects(allyMeshes, true);
      if (allyHits.length > 0 && allyHits[0].object.userData.unit) {
        window.inspectUnit(allyHits[0].object.userData.unit);
        return;
      }
    }
  }

  // Shop clicks are handled at top of issueCanvasOrder so clicking any shop opens the shop dialog immediately

  const enemyRoots = units
    .filter((u) => !u.dead && u.team !== playerHero.team)
    .map((u) => u.mesh);
  const hits = raycaster.intersectObjects(enemyRoots, true);
  if (hits.length > 0 && hits[0].object.userData.unit) {
    orderHeroAttackTarget(hits[0].object.userData.unit);
    return;
  }

  // Right-click move on ground preserves active unit inspection console
  if (playerHero.tpChannel)
    window.cancelTeleportChannel("Teleport Canceled");
  const gx = THREE.MathUtils.clamp(
    worldCursor.x,
    -MAP_HALF + 3,
    MAP_HALF - 3,
  );
  const gz = THREE.MathUtils.clamp(
    worldCursor.z,
    -MAP_HALF + 3,
    MAP_HALF - 3,
  );
  if (mpState.active && mpState.role === "guest") {
    playerHero.targetUnit = null;
    playerHero.attackMovePos = null;
    playerHero.targetPos = new THREE.Vector3(gx, 0, gz);
    mpSendToHost({ type: "CMD", cmd: "MOVE", x: gx, z: gz });
    triggerMoveWaypoint(gx, gz, 0x22c55e);
    sfx.play("move");
    return;
  }
  playerHero.targetUnit = null;
  playerHero.attackMovePos = null;
  playerHero.targetPos = new THREE.Vector3(gx, 0, gz);
  triggerMoveWaypoint(gx, gz, 0x22c55e);
  sfx.play("move");
  if (
    playerHero.heroCfg &&
    Math.hypot(
      gx - playerHero.mesh.position.x,
      gz - playerHero.mesh.position.z,
    ) > 7.5
  ) {
    sfx.speakHeroLine(
      playerHero.heroCfg,
      playerHero.heroCfg.voice.moves,
      false,
      "normal",
      {
        category: "move",
        chance: 0.22,
        minGapMs: 18000,
        catGapMs: 22000,
      },
    );
  }
}

window._shopOpenedAtTs = 0;
window.openShopForEntity = function (shopObj, shouldWalk = true) {
  if (!shopObj) return;
  window._shopOpenedAtTs = performance.now();
  renderShopTab(shopObj.type === "secret" ? "secret" : "all");
  const shopModal = document.getElementById("shop-modal");
  if (shopModal) shopModal.classList.remove("hidden");
  if (
    shouldWalk &&
    playerHero &&
    !playerHero.dead &&
    !playerHero.reincarnating
  ) {
    const distHero = Math.hypot(
      playerHero.mesh.position.x - shopObj.x,
      playerHero.mesh.position.z - shopObj.z,
    );
    if (distHero > 14.5) {
      if (playerHero.tpChannel)
        window.cancelTeleportChannel("Teleport Canceled");
      playerHero.targetUnit = null;
      playerHero.attackMovePos = null;
      const destZ = shopObj.z + (shopObj.z > 0 ? -4.5 : 4.5);
      playerHero.targetPos = new THREE.Vector3(shopObj.x, 0, destZ);
      if (mpState.active && mpState.role === "guest")
        mpSendToHost({
          type: "CMD",
          cmd: "MOVE",
          x: shopObj.x,
          z: destZ,
        });
      triggerMoveWaypoint(
        shopObj.x,
        destZ,
        shopObj.type === "secret" ? 0xa855f7 : 0xfacc15,
      );
    }
  }
  sfx.play("move");
};

window.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("pointerdown", (e) => {
  const shopModal = document.getElementById("shop-modal");
  if (shopModal && !shopModal.classList.contains("hidden")) {
    // Prevent closing on the very same pointerdown event that just opened the shop from the 3D map or minimap
    if (performance.now() - (window._shopOpenedAtTs || 0) > 180) {
      if (
        !e.target.closest("#shop-dialog-card") &&
        !e.target.closest("#btn-open-shop")
      ) {
        shopModal.classList.add("hidden");
      }
    }
  }
  const talentModal = document.getElementById("talent-modal");
  if (talentModal && !talentModal.classList.contains("hidden")) {
    if (performance.now() - (window._talentOpenedAtTs || 0) > 180) {
      if (
        !e.target.closest("#talent-dialog-card") &&
        !e.target.closest("#btn-open-talents") &&
        !e.target.closest("#lvlup-TALENT")
      ) {
        talentModal.classList.add("hidden");
      }
    }
  }
  if (
    inspectedUnit &&
    e.target !== canvas &&
    !e.target.closest("#unit-inspector-panel")
  ) {
    window.clearInspectedUnit();
  }
});
const isTouchCapableDevice = () =>
  window.innerWidth < 1024 ||
  window.matchMedia("(pointer: coarse)").matches;

let mobileTouchPadEnabled = isTouchCapableDevice();
const mobileJoyState = {
  pointerId: null,
  originX: 0,
  originY: 0,
  nx: 0,
  ny: 0,
  active: false,
};

window.toggleMobileTouchPad = function (forceVal) {
  mobileTouchPadEnabled =
    typeof forceVal === "boolean" ? forceVal : !mobileTouchPadEnabled;
  document.body.classList.toggle(
    "touchpad-forced-off",
    !mobileTouchPadEnabled,
  );
  const zone = document.getElementById("mobile-touch-controls");
  if (zone) {
    zone.classList.toggle("hidden", !mobileTouchPadEnabled);
    zone.classList.toggle("flex", mobileTouchPadEnabled);
  }
  const btn = document.getElementById("btn-toggle-touchpad");
  if (btn) {
    btn.classList.toggle("bg-cyan-950/70", mobileTouchPadEnabled);
    btn.classList.toggle("border-cyan-400", mobileTouchPadEnabled);
  }
  const lbl = document.getElementById("touchpad-label");
  if (lbl)
    lbl.textContent = mobileTouchPadEnabled ? "Touch: ON" : "Touch: OFF";
  const setCb = document.getElementById("set-touch-pad");
  if (setCb) setCb.checked = mobileTouchPadEnabled;
  const miniHint = document.getElementById("minimap-hint-label");
  if (miniHint)
    miniHint.textContent = mobileTouchPadEnabled
      ? "Tap-Move • Drag-Pan"
      : "L-Pan • R-Move";
  const stageHint = document.getElementById("stage-rotate-hint");
  if (stageHint) {
    stageHint.innerHTML = mobileTouchPadEnabled
      ? '<i class="fa-solid fa-arrows-rotate mr-1"></i> Drag to Rotate • Pinch to Zoom'
      : '<i class="fa-solid fa-arrows-rotate mr-1"></i> Drag to Rotate • Scroll / Pinch to Zoom';
  }
  if (!mobileTouchPadEnabled) {
    mobileJoyState.pointerId = null;
    mobileJoyState.nx = 0;
    mobileJoyState.ny = 0;
    mobileJoyState.active = false;
    const knob = document.getElementById("mobile-joystick-knob");
    if (knob) knob.style.transform = "translate(0px, 0px)";
  }
};

window.centerCameraOnHero = function () {
  if (!playerHero) return;
  cameraLocked = true;
  if (!playerHero.dead)
    cameraFocus.set(
      playerHero.mesh.position.x,
      0,
      playerHero.mesh.position.z,
    );
  syncCamLockLabel();
  spawnFloatText(
    playerHero.mesh.position,
    "Camera Centered",
    "#34d399",
    12,
  );
};

window.mobileSmartAttackButton = function () {
  if (
    !playerHero ||
    playerHero.dead ||
    playerHero.reincarnating ||
    gameOver ||
    inHeroSelect
  )
    return;
  if (
    inspectedUnit &&
    !inspectedUnit.dead &&
    inspectedUnit.team !== playerHero.team
  ) {
    orderHeroAttackTarget(inspectedUnit);
    return;
  }
  window.attackNearest();
};

// Virtual Analog Thumbstick Event Wiring (Pointer Events + Pointer Capture)
(function initMobileVirtualJoystick() {
  const joyZone = document.getElementById("mobile-joystick-zone");
  const joyBase = document.getElementById("mobile-joystick-base");
  const joyKnob = document.getElementById("mobile-joystick-knob");
  if (!joyZone || !joyBase || !joyKnob) return;
  const maxRadius = 34;

  const updateKnobFromClient = (cx, cy) => {
    const dx = cx - mobileJoyState.originX;
    const dy = cy - mobileJoyState.originY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const ang = Math.atan2(dy, dx);
    const kx = dist > 0.001 ? Math.cos(ang) * clamped : 0;
    const ky = dist > 0.001 ? Math.sin(ang) * clamped : 0;
    joyKnob.style.transform = `translate(${kx.toFixed(1)}px, ${ky.toFixed(1)}px)`;

    const norm = clamped / maxRadius;
    if (norm < 0.14) {
      mobileJoyState.nx = 0;
      mobileJoyState.ny = 0;
    } else {
      const scaled = (norm - 0.14) / 0.86;
      mobileJoyState.nx = Math.cos(ang) * scaled;
      mobileJoyState.ny = Math.sin(ang) * scaled;
    }
  };

  const resetJoystick = (pid) => {
    if (pid !== undefined && mobileJoyState.pointerId !== pid) return;
    const wasMoving = mobileJoyState.active;
    mobileJoyState.pointerId = null;
    mobileJoyState.nx = 0;
    mobileJoyState.ny = 0;
    mobileJoyState.active = false;
    joyKnob.style.transform = "translate(0px, 0px)";
    if (wasMoving && playerHero && !playerHero.dead) {
      playerHero.targetPos = null;
      playerHero.attackMovePos = null;
    }
  };

  joyZone.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      joyZone.setPointerCapture(e.pointerId);
    } catch (err) {}
    const rect = joyBase.getBoundingClientRect();
    mobileJoyState.pointerId = e.pointerId;
    mobileJoyState.originX = rect.left + rect.width * 0.5;
    mobileJoyState.originY = rect.top + rect.height * 0.5;
    mobileJoyState.active = true;
    updateKnobFromClient(e.clientX, e.clientY);
  });

  joyZone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== mobileJoyState.pointerId) return;
    e.preventDefault();
    updateKnobFromClient(e.clientX, e.clientY);
  });

  joyZone.addEventListener("pointerup", (e) =>
    resetJoystick(e.pointerId),
  );
  joyZone.addEventListener("pointercancel", (e) =>
    resetJoystick(e.pointerId),
  );
  joyZone.addEventListener("lostpointercapture", (e) =>
    resetJoystick(e.pointerId),
  );
})();

// Unified Mouse + Multi-Touch Canvas Controls (Tap/Double-Tap to Move/Attack/Cast, Intentional 1-Finger Drag to Pan Camera, 2-Finger Pinch to Zoom)
const activeCanvasPointers = new Map();
let canvasTouchGesture = {
  mode: "none", // 'tap' | 'pan' | 'pinch'
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  startTime: 0,
  lastPinchDist: 0,
  lastTapTime: 0,
  lastTapX: 0,
  lastTapY: 0,
  isDoubleTap: false,
};
let _lastAnyTouchTs = 0;
let _pointerRaycastDirty = false;

document.addEventListener(
  "dblclick",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") {
    _lastAnyTouchTs = performance.now();
  } else {
    // Ignore synthetic mouse events fired right after touch double-taps on mobile browsers
    if (performance.now() - _lastAnyTouchTs < 650) return;
    if (e.button === 2)
      issueCanvasOrder(e.clientX, e.clientY, true, false);
    else if (e.button === 0)
      issueCanvasOrder(e.clientX, e.clientY, false, false);
    return;
  }
  if (inHeroSelect) return;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (err) {}
  activeCanvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  mouseClient.x = e.clientX;
  mouseClient.y = e.clientY;
  _pointerRaycastDirty = true;

  if (activeCanvasPointers.size === 1) {
    const now = performance.now();
    const isRapidDoubleTap = now - canvasTouchGesture.lastTapTime < 420;
    canvasTouchGesture.mode = "tap";
    canvasTouchGesture.isDoubleTap = isRapidDoubleTap;
    canvasTouchGesture.startX = e.clientX;
    canvasTouchGesture.startY = e.clientY;
    canvasTouchGesture.lastX = e.clientX;
    canvasTouchGesture.lastY = e.clientY;
    canvasTouchGesture.startTime = now;
    canvasTouchGesture.lastPinchDist = 0;
  } else if (activeCanvasPointers.size >= 2) {
    const pts = Array.from(activeCanvasPointers.values());
    canvasTouchGesture.mode = "pinch";
    canvasTouchGesture.isDoubleTap = false;
    canvasTouchGesture.lastPinchDist = Math.hypot(
      pts[0].x - pts[1].x,
      pts[0].y - pts[1].y,
    );
  }
});

canvas.addEventListener(
  "pointermove",
  (e) => {
    mouseClient.x = e.clientX;
    mouseClient.y = e.clientY;
    _pointerRaycastDirty = true;

    if (
      e.pointerType !== "touch" ||
      !activeCanvasPointers.has(e.pointerId) ||
      inHeroSelect
    )
      return;
    _lastAnyTouchTs = performance.now();
    activeCanvasPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activeCanvasPointers.size >= 2) {
      const pts = Array.from(activeCanvasPointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (canvasTouchGesture.lastPinchDist > 0 && dist > 0) {
        const zoomFactor = canvasTouchGesture.lastPinchDist / dist;
        CAMERA_OFFSET.multiplyScalar(
          THREE.MathUtils.clamp(zoomFactor, 0.9, 1.12),
        );
        CAMERA_OFFSET.y = THREE.MathUtils.clamp(CAMERA_OFFSET.y, 26, 128);
        CAMERA_OFFSET.z = THREE.MathUtils.clamp(CAMERA_OFFSET.z, 20, 72);
      }
      canvasTouchGesture.mode = "pinch";
      canvasTouchGesture.lastPinchDist = dist;
    } else if (activeCanvasPointers.size === 1) {
      const movedDist = Math.hypot(
        e.clientX - canvasTouchGesture.startX,
        e.clientY - canvasTouchGesture.startY,
      );
      const panThreshold = isTouchCapableDevice() ? 28 : 16;
      // Never treat a rapid double-tap (or short micro-slide) as a camera unlock/pan gesture
      if (!canvasTouchGesture.isDoubleTap && movedDist >= panThreshold) {
        canvasTouchGesture.mode = "pan";
        if (cameraLocked) {
          cameraLocked = false;
          syncCamLockLabel();
        }
        const dx = e.clientX - canvasTouchGesture.lastX;
        const dy = e.clientY - canvasTouchGesture.lastY;
        const panScale = (CAMERA_OFFSET.y / 56) * 0.13;
        cameraFocus.x = THREE.MathUtils.clamp(
          cameraFocus.x - dx * panScale,
          -MAP_HALF + 12,
          MAP_HALF - 12,
        );
        cameraFocus.z = THREE.MathUtils.clamp(
          cameraFocus.z - dy * panScale,
          -MAP_HALF + 12,
          MAP_HALF - 12,
        );
      }
      canvasTouchGesture.lastX = e.clientX;
      canvasTouchGesture.lastY = e.clientY;
    }
  },
  { passive: true },
);

const handleCanvasTouchEnd = (e) => {
  if (e.pointerType !== "touch") return;
  const now = performance.now();
  _lastAnyTouchTs = now;
  const hadPointer = activeCanvasPointers.has(e.pointerId);
  activeCanvasPointers.delete(e.pointerId);
  if (!hadPointer || inHeroSelect) return;

  if (activeCanvasPointers.size === 0) {
    const elapsed = now - canvasTouchGesture.startTime;
    if (canvasTouchGesture.mode === "tap" && elapsed < 520) {
      canvasTouchGesture.lastTapTime = now;
      canvasTouchGesture.lastTapX = e.clientX;
      canvasTouchGesture.lastTapY = e.clientY;
      issueCanvasOrder(e.clientX, e.clientY, false, true);
    }
    canvasTouchGesture.mode = "none";
    canvasTouchGesture.isDoubleTap = false;
    canvasTouchGesture.lastPinchDist = 0;
  } else if (activeCanvasPointers.size === 1) {
    const rem = Array.from(activeCanvasPointers.values())[0];
    canvasTouchGesture.mode = "tap";
    canvasTouchGesture.isDoubleTap = false;
    canvasTouchGesture.startX = rem.x;
    canvasTouchGesture.startY = rem.y;
    canvasTouchGesture.lastX = rem.x;
    canvasTouchGesture.lastY = rem.y;
    canvasTouchGesture.lastPinchDist = 0;
  }
};
canvas.addEventListener("pointerup", handleCanvasTouchEnd);
canvas.addEventListener("pointercancel", handleCanvasTouchEnd);
canvas.addEventListener("lostpointercapture", handleCanvasTouchEnd);

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (inHeroSelect) {
      previewZoomFactor = THREE.MathUtils.clamp(
        previewZoomFactor + (e.deltaY > 0 ? 0.08 : -0.08),
        0.72,
        1.45,
      );
      return;
    }
    const zoom = e.deltaY > 0 ? 1.07 : 0.93;
    CAMERA_OFFSET.multiplyScalar(zoom);
    CAMERA_OFFSET.y = THREE.MathUtils.clamp(CAMERA_OFFSET.y, 26, 128);
    CAMERA_OFFSET.z = THREE.MathUtils.clamp(CAMERA_OFFSET.z, 20, 72);
  },
  { passive: false },
);

// Minimap: Desktop (Left-Pan / Right-Move) + Touch (Tap-Move / Drag-Pan / Double-Tap Re-Center)
let miniTouchState = {
  active: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  dragged: false,
  lastTapTs: 0,
};
const minimapClientToWorld = (clientX, clientY) => {
  const r = minimapCanvas.getBoundingClientRect();
  const rw = Math.max(1, r.width);
  const rh = Math.max(1, r.height);
  return {
    wx: THREE.MathUtils.clamp(
      ((clientX - r.left) / rw - 0.5) * (MAP_HALF * 2),
      -MAP_HALF + 3,
      MAP_HALF - 3,
    ),
    wz: THREE.MathUtils.clamp(
      ((clientY - r.top) / rh - 0.5) * (MAP_HALF * 2),
      -MAP_HALF + 3,
      MAP_HALF - 3,
    ),
  };
};

const executeMinimapMoveOrder = (wx, wz, isAttackMove = false) => {
  if (!playerHero || playerHero.dead) return;
  if (isAttackMove) {
    const miniEnemy = findEnemyNearWorldPoint({ x: wx, z: wz }, 14.0);
    if (miniEnemy) {
      orderHeroAttackTarget(miniEnemy);
      window._minimapTapPulse = { wx, wz, ttl: 0.85, color: "#f43f5e" };
      return;
    }
    if (playerHero.tpChannel)
      window.cancelTeleportChannel("Teleport Canceled");
    playerHero.targetUnit = null;
    playerHero.targetPos = null;
    playerHero.attackMovePos = new THREE.Vector3(wx, 0, wz);
    if (mpState.active && mpState.role === "guest")
      mpSendToHost({ type: "CMD", cmd: "ATTACK_MOVE", x: wx, z: wz });
    attackMovePrimed = false;
    updatePrimedState();
    triggerMoveWaypoint(wx, wz, 0xf43f5e);
    window._minimapTapPulse = { wx, wz, ttl: 0.85, color: "#f43f5e" };
    sfx.play("move");
    return;
  }
  if (playerHero.tpChannel)
    window.cancelTeleportChannel("Teleport Canceled");
  playerHero.targetUnit = null;
  playerHero.attackMovePos = null;
  playerHero.targetPos = new THREE.Vector3(wx, 0, wz);
  if (mpState.active && mpState.role === "guest")
    mpSendToHost({ type: "CMD", cmd: "MOVE", x: wx, z: wz });
  triggerMoveWaypoint(wx, wz, 0x22c55e);
  window._minimapTapPulse = { wx, wz, ttl: 0.85, color: "#22d3ee" };
  sfx.play("move");
};

const handleMinimapTouchStart = (clientX, clientY) => {
  const { wx, wz } = minimapClientToWorld(clientX, clientY);
  if (tpTargetMode && playerHero && !playerHero.dead) {
    const dests = getValidTeleportDestinations(playerHero.team);
    let closestDest = null;
    let bestD = 32.0;
    dests.forEach((d) => {
      const bx = d.towerPos ? d.towerPos.x : d.x;
      const bz = d.towerPos ? d.towerPos.z : d.z;
      const dist = Math.hypot(wx - bx, wz - bz);
      if (dist < bestD) {
        bestD = dist;
        closestDest = d;
      }
    });
    if (closestDest) window.startTeleportToDestination(closestDest.id);
    return;
  }
  miniTouchState.active = true;
  miniTouchState.startX = clientX;
  miniTouchState.startY = clientY;
  miniTouchState.lastX = clientX;
  miniTouchState.lastY = clientY;
  miniTouchState.dragged = false;
};

const handleMinimapTouchMove = (clientX, clientY) => {
  if (!miniTouchState.active) return;
  miniTouchState.lastX = clientX;
  miniTouchState.lastY = clientY;
  const now = performance.now();
  const isDoubleTapOnMini = now - miniTouchState.lastTapTs < 420;
  if (
    !isDoubleTapOnMini &&
    Math.hypot(
      clientX - miniTouchState.startX,
      clientY - miniTouchState.startY,
    ) > 12
  ) {
    miniTouchState.dragged = true;
  }
  if (miniTouchState.dragged) {
    const { wx, wz } = minimapClientToWorld(clientX, clientY);
    cameraLocked = false;
    syncCamLockLabel();
    cameraFocus.set(wx, 0, wz);
  }
};

const handleMinimapTouchEnd = (clientX, clientY) => {
  if (!miniTouchState.active) return;
  const useX =
    typeof clientX === "number" && clientX > 0
      ? clientX
      : miniTouchState.lastX;
  const useY =
    typeof clientY === "number" && clientY > 0
      ? clientY
      : miniTouchState.lastY;
  const wasDragged = miniTouchState.dragged;
  miniTouchState.active = false;
  if (!wasDragged) {
    const now = performance.now();
    if (
      now - miniTouchState.lastTapTs < 320 &&
      playerHero &&
      !playerHero.dead
    ) {
      miniTouchState.lastTapTs = 0;
      window.centerCameraOnHero();
      return;
    }
    miniTouchState.lastTapTs = now;
    const { wx, wz } = minimapClientToWorld(useX, useY);
    const tappedMiniShop = shopEntities.find(
      (s) => Math.hypot(wx - s.x, wz - s.z) <= 18.0,
    );
    if (tappedMiniShop) {
      window._minimapTapPulse = {
        wx: tappedMiniShop.x,
        wz: tappedMiniShop.z,
        ttl: 0.85,
        color: tappedMiniShop.type === "secret" ? "#c084fc" : "#facc15",
      };
      window.openShopForEntity(tappedMiniShop, true);
      return;
    }
    executeMinimapMoveOrder(wx, wz, attackMovePrimed);
  }
};

minimapCanvas.addEventListener(
  "touchstart",
  (e) => {
    if (!e.touches || e.touches.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    handleMinimapTouchStart(e.touches[0].clientX, e.touches[0].clientY);
  },
  { passive: false },
);

minimapCanvas.addEventListener(
  "touchmove",
  (e) => {
    if (!e.touches || e.touches.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    handleMinimapTouchMove(e.touches[0].clientX, e.touches[0].clientY);
  },
  { passive: false },
);

minimapCanvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
    const t =
      e.changedTouches && e.changedTouches[0]
        ? e.changedTouches[0]
        : null;
    handleMinimapTouchEnd(
      t ? t.clientX : miniTouchState.lastX,
      t ? t.clientY : miniTouchState.lastY,
    );
  },
  { passive: false },
);

minimapCanvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") {
    _lastAnyTouchTs = performance.now();
    e.preventDefault();
    e.stopPropagation();
    if (!miniTouchState.active)
      handleMinimapTouchStart(e.clientX, e.clientY);
    return;
  }
  if (performance.now() - _lastAnyTouchTs < 650) return;
  const { wx, wz } = minimapClientToWorld(e.clientX, e.clientY);

  if (tpTargetMode && playerHero && !playerHero.dead) {
    if (e.button === 2) {
      window.cancelTpTargetMode();
      return;
    }
    const dests = getValidTeleportDestinations(playerHero.team);
    let closestDest = null;
    let bestD = 26.0;
    dests.forEach((d) => {
      const bx = d.towerPos ? d.towerPos.x : d.x;
      const bz = d.towerPos ? d.towerPos.z : d.z;
      const dist = Math.hypot(wx - bx, wz - bz);
      if (dist < bestD) {
        bestD = dist;
        closestDest = d;
      }
    });
    if (closestDest) window.startTeleportToDestination(closestDest.id);
    return;
  }

  if (
    (attackMovePrimed || isAKeyHeld) &&
    playerHero &&
    !playerHero.dead &&
    e.button === 0
  ) {
    executeMinimapMoveOrder(wx, wz, true);
    return;
  }

  const clickedMiniShop = shopEntities.find(
    (s) => Math.hypot(wx - s.x, wz - s.z) <= 18.0,
  );
  if (clickedMiniShop && e.button === 2) {
    window._minimapTapPulse = {
      wx: clickedMiniShop.x,
      wz: clickedMiniShop.z,
      ttl: 0.85,
      color: clickedMiniShop.type === "secret" ? "#c084fc" : "#facc15",
    };
    window.openShopForEntity(clickedMiniShop, true);
    return;
  }
  if (e.button === 2 && playerHero && !playerHero.dead) {
    executeMinimapMoveOrder(wx, wz, false);
  } else {
    cameraLocked = false;
    syncCamLockLabel();
    cameraFocus.set(wx, 0, wz);
  }
});

minimapCanvas.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "touch" || !miniTouchState.active) return;
  handleMinimapTouchMove(e.clientX, e.clientY);
});

const endMinimapTouch = (e) => {
  if (e.pointerType !== "touch" || !miniTouchState.active) return;
  handleMinimapTouchEnd(e.clientX, e.clientY);
};
minimapCanvas.addEventListener("pointerup", endMinimapTouch);
minimapCanvas.addEventListener("pointercancel", endMinimapTouch);

window.attackNearest = function () {
  if (!playerHero || playerHero.dead || gameOver || inHeroSelect) return;
  const foe = findNearestTarget(playerHero, 28, false, true);
  if (foe) {
    orderHeroAttackTarget(foe);
  } else {
    spawnFloatText(
      playerHero.mesh.position,
      "No Enemy Target in Range!",
      "#fb7185",
      13,
    );
  }
};

window.addEventListener("keydown", (e) => {
  if (
    inHeroSelect &&
    !document
      .getElementById("hero-select-overlay")
      .classList.contains("hidden")
  ) {
    if (
      ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)
    ) {
      e.preventDefault();
      const step =
        e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      window.cycleHeroSelection(step);
      return;
    }
  }
  if (e.key === "Escape") {
    const sm = document.getElementById("settings-modal");
    if (sm && !sm.classList.contains("hidden")) {
      window.closeSettingsModal();
      return;
    }
    if (inspectedUnit) {
      window.clearInspectedUnit();
      return;
    }
  }
  if (e.key.toUpperCase() === "O" && !e.ctrlKey && !e.metaKey) {
    const sm = document.getElementById("settings-modal");
    if (sm) {
      if (sm.classList.contains("hidden")) window.openSettingsModal();
      else window.closeSettingsModal();
      return;
    }
  }
  if (inHeroSelect) return;
  const chatInp = document.getElementById("mp-chat-input");
  if (chatInp && document.activeElement === chatInp) {
    if (e.key === "Enter") {
      e.preventDefault();
      window.submitMpChatInput();
    } else if (e.key === "Escape") {
      e.preventDefault();
      window.toggleMpChatBar(false);
    }
    return;
  }
  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    window.toggleMpChatBar(true);
    return;
  }

  // Local 2-Player Shared Screen Controls for Player 2 (Arrows + U/I/O/P + H + M + N)
  if (
    mpState.active &&
    mpState.transport === "local2p" &&
    localP2Hero &&
    !localP2Hero.dead
  ) {
    const k2 = e.key.toUpperCase();
    if (e.key === "ArrowUp") {
      e.preventDefault();
      p2MoveKeys.up = true;
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      p2MoveKeys.down = true;
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      p2MoveKeys.left = true;
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      p2MoveKeys.right = true;
      return;
    }

    const p2SkillMap = { U: "Q", I: "W", O: "E", P: "R" };
    if (p2SkillMap[k2]) {
      e.preventDefault();
      const skKey = p2SkillMap[k2];
      if (
        localP2Hero.skillPoints > 0 &&
        canHeroLevelAbility(localP2Hero, skKey)
      ) {
        localP2Hero.abilityLevels[skKey]++;
        localP2Hero.skillPoints--;
      }
      const tgt = findNearestTarget(localP2Hero, 22, false, true);
      const aim = tgt
        ? tgt.mesh.position
        : new THREE.Vector3(
            localP2Hero.mesh.position.x +
              Math.sin(localP2Hero.mesh.rotation.y) * 12,
            0,
            localP2Hero.mesh.position.z +
              Math.cos(localP2Hero.mesh.rotation.y) * 12,
          );
      castHeroAbility(localP2Hero, skKey, aim);
      return;
    }
    if (k2 === "H") {
      e.preventDefault();
      const foe = findNearestTarget(localP2Hero, 26, false, true);
      if (foe) {
        localP2Hero.targetUnit = foe;
        localP2Hero.targetPos = null;
      }
      return;
    }
    if (k2 === "M") {
      e.preventDefault();
      const build = [
        "treads",
        "vanguard",
        "desolator",
        "kaya_sange",
        "daedalus",
        "heart",
      ];
      const slot = localP2Hero.inventory.findIndex((s) => s === null);
      const item =
        slot !== -1
          ? SHOP_ITEMS.find((it) => it.id === build[slot])
          : null;
      if (item && localP2Hero.gold >= item.cost) {
        localP2Hero.gold -= item.cost;
        localP2Hero.inventory[slot] = item;
        applyItemStatsToHero(localP2Hero, item);
        spawnFloatText(
          localP2Hero.mesh.position,
          `P2 Bought ${item.name}!`,
          "#facc15",
          14,
        );
      }
      return;
    }
    if (k2 === "N") {
      e.preventDefault();
      const bx = localP2Hero.team === "radiant" ? -134 : 134;
      const bz = localP2Hero.team === "radiant" ? 134 : -134;
      localP2Hero.mesh.position.set(bx, getTerrainHeightAt(bx, bz), bz);
      localP2Hero.targetPos = null;
      localP2Hero.targetUnit = null;
      spawnShockwaveRing(bx, bz, 4.5, 0x22d3ee, 0.55);
      return;
    }
  }

  if (e.key === "Control") {
    setCtrlQuickUpgradeVisuals(true);
    return;
  }

  const k = e.key.toUpperCase();
  const talentModalEl = document.getElementById("talent-modal");
  const isTalentModalOpen =
    talentModalEl && !talentModalEl.classList.contains("hidden");

  // Ctrl + Q / W / E / R -> Quick-Upgrade Skill using 1 Skill Point (without casting)
  if (
    e.ctrlKey &&
    !e.altKey &&
    !e.metaKey &&
    ["Q", "W", "E", "R"].includes(k)
  ) {
    e.preventDefault();
    window.levelUpAbility(k);
    return;
  }

  // Ctrl + U or Ctrl + G -> Quick-Upgrade Attributes (+2 All Stats) using 1 Skill Point
  if (e.ctrlKey && !e.altKey && !e.metaKey && (k === "U" || k === "G")) {
    e.preventDefault();
    window.levelUpAttributes();
    return;
  }

  // Ctrl + 1 / Ctrl + 2 -> Instant Left / Right Talent Branch unlock using 1 Skill Point
  const isOne =
    e.key === "1" || e.code === "Digit1" || e.code === "Numpad1";
  const isTwo =
    e.key === "2" || e.code === "Digit2" || e.code === "Numpad2";
  if (
    (e.ctrlKey || isCtrlHeld) &&
    !e.altKey &&
    !e.metaKey &&
    (isOne || isTwo)
  ) {
    e.preventDefault();
    window.quickPickNextTalentBranch(isOne ? 0 : 1);
    return;
  }

  // When Talent Modal is open, 1 / ArrowLeft or 2 / ArrowRight picks Left / Right Talent branch
  if (isTalentModalOpen && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (isOne || e.key === "ArrowLeft") {
      e.preventDefault();
      window.quickPickNextTalentBranch(0);
      return;
    }
    if (isTwo || e.key === "ArrowRight") {
      e.preventDefault();
      window.quickPickNextTalentBranch(1);
      return;
    }
  }

  if (["Q", "W", "E", "R"].includes(k)) {
    e.preventDefault();
    attackMovePrimed = false;
    window.cancelTpTargetMode();
    if (playerHero && !playerHero.dead) {
      if (mpState.active && mpState.role === "guest") {
        playerHero.castAnim = 0.3;
        playerHero.mesh.rotation.y = Math.atan2(
          worldCursor.x - playerHero.mesh.position.x,
          worldCursor.z - playerHero.mesh.position.z,
        );
        mpSendToHost({
          type: "CMD",
          cmd: "CAST",
          key: k,
          x: worldCursor.x,
          z: worldCursor.z,
        });
      } else {
        castHeroAbility(playerHero, k, worldCursor);
      }
    }
    return;
  }
  if (
    ["1", "2", "3", "4", "5", "6"].includes(e.key) &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey
  ) {
    useInventorySlot(parseInt(e.key, 10) - 1);
    return;
  }
  if (k === "A" && !e.ctrlKey) {
    e.preventDefault();
    if (!e.repeat) {
      isAKeyHeld = true;
      window.toggleAttackMoveMode();
      updateCanvasCursorState();
    }
  } else if (k === "V" && !e.ctrlKey) {
    e.preventDefault();
    window.activateTownPortalScroll();
  } else if ((k === "S" || k === "H") && !e.ctrlKey) {
    window.stopHeroCommand();
  } else if (k === "T") {
    if (isTalentModalOpen) talentModalEl.classList.add("hidden");
    else window.openTalentModal();
  } else if (k === "B") {
    const modal = document.getElementById("shop-modal");
    if (modal.classList.contains("hidden")) {
      const near = getNearbyShop();
      renderShopTab(near && near.type === "secret" ? "secret" : "all");
      modal.classList.remove("hidden");
    } else modal.classList.add("hidden");
  } else if (e.code === "Space" || k === "Y") {
    e.preventDefault();
    cameraLocked = !cameraLocked;
    if (playerHero) cameraFocus.copy(playerHero.mesh.position);
    syncCamLockLabel();
  } else if (e.key === "Escape") {
    primedSkill = null;
    attackMovePrimed = false;
    swapSourceSlot = null;
    window.cancelTpTargetMode();
    updatePrimedState();
    refreshInventoryGrid();
    window.clearInspectedUnit();
    document.getElementById("shop-modal").classList.add("hidden");
    document.getElementById("talent-modal").classList.add("hidden");
  }

  if (e.key === "ArrowUp") panKeys.up = true;
  if (e.key === "ArrowDown") panKeys.down = true;
  if (e.key === "ArrowLeft") panKeys.left = true;
  if (e.key === "ArrowRight") panKeys.right = true;
});

document
  .getElementById("hud-attr-box")
  ?.addEventListener("click", (e) => {
    if (e.ctrlKey || isCtrlHeld) {
      e.stopPropagation();
      window.levelUpAttributes();
    }
  });

window.addEventListener("keyup", (e) => {
  if (e.key === "Control") {
    setCtrlQuickUpgradeVisuals(false);
  }
  if (e.key.toUpperCase() === "A") {
    isAKeyHeld = false;
    updateCanvasCursorState();
  }
  if (e.key === "ArrowUp") {
    panKeys.up = false;
    p2MoveKeys.up = false;
  }
  if (e.key === "ArrowDown") {
    panKeys.down = false;
    p2MoveKeys.down = false;
  }
  if (e.key === "ArrowLeft") {
    panKeys.left = false;
    p2MoveKeys.left = false;
  }
  if (e.key === "ArrowRight") {
    panKeys.right = false;
    p2MoveKeys.right = false;
  }
});
window.addEventListener("blur", () => {
  setCtrlQuickUpgradeVisuals(false);
  isAKeyHeld = false;
  panKeys.up = panKeys.down = panKeys.left = panKeys.right = false;
  updateCanvasCursorState();
});

function syncCamLockLabel() {
  const btn = document.getElementById("btn-cam-lock");
  btn.classList.toggle("text-emerald-400", cameraLocked);
  document.getElementById("cam-lock-label").textContent = cameraLocked
    ? "Cam: Locked"
    : "Cam: Free";
}

let _lastCamLockBtnTs = 0;
document.getElementById("btn-cam-lock").onclick = (e) => {
  const now = performance.now();
  if ((e && e.detail && e.detail > 1) || now - _lastCamLockBtnTs < 380)
    return;
  _lastCamLockBtnTs = now;
  cameraLocked = !cameraLocked;
  if (cameraLocked && playerHero && !playerHero.dead)
    cameraFocus.copy(playerHero.mesh.position);
  syncCamLockLabel();
  if (playerHero) {
    spawnFloatText(
      playerHero.mesh.position,
      cameraLocked ? "Camera Locked" : "Camera Free",
      cameraLocked ? "#34d399" : "#38bdf8",
      12,
    );
  }
};

function syncAudioToggleButtons() {
  const mBtn = document.getElementById("set-music-toggle-btn");
  const mIcon = document.getElementById("music-icon");
  const mLabel = document.getElementById("music-label");
  if (mIcon)
    mIcon.className = sfx.musicEnabled
      ? "fa-solid fa-music"
      : "fa-solid fa-volume-xmark";
  if (mLabel)
    mLabel.textContent = sfx.musicEnabled ? "Music: ON" : "Music: OFF";
  if (mBtn) {
    mBtn.className = sfx.musicEnabled
      ? "px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 transition"
      : "px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 font-bold text-[11px] flex items-center gap-1.5 transition";
  }

  const sBtn = document.getElementById("set-sfx-toggle-btn");
  const sIcon = document.getElementById("sound-icon");
  const sLabel = document.getElementById("sfx-label");
  if (sIcon)
    sIcon.className = sfx.sfxEnabled
      ? "fa-solid fa-volume-high"
      : "fa-solid fa-volume-xmark";
  if (sLabel)
    sLabel.textContent = sfx.sfxEnabled ? "SFX: ON" : "SFX: OFF";
  if (sBtn) {
    sBtn.className = sfx.sfxEnabled
      ? "px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-400/50 text-sky-300 font-bold text-[11px] flex items-center gap-1.5 transition"
      : "px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 font-bold text-[11px] flex items-center gap-1.5 transition";
  }

  const vBtn = document.getElementById("set-voice-toggle-btn");
  const vIcon = document.getElementById("voice-icon");
  const vLabel = document.getElementById("voice-label");
  if (vIcon)
    vIcon.className = sfx.voiceEnabled
      ? "fa-solid fa-comment-dots"
      : "fa-solid fa-comment-slash";
  if (vLabel)
    vLabel.textContent = sfx.voiceEnabled ? "Voice: ON" : "Voice: OFF";
  if (vBtn) {
    vBtn.className = sfx.voiceEnabled
      ? "px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 transition"
      : "px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 font-bold text-[11px] flex items-center gap-1.5 transition";
  }
}

window.toggleBackgroundMusic = function () {
  sfx.ensure();
  sfx.setMusicEnabled(!sfx.musicEnabled);
  syncAudioToggleButtons();
};

window.toggleSfxAudio = function () {
  sfx.ensure();
  sfx.setSfxEnabled(!sfx.sfxEnabled);
  syncAudioToggleButtons();
};

window.toggleVoiceAudio = function () {
  sfx.voiceEnabled = !sfx.voiceEnabled;
  if (!sfx.voiceEnabled) {
    sfx.stopSpeech();
  }
  syncAudioToggleButtons();
};

window.refreshSettingsVoiceDropdown = function () {
  const sel = document.getElementById("set-hero-voice-override");
  const badge = document.getElementById("set-detected-voices-badge");
  if (!sel) return;
  const voices = sfx.getNaturalEnglishVoices();
  const hCfg = HERO_ROSTER[selectedHeroId];
  if (badge) {
    badge.textContent = `${voices.length} OS Voice${voices.length === 1 ? "" : "s"} Ready`;
  }
  const curVal =
    (hCfg && sfx.heroVoiceOverrides && sfx.heroVoiceOverrides[hCfg.id]) ||
    "auto";
  sel.innerHTML = `<option value="auto">Auto (${hCfg ? hCfg.name : "Unique"})</option>`;
  voices.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.name.replace(/Microsoft |Google /g, "")} (${v.lang})`;
    if (v.name === curVal) opt.selected = true;
    sel.appendChild(opt);
  });
};

window.setSelectedHeroVoiceOverride = function (voiceName) {
  const hCfg = HERO_ROSTER[selectedHeroId];
  if (!hCfg) return;
  if (!sfx.heroVoiceOverrides) sfx.heroVoiceOverrides = {};
  if (!voiceName || voiceName === "auto")
    delete sfx.heroVoiceOverrides[hCfg.id];
  else sfx.heroVoiceOverrides[hCfg.id] = voiceName;
  window.auditionSelectedHeroVoice();
};

window.openSettingsModal = function () {
  window.refreshSettingsVoiceDropdown();
  const modal = document.getElementById("settings-modal");
  if (!modal) return;
  syncAudioToggleButtons();
  syncDayNightSettingsUI();
  document
    .querySelectorAll("#settings-weather-grid .setting-pill")
    .forEach((btn) => {
      btn.classList.toggle(
        "active-setting",
        btn.dataset.w === currentWeather,
      );
    });
  modal.classList.remove("hidden");
};

window.closeSettingsModal = function () {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.classList.add("hidden");
};

window.applyGameTheme = function (themeId) {
  userSettings.theme = themeId;
  document.body.classList.remove(
    "theme-radiant",
    "theme-dire",
    "theme-astral",
  );
  if (themeId === "radiant") document.body.classList.add("theme-radiant");
  else if (themeId === "dire") document.body.classList.add("theme-dire");
  else if (themeId === "astral")
    document.body.classList.add("theme-astral");

  document
    .querySelectorAll("#settings-theme-grid .setting-pill")
    .forEach((btn) => {
      btn.classList.toggle(
        "active-setting",
        btn.dataset.theme === themeId,
      );
    });
};

window.selectMusicTrack = function (trackId) {
  userSettings.musicTrack = trackId;
  sfx.ensure();
  sfx.setMusicTrackPreference(trackId);
  document
    .querySelectorAll("#settings-music-grid .setting-pill")
    .forEach((btn) => {
      btn.classList.toggle(
        "active-setting",
        btn.dataset.track === trackId,
      );
    });
};

window.updateAudioMixSettings = function () {
  const mVal = parseInt(
    document.getElementById("set-music-vol").value,
    10,
  );
  const sVal = parseInt(document.getElementById("set-sfx-vol").value, 10);
  const vVal = parseInt(
    document.getElementById("set-voice-vol").value,
    10,
  );
  document.getElementById("set-music-vol-val").textContent = `${mVal}%`;
  document.getElementById("set-sfx-vol-val").textContent = `${sVal}%`;
  document.getElementById("set-voice-vol-val").textContent = `${vVal}%`;

  sfx.musicVolumeScale = mVal / 100;
  sfx.sfxVolumeScale = sVal / 100;
  sfx.voiceVolumeScale = vVal / 100;

  if (sfx.musicGain && sfx.ctx) {
    sfx.musicGain.gain.setTargetAtTime(
      sfx._targetMusicGain(),
      sfx.ctx.currentTime,
      0.08,
    );
  }
  if (sfx.masterGain && sfx.ctx) {
    sfx.masterGain.gain.setTargetAtTime(
      sfx.sfxEnabled ? 0.8 * sfx.sfxVolumeScale : 0,
      sfx.ctx.currentTime,
      0.08,
    );
  }
};

window.updateGameplaySettings = function () {
  const scCb = document.getElementById("set-smart-cast");
  if (scCb) userSettings.smartCastEnabled = scCb.checked;
  const spd = parseInt(document.getElementById("set-pan-spd").value, 10);
  document.getElementById("set-pan-spd-val").textContent = String(spd);
  userSettings.edgePanSpeed = spd;
  userSettings.edgePanEnabled =
    document.getElementById("set-edge-pan").checked;
  userSettings.camShakeEnabled =
    document.getElementById("set-cam-shake").checked;
  userSettings.floatingTextEnabled =
    document.getElementById("set-float-dmg").checked;
};

function getGraphicsShaderDetailLevel(preset) {
  if (preset === "ultramax") return 1.0;
  if (preset === "ultra") return 0.28;
  return 0.0;
}

function applyRendererResolution() {
  const preset = userSettings.qualityPreset || "balanced";
  const isUltraMax = preset === "ultramax";
  const isUltra = preset === "ultra";
  const isUltraLight = preset === "ultralight";
  const detailLvl = getGraphicsShaderDetailLevel(preset);
  const nativeDpr = Math.max(1, window.devicePixelRatio || 1);
  // Render density per preset, in device pixels per CSS pixel at the default 100% render scale.
  // Small on-screen characters turn blocky quickly below ~0.8, so even the lowest tiers stay
  // close to 1:1; the per-pixel shading savings (pooled lights, textured terrain noise) pay for it.
  const targetDpr = isUltraMax
    ? 1.75
    : isUltra
      ? 1.5
      : preset === "high"
        ? 1.3
        : preset === "balanced"
          ? 1.1
          : preset === "performance"
            ? 1.0
            : preset === "potato"
              ? 0.9
              : 0.8;
  const scaleMult = isUltraLight
    ? 1.0
    : (userSettings.renderScale || 100) / 100;
  const minDprFloor = isUltraLight ? 0.6 : 0.5;
  let effectiveDpr = Math.max(
    minDprFloor,
    Math.min(nativeDpr, targetDpr * scaleMult) * nxg.dynResScale,
  );

  // Per-preset pixel budget so huge / high-DPI windows cannot blow up fill-rate
  const cssPx = Math.max(1, window.innerWidth * window.innerHeight);
  const maxDesktopPixels = isUltraMax
    ? 3.6e6
    : isUltra
      ? 2.8e6
      : preset === "high"
        ? 2.2e6
        : preset === "balanced"
          ? 1.6e6
          : preset === "performance"
            ? 1.3e6
            : preset === "potato"
              ? 1.0e6
              : 0.8e6;
  if (cssPx * effectiveDpr * effectiveDpr > maxDesktopPixels) {
    effectiveDpr = Math.max(minDprFloor, Math.sqrt(maxDesktopPixels / cssPx));
  }

  const bloomScale = isUltraMax
    ? 0.25
    : preset === "ultra"
      ? 0.22
      : preset === "high"
        ? 0.18
        : preset === "balanced"
          ? 0.15
          : 0.12;

  renderer.setPixelRatio(effectiveDpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (_hdrRT) {
    const wantSamples = 0; // Disable 4x MSAA on HDR half-float target to eliminate catastrophic GPU resolve stalls
    if (_hdrRT.samples !== wantSamples) {
      _hdrRT.samples = wantSamples;
      _hdrRT.dispose();
    }
  }
  if (composer) {
    if (typeof composer.setPixelRatio === "function")
      composer.setPixelRatio(effectiveDpr);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  if (bloomPass) {
    bloomPass.setSize(
      Math.floor(window.innerWidth * bloomScale),
      Math.floor(window.innerHeight * bloomScale),
    );
    bloomPass.strength = isUltraMax
      ? 0.38
      : preset === "ultra"
        ? 0.26
        : preset === "high"
          ? 0.18
          : 0.12;
    bloomPass.radius = isUltraMax
      ? 0.58
      : preset === "ultra"
        ? 0.46
        : 0.38;
    bloomPass.threshold = isUltraMax
      ? 0.96
      : preset === "ultra"
        ? 0.98
        : 1.02;
  }
  if (cinematicPass && cinematicPass.uniforms) {
    if (cinematicPass.uniforms.uResolution) {
      cinematicPass.uniforms.uResolution.value.set(
        Math.floor(window.innerWidth * effectiveDpr),
        Math.floor(window.innerHeight * effectiveDpr),
      );
    }
    if (cinematicPass.uniforms.uUltraMax) {
      cinematicPass.uniforms.uUltraMax.value = detailLvl;
    }
  }
}

window.setGraphicsQuality = function (preset) {
  if (preset === "ultramax" && !isUltraMaxUnlocked()) {
    syncUltraMaxLockUI();
    if (typeof sfx !== "undefined" && sfx.play) sfx.play("error");
    if (typeof showBanner === "function") {
      showBanner(
        "ULTRA MAX LOCKED!",
        "Win 1 match on IMMORTAL difficulty to unlock Ultra Max Graphics Mode!",
        "text-amber-300",
      );
    }
    preset =
      userSettings.qualityPreset &&
      userSettings.qualityPreset !== "ultramax"
        ? userSettings.qualityPreset
        : "ultra";
  }
  userSettings.qualityPreset =
    preset || (isUltraMaxUnlocked() ? "ultramax" : "ultra");
  syncUltraMaxLockUI();
  document
    .querySelectorAll("#settings-quality-grid .setting-pill")
    .forEach((btn) => {
      btn.classList.toggle(
        "active-setting",
        btn.dataset.q === userSettings.qualityPreset,
      );
    });

  const isUltraMax = preset === "ultramax";
  const isUltra = preset === "ultra";
  const isHigh = preset === "high";
  const isBalanced = preset === "balanced";
  const isPerf = preset === "performance";
  const isPotato = preset === "potato";
  const isUltraLight = preset === "ultralight";

  // 100% = the preset's own target density (see applyRendererResolution)
  const resScale = 100;
  const resEl = document.getElementById("set-res-scale");
  if (resEl) resEl.value = String(resScale);

  const cinEl = document.getElementById("set-cinematic");
  const bloomEl = document.getElementById("set-bloom");
  const shadEl = document.getElementById("set-shadows");
  const waterEl = document.getElementById("set-water-hq");
  const clutterEl = document.getElementById("set-clutter");
  const partEl = document.getElementById("set-particles");
  const portEl = document.getElementById("set-portraits-3d");

  // 7-tier differentiation: Ultra Light -> Potato -> Low -> Medium -> High -> Ultra -> Ultra Max
  if (cinEl) cinEl.checked = isUltraMax || isUltra;
  if (bloomEl) bloomEl.checked = isUltraMax || isUltra;
  if (shadEl)
    shadEl.checked = isUltraMax || isUltra || isHigh || isBalanced;
  if (waterEl)
    waterEl.checked = isUltraMax || isUltra || isHigh || isBalanced;
  const isStaticPortraitTier = isUltraLight || isPotato || isPerf;
  document.body.classList.toggle("low-gfx-mode", isStaticPortraitTier);
  document.body.classList.toggle("quality-ultralight", isUltraLight);
  if (clutterEl) clutterEl.checked = !isPotato && !isUltraLight;
  if (partEl) partEl.checked = isUltraMax || isUltra || isHigh;
  if (portEl) portEl.checked = !isStaticPortraitTier;

  if (
    isStaticPortraitTier &&
    typeof portraitStudio !== "undefined" &&
    portraitStudio.disposeResources
  ) {
    portraitStudio.disposeResources();
  }
  if (isUltraLight) {
    scene.traverse((obj) => {
      if (obj.material) {
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((m) => {
          if (m && m.map && m.map.generateMipmaps) {
            m.map.generateMipmaps = false;
            m.map.minFilter = THREE.LinearFilter;
            m.map.needsUpdate = true;
          }
        });
      }
    });
  }

  if (
    isUltraMax &&
    typeof buildUltraMaxEnvironmentDetails === "function"
  ) {
    buildUltraMaxEnvironmentDetails();
  }

  // Calibrated 1536 shadow map with tight 64m frustum delivers crisp 8cm texels at 44% lower fillrate
  const shSize = isUltraMax
    ? 1536
    : isUltra
      ? 1536
      : isHigh
        ? 1024
        : isBalanced
          ? 768
          : 512;
  const targetShadowType =
    isUltraMax || isUltra || isHigh
      ? THREE.PCFSoftShadowMap
      : THREE.PCFShadowMap;
  if (renderer.shadowMap.type !== targetShadowType) {
    renderer.shadowMap.type = targetShadowType;
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        if (Array.isArray(obj.material))
          obj.material.forEach((m) => {
            m.needsUpdate = true;
          });
        else obj.material.needsUpdate = true;
      }
    });
  }
  const targetExt = isUltraMax ? 64 : isUltra ? 64 : isHigh ? 66 : 68;
  if (sunLight.shadow.camera.right !== targetExt) {
    sunLight.shadow.camera.left = -targetExt;
    sunLight.shadow.camera.right = targetExt;
    sunLight.shadow.camera.top = targetExt;
    sunLight.shadow.camera.bottom = -targetExt;
    sunLight.shadow.camera.updateProjectionMatrix();
  }
  sunLight.shadow.bias = -0.00025;
  sunLight.shadow.normalBias = isUltraMax
    ? 0.012
    : isUltra
      ? 0.016
      : isHigh
        ? 0.024
        : 0.034;
  if (sunLight.shadow.mapSize.width !== shSize) {
    sunLight.shadow.mapSize.set(shSize, shSize);
    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null;
    }
  }
  scene.environmentIntensity = isUltraMax
    ? 0.9
    : isUltra
      ? 0.82
      : isHigh
        ? 0.74
        : isBalanced
          ? 0.64
          : isUltraLight
            ? 0.45
            : 0.54;
  if (nxg.ready) nxgApplyQuality(userSettings.qualityPreset);
  window.updateGraphicsSettings();
  renderer.shadowMap.needsUpdate = true;
  if (typeof inHeroSelect !== "undefined" && inHeroSelect) {
    if (typeof renderHeroSelectionCards === "function")
      renderHeroSelectionCards();
    if (typeof updateSelectionPreview === "function")
      updateSelectionPreview();
  } else if (
    typeof playerHero !== "undefined" &&
    playerHero &&
    playerHero.heroCfg &&
    typeof applyHeroToHUD === "function"
  ) {
    const radCfg = playerHero.heroCfg;
    const direLabel =
      document.getElementById("top-dire-name")?.textContent || "Dire";
    applyHeroToHUD(radCfg, direLabel);
  }

  const prevWasUltraMax = userSettings._lastWasUltraMax;
  userSettings._lastWasUltraMax = isUltraMax;
  if (prevWasUltraMax !== undefined && prevWasUltraMax !== isUltraMax) {
    if (typeof _heroPortraitThumbCache !== "undefined")
      _heroPortraitThumbCache.clear();
    if (
      typeof portraitStudio !== "undefined" &&
      portraitStudio.clearRigCache
    ) {
      portraitStudio.clearRigCache();
    }
    if (
      typeof inHeroSelect !== "undefined" &&
      inHeroSelect &&
      typeof rebuildPreviewHeroModel === "function"
    ) {
      rebuildPreviewHeroModel();
      if (typeof renderHeroSelectionCards === "function")
        renderHeroSelectionCards();
      if (typeof updateSelectionPreview === "function")
        updateSelectionPreview();
    }
    if (typeof units !== "undefined" && Array.isArray(units)) {
      units.forEach((u) => {
        if (
          u &&
          u.mesh &&
          [
            "hero",
            "boss",
            "dragon",
            "kong",
            "redman",
            "sneakygolem",
          ].includes(u.type)
        ) {
          const oldPos = u.mesh.position.clone();
          const oldRot = u.mesh.rotation.y;
          const wasVis = u.mesh.visible;
          scene.remove(u.mesh);
          disposeObject3D(u.mesh);
          u.mesh = u.buildMesh();
          u.mesh.position.copy(oldPos);
          u.mesh.rotation.y = oldRot;
          u.mesh.visible = wasVis;
          scene.add(u.mesh);
        }
      });
    }
  }
};

window.updateGraphicsSettings = function () {
  if (
    userSettings.qualityPreset === "ultramax" &&
    !isUltraMaxUnlocked()
  ) {
    userSettings.qualityPreset = "ultra";
  }
  const preset =
    userSettings.qualityPreset ||
    (isUltraMaxUnlocked() ? "ultramax" : "ultra");
  const isUltraMax = preset === "ultramax";
  const detailLvl = getGraphicsShaderDetailLevel(preset);
  const resEl = document.getElementById("set-res-scale");
  userSettings.renderScale = resEl ? parseInt(resEl.value, 10) : 100;
  const resValEl = document.getElementById("set-res-scale-val");
  if (resValEl) resValEl.textContent = `${userSettings.renderScale}%`;

  const cinEl = document.getElementById("set-cinematic");
  const bloomEl = document.getElementById("set-bloom");
  const shadEl = document.getElementById("set-shadows");
  const waterEl = document.getElementById("set-water-hq");
  const clutterEl = document.getElementById("set-clutter");
  const partEl = document.getElementById("set-particles");
  const portEl = document.getElementById("set-portraits-3d");
  const aoEl = document.getElementById("set-ao");

  userSettings.cinematicEnabled = cinEl ? cinEl.checked : false;
  userSettings.bloomEnabled = bloomEl ? bloomEl.checked : false;
  userSettings.shadowsEnabled = shadEl ? shadEl.checked : true;
  userSettings.waterHqEnabled = waterEl ? waterEl.checked : true;
  userSettings.clutterEnabled = clutterEl ? clutterEl.checked : true;
  userSettings.particlesEnabled = partEl ? partEl.checked : false;
  userSettings.portraits3dEnabled = portEl ? portEl.checked : true;
  const wantPost =
    userSettings.bloomEnabled ||
    userSettings.cinematicEnabled ||
    !!(aoEl && aoEl.checked);

  if (wantPost) {
    ensureComposerReady();
  } else {
    disposeComposerResources();
    if (
      preset === "ultralight" ||
      preset === "potato" ||
      preset === "performance"
    ) {
      LowRamOptimizer.disposeHeavyGpuResources({
        renderer,
        disposeComposerFn: disposeComposerResources,
        dirLight: !userSettings.shadowsEnabled ? sunLight : null,
      });
    }
  }

  applyRendererResolution();

  if (bloomPass) bloomPass.enabled = userSettings.bloomEnabled;
  if (cinematicPass) {
    cinematicPass.enabled = true;
    if (cinematicPass.uniforms && cinematicPass.uniforms.uStrength) {
      cinematicPass.uniforms.uStrength.value =
        userSettings.cinematicEnabled ? 1.0 : 0.0;
    }
    if (cinematicPass.uniforms && cinematicPass.uniforms.uUltraMax) {
      cinematicPass.uniforms.uUltraMax.value = detailLvl;
    }
  }
  if (godRayGroup) {
    godRayGroup.visible =
      isUltraMax &&
      !inHeroSelect &&
      userSettings.cinematicEnabled &&
      !isNightTime &&
      currentWeather === "clear";
  }
  if (riverShaderUniforms) {
    if (riverShaderUniforms.uFastWater) {
      riverShaderUniforms.uFastWater.value = userSettings.waterHqEnabled
        ? 0.0
        : 1.0;
    }
    if (riverShaderUniforms.uUltraMax) {
      riverShaderUniforms.uUltraMax.value = detailLvl;
    }
  }
  if (terrainShaderUniforms) {
    if (terrainShaderUniforms.uUltraMax)
      terrainShaderUniforms.uUltraMax.value = detailLvl;
    if (terrainShaderUniforms.uUltraLight)
      terrainShaderUniforms.uUltraLight.value =
        preset === "ultralight" ? 1.0 : 0.0;
  }
  if (skyDomeUniforms && skyDomeUniforms.uUltraLight) {
    skyDomeUniforms.uUltraLight.value =
      preset === "ultralight" ? 1.0 : 0.0;
  }
  for (let i = 0; i < groundClutterMeshes.length; i++) {
    groundClutterMeshes[i].visible = userSettings.clutterEnabled;
  }
  if (typeof ultraMaxEnvGroup !== "undefined" && ultraMaxEnvGroup) {
    ultraMaxEnvGroup.visible = isUltraMax && userSettings.clutterEnabled;
  }
  if (ambientMotes) ambientMotes.visible = userSettings.particlesEnabled;
  if (rainPoints && !userSettings.particlesEnabled)
    rainPoints.visible = false;

  renderer.shadowMap.enabled = userSettings.shadowsEnabled;
  sunLight.castShadow = userSettings.shadowsEnabled;
  if (!userSettings.shadowsEnabled && sunLight.shadow.map) {
    sunLight.shadow.map.dispose();
    sunLight.shadow.map = null;
  }
  renderer.shadowMap.needsUpdate = true;
  if (nxg.ready) nxgSyncSettings();
};

window.autoTuneGraphicsForHardware = function () {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const isTouch = isTouchCapableDevice();
  let gpuStr = "";
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    gpuStr = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
  } catch (e) {}
  const isVeryWeakGpu =
    /mali-g5|mali-t|mali-4|adreno 3|adreno 4|adreno 5|powervr|swiftshader|llvmpipe|software/i.test(
      gpuStr,
    );
  const isLowGpu = /intel|uhd|hd graphics|mali|adreno 6/i.test(gpuStr);
  const isDiscreteGpu =
    /nvidia|geforce|rtx|gtx|radeon rx|apple m[1-9]|apple gpu/i.test(
      gpuStr,
    );
  let recommended = "high";
  if (
    cores <= 2 ||
    mem <= 2 ||
    (isTouch && (mem <= 3 || cores <= 4 || isVeryWeakGpu))
  )
    recommended = "ultralight";
  else if (isVeryWeakGpu) recommended = "potato";
  else if (cores <= 4 || mem <= 4 || isLowGpu)
    recommended = "performance";
  else if (cores <= 6 || mem <= 8) recommended = "balanced";
  else if (isDiscreteGpu && cores >= 8)
    recommended = isUltraMaxUnlocked() ? "ultramax" : "ultra";
  else recommended = "ultra";

  window.setGraphicsQuality(recommended);
  const labelMap = {
    ultralight: "Ultra Light (30 FPS Low-End Phone Saver)",
    potato: "Potato (Ultra-Low)",
    performance: "Low / Performance",
    balanced: "Medium / Balanced",
    high: "High",
    ultra: "Ultra",
    ultramax: "Ultra Max (4K Shadows & HDR)",
  };
  showBanner(
    "AUTO-TUNED GRAPHICS",
    `Applied ${labelMap[recommended]} preset (${cores} Threads • ${mem}GB RAM)`,
    "text-emerald-300",
  );
};

window.setDayNightFromSettings = function (mode) {
  const wantNight = mode === "night";
  cycleClock = wantNight
    ? DAY_CYCLE_DURATION * 0.65
    : DAY_CYCLE_DURATION * 1.7;
  isNightTime = wantNight;
  syncDayNightSettingsUI();
  if (!wantNight && Array.isArray(units)) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u && !u.dead && u.type === "neutral" && u.isSleeping) {
        u.setSleepingState(false);
      }
    }
  }
  updateDayNightAndWeather(0);
  if (!wantNight && typeof updateNightVampires === "function")
    updateNightVampires(0);
  if (!inHeroSelect && !inTitleScreen) {
    if (wantNight)
      showBanner(
        "BRIGHT MOONLIGHT NIGHT",
        "Silver moonlight illuminates the arena • Neutral creeps fall asleep!",
        "text-sky-300",
      );
    else
      showBanner(
        "DAYBREAK",
        "The Golden Sun rises over the Ancients • Jungle camps awaken!",
        "text-amber-300",
      );
  }
};

window.setWeatherFromSettings = function (mode) {
  const idx = WEATHER_MODES.indexOf(mode);
  if (idx !== -1) weatherIdx = idx;
  weatherTimer = mode === "clear" ? 210.0 : 55.0;
  setWeather(mode);
  if (godRayGroup) {
    godRayGroup.visible =
      !inHeroSelect &&
      userSettings.cinematicEnabled &&
      !isNightTime &&
      mode === "clear";
  }
};

window.resetDefaultSettings = function () {
  sfx.setMusicEnabled(true);
  sfx.setSfxEnabled(true);
  sfx.voiceEnabled = true;
  syncAudioToggleButtons();
  window.applyGameTheme("sovereign");
  window.selectMusicTrack("auto");
  document.getElementById("set-music-vol").value = "100";
  document.getElementById("set-sfx-vol").value = "100";
  document.getElementById("set-voice-vol").value = "100";
  window.updateAudioMixSettings();

  document.getElementById("set-pan-spd").value = "48";
  document.getElementById("set-edge-pan").checked = true;
  document.getElementById("set-cam-shake").checked = true;
  document.getElementById("set-float-dmg").checked = true;
  window.updateGameplaySettings();

  window.setGraphicsQuality("balanced");
  window.setDayNightFromSettings("day");
  window.setWeatherFromSettings("clear");
};
document.getElementById("btn-switch-hero").onclick = () =>
  window.openHeroSelect();

const openHudShopModal = () => {
  window._shopOpenedAtTs = performance.now();
  const near = getNearbyShop();
  renderShopTab(near && near.type === "secret" ? "secret" : "all");
  document.getElementById("shop-modal").classList.remove("hidden");
};
const hudShopBtnEl = document.getElementById("btn-open-shop");
hudShopBtnEl.title =
  "Open Armory Shop [B] • Right-Click Shopkeeper in Arena";
hudShopBtnEl.onclick = openHudShopModal;
hudShopBtnEl.oncontextmenu = (e) => {
  e.preventDefault();
  openHudShopModal();
};
document.getElementById("btn-close-shop").onclick = () =>
  document.getElementById("shop-modal").classList.add("hidden");
document.querySelectorAll(".shop-tab-btn").forEach((btn) => {
  btn.onclick = () => renderShopTab(btn.dataset.shopTab);
});
window.walkToNearestSecretShop = function () {
  document.getElementById("shop-modal").classList.add("hidden");
  if (playerHero && !playerHero.dead) {
    if (playerHero.tpChannel)
      window.cancelTeleportChannel("Teleport Canceled");
    const p = playerHero.mesh.position;
    const dEast = Math.hypot(p.x - 64, p.z - 24);
    const dWest = Math.hypot(p.x + 64, p.z + 24);
    const sx = dWest < dEast ? -64 : 64;
    const sz = dWest < dEast ? -20 : 28;
    playerHero.targetUnit = null;
    playerHero.attackMovePos = null;
    playerHero.targetPos = new THREE.Vector3(sx, 0, sz);
    if (mpState.active && mpState.role === "guest")
      mpSendToHost({ type: "CMD", cmd: "MOVE", x: sx, z: sz });
    triggerMoveWaypoint(sx, sz, 0xa855f7);
    sfx.play("move");
  }
};

