/***********************************************************************
 * 2. EPIC DOTA 2 ANNOUNCER & EMOTIONAL VOICE ACTING ENGINE
 ***********************************************************************/
class VoiceAndSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.riverGain = null;
    this.rainGain = null;
    this.sfxEnabled = true;
    this.voiceEnabled = true;
    this.musicEnabled = true;
    this.musicVolumeScale = 1.0;
    this.sfxVolumeScale = 1.0;
    this.voiceVolumeScale = 1.0;
    this.musicGain = null;
    this.musicBus = null;
    this.musicStarted = false;
    this.musicMode = "intro";
    this.musicTrackPreference = "auto";
    this.combatIntensity = 0.28;
    this._musicStep = 0;
    this._musicTimer = null;
    this.initialized = false;
    this.lastHeroVoiceTime = 0;
    this.lastCategoryVoiceTime = new Map();
    this.speechEndsAt = 0;
    this.announcerSpeakingUntil = 0;
    this._isAnnouncerUtterance = false;
    this._announcerStartedAt = 0;
    this._announcerQueue = [];
    this._postAnnouncerHeroAction = null;
    this._announcerFallbackTimer = null;
    this.availableVoices = [];
    this._recentLines = new Map();
    this._activeUtter = null;
    this._speechQueueTimer = null;

    this.heroVoiceOverrides = {};
    if ("speechSynthesis" in window) {
      const loadVoices = () => {
        const vList = window.speechSynthesis.getVoices() || [];
        if (vList.length > 0) {
          this.availableVoices = vList;
          if (typeof window.refreshSettingsVoiceDropdown === "function") {
            window.refreshSettingsVoiceDropdown();
          }
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      [150, 500, 1400, 3000].forEach((ms) => setTimeout(loadVoices, ms));
    }

    const unlock = () => {
      this.ensure();
      if ("speechSynthesis" in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
  }

  ensure() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    // Gentle, slow-attack bus compressor (25ms attack prevents sub-cycle bass/timpani waveform distortion)
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 30;
    comp.ratio.value = 3;
    comp.attack.value = 0.025;
    comp.release.value = 0.35;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.sfxEnabled
      ? 0.8 * this.sfxVolumeScale
      : 0.0;
    comp.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.outNode = comp;

    // Smooth fade-in, low-pass damped cathedral reverb (prevents high-frequency white-noise fizz/clipping)
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.normalize = true;
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * 1.55);
    const fadeInSamples = Math.max(1, Math.floor(rate * 0.025));
    const impulse = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const envIn = Math.min(1.0, i / fadeInSamples);
        const envOut = Math.pow(1 - i / len, 2.8);
        data[i] = (Math.random() * 2 - 1) * envIn * envOut;
      }
    }
    this.reverbNode.buffer = impulse;
    this.reverbFilter = this.ctx.createBiquadFilter();
    this.reverbFilter.type = "lowpass";
    this.reverbFilter.frequency.value = 1750;
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = 0.18;
    this.reverbNode.connect(this.reverbFilter);
    this.reverbFilter.connect(this.reverbSend);
    this.reverbSend.connect(this.outNode);

    const sharedNoiseLen = this.ctx.sampleRate * 2;
    this.sharedNoiseBuffer = this.ctx.createBuffer(
      1,
      sharedNoiseLen,
      this.ctx.sampleRate,
    );
    const sharedNoiseData = this.sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < sharedNoiseLen; i++)
      sharedNoiseData[i] = Math.random() * 2 - 1;

    this.startAmbienceBeds();
    this.startAmbientOrchestralMusic();
    this.initialized = true;
  }

  _targetMusicGain() {
    return this.musicEnabled ? 0.145 * this.musicVolumeScale : 0.0;
  }

  setMusicEnabled(val) {
    this.musicEnabled = val;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(
        this._targetMusicGain(),
        this.ctx.currentTime,
        0.35,
      );
    }
  }

  setMusicTrackPreference(pref) {
    this.musicTrackPreference = pref || "auto";
    const sceneMode =
      typeof inHeroSelect !== "undefined" && !inHeroSelect
        ? "arena"
        : "intro";
    this.setMusicScene(sceneMode);
  }

  setMusicScene(mode) {
    const sceneMode = mode === "arena" ? "arena" : "intro";
    const nextMode =
      this.musicTrackPreference === "auto"
        ? sceneMode
        : this.musicTrackPreference;
    const changed = this.musicMode !== nextMode;
    this.musicMode = nextMode;
    if (!this.ctx) return;
    if (!this.musicStarted) {
      this.startAmbientOrchestralMusic();
      return;
    }
    if (changed) {
      if (this._musicTimer) {
        clearInterval(this._musicTimer);
        this._musicTimer = null;
      }
      this._musicStep = 0;
      if (this.musicGain && this.musicEnabled) {
        const now = this.ctx.currentTime;
        const tgt = this._targetMusicGain();
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setTargetAtTime(
          Math.min(0.03, tgt * 0.2),
          now,
          0.12,
        );
        this.musicGain.gain.setTargetAtTime(tgt, now + 0.35, 0.35);
      }
      this._runMusicScheduler();
    }
  }

  _computeCombatIntensity() {
    if (typeof inHeroSelect !== "undefined" && inHeroSelect) return 0.25;
    if (
      typeof playerHero === "undefined" ||
      !playerHero ||
      playerHero.dead
    )
      return 0.3;
    let tension = 0.22;
    const pPos = playerHero.mesh.position;
    if (playerHero.hp / Math.max(1, playerHero.maxHp) < 0.45)
      tension += 0.25;
    if (typeof units !== "undefined" && Array.isArray(units)) {
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (!u || u.dead || u === playerHero) continue;
        const d = u.mesh.position.distanceTo(pPos);
        if (d < 28 && u.team !== playerHero.team) {
          if (u.type === "hero") tension += 0.38;
          else if (
            u.type === "boss" ||
            u.type === "dragon" ||
            u.type === "kong" ||
            u.type === "redman" ||
            u.type === "sneakygolem"
          )
            tension += 0.42;
          else if (u.type === "tower" || u.type === "ancient")
            tension += 0.24;
          else tension += 0.05;
        }
      }
    }
    if (typeof escalationTier === "number" && escalationTier >= 4) {
      tension += Math.min(0.18, (escalationTier - 3) * 0.03);
    }
    return Math.min(1.0, Math.max(0.2, tension));
  }

  _createMusicPan(panVal) {
    if (typeof this.ctx.createStereoPanner === "function") {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-0.85, Math.min(0.85, panVal));
      return p;
    }
    return null;
  }

  _schedulePercussionHit(t, kind, vol = 0.1) {
    if (!this.ctx || !this.musicBus) return;
    if (kind === "timpani" || kind === "wardrum" || kind === "subkick") {
      const osc = this.ctx.createOscillator();
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = "sine";
      const startHz =
        kind === "wardrum" ? 98 : kind === "timpani" ? 82 : 70;
      const endHz =
        kind === "wardrum" ? 38 : kind === "timpani" ? 35 : 32;
      const dur = kind === "timpani" ? 0.72 : 0.48;
      osc.frequency.setValueAtTime(startHz, t);
      osc.frequency.exponentialRampToValueAtTime(endHz, t + dur * 0.85);
      filt.type = "lowpass";
      filt.frequency.setValueAtTime(240, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(filt);
      filt.connect(g);
      g.connect(this.musicBus);
      osc.onended = () => {
        try {
          osc.disconnect();
          filt.disconnect();
          g.disconnect();
        } catch (e) {}
      };
      osc.start(t);
      osc.stop(t + dur + 0.04);
    } else if (
      kind === "brush" ||
      kind === "cymbal" ||
      kind === "snare"
    ) {
      if (!this.sharedNoiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.sharedNoiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      const dur =
        kind === "cymbal" ? 1.15 : kind === "snare" ? 0.24 : 0.14;
      filt.type = kind === "snare" ? "bandpass" : "highpass";
      filt.frequency.setValueAtTime(kind === "snare" ? 1150 : 2800, t);
      if (kind === "snare") filt.Q.value = 1.1;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(
        vol,
        t + (kind === "cymbal" ? 0.18 : 0.012),
      );
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.musicBus);
      src.onended = () => {
        try {
          src.disconnect();
          filt.disconnect();
          g.disconnect();
        } catch (e) {}
      };
      src.start(t, Math.random() * 0.8, dur + 0.05);
    }
  }

  startAmbientOrchestralMusic() {
    if (this.musicStarted || !this.ctx) return;
    this.musicStarted = true;
    const sceneMode =
      typeof inHeroSelect !== "undefined" && !inHeroSelect
        ? "arena"
        : "intro";
    this.musicMode =
      this.musicTrackPreference === "auto"
        ? sceneMode
        : this.musicTrackPreference;

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this._targetMusicGain();
    this.musicGain.connect(this.outNode);

    const warmShelf = this.ctx.createBiquadFilter();
    warmShelf.type = "lowpass";
    warmShelf.frequency.value = 3800;
    warmShelf.Q.value = 0.55;
    warmShelf.connect(this.musicGain);
    this.musicBus = warmShelf;

    const delayNode = this.ctx.createDelay(1.0);
    delayNode.delayTime.value = 0.34;
    const delayFilt = this.ctx.createBiquadFilter();
    delayFilt.type = "lowpass";
    delayFilt.frequency.value = 1350;
    const delayFb = this.ctx.createGain();
    delayFb.gain.value = 0.24;
    const delayWet = this.ctx.createGain();
    delayWet.gain.value = 0.18;

    this.musicBus.connect(delayNode);
    delayNode.connect(delayFilt);
    delayFilt.connect(delayFb);
    delayFb.connect(delayNode);
    delayFilt.connect(delayWet);
    delayWet.connect(this.musicGain);

    if (this.reverbNode) {
      const mRev = this.ctx.createGain();
      mRev.gain.value = 0.3;
      this.musicBus.connect(mRev);
      mRev.connect(this.reverbNode);
    }

    this._runMusicScheduler();
  }

  _runMusicScheduler() {
    if (!this.ctx || !this.musicGain) return;
    if (!this.musicBus) this.musicBus = this.musicGain;
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }

    // 1. INTRO / CHAMPION ALTAR THEME: 8-Bar Symphonic A-Minor / Dorian Sovereign Overture
    const introProgressions = [
      {
        bass: 55.0, // A1
        chord: [110.0, 164.81, 220.0, 261.63, 329.63, 493.88],
        horn: [
          { f: 440.0, start: 0.0, dur: 1.45 },
          { f: 523.25, start: 1.5, dur: 1.35 },
          { f: 659.25, start: 2.9, dur: 1.5 },
        ],
        bell: [659.25, 880.0, 987.77, 1318.51, 987.77, 880.0],
        cymbal: false,
      },
      {
        bass: 43.65, // F1
        chord: [87.31, 130.81, 174.61, 220.0, 329.63, 392.0],
        horn: [
          { f: 587.33, start: 0.0, dur: 1.4 },
          { f: 523.25, start: 1.45, dur: 1.4 },
          { f: 440.0, start: 2.9, dur: 1.5 },
        ],
        bell: [523.25, 659.25, 880.0, 1046.5, 880.0, 659.25],
        cymbal: false,
      },
      {
        bass: 65.41, // C2
        chord: [130.81, 196.0, 261.63, 329.63, 392.0, 587.33],
        horn: [
          { f: 392.0, start: 0.0, dur: 1.45 },
          { f: 493.88, start: 1.5, dur: 1.35 },
          { f: 587.33, start: 2.9, dur: 1.5 },
        ],
        bell: [587.33, 783.99, 987.77, 1174.66, 987.77, 783.99],
        cymbal: false,
      },
      {
        bass: 49.0, // G1
        chord: [98.0, 146.83, 196.0, 246.94, 329.63, 392.0],
        horn: [
          { f: 659.25, start: 0.0, dur: 1.75 },
          { f: 587.33, start: 1.8, dur: 1.15 },
          { f: 493.88, start: 3.0, dur: 1.4 },
        ],
        bell: [587.33, 739.99, 987.77, 1174.66, 1318.51, 987.77],
        cymbal: true,
      },
      {
        bass: 73.42, // D2 (Phrase B Answer)
        chord: [146.83, 220.0, 261.63, 329.63, 440.0, 523.25],
        horn: [
          { f: 523.25, start: 0.0, dur: 1.35 },
          { f: 659.25, start: 1.4, dur: 1.45 },
          { f: 783.99, start: 2.9, dur: 1.5 },
        ],
        bell: [659.25, 783.99, 1046.5, 1318.51, 1046.5, 783.99],
        cymbal: false,
      },
      {
        bass: 65.41, // C2 (Am/C)
        chord: [130.81, 164.81, 220.0, 261.63, 329.63, 440.0],
        horn: [
          { f: 880.0, start: 0.0, dur: 1.65 },
          { f: 783.99, start: 1.7, dur: 1.2 },
          { f: 659.25, start: 2.95, dur: 1.45 },
        ],
        bell: [659.25, 880.0, 1046.5, 1318.51, 1174.66, 880.0],
        cymbal: false,
      },
      {
        bass: 43.65, // F1 (Fmaj7#11)
        chord: [87.31, 130.81, 174.61, 246.94, 329.63, 440.0],
        horn: [
          { f: 587.33, start: 0.0, dur: 1.45 },
          { f: 659.25, start: 1.5, dur: 1.35 },
          { f: 493.88, start: 2.9, dur: 1.5 },
        ],
        bell: [493.88, 659.25, 880.0, 987.77, 1318.51, 987.77],
        cymbal: false,
      },
      {
        bass: 82.41, // E2 (Cadence)
        chord: [123.47, 164.81, 246.94, 329.63, 415.3, 493.88],
        horn: [
          { f: 659.25, start: 0.0, dur: 1.9 },
          { f: 587.33, start: 1.95, dur: 1.05 },
          { f: 493.88, start: 3.05, dur: 1.35 },
        ],
        bell: [659.25, 830.61, 987.77, 1318.51, 1661.22, 1318.51],
        cymbal: true,
      },
    ];

    // 2. IN-GAME ARENA THEME: 8-Bar E-Minor / Dorian Dynamic Battle Score
    const arenaProgressions = [
      {
        bass: 82.41, // E2
        pulse: [82.41, 82.41, 123.47, 82.41, 98.0, 82.41, 123.47, 110.0],
        chord: [164.81, 246.94, 293.66, 369.99, 493.88],
        lead: [
          { f: 329.63, start: 0.18, dur: 0.9 },
          { f: 392.0, start: 1.12, dur: 0.85 },
          { f: 493.88, start: 2.02, dur: 1.65 },
        ],
        heroCounter: [
          { f: 659.25, start: 0.5, dur: 1.3 },
          { f: 739.99, start: 2.0, dur: 1.6 },
        ],
      },
      {
        bass: 65.41, // C2
        pulse: [65.41, 65.41, 98.0, 65.41, 82.41, 65.41, 98.0, 110.0],
        chord: [130.81, 196.0, 246.94, 329.63, 392.0],
        lead: [
          { f: 440.0, start: 0.15, dur: 0.9 },
          { f: 392.0, start: 1.1, dur: 0.9 },
          { f: 329.63, start: 2.05, dur: 1.65 },
        ],
        heroCounter: [
          { f: 587.33, start: 0.45, dur: 1.35 },
          { f: 493.88, start: 1.95, dur: 1.65 },
        ],
      },
      {
        bass: 110.0, // A2
        pulse: [
          110.0, 110.0, 164.81, 110.0, 130.81, 110.0, 164.81, 146.83,
        ],
        chord: [146.83, 220.0, 261.63, 392.0, 440.0],
        lead: [
          { f: 392.0, start: 0.18, dur: 0.85 },
          { f: 440.0, start: 1.08, dur: 0.85 },
          { f: 587.33, start: 1.98, dur: 1.7 },
        ],
        heroCounter: [
          { f: 659.25, start: 0.4, dur: 1.4 },
          { f: 783.99, start: 1.95, dur: 1.65 },
        ],
      },
      {
        bass: 123.47, // B2
        pulse: [
          123.47, 123.47, 185.0, 123.47, 146.83, 123.47, 164.81, 185.0,
        ],
        chord: [164.81, 246.94, 329.63, 369.99, 493.88],
        lead: [
          { f: 493.88, start: 0.15, dur: 1.0 },
          { f: 440.0, start: 1.2, dur: 0.85 },
          { f: 369.99, start: 2.1, dur: 1.6 },
        ],
        heroCounter: [
          { f: 739.99, start: 0.4, dur: 1.5 },
          { f: 659.25, start: 2.0, dur: 1.6 },
        ],
      },
      {
        bass: 82.41, // E2 (Phrase B)
        pulse: [
          82.41, 123.47, 164.81, 123.47, 98.0, 123.47, 146.83, 123.47,
        ],
        chord: [164.81, 246.94, 329.63, 392.0, 493.88],
        lead: [
          { f: 493.88, start: 0.15, dur: 0.85 },
          { f: 587.33, start: 1.05, dur: 0.85 },
          { f: 659.25, start: 1.95, dur: 1.75 },
        ],
        heroCounter: [
          { f: 783.99, start: 0.45, dur: 1.4 },
          { f: 880.0, start: 1.95, dur: 1.65 },
        ],
      },
      {
        bass: 61.74, // B1 (Gmaj7/B)
        pulse: [61.74, 98.0, 123.47, 98.0, 73.42, 98.0, 123.47, 110.0],
        chord: [146.83, 196.0, 246.94, 369.99, 440.0],
        lead: [
          { f: 587.33, start: 0.18, dur: 0.9 },
          { f: 493.88, start: 1.12, dur: 0.85 },
          { f: 440.0, start: 2.02, dur: 1.65 },
        ],
        heroCounter: [
          { f: 739.99, start: 0.4, dur: 1.45 },
          { f: 659.25, start: 1.95, dur: 1.65 },
        ],
      },
      {
        bass: 65.41, // C2 (Cmaj9)
        pulse: [65.41, 98.0, 130.81, 98.0, 82.41, 98.0, 130.81, 146.83],
        chord: [130.81, 196.0, 246.94, 293.66, 392.0],
        lead: [
          { f: 392.0, start: 0.15, dur: 0.85 },
          { f: 493.88, start: 1.05, dur: 0.85 },
          { f: 587.33, start: 1.95, dur: 1.75 },
        ],
        heroCounter: [
          { f: 659.25, start: 0.45, dur: 1.4 },
          { f: 783.99, start: 1.95, dur: 1.65 },
        ],
      },
      {
        bass: 61.74, // B1 (Cadence)
        pulse: [
          61.74, 123.47, 146.83, 123.47, 92.5, 123.47, 146.83, 164.81,
        ],
        chord: [146.83, 246.94, 311.13, 369.99, 493.88],
        lead: [
          { f: 493.88, start: 0.15, dur: 1.1 },
          { f: 440.0, start: 1.3, dur: 0.85 },
          { f: 329.63, start: 2.2, dur: 1.5 },
        ],
        heroCounter: [
          { f: 739.99, start: 0.45, dur: 1.5 },
          { f: 659.25, start: 2.05, dur: 1.6 },
        ],
      },
    ];

    // 3. MYSTIC / ANCIENT SANCTUARY THEME: 8-Bar D Dorian / Lydian Harp, Celesta & Solo Flute
    const mysticProgressions = [
      {
        bass: 73.42, // D2
        chord: [146.83, 220.0, 261.63, 329.63, 440.0],
        arp: [
          293.66, 349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 349.23,
        ],
        flute: [
          { f: 587.33, start: 0.3, dur: 1.85 },
          { f: 659.25, start: 2.3, dur: 2.1 },
        ],
      },
      {
        bass: 58.27, // Bb1
        chord: [116.54, 174.61, 220.0, 293.66, 392.0],
        arp: [
          233.08, 293.66, 349.23, 440.0, 587.33, 440.0, 349.23, 293.66,
        ],
        flute: [
          { f: 523.25, start: 0.25, dur: 1.9 },
          { f: 440.0, start: 2.3, dur: 2.1 },
        ],
      },
      {
        bass: 98.0, // G2
        chord: [146.83, 196.0, 233.08, 349.23, 440.0],
        arp: [
          293.66, 392.0, 466.16, 587.33, 698.46, 587.33, 466.16, 392.0,
        ],
        flute: [
          { f: 466.16, start: 0.3, dur: 1.8 },
          { f: 587.33, start: 2.25, dur: 2.15 },
        ],
      },
      {
        bass: 110.0, // A2
        chord: [164.81, 220.0, 293.66, 329.63, 440.0],
        arp: [
          329.63, 440.0, 587.33, 659.25, 880.0, 659.25, 587.33, 440.0,
        ],
        flute: [
          { f: 659.25, start: 0.25, dur: 2.0 },
          { f: 523.25, start: 2.4, dur: 2.0 },
        ],
      },
      {
        bass: 73.42, // D2 (Phrase B)
        chord: [146.83, 220.0, 293.66, 349.23, 523.25],
        arp: [
          293.66, 440.0, 523.25, 659.25, 880.0, 659.25, 523.25, 440.0,
        ],
        flute: [
          { f: 880.0, start: 0.3, dur: 1.95 },
          { f: 783.99, start: 2.4, dur: 2.0 },
        ],
      },
      {
        bass: 65.41, // C2
        chord: [130.81, 196.0, 261.63, 329.63, 493.88],
        arp: [
          261.63, 329.63, 392.0, 493.88, 659.25, 493.88, 392.0, 329.63,
        ],
        flute: [
          { f: 659.25, start: 0.25, dur: 1.9 },
          { f: 587.33, start: 2.3, dur: 2.1 },
        ],
      },
      {
        bass: 58.27, // Bb1
        chord: [116.54, 174.61, 220.0, 329.63, 440.0],
        arp: [
          233.08, 349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 349.23,
        ],
        flute: [
          { f: 523.25, start: 0.3, dur: 1.85 },
          { f: 659.25, start: 2.3, dur: 2.1 },
        ],
      },
      {
        bass: 55.0, // A1
        chord: [110.0, 164.81, 220.0, 277.18, 329.63],
        arp: [
          220.0, 277.18, 329.63, 440.0, 554.37, 440.0, 329.63, 277.18,
        ],
        flute: [
          { f: 554.37, start: 0.25, dur: 2.15 },
          { f: 587.33, start: 2.55, dur: 1.85 },
        ],
      },
    ];

    const isIntro = this.musicMode === "intro";
    const isMystic = this.musicMode === "mystic";
    const barDur = isMystic ? 4.8 : isIntro ? 4.4 : 3.8;

    this._lastScheduledBarAt = 0;
    const scheduleBar = () => {
      if (!this.ctx || !this.musicBus || this.ctx.state !== "running")
        return;
      const nowCtx = this.ctx.currentTime;
      if (
        this._lastScheduledBarAt &&
        nowCtx - this._lastScheduledBarAt < barDur * 0.78
      )
        return;
      this._lastScheduledBarAt = nowCtx;
      const t0 = nowCtx + 0.06;

      const rawIntensity = this._computeCombatIntensity();
      this.combatIntensity =
        this.combatIntensity * 0.65 + rawIntensity * 0.35;
      const inten = this.combatIntensity;

      if (this.musicMode === "intro") {
        const prog =
          introProgressions[this._musicStep % introProgressions.length];

        // A. Deep Cathedral Contrabass & Fifth Harmonic Pedal
        [1.0, 1.5].forEach((mult, bLayer) => {
          const bassOsc = this.ctx.createOscillator();
          const bassFilt = this.ctx.createBiquadFilter();
          const bassG = this.ctx.createGain();
          bassOsc.type = bLayer === 0 ? "triangle" : "sine";
          bassOsc.frequency.setValueAtTime(prog.bass * mult, t0);
          bassFilt.type = "lowpass";
          bassFilt.frequency.setValueAtTime(bLayer === 0 ? 185 : 260, t0);
          const peak = bLayer === 0 ? 0.2 : 0.07;
          bassG.gain.setValueAtTime(0.0001, t0);
          bassG.gain.linearRampToValueAtTime(peak, t0 + 0.85);
          bassG.gain.setValueAtTime(peak * 0.9, t0 + barDur - 0.95);
          bassG.gain.exponentialRampToValueAtTime(
            0.0001,
            t0 + barDur + 0.24,
          );
          bassOsc.connect(bassFilt);
          bassFilt.connect(bassG);
          bassG.connect(this.musicBus);
          bassOsc.onended = () => {
            try {
              bassOsc.disconnect();
              bassFilt.disconnect();
              bassG.disconnect();
            } catch (e) {}
          };
          bassOsc.start(t0);
          bassOsc.stop(t0 + barDur + 0.28);
        });

        // B. Stereo-Panned Shimmering Celestial Choir & Strings Ensemble
        prog.chord.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const filt = this.ctx.createBiquadFilter();
          const g = this.ctx.createGain();
          const pan = this._createMusicPan(
            (idx / Math.max(1, prog.chord.length - 1) - 0.5) * 1.15,
          );
          osc.type = idx % 2 === 0 ? "sine" : "triangle";
          osc.frequency.setValueAtTime(freq, t0);
          osc.detune.setValueAtTime((idx - 2.5) * 6.5, t0);
          filt.type = "lowpass";
          filt.frequency.setValueAtTime(620, t0);
          filt.frequency.linearRampToValueAtTime(980, t0 + barDur * 0.5);
          filt.frequency.linearRampToValueAtTime(700, t0 + barDur);

          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.046, t0 + 1.15);
          g.gain.setValueAtTime(0.042, t0 + barDur - 1.0);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + barDur + 0.28);

          osc.connect(filt);
          filt.connect(g);
          if (pan) {
            g.connect(pan);
            pan.connect(this.musicBus);
          } else {
            g.connect(this.musicBus);
          }
          osc.onended = () => {
            try {
              osc.disconnect();
              filt.disconnect();
              g.disconnect();
              if (pan) pan.disconnect();
            } catch (e) {}
          };
          osc.start(t0);
          osc.stop(t0 + barDur + 0.32);
        });

        // C. Expressive French Horn Sovereign Melody with Warm Vibrato
        prog.horn.forEach((note) => {
          const nt = t0 + note.start;
          const horn = this.ctx.createOscillator();
          const hornBody = this.ctx.createOscillator();
          const vib = this.ctx.createOscillator();
          const vibGain = this.ctx.createGain();
          const hFilt = this.ctx.createBiquadFilter();
          const hg = this.ctx.createGain();
          const pan = this._createMusicPan(-0.14);

          horn.type = "triangle";
          hornBody.type = "sine";
          horn.frequency.setValueAtTime(note.f, nt);
          hornBody.frequency.setValueAtTime(note.f * 0.5, nt);

          vib.type = "sine";
          vib.frequency.setValueAtTime(5.1, nt);
          vibGain.gain.setValueAtTime(0.0, nt);
          vibGain.gain.linearRampToValueAtTime(2.6, nt + 0.35);
          vib.connect(vibGain);
          vibGain.connect(horn.frequency);

          hFilt.type = "lowpass";
          hFilt.frequency.setValueAtTime(440, nt);
          hFilt.frequency.linearRampToValueAtTime(
            960,
            nt + note.dur * 0.38,
          );
          hFilt.frequency.linearRampToValueAtTime(540, nt + note.dur);

          hg.gain.setValueAtTime(0.0001, nt);
          hg.gain.linearRampToValueAtTime(0.052, nt + 0.2);
          hg.gain.setValueAtTime(0.045, nt + note.dur - 0.25);
          hg.gain.exponentialRampToValueAtTime(
            0.0001,
            nt + note.dur + 0.22,
          );

          horn.connect(hFilt);
          hornBody.connect(hFilt);
          hFilt.connect(hg);
          if (pan) {
            hg.connect(pan);
            pan.connect(this.musicBus);
          } else {
            hg.connect(this.musicBus);
          }

          horn.onended = () => {
            try {
              horn.disconnect();
              hornBody.disconnect();
              vib.disconnect();
              vibGain.disconnect();
              hFilt.disconnect();
              hg.disconnect();
              if (pan) pan.disconnect();
            } catch (e) {}
          };
          horn.start(nt);
          hornBody.start(nt);
          vib.start(nt);
          horn.stop(nt + note.dur + 0.24);
          hornBody.stop(nt + note.dur + 0.24);
          vib.stop(nt + note.dur + 0.24);
        });

        // D. Stereo-Alternating Crystalline Altar Harp & Celesta
        const bellStep = barDur / prog.bell.length;
        prog.bell.forEach((bFreq, bIdx) => {
          const bt = t0 + bIdx * bellStep + 0.12;
          const bell = this.ctx.createOscillator();
          const overtone = this.ctx.createOscillator();
          const bg = this.ctx.createGain();
          const og = this.ctx.createGain();
          const pan = this._createMusicPan(bIdx % 2 === 0 ? 0.34 : -0.34);
          bell.type = "sine";
          overtone.type = "triangle";
          bell.frequency.setValueAtTime(bFreq, bt);
          overtone.frequency.setValueAtTime(bFreq * 2.0, bt);
          og.gain.value = 0.16;

          bg.gain.setValueAtTime(0.0001, bt);
          bg.gain.linearRampToValueAtTime(0.034, bt + 0.025);
          bg.gain.exponentialRampToValueAtTime(
            0.0001,
            bt + bellStep * 1.65,
          );

          bell.connect(bg);
          overtone.connect(og);
          og.connect(bg);
          if (pan) {
            bg.connect(pan);
            pan.connect(this.musicBus);
          } else {
            bg.connect(this.musicBus);
          }
          bell.onended = () => {
            try {
              bell.disconnect();
              overtone.disconnect();
              bg.disconnect();
              og.disconnect();
              if (pan) pan.disconnect();
            } catch (e) {}
          };
          bell.start(bt);
          overtone.start(bt);
          bell.stop(bt + bellStep * 1.7);
          overtone.stop(bt + bellStep * 1.7);
        });

        // E. Ceremonial Heartbeat Timpani & Phrase Cymbal Swells
        this._schedulePercussionHit(t0, "timpani", 0.115);
        this._schedulePercussionHit(t0 + barDur * 0.5, "timpani", 0.075);
        if (prog.cymbal) {
          this._schedulePercussionHit(
            t0 + barDur * 0.72,
            "cymbal",
            0.026,
          );
        }
      } else if (this.musicMode === "arena") {
        const prog =
          arenaProgressions[this._musicStep % arenaProgressions.length];

        // A. Tactical Spiccato Low-String Ostinato
        const pStep = barDur / prog.pulse.length;
        const ostCutoffBase = 230 + inten * 240;
        prog.pulse.forEach((pFreq, pIdx) => {
          const pt = t0 + pIdx * pStep;
          const ost = this.ctx.createOscillator();
          const filt = this.ctx.createBiquadFilter();
          const pg = this.ctx.createGain();
          const pan = this._createMusicPan(pIdx % 2 === 0 ? -0.18 : 0.18);
          ost.type = inten > 0.55 ? "sawtooth" : "triangle";
          ost.frequency.setValueAtTime(pFreq, pt);
          filt.type = "lowpass";
          filt.frequency.setValueAtTime(
            pIdx % 2 === 0 ? ostCutoffBase * 1.25 : ostCutoffBase * 0.88,
            pt,
          );

          const accent =
            (pIdx === 0 || pIdx === 4 ? 0.13 : 0.078) *
            (0.85 + inten * 0.3);
          pg.gain.setValueAtTime(0.0001, pt);
          pg.gain.linearRampToValueAtTime(accent, pt + 0.032);
          pg.gain.exponentialRampToValueAtTime(0.0001, pt + pStep * 0.9);

          ost.connect(filt);
          filt.connect(pg);
          if (pan) {
            pg.connect(pan);
            pan.connect(this.musicBus);
          } else {
            pg.connect(this.musicBus);
          }
          ost.onended = () => {
            try {
              ost.disconnect();
              filt.disconnect();
              pg.disconnect();
              if (pan) pan.disconnect();
            } catch (e) {}
          };
          ost.start(pt);
          ost.stop(pt + pStep + 0.02);
        });

        // B. Stereo-Spread Dark-Emerald / Crimson String Ensemble
        prog.chord.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const filt = this.ctx.createBiquadFilter();
          const g = this.ctx.createGain();
          const pan = this._createMusicPan(
            (idx / Math.max(1, prog.chord.length - 1) - 0.5) * 1.1,
          );
          osc.type = idx % 2 === 0 ? "triangle" : "sine";
          osc.frequency.setValueAtTime(freq, t0);
          osc.detune.setValueAtTime((idx - 2) * 5.5, t0);
          filt.type = "lowpass";
          filt.frequency.setValueAtTime(620 + inten * 320, t0);

          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.052, t0 + 0.9);
          g.gain.setValueAtTime(0.048, t0 + barDur - 0.9);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + barDur + 0.25);

          osc.connect(filt);
          filt.connect(g);
          if (pan) {
            g.connect(pan);
            pan.connect(this.musicBus);
          } else {
            g.connect(this.musicBus);
          }
          osc.onended = () => {
            try {
              osc.disconnect();
              filt.disconnect();
              g.disconnect();
              if (pan) pan.disconnect();
            } catch (e) {}
          };
          osc.start(t0);
          osc.stop(t0 + barDur + 0.3);
        });

        // C. Expressive Solo Cello / War-Flute Battle Melody with Vibrato
        prog.lead.forEach((note) => {
          const nt = t0 + note.start;
          const leadOsc = this.ctx.createOscillator();
          const subOsc = this.ctx.createOscillator();
          const vib = this.ctx.createOscillator();
          const vibG = this.ctx.createGain();
          const lFilt = this.ctx.createBiquadFilter();
          const lg = this.ctx.createGain();
          const pan = this._createMusicPan(-0.12);

          leadOsc.type = "triangle";
          subOsc.type = "sine";
          leadOsc.frequency.setValueAtTime(note.f, nt);
          subOsc.frequency.setValueAtTime(note.f * 0.5, nt);

          vib.type = "sine";
          vib.frequency.setValueAtTime(5.4, nt);
          vibG.gain.setValueAtTime(0.0, nt);
          vibG.gain.linearRampToValueAtTime(2.4, nt + 0.25);
          vib.connect(vibG);
          vibG.connect(leadOsc.frequency);

          lFilt.type = "lowpass";
          lFilt.frequency.setValueAtTime(980 + inten * 350, nt);

          lg.gain.setValueAtTime(0.0001, nt);
          lg.gain.linearRampToValueAtTime(0.054, nt + 0.1);
          lg.gain.setValueAtTime(0.046, nt + note.dur - 0.18);
          lg.gain.exponentialRampToValueAtTime(
            0.0001,
            nt + note.dur + 0.16,
          );

          leadOsc.connect(lFilt);
          subOsc.connect(lFilt);
          lFilt.connect(lg);
          if (pan) {
            lg.connect(pan);
            pan.connect(this.musicBus);
          } else {
            lg.connect(this.musicBus);
          }

          leadOsc.onended = () => {
            try {
              leadOsc.disconnect();
              subOsc.disconnect();
              vib.disconnect();
              vibG.disconnect();
              lFilt.disconnect();
              lg.disconnect();
              if (pan) pan.disconnect();
            } catch (e) {}
          };
          leadOsc.start(nt);
          subOsc.start(nt);
          vib.start(nt);
          leadOsc.stop(nt + note.dur + 0.2);
          subOsc.stop(nt + note.dur + 0.2);
          vib.stop(nt + note.dur + 0.2);
        });

        // D. Dynamic Heroic Brass Counter-Melody
        if (inten > 0.44 && Array.isArray(prog.heroCounter)) {
          const cGainScale = Math.min(1.0, (inten - 0.44) / 0.45);
          prog.heroCounter.forEach((cn) => {
            const nt = t0 + cn.start;
            const hOsc = this.ctx.createOscillator();
            const hFilt = this.ctx.createBiquadFilter();
            const hg = this.ctx.createGain();
            const pan = this._createMusicPan(0.22);
            hOsc.type = "triangle";
            hOsc.frequency.setValueAtTime(cn.f, nt);
            hFilt.type = "lowpass";
            hFilt.frequency.setValueAtTime(820, nt);
            hFilt.frequency.linearRampToValueAtTime(
              1320,
              nt + cn.dur * 0.4,
            );
            const peak = 0.036 * cGainScale;
            hg.gain.setValueAtTime(0.0001, nt);
            hg.gain.linearRampToValueAtTime(peak, nt + 0.16);
            hg.gain.exponentialRampToValueAtTime(
              0.0001,
              nt + cn.dur + 0.18,
            );
            hOsc.connect(hFilt);
            hFilt.connect(hg);
            if (pan) {
              hg.connect(pan);
              pan.connect(this.musicBus);
            } else {
              hg.connect(this.musicBus);
            }
            hOsc.onended = () => {
              try {
                hOsc.disconnect();
                hFilt.disconnect();
                hg.disconnect();
                if (pan) pan.disconnect();
              } catch (e) {}
            };
            hOsc.start(nt);
            hOsc.stop(nt + cn.dur + 0.22);
          });
        }

        // E. Crisp Tactical War-Drum & Dynamic Combat Percussion
        this._schedulePercussionHit(
          t0,
          "wardrum",
          0.125 * (0.85 + inten * 0.3),
        );
        this._schedulePercussionHit(
          t0 + barDur * 0.5,
          "wardrum",
          0.085 * (0.85 + inten * 0.3),
        );
        this._schedulePercussionHit(
          t0 + barDur * 0.75,
          "wardrum",
          0.075 * (0.85 + inten * 0.3),
        );
        if (inten > 0.48) {
          this._schedulePercussionHit(
            t0 + barDur * 0.25,
            "brush",
            0.018 * inten,
          );
          this._schedulePercussionHit(
            t0 + barDur * 0.75,
            "snare",
            0.022 * inten,
          );
        }
      } else if (this.musicMode === "mystic") {
        const prog =
          mysticProgressions[this._musicStep % mysticProgressions.length];

        // A. Deep Sanctuary Sub-Pedal
        const padOsc = this.ctx.createOscillator();
        const padG = this.ctx.createGain();
        padOsc.type = "sine";
        padOsc.frequency.setValueAtTime(prog.bass, t0);
        padG.gain.setValueAtTime(0.0001, t0);
        padG.gain.linearRampToValueAtTime(0.2, t0 + 0.9);
        padG.gain.exponentialRampToValueAtTime(
          0.0001,
          t0 + barDur + 0.24,
        );
        padOsc.connect(padG);
        padG.connect(this.musicBus);
        padOsc.onended = () => {
          try {
            padOsc.disconnect();
            padG.disconnect();
          } catch (e) {}
        };
        padOsc.start(t0);
        padOsc.stop(t0 + barDur + 0.28);

        // B. Stereo-Panned Ethereal Strings & Choir Pad
        prog.chord.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const filt = this.ctx.createBiquadFilter();
          const g = this.ctx.createGain();
          const pan = this._createMusicPan(
            (idx / Math.max(1, prog.chord.length - 1) - 0.5) * 1.2,
          );
          osc.type = idx % 2 === 0 ? "triangle" : "sine";
          osc.frequency.setValueAtTime(freq, t0);
          osc.detune.setValueAtTime((idx - 2) * 6, t0);
          filt.type = "lowpass";
          filt.frequency.setValueAtTime(760, t0);
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.052, t0 + 1.15);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + barDur + 0.3);
          osc.connect(filt);
          filt.connect(g);
          if (pan) {
            g.connect(pan);
            pan.connect(this.musicBus);
          } else {
            g.connect(this.musicBus);
          }
          osc.onended = () => {
            try {
              osc.disconnect();
              filt.disconnect();
              g.disconnect();
              if (pan) pan.disconnect();
            } catch (e) {}
          };
          osc.start(t0);
          osc.stop(t0 + barDur + 0.35);
        });

        // C. Stereo-Plucked Celestial Harp Arpeggio
        const stepDur = barDur / prog.arp.length;
        prog.arp.forEach((noteFreq, nIdx) => {
          const nt = t0 + nIdx * stepDur;
          const harp = this.ctx.createOscillator();
          const shimmer = this.ctx.createOscillator();
          const hg = this.ctx.createGain();
          const sg = this.ctx.createGain();
          const pan = this._createMusicPan(Math.sin(nIdx * 0.9) * 0.45);
          harp.type = "sine";
          shimmer.type = "triangle";
          harp.frequency.setValueAtTime(noteFreq, nt);
          shimmer.frequency.setValueAtTime(noteFreq * 2.0, nt);
          sg.gain.value = 0.14;
          hg.gain.setValueAtTime(0.0001, nt);
          hg.gain.linearRampToValueAtTime(0.056, nt + 0.025);
          hg.gain.exponentialRampToValueAtTime(
            0.0001,
            nt + stepDur * 2.2,
          );
          harp.connect(hg);
          shimmer.connect(sg);
          sg.connect(hg);
          if (pan) {
            hg.connect(pan);
            pan.connect(this.musicBus);
          } else {
            hg.connect(this.musicBus);
          }
          harp.onended = () => {
            try {
              harp.disconnect();
              shimmer.disconnect();
              hg.disconnect();
              sg.disconnect();
              if (pan) pan.disconnect();
            } catch (e) {}
          };
          harp.start(nt);
          shimmer.start(nt);
          harp.stop(nt + stepDur * 2.3);
          shimmer.stop(nt + stepDur * 2.3);
        });

        // D. Expressive Sanctuary Solo Flute Melody with Gentle Vibrato
        prog.flute.forEach((fn) => {
          const nt = t0 + fn.start;
          const fl = this.ctx.createOscillator();
          const vib = this.ctx.createOscillator();
          const vibG = this.ctx.createGain();
          const fFilt = this.ctx.createBiquadFilter();
          const fg = this.ctx.createGain();
          const pan = this._createMusicPan(-0.18);
          fl.type = "sine";
          fl.frequency.setValueAtTime(fn.f, nt);
          vib.type = "sine";
          vib.frequency.setValueAtTime(5.6, nt);
          vibG.gain.setValueAtTime(0.0, nt);
          vibG.gain.linearRampToValueAtTime(3.0, nt + 0.45);
          vib.connect(vibG);
          vibG.connect(fl.frequency);
          fFilt.type = "lowpass";
          fFilt.frequency.setValueAtTime(1450, nt);
          fg.gain.setValueAtTime(0.0001, nt);
          fg.gain.linearRampToValueAtTime(0.044, nt + 0.28);
          fg.gain.setValueAtTime(0.038, nt + fn.dur - 0.3);
          fg.gain.exponentialRampToValueAtTime(
            0.0001,
            nt + fn.dur + 0.25,
          );
          fl.connect(fFilt);
          fFilt.connect(fg);
          if (pan) {
            fg.connect(pan);
            pan.connect(this.musicBus);
          } else {
            fg.connect(this.musicBus);
          }
          fl.onended = () => {
            try {
              fl.disconnect();
              vib.disconnect();
              vibG.disconnect();
              fFilt.disconnect();
              fg.disconnect();
              if (pan) pan.disconnect();
            } catch (e) {}
          };
          fl.start(nt);
          vib.start(nt);
          fl.stop(nt + fn.dur + 0.3);
          vib.stop(nt + fn.dur + 0.3);
        });
      }

      this._musicStep++;
    };

    scheduleBar();
    this._musicTimer = setInterval(
      scheduleBar,
      Math.round(barDur * 1000),
    );
  }

  startAmbienceBeds() {
    const rate = this.ctx.sampleRate;
    const bufLen = rate * 4;
    const noiseBuf = this.ctx.createBuffer(1, bufLen, rate);
    const data = noiseBuf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufLen; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = ((lastOut + 0.03 * w) / 1.03) * 2.0;
      lastOut = data[i] / 2.0;
    }
    // Crossfade loop seam over 2048 samples so the 4s buffer loops with zero click/pop
    const xfade = Math.min(2048, Math.floor(bufLen * 0.05));
    for (let i = 0; i < xfade; i++) {
      const t = i / xfade;
      data[bufLen - xfade + i] =
        data[bufLen - xfade + i] * (1 - t) + data[i] * t;
    }

    const riverSrc = this.ctx.createBufferSource();
    riverSrc.buffer = noiseBuf;
    riverSrc.loop = true;
    const rFilt = this.ctx.createBiquadFilter();
    rFilt.type = "lowpass";
    rFilt.frequency.value = 540;
    this.riverGain = this.ctx.createGain();
    this.riverGain.gain.value = 0.0;
    riverSrc.connect(rFilt);
    rFilt.connect(this.riverGain);
    this.riverGain.connect(this.outNode);
    riverSrc.start();

    const rainSrc = this.ctx.createBufferSource();
    rainSrc.buffer = noiseBuf;
    rainSrc.loop = true;
    const rainFilt = this.ctx.createBiquadFilter();
    rainFilt.type = "bandpass";
    rainFilt.frequency.value = 1400;
    rainFilt.Q.value = 0.7;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.0;
    rainSrc.connect(rainFilt);
    rainFilt.connect(this.rainGain);
    this.rainGain.connect(this.outNode);
    rainSrc.start();
  }

  updateAmbience(distToRiver, weatherType) {
    if (!this.initialized || !this.ctx) return;
    const inMenuScreen =
      (typeof inHeroSelect !== "undefined" && inHeroSelect) ||
      (typeof inTitleScreen !== "undefined" && inTitleScreen);
    if (this.riverGain) {
      const prox = Math.max(0, 1 - distToRiver / 48);
      const targetRiver = inMenuScreen ? 0.0 : 0.006 + prox * 0.075;
      this.riverGain.gain.setTargetAtTime(
        targetRiver,
        this.ctx.currentTime,
        0.2,
      );
    }
    if (this.rainGain) {
      const targetRain = inMenuScreen
        ? 0.0
        : weatherType === "rain"
          ? 0.075
          : weatherType === "mist"
            ? 0.012
            : 0.0;
      this.rainGain.gain.setTargetAtTime(
        targetRain,
        this.ctx.currentTime,
        0.4,
      );
    }
  }

  setSfxEnabled(val) {
    this.sfxEnabled = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        val ? 0.8 * this.sfxVolumeScale : 0.0,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  duckAudioForSpeech(duck) {
    const inMenuScreen =
      (typeof inHeroSelect !== "undefined" && inHeroSelect) ||
      (typeof inTitleScreen !== "undefined" && inTitleScreen);
    if (inMenuScreen) return;
    if (this.masterGain && this.ctx && this.sfxEnabled) {
      const baseSfx = 0.8 * this.sfxVolumeScale;
      const target = duck ? baseSfx * 0.65 : baseSfx;
      this.masterGain.gain.setTargetAtTime(
        target,
        this.ctx.currentTime,
        duck ? 0.12 : 0.3,
      );
    }
    if (this.musicGain && this.ctx && this.musicEnabled) {
      const baseMus = this._targetMusicGain();
      const mTarget = duck
        ? baseMus * (this._deepDuck ? 0.3 : 0.55)
        : baseMus;
      this.musicGain.gain.setTargetAtTime(
        mTarget,
        this.ctx.currentTime,
        duck ? 0.14 : 0.4,
      );
    }
  }

  _resolveLine(bucketKey, lineOrArr) {
    if (!Array.isArray(lineOrArr)) return lineOrArr;
    if (lineOrArr.length === 0) return "";
    if (lineOrArr.length === 1) return lineOrArr[0];
    const last = this._recentLines.get(bucketKey);
    const pool = lineOrArr.filter((l) => l !== last);
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    this._recentLines.set(bucketKey, chosen);
    return chosen;
  }

  getNaturalEnglishVoices() {
    const all =
      (window.speechSynthesis
        ? window.speechSynthesis.getVoices()
        : []) || this.availableVoices;
    if (all && all.length > 0) this.availableVoices = all;
    if (!all || all.length === 0) return [];

    // Strictly exclude ALL robotic/novelty/joke synthesizers on macOS, Windows & Linux
    const noveltyRe =
      /espeak|fred|albert|bad news|good news|bahh|bells|boing|bubbles|cellos|deranged|eddy|flo|grandma|grandpa|hysterical|jester|junior|kathy|organ|pipe|princess|ralph|reed|rocko|sandy|shelley|superstar|trinoids|vicki|whisper|wobble|zarvox/i;
    const cleanPool = all.filter((v) => !noveltyRe.test(v.name));
    const enVoices = cleanPool.filter(
      (v) => v.lang && v.lang.toLowerCase().startsWith("en"),
    );
    const pool =
      enVoices.length > 0
        ? enVoices
        : cleanPool.length > 0
          ? cleanPool
          : all;

    // Score voices by human naturalness (Neural / Natural / Enhanced / Premium / Google / Siri first)
    return pool
      .map((v, idx) => {
        const n = v.name.toLowerCase();
        let q = 0;
        if (/natural|neural/.test(n)) q += 60;
        else if (/premium/.test(n)) q += 52;
        else if (/enhanced|studio/.test(n)) q += 46;
        else if (/siri/.test(n)) q += 40;
        else if (/google/.test(n)) q += 34;
        else if (/online/.test(n)) q += 30;
        if (/compact|desktop/.test(n)) q -= 6;
        if (
          /daniel|samantha|aria|jenny|guy|sonia|libby|serena|moira|tessa|karen|rishi|ava|allison|oliver|arthur|fiona|alex|tom|david|zira|hazel|george|susan/.test(
            n,
          )
        )
          q += 10;
        if (v.localService) q += 2;
        (this._voiceQ || (this._voiceQ = new Map())).set(v.name, q);
        return { v, q, idx };
      })
      .sort((a, b) => b.q - a.q || a.idx - b.idx)
      .map((item) => item.v);
  }

  pickSystemVoice(
    wantFemale,
    slotIdx = 0,
    archetype = "default",
    accentPref = "",
    heroId = "",
  ) {
    const pool = this.getNaturalEnglishVoices();
    if (!pool || pool.length === 0) return null;

    // Check user manual voice override for this hero
    if (
      heroId &&
      this.heroVoiceOverrides &&
      this.heroVoiceOverrides[heroId]
    ) {
      const forced = pool.find(
        (v) => v.name === this.heroVoiceOverrides[heroId],
      );
      if (forced) return forced;
    }

    const femRe =
      /female|google us english|google uk english female|zira|samantha|victoria|karen|moira|tessa|aria|jenny|sonia|libby|hazel|susan|emma|amy|ava|allison|natasha|clara|fiona|serena|kate|heera|veena|neerja|nicky|sara/i;
    const maleRe =
      /\bmale\b|david|daniel|alex|guy|christopher|ryan|thomas|george|mark|richard|arthur|steffan|eric|davis|andrew|brian|oliver|william|james|aaron|tom|ravi|prabhat|lee|gordon|rishi/i;

    const gendered = pool.filter((v) => {
      const n = v.name;
      if (wantFemale) return femRe.test(n) && !/\bmale\b/i.test(n);
      return maleRe.test(n) && !/female/i.test(n);
    });
    const allOfGender = gendered.length > 0 ? gendered : pool;
    // Cast only from the best-sounding tier on this device; pitch and pace keep the heroes distinct
    const qOf = (v) => (this._voiceQ && this._voiceQ.get(v.name)) || 0;
    const bestQ = allOfGender.reduce((m, v) => Math.max(m, qOf(v)), -99);
    const topTier = allOfGender.filter((v) => qOf(v) >= bestQ - 16);
    const candidates = topTier.length > 0 ? topTier : allOfGender;

    if (archetype === "announcer") {
      const prefs = [
        /ryan/i,
        /thomas/i,
        /christopher/i,
        /guy|eric|davis|andrew|brian|roger|steffan/i,
        /google uk english male/i,
        /daniel|arthur|oliver|malcolm|evan|alex/i,
        /george|david|mark/i,
      ];
      for (let pi = 0; pi < prefs.length; pi++) {
        const hit = candidates.find((v) => prefs[pi].test(v.name));
        if (hit) return hit;
      }
      return candidates[0];
    }

    // Prefer regional accent match first, then distribute 1-to-1 across all distinct voices in candidates!
    const normAccent = (accentPref || "").toLowerCase().replace("_", "-");
    if (normAccent) {
      const accentMatches = candidates.filter((v) =>
        (v.lang || "")
          .toLowerCase()
          .replace("_", "-")
          .startsWith(normAccent),
      );
      if (accentMatches.length > 0) {
        return accentMatches[slotIdx % accentMatches.length];
      }
    }

    return candidates[slotIdx % candidates.length];
  }

  _formatSpeechProsody(text, emotion = "normal", cadence = "heroic") {
    // Keep punctuation clean and conversational so TTS engines use natural human intonation
    let clean = text.replace(/\s*—\s*/g, ", ").replace(/\.\.\./g, ", ");

    if (
      emotion === "normal" &&
      cadence !== "fiery" &&
      cadence !== "energetic"
    ) {
      clean = clean.replace(/!+$/, ".");
    }
    return clean;
  }

  // Subtle, non-robotic acoustic character cue (throttled & smoothly enveloped so rapid clicks never clip)
  playCharacterCue(heroCfg, emotion = "normal") {
    if (!this.sfxEnabled || !this.ctx || !heroCfg) return;
    const nowMs = performance.now();
    if (this._lastCueAt && nowMs - this._lastCueAt < 280) return;
    this._lastCueAt = nowMs;
    const t0 = this.ctx.currentTime + 0.015;
    const motif =
      (heroCfg.voice && heroCfg.voice.motif) || "brass_fanfare";
    const vol = 0.018 * Math.min(1.0, this.sfxVolumeScale || 1.0);

    const chime = (f1, f2, delay, dur, type = "sine", gMult = 1.0) => {
      const osc = this.ctx.createOscillator();
      const filt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f1, t0 + delay);
      if (f2 !== f1)
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(40, f2),
          t0 + delay + dur,
        );
      filt.type = "lowpass";
      filt.frequency.setValueAtTime(1400, t0 + delay);

      g.gain.setValueAtTime(0.0005, t0 + delay);
      g.gain.linearRampToValueAtTime(vol * gMult, t0 + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, t0 + delay + dur);

      osc.connect(filt);
      filt.connect(g);
      this.connectWithReverb(g, 0.55);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + dur + 0.02);
    };

    if (motif === "brass_fanfare") {
      chime(293.66, 293.66, 0.0, 0.16, "triangle", 1.0);
      chime(440.0, 440.0, 0.07, 0.22, "triangle", 1.0);
    } else if (motif === "ember_crackle") {
      this.playNoiseBurst(0.16, "bandpass", 2200, 3600, vol * 1.1, 0.45);
    } else if (motif === "ice_chime") {
      chime(1318.5, 1174.66, 0.0, 0.2, "sine", 0.9);
      chime(1760.0, 1567.98, 0.06, 0.22, "sine", 0.8);
    } else if (motif === "abyss_growl") {
      chime(110.0, 73.42, 0.0, 0.26, "triangle", 1.2);
    } else if (motif === "thunder_snap") {
      chime(880.0, 440.0, 0.0, 0.14, "sine", 0.9);
    } else if (motif === "void_whisper") {
      this.playNoiseBurst(0.18, "bandpass", 1400, 2600, vol * 0.9, 0.6);
    } else if (motif === "stone_rumble") {
      chime(82.41, 55.0, 0.0, 0.28, "sine", 1.3);
    } else if (motif === "seraph_harp") {
      chime(523.25, 523.25, 0.0, 0.18, "sine", 0.85);
      chime(659.25, 659.25, 0.05, 0.2, "sine", 0.85);
      chime(783.99, 783.99, 0.1, 0.24, "sine", 0.85);
    } else if (motif === "chrono_tick") {
      chime(1480, 1480, 0.0, 0.045, "sine", 0.9);
      chime(1174.66, 1174.66, 0.11, 0.05, "sine", 0.9);
    } else if (motif === "blood_pulse") {
      chime(110.0, 82.41, 0.0, 0.14, "sine", 1.2);
      chime(110.0, 73.42, 0.13, 0.16, "sine", 1.0);
    } else if (motif === "warlock_chant") {
      chime(146.83, 138.59, 0.0, 0.24, "triangle", 1.0);
    } else if (motif === "forest_flute") {
      chime(659.25, 783.99, 0.0, 0.18, "sine", 0.9);
    } else if (motif === "ocean_swell") {
      chime(130.81, 164.81, 0.0, 0.26, "sine", 1.1);
    } else if (motif === "prism_chord") {
      chime(880, 880, 0.0, 0.22, "sine", 0.8);
      chime(1318.5, 1318.5, 0.04, 0.24, "sine", 0.8);
    } else if (motif === "anvil_ring") {
      chime(587.33, 582.0, 0.0, 0.24, "triangle", 0.95);
    } else if (motif === "lunar_bell") {
      chime(783.99, 783.99, 0.0, 0.26, "sine", 0.85);
    }
  }

  playVocalSignature(heroCfg, emotion = "normal") {
    this.playCharacterCue(heroCfg, emotion);
  }

  isAnnouncerActive() {
    const now = performance.now();
    if (this._isAnnouncerUtterance) {
      const synthBusy =
        "speechSynthesis" in window &&
        (window.speechSynthesis.speaking ||
          window.speechSynthesis.pending);
      if (synthBusy || now < this.announcerSpeakingUntil) {
        return true;
      }
      this._isAnnouncerUtterance = false;
      this.announcerSpeakingUntil = 0;
    }
    if (now < this.announcerSpeakingUntil) return true;
    if (this._announcerQueue && this._announcerQueue.length > 0)
      return true;
    return false;
  }

  _releaseAnnouncerLock(completedNormally = true) {
    clearTimeout(this._announcerFallbackTimer);
    this._announcerFallbackTimer = null;
    this._isAnnouncerUtterance = false;
    this.announcerSpeakingUntil = 0;

    if (this._announcerQueue && this._announcerQueue.length > 0) {
      const next = this._announcerQueue.shift();
      setTimeout(() => {
        this.announceSpree(next.spokenText, next.tier, {
          ...next.opts,
          _fromQueue: true,
        });
      }, 120);
      return;
    }

    if (typeof this._postAnnouncerHeroAction === "function") {
      const fn = this._postAnnouncerHeroAction;
      this._postAnnouncerHeroAction = null;
      setTimeout(
        () => {
          if (!this.isAnnouncerActive()) fn();
        },
        completedNormally ? 240 : 120,
      );
    }
  }

  stopSpeech(keepSubtitle = false, clearAnnouncerQueue = true) {
    this._speechSerial = (this._speechSerial || 0) + 1;
    clearTimeout(this._speechQueueTimer);
    clearTimeout(this._announcerFallbackTimer);
    this._announcerFallbackTimer = null;
    const hadSpeech =
      Boolean(this._activeUtter) ||
      ("speechSynthesis" in window &&
        (window.speechSynthesis.speaking ||
          window.speechSynthesis.pending));
    this._activeUtter = null;
    window.__activeHeroUtterance = null;
    this.speechEndsAt = 0;
    this._isAnnouncerUtterance = false;
    this.announcerSpeakingUntil = 0;
    if (clearAnnouncerQueue) {
      this._announcerQueue = [];
      this._postAnnouncerHeroAction = null;
    }
    if (hadSpeech && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    this.duckAudioForSpeech(false);
    if (!keepSubtitle) {
      clearTimeout(window._voiceSubTimer);
      const box = document.getElementById("voice-subtitle-box");
      if (box) {
        box.classList.remove("opacity-100");
        box.classList.add("opacity-0");
      }
    }
  }

  _showSubtitle(speakerLabel, text, isAnnouncer = false) {
    if (!isAnnouncer && this.isAnnouncerActive()) return;
    const box = document.getElementById("voice-subtitle-box");
    if (box) {
      const spEl = document.getElementById("voice-speaker-name");
      const txEl = document.getElementById("voice-subtitle-text");
      const iconEl = box.querySelector("i");

      if (isAnnouncer) {
        box.className =
          "opacity-100 transition-opacity duration-200 bg-gradient-to-r from-slate-950 via-amber-950/90 to-slate-950 border border-amber-400/80 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.35)]";
        if (iconEl)
          iconEl.className =
            "fa-solid fa-crown text-amber-300 text-xs animate-bounce";
        spEl.className =
          "font-cinzel font-black text-xs text-amber-300 tracking-wider uppercase";
        spEl.textContent = speakerLabel;
        txEl.className = "text-xs font-semibold text-white";
        txEl.textContent = text;
      } else {
        box.className =
          "opacity-100 transition-opacity duration-200 bg-slate-950/92 border border-amber-400/50 px-4 py-1 rounded-full flex items-center gap-2 shadow-lg";
        if (iconEl)
          iconEl.className =
            "fa-solid fa-volume-high text-amber-400 text-xs animate-pulse";
        spEl.className = "font-cinzel font-bold text-xs text-amber-300";
        spEl.textContent = speakerLabel;
        txEl.className = "text-xs italic text-slate-100";
        txEl.textContent = `"${text}"`;
      }
    }

    clearTimeout(window._voiceSubTimer);
    const subDurationMs = isAnnouncer
      ? Math.max(3800, text.length * 78 + 1200)
      : 3000;
    window._voiceSubTimer = setTimeout(() => {
      if (box) {
        box.classList.remove("opacity-100");
        box.classList.add("opacity-0");
      }
    }, subDurationMs);
  }

  _speakUtterance(text, opts) {
    if (!("speechSynthesis" in window)) return;
    const isAnnouncer = !!opts.isAnnouncer;
    if (!isAnnouncer && this.isAnnouncerActive()) return;

    const wasActive =
      Boolean(this._activeUtter) ||
      window.speechSynthesis.speaking ||
      window.speechSynthesis.pending;
    this.stopSpeech(true, isAnnouncer ? false : true);
    const mySerial = ++this._speechSerial;
    const estMs = isAnnouncer
      ? Math.min(12000, Math.max(3200, text.length * 78 + 1100))
      : Math.min(4600, Math.max(1500, text.length * 74));
    this.speechEndsAt = performance.now() + estMs;
    if (isAnnouncer) {
      this._isAnnouncerUtterance = true;
      this._announcerStartedAt = performance.now();
      this.announcerSpeakingUntil = performance.now() + estMs + 400;
      clearTimeout(this._announcerFallbackTimer);
      this._announcerFallbackTimer = setTimeout(() => {
        if (
          this._speechSerial === mySerial &&
          this._isAnnouncerUtterance
        ) {
          this._releaseAnnouncerLock(false);
        }
      }, estMs + 600);
    }

    const launchSpeech = () => {
      if (this._speechSerial !== mySerial) return;
      try {
        if (window.speechSynthesis.paused)
          window.speechSynthesis.resume();
        const utter = new SpeechSynthesisUtterance(text);
        const resolvedVoice =
          opts.voice || this.getNaturalEnglishVoices()[0] || null;
        utter.lang =
          resolvedVoice && resolvedVoice.lang
            ? resolvedVoice.lang
            : opts.lang || "en-US";
        utter.pitch = opts.pitch;
        utter.rate = opts.rate;
        utter.volume = opts.volume ?? 1.0;
        if (resolvedVoice) utter.voice = resolvedVoice;

        this._activeUtter = utter;
        window.__activeHeroUtterance = utter;
        this.duckAudioForSpeech(true);

        utter.onend = () => {
          if (this._speechSerial !== mySerial) return;
          this._activeUtter = null;
          window.__activeHeroUtterance = null;
          this.speechEndsAt = 0;
          this.duckAudioForSpeech(false);
          if (isAnnouncer) {
            const elapsed =
              performance.now() - (this._announcerStartedAt || 0);
            if (elapsed >= 350) {
              this._releaseAnnouncerLock(true);
            }
          }
        };
        utter.onerror = () => {
          if (this._speechSerial !== mySerial) return;
          this._activeUtter = null;
          window.__activeHeroUtterance = null;
          this.speechEndsAt = 0;
          this.duckAudioForSpeech(false);
          if (isAnnouncer) {
            this._releaseAnnouncerLock(false);
          }
        };

        window.speechSynthesis.speak(utter);
      } catch (e) {
        if (this._speechSerial === mySerial) {
          this.speechEndsAt = 0;
          this.duckAudioForSpeech(false);
          if (isAnnouncer) {
            this._releaseAnnouncerLock(false);
          }
        }
      }
    };

    if (wasActive) {
      this._speechQueueTimer = setTimeout(launchSpeech, 85);
    } else {
      launchSpeech();
    }
  }

  speakHeroLine(
    heroCfg,
    lineOrArr,
    priority = false,
    emotion = "normal",
    opts = {},
  ) {
    if (!this.voiceEnabled || !heroCfg || !lineOrArr) return;
    const now = performance.now();
    const category = opts.category || (priority ? "major" : "casual");
    const force = !!opts.force;
    const chance = opts.chance !== undefined ? opts.chance : 1.0;
    const minGapMs =
      opts.minGapMs !== undefined
        ? opts.minGapMs
        : priority
          ? 2800
          : 16500;
    const catGapMs =
      opts.catGapMs !== undefined
        ? opts.catGapMs
        : priority
          ? 2500
          : 20000;

    // Announcer voice always has strict priority over all champion voices
    if (this.isAnnouncerActive()) {
      if (opts.deferAfterAnnouncer) {
        this._postAnnouncerHeroAction = () => {
          this.speakHeroLine(heroCfg, lineOrArr, priority, emotion, {
            ...opts,
            deferAfterAnnouncer: false,
          });
        };
      }
      return;
    }

    const isCurrentlySpeaking =
      ("speechSynthesis" in window && window.speechSynthesis.speaking) ||
      now < this.speechEndsAt;

    if (!force) {
      if (!priority && isCurrentlySpeaking) return;
      if (
        priority &&
        isCurrentlySpeaking &&
        now - this.lastHeroVoiceTime < 1600
      )
        return;
      if (now - this.lastHeroVoiceTime < minGapMs) return;
      const lastCat = this.lastCategoryVoiceTime.get(category) || 0;
      if (now - lastCat < catGapMs) return;
      if (chance < 1.0 && Math.random() > chance) return;
    }

    this.lastHeroVoiceTime = now;
    this.lastCategoryVoiceTime.set(category, now);
    this.ensure();

    const rawLine = this._resolveLine(
      `${heroCfg.id}:${category}:${emotion}`,
      lineOrArr,
    );
    if (!rawLine) return;

    this._showSubtitle(`${heroCfg.name}:`, rawLine, false);
    const hasSpeechApi =
      "speechSynthesis" in window &&
      this.getNaturalEnglishVoices().length > 0;
    if (!hasSpeechApi && (opts.chime || force || priority)) {
      this.playCharacterCue(heroCfg, emotion);
    }

    // Keep pitch & rate tightly centered near 1.0 (0.95 - 1.06) so browser pitch-shifters never distort or warble the voice
    let pitchMod = 1.0,
      rateMod = 1.0;
    if (emotion === "triumph") {
      pitchMod = 1.02;
      rateMod = 1.02;
    } else if (emotion === "urgent") {
      pitchMod = 1.04;
      rateMod = 1.06;
    } else if (emotion === "commanding") {
      pitchMod = 0.97;
      rateMod = 0.95;
    }

    const slot =
      typeof heroCfg.voice.slotIdx === "number"
        ? heroCfg.voice.slotIdx
        : heroCfg.voice.voiceIndexOffset || 0;
    const chosen = this.pickSystemVoice(
      heroCfg.voice.gender === "female",
      slot,
      heroCfg.voice.archetype || "default",
      heroCfg.voice.accentPref || "",
      heroCfg.id,
    );

    const rawPitch = heroCfg.voice.pitch || 1.0;
    const rawRate = heroCfg.voice.rate || 1.0;
    // Modern neural and network voices stay clean across a wide range, so each hero gets a real register;
    // legacy system voices keep a narrow range because their pitch shifter warbles.
    const hqVoice =
      !!chosen &&
      ((this._voiceQ && this._voiceQ.get(chosen.name)) || 0) >= 30;
    const gentlePitch = 1.0 + (rawPitch - 1.0) * (hqVoice ? 0.95 : 0.45);
    const gentleRate = 1.0 + (rawRate - 1.0) * (hqVoice ? 0.85 : 0.5);
    this._deepDuck = false;

    const spokenText = this._formatSpeechProsody(
      rawLine,
      emotion,
      heroCfg.voice.cadence || "heroic",
    );
    this._speakUtterance(spokenText, {
      isAnnouncer: false,
      pitch: Math.min(
        hqVoice ? 1.24 : 1.08,
        Math.max(hqVoice ? 0.76 : 0.92, gentlePitch * pitchMod),
      ),
      rate: Math.min(
        hqVoice ? 1.14 : 1.08,
        Math.max(hqVoice ? 0.84 : 0.92, gentleRate * rateMod),
      ),
      volume: Math.min(1.0, 1.0 * this.voiceVolumeScale),
      voice: chosen,
    });
  }

  announceSpree(spokenText, tier = 1, opts = {}) {
    this.ensure();
    if (!opts._fromQueue) {
      if (this.sfxEnabled && this.ctx) {
        const t = this.ctx.currentTime;
        const sub = this.ctx.createOscillator();
        const subG = this.ctx.createGain();
        sub.type = "sine";
        sub.frequency.setValueAtTime(108, t);
        sub.frequency.exponentialRampToValueAtTime(36, t + 1.05);
        subG.gain.setValueAtTime(0.36, t);
        subG.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        sub.connect(subG);
        this.connectWithReverb(subG, 0.85);
        sub.start(t);
        sub.stop(t + 1.12);

        const chord =
          tier >= 4
            ? [110.0, 164.81, 220.0, 277.18, 329.63, 440.0]
            : tier >= 2
              ? [110.0, 164.81, 220.0, 329.63]
              : [130.81, 196.0, 261.63];

        chord.forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const filt = this.ctx.createBiquadFilter();
          const g = this.ctx.createGain();
          osc.type = idx % 2 === 0 ? "sawtooth" : "triangle";
          osc.frequency.setValueAtTime(f, t + idx * 0.035);

          filt.type = "lowpass";
          filt.frequency.setValueAtTime(320, t + idx * 0.035);
          filt.frequency.exponentialRampToValueAtTime(
            tier >= 4 ? 1950 : 1450,
            t + idx * 0.035 + 0.28,
          );
          filt.frequency.exponentialRampToValueAtTime(640, t + 1.15);

          g.gain.setValueAtTime(0.001, t + idx * 0.035);
          g.gain.linearRampToValueAtTime(0.082, t + idx * 0.035 + 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.15);

          osc.connect(filt);
          filt.connect(g);
          this.connectWithReverb(g, 0.78);
          osc.start(t + idx * 0.035);
          osc.stop(t + idx * 0.035 + 0.18 + 1.0);
        });
      }

      if (this.sfxEnabled && this.ctx) {
        this.playNoiseBurst(0.6, "lowpass", 240, 52, 0.46, 0.9);
        this.playNoiseBurst(
          tier >= 4 ? 1.5 : 1.0,
          "highpass",
          5200,
          8200,
          0.03,
          0.95,
        );
      }
    }

    if (this.voiceEnabled && spokenText) {
      if (typeof opts.afterAnnouncer === "function") {
        this._postAnnouncerHeroAction = opts.afterAnnouncer;
      }
      if (!opts._fromQueue && this.isAnnouncerActive()) {
        if (this._announcerQueue.length < 4) {
          this._announcerQueue.push({
            spokenText,
            tier,
            opts: { ...opts, afterAnnouncer: null },
          });
        }
        return;
      }

      const formatted = spokenText
        .replace(/!\s+/g, "! ")
        .replace(/\.\s+/g, ". ");
      const estMs = Math.min(
        12000,
        Math.max(3200, formatted.length * 78 + 1100),
      );
      this._isAnnouncerUtterance = true;
      this._announcerStartedAt = performance.now();
      this.announcerSpeakingUntil = performance.now() + estMs + 400;
      this._showSubtitle("GRANDMASTER ANNOUNCER:", spokenText, true);

      const deepVoice = this.pickSystemVoice(
        false,
        0,
        "announcer",
        "en-gb",
        "",
      );
      const annHq =
        !!deepVoice &&
        ((this._voiceQ && this._voiceQ.get(deepVoice.name)) || 0) >= 30;
      const announcerPitch = annHq
        ? tier >= 4
          ? 0.78
          : 0.74
        : tier >= 4
          ? 0.88
          : tier >= 2
            ? 0.86
            : 0.84;
      const announcerRate = annHq
        ? tier >= 4
          ? 0.97
          : 0.9
        : tier >= 4
          ? 0.94
          : 0.91;
      this._deepDuck = true;

      this._speakUtterance(formatted, {
        isAnnouncer: true,
        pitch: announcerPitch,
        rate: announcerRate,
        volume: Math.min(1.0, 1.0 * this.voiceVolumeScale),
        voice: deepVoice,
      });
    } else if (typeof opts.afterAnnouncer === "function") {
      setTimeout(opts.afterAnnouncer, 400);
    }
  }
  connectWithReverb(node, wet = 0.35) {
    node.connect(this.outNode);
    if (this.reverbNode && wet > 0) {
      const g = this.ctx.createGain();
      g.gain.value = wet;
      node.connect(g);
      g.connect(this.reverbNode);
    }
  }

  playNoiseBurst(
    duration,
    filterType,
    freqStart,
    freqEnd,
    gainVal,
    wet = 0.35,
  ) {
    if (!this.sharedNoiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.sharedNoiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freqStart, t);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, freqEnd),
      t + duration,
    );

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter);
    filter.connect(g);
    this.connectWithReverb(g, wet);
    const maxOffset = Math.max(0, 1.95 - duration);
    src.start(t, Math.random() * maxOffset, duration);
  }

  play(kind, distToCam = 0) {
    if (!this.sfxEnabled) return;
    try {
      this.ensure();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      if (kind === "move") {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(580, t);
        osc.frequency.exponentialRampToValueAtTime(860, t + 0.05);
        g.gain.setValueAtTime(0.045, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(g);
        this.connectWithReverb(g, 0.2);
        osc.start(t);
        osc.stop(t + 0.065);
      } else if (kind === "attack_melee") {
        this.playNoiseBurst(0.11, "bandpass", 1900, 440, 0.085, 0.25);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(205, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.11);
        g.gain.setValueAtTime(0.11, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(g);
        this.connectWithReverb(g, 0.2);
        osc.start(t);
        osc.stop(t + 0.125);
      } else if (kind === "attack_ranged") {
        this.playNoiseBurst(0.09, "highpass", 2400, 900, 0.075, 0.3);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(780, t);
        osc.frequency.exponentialRampToValueAtTime(320, t + 0.09);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(g);
        this.connectWithReverb(g, 0.3);
        osc.start(t);
        osc.stop(t + 0.11);
      } else if (kind === "tower_hit") {
        const maxTowerAudioRange = 42.0;
        if (distToCam > maxTowerAudioRange) return;
        const att = Math.pow(
          Math.max(0, 1.0 - distToCam / maxTowerAudioRange),
          1.35,
        );
        if (att <= 0.02) return;
        this.playNoiseBurst(
          0.16,
          "bandpass",
          1650,
          290,
          0.15 * att,
          0.42,
        );
        const sub = this.ctx.createOscillator();
        const subG = this.ctx.createGain();
        sub.type = "triangle";
        sub.frequency.setValueAtTime(168, t);
        sub.frequency.exponentialRampToValueAtTime(44, t + 0.18);
        subG.gain.setValueAtTime(0.22 * att, t);
        subG.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
        sub.connect(subG);
        this.connectWithReverb(subG, 0.38);
        sub.start(t);
        sub.stop(t + 0.2);

        const chime = this.ctx.createOscillator();
        const chimeG = this.ctx.createGain();
        chime.type = "sine";
        chime.frequency.setValueAtTime(540, t);
        chime.frequency.exponentialRampToValueAtTime(240, t + 0.14);
        chimeG.gain.setValueAtTime(0.11 * att, t);
        chimeG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        chime.connect(chimeG);
        this.connectWithReverb(chimeG, 0.45);
        chime.start(t);
        chime.stop(t + 0.16);
      } else if (kind === "crit") {
        this.playNoiseBurst(0.22, "lowpass", 2400, 180, 0.18, 0.45);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(340, t);
        osc.frequency.exponentialRampToValueAtTime(52, t + 0.22);
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
        osc.connect(g);
        this.connectWithReverb(g, 0.4);
        osc.start(t);
        osc.stop(t + 0.24);
      } else if (kind === "gold") {
        [1318.5, 1760.0, 2637.0].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t + idx * 0.045);
          g.gain.setValueAtTime(0.1, t + idx * 0.045);
          g.gain.exponentialRampToValueAtTime(
            0.001,
            t + idx * 0.045 + 0.25,
          );
          osc.connect(g);
          this.connectWithReverb(g, 0.4);
          osc.start(t + idx * 0.045);
          osc.stop(t + idx * 0.045 + 0.26);
        });
      } else if (kind === "buy" || kind === "levelup") {
        [440, 554.37, 659.25, 880, 1108.73].forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(f, t + i * 0.05);
          g.gain.setValueAtTime(0.1, t + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.42);
          osc.connect(g);
          this.connectWithReverb(g, 0.5);
          osc.start(t + i * 0.05);
          osc.stop(t + i * 0.05 + 0.44);
        });
      } else if (kind === "roshan_roar" || kind === "aegis_reborn") {
        this.playNoiseBurst(0.95, "lowpass", 950, 60, 0.34, 0.8);
        [82.4, 123.5, 164.8, 246.9].forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(f, t + idx * 0.06);
          osc.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.8);
          g.gain.setValueAtTime(0.14, t + idx * 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
          osc.connect(g);
          this.connectWithReverb(g, 0.75);
          osc.start(t + idx * 0.06);
          osc.stop(t + 0.86);
        });
      } else if (kind === "dragon_roar") {
        // 1. Massive Atmospheric Wing-Gust & Dragonfire Descent Noise Bursts
        this.playNoiseBurst(1.85, "lowpass", 650, 75, 0.52, 0.85);
        this.playNoiseBurst(1.4, "bandpass", 2400, 680, 0.32, 0.75);
        setTimeout(() => {
          if (this.ctx && this.sfxEnabled) {
            this.playNoiseBurst(1.1, "highpass", 3200, 1400, 0.18, 0.65);
          }
        }, 220);

        // 2. Colossal Sub-Bass Earthquake Descent Thud
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(110, t);
        subOsc.frequency.exponentialRampToValueAtTime(26, t + 1.8);
        subGain.gain.setValueAtTime(0.44, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.85);
        subOsc.connect(subGain);
        this.connectWithReverb(subGain, 0.85);
        subOsc.start(t);
        subOsc.stop(t + 1.88);

        // 3. Deep Guttural Throat Flutter Roar (FM Modulation)
        const throatOsc = this.ctx.createOscillator();
        const throatFilter = this.ctx.createBiquadFilter();
        const throatGain = this.ctx.createGain();
        throatOsc.type = "sawtooth";
        throatOsc.frequency.setValueAtTime(68, t);
        throatOsc.frequency.exponentialRampToValueAtTime(145, t + 0.45);
        throatOsc.frequency.exponentialRampToValueAtTime(48, t + 2.1);

        // Throat flutter LFO
        const lfoOsc = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfoOsc.type = "sine";
        lfoOsc.frequency.setValueAtTime(32, t);
        lfoOsc.frequency.linearRampToValueAtTime(22, t + 2.1);
        lfoGain.gain.setValueAtTime(55, t);
        lfoGain.gain.exponentialRampToValueAtTime(8, t + 2.1);
        lfoOsc.connect(lfoGain);
        lfoGain.connect(throatOsc.frequency);

        throatFilter.type = "lowpass";
        throatFilter.Q.value = 3.5;
        throatFilter.frequency.setValueAtTime(340, t);
        throatFilter.frequency.exponentialRampToValueAtTime(1650, t + 0.45);
        throatFilter.frequency.exponentialRampToValueAtTime(180, t + 2.1);

        throatGain.gain.setValueAtTime(0.001, t);
        throatGain.gain.linearRampToValueAtTime(0.38, t + 0.12);
        throatGain.gain.exponentialRampToValueAtTime(0.001, t + 2.15);

        throatOsc.connect(throatFilter);
        throatFilter.connect(throatGain);
        this.connectWithReverb(throatGain, 0.78);

        lfoOsc.start(t);
        lfoOsc.stop(t + 2.2);
        throatOsc.start(t);
        throatOsc.stop(t + 2.2);

        // 4. Piercing Celestial Wyrm Horn / Screech Harmonics (Chord)
        [146.83, 220.0, 293.66, 440.0].forEach((freq, idx) => {
          const hornOsc = this.ctx.createOscillator();
          const hornFilt = this.ctx.createBiquadFilter();
          const hornGain = this.ctx.createGain();
          hornOsc.type = idx % 2 === 0 ? "sawtooth" : "triangle";
          hornOsc.frequency.setValueAtTime(freq, t + idx * 0.04);
          hornOsc.frequency.exponentialRampToValueAtTime(
            freq * 1.55,
            t + 0.45 + idx * 0.04,
          );
          hornOsc.frequency.exponentialRampToValueAtTime(
            freq * 0.85,
            t + 1.95,
          );

          hornFilt.type = "bandpass";
          hornFilt.Q.value = 2.0;
          hornFilt.frequency.setValueAtTime(freq * 2.2, t + idx * 0.04);
          hornFilt.frequency.exponentialRampToValueAtTime(
            freq * 4.2,
            t + 0.45,
          );
          hornFilt.frequency.exponentialRampToValueAtTime(
            freq * 1.2,
            t + 1.95,
          );

          hornGain.gain.setValueAtTime(0.001, t + idx * 0.04);
          hornGain.gain.linearRampToValueAtTime(
            0.12,
            t + idx * 0.04 + 0.15,
          );
          hornGain.gain.exponentialRampToValueAtTime(0.001, t + 1.98);

          hornOsc.connect(hornFilt);
          hornFilt.connect(hornGain);
          this.connectWithReverb(hornGain, 0.82);
          hornOsc.start(t + idx * 0.04);
          hornOsc.stop(t + 2.0);
        });

        // 5. Astral Shimmer / Celestial Overtone Ring
        [880.0, 1318.5, 1760.0].forEach((chimeF, cIdx) => {
          const chimeOsc = this.ctx.createOscillator();
          const chimeGain = this.ctx.createGain();
          chimeOsc.type = "sine";
          chimeOsc.frequency.setValueAtTime(chimeF, t + 0.1 + cIdx * 0.06);
          chimeGain.gain.setValueAtTime(0.035, t + 0.1 + cIdx * 0.06);
          chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
          chimeOsc.connect(chimeGain);
          this.connectWithReverb(chimeGain, 0.9);
          chimeOsc.start(t + 0.1 + cIdx * 0.06);
          chimeOsc.stop(t + 2.45);
        });
      } else if (kind === "spell_fire_wave") {
        this.playNoiseBurst(0.45, "bandpass", 1400, 260, 0.22, 0.55);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(68, t + 0.44);
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(g);
        this.connectWithReverb(g, 0.5);
        osc.start(t);
        osc.stop(t + 0.46);
      } else if (kind === "spell_frost_volley") {
        this.playNoiseBurst(0.32, "highpass", 2600, 4200, 0.16, 0.55);
        [1174, 1567, 2093].forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, t + idx * 0.03);
          osc.frequency.exponentialRampToValueAtTime(f * 0.65, t + 0.28);
          g.gain.setValueAtTime(0.09, t + idx * 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(g);
          this.connectWithReverb(g, 0.5);
          osc.start(t + idx * 0.03);
          osc.stop(t + 0.31);
        });
      } else if (kind === "spell_shadow_coil") {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(480, t);
        osc.frequency.exponentialRampToValueAtTime(95, t + 0.36);
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(g);
        this.connectWithReverb(g, 0.55);
        osc.start(t);
        osc.stop(t + 0.4);
      } else if (kind === "spell_blink") {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(240, t);
        osc.frequency.exponentialRampToValueAtTime(1260, t + 0.18);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(g);
        this.connectWithReverb(g, 0.55);
        osc.start(t);
        osc.stop(t + 0.25);
      } else if (kind === "spell_shield_nova") {
        this.playNoiseBurst(0.35, "highpass", 1500, 3400, 0.14, 0.55);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(340, t);
        osc.frequency.exponentialRampToValueAtTime(680, t + 0.15);
        osc.frequency.exponentialRampToValueAtTime(210, t + 0.36);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(g);
        this.connectWithReverb(g, 0.55);
        osc.start(t);
        osc.stop(t + 0.4);
      } else if (kind === "spell_laguna") {
        this.playNoiseBurst(0.55, "bandpass", 3200, 140, 0.3, 0.7);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1480, t);
        osc.frequency.exponentialRampToValueAtTime(42, t + 0.52);
        g.gain.setValueAtTime(0.24, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.connect(g);
        this.connectWithReverb(g, 0.7);
        osc.start(t);
        osc.stop(t + 0.56);
      } else if (kind === "spell_orbital_meteor") {
        this.playNoiseBurst(0.75, "lowpass", 1200, 60, 0.28, 0.75);
        const sub = this.ctx.createOscillator();
        const subG = this.ctx.createGain();
        sub.type = "sawtooth";
        sub.frequency.setValueAtTime(180, t);
        sub.frequency.exponentialRampToValueAtTime(32, t + 0.72);
        subG.gain.setValueAtTime(0.24, t);
        subG.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
        sub.connect(subG);
        this.connectWithReverb(subG, 0.7);
        sub.start(t);
        sub.stop(t + 0.76);
      } else if (kind === "wolf_howl") {
        if (typeof isNightTime !== "undefined" && !isNightTime) return;
        const att = Math.max(0.28, Math.min(1.0, 1.0 - distToCam / 95));
        // Lead Alpha Wolf Howl (gliding chest-to-head formant sweep + organic vibrato)
        const voices = [
          {
            delay: 0.0,
            startF: 235,
            peakF: 475,
            endF: 265,
            dur: 1.85,
            vol: 0.17 * att,
          },
          {
            delay: 0.42,
            startF: 295,
            peakF: 560,
            endF: 330,
            dur: 1.55,
            vol: 0.095 * att,
          },
        ];
        voices.forEach((v) => {
          const st = t + v.delay;
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const lfo = this.ctx.createOscillator();
          const lfoGain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          const g = this.ctx.createGain();

          osc1.type = "triangle";
          osc2.type = "sawtooth";
          osc1.frequency.setValueAtTime(v.startF, st);
          osc1.frequency.exponentialRampToValueAtTime(
            v.peakF,
            st + v.dur * 0.34,
          );
          osc1.frequency.setValueAtTime(
            v.peakF * 0.985,
            st + v.dur * 0.68,
          );
          osc1.frequency.exponentialRampToValueAtTime(v.endF, st + v.dur);

          osc2.frequency.setValueAtTime(v.startF * 1.004, st);
          osc2.frequency.exponentialRampToValueAtTime(
            v.peakF * 1.004,
            st + v.dur * 0.34,
          );
          osc2.frequency.setValueAtTime(
            v.peakF * 0.99,
            st + v.dur * 0.68,
          );
          osc2.frequency.exponentialRampToValueAtTime(
            v.endF * 1.003,
            st + v.dur,
          );

          // Natural vocal vibrato
          lfo.type = "sine";
          lfo.frequency.setValueAtTime(5.6, st);
          lfoGain.gain.setValueAtTime(0.0, st);
          lfoGain.gain.linearRampToValueAtTime(7.5, st + v.dur * 0.35);
          lfoGain.gain.linearRampToValueAtTime(2.0, st + v.dur);
          lfo.connect(lfoGain);
          lfoGain.connect(osc1.frequency);
          lfoGain.connect(osc2.frequency);

          // Throat / snout resonant bandpass shaping
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(540, st);
          filter.frequency.linearRampToValueAtTime(
            780,
            st + v.dur * 0.36,
          );
          filter.frequency.linearRampToValueAtTime(490, st + v.dur);
          filter.Q.setValueAtTime(2.4, st);

          const sawGain = this.ctx.createGain();
          sawGain.gain.setValueAtTime(0.28, st);

          g.gain.setValueAtTime(0.001, st);
          g.gain.linearRampToValueAtTime(v.vol, st + v.dur * 0.24);
          g.gain.setValueAtTime(v.vol * 0.92, st + v.dur * 0.66);
          g.gain.exponentialRampToValueAtTime(0.0008, st + v.dur);

          osc1.connect(filter);
          osc2.connect(sawGain);
          sawGain.connect(filter);
          filter.connect(g);
          this.connectWithReverb(g, 0.78);

          osc1.start(st);
          osc2.start(st);
          lfo.start(st);
          osc1.stop(st + v.dur + 0.04);
          osc2.stop(st + v.dur + 0.04);
          lfo.stop(st + v.dur + 0.04);
        });
        // Subtle breathy wind rush
        this.playNoiseBurst(
          1.35,
          "bandpass",
          620,
          420,
          0.032 * att,
          0.72,
        );
      } else if (kind === "vampire_coven") {
        if (typeof isNightTime !== "undefined" && !isNightTime) return;
        const att = Math.max(0.35, Math.min(1.0, 1.0 - distToCam / 95));
        // Grand Gothic Cathedral Pipe Organ (Multi-Rank Stops: 16' Subbass + 8' Principal + 4' Octave + 2' Superoctave + Mixture)
        const playPipeOrganVoice = (
          freq,
          startOff,
          dur,
          gainScale,
          isPedal = false,
        ) => {
          const st = t + startOff;
          const voiceGain = this.ctx.createGain();
          const lowpass = this.ctx.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.setValueAtTime(isPedal ? 420 : 1850, st);
          lowpass.frequency.exponentialRampToValueAtTime(
            isPedal ? 240 : 1180,
            st + dur,
          );

          // Slow cathedral pipe speech attack & release
          const peak = gainScale * att;
          voiceGain.gain.setValueAtTime(0.0008, st);
          voiceGain.gain.linearRampToValueAtTime(
            peak,
            st + (isPedal ? 0.14 : 0.08),
          );
          voiceGain.gain.setValueAtTime(
            peak * 0.9,
            st + Math.max(0.16, dur - 0.24),
          );
          voiceGain.gain.exponentialRampToValueAtTime(0.0008, st + dur);

          // Tremulant wind-chest vibrato
          const tremLfo = this.ctx.createOscillator();
          const tremDepth = this.ctx.createGain();
          tremLfo.type = "sine";
          tremLfo.frequency.setValueAtTime(4.9, st);
          tremDepth.gain.setValueAtTime(freq * 0.0045, st);
          tremLfo.connect(tremDepth);

          const ranks = isPedal
            ? [
                { mult: 0.5, type: "sine", wt: 0.65 }, // 16' Subbass
                { mult: 1.0, type: "triangle", wt: 0.45 }, // 8' Bourdon
                { mult: 2.0, type: "sawtooth", wt: 0.16 }, // 4' Choralbass
              ]
            : [
                { mult: 1.0, type: "sawtooth", wt: 0.46 }, // 8' Principal
                { mult: 1.003, type: "triangle", wt: 0.34 }, // 8' Vox Humana detuned rank
                { mult: 2.0, type: "sawtooth", wt: 0.24 }, // 4' Octave
                { mult: 2.997, type: "sine", wt: 0.11 }, // 2-2/3' Nazard Quint
                { mult: 4.0, type: "triangle", wt: 0.12 }, // 2' Superoctave
              ];

          ranks.forEach((rk) => {
            const osc = this.ctx.createOscillator();
            const rGain = this.ctx.createGain();
            osc.type = rk.type;
            osc.frequency.setValueAtTime(freq * rk.mult, st);
            tremDepth.connect(osc.frequency);
            rGain.gain.setValueAtTime(rk.wt, st);
            osc.connect(rGain);
            rGain.connect(lowpass);
            osc.start(st);
            osc.stop(st + dur + 0.06);
          });

          lowpass.connect(voiceGain);
          this.connectWithReverb(voiceGain, 0.92);
          tremLfo.start(st);
          tremLfo.stop(st + dur + 0.06);
        };

        // Bach-inspired Gothic D-Minor Cathedral Organ Phrase + Final Minor Triad Chord
        const organScore = [
          // Opening dramatic mordent flourish (A3 - G3 - A3)
          { f: 220.0, d: 0.0, dur: 0.22, vol: 0.11, pedal: false },
          { f: 196.0, d: 0.18, dur: 0.22, vol: 0.11, pedal: false },
          { f: 220.0, d: 0.36, dur: 1.15, vol: 0.13, pedal: false },
          // Deep 16' Pedal D2 + A2 foundation
          { f: 73.42, d: 0.36, dur: 3.15, vol: 0.18, pedal: true },
          { f: 110.0, d: 0.36, dur: 3.15, vol: 0.11, pedal: true },
          // Descending gothic lament (G3 -> F3 -> E3 -> D3 -> C#3)
          { f: 196.0, d: 1.38, dur: 0.34, vol: 0.11, pedal: false },
          { f: 174.61, d: 1.66, dur: 0.34, vol: 0.11, pedal: false },
          { f: 164.81, d: 1.94, dur: 0.34, vol: 0.11, pedal: false },
          { f: 146.83, d: 2.22, dur: 0.42, vol: 0.12, pedal: false },
          { f: 138.59, d: 2.58, dur: 0.48, vol: 0.12, pedal: false },
          // Resolving D-Minor Cathedral Chord (D3 + F3 + A3 + D4)
          { f: 146.83, d: 3.02, dur: 1.65, vol: 0.11, pedal: false },
          { f: 174.61, d: 3.02, dur: 1.65, vol: 0.1, pedal: false },
          { f: 220.0, d: 3.02, dur: 1.65, vol: 0.11, pedal: false },
          { f: 293.66, d: 3.02, dur: 1.65, vol: 0.09, pedal: false },
        ];
        organScore.forEach((n) =>
          playPipeOrganVoice(n.f, n.d, n.dur, n.vol, n.pedal),
        );
        // Subtle pipe-chest air chiff at onset
        this.playNoiseBurst(
          0.28,
          "bandpass",
          1450,
          950,
          0.022 * att,
          0.75,
        );
      }
    } catch (e) {}
  }
}
const sfx = new VoiceAndSoundEngine();

