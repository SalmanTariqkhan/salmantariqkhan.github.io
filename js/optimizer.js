/***********************************************************************
 * 1GB RAM & LOW-POWER MOBILE OPTIMIZER MODULE (v154 PATCH)
 ***********************************************************************/
const LowRamOptimizer = (() => {
  function detectLowRamProfile() {
    const mem = navigator.deviceMemory || 0;
    const cores = navigator.hardwareConcurrency || 4;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(
      navigator.userAgent,
    );

    let weakGpu = false;
    try {
      const probeCanvas = document.createElement("canvas");
      const gl =
        probeCanvas.getContext("webgl") ||
        probeCanvas.getContext("experimental-webgl");
      if (gl) {
        const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        const rendererStr = dbg
          ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
          : "";
        if (
          maxTex <= 4096 ||
          /Mali-4|Mali-T|Adreno \(TM\) [34]|Adreno \(TM\) 50[456]|PowerVR GE8|SwiftShader|llvmpipe/i.test(
            rendererStr,
          )
        ) {
          weakGpu = true;
        }
        const loseExt = gl.getExtension("WEBGL_lose_context");
        if (loseExt) loseExt.loseContext();
      }
    } catch (e) {}

    const isLowRam =
      (mem > 0 && mem <= 2) || (isMobile && (cores <= 4 || weakGpu));
    if (isLowRam) {
      document.body.classList.add(
        "low-gfx-mode",
        "nxg-lite",
        "quality-ultralight",
      );
    }

    return {
      isLowRam,
      preset: isLowRam ? "ultralight" : "balanced",
      pixelRatio: isLowRam
        ? 1
        : Math.min(window.devicePixelRatio || 1, 2),
      resScale: 100,
      targetFps: isLowRam ? 30 : 60,
      shadows: !isLowRam,
      bloom: false,
      cinematic: false,
      ao: false,
      waterHq: !isLowRam,
      clutter: !isLowRam,
      particles: false,
      portraits3d: !isLowRam,
    };
  }

  const profile = detectLowRamProfile();

  function syncSettingsUI() {
    if (!profile.isLowRam) return;
    const resSlider = document.getElementById("set-res-scale");
    const resVal = document.getElementById("set-res-scale-val");
    if (resSlider) resSlider.value = "100";
    if (resVal) resVal.textContent = "100%";

    const toggles = {
      "set-cinematic": false,
      "set-bloom": false,
      "set-ao": false,
      "set-shadows": false,
      "set-water-hq": false,
      "set-clutter": false,
      "set-particles": false,
      "set-portraits-3d": false,
    };
    for (const [id, checked] of Object.entries(toggles)) {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    }
    document
      .querySelectorAll("#settings-quality-grid .setting-pill")
      .forEach((btn) => {
        btn.classList.toggle(
          "active-setting",
          btn.dataset.q === "ultralight",
        );
      });
  }

  function disposeHeavyGpuResources({
    renderer,
    disposeComposerFn,
    dirLight,
  }) {
    if (typeof disposeComposerFn === "function") {
      disposeComposerFn();
    }
    if (renderer) {
      renderer.shadowMap.enabled = false;
      if (profile.isLowRam) renderer.setPixelRatio(1);
    }
    if (dirLight) {
      dirLight.castShadow = false;
      if (dirLight.shadow && dirLight.shadow.map) {
        dirLight.shadow.map.dispose();
        dirLight.shadow.map = null;
      }
    }
    [
      "hud-portrait-canvas",
      "select-spotlight-portrait",
      "insp-portrait-canvas",
    ].forEach((id) => {
      const c = document.getElementById(id);
      if (c) c.classList.add("hidden");
    });
  }

  function disposeObjectTree(root) {
    if (!root) return;
    while (root.children.length > 0) {
      const child = root.children[0];
      root.remove(child);
      child.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          const mats = Array.isArray(node.material)
            ? node.material
            : [node.material];
          for (let i = 0; i < mats.length; i++) {
            const m = mats[i];
            for (const key in m) {
              if (m[key] && m[key].isTexture) m[key].dispose();
            }
            m.dispose();
          }
        }
      });
    }
  }

  const Vec3Pool = (() => {
    const pool = Array.from({ length: 64 }, () => new THREE.Vector3());
    let cursor = 0;
    return {
      get(x = 0, y = 0, z = 0) {
        const v =
          cursor < pool.length ? pool[cursor++] : new THREE.Vector3();
        return v.set(x, y, z);
      },
      reset() {
        cursor = 0;
      },
    };
  })();

  const FloatTextPool = (() => {
    const POOL_SIZE = 44;
    const nodes = [];
    let initialized = false;

    function ensurePool() {
      if (initialized) return;
      const layer = document.getElementById("world-ui-layer");
      if (!layer) return;
      initialized = true;
      for (let i = 0; i < POOL_SIZE; i++) {
        const el = document.createElement("div");
        el.className = "floating-text";
        el.style.cssText =
          "display:none; left:0; top:0; will-change:transform,opacity;";
        layer.appendChild(el);
        nodes.push({
          el,
          active: false,
          born: 0,
          life: 920,
          sx: 0,
          sy: 0,
        });
      }
    }

    function spawn(
      screenX,
      screenY,
      text,
      color = "#facc15",
      fontSize = 13,
    ) {
      ensurePool();
      if (!nodes.length) return;
      let slot = nodes.find((n) => !n.active);
      if (!slot) {
        slot = nodes.reduce(
          (oldest, cur) => (cur.born < oldest.born ? cur : oldest),
          nodes[0],
        );
      }
      slot.active = true;
      slot.born = performance.now();
      slot.sx = Math.round(screenX);
      slot.sy = Math.round(screenY);
      slot.el.textContent = text;
      slot.el.style.color = color;
      slot.el.style.fontSize = `${fontSize}px`;
      slot.el.style.opacity = "1";
      slot.el.style.transform = `translate3d(${slot.sx}px, ${slot.sy}px, 0) translate(-50%, -50%)`;
      slot.el.style.display = "block";
    }

    function update(now) {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!n.active) continue;
        const age = now - n.born;
        if (age >= n.life) {
          n.active = false;
          n.el.style.display = "none";
          continue;
        }
        const t = age / n.life;
        const yOff = Math.round(t * 36);
        n.el.style.transform = `translate3d(${n.sx}px, ${n.sy - yOff}px, 0) translate(-50%, -50%)`;
        if (t > 0.65) {
          n.el.style.opacity = String(Math.max(0, 1 - (t - 0.65) / 0.35));
        }
      }
    }

    function reset() {
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].active = false;
        nodes[i].el.style.display = "none";
      }
    }

    return { spawn, update, reset };
  })();

  return {
    profile,
    syncSettingsUI,
    disposeHeavyGpuResources,
    disposeObjectTree,
    Vec3Pool,
    FloatTextPool,
  };
})();

let _peerJsLoadPromise = null;
function ensurePeerJsLoaded() {
  if (typeof Peer !== "undefined") return Promise.resolve(true);
  if (_peerJsLoadPromise) return _peerJsLoadPromise;
  _peerJsLoadPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    s.async = true;
    s.onload = () => resolve(typeof Peer !== "undefined");
    s.onerror = () => {
      _peerJsLoadPromise = null;
      resolve(false);
    };
    document.head.appendChild(s);
  });
  return _peerJsLoadPromise;
}

