/***********************************************************************
 * 1. HERO ROSTER, TALENT TREES & AI DIFFICULTY PROFILES
 ***********************************************************************/
const HERO_ROSTER = {
  aurelius: {
    id: "aurelius",
    name: "Sir Aurelius",
    shortName: "AURELIUS",
    title: "Solar Paragon",
    archetype: "Solar Vanguard • Banner Paladin",
    passive: {
      name: "Sunfire Cleave",
      desc: "Every 3rd melee attack unleashes a golden cleave dealing 45% splash damage within 4.4m.",
    },
    ratings: { offense: 7, defense: 9, mobility: 7, control: 8 },
    origin: "Sunspire Citadel",
    lore: "Once High Commander of the Sunspire Knights, Sir Aurelius forged his greatsword in the dying heart of a falling star. Drawn to the Shattered Confluence, he leads every charge at dawn so no ally walks into shadow alone.",
    attr: "Strength",
    rangeType: "Melee",
    icon: "fa-sun",
    accentColor: "text-amber-300",
    badgeBg: "from-amber-700 via-orange-950 to-slate-950",
    primaryHex: 0xfacc15,
    secondaryHex: 0xf59e0b,
    stats: {
      maxHp: 900,
      hpRegen: 6.4,
      maxMana: 380,
      manaRegen: 4.0,
      str: 28,
      agi: 18,
      int: 17,
      atkDamage: 72,
      atkRange: 3.7,
      atkCooldown: 0.92,
      moveSpeed: 12.8,
      armor: 8,
    },
    talents: {
      10: [
        {
          id: "aur_10_l",
          label: "+275 Max Health",
          apply: (h) => {
            h.maxHp += 275;
            h.hp += 275;
          },
        },
        {
          id: "aur_10_r",
          label: "+28 Attack Damage",
          apply: (h) => {
            h.atkDamage += 28;
          },
        },
      ],
      15: [
        {
          id: "aur_15_l",
          label: "+10 Armor & +8 HP Regen",
          apply: (h) => {
            h.armor += 10;
            h.hpRegen += 8;
          },
        },
        {
          id: "aur_15_r",
          label: "+35% Attack Speed",
          apply: (h) => {
            h.atkSpeedMult += 0.35;
          },
        },
      ],
      20: [
        {
          id: "aur_20_l",
          label: "-20% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.8;
          },
        },
        {
          id: "aur_20_r",
          label: "+22% Critical Strike (2.2x)",
          apply: (h) => {
            h.critChance += 0.22;
            h.critMult = Math.max(h.critMult, 2.2);
          },
        },
      ],
      25: [
        {
          id: "aur_25_l",
          label: "+750 HP & +25% Lifesteal",
          apply: (h) => {
            h.maxHp += 750;
            h.hp += 750;
            h.lifesteal += 0.25;
          },
        },
        {
          id: "aur_25_r",
          label: "Solar Avatar (+65 ATK & +25% Spell Amp)",
          apply: (h) => {
            h.atkDamage += 65;
            h.spellAmpBonus += 0.25;
          },
        },
      ],
    },
    voice: {
      pitch: 0.92,
      rate: 0.93,
      gender: "male",
      slotIdx: 0,
      archetype: "noble",
      accentPref: "en-gb",
      cadence: "heroic",
      motif: "brass_fanfare",
      select: [
        "Stand fast, friends. The dawn is ours to claim!",
        "By the Eternal Sun, my blade and banner stand ready.",
        "For honor, for the realm, and for a bright tomorrow!",
      ],
      moves: [
        "Forward into the dawn.",
        "Honor guides every step.",
        "The sun lights our path.",
        "With courage, we advance!",
      ],
      attack: [
        "Feel the sun’s judgment!",
        "Strike true!",
        "For the Sunspire!",
      ],
      cast: {
        Q: ["Solar Cleave!", "Burn in golden light!", "Searing arc!"],
        W: [
          "Raise the Sunfire Banner!",
          "Rally to the standard!",
          "Stand beneath the sun!",
        ],
        E: ["Aegis Bulwark!", "The light shields us!", "Hold the line!"],
        R: [
          "Orbital Sunbeam!",
          "Heavens, shine upon them!",
          "By the Eternal Sun!",
        ],
      },
      kill: [
        "Justice shines upon the fallen.",
        "Another shadow banished from the realm.",
      ],
      lowHp: [
        "Hold the line! The light still endures.",
        "I will not yield while breath remains!",
      ],
      gold: ["Gold for the war effort.", "The treasury grows."],
      levelup: [
        "The light surges within me!",
        "I ascend in solar glory!",
      ],
      buy: [
        "A worthy relic for a righteous cause.",
        "Forged in sunlight and steel.",
      ],
      respawn: ["The sun sets only to rise again."],
    },
    skills: {
      Q: {
        name: "Solar Cleave",
        tag: "MAGMA FISSURE",
        icon: "fa-fire-flame-curved",
        color: "text-amber-300",
        bg: "from-amber-800 via-orange-950 to-slate-950",
        mana: 60,
        cd: 5.0,
        range: 22,
        targetType: "point",
        desc: "Unleashes a twin-arc golden wave that scorches enemies in a line and leaves blazing ground fissures.",
      },
      W: {
        name: "Sunfire War-Banner",
        tag: "ALLY AURA TOTEM",
        icon: "fa-angles-right",
        color: "text-yellow-200",
        bg: "from-yellow-800 via-amber-950 to-slate-950",
        mana: 50,
        cd: 7.0,
        range: 19,
        targetType: "point",
        desc: "Plants a towering 3D Golden War-Banner (8s) granting +30% Attack Speed, +25 ATK & +8 Armor to nearby allies!",
      },
      E: {
        name: "Aegis Bulwark",
        tag: "SHIELD + THORNS",
        icon: "fa-shield-halved",
        color: "text-cyan-300",
        bg: "from-cyan-900 via-teal-950 to-slate-950",
        mana: 75,
        cd: 9.0,
        range: 9.0,
        targetType: "self",
        desc: "Grants +240 Shield, +10 Armor, 65% thorns reflection, and pulses healing light to nearby allies.",
      },
      R: {
        name: "Orbital Sunbeam",
        tag: "3.0s BEAM ZONE",
        icon: "fa-sun",
        color: "text-amber-300",
        bg: "from-amber-500 via-rose-900 to-slate-950",
        mana: 120,
        cd: 18.0,
        range: 24,
        targetType: "point",
        desc: "Calls down a sustained 3.0s celestial pillar of sunlight that burns and slows enemies inside.",
      },
    },
  },
  ignis: {
    id: "ignis",
    name: "Ignis",
    shortName: "IGNIS",
    title: "Pyromancer Empress",
    archetype: "Phoenix Empress • Burst Mage",
    passive: {
      name: "Fiery Soul",
      desc: "Casting any spell grants stacking +18% Attack Speed & +7% Move Speed for 5s (max 3 stacks).",
    },
    ratings: { offense: 10, defense: 4, mobility: 7, control: 6 },
    origin: "Cindervale Caldera",
    lore: "Born inside the volcanic glass spires of Cindervale, Ignis tamed the First Phoenix at age sixteen. She marches into the Confluence to prove that wildfire is the purest form of rebirth—and only ashes tell the truth.",
    attr: "Intelligence",
    rangeType: "Ranged",
    icon: "fa-fire",
    accentColor: "text-orange-400",
    badgeBg: "from-rose-800 via-orange-950 to-slate-950",
    primaryHex: 0xf97316,
    secondaryHex: 0xef4444,
    stats: {
      maxHp: 730,
      hpRegen: 5.0,
      maxMana: 540,
      manaRegen: 6.0,
      str: 18,
      agi: 19,
      int: 31,
      atkDamage: 66,
      atkRange: 12.6,
      atkCooldown: 0.88,
      moveSpeed: 12.7,
      armor: 5,
    },
    talents: {
      10: [
        {
          id: "ign_10_l",
          label: "+225 Max Health",
          apply: (h) => {
            h.maxHp += 225;
            h.hp += 225;
          },
        },
        {
          id: "ign_10_r",
          label: "+16 Intelligence & +5 Mana Regen",
          apply: (h) => {
            h.int += 16;
            h.maxMana += 220;
            h.mana += 220;
            h.manaRegen += 5;
          },
        },
      ],
      15: [
        {
          id: "ign_15_l",
          label: "+18% Spell Amplification",
          apply: (h) => {
            h.spellAmpBonus += 0.18;
          },
        },
        {
          id: "ign_15_r",
          label: "+40 Attack Damage & +30% Atk Spd",
          apply: (h) => {
            h.atkDamage += 40;
            h.atkSpeedMult += 0.3;
          },
        },
      ],
      20: [
        {
          id: "ign_20_l",
          label: "-22% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.78;
          },
        },
        {
          id: "ign_20_r",
          label: "+350 Max Health & +10 Armor",
          apply: (h) => {
            h.maxHp += 350;
            h.hp += 350;
            h.armor += 10;
          },
        },
      ],
      25: [
        {
          id: "ign_25_l",
          label: "Inferno Queen (+35% Spell Amp)",
          apply: (h) => {
            h.spellAmpBonus += 0.35;
          },
        },
        {
          id: "ign_25_r",
          label: "+160 Fiery Soul Attack Damage",
          apply: (h) => {
            h.atkDamage += 160;
          },
        },
      ],
    },
    voice: {
      pitch: 1.13,
      rate: 1.11,
      gender: "female",
      slotIdx: 0,
      archetype: "fiery",
      accentPref: "en-us",
      cadence: "fiery",
      motif: "ember_crackle",
      select: [
        "Ooh, things are heating up! Try to keep up!",
        "Hope they brought fireproof armor today!",
        "From ashes and wildfire, I rise!",
      ],
      moves: [
        "Watch your step, it’s hot!",
        "Ooh, let’s go!",
        "Sparking into action!",
        "Swift as wildfire!",
      ],
      attack: [
        "Burn to cinders!",
        "Feel the heat!",
        "Too hot to handle!",
      ],
      cast: {
        Q: ["Dragon Slave!", "Wave of wildfire!", "Incinerate them!"],
        W: [
          "Volcanic Eruption!",
          "Skyfire pillar!",
          "Watch your footing!",
        ],
        E: ["Cinder Rush!", "Trail of wildfire!", "Blazing faster!"],
        R: [
          "Laguna Railgun!",
          "High-voltage inferno!",
          "Nothing left but ash!",
        ],
      },
      kill: ["Haha! Reduced to ash!", "Ooh, that left a scorch mark!"],
      lowHp: [
        "My flames will never go out!",
        "Just a spark is all I need!",
      ],
      gold: ["Ooh, shiny treasure!", "More fuel for the fire!"],
      levelup: [
        "My flames burn brighter than ever!",
        "Unstoppable inferno!",
      ],
      buy: [
        "Ooh, this artifact radiates power!",
        "Now we’re really cooking!",
      ],
      respawn: ["Like a phoenix, I rise from the embers!"],
    },
    skills: {
      Q: {
        name: "Dragon Slave",
        tag: "TRIPLE SPREAD",
        icon: "fa-dragon",
        color: "text-orange-300",
        bg: "from-orange-800 via-red-950 to-slate-950",
        mana: 65,
        cd: 5.0,
        range: 24,
        targetType: "point",
        desc: "Unleashes a wide fan of 3 spiraling phoenix fireballs that pierce and scorch enemies.",
      },
      W: {
        name: "Volcanic Eruption",
        tag: "DELAYED GEYSER",
        icon: "fa-burst",
        color: "text-amber-300",
        bg: "from-amber-800 via-rose-950 to-slate-950",
        mana: 60,
        cd: 7.5,
        range: 22,
        targetType: "point",
        desc: "Cracks open a magma crater that erupts a twisting flame column & boulders after 0.3s (1.65s stun).",
      },
      E: {
        name: "Cinder Rush",
        tag: "FIRE TRAIL + HASTE",
        icon: "fa-fire-flame-simple",
        color: "text-rose-300",
        bg: "from-rose-900 via-orange-950 to-slate-950",
        mana: 70,
        cd: 8.5,
        range: 8.8,
        targetType: "self",
        desc: "Ignites +75% Attack Speed & +35% Move Speed while leaving a 5.0s burning wildfire carpet behind her!",
      },
      R: {
        name: "Laguna Railgun",
        tag: "PIERCING LASER",
        icon: "fa-bolt-lightning",
        color: "text-yellow-300",
        bg: "from-rose-600 via-amber-900 to-slate-950",
        mana: 130,
        cd: 17.0,
        range: 23,
        targetType: "point",
        desc: "Fires an instantaneous high-voltage crimson-gold railgun beam piercing all enemies in a line for massive burst!",
      },
    },
  },
  sylphira: {
    id: "sylphira",
    name: "Sylphira",
    shortName: "SYLPHIRA",
    title: "Frost Ranger",
    archetype: "Glacial Huntress • Trap Ranger",
    passive: {
      name: "Precision Focus",
      desc: "Gains +22% Bonus Attack Damage & +15% Crit Chance when no enemy is within 6.5m.",
    },
    ratings: { offense: 9, defense: 5, mobility: 8, control: 8 },
    origin: "Frostfall Reach",
    lore: "Warden of the Eternal Glaciers, Sylphira carved her recurve bow from the heart-ice of a slumbering Leviathan. When volcanic tremors began melting the northern peaks, she descended to the Confluence to freeze the war in its tracks.",
    attr: "Agility",
    rangeType: "Ranged",
    icon: "fa-snowflake",
    accentColor: "text-cyan-300",
    badgeBg: "from-sky-800 via-cyan-950 to-slate-950",
    primaryHex: 0x38bdf8,
    secondaryHex: 0x22d3ee,
    stats: {
      maxHp: 770,
      hpRegen: 5.2,
      maxMana: 430,
      manaRegen: 4.6,
      str: 19,
      agi: 31,
      int: 19,
      atkDamage: 70,
      atkRange: 13.2,
      atkCooldown: 0.78,
      moveSpeed: 13.5,
      armor: 7,
    },
    talents: {
      10: [
        {
          id: "syl_10_l",
          label: "+240 Max Health",
          apply: (h) => {
            h.maxHp += 240;
            h.hp += 240;
          },
        },
        {
          id: "syl_10_r",
          label: "+16 Agility & +2.0 Move Speed",
          apply: (h) => {
            h.agi += 16;
            h.atkDamage += 16;
            h.armor += 2.5;
            h.moveSpeed += 2.0;
          },
        },
      ],
      15: [
        {
          id: "syl_15_l",
          label: "+35% Attack Speed",
          apply: (h) => {
            h.atkSpeedMult += 0.35;
          },
        },
        {
          id: "syl_15_r",
          label: "+20% Lifesteal & +8 Armor",
          apply: (h) => {
            h.lifesteal += 0.2;
            h.armor += 8;
          },
        },
      ],
      20: [
        {
          id: "syl_20_l",
          label: "+25% Critical Strike (2.3x)",
          apply: (h) => {
            h.critChance += 0.25;
            h.critMult = Math.max(h.critMult, 2.3);
          },
        },
        {
          id: "syl_20_r",
          label: "-20% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.8;
          },
        },
      ],
      25: [
        {
          id: "syl_25_l",
          label: "Marksmanship (+95 ATK & +40% Atk Spd)",
          apply: (h) => {
            h.atkDamage += 95;
            h.atkSpeedMult += 0.4;
          },
        },
        {
          id: "syl_25_r",
          label: "+600 HP & +30% Spell Amp",
          apply: (h) => {
            h.maxHp += 600;
            h.hp += 600;
            h.spellAmpBonus += 0.3;
          },
        },
      ],
    },
    voice: {
      pitch: 1.15,
      rate: 0.99,
      gender: "female",
      slotIdx: 1,
      archetype: "ethereal",
      accentPref: "en-au",
      cadence: "crisp",
      motif: "ice_chime",
      select: [
        "Steady breath. One arrow is all it takes.",
        "Silent as snowfall, lethal as the blizzard.",
        "The frost winds guide my bow.",
      ],
      moves: [
        "Silent as winter.",
        "Swift as the gale.",
        "Onward through the frost.",
        "My aim is true.",
      ],
      attack: ["Piercing chill.", "Arrow away!", "Winter’s sting."],
      cast: {
        Q: [
          "Frost Volley!",
          "Seven shards of winter!",
          "Shatter their advance!",
        ],
        W: ["Gale Vortex!", "Be swept away!", "Howl, northern wind!"],
        E: ["Frost Trap set.", "Step carefully.", "Snared in ice!"],
        R: [
          "Absolute Zero!",
          "Frozen in crystal!",
          "Shatter where you stand!",
        ],
      },
      kill: ["Frozen in time.", "Cold precision."],
      lowHp: [
        "I will not fall so easily.",
        "The winter wind still carries me.",
      ],
      gold: ["Well earned.", "A hunter’s bounty."],
      levelup: [
        "The winter wind strengthens.",
        "My sight grows sharper still.",
      ],
      buy: ["A fine addition to my quiver.", "Precision meets power."],
      respawn: ["The frost never truly thaws."],
    },
    skills: {
      Q: {
        name: "Frost Volley",
        tag: "7-ARROW FAN",
        icon: "fa-snowflake",
        color: "text-cyan-200",
        bg: "from-cyan-800 via-sky-950 to-slate-950",
        mana: 55,
        cd: 4.8,
        range: 23,
        targetType: "point",
        desc: "Fires a 7-arrow piercing ice fan that chills and slows enemies by 55%.",
      },
      W: {
        name: "Gale Vortex Tornado",
        tag: "3D CYCLONE",
        icon: "fa-wind",
        color: "text-teal-200",
        bg: "from-teal-800 via-slate-900 to-slate-950",
        mana: 55,
        cd: 7.0,
        range: 18,
        targetType: "point",
        desc: "Launches a tall spinning 3D wind funnel that tosses enemies airborne and knocks them back!",
      },
      E: {
        name: "Frost Bear-Trap",
        tag: "SNARE TRAP (20s)",
        icon: "fa-feather-pointed",
        color: "text-sky-300",
        bg: "from-sky-900 via-indigo-950 to-slate-950",
        mana: 70,
        cd: 8.5,
        range: 9.0,
        targetType: "self",
        desc: "Places a crystalline Frost Trap on the ground (20s) that snaps shut on the first enemy to step on it, rooting them!",
      },
      R: {
        name: "Absolute Zero",
        tag: "ICE CRYSTAL PRISON",
        icon: "fa-icicles",
        color: "text-cyan-300",
        bg: "from-sky-600 via-blue-950 to-slate-950",
        mana: 115,
        cd: 18.0,
        range: 24,
        targetType: "point",
        desc: "Encases enemies in translucent 3D hexagonal Ice Crystal Prisons for 2.1s that shatter for heavy burst!",
      },
    },
  },
  malakor: {
    id: "malakor",
    name: "Malakor",
    shortName: "MALAKOR",
    title: "Dreadlord Necromancer",
    archetype: "Abyssal Butcher • Hook Dreadlord",
    passive: {
      name: "Flesh Heap",
      desc: "Permanently gains +28 Max HP & +1.5 ATK whenever an enemy hero or boss dies nearby.",
    },
    ratings: { offense: 8, defense: 8, mobility: 6, control: 9 },
    origin: "Nethergrave Abyss",
    lore: "Sovereign of the Nethergrave Ossuary, Malakor traded his mortal heartbeat for dominion over fallen souls. Wielding a scythe quenched in abyssal emerald fire, he enters the Confluence to harvest stray souls across the battlefield.",
    attr: "Strength / Int",
    rangeType: "Melee",
    icon: "fa-skull",
    accentColor: "text-emerald-400",
    badgeBg: "from-emerald-950 via-purple-950 to-slate-950",
    primaryHex: 0x10b981,
    secondaryHex: 0xa855f7,
    stats: {
      maxHp: 870,
      hpRegen: 5.8,
      maxMana: 450,
      manaRegen: 4.9,
      str: 26,
      agi: 18,
      int: 25,
      atkDamage: 70,
      atkRange: 3.7,
      atkCooldown: 0.94,
      moveSpeed: 12.6,
      armor: 7,
    },
    talents: {
      10: [
        {
          id: "mal_10_l",
          label: "+260 Max Health",
          apply: (h) => {
            h.maxHp += 260;
            h.hp += 260;
          },
        },
        {
          id: "mal_10_r",
          label: "+15 Intelligence & +12% Spell Amp",
          apply: (h) => {
            h.int += 15;
            h.spellAmpBonus += 0.12;
          },
        },
      ],
      15: [
        {
          id: "mal_15_l",
          label: "+22% Lifesteal & +8 Armor",
          apply: (h) => {
            h.lifesteal += 0.22;
            h.armor += 8;
          },
        },
        {
          id: "mal_15_r",
          label: "+35 Attack Damage",
          apply: (h) => {
            h.atkDamage += 35;
          },
        },
      ],
      20: [
        {
          id: "mal_20_l",
          label: "-22% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.78;
          },
        },
        {
          id: "mal_20_r",
          label: "+450 Max Health & +12 HP Regen",
          apply: (h) => {
            h.maxHp += 450;
            h.hp += 450;
            h.hpRegen += 12;
          },
        },
      ],
      25: [
        {
          id: "mal_25_l",
          label: "Soul Reaper (+35% Spell Amp)",
          apply: (h) => {
            h.spellAmpBonus += 0.35;
          },
        },
        {
          id: "mal_25_r",
          label: "Abyssal Titan (+800 HP & +85 ATK)",
          apply: (h) => {
            h.maxHp += 800;
            h.hp += 800;
            h.atkDamage += 85;
          },
        },
      ],
    },
    voice: {
      pitch: 0.85,
      rate: 0.87,
      gender: "male",
      slotIdx: 1,
      archetype: "dreadlord",
      accentPref: "en-gb",
      cadence: "menacing",
      motif: "abyss_growl",
      select: [
        "Come closer... my hook and cleaver are waiting.",
        "Kneel before the Butcher of the Nethergrave.",
        "No soul escapes my chain.",
      ],
      moves: [
        "Your soul is mine.",
        "Shadows advance.",
        "Dragging them to doom.",
        "I obey the abyss.",
      ],
      attack: ["Carve their flesh!", "Perish!", "Taste oblivion!"],
      cast: {
        Q: ["Get over here!", "Meat Hook!", "Reel them in!"],
        W: ["Dismember!", "Devour their essence!", "Nowhere to run!"],
        E: ["Plague Rot!", "Choke on the miasma!", "Breathe the abyss!"],
        R: [
          "Army of the Dead!",
          "Rise, my wraiths!",
          "Total annihilation!",
        ],
      },
      kill: [
        "Another soul harvested for the abyss.",
        "Fresh tribute for the dark throne.",
      ],
      lowHp: ["Death cannot claim its master!", "I am eternal!"],
      gold: [
        "Tribute for the underworld.",
        "Plunder for the dark throne.",
      ],
      levelup: ["Darkness consumes all!", "My dominion expands!"],
      buy: ["An artifact worthy of the Abyss.", "The cleaver hungers."],
      respawn: ["You cannot banish the darkness."],
    },
    skills: {
      Q: {
        name: "Butcher's Meat Hook",
        tag: "CHAIN PULL HOOK",
        icon: "fa-skull-crossbones",
        color: "text-emerald-300",
        bg: "from-emerald-900 via-slate-950 to-slate-950",
        mana: 60,
        cd: 5.0,
        range: 23,
        targetType: "point",
        desc: "Launches a barbed 3D iron hook & extending chain (26m) that latches onto the first enemy and reels them to Malakor!",
      },
      W: {
        name: "Dismember Bite",
        tag: "SOUL DEVOUR",
        icon: "fa-ghost",
        color: "text-purple-300",
        bg: "from-purple-900 via-slate-950 to-slate-950",
        mana: 55,
        cd: 7.2,
        range: 20,
        targetType: "point",
        desc: "Chomps an enemy in close range, suppressing them for 1.4s and healing Malakor for 100% of damage dealt!",
      },
      E: {
        name: "Plague Rot Cloud",
        tag: "TOXIC MIASMA",
        icon: "fa-biohazard",
        color: "text-lime-300",
        bg: "from-lime-900 via-emerald-950 to-slate-950",
        mana: 75,
        cd: 9.0,
        range: 9.2,
        targetType: "self",
        desc: "Emits a swirling emerald-violet poison miasma for 4.5s that deals heavy continuous DPS and slows foes 45%.",
      },
      R: {
        name: "Army of the Dead",
        tag: "3 SKELETON WRAITHS",
        icon: "fa-meteor",
        color: "text-rose-400",
        bg: "from-purple-700 via-rose-950 to-slate-950",
        mana: 125,
        cd: 18.5,
        range: 24,
        targetType: "point",
        desc: "Shatters the earth with a necromantic nova and raises 3 autonomous Skeleton Wraiths to hunt enemies (18s)!",
      },
    },
  },
  zephyros: {
    id: "zephyros",
    name: "Zephyros",
    shortName: "ZEPHYROS",
    title: "Storm Sovereign",
    archetype: "Tempest Djinn • Storm Caster",
    passive: {
      name: "Static Overload",
      desc: "After casting any spell, his next attack discharges chain lightning to 2 nearby foes (+55 dmg).",
    },
    ratings: { offense: 9, defense: 5, mobility: 9, control: 7 },
    origin: "Skyvault Sanctum",
    lore: "Crowned atop the floating thunder-spires of Skyvault, Zephyros binds living lightning inside his storm-conduit staff. He descends to the River of Souls to strike down any warlord who dares threaten the firmament.",
    attr: "Intelligence",
    rangeType: "Ranged",
    icon: "fa-bolt",
    accentColor: "text-sky-300",
    badgeBg: "from-blue-800 via-indigo-950 to-slate-950",
    primaryHex: 0x38bdf8,
    secondaryHex: 0xfacc15,
    stats: {
      maxHp: 750,
      hpRegen: 5.2,
      maxMana: 560,
      manaRegen: 6.4,
      str: 18,
      agi: 21,
      int: 32,
      atkDamage: 65,
      atkRange: 13.0,
      atkCooldown: 0.86,
      moveSpeed: 13.1,
      armor: 6,
    },
    talents: {
      10: [
        {
          id: "zep_10_l",
          label: "+240 Max Health",
          apply: (h) => {
            h.maxHp += 240;
            h.hp += 240;
          },
        },
        {
          id: "zep_10_r",
          label: "+16 Intelligence & +5.5 Mana Regen",
          apply: (h) => {
            h.int += 16;
            h.maxMana += 240;
            h.mana += 240;
            h.manaRegen += 5.5;
          },
        },
      ],
      15: [
        {
          id: "zep_15_l",
          label: "+20% Spell Amplification",
          apply: (h) => {
            h.spellAmpBonus += 0.2;
          },
        },
        {
          id: "zep_15_r",
          label: "+35% Attack Speed & +1.8 Speed",
          apply: (h) => {
            h.atkSpeedMult += 0.35;
            h.moveSpeed += 1.8;
          },
        },
      ],
      20: [
        {
          id: "zep_20_l",
          label: "-22% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.78;
          },
        },
        {
          id: "zep_20_r",
          label: "+380 Max Health & +10 Armor",
          apply: (h) => {
            h.maxHp += 380;
            h.hp += 380;
            h.armor += 10;
          },
        },
      ],
      25: [
        {
          id: "zep_25_l",
          label: "Tempest Lord (+38% Spell Amp)",
          apply: (h) => {
            h.spellAmpBonus += 0.38;
          },
        },
        {
          id: "zep_25_r",
          label: "Overcharged Bolts (+145 ATK)",
          apply: (h) => {
            h.atkDamage += 145;
          },
        },
      ],
    },
    voice: {
      pitch: 1.07,
      rate: 1.08,
      gender: "male",
      slotIdx: 2,
      archetype: "djinn",
      accentPref: "en-in",
      cadence: "energetic",
      motif: "thunder_snap",
      select: [
        "Haha! Ride the wind and watch the sparks fly!",
        "Thunder rolls across the skies — let the storm begin!",
        "Who dares challenge the Tempest Djinn?",
      ],
      moves: [
        "Swift as lightning!",
        "Riding the gale!",
        "Thunder follows!",
        "The storm advances!",
      ],
      attack: [
        "Strike like thunder!",
        "Feel the voltage!",
        "Skyfire upon you!",
      ],
      cast: {
        Q: ["Arc Lightning!", "Chain across them!", "High voltage!"],
        W: ["Ball Lightning!", "Ride the storm!", "Unstoppable surge!"],
        E: ["Static Remnant!", "Shocking surprise!", "Feel the charge!"],
        R: [
          "Thundergod’s Wrath!",
          "Heavens shatter!",
          "Nowhere is safe from the storm!",
        ],
      },
      kill: [
        "Struck down by the heavens!",
        "Nothing outruns the lightning!",
      ],
      lowHp: [
        "The storm refuses to yield!",
        "One spark is all it takes!",
      ],
      gold: ["Tempest tribute!", "Wealth of the skies!"],
      levelup: ["My storm grows boundless!", "Ascendant thunder!"],
      buy: ["A conductor of pure power!", "The tempest approves!"],
      respawn: ["Thunder always strikes twice!"],
    },
    skills: {
      Q: {
        name: "Arc Lightning",
        tag: "4-TARGET CHAIN",
        icon: "fa-bolt",
        color: "text-sky-300",
        bg: "from-sky-800 via-blue-950 to-slate-950",
        mana: 60,
        cd: 4.6,
        range: 24,
        targetType: "point",
        desc: "Fires a storm orb that chains jagged 3D lightning bolts across up to 4 nearby enemies.",
      },
      W: {
        name: "Ball Lightning",
        tag: "LIGHTNING DASH",
        icon: "fa-atom",
        color: "text-amber-300",
        bg: "from-blue-700 via-indigo-950 to-slate-950",
        mana: 65,
        cd: 7.2,
        range: 21,
        targetType: "point",
        desc: "Transforms into pure lightning, zipping to target spot and zapping every enemy along the flight path!",
      },
      E: {
        name: "Static Remnant",
        tag: "EXPLODING CLONE",
        icon: "fa-hurricane",
        color: "text-cyan-300",
        bg: "from-cyan-900 via-blue-950 to-slate-950",
        mana: 70,
        cd: 8.5,
        range: 9.5,
        targetType: "self",
        desc: "Leaves an overcharged Electric Storm Clone (9s) that detonates in a lightning blast when an enemy approaches.",
      },
      R: {
        name: "Thundergod's Wrath",
        tag: "GLOBAL LIGHTNING",
        icon: "fa-cloud-bolt",
        color: "text-yellow-300",
        bg: "from-sky-600 via-indigo-950 to-slate-950",
        mana: 130,
        cd: 17.5,
        range: 25,
        targetType: "point",
        desc: "Calls down sky-shattering lightning onto the target zone AND every enemy hero across the entire map!",
      },
    },
  },
  vespera: {
    id: "vespera",
    name: "Vespera",
    shortName: "VESPERA",
    title: "Void Phantom",
    archetype: "Void Phantom • Stealth Assassin",
    passive: {
      name: "Backstab Ambush",
      desc: "Basic attacks striking from behind an enemy deal +35% bonus critical damage.",
    },
    ratings: { offense: 10, defense: 5, mobility: 10, control: 6 },
    origin: "Umbral Veil",
    lore: "Trained by the Silent Sisters of the Umbral Veil, Vespera stepped between dimensions during a lunar eclipse and emerged half-shadow. Armed with twin void-crystal daggers, she erases high-value targets before their guards can blink.",
    attr: "Agility",
    rangeType: "Melee",
    icon: "fa-moon",
    accentColor: "text-fuchsia-300",
    badgeBg: "from-purple-900 via-fuchsia-950 to-slate-950",
    primaryHex: 0xd946ef,
    secondaryHex: 0xf43f5e,
    stats: {
      maxHp: 785,
      hpRegen: 5.5,
      maxMana: 410,
      manaRegen: 4.5,
      str: 20,
      agi: 33,
      int: 18,
      atkDamage: 74,
      atkRange: 3.7,
      atkCooldown: 0.76,
      moveSpeed: 13.7,
      armor: 8,
    },
    talents: {
      10: [
        {
          id: "ves_10_l",
          label: "+240 Max Health",
          apply: (h) => {
            h.maxHp += 240;
            h.hp += 240;
          },
        },
        {
          id: "ves_10_r",
          label: "+16 Agility & +2.2 Move Speed",
          apply: (h) => {
            h.agi += 16;
            h.atkDamage += 16;
            h.armor += 2.5;
            h.moveSpeed += 2.2;
          },
        },
      ],
      15: [
        {
          id: "ves_15_l",
          label: "+40% Attack Speed",
          apply: (h) => {
            h.atkSpeedMult += 0.4;
          },
        },
        {
          id: "ves_15_r",
          label: "+24% Lifesteal & +8 Armor",
          apply: (h) => {
            h.lifesteal += 0.24;
            h.armor += 8;
          },
        },
      ],
      20: [
        {
          id: "ves_20_l",
          label: "+25% Critical Strike (2.5x)",
          apply: (h) => {
            h.critChance += 0.25;
            h.critMult = Math.max(h.critMult, 2.5);
          },
        },
        {
          id: "ves_20_r",
          label: "-22% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.78;
          },
        },
      ],
      25: [
        {
          id: "ves_25_l",
          label: "Coup de Grâce (+30% Crit 3.0x)",
          apply: (h) => {
            h.critChance += 0.3;
            h.critMult = 3.0;
          },
        },
        {
          id: "ves_25_r",
          label: "Shadow Sovereign (+95 ATK & +550 HP)",
          apply: (h) => {
            h.atkDamage += 95;
            h.maxHp += 550;
            h.hp += 550;
          },
        },
      ],
    },
    voice: {
      pitch: 1.03,
      rate: 1.07,
      gender: "female",
      slotIdx: 2,
      archetype: "assassin",
      accentPref: "en-ie",
      cadence: "whisper",
      motif: "void_whisper",
      select: [
        "Already behind you. Don’t blink.",
        "From the veiled abyss, my blades strike unseen.",
        "Shadows whisper your name.",
      ],
      moves: [
        "Unseen and unheard.",
        "Like a shadow in the night.",
        "Swift as a blade.",
        "Through the veil.",
      ],
      attack: [
        "Cut from the shadows.",
        "Fatal precision.",
        "Bleed into the void.",
      ],
      cast: {
        Q: ["Stifling Dagger.", "Nowhere to run.", "Venomous edge."],
        W: ["Phantom Ambush.", "Behind you.", "Shadow clone."],
        E: ["Umbral Smoke.", "Vanish into mist.", "Blind their eyes."],
        R: ["Shadow Dance!", "Oblivion awaits.", "Crimson eclipse."],
      },
      kill: ["Erased from existence.", "A clean execution."],
      lowHp: ["Shadows hide my wounds.", "I vanish before I fall."],
      gold: ["Bounty claimed.", "Silent plunder."],
      levelup: ["Sharper than ever.", "One with the void."],
      buy: ["Lethal craftsmanship.", "A fitting edge."],
      respawn: ["You cannot kill a phantom."],
    },
    skills: {
      Q: {
        name: "Stifling Dagger",
        tag: "CRIT + 60% SLOW",
        icon: "fa-khanda",
        color: "text-fuchsia-300",
        bg: "from-fuchsia-900 via-purple-950 to-slate-950",
        mana: 50,
        cd: 4.5,
        range: 23,
        targetType: "point",
        desc: "Hurls a spinning void-crystal dagger that pierces foes, slows 60% and deals guaranteed crit.",
      },
      W: {
        name: "Phantom Ambush",
        tag: "BLINK + CLONE",
        icon: "fa-user-ninja",
        color: "text-purple-300",
        bg: "from-purple-800 via-slate-950 to-slate-950",
        mana: 55,
        cd: 6.8,
        range: 20,
        targetType: "point",
        desc: "Shadow-teleports to target spot leaving a Shadow Clone behind, granting +85% Attack Speed & +30% Crit!",
      },
      E: {
        name: "Umbral Smoke Bomb",
        tag: "5.0s SMOKE CLOAK",
        icon: "fa-eye-slash",
        color: "text-pink-300",
        bg: "from-pink-950 via-purple-950 to-slate-950",
        mana: 65,
        cd: 8.5,
        range: 9.0,
        targetType: "self",
        desc: "Drops a dense 5.0s shadow smoke screen that slows foes inside while granting Vespera +45% speed & stealth!",
      },
      R: {
        name: "Shadow Dance Frenzy",
        tag: "EXECUTE + HASTE",
        icon: "fa-skull",
        color: "text-rose-400",
        bg: "from-rose-700 via-purple-950 to-slate-950",
        mana: 120,
        cd: 16.5,
        range: 22,
        targetType: "point",
        desc: "Enters Shadow Dance (+100% Atk Spd, +35% Lifesteal) while unleashing a lethal X-slash execute rift!",
      },
    },
  },
  terrakor: {
    id: "terrakor",
    name: "Terrakor",
    shortName: "TERRAKOR",
    title: "Earthshaker Titan",
    archetype: "Colossal Stone Golem • Bruiser",
    passive: {
      name: "Aftershock Tremor",
      desc: "Every ability cast emits a 4.8m seismic tremor dealing 45 + 1.4x STR damage & 0.35s stun.",
    },
    ratings: { offense: 7, defense: 10, mobility: 4, control: 10 },
    origin: "Nishai Crags",
    lore: "Forged from living jade-basalt and bound to the ancestral Runic Totem of Nishai, Terrakor hears the heartbeat of the continent itself. Every slam of his totem reshapes the battlefield in defense of the natural realm.",
    attr: "Strength",
    rangeType: "Melee",
    icon: "fa-mountain",
    accentColor: "text-emerald-300",
    badgeBg: "from-emerald-900 via-stone-900 to-slate-950",
    primaryHex: 0x34d399,
    secondaryHex: 0xf59e0b,
    stats: {
      maxHp: 960,
      hpRegen: 7.0,
      maxMana: 390,
      manaRegen: 4.2,
      str: 31,
      agi: 15,
      int: 18,
      atkDamage: 75,
      atkRange: 3.8,
      atkCooldown: 0.96,
      moveSpeed: 12.5,
      armor: 10,
    },
    talents: {
      10: [
        {
          id: "ter_10_l",
          label: "+320 Max Health",
          apply: (h) => {
            h.maxHp += 320;
            h.hp += 320;
          },
        },
        {
          id: "ter_10_r",
          label: "+32 Attack Damage",
          apply: (h) => {
            h.atkDamage += 32;
          },
        },
      ],
      15: [
        {
          id: "ter_15_l",
          label: "+12 Armor & +10 HP Regen",
          apply: (h) => {
            h.armor += 12;
            h.hpRegen += 10;
          },
        },
        {
          id: "ter_15_r",
          label: "+18% Spell Amp & -15% CDs",
          apply: (h) => {
            h.spellAmpBonus += 0.18;
            h.cdrMult *= 0.85;
          },
        },
      ],
      20: [
        {
          id: "ter_20_l",
          label: "+500 Max Health & +20% Lifesteal",
          apply: (h) => {
            h.maxHp += 500;
            h.hp += 500;
            h.lifesteal += 0.2;
          },
        },
        {
          id: "ter_20_r",
          label: "+25% Critical Strike (2.3x)",
          apply: (h) => {
            h.critChance += 0.25;
            h.critMult = Math.max(h.critMult, 2.3);
          },
        },
      ],
      25: [
        {
          id: "ter_25_l",
          label: "Tectonic Colossus (+900 HP & +14 Armor)",
          apply: (h) => {
            h.maxHp += 900;
            h.hp += 900;
            h.armor += 14;
          },
        },
        {
          id: "ter_25_r",
          label: "Echo Titan (+35% Spell Amp & +75 ATK)",
          apply: (h) => {
            h.spellAmpBonus += 0.35;
            h.atkDamage += 75;
          },
        },
      ],
    },
    voice: {
      pitch: 0.84,
      rate: 0.83,
      gender: "male",
      slotIdx: 3,
      archetype: "golem",
      accentPref: "en-za",
      cadence: "stately",
      motif: "stone_rumble",
      select: [
        "Step by step... even mountains move.",
        "The earth trembles with every stride I take.",
        "By stone and runic totem, none shall pass.",
      ],
      moves: [
        "Shake the ground.",
        "Steady as bedrock.",
        "Forward like an avalanche.",
        "The earth moves.",
      ],
      attack: [
        "Feel the totem!",
        "Shatter their bones!",
        "Tectonic crush!",
      ],
      cast: {
        Q: ["Fissure Wall!", "Split the earth!", "Stone wall rises!"],
        W: ["Enchant Totem!", "Runic power!", "Earth-shattering strike!"],
        E: [
          "Tectonic Magnetize!",
          "Pull them in!",
          "Gravity crushes all!",
        ],
        R: ["Echo Slam!", "Slam the arena!", "Earthquake!"],
      },
      kill: ["Buried beneath the rubble.", "A seismic victory."],
      lowHp: ["Mountains do not crumble easily.", "I stand unmoved."],
      gold: ["Gems of the deep.", "Solid gold."],
      levelup: ["The mountain grows taller.", "Seismic strength!"],
      buy: ["Heavy metal and stone.", "Forged in the deep."],
      respawn: ["The earth always endures."],
    },
    skills: {
      Q: {
        name: "Fissure Boulder Wall",
        tag: "9-BOULDER WALL",
        icon: "fa-grip-lines",
        color: "text-emerald-300",
        bg: "from-emerald-900 via-stone-900 to-slate-950",
        mana: 65,
        cd: 5.5,
        range: 23,
        targetType: "point",
        desc: "Slams totem to raise an impassable 9-boulder Granite Wall (5.0s) that blocks movement & stuns foes!",
      },
      W: {
        name: "Enchant Totem",
        tag: "SEISMIC CRIT",
        icon: "fa-hammer",
        color: "text-amber-300",
        bg: "from-amber-900 via-stone-900 to-slate-950",
        mana: 50,
        cd: 6.5,
        range: 8.5,
        targetType: "self",
        desc: "Overcharges totem with a ground-rupture shockwave, granting +90 ATK & +40% Crit Chance.",
      },
      E: {
        name: "Tectonic Magnetize",
        tag: "GRAVITY PULL",
        icon: "fa-bullseye",
        color: "text-teal-300",
        bg: "from-teal-900 via-emerald-950 to-slate-950",
        mana: 70,
        cd: 8.8,
        range: 9.2,
        targetType: "self",
        desc: "Slams the earth to magnetically pull all enemies within 12m inward toward Terrakor and stun them!",
      },
      R: {
        name: "Echo Slam",
        tag: "MULTIPLICATIVE AOE",
        icon: "fa-earth-americas",
        color: "text-amber-400",
        bg: "from-emerald-700 via-amber-950 to-slate-950",
        mana: 125,
        cd: 18.0,
        range: 12.5,
        targetType: "self",
        desc: "Cataclysmic earthquake whose shockwaves echo multiplicatively off every nearby unit!",
      },
    },
  },
  aurelia: {
    id: "aurelia",
    name: "Aurelia",
    shortName: "AURELIA",
    title: "Celestial Valkyrie",
    archetype: "Seraphic Valkyrie • Support",
    passive: {
      name: "Seraphic Grace",
      desc: "Basic attacks restore +18 HP to Aurelia and the lowest-HP nearby ally.",
    },
    ratings: { offense: 8, defense: 7, mobility: 8, control: 7 },
    origin: "Aetherion Spire",
    lore: "First-born Seraph of the Aetherion Spire, Aurelia descended on wings of crystallized starlight when war engulfed the River of Souls. Her celestial spear both pierces darkness and mends the wounds of her comrades.",
    attr: "Strength",
    rangeType: "Ranged",
    icon: "fa-feather",
    accentColor: "text-amber-200",
    badgeBg: "from-amber-600 via-sky-950 to-slate-950",
    primaryHex: 0xfef08a,
    secondaryHex: 0x38bdf8,
    stats: {
      maxHp: 850,
      hpRegen: 6.2,
      maxMana: 450,
      manaRegen: 5.0,
      str: 25,
      agi: 22,
      int: 23,
      atkDamage: 69,
      atkRange: 11.8,
      atkCooldown: 0.85,
      moveSpeed: 13.2,
      armor: 8,
    },
    talents: {
      10: [
        {
          id: "val_10_l",
          label: "+260 Max Health",
          apply: (h) => {
            h.maxHp += 260;
            h.hp += 260;
          },
        },
        {
          id: "val_10_r",
          label: "+25 Attack Damage & +20% Atk Spd",
          apply: (h) => {
            h.atkDamage += 25;
            h.atkSpeedMult += 0.2;
          },
        },
      ],
      15: [
        {
          id: "val_15_l",
          label: "+10 Armor & +10 HP Regen",
          apply: (h) => {
            h.armor += 10;
            h.hpRegen += 10;
          },
        },
        {
          id: "val_15_r",
          label: "+20% Spell Amplification",
          apply: (h) => {
            h.spellAmpBonus += 0.2;
          },
        },
      ],
      20: [
        {
          id: "val_20_l",
          label: "-20% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.8;
          },
        },
        {
          id: "val_20_r",
          label: "+24% Critical Strike (2.2x)",
          apply: (h) => {
            h.critChance += 0.24;
            h.critMult = Math.max(h.critMult, 2.2);
          },
        },
      ],
      25: [
        {
          id: "val_25_l",
          label: "Seraphim Wings (+650 HP & +25% Lifesteal)",
          apply: (h) => {
            h.maxHp += 650;
            h.hp += 650;
            h.lifesteal += 0.25;
          },
        },
        {
          id: "val_25_r",
          label: "Starlight Fury (+85 ATK & +30% Spell Amp)",
          apply: (h) => {
            h.atkDamage += 85;
            h.spellAmpBonus += 0.3;
          },
        },
      ],
    },
    voice: {
      pitch: 1.11,
      rate: 0.95,
      gender: "female",
      slotIdx: 3,
      archetype: "noble",
      accentPref: "en-gb",
      cadence: "regal",
      motif: "seraph_harp",
      select: [
        "Fear not. Starlight watches over us.",
        "On wings of dawn, I descend to protect the realm.",
        "My celestial spear pierces all shadow.",
      ],
      moves: [
        "Wings of light.",
        "Swift as starfall.",
        "Justice soars.",
        "The heavens watch over us.",
      ],
      attack: [
        "Spear of dawn!",
        "Starlight strikes!",
        "Pierce the darkness!",
      ],
      cast: {
        Q: ["Celestial Lance!", "Radiant spear!", "Light pierces all!"],
        W: ["Purifying Ray!", "Heal the righteous!", "Beam of dawn!"],
        E: ["Seraphic Barrier!", "Grace of the heavens!", "Be restored!"],
        R: [
          "Guardian Angel!",
          "Wings of immortality!",
          "None shall fall today!",
        ],
      },
      kill: ["Banished to the astral plane.", "Light prevails."],
      lowHp: ["My wings still carry me.", "Grace sustains my spirit."],
      gold: ["Blessing of fortune.", "Radiant gold."],
      levelup: ["I ascend higher still!", "Celestial radiance!"],
      buy: ["A heavenly relic.", "Blessed steel."],
      respawn: ["A Valkyrie rises on golden wings."],
    },
    skills: {
      Q: {
        name: "Celestial Lance",
        tag: "PIERCE + HEAL",
        icon: "fa-location-arrow",
        color: "text-amber-200",
        bg: "from-amber-700 via-sky-950 to-slate-950",
        mana: 60,
        cd: 4.8,
        range: 24,
        targetType: "point",
        desc: "Hurls a blazing starlight spear that pierces enemies and pulses healing light to nearby allies.",
      },
      W: {
        name: "Purifying Light Ray",
        tag: "HEAL & BURN BEAM",
        icon: "fa-dove",
        color: "text-sky-200",
        bg: "from-sky-800 via-amber-950 to-slate-950",
        mana: 55,
        cd: 7.0,
        range: 20,
        targetType: "point",
        desc: "Fires a radiant beam that simultaneously heals allies in its path and scorches enemies hit!",
      },
      E: {
        name: "Seraphic Barrier",
        tag: "SHIELD + SANCTUARY",
        icon: "fa-sun",
        color: "text-yellow-200",
        bg: "from-yellow-800 via-teal-950 to-slate-950",
        mana: 75,
        cd: 9.0,
        range: 9.5,
        targetType: "self",
        desc: "Grants +250 Shield and creates a 5.0s golden sanctuary zone healing allies and burning foes.",
      },
      R: {
        name: "Guardian Angel Wings",
        tag: "+999 ARMOR AURA",
        icon: "fa-meteor",
        color: "text-amber-300",
        bg: "from-amber-500 via-sky-950 to-slate-950",
        mana: 125,
        cd: 17.5,
        range: 24,
        targetType: "point",
        desc: "Spreads 6 celestial wings, granting physical immunity (+999 Armor) & massive HP regen to nearby allies (4.5s)!",
      },
    },
  },

  /* ==================== 8 NEW CHAMPIONS (v80 CHRONICLE EXPANSION) ==================== */
  kaelthar: {
    id: "kaelthar",
    name: "Kael'Thar",
    shortName: "KAELTHAR",
    title: "Chrono Weaver",
    archetype: "Chrono Archmage • Time Lord",
    passive: {
      name: "Temporal Echo",
      desc: "Every 4th spell cast refunds 40% of its mana cost and trims all basic cooldowns by 1.2s.",
    },
    ratings: { offense: 8, defense: 5, mobility: 8, control: 10 },
    origin: "Astral Observatory",
    lore: "Former Grand Horologist of the Astral Observatory, Kael’Thar shattered the Hourglass of Eternity to avert a timeline where endless war consumed the stars. Now anchored between past and future, he bends seconds into weapons.",
    attr: "Intelligence",
    rangeType: "Ranged",
    icon: "fa-hourglass-half",
    accentColor: "text-cyan-300",
    badgeBg: "from-indigo-900 via-cyan-950 to-slate-950",
    primaryHex: 0x22d3ee,
    secondaryHex: 0xfacc15,
    stats: {
      maxHp: 745,
      hpRegen: 5.1,
      maxMana: 575,
      manaRegen: 6.6,
      str: 18,
      agi: 20,
      int: 33,
      atkDamage: 65,
      atkRange: 13.0,
      atkCooldown: 0.86,
      moveSpeed: 13.0,
      armor: 6,
    },
    talents: {
      10: [
        {
          id: "kae_10_l",
          label: "+240 Max Health",
          apply: (h) => {
            h.maxHp += 240;
            h.hp += 240;
          },
        },
        {
          id: "kae_10_r",
          label: "+16 Intelligence & +6 Mana Regen",
          apply: (h) => {
            h.int += 16;
            h.maxMana += 240;
            h.mana += 240;
            h.manaRegen += 6;
          },
        },
      ],
      15: [
        {
          id: "kae_15_l",
          label: "-20% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.8;
          },
        },
        {
          id: "kae_15_r",
          label: "+20% Spell Amplification",
          apply: (h) => {
            h.spellAmpBonus += 0.2;
          },
        },
      ],
      20: [
        {
          id: "kae_20_l",
          label: "+400 Max Health & +10 Armor",
          apply: (h) => {
            h.maxHp += 400;
            h.hp += 400;
            h.armor += 10;
          },
        },
        {
          id: "kae_20_r",
          label: "+45% Attack Speed & +90 ATK",
          apply: (h) => {
            h.atkSpeedMult += 0.45;
            h.atkDamage += 90;
          },
        },
      ],
      25: [
        {
          id: "kae_25_l",
          label: "Master of Eternity (+38% Spell Amp)",
          apply: (h) => {
            h.spellAmpBonus += 0.38;
          },
        },
        {
          id: "kae_25_r",
          label: "Chrono-Lord (-25% CDs & +500 Mana)",
          apply: (h) => {
            h.cdrMult *= 0.75;
            h.maxMana += 500;
            h.mana += 500;
          },
        },
      ],
    },
    voice: {
      pitch: 0.98,
      rate: 1.02,
      gender: "male",
      slotIdx: 4,
      archetype: "chrono",
      accentPref: "en-us",
      cadence: "measured",
      motif: "chrono_tick",
      select: [
        "Right on schedule. Let’s adjust the timeline.",
        "I have seen a thousand outcomes — in this one, we triumph.",
        "Every second belongs to my design.",
      ],
      moves: [
        "Ahead of schedule.",
        "Time flows onward.",
        "Step between the seconds.",
        "Destiny awaits.",
      ],
      attack: [
        "Your clock winds down.",
        "Out of time!",
        "Temporal fracture!",
      ],
      cast: {
        Q: ["Chronos Orb!", "Freeze in time!", "Stasis lock!"],
        W: ["Temporal Rewind!", "Undo the damage!", "Step back in time!"],
        E: [
          "Time Dilation!",
          "Slow to a crawl!",
          "Hours feel like years!",
        ],
        R: ["Chronosphere!", "Time stands still!", "Enter my domain!"],
      },
      kill: [
        "Erased from the timeline.",
        "Your final second has struck.",
      ],
      lowHp: ["Rewinding fate...", "My timeline is not yet finished!"],
      gold: ["Timeless fortune.", "An investment across eras."],
      levelup: ["My mastery over time deepens!", "Beyond mortal clocks!"],
      buy: ["A relic from a future age.", "Wisdom across timelines."],
      respawn: ["Death is merely a temporary loop."],
    },
    skills: {
      Q: {
        name: "Chronos Orb",
        tag: "STASIS LOCK",
        icon: "fa-hourglass-half",
        color: "text-cyan-300",
        bg: "from-cyan-800 via-indigo-950 to-slate-950",
        mana: 60,
        cd: 4.8,
        range: 24,
        targetType: "point",
        desc: "Launches a spinning golden hourglass orb that damages and locks enemies in 1.4s Time-Stasis.",
      },
      W: {
        name: "Temporal Rewind",
        tag: "TIME REWIND",
        icon: "fa-rotate-left",
        color: "text-amber-300",
        bg: "from-indigo-800 via-sky-950 to-slate-950",
        mana: 65,
        cd: 7.5,
        range: 20,
        targetType: "point",
        desc: "Rewinds Kael'Thar back in time, restoring 28% missing HP/Mana, trimming Q cooldown & leaving a clock-nova!",
      },
      E: {
        name: "Time Dilation Curse",
        tag: "65% TIME SLOW",
        icon: "fa-clock",
        color: "text-sky-200",
        bg: "from-sky-900 via-cyan-950 to-slate-950",
        mana: 70,
        cd: 8.8,
        range: 9.5,
        targetType: "self",
        desc: "Curses nearby enemies in a golden clockwork wave, slowing their attack & move speed by 65%!",
      },
      R: {
        name: "Chronosphere Dome",
        tag: "3.2s TIME STOP",
        icon: "fa-infinity",
        color: "text-amber-300",
        bg: "from-cyan-600 via-indigo-950 to-slate-950",
        mana: 135,
        cd: 18.5,
        range: 24,
        targetType: "point",
        desc: "Manifests a 3.2s Time-Stop Sphere freezing all enemies inside while Kael'Thar moves at +130% speed!",
      },
    },
  },
  valkyra: {
    id: "valkyra",
    name: "Valkyra",
    shortName: "VALKYRA",
    title: "Crimson Bloodreaver",
    archetype: "Crimson Berserker • Executioner",
    passive: {
      name: "Thirst for Blood",
      desc: "Gains +35% Move Speed & +30% Lifesteal when enemy heroes nearby drop below 50% HP.",
    },
    ratings: { offense: 9, defense: 8, mobility: 7, control: 6 },
    origin: "The Sunken Crypts",
    lore: "Once First Shield-Maiden of Sunspire, Valkyra was betrayed during the Siege of Ashfall and left in the Sunken Crypts. Drinking from the Sanguine Chalice, she rose with a twin-bladed blood-halberd that grows stronger with every wound.",
    attr: "Strength",
    rangeType: "Melee",
    icon: "fa-droplet",
    accentColor: "text-rose-400",
    badgeBg: "from-rose-900 via-red-950 to-slate-950",
    primaryHex: 0xf43f5e,
    secondaryHex: 0xfbbf24,
    stats: {
      maxHp: 930,
      hpRegen: 6.6,
      maxMana: 380,
      manaRegen: 4.1,
      str: 30,
      agi: 19,
      int: 16,
      atkDamage: 74,
      atkRange: 3.8,
      atkCooldown: 0.9,
      moveSpeed: 13.0,
      armor: 8,
    },
    talents: {
      10: [
        {
          id: "vkr_10_l",
          label: "+290 Max Health",
          apply: (h) => {
            h.maxHp += 290;
            h.hp += 290;
          },
        },
        {
          id: "vkr_10_r",
          label: "+30 Attack Damage",
          apply: (h) => {
            h.atkDamage += 30;
          },
        },
      ],
      15: [
        {
          id: "vkr_15_l",
          label: "+25% Lifesteal & +8 Armor",
          apply: (h) => {
            h.lifesteal += 0.25;
            h.armor += 8;
          },
        },
        {
          id: "vkr_15_r",
          label: "+38% Attack Speed",
          apply: (h) => {
            h.atkSpeedMult += 0.38;
          },
        },
      ],
      20: [
        {
          id: "vkr_20_l",
          label: "+25% Critical Strike (2.4x)",
          apply: (h) => {
            h.critChance += 0.25;
            h.critMult = Math.max(h.critMult, 2.4);
          },
        },
        {
          id: "vkr_20_r",
          label: "-20% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.8;
          },
        },
      ],
      25: [
        {
          id: "vkr_25_l",
          label: "Immortal Bloodlord (+800 HP & +30% Lifesteal)",
          apply: (h) => {
            h.maxHp += 800;
            h.hp += 800;
            h.lifesteal += 0.3;
          },
        },
        {
          id: "vkr_25_r",
          label: "Crimson Executioner (+90 ATK & +25% Spell Amp)",
          apply: (h) => {
            h.atkDamage += 90;
            h.spellAmpBonus += 0.25;
          },
        },
      ],
    },
    voice: {
      pitch: 0.93,
      rate: 1.06,
      gender: "female",
      slotIdx: 4,
      archetype: "berserker",
      accentPref: "en-za",
      cadence: "fierce",
      motif: "blood_pulse",
      select: [
        "No retreat! Victory is forged in battle!",
        "Through blood and iron, I claim my vengeance!",
        "No fortress can bar my cleaver!",
      ],
      moves: [
        "I scent battle ahead!",
        "Swift as spilled crimson!",
        "Forward to glory!",
        "None escape the Bloodreaver!",
      ],
      attack: [
        "Bleed for me!",
        "Taste crimson steel!",
        "Shatter their guard!",
      ],
      cast: {
        Q: ["Whirling Cleaver!", "Drink their vitality!", "Crimson arc!"],
        W: ["Crippling Axe!", "Slow them down!", "Bleed out!"],
        E: [
          "Bloodrage Frenzy!",
          "Pain fuels my strength!",
          "Unleash the fury!",
        ],
        R: [
          "Hemorrhage Guillotine!",
          "Sentence of blood!",
          "Off with their heads!",
        ],
      },
      kill: ["Another debt paid in crimson!", "Vitality claimed!"],
      lowHp: ["Wounds only make me fiercer!", "I refuse to fall!"],
      gold: ["Blood-gold earned!", "Spoils of conquest!"],
      levelup: ["My fury overflows!", "Stronger with every scar!"],
      buy: ["Tempered in blood and fire!", "A brutal weapon!"],
      respawn: ["The Sanguine Chalice denies death!"],
    },
    skills: {
      Q: {
        name: "Whirling Cleaver",
        tag: "SAWBLADE ARC",
        icon: "fa-droplet",
        color: "text-rose-300",
        bg: "from-rose-800 via-red-950 to-slate-950",
        mana: 55,
        cd: 4.8,
        range: 22,
        targetType: "point",
        desc: "Sweeps a razor crimson sawblade crescent that damages foes and heals Valkyra on every hit.",
      },
      W: {
        name: "Crippling Axe Throw",
        tag: "BLEED + 55% SLOW",
        icon: "fa-bolt-lightning",
        color: "text-amber-300",
        bg: "from-red-800 via-slate-950 to-slate-950",
        mana: 55,
        cd: 6.8,
        range: 20,
        targetType: "point",
        desc: "Hurls a spinning sanguine axe in a line, bleeding enemies for 4s and slowing them by 55%.",
      },
      E: {
        name: "Bloodrage Frenzy",
        tag: "SACRIFICE +85 ATK",
        icon: "fa-heart-pulse",
        color: "text-rose-200",
        bg: "from-rose-900 via-purple-950 to-slate-950",
        mana: 70,
        cd: 8.8,
        range: 9.2,
        targetType: "self",
        desc: "Sacrifices 10% current HP to gain +85 Attack Damage, +55% Attack Speed & +35% Lifesteal for 5s!",
      },
      R: {
        name: "Hemorrhage Guillotine",
        tag: "75% CD RESET KILL",
        icon: "fa-skull-crossbones",
        color: "text-rose-400",
        bg: "from-rose-600 via-red-950 to-slate-950",
        mana: 120,
        cd: 17.5,
        range: 23,
        targetType: "point",
        desc: "Drops a colossal crimson guillotine blade; immediately refunds 75% of its cooldown on kill!",
      },
    },
  },
  dravenor: {
    id: "dravenor",
    name: "Dravenor",
    shortName: "DRAVENOR",
    title: "Abyssal Warlock",
    archetype: "Demonologist Warlock • Summoner",
    passive: {
      name: "Soul Siphon",
      desc: "Restores +14 Mana & +18 HP whenever an enemy unit dies within 15m.",
    },
    ratings: { offense: 9, defense: 6, mobility: 5, control: 9 },
    origin: "Obsidian Conclave",
    lore: "Exiled Grand Hierophant of the Obsidian Conclave, Dravenor bound three primordial void-beasts inside his chained grimoire. Every incantation he speaks tears open rifts of eldritch flame across the battlefield.",
    attr: "Intelligence",
    rangeType: "Ranged",
    icon: "fa-book-skull",
    accentColor: "text-purple-300",
    badgeBg: "from-purple-950 via-amber-950 to-slate-950",
    primaryHex: 0xa855f7,
    secondaryHex: 0xf97316,
    stats: {
      maxHp: 760,
      hpRegen: 5.4,
      maxMana: 555,
      manaRegen: 6.3,
      str: 20,
      agi: 17,
      int: 32,
      atkDamage: 67,
      atkRange: 12.8,
      atkCooldown: 0.88,
      moveSpeed: 12.6,
      armor: 6,
    },
    talents: {
      10: [
        {
          id: "drv_10_l",
          label: "+250 Max Health",
          apply: (h) => {
            h.maxHp += 250;
            h.hp += 250;
          },
        },
        {
          id: "drv_10_r",
          label: "+16 Intelligence & +5.5 Mana Regen",
          apply: (h) => {
            h.int += 16;
            h.maxMana += 230;
            h.mana += 230;
            h.manaRegen += 5.5;
          },
        },
      ],
      15: [
        {
          id: "drv_15_l",
          label: "+20% Spell Amplification",
          apply: (h) => {
            h.spellAmpBonus += 0.2;
          },
        },
        {
          id: "drv_15_r",
          label: "+22% Lifesteal & +8 Armor",
          apply: (h) => {
            h.lifesteal += 0.22;
            h.armor += 8;
          },
        },
      ],
      20: [
        {
          id: "drv_20_l",
          label: "-22% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.78;
          },
        },
        {
          id: "drv_20_r",
          label: "+420 Max Health & +12 HP Regen",
          apply: (h) => {
            h.maxHp += 420;
            h.hp += 420;
            h.hpRegen += 12;
          },
        },
      ],
      25: [
        {
          id: "drv_25_l",
          label: "Grimoire Unbound (+38% Spell Amp)",
          apply: (h) => {
            h.spellAmpBonus += 0.38;
          },
        },
        {
          id: "drv_25_r",
          label: "Eldritch Overlord (+650 HP & +120 ATK)",
          apply: (h) => {
            h.maxHp += 650;
            h.hp += 650;
            h.atkDamage += 120;
          },
        },
      ],
    },
    voice: {
      pitch: 0.87,
      rate: 0.9,
      gender: "male",
      slotIdx: 5,
      archetype: "dreadlord",
      accentPref: "en-ie",
      cadence: "ritual",
      motif: "warlock_chant",
      select: [
        "Fascinating... the pact demands a sacrifice.",
        "The grimoire opens, and the abyss answers.",
        "Forbidden incantations are written in their doom.",
      ],
      moves: [
        "The pact demands advance.",
        "Shadows whisper directions.",
        "By eldritch design.",
        "Into the breach.",
      ],
      attack: ["Eldritch bolt!", "Burn in void-fire!", "Curse upon you!"],
      cast: {
        Q: ["Shadow Word: Ruin!", "Wither and break!", "Void curse!"],
        W: ["Fatal Bonds!", "Share your agony!", "Bound in soul-chains!"],
        E: ["Soul Pact Drain!", "Feed my grimoire!", "Eldritch siphon!"],
        R: [
          "Rise, Infernal Golem!",
          "Descend from the seventh seal!",
          "Crush them, titan!",
        ],
      },
      kill: [
        "Another name inscribed in the grimoire.",
        "Consumed by the abyss.",
      ],
      lowHp: [
        "My dark pact sustains me.",
        "The abyss will not release me yet!",
      ],
      gold: ["Gold for forbidden reagents.", "Tribute accepted."],
      levelup: ["Another seal broken!", "My dark lore grows boundless!"],
      buy: ["A relic of immense occult potency.", "Splendid."],
      respawn: ["The grimoire always summons its master back."],
    },
    skills: {
      Q: {
        name: "Shadow Word: Ruin",
        tag: "CURSE CHAIN",
        icon: "fa-book-skull",
        color: "text-purple-300",
        bg: "from-purple-900 via-slate-950 to-slate-950",
        mana: 60,
        cd: 4.8,
        range: 24,
        targetType: "point",
        desc: "Hurls a cursed void-flame orb that chains dark sparks across nearby enemies and slows 50%.",
      },
      W: {
        name: "Fatal Bonds",
        tag: "SHARED DMG CHAINS",
        icon: "fa-meteor",
        color: "text-orange-300",
        bg: "from-purple-800 via-orange-950 to-slate-950",
        mana: 70,
        cd: 7.8,
        range: 22,
        targetType: "point",
        desc: "Links up to 4 enemies with glowing soul-chains (6s) so 35% of all damage taken is shared across all linked foes!",
      },
      E: {
        name: "Soul Pact Drain",
        tag: "MANA + HP SIPHON",
        icon: "fa-shield-halved",
        color: "text-fuchsia-300",
        bg: "from-fuchsia-950 via-purple-950 to-slate-950",
        mana: 65,
        cd: 8.8,
        range: 9.2,
        targetType: "self",
        desc: "Drains eldritch essence from enemies to restore +220 Mana and +180 HP instantly!",
      },
      R: {
        name: "Summon Infernal Golem",
        tag: "METEOR + TITAN",
        icon: "fa-fire-flame-curved",
        color: "text-amber-300",
        bg: "from-purple-700 via-amber-950 to-slate-950",
        mana: 135,
        cd: 18.5,
        range: 24,
        targetType: "point",
        desc: "Drops a flaming asteroid that transforms into a towering Fiery Infernal Golem (22s) to crush enemies!",
      },
    },
  },
  nyxia: {
    id: "nyxia",
    name: "Nyxia",
    shortName: "NYXIA",
    title: "Verdant Dryad",
    archetype: "Sylvan Stag-Dryad • Warden",
    passive: {
      name: "Photosynthesis",
      desc: "Standing in the river or near forest trees grants +12 HP/s, +8 Mana/s & +12% Move Speed.",
    },
    ratings: { offense: 8, defense: 6, mobility: 8, control: 9 },
    origin: "Silverleaf Canopy",
    lore: "Born from the first blossom of the ancient World-Root, Nyxia speaks with every leaf and river stone. When war-machines scarred the Silverleaf Canopy, she wove living emerald thorns into deadly arrows to defend the wild.",
    attr: "Agility",
    rangeType: "Ranged",
    icon: "fa-leaf",
    accentColor: "text-emerald-300",
    badgeBg: "from-emerald-800 via-lime-950 to-slate-950",
    primaryHex: 0x10b981,
    secondaryHex: 0xbef264,
    stats: {
      maxHp: 780,
      hpRegen: 5.6,
      maxMana: 440,
      manaRegen: 4.8,
      str: 20,
      agi: 31,
      int: 21,
      atkDamage: 69,
      atkRange: 13.1,
      atkCooldown: 0.8,
      moveSpeed: 13.6,
      armor: 7,
    },
    talents: {
      10: [
        {
          id: "nyx_10_l",
          label: "+250 Max Health",
          apply: (h) => {
            h.maxHp += 250;
            h.hp += 250;
          },
        },
        {
          id: "nyx_10_r",
          label: "+16 Agility & +2.0 Move Speed",
          apply: (h) => {
            h.agi += 16;
            h.atkDamage += 16;
            h.armor += 2.5;
            h.moveSpeed += 2.0;
          },
        },
      ],
      15: [
        {
          id: "nyx_15_l",
          label: "+36% Attack Speed",
          apply: (h) => {
            h.atkSpeedMult += 0.36;
          },
        },
        {
          id: "nyx_15_r",
          label: "+18% Spell Amp & +8 HP Regen",
          apply: (h) => {
            h.spellAmpBonus += 0.18;
            h.hpRegen += 8;
          },
        },
      ],
      20: [
        {
          id: "nyx_20_l",
          label: "+25% Critical Strike (2.3x)",
          apply: (h) => {
            h.critChance += 0.25;
            h.critMult = Math.max(h.critMult, 2.3);
          },
        },
        {
          id: "nyx_20_r",
          label: "-20% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.8;
          },
        },
      ],
      25: [
        {
          id: "nyx_25_l",
          label: "Avatar of the World-Root (+650 HP & +25% Lifesteal)",
          apply: (h) => {
            h.maxHp += 650;
            h.hp += 650;
            h.lifesteal += 0.25;
          },
        },
        {
          id: "nyx_25_r",
          label: "Briar Tempest (+95 ATK & +35% Atk Spd)",
          apply: (h) => {
            h.atkDamage += 95;
            h.atkSpeedMult += 0.35;
          },
        },
      ],
    },
    voice: {
      pitch: 1.17,
      rate: 1.04,
      gender: "female",
      slotIdx: 5,
      archetype: "ethereal",
      accentPref: "en-ie",
      cadence: "melodic",
      motif: "forest_flute",
      select: [
        "Listen! The leaves are singing for us!",
        "The World-Root whispers, and I answer with thorn and bloom.",
        "Every leaf in the forest fights beside us!",
      ],
      moves: [
        "Light as a falling leaf!",
        "The forest guides my stride.",
        "Swift through the canopy!",
        "Nature never falters.",
      ],
      attack: [
        "Feel the briar’s sting!",
        "Thorn away!",
        "Rooted in truth!",
      ],
      cast: {
        Q: [
          "Briar Seed Ricochet!",
          "Bounce through their ranks!",
          "Thorny bloom!",
        ],
        W: [
          "Briar Vine Snare!",
          "Rise, ancient roots!",
          "Hold them fast!",
        ],
        E: [
          "Enchanted Wisps!",
          "Be healed by the grove!",
          "Verdant grace!",
        ],
        R: [
          "Wrath of the World-Tree!",
          "The forest awakens!",
          "Nature’s fury!",
        ],
      },
      kill: ["Returned to the soil.", "The forest reclaims its own."],
      lowHp: ["The roots still anchor me!", "Nature mends my spirit!"],
      gold: ["Seeds of prosperity!", "A bountiful harvest!"],
      levelup: ["I bloom with primal power!", "The World-Root sings!"],
      buy: ["A treasure of earth and jade!", "How vibrant!"],
      respawn: ["Spring always follows winter!"],
    },
    skills: {
      Q: {
        name: "Briar Seed Ricochet",
        tag: "5-BOUNCE SEED",
        icon: "fa-leaf",
        color: "text-lime-300",
        bg: "from-emerald-800 via-lime-950 to-slate-950",
        mana: 55,
        cd: 4.6,
        range: 23,
        targetType: "point",
        desc: "Fires a living emerald thorn-seed that bounces up to 5 times between enemies with 60% slow!",
      },
      W: {
        name: "Briar Vine Snare",
        tag: "COILING VINES",
        icon: "fa-seedling",
        color: "text-emerald-300",
        bg: "from-emerald-900 via-teal-950 to-slate-950",
        mana: 60,
        cd: 7.4,
        range: 22,
        targetType: "point",
        desc: "Wraps enemies in coiling 3D thorny green vines at target spot, rooting them for 2.0s!",
      },
      E: {
        name: "Enchanted Wisps",
        tag: "3 HEALING WISPS",
        icon: "fa-spa",
        color: "text-teal-200",
        bg: "from-teal-900 via-emerald-950 to-slate-950",
        mana: 75,
        cd: 9.0,
        range: 9.5,
        targetType: "self",
        desc: "Releases 3 orbiting emerald forest wisps that continuously heal Nyxia and nearby allies over 5s!",
      },
      R: {
        name: "Wrath of the World-Tree",
        tag: "7 HOMING SPIRITS",
        icon: "fa-tree",
        color: "text-amber-300",
        bg: "from-emerald-600 via-lime-950 to-slate-950",
        mana: 125,
        cd: 17.5,
        range: 24,
        targetType: "point",
        desc: "Unleashes 7 homing emerald-gold forest spirits that strike enemies and return to heal Nyxia!",
      },
    },
  },
  thalindor: {
    id: "thalindor",
    name: "Thalindor",
    shortName: "THALINDOR",
    title: "Tide Sovereign",
    archetype: "Kraken Leviathan • Anchor Tank",
    passive: {
      name: "Kraken Shell",
      desc: "Purges stuns/slows and emits a 5.5m hydro-blast after taking 450 cumulative damage.",
    },
    ratings: { offense: 7, defense: 10, mobility: 6, control: 9 },
    origin: "Sunken Abyssal Trench",
    lore: "Immortal Leviathan-King of the Sunken Trench, Thalindor rose from the depths of the River of Souls when the Ancients’ war threatened to boil the seas. Wielding his three-pronged Abyssal Trident, he commands crushing tidal waves.",
    attr: "Strength",
    rangeType: "Melee",
    icon: "fa-water",
    accentColor: "text-cyan-300",
    badgeBg: "from-cyan-900 via-blue-950 to-slate-950",
    primaryHex: 0x06b6d4,
    secondaryHex: 0x38bdf8,
    stats: {
      maxHp: 945,
      hpRegen: 6.8,
      maxMana: 400,
      manaRegen: 4.3,
      str: 30,
      agi: 16,
      int: 19,
      atkDamage: 74,
      atkRange: 3.9,
      atkCooldown: 0.94,
      moveSpeed: 12.7,
      armor: 9,
    },
    talents: {
      10: [
        {
          id: "tha_10_l",
          label: "+300 Max Health",
          apply: (h) => {
            h.maxHp += 300;
            h.hp += 300;
          },
        },
        {
          id: "tha_10_r",
          label: "+30 Attack Damage",
          apply: (h) => {
            h.atkDamage += 30;
          },
        },
      ],
      15: [
        {
          id: "tha_15_l",
          label: "+12 Armor & +9 HP Regen",
          apply: (h) => {
            h.armor += 12;
            h.hpRegen += 9;
          },
        },
        {
          id: "tha_15_r",
          label: "+20% Spell Amp & -15% CDs",
          apply: (h) => {
            h.spellAmpBonus += 0.2;
            h.cdrMult *= 0.85;
          },
        },
      ],
      20: [
        {
          id: "tha_20_l",
          label: "+480 Max Health & +20% Lifesteal",
          apply: (h) => {
            h.maxHp += 480;
            h.hp += 480;
            h.lifesteal += 0.2;
          },
        },
        {
          id: "tha_20_r",
          label: "+24% Critical Strike (2.3x)",
          apply: (h) => {
            h.critChance += 0.24;
            h.critMult = Math.max(h.critMult, 2.3);
          },
        },
      ],
      25: [
        {
          id: "tha_25_l",
          label: "Leviathan Plate (+850 HP & +14 Armor)",
          apply: (h) => {
            h.maxHp += 850;
            h.hp += 850;
            h.armor += 14;
          },
        },
        {
          id: "tha_25_r",
          label: "Lord of the Maelstrom (+35% Spell Amp & +80 ATK)",
          apply: (h) => {
            h.spellAmpBonus += 0.35;
            h.atkDamage += 80;
          },
        },
      ],
    },
    voice: {
      pitch: 0.86,
      rate: 0.88,
      gender: "male",
      slotIdx: 6,
      archetype: "leviathan",
      accentPref: "en-au",
      cadence: "booming",
      motif: "ocean_swell",
      select: [
        "The tide turns... and none can hold back the sea.",
        "From the crushing depths, I bring the ocean’s wrath.",
        "Kneel before the Kraken Leviathan!",
      ],
      moves: [
        "Like an unstoppable wave.",
        "The deep advances.",
        "Crash upon their shores!",
        "Steady as the ocean floor.",
      ],
      attack: [
        "Feel the undertow!",
        "Trident strike!",
        "Crushed by the deep!",
      ],
      cast: {
        Q: ["Tidal Crush!", "Sweep them away!", "Roaring wave!"],
        W: ["Anchor Grapple!", "Reel myself in!", "Oceanic slam!"],
        E: ["Kraken Carapace!", "Unbreakable shell!", "Depth pressure!"],
        R: [
          "Ravage of the Deep!",
          "Awaken, leviathans!",
          "Drown their ranks!",
        ],
      },
      kill: ["Swept into the abyss.", "Claimed by the tide."],
      lowHp: ["The ocean endures all storms.", "I stand firm!"],
      gold: ["Sunken treasure.", "Tribute from the sea."],
      levelup: ["The tide swells higher!", "Deep-sea might!"],
      buy: ["Forged beneath crushing leagues.", "A worthy relic."],
      respawn: ["The tide always returns."],
    },
    skills: {
      Q: {
        name: "Tidal Crush",
        tag: "TSUNAMI PUSH",
        icon: "fa-water",
        color: "text-cyan-300",
        bg: "from-cyan-800 via-blue-950 to-slate-950",
        mana: 60,
        cd: 5.0,
        range: 22,
        targetType: "point",
        desc: "Unleashes a roaring tsunami wave that damages, slows 55%, and knocks back enemies.",
      },
      W: {
        name: "Leviathan Anchor Grapple",
        tag: "SELF-PULL HOOK",
        icon: "fa-angles-right",
        color: "text-sky-200",
        bg: "from-blue-800 via-cyan-950 to-slate-950",
        mana: 55,
        cd: 7.0,
        range: 20,
        targetType: "point",
        desc: "Fires a heavy 3D Sea-Anchor & Chain (24m) that latches onto target and winches Thalindor straight to them!",
      },
      E: {
        name: "Kraken Carapace",
        tag: "SHIELD + THORNS",
        icon: "fa-shield",
        color: "text-teal-300",
        bg: "from-teal-900 via-blue-950 to-slate-950",
        mana: 75,
        cd: 9.0,
        range: 9.2,
        targetType: "self",
        desc: "Hardens crustacean shell for +280 Shield, 65% thorns reflection, and a crushing hydro-pulse.",
      },
      R: {
        name: "Ravage of the Deep",
        tag: "9-GEYSER ERUPTION",
        icon: "fa-hurricane",
        color: "text-cyan-200",
        bg: "from-cyan-600 via-blue-950 to-slate-950",
        mana: 130,
        cd: 18.0,
        range: 12.5,
        targetType: "self",
        desc: "Slams anchor to erupt 9 towering hydrothermal geysers across 13m, stunning all foes for 1.9s!",
      },
    },
  },
  solenne: {
    id: "solenne",
    name: "Solenne",
    shortName: "SOLENNE",
    title: "Prism Archon",
    archetype: "Crystal Prism Construct • Illusionist",
    passive: {
      name: "Prismatic Refraction",
      desc: "Every 3rd basic attack fires a twin split-beam hitting a second nearby target for 65% damage.",
    },
    ratings: { offense: 9, defense: 5, mobility: 8, control: 8 },
    origin: "Astral Lighthouse",
    lore: "Keeper of the Astral Lighthouse, Solenne absorbed the focused beam of the First Eclipse to save her city from darkness. Transformed into a living prism of refracted starlight, she bends radiant geometry into blinding lances.",
    attr: "Intelligence",
    rangeType: "Ranged",
    icon: "fa-gem",
    accentColor: "text-pink-300",
    badgeBg: "from-pink-800 via-sky-950 to-slate-950",
    primaryHex: 0xf472b6,
    secondaryHex: 0x38bdf8,
    stats: {
      maxHp: 740,
      hpRegen: 5.2,
      maxMana: 560,
      manaRegen: 6.4,
      str: 18,
      agi: 20,
      int: 32,
      atkDamage: 66,
      atkRange: 13.0,
      atkCooldown: 0.86,
      moveSpeed: 13.1,
      armor: 6,
    },
    talents: {
      10: [
        {
          id: "sol_10_l",
          label: "+240 Max Health",
          apply: (h) => {
            h.maxHp += 240;
            h.hp += 240;
          },
        },
        {
          id: "sol_10_r",
          label: "+16 Intelligence & +5.5 Mana Regen",
          apply: (h) => {
            h.int += 16;
            h.maxMana += 230;
            h.mana += 230;
            h.manaRegen += 5.5;
          },
        },
      ],
      15: [
        {
          id: "sol_15_l",
          label: "+20% Spell Amplification",
          apply: (h) => {
            h.spellAmpBonus += 0.2;
          },
        },
        {
          id: "sol_15_r",
          label: "+35% Attack Speed & +1.8 Speed",
          apply: (h) => {
            h.atkSpeedMult += 0.35;
            h.moveSpeed += 1.8;
          },
        },
      ],
      20: [
        {
          id: "sol_20_l",
          label: "-22% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.78;
          },
        },
        {
          id: "sol_20_r",
          label: "+380 Max Health & +10 Armor",
          apply: (h) => {
            h.maxHp += 380;
            h.hp += 380;
            h.armor += 10;
          },
        },
      ],
      25: [
        {
          id: "sol_25_l",
          label: "Starlight Prism (+38% Spell Amp)",
          apply: (h) => {
            h.spellAmpBonus += 0.38;
          },
        },
        {
          id: "sol_25_r",
          label: "Refracted Lances (+140 ATK)",
          apply: (h) => {
            h.atkDamage += 140;
          },
        },
      ],
    },
    voice: {
      pitch: 1.14,
      rate: 0.97,
      gender: "female",
      slotIdx: 6,
      archetype: "prism",
      accentPref: "en-ca",
      cadence: "crystalline",
      motif: "prism_chord",
      select: [
        "Every ray aligns. See the truth in the light.",
        "In crystal clarity, darkness cannot hide.",
        "Behold the brilliance of the Astral Lighthouse!",
      ],
      moves: [
        "Swift as a beam of light.",
        "Illuminating the path.",
        "Crystal clear.",
        "Grace in every refraction.",
      ],
      attack: [
        "Refract and shatter!",
        "Starlight lance!",
        "Blinding brilliance!",
      ],
      cast: {
        Q: ["Refracting Laser!", "Split the spectrum!", "Crystal focus!"],
        W: [
          "Crystal Hallucination!",
          "See double!",
          "Mirror reflections!",
        ],
        E: ["Solar Blind Flash!", "Dazzling light!", "Eyes averted!"],
        R: [
          "Supernova Array!",
          "Focus the prisms!",
          "Blinding supernova!",
        ],
      },
      kill: ["Dissolved into pure light.", "A dazzling finish."],
      lowHp: ["My prism still shines bright.", "Light cannot be broken!"],
      gold: ["Glistening gold.", "A radiant reward."],
      levelup: ["My spectrum expands!", "Ever brighter!"],
      buy: ["A flawless crystal artifact.", "Magnificent!"],
      respawn: ["Starlight travels across eternity."],
    },
    skills: {
      Q: {
        name: "Refracting Prism Laser",
        tag: "3-WAY SPLIT BEAM",
        icon: "fa-gem",
        color: "text-pink-300",
        bg: "from-pink-800 via-sky-950 to-slate-950",
        mana: 60,
        cd: 4.6,
        range: 24,
        targetType: "point",
        desc: "Fires a razor starlight laser that splits into 3 refracted secondary beams upon hitting an enemy!",
      },
      W: {
        name: "Crystal Hallucination",
        tag: "2 MIRROR CLONES",
        icon: "fa-sparkles",
        color: "text-sky-200",
        bg: "from-sky-800 via-pink-950 to-slate-950",
        mana: 55,
        cd: 7.0,
        range: 20,
        targetType: "point",
        desc: "Summons 2 holographic 3D Mirror Clones (11s) around Solenne that fire prism bolts at enemies!",
      },
      E: {
        name: "Solar Blind Flash",
        tag: "BLIND CONE",
        icon: "fa-shield-halved",
        color: "text-amber-200",
        bg: "from-pink-900 via-indigo-950 to-slate-950",
        mana: 75,
        cd: 9.0,
        range: 9.5,
        targetType: "self",
        desc: "Emits a dazzling prism flash cone that scorches enemies and reduces their attack damage by 55% for 4s!",
      },
      R: {
        name: "Supernova Prism Array",
        tag: "3-PRISM TRIANGLE",
        icon: "fa-sun",
        color: "text-pink-200",
        bg: "from-pink-600 via-sky-950 to-slate-950",
        mana: 130,
        cd: 18.0,
        range: 24,
        targetType: "point",
        desc: "Deploys 3 floating mirror prisms firing a converging crossfire laser triangle before a supernova blast!",
      },
    },
  },
  garrick: {
    id: "garrick",
    name: "Garrick",
    shortName: "GARRICK",
    title: "Ironclad Juggernaut",
    archetype: "Dwarven Mech-Forgemaster",
    passive: {
      name: "Blade Dance",
      desc: "Grants a 24% passive chance to perform a whirlwind double-slash dealing 185% critical damage.",
    },
    ratings: { offense: 9, defense: 9, mobility: 7, control: 7 },
    origin: "Deepforge Bastion",
    lore: "Grand Forgemaster of Deepforge Bastion, Garrick clad himself in meteoric dwarf-steel powered by a living magma heart. When marauding warbands besieged the mountain gates, he held the bridge alone for seven days and nights.",
    attr: "Strength",
    rangeType: "Melee",
    icon: "fa-gavel",
    accentColor: "text-amber-300",
    badgeBg: "from-stone-800 via-amber-950 to-slate-950",
    primaryHex: 0xfb923c,
    secondaryHex: 0xfacc15,
    stats: {
      maxHp: 955,
      hpRegen: 6.9,
      maxMana: 380,
      manaRegen: 4.0,
      str: 31,
      agi: 17,
      int: 16,
      atkDamage: 76,
      atkRange: 3.7,
      atkCooldown: 0.92,
      moveSpeed: 12.7,
      armor: 10,
    },
    talents: {
      10: [
        {
          id: "gar_10_l",
          label: "+310 Max Health",
          apply: (h) => {
            h.maxHp += 310;
            h.hp += 310;
          },
        },
        {
          id: "gar_10_r",
          label: "+32 Attack Damage",
          apply: (h) => {
            h.atkDamage += 32;
          },
        },
      ],
      15: [
        {
          id: "gar_15_l",
          label: "+12 Armor & +10 HP Regen",
          apply: (h) => {
            h.armor += 12;
            h.hpRegen += 10;
          },
        },
        {
          id: "gar_15_r",
          label: "+38% Attack Speed",
          apply: (h) => {
            h.atkSpeedMult += 0.38;
          },
        },
      ],
      20: [
        {
          id: "gar_20_l",
          label: "+25% Critical Strike (2.4x)",
          apply: (h) => {
            h.critChance += 0.25;
            h.critMult = Math.max(h.critMult, 2.4);
          },
        },
        {
          id: "gar_20_r",
          label: "-20% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.8;
          },
        },
      ],
      25: [
        {
          id: "gar_25_l",
          label: "Meteoric Bastion (+900 HP & +14 Armor)",
          apply: (h) => {
            h.maxHp += 900;
            h.hp += 900;
            h.armor += 14;
          },
        },
        {
          id: "gar_25_r",
          label: "Master Forgemaster (+95 ATK & +25% Lifesteal)",
          apply: (h) => {
            h.atkDamage += 95;
            h.lifesteal += 0.25;
          },
        },
      ],
    },
    voice: {
      pitch: 0.88,
      rate: 0.98,
      gender: "male",
      slotIdx: 7,
      archetype: "dwarf",
      accentPref: "en-ie",
      cadence: "gruff",
      motif: "anvil_ring",
      select: [
        "Aye! Hot steel and a strong hammer, that’s all we need!",
        "By hammer and anvil, the Ironclad Forgemaster marches!",
        "Stoke the boilers — it is time to cleave!",
      ],
      moves: [
        "Full steam ahead!",
        "Heavy armor, heavier swing!",
        "Holding the line!",
        "Marching like an ironwall.",
      ],
      attack: [
        "Feel the anvil!",
        "Cleave them in two!",
        "Forge-fire strike!",
      ],
      cast: {
        Q: [
          "Bladestorm Whirlwind!",
          "Spinning steel!",
          "Cut through them all!",
        ],
        W: ["Molten Mortar!", "Fire in the hole!", "Slag incoming!"],
        E: [
          "Forge Healing Ward!",
          "Patch up the armor!",
          "Totem deployed!",
        ],
        R: [
          "Omnislash Cataclysm!",
          "Bladestorm fury!",
          "Unstoppable steel!",
        ],
      },
      kill: ["Hammered flat!", "Forged into victory!"],
      lowHp: ["My furnace still burns hot!", "Dwarf-steel holds strong!"],
      gold: ["Fine bullion for the forge!", "Solid gold!"],
      levelup: ["Tempered to perfection!", "The furnace roars louder!"],
      buy: ["Masterwork craftsmanship!", "Now that is proper steel!"],
      respawn: ["Reforged and ready for battle!"],
    },
    skills: {
      Q: {
        name: "Bladestorm Whirlwind",
        tag: "2.5s SPELL-IMMUNE",
        icon: "fa-fire",
        color: "text-amber-300",
        bg: "from-amber-800 via-stone-900 to-slate-950",
        mana: 55,
        cd: 4.8,
        range: 22,
        targetType: "point",
        desc: "Spins into a 2.5s moving cyclone of orange-gold slash ribbons granting spell immunity & rapid AoE hits!",
      },
      W: {
        name: "Molten Slag Mortar",
        tag: "BURNING LAVA POOL",
        icon: "fa-angles-right",
        color: "text-orange-300",
        bg: "from-orange-800 via-stone-900 to-slate-950",
        mana: 55,
        cd: 7.0,
        range: 20,
        targetType: "point",
        desc: "Launches a lobbed magma shell that explodes into a persistent 4.5s burning lava pool!",
      },
      E: {
        name: "Forge Healing Ward",
        tag: "REPAIR TOTEM (8s)",
        icon: "fa-shield-halved",
        color: "text-amber-200",
        bg: "from-amber-900 via-red-950 to-slate-950",
        mana: 75,
        cd: 9.0,
        range: 9.2,
        targetType: "self",
        desc: "Deploys a hovering Runic Anvil Totem (8s) that pulses golden repair waves healing nearby allies!",
      },
      R: {
        name: "Omnislash Cataclysm",
        tag: "6-SLASH BLITZ",
        icon: "fa-khanda",
        color: "text-amber-300",
        bg: "from-orange-600 via-amber-950 to-slate-950",
        mana: 125,
        cd: 17.5,
        range: 22,
        targetType: "point",
        desc: "Teleports rapidly across 6 consecutive invulnerable critical slashes with molten X-blades!",
      },
    },
  },
  seraphina: {
    id: "seraphina",
    name: "Seraphina",
    shortName: "SERAPHINA",
    title: "Twilight Oracle",
    archetype: "Twin-Moon Celestial Dancer",
    passive: {
      name: "Lunar Rhythm",
      desc: "Alternating between spells and attacks empowers her next attack with +60 astral dmg & 30% slow.",
    },
    ratings: { offense: 9, defense: 6, mobility: 8, control: 9 },
    origin: "Twin-Moon Sanctum",
    lore: "Blindfolded seeress of the Twin-Moon Sanctum, Seraphina perceives the battlefield through the gravitational song of her orbiting astral chakrams. She enters the Confluence to preserve cosmic equilibrium between Sun and Abyss.",
    attr: "Agility",
    rangeType: "Ranged",
    icon: "fa-circle-notch",
    accentColor: "text-teal-300",
    badgeBg: "from-teal-900 via-indigo-950 to-slate-950",
    primaryHex: 0x2dd4bf,
    secondaryHex: 0xfef08a,
    stats: {
      maxHp: 775,
      hpRegen: 5.4,
      maxMana: 460,
      manaRegen: 5.0,
      str: 19,
      agi: 32,
      int: 22,
      atkDamage: 70,
      atkRange: 13.0,
      atkCooldown: 0.79,
      moveSpeed: 13.5,
      armor: 7,
    },
    talents: {
      10: [
        {
          id: "ser_10_l",
          label: "+245 Max Health",
          apply: (h) => {
            h.maxHp += 245;
            h.hp += 245;
          },
        },
        {
          id: "ser_10_r",
          label: "+16 Agility & +2.0 Move Speed",
          apply: (h) => {
            h.agi += 16;
            h.atkDamage += 16;
            h.armor += 2.5;
            h.moveSpeed += 2.0;
          },
        },
      ],
      15: [
        {
          id: "ser_15_l",
          label: "+38% Attack Speed",
          apply: (h) => {
            h.atkSpeedMult += 0.38;
          },
        },
        {
          id: "ser_15_r",
          label: "+20% Spell Amp & +20% Lifesteal",
          apply: (h) => {
            h.spellAmpBonus += 0.2;
            h.lifesteal += 0.2;
          },
        },
      ],
      20: [
        {
          id: "ser_20_l",
          label: "+25% Critical Strike (2.4x)",
          apply: (h) => {
            h.critChance += 0.25;
            h.critMult = Math.max(h.critMult, 2.4);
          },
        },
        {
          id: "ser_20_r",
          label: "-20% Ability Cooldowns",
          apply: (h) => {
            h.cdrMult *= 0.8;
          },
        },
      ],
      25: [
        {
          id: "ser_25_l",
          label: "Twin-Moon Avatar (+95 ATK & +40% Atk Spd)",
          apply: (h) => {
            h.atkDamage += 95;
            h.atkSpeedMult += 0.4;
          },
        },
        {
          id: "ser_25_r",
          label: "Astral Equilibrium (+600 HP & +32% Spell Amp)",
          apply: (h) => {
            h.maxHp += 600;
            h.hp += 600;
            h.spellAmpBonus += 0.32;
          },
        },
      ],
    },
    voice: {
      pitch: 1.1,
      rate: 0.91,
      gender: "female",
      slotIdx: 7,
      archetype: "mystic",
      accentPref: "en-gb",
      cadence: "mystic",
      motif: "lunar_bell",
      select: [
        "Softly now... the twin moons guide our dance.",
        "Fate is written in silver light and twilight shadow.",
        "Step softly; the stars are watching.",
      ],
      moves: [
        "Guided by moonlight.",
        "In perfect balance.",
        "Swift as twilight.",
        "The stars illuminate our path.",
      ],
      attack: ["Silver crescent.", "Lunar edge.", "Fate strikes."],
      cast: {
        Q: ["Twin Moon Chakrams.", "Arc and return.", "Crescent dance."],
        W: ["Astral Phase-Step.", "Cross the veil.", "Moonlit dash."],
        E: [
          "Astral Haste.",
          "Twilight sanctuary.",
          "Grace of the moons.",
        ],
        R: [
          "Black Hole Singularity.",
          "Gravity collapses.",
          "Drawn into the void.",
        ],
      },
      kill: ["The stars foretold your fall.", "Balance restored."],
      lowHp: [
        "The twilight veils my steps...",
        "Not yet is my thread cut.",
      ],
      gold: ["Silver and gold align.", "Fortune smiles."],
      levelup: ["A higher alignment.", "The twin moons shine brighter."],
      buy: ["A relic blessed by starlight.", "Exquisite."],
      respawn: ["The moon waxes anew."],
    },
    skills: {
      Q: {
        name: "Twin Moon Chakrams",
        tag: "DUAL BOOMERANG",
        icon: "fa-circle-notch",
        color: "text-teal-300",
        bg: "from-teal-800 via-indigo-950 to-slate-950",
        mana: 55,
        cd: 4.6,
        range: 23,
        targetType: "point",
        desc: "Hurls dual giant crescent chakrams that curve outward in wide arcs and boomerang back to Seraphina!",
      },
      W: {
        name: "Astral Phase-Step",
        tag: "TWILIGHT BLINK",
        icon: "fa-moon",
        color: "text-amber-200",
        bg: "from-indigo-800 via-teal-950 to-slate-950",
        mana: 55,
        cd: 6.8,
        range: 20,
        targetType: "point",
        desc: "Phases across the twilight veil to target spot, unleashing a lunar nova & boosting crit +30%.",
      },
      E: {
        name: "Astral Mana & Haste",
        tag: "ALLY MANA + SLOW",
        icon: "fa-shield-halved",
        color: "text-cyan-200",
        bg: "from-teal-900 via-slate-950 to-slate-950",
        mana: 70,
        cd: 8.8,
        range: 9.2,
        targetType: "self",
        desc: "Radiates a starlight pulse restoring +140 Mana & +30% speed to allies while slowing nearby foes!",
      },
      R: {
        name: "Black Hole Singularity",
        tag: "3.2s GRAVITY WELL",
        icon: "fa-star-and-crescent",
        color: "text-teal-200",
        bg: "from-teal-600 via-indigo-950 to-slate-950",
        mana: 125,
        cd: 17.5,
        range: 24,
        targetType: "point",
        desc: "Opens a pitch-black accretion singularity that pulls all enemies inward continuously before detonating!",
      },
    },
  },
};

let selectedHeroId = "aurelius";
let matchMode = "1v1";
let aiDifficulty = "veteran";

