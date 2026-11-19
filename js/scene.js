/***********************************************************************
 * 4. THREE.JS SCENE, RENDERER, CAMERA SHAKE & WEATHER
 ***********************************************************************/
const canvas = document.getElementById("game-canvas");
const worldUiLayer = document.getElementById("world-ui-layer");
const minimapCanvas = document.getElementById("minimap-canvas");
const minimapCtx = minimapCanvas.getContext("2d");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f253e);
scene.fog = new THREE.FogExp2(0x0f253e, 0.0017);

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  1,
  500,
);
const CAMERA_OFFSET = new THREE.Vector3(0, 56, 44);
let cameraFocus = new THREE.Vector3(-58, 0, 58);
let cameraLocked = true;
let cameraShake = 0;
let inHeroSelect = true;
let mouseClient = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const panKeys = { up: false, down: false, left: false, right: false };

const ULTRA_MAX_UNLOCK_KEY = "dota3d_ultramax_unlocked_v1";
function isUltraMaxUnlocked() {
  return true;
}
function setUltraMaxUnlocked(val) {
  window._ultraMaxUnlockedMem = Boolean(val);
  try {
    if (val) localStorage.setItem(ULTRA_MAX_UNLOCK_KEY, "1");
    else localStorage.removeItem(ULTRA_MAX_UNLOCK_KEY);
  } catch (e) {}
  syncUltraMaxLockUI();
}
function syncUltraMaxLockUI() {
  const unlocked = isUltraMaxUnlocked();
  const btn = document.querySelector(
    '#settings-quality-grid .setting-pill[data-q="ultramax"]',
  );
  const icon = document.getElementById("ultramax-lock-icon");
  if (btn) {
    btn.title = unlocked
      ? "Ultra Max Unlocked! 4K Shadows, Sparkling Hero Attacks & Mythic Boss Visuals"
      : "LOCKED: Win at least 1 match on Immortal AI difficulty to unlock Ultra Max!";
    btn.classList.toggle("opacity-65", !unlocked);
  }
  if (icon) {
    icon.className = unlocked
      ? "fa-solid fa-crown text-[8px] mr-0.5 text-yellow-300"
      : "fa-solid fa-lock text-[8px] mr-0.5 text-rose-400";
  }
}

const userSettings = {
  theme: "sovereign",
  musicTrack: "auto",
  qualityPreset: LowRamOptimizer.profile.preset,
  renderScale: LowRamOptimizer.profile.resScale,
  cinematicEnabled: LowRamOptimizer.profile.cinematic,
  edgePanEnabled: true,
  edgePanSpeed: 48,
  camShakeEnabled: true,
  floatingTextEnabled: true,
  bloomEnabled: LowRamOptimizer.profile.bloom,
  shadowsEnabled: LowRamOptimizer.profile.shadows,
  waterHqEnabled: LowRamOptimizer.profile.waterHq,
  clutterEnabled: LowRamOptimizer.profile.clutter,
  particlesEnabled: LowRamOptimizer.profile.particles,
  portraits3dEnabled: LowRamOptimizer.profile.portraits3d,
  smartCastEnabled: false,
};
const groundClutterMeshes = [];

function triggerCameraShake(amount = 0.7) {
  if (!userSettings.camShakeEnabled) return;
  cameraShake = Math.min(1.6, Math.max(cameraShake, amount));
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  // MSAA is cheap on tile-based mobile GPUs and is what keeps small character silhouettes clean
  antialias: !LowRamOptimizer.profile.isLowRam,
  stencil: false,
  powerPreference: LowRamOptimizer.profile.isLowRam
    ? "low-power"
    : "high-performance",
  precision: LowRamOptimizer.profile.isLowRam ? "mediump" : "highp",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio || 1,
    _isLowEndMobileBoot ? 0.65 : 1.0,
  ) * (_isLowEndMobileBoot ? 0.7 : 0.85),
);
renderer.shadowMap.enabled = !_isLowEndMobileBoot;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
let _shadowFrameCounter = 0;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;

// Hardware anisotropic filtering scaled to device capability
const rawMaxAniso = renderer.capabilities.getMaxAnisotropy
  ? renderer.capabilities.getMaxAnisotropy()
  : 4;
const maxAniso = _isLowEndMobileBoot
  ? Math.min(2, rawMaxAniso)
  : _isTouchBoot
    ? Math.min(4, rawMaxAniso)
    : Math.min(8, rawMaxAniso);
[cobblePBR, riverbedPBR, marblePBR, barkPBR].forEach((pbr) => {
  if (!pbr) return;
  [pbr.map, pbr.bumpMap, pbr.roughnessMap].forEach((tex) => {
    if (tex) {
      tex.anisotropy = maxAniso;
      tex.needsUpdate = true;
    }
  });
});

// 360-Degree Arena Sky, Solar Key, Radiant/Dire Horizon Bounce & Studio Rim IBL Probe
(function initStudioEnvironment() {
  if (_is1GbMobileBoot) return;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();

    const envGradMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `
                  varying vec3 vDir;
                  void main() {
                      vDir = normalize(position);
                      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                  }
              `,
      fragmentShader: `
                  varying vec3 vDir;
                  void main() {
                      float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
                      vec3 groundCol = mix(vec3(0.08, 0.28, 0.19), vec3(0.32, 0.09, 0.14), smoothstep(-0.3, 0.3, vDir.x - vDir.z));
                      vec3 horizonCol = vec3(0.32, 0.58, 0.86);
                      vec3 zenithCol = vec3(0.09, 0.24, 0.50);
                      vec3 col = mix(groundCol, horizonCol, smoothstep(0.30, 0.54, h));
                      col = mix(col, zenithCol, smoothstep(0.54, 0.92, h));
                      gl_FragColor = vec4(col, 1.0);
                  }
              `,
    });
    envScene.add(
      new THREE.Mesh(new THREE.SphereGeometry(42, 40, 24), envGradMat),
    );

    const warmKey = new THREE.Mesh(
      new THREE.CircleGeometry(15, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfff8dc,
        side: THREE.DoubleSide,
      }),
    );
    warmKey.position.set(18, 25, 20);
    warmKey.lookAt(0, 0, 0);
    envScene.add(warmKey);

    const coolRim = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 20),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        side: THREE.DoubleSide,
      }),
    );
    coolRim.position.set(-22, 16, -18);
    coolRim.lookAt(0, 0, 0);
    envScene.add(coolRim);

    const emeraldBounce = new THREE.Mesh(
      new THREE.CircleGeometry(16, 24),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        side: THREE.DoubleSide,
      }),
    );
    emeraldBounce.position.set(-20, -14, 20);
    emeraldBounce.lookAt(0, 0, 0);
    envScene.add(emeraldBounce);

    const crimsonBounce = new THREE.Mesh(
      new THREE.CircleGeometry(16, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        side: THREE.DoubleSide,
      }),
    );
    crimsonBounce.position.set(20, -14, -20);
    crimsonBounce.lookAt(0, 0, 0);
    envScene.add(crimsonBounce);

    const topSkylight = new THREE.Mesh(
      new THREE.CircleGeometry(20, 32),
      new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        side: THREE.DoubleSide,
      }),
    );
    topSkylight.rotation.x = Math.PI / 2;
    topSkylight.position.set(0, 32, 0);
    envScene.add(topSkylight);

    const envRT = pmrem.fromScene(envScene, 0.03);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1.18;
    pmrem.dispose();
  } catch (e) {}
})();

let composer = null;
let bloomPass = null;
let cinematicPass = null;
let _hdrRT = null;
let _composerDisabled = false;

function ensureComposerReady() {
  if (composer) return true;
  if (_composerDisabled) return false;
  try {
    const initDpr = renderer.getPixelRatio();
    const initW = Math.max(1, Math.floor(window.innerWidth * initDpr));
    const initH = Math.max(1, Math.floor(window.innerHeight * initDpr));
    const msaaSamples = 0; // Disable 4x MSAA on HDR half-float target to eliminate catastrophic GPU resolve stalls
    _hdrRT = new THREE.WebGLRenderTarget(initW, initH, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      samples: msaaSamples,
    });
    composer = new EffectComposer(renderer, _hdrRT);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        Math.floor(window.innerWidth * 0.5),
        Math.floor(window.innerHeight * 0.5),
      ),
      0.42,
      0.62,
      0.86,
    );
    composer.addPass(bloomPass);

    const CinematicFinishShader = {
      uniforms: {
        tDiffuse: { value: null },
        uResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        uStrength: { value: 1.0 },
        uUltraMax: { value: 1.0 },
      },
      vertexShader: `
                  varying vec2 vUv;
                  void main() {
                      vUv = uv;
                      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                  }
              `,
      fragmentShader: `
                  uniform sampler2D tDiffuse;
                  uniform vec2 uResolution;
                  uniform float uStrength;
                  uniform float uUltraMax;
                  varying vec2 vUv;

                  vec3 applyFXAA(sampler2D tex, vec2 uv, vec2 res) {
                      vec2 inverseVP = 1.0 / max(res, vec2(1.0));
                      vec3 rgbM  = texture2D(tex, uv).rgb;
                      vec3 rgbNW = texture2D(tex, uv - inverseVP).rgb;
                      vec3 rgbSE = texture2D(tex, uv + inverseVP).rgb;

                      vec3 lumaW = vec3(0.299, 0.587, 0.114);
                      float lumaM  = dot(rgbM,  lumaW);
                      float lumaNW = dot(rgbNW, lumaW);
                      float lumaSE = dot(rgbSE, lumaW);

                      float diagMin = min(lumaM, min(lumaNW, lumaSE));
                      float diagMax = max(lumaM, max(lumaNW, lumaSE));
                      float range = diagMax - diagMin;
                      if (range < max(0.048, diagMax * 0.125)) {
                          return rgbM; // Fast early-exit: 85% of screen fragments exit in 3 taps!
                      }

                      vec3 rgbNE = texture2D(tex, uv + vec2( 1.0, -1.0) * inverseVP).rgb;
                      vec3 rgbSW = texture2D(tex, uv + vec2(-1.0,  1.0) * inverseVP).rgb;
                      float lumaNE = dot(rgbNE, lumaW);
                      float lumaSW = dot(rgbSW, lumaW);

                      float lumaMin = min(diagMin, min(lumaNE, lumaSW));
                      float lumaMax = max(diagMax, max(lumaNE, lumaSW));

                      vec2 dir;
                      dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
                      dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

                      float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * 0.125), 0.0078);
                      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
                      dir = min(vec2(8.0, 8.0), max(vec2(-8.0, -8.0), dir * rcpDirMin)) * inverseVP;

                      vec3 rgbA = 0.5 * (
                          texture2D(tex, uv + dir * (1.0 / 3.0 - 0.5)).rgb +
                          texture2D(tex, uv + dir * (2.0 / 3.0 - 0.5)).rgb
                      );
                      vec3 rgbB = rgbA * 0.5 + 0.25 * (
                          texture2D(tex, uv + dir * -0.5).rgb +
                          texture2D(tex, uv + dir *  0.5).rgb
                      );
                      float lumaB = dot(rgbB, lumaW);
                      if ((lumaB < lumaMin) || (lumaB > lumaMax)) {
                          return rgbA;
                      }
                      return rgbB;
                  }

                  void main() {
                      vec2 centered = vUv - 0.5;
                      float r2 = dot(centered, centered);
                      vec3 rawRgb = applyFXAA(tDiffuse, vUv, uResolution);
                      if (any(isnan(rawRgb)) || any(isinf(rawRgb))) rawRgb = vec3(0.0);
                      vec3 col = max(rawRgb, vec3(0.0));

                      if (uStrength > 0.01) {
                          vec2 px = 1.0 / max(uResolution, vec2(1.0));
                          if (uUltraMax > 0.85 && max(col.r, max(col.g, col.b)) > 1.05) {
                              vec3 streakL = max(texture2D(tDiffuse, vUv - vec2(px.x * 5.0, 0.0)).rgb, vec3(0.0));
                              vec3 streakR = max(texture2D(tDiffuse, vUv + vec2(px.x * 5.0, 0.0)).rgb, vec3(0.0));
                              vec3 anamorphic = max(max(streakL, streakR) - vec3(1.22), vec3(0.0));
                              col += anamorphic * vec3(0.18, 0.15, 0.10) * uStrength;
                          }

                          gl_FragColor = vec4(col, 1.0);
                          #include <tonemapping_fragment>
                          vec3 ldr = clamp(gl_FragColor.rgb, 0.0, 1.0);

                          float luma = dot(ldr, vec3(0.2126, 0.7152, 0.0722));
                          float maxC = max(ldr.r, max(ldr.g, ldr.b));
                          float minC = min(ldr.r, min(ldr.g, ldr.b));
                          float sat = clamp(maxC - minC, 0.0, 1.0);
                          float vibBoost = 1.0 + (mix(0.10, 0.26, uUltraMax) * (1.0 - sat)) * uStrength;
                          ldr = clamp(mix(vec3(luma), ldr, vibBoost), 0.0, 1.0);

                          if (uUltraMax > 0.85) {
                              vec3 sCurve = ldr * ldr * (3.0 - 2.0 * ldr);
                              ldr = mix(ldr, sCurve, 0.22 * uStrength);
                          }

                          vec3 shadowTint = mix(vec3(0.97, 0.99, 1.03), vec3(0.92, 0.97, 1.07), uUltraMax);
                          vec3 highTint = mix(vec3(1.02, 1.01, 0.98), vec3(1.07, 1.02, 0.94), uUltraMax);
                          ldr *= mix(shadowTint, highTint, smoothstep(0.15, 0.85, luma));

                          float vig = 1.0 - r2 * mix(0.28, 0.40, uUltraMax) * uStrength;
                          ldr *= clamp(vig, 0.78, 1.0);

                          gl_FragColor = vec4(clamp(ldr, 0.0, 1.0), 1.0);
                          #include <colorspace_fragment>
                          return;
                      }

                      gl_FragColor = vec4(col, 1.0);
                      #include <tonemapping_fragment>
                      #include <colorspace_fragment>
                  }
              `,
    };
    cinematicPass = new ShaderPass(CinematicFinishShader);
    composer.addPass(cinematicPass);
    if (
      typeof nxg !== "undefined" &&
      nxg.ready &&
      !nxg.aoPass &&
      nxg.aoOk
    ) {
      nxgBuildAOPass();
    }
    return true;
  } catch (err) {
    composer = null;
    _composerDisabled = true;
    return false;
  }
}

function disposeComposerResources() {
  if (!composer) return;
  try {
    if (nxg && nxg.aoPass) {
      nxg.aoPass.dispose();
      nxg.aoPass = null;
    }
    if (bloomPass && bloomPass.dispose) bloomPass.dispose();
    if (_hdrRT) _hdrRT.dispose();
    if (composer.renderTarget1) composer.renderTarget1.dispose();
    if (composer.renderTarget2) composer.renderTarget2.dispose();
  } catch (e) {}
  composer = null;
  bloomPass = null;
  cinematicPass = null;
  _hdrRT = null;
}

