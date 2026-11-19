/***********************************************************************
 * 15. NEXT-GEN LAYER: DEPTH AO + CLOUD SHADOWS, GPU PARTICLES, GLOW VFX,
 *     FLASH LIGHTS, WIND GRASS, HERO RIM SHADING & ADAPTIVE RESOLUTION
 ***********************************************************************/
const nxg = {
  ready: false,
  time: 0,
  aoPass: null,
  aoOk: true,
  tex: {},
  matPool: new Map(),
  parts: null,
  partHead: 0,
  flashes: [],
  grass: [],
  grassUniforms: null,
  dynResScale: 1.0,
  dynLowTime: 0,
  dynHighTime: 0,
  dynHold: 0,
  dynProbe: null,
};

function nxgCanvasTex(size, draw) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function nxgBuildTextures() {
  // Soft radial glow
  nxg.tex.glow = nxgCanvasTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(
      s / 2,
      s / 2,
      0,
      s / 2,
      s / 2,
      s / 2,
    );
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,0.62)");
    g.addColorStop(0.55, "rgba(255,255,255,0.16)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  // Expanding shockwave: bright leading edge, soft trailing fill
  nxg.tex.ring = nxgCanvasTex(256, (ctx, s) => {
    const g = ctx.createRadialGradient(
      s / 2,
      s / 2,
      0,
      s / 2,
      s / 2,
      s / 2,
    );
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.46, "rgba(255,255,255,0.05)");
    g.addColorStop(0.74, "rgba(255,255,255,0.26)");
    g.addColorStop(0.88, "rgba(255,255,255,1)");
    g.addColorStop(0.94, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  // Thin selection ring with inner halo
  nxg.tex.selRing = nxgCanvasTex(512, (ctx, s) => {
    const g = ctx.createRadialGradient(
      s / 2,
      s / 2,
      0,
      s / 2,
      s / 2,
      s / 2,
    );
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.10)");
    g.addColorStop(0.7, "rgba(255,255,255,0.22)");
    g.addColorStop(0.78, "rgba(255,255,255,1)");
    g.addColorStop(0.84, "rgba(255,255,255,0.9)");
    g.addColorStop(0.9, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  // Arcane rune circle decal
  nxg.tex.rune = nxgCanvasTex(512, (ctx, s) => {
    const c = s / 2;
    const fill = ctx.createRadialGradient(c, c, 0, c, c, c);
    fill.addColorStop(0, "rgba(255,255,255,0.30)");
    fill.addColorStop(0.7, "rgba(255,255,255,0.12)");
    fill.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 10;
    [
      [0.9, 7],
      [0.8, 2.5],
      [0.52, 3],
    ].forEach(([r, w]) => {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(c, c, c * r, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Two interlocked triangles
    ctx.lineWidth = 3;
    for (let t = 0; t < 2; t++) {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = (i / 3) * Math.PI * 2 + (t * Math.PI) / 3 - Math.PI / 2;
        const x = c + Math.cos(a) * c * 0.78,
          y = c + Math.sin(a) * c * 0.78;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Glyph ticks between the two outer rings
    ctx.lineWidth = 4;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r0 = c * (i % 3 === 0 ? 0.815 : 0.835),
        r1 = c * 0.885;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      ctx.beginPath();
      ctx.arc(
        c + Math.cos(a) * c * 0.52,
        c + Math.sin(a) * c * 0.52,
        c * 0.045,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  });
  // Vertical beam: soft sides, hot core
  nxg.tex.beam = nxgCanvasTex(128, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.18, "rgba(255,255,255,0.55)");
    g.addColorStop(0.8, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  // Blade-trail crescent (UVs of a ring sector run radially, so fade inner -> outer)
  nxg.tex.slash = nxgCanvasTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(
      s / 2,
      s / 2,
      s * 0.2,
      s / 2,
      s / 2,
      s / 2,
    );
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.55, "rgba(255,255,255,0.18)");
    g.addColorStop(0.9, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  Object.values(nxg.tex).forEach((t) => registerSharedAsset(t));
}

// Pooled additive glow materials keyed by texture (returned to the pool by the effect's final update)
function nxgGlowMat(texKey, colorHex, opacity, boost = 1.7) {
  let pool = nxg.matPool.get(texKey);
  if (!pool) {
    pool = [];
    nxg.matPool.set(texKey, pool);
  }
  const mat =
    pool.pop() ||
    registerSharedAsset(
      new THREE.MeshBasicMaterial({
        map: nxg.tex[texKey],
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
  mat.color.setHex(colorHex).multiplyScalar(boost);
  mat.opacity = opacity;
  mat.userData.nxgKey = texKey;
  return mat;
}
function nxgReleaseMat(mat) {
  const pool = nxg.matPool.get(mat.userData.nxgKey);
  if (pool && pool.length < 96) pool.push(mat);
}

/* ---------- GPU particle system: one draw call, zero per-frame CPU work ---------- */
const NXG_PART_CAP = 3072;
function nxgBuildParticles() {
  const geo = new THREE.BufferGeometry();
  const mk = (n) =>
    new THREE.BufferAttribute(
      new Float32Array(NXG_PART_CAP * n),
      n,
    ).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", mk(3));
  geo.setAttribute("aVel", mk(3));
  geo.setAttribute("aMeta", mk(4));
  geo.setAttribute("aColor", mk(3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), MAP_HALF * 2);
  geo.boundingBox = new THREE.Box3(
    new THREE.Vector3(-MAP_HALF * 2, -100, -MAP_HALF * 2),
    new THREE.Vector3(MAP_HALF * 2, 200, MAP_HALF * 2),
  );
  geo.computeBoundingSphere = () => geo.boundingSphere;
  geo.computeBoundingBox = () => geo.boundingBox;
  const meta = geo.attributes.aMeta.array;
  for (let i = 0; i < NXG_PART_CAP; i++) meta[i * 4] = -1000;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPxScale: { value: 600 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
              attribute vec3 aVel; attribute vec4 aMeta; attribute vec3 aColor;
              uniform float uTime; uniform float uPxScale;
              varying vec3 vCol; varying float vA;
              void main() {
                  float t = uTime - aMeta.x;
                  float p = t / max(aMeta.y, 0.001);
                  float alive = step(0.0, p) * step(p, 1.0);
                  float tt = max(t, 0.0);
                  vec3 pos = position + aVel * (1.0 - exp(-1.9 * tt)) / 1.9;
                  pos.y -= 0.5 * aMeta.w * tt * tt;
                  vec4 mv = viewMatrix * vec4(pos, 1.0);
                  gl_Position = projectionMatrix * mv;
                  gl_PointSize = alive * aMeta.z * (1.0 - p * 0.6) * uPxScale / max(1.0, -mv.z);
                  if (alive < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
                  vCol = aColor;
                  vA = alive * (1.0 - p) * smoothstep(0.0, 0.06, p);
              }`,
    fragmentShader: `
              varying vec3 vCol; varying float vA;
              void main() {
                  float d = length(gl_PointCoord - 0.5) * 2.0;
                  float a = pow(max(0.0, 1.0 - d), 1.7) * vA;
                  if (a < 0.004) discard;
                  gl_FragColor = vec4(vCol * (1.0 + (1.0 - d) * 1.4), a);
                  #include <tonemapping_fragment>
                  #include <colorspace_fragment>
              }`,
  });
  nxg.parts = new THREE.Points(geo, mat);
  nxg.parts.frustumCulled = false;
  nxg.parts.renderOrder = 6;
  scene.add(nxg.parts);
}

const _nxgCol = new THREE.Color();
// opts: speed, up, life, size, gravity, spread (start radius), yOff
function nxgEmit(pos, colorHex, count, opts = {}) {
  if (!nxg.parts || userSettings.qualityPreset === "ultralight" || !pos) return;
  const posX = Number.isFinite(pos.x) ? pos.x : 0;
  const posY = Number.isFinite(pos.y) ? pos.y : 0;
  const posZ = Number.isFinite(pos.z) ? pos.z : 0;
  if (
    userSettings.qualityPreset === "potato" ||
    userSettings.qualityPreset === "performance"
  ) {
    count = Math.max(1, Math.ceil(count * 0.45));
  }
  const g = nxg.parts.geometry;
  const P = g.attributes.position.array,
    V = g.attributes.aVel.array,
    M = g.attributes.aMeta.array,
    C = g.attributes.aColor.array;
  const speed = opts.speed ?? 9,
    up = opts.up ?? 7,
    life = opts.life ?? 0.7,
    size = opts.size ?? 0.5;
  const grav = opts.gravity ?? 14,
    spread = opts.spread ?? 0.25,
    yOff = opts.yOff ?? 1.4;
  _nxgCol.setHex(colorHex);
  for (let n = 0; n < count; n++) {
    const i = nxg.partHead;
    nxg.partHead = (nxg.partHead + 1) % NXG_PART_CAP;
    const a = Math.random() * Math.PI * 2,
      r = Math.sqrt(Math.random());
    P[i * 3] = posX + Math.cos(a) * r * spread;
    P[i * 3 + 1] = posY + yOff + (Math.random() - 0.5) * spread;
    P[i * 3 + 2] = posZ + Math.sin(a) * r * spread;
    const sp = speed * (0.35 + Math.random() * 0.65);
    V[i * 3] = Math.cos(a) * sp;
    V[i * 3 + 1] = up * (0.3 + Math.random() * 0.7);
    V[i * 3 + 2] = Math.sin(a) * sp;
    M[i * 4] = nxg.time;
    M[i * 4 + 1] = life * (0.6 + Math.random() * 0.4);
    M[i * 4 + 2] = size * (0.6 + Math.random() * 0.8);
    M[i * 4 + 3] = grav;
    const w = Math.random() * 0.35;
    C[i * 3] = _nxgCol.r + (1 - _nxgCol.r) * w;
    C[i * 3 + 1] = _nxgCol.g + (1 - _nxgCol.g) * w;
    C[i * 3 + 2] = _nxgCol.b + (1 - _nxgCol.b) * w;
  }
  g.attributes.position.needsUpdate = true;
  g.attributes.aVel.needsUpdate = true;
  g.attributes.aMeta.needsUpdate = true;
  g.attributes.aColor.needsUpdate = true;
}

/* ---------- Fixed pool of flash lights (constant light count => no shader recompiles) ---------- */
function nxgBuildFlashLights() {
  for (let i = 0; i < 2; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 30, 1.6);
    l.position.set(0, -200, 0);
    scene.add(l);
    nxg.flashes.push({ light: l, t: 1, dur: 1, peak: 0 });
  }
  _lightBudgetKey = "";
}
function nxgFlash(x, y, z, colorHex, peak = 30, dist = 26, dur = 0.34) {
  if (
    !nxg.flashes.length ||
    userSettings.qualityPreset === "ultralight" ||
    userSettings.qualityPreset === "potato"
  )
    return;
  let best = nxg.flashes[0];
  for (let i = 1; i < nxg.flashes.length; i++) {
    if (nxg.flashes[i].t / nxg.flashes[i].dur > best.t / best.dur)
      best = nxg.flashes[i];
  }
  if (best.t < best.dur * 0.35 && best.peak > peak) return;
  best.light.color.setHex(colorHex);
  best.light.distance = dist;
  best.light.position.set(x, y, z);
  best.t = 0;
  best.dur = dur;
  best.peak = peak;
}

/* ---------- Depth-based ambient occlusion + drifting cloud shadows (one half-res pass + composite) ---------- */
function nxgBuildAOPass() {
  if (!composer || !renderer.capabilities.isWebGL2) {
    nxg.aoOk = false;
    return;
  }
  try {
    [composer.renderTarget1, composer.renderTarget2].forEach((rt) => {
      rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height);
      rt.depthTexture.minFilter = THREE.NearestFilter;
      rt.depthTexture.magFilter = THREE.NearestFilter;
      rt.dispose();
    });
    const aoRT = new THREE.WebGLRenderTarget(4, 4, {
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-1, -1, 0, 3, -1, 0, -1, 3, 0],
        3,
      ),
    );
    tri.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2),
    );
    const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const vs =
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
    const aoMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDepth: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uProjY: { value: 1 },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 2.1 },
        uIntensity: { value: 1.25 },
      },
      vertexShader: vs,
      fragmentShader: `
                  uniform sampler2D tDepth; uniform mat4 uInvProj; uniform float uProjY;
                  uniform vec2 uTexel; uniform float uRadius; uniform float uIntensity;
                  varying vec2 vUv;
                  vec3 vpos(vec2 uv) {
                      float d = texture2D(tDepth, uv).x;
                      vec4 c = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
                      return c.xyz / c.w;
                  }
                  void main() {
                      if (texture2D(tDepth, vUv).x >= 0.99995) { gl_FragColor = vec4(1.0); return; }
                      vec3 p = vpos(vUv);
                      vec3 pr = vpos(vUv + vec2(uTexel.x, 0.0)), pl = vpos(vUv - vec2(uTexel.x, 0.0));
                      vec3 pu = vpos(vUv + vec2(0.0, uTexel.y)), pd = vpos(vUv - vec2(0.0, uTexel.y));
                      vec3 dx = abs(pr.z - p.z) < abs(p.z - pl.z) ? pr - p : p - pl;
                      vec3 dy = abs(pu.z - p.z) < abs(p.z - pd.z) ? pu - p : p - pd;
                      vec3 n = normalize(cross(dx, dy));
                      float rUv = uRadius * uProjY * 0.5 / max(1.0, -p.z);
                      float aspect = uTexel.x / uTexel.y;
                      vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
                      float ang = (cell.x + cell.y * 4.0) * 0.3927 + 0.2;
                      float occ = 0.0;
                      float bias = 0.05 + 0.0018 * -p.z;
                      for (int i = 0; i < 6; i++) {
                          float fi = (float(i) + 0.5) / 6.0;
                          float a = ang + float(i) * 2.39996323;
                          vec2 off = vec2(cos(a) * aspect, sin(a)) * (sqrt(fi) * rUv);
                          vec3 v = vpos(vUv + off) - p;
                          float vv = dot(v, v);
                          float w = max(0.0, 1.0 - vv / (uRadius * uRadius));
                          occ += max(0.0, dot(v, n) - bias) * inversesqrt(vv + 0.0001) * w;
                      }
                      gl_FragColor = vec4(vec3(1.0 - clamp(occ * 0.1667 * uIntensity, 0.0, 1.0)), 1.0);
                  }`,
    });
    const compMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        tAO: { value: aoRT.texture },
        tDepth: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uAOTexel: { value: new THREE.Vector2() },
        uStrength: { value: 0.85 },
        uCloud: { value: 0.0 },
        uTime: { value: 0 },
        uNearFar: { value: new THREE.Vector2(1, 500) },
        uHaze: { value: 0.0 },
        uHazeCol: { value: new THREE.Color(0x6a93c4) },
      },
      vertexShader: vs,
      fragmentShader: `
                  uniform sampler2D tDiffuse; uniform sampler2D tAO; uniform sampler2D tDepth;
                  uniform mat4 uInvProj; uniform mat4 uCamWorld; uniform vec2 uAOTexel;
                  uniform float uStrength; uniform float uCloud; uniform float uTime; uniform vec2 uNearFar;
                  uniform float uHaze; uniform vec3 uHazeCol;
                  varying vec2 vUv;
                  float linZ(float d) { return uNearFar.x * uNearFar.y / (uNearFar.y - d * (uNearFar.y - uNearFar.x)); }
                  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
                  float vn(vec2 p) {
                      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                      return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
                  }
                  void main() {
                      vec4 c = texture2D(tDiffuse, vUv);
                      float d0 = texture2D(tDepth, vUv).x;
                      if (d0 >= 0.99995) { gl_FragColor = c; return; }
                      float z0 = linZ(d0);
                      vec4 depthTaps = vec4(
                          texture2D(tDepth, vUv + vec2(-uAOTexel.x, -uAOTexel.y)).x,
                          texture2D(tDepth, vUv + vec2( uAOTexel.x, -uAOTexel.y)).x,
                          texture2D(tDepth, vUv + vec2(-uAOTexel.x,  uAOTexel.y)).x,
                          texture2D(tDepth, vUv + vec2( uAOTexel.x,  uAOTexel.y)).x
                      );
                      vec4 aoTaps = vec4(
                          texture2D(tAO, vUv + vec2(-uAOTexel.x, -uAOTexel.y)).r,
                          texture2D(tAO, vUv + vec2( uAOTexel.x, -uAOTexel.y)).r,
                          texture2D(tAO, vUv + vec2(-uAOTexel.x,  uAOTexel.y)).r,
                          texture2D(tAO, vUv + vec2( uAOTexel.x,  uAOTexel.y)).r
                      );
                      vec4 zDelta = abs(depthTaps - vec4(d0)) * (200.0 * (1.0 - d0));
                      vec4 weights = 1.0 / (1.0 + zDelta);
                      float ao = dot(aoTaps, weights) / max(dot(weights, vec4(1.0)), 0.0001);
                      ao = mix(1.0, ao, uStrength);
                      // Shadowed creases pick up a cool sky tint instead of going flat grey
                      c.rgb *= mix(vec3(0.20, 0.25, 0.38), vec3(1.0), ao);
                      if (uCloud > 0.01) {
                          vec4 vp = uInvProj * vec4(vUv * 2.0 - 1.0, d0 * 2.0 - 1.0, 1.0);
                          vec3 wp = (uCamWorld * vec4(vp.xyz / vp.w, 1.0)).xyz;
                          vec2 q = wp.xz * 0.017 + uTime * vec2(0.011, 0.0065);
                          float cl = vn(q);
                          c.rgb *= 1.0 - smoothstep(0.52, 0.80, cl) * uCloud;
                      }
                      // Aerial perspective: far ground eases toward the sky colour, giving the map real depth
                      if (uHaze > 0.001) c.rgb = mix(c.rgb, uHazeCol, smoothstep(58.0, 150.0, z0) * uHaze);
                      gl_FragColor = c;
                  }`,
    });
    const fsMesh = new THREE.Mesh(tri, aoMat);
    fsMesh.frustumCulled = false;
    nxg.aoPass = {
      enabled: false,
      needsSwap: true,
      clear: false,
      renderToScreen: false,
      cloud: 0,
      haze: 0,
      hazeCol: new THREE.Color(0x6a93c4),
      setSize(w, h) {
        const hw = Math.max(2, Math.floor(w * 0.35)),
          hh = Math.max(2, Math.floor(h * 0.35));
        aoRT.setSize(hw, hh);
        aoMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
        compMat.uniforms.uAOTexel.value.set(1 / hw, 1 / hh);
      },
      render(r, writeBuffer, readBuffer) {
        const depth = readBuffer.depthTexture;
        aoMat.uniforms.tDepth.value = depth;
        aoMat.uniforms.uInvProj.value.copy(
          camera.projectionMatrixInverse,
        );
        aoMat.uniforms.uProjY.value = camera.projectionMatrix.elements[5];
        fsMesh.material = aoMat;
        r.setRenderTarget(aoRT);
        r.render(fsMesh, fsCam);
        compMat.uniforms.tDiffuse.value = readBuffer.texture;
        compMat.uniforms.tDepth.value = depth;
        compMat.uniforms.uInvProj.value.copy(
          camera.projectionMatrixInverse,
        );
        compMat.uniforms.uCamWorld.value.copy(camera.matrixWorld);
        compMat.uniforms.uNearFar.value.set(camera.near, camera.far);
        compMat.uniforms.uTime.value = nxg.time;
        compMat.uniforms.uCloud.value = this.cloud;
        compMat.uniforms.uHaze.value = this.haze;
        compMat.uniforms.uHazeCol.value.copy(this.hazeCol);
        fsMesh.material = compMat;
        r.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        r.render(fsMesh, fsCam);
      },
      dispose() {
        aoRT.dispose();
        aoMat.dispose();
        compMat.dispose();
      },
    };
    composer.insertPass(nxg.aoPass, 1);
  } catch (e) {
    nxg.aoPass = null;
    nxg.aoOk = false;
  }
}

/* ---------- Wind-swept instanced grass (chunked for frustum culling, density scales with preset) ---------- */
function nxgBuildGrass() {
  const BLADES = 3;
  const pos = [],
    uv = [],
    col = [],
    nrm = [];
  for (let b = 0; b < BLADES; b++) {
    const a = (b / BLADES) * Math.PI * 2 + 0.4;
    const lean = 0.14 + b * 0.05,
      hgt = 0.5 + b * 0.1,
      hw = 0.085;
    const cx = Math.cos(a),
      sz = Math.sin(a);
    const px = -sz * hw,
      pz = cx * hw;
    pos.push(
      px + cx * 0.05,
      0,
      pz + sz * 0.05,
      -px + cx * 0.05,
      0,
      -pz + sz * 0.05,
      cx * lean,
      hgt,
      sz * lean,
    );
    uv.push(0, 0, 1, 0, 0.5, 1);
    col.push(0.72, 0.76, 0.68, 0.72, 0.76, 0.68, 1.08, 1.12, 1.05);
    nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));

  nxg.grassUniforms = {
    uTime: { value: 0 },
    uHero: { value: new THREE.Vector3(0, -99, 0) },
    uWind: { value: 1.0 },
    uNightAmt:
      terrainShaderUniforms && terrainShaderUniforms.uNightAmt
        ? terrainShaderUniforms.uNightAmt
        : { value: 0.0 },
    uTowers:
      terrainShaderUniforms && terrainShaderUniforms.uTowers
        ? terrainShaderUniforms.uTowers
        : {
            value: Array.from(
              { length: 12 },
              () => new THREE.Vector3(0, 0, 0),
            ),
          },
  };
  // No depth write + drawn after other solid geometry: rings, runes and range circles always read on top of the turf,
  // and the ambient-occlusion pass sees the ground instead of thousands of moving blades.
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = nxg.grassUniforms.uTime;
    shader.uniforms.uHero = nxg.grassUniforms.uHero;
    shader.uniforms.uWind = nxg.grassUniforms.uWind;
    shader.uniforms.uNightAmt = nxg.grassUniforms.uNightAmt;
    shader.uniforms.uTowers = nxg.grassUniforms.uTowers;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime; uniform vec3 uHero; uniform float uWind; varying vec2 vGrassXZ;",
      )
      .replace(
        "#include <project_vertex>",
        `
                  vec4 gW = modelMatrix * (instanceMatrix * vec4(transformed, 1.0));
                  vGrassXZ = gW.xz;
                  float gH = uv.y;
                  float gPh = gW.x * 0.19 + gW.z * 0.15;
                  float gSway = sin(uTime * 1.7 + gPh) * 0.6 + sin(uTime * 3.9 + gPh * 2.7) * 0.25 + sin(uTime * 0.6 + gPh * 0.31) * 0.5;
                  gW.x += gSway * 0.20 * gH * uWind;
                  gW.z += gSway * 0.11 * gH * uWind;
                  vec2 gD = gW.xz - uHero.xz;
                  float gPush = (1.0 - smoothstep(0.5, 2.7, length(gD))) * gH;
                  gW.xz += normalize(gD + vec2(0.0001)) * gPush * 0.85;
                  gW.y -= gPush * 0.34;
                  vec4 mvPosition = viewMatrix * gW;
                  gl_Position = projectionMatrix * mvPosition;`,
      );
    // Blades always shade like the ground they grow from, whichever face is showing
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uNightAmt;\nuniform vec3 uTowers[12];\nvarying vec2 vGrassXZ;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
                  if (uNightAmt > 0.01) {
                      float gTowGlow = 0.0;
                      for (int ti = 0; ti < 12; ti++) {
                          float tRad = uTowers[ti].z;
                          if (tRad > 0.5) {
                              float dTow = length(vGrassXZ - uTowers[ti].xy);
                              gTowGlow = max(gTowGlow, 1.0 - smoothstep(tRad * 0.42, tRad, dTow));
                          }
                      }
                      diffuseColor.rgb *= mix(1.0, 0.44, uNightAmt * (1.0 - gTowGlow));
                  }`,
      )
      .replace(
        "#include <normal_fragment_begin>",
        "#include <normal_fragment_begin>\nnormal = normalize(vNormal);",
      );
  };
  mat.customProgramCacheKey = () => "nxggrass";

  const cRadDeep = new THREE.Color(0x1b4222),
    cRadGrass = new THREE.Color(0x2b5e28),
    cRadSun = new THREE.Color(0x4b7d2c);
  const cDireA = new THREE.Color(0x3a1420),
    cDireB = new THREE.Color(0x6a1e2a),
    cDireEmber = new THREE.Color(0x9a3a20);
  const GRID = 6,
    cell = (MAP_HALF * 2) / GRID;
  const buckets = Array.from({ length: GRID * GRID }, () => []);
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const TARGET = _isLowEndMobileBoot
    ? 45000
    : _isTouchBoot
      ? 85000
      : 190000;
  // x, z, radius of every place turf must stay clear: neutral camps (mirrored), shops, boss pit
  const CLEAR = [
    -50, -50, 14.5, -126, 148, 7.5, 126, -148, 7.5, 64, 24, 8.0, -64, -24,
    8.0,
  ];
  [
    [-158, 56],
    [-120, 46],
    [-164, 10],
    [-56, 158],
    [-152, -36],
    [-10, 164],
    [-84, 22],
    [-24, 86],
    [-108, 66],
    [-124, -6],
    [-94, -64],
  ].forEach(([cx, cz]) => {
    CLEAR.push(cx, cz, 9.5, -cx, -cz, 9.5);
  });
  const c = new THREE.Color();
  let placed = 0;
  for (let tries = 0; tries < TARGET * 3 && placed < TARGET; tries++) {
    const x = (rnd() - 0.5) * 344,
      z = (rnd() - 0.5) * 344;
    const dRiver = Math.abs(x - z) / Math.SQRT2,
      dLane = Math.abs(x + z) / Math.SQRT2;
    if (dLane < 8.7 || dRiver < 11.6) continue;
    if (
      Math.hypot(x + 140, z - 140) < 32 ||
      Math.hypot(x - 140, z + 140) < 32
    )
      continue;
    let cleared = false;
    for (let ci = 0; ci < CLEAR.length; ci += 3) {
      const cd = Math.hypot(x - CLEAR[ci], z - CLEAR[ci + 1]),
        cr = CLEAR[ci + 2];
      if (
        cd < cr &&
        (cd < cr * 0.72 || rnd() < 1 - (cd - cr * 0.72) / (cr * 0.28))
      ) {
        cleared = true;
        break;
      }
    }
    if (cleared) continue;
    const loam = Math.sin(x * 0.18) * Math.cos(z * 0.18);
    if (loam > 0.62 && rnd() < 0.85) continue;
    const blend = THREE.MathUtils.clamp((x - z + 16) / 32, 0, 1);
    const dire = rnd() < blend;
    if (dire && rnd() < 0.62) continue;
    const y = getTerrainHeightAt(x, z);
    if (y > 1.5) continue;
    if (dire) {
      c.copy(cDireA)
        .lerp(cDireB, rnd())
        .lerp(cDireEmber, rnd() < 0.12 ? 0.8 : 0.0)
        .multiplyScalar(1.15);
    } else {
      const meadow = (Math.sin(x * 0.13 + Math.cos(z * 0.09)) + 1) * 0.5;
      const glade = Math.max(0, Math.cos(z * 0.1 - x * 0.08));
      c.copy(cRadDeep)
        .lerp(cRadGrass, meadow)
        .lerp(cRadSun, glade * 0.52 + rnd() * 0.25)
        .multiplyScalar(1.22 + rnd() * 0.3);
    }
    const gx = Math.min(GRID - 1, Math.floor((x + MAP_HALF) / cell)),
      gz = Math.min(GRID - 1, Math.floor((z + MAP_HALF) / cell));
    buckets[gz * GRID + gx].push(
      x,
      y - 0.04,
      z,
      rnd() * Math.PI * 2,
      (dire ? 0.6 : 0.72) + rnd() * 0.58,
      c.r,
      c.g,
      c.b,
    );
    placed++;
  }
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0),
    sc = new THREE.Vector3(),
    pv = new THREE.Vector3();
  buckets.forEach((arr) => {
    const n = arr.length / 8;
    if (n === 0) return;
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      q.setFromAxisAngle(up, arr[o + 3]);
      sc.set(arr[o + 4], arr[o + 4] * (0.8 + (i % 7) * 0.06), arr[o + 4]);
      m4.compose(pv.set(arr[o], arr[o + 1], arr[o + 2]), q, sc);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.setRGB(arr[o + 5], arr[o + 6], arr[o + 7]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 1;
    mesh.computeBoundingSphere();
    mesh.userData.nxgMax = n;
    mesh.raycast = () => {};
    scene.add(mesh);
    nxg.grass.push(mesh);
    groundClutterMeshes.push(mesh);
  });
}

let _nxgGrassBuilt = false;
function ensureNxgGrassBuilt() {
  if (_nxgGrassBuilt) return;
  _nxgGrassBuilt = true;
  try {
    nxgBuildGrass();
  } catch (e) {}
}

function nxgApplyQuality(preset) {
  const dens =
    preset === "ultramax"
      ? 1.0
      : preset === "ultra"
        ? 0.68
        : preset === "high"
          ? 0.46
          : preset === "balanced"
            ? 0.27
            : preset === "performance"
              ? 0.12
              : 0;
  if (dens > 0 && !_nxgGrassBuilt) {
    ensureNxgGrassBuilt();
  }
  for (let i = 0; i < nxg.grass.length; i++) {
    const m = nxg.grass[i];
    m.count = Math.floor(m.userData.nxgMax * dens);
    m.visible = dens > 0 && userSettings.clutterEnabled;
  }
  const aoEl = document.getElementById("set-ao");
  if (aoEl) aoEl.checked = preset === "ultramax" || preset === "ultra";
  document.body.classList.toggle(
    "nxg-lite",
    preset === "ultralight" ||
      preset === "potato" ||
      preset === "performance" ||
      preset === "balanced",
  );
  nxg.dynResScale = 1.0;
  nxg.dynLowTime = 0;
  nxg.dynHighTime = 0;
  nxg.dynHold = 0;
  nxg.dynProbe = null;
}

function nxgSyncSettings() {
  const aoEl = document.getElementById("set-ao");
  const wantAo = !!(aoEl && aoEl.checked) && nxg.aoOk;
  if (wantAo && !composer) ensureComposerReady();
  userSettings.aoEnabled = wantAo && !!nxg.aoPass;
  const drEl = document.getElementById("set-dynres");
  userSettings.dynResEnabled = drEl ? drEl.checked : true;
  if (nxg.aoPass) {
    nxg.aoPass.enabled = userSettings.aoEnabled;
  }
  if (userSettings.qualityPreset !== "ultralight") {
    if (!nxg.parts && nxg.ready) nxgBuildParticles();
    if (!nxg.flashes.length && nxg.ready) nxgBuildFlashLights();
  }
  if (nxg.parts) {
    nxg.parts.visible = userSettings.qualityPreset !== "ultralight";
    nxg.parts.material.uniforms.uPxScale.value =
      (renderer.domElement.height * 0.5) /
      Math.tan((camera.fov * 0.5 * Math.PI) / 180);
  }
  if (
    userSettings.clutterEnabled &&
    !_nxgGrassBuilt &&
    !["ultralight", "potato"].includes(userSettings.qualityPreset)
  ) {
    ensureNxgGrassBuilt();
    nxgApplyQuality(userSettings.qualityPreset);
  }
  for (let i = 0; i < nxg.grass.length; i++) {
    nxg.grass[i].visible =
      userSettings.clutterEnabled && nxg.grass[i].count > 0;
  }
}

function nxgInit() {
  if (nxg.ready) return;
  nxg.ready = true;
  nxgBuildTextures();
  if (userSettings.qualityPreset !== "ultralight") {
    nxgBuildParticles();
    nxgBuildFlashLights();
  }
  nxgApplyQuality(userSettings.qualityPreset);
  window.updateGraphicsSettings();
}

// Called once per rendered frame, right before the scene is drawn
let _cachedPxScaleH = -1,
  _cachedPxScaleFov = -1,
  _cachedPxScaleVal = 600;
function getCachedPxScale() {
  const h = renderer.domElement.height;
  if (h !== _cachedPxScaleH || camera.fov !== _cachedPxScaleFov) {
    _cachedPxScaleH = h;
    _cachedPxScaleFov = camera.fov;
    _cachedPxScaleVal =
      (h * 0.5) / Math.tan((camera.fov * 0.5 * Math.PI) / 180);
  }
  return _cachedPxScaleVal;
}
function nxgTick(dt) {
  if (!nxg.ready) return;
  nxg.time += dt;
  const pxScale = getCachedPxScale();
  if (nxg.parts) {
    nxg.parts.material.uniforms.uTime.value = nxg.time;
    nxg.parts.material.uniforms.uPxScale.value = pxScale;
  }
  if (nxg.grassUniforms) {
    nxg.grassUniforms.uTime.value = nxg.time;
    nxg.grassUniforms.uWind.value =
      currentWeather === "rain"
        ? 1.7
        : currentWeather === "mist"
          ? 0.6
          : 1.0;
    if (
      typeof playerHero !== "undefined" &&
      playerHero &&
      !playerHero.dead &&
      !inHeroSelect
    )
      nxg.grassUniforms.uHero.value.copy(playerHero.mesh.position);
    else nxg.grassUniforms.uHero.value.set(0, -99, 0);
  }
  if (
    typeof ambientMotes !== "undefined" &&
    ambientMotes &&
    ambientMotes.material.uniforms
  ) {
    ambientMotes.material.uniforms.uOpacity.value =
      ambientMotes.material.opacity;
    ambientMotes.material.uniforms.uPxScale.value = pxScale;
  }
  for (let i = 0; i < nxg.flashes.length; i++) {
    const f = nxg.flashes[i];
    if (f.t >= f.dur) {
      if (f.light.intensity !== 0) f.light.intensity = 0;
      continue;
    }
    f.t += dt;
    const p = Math.min(1, f.t / f.dur);
    f.light.intensity = f.peak * (1 - p) * (1 - p);
  }
  nxgUpdateDanger();
  if (nxg.aoPass) {
    const day = isNightTime ? 0.0 : 1.0;
    const qNow = userSettings.qualityPreset;
    const target =
      currentWeather === "clear" && !inHeroSelect
        ? (qNow === "ultramax" ? 0.3 : 0.24) * day
        : 0.0;
    nxg.aoPass.cloud +=
      (target - nxg.aoPass.cloud) * Math.min(1, dt * 0.8);
    const sunF =
      (Math.cos((cycleClock / DAY_CYCLE_DURATION) * Math.PI) + 1) * 0.5;
    nxg.aoPass.hazeCol.setRGB(
      0.03 + sunF * 0.23,
      0.05 + sunF * 0.36,
      0.1 + sunF * 0.5,
    );
    nxg.aoPass.haze = inHeroSelect
      ? 0.0
      : qNow === "ultramax"
        ? 0.15
        : qNow === "ultra"
          ? 0.08
          : 0.0;
  }
  // Adaptive resolution: trade pixels for frame rate, and give them back when there is headroom.
  // Every drop is verified: if the frame rate does not improve (display capped or CPU-bound), it is undone.
  if (
    userSettings.dynResEnabled &&
    !inTitleScreen &&
    typeof _fpsSmooth === "number"
  ) {
    if (nxg.dynHold > 0) nxg.dynHold -= dt;
    if (nxg.dynProbe) {
      nxg.dynProbe.t += dt;
      if (nxg.dynProbe.t > 3) {
        if (_fpsSmooth < nxg.dynProbe.fps * 1.07) {
          nxg.dynResScale = nxg.dynProbe.prev;
          nxg.dynHold = 1e9;
          applyRendererResolution();
        }
        nxg.dynProbe = null;
        nxg.dynLowTime = 0;
        nxg.dynHighTime = 0;
      }
    } else if (!(nxg.dynHold > 0)) {
      if (_fpsSmooth < 58) {
        nxg.dynLowTime += dt;
        nxg.dynHighTime = 0;
      } else if (_fpsSmooth > 85) {
        nxg.dynHighTime += dt;
        nxg.dynLowTime = 0;
      } else {
        nxg.dynLowTime = Math.max(0, nxg.dynLowTime - dt);
        nxg.dynHighTime = 0;
      }
      if (nxg.dynLowTime > 1.8 && nxg.dynResScale > 0.6) {
        nxg.dynProbe = { prev: nxg.dynResScale, fps: _fpsSmooth, t: 0 };
        nxg.dynResScale = Math.max(0.6, nxg.dynResScale - 0.08);
        nxg.dynLowTime = 0;
        applyRendererResolution();
      } else if (nxg.dynHighTime > 8.0 && nxg.dynResScale < 1.0) {
        nxg.dynResScale = Math.min(1.0, nxg.dynResScale + 0.05);
        nxg.dynHighTime = 0;
        applyRendererResolution();
      }
    }
  }
}

/* ---------- Hero shading: readable materials, sky rim light, soft selection halo, larger in-match scale ---------- */
function _sharedNxgRimCompile(shader, r) {
  if (this.userData && this.userData._prevRimCompile) {
    this.userData._prevRimCompile.call(this, shader, r);
  }
  shader.uniforms.uNxgRim = this.userData.uNxgRimUniform;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nuniform vec3 uNxgRim;",
    )
    .replace(
      "#include <opaque_fragment>",
      `
              float nxgF = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);
              outgoingLight += uNxgRim * nxgF * saturate(normal.y * 0.6 + 0.7);
              #include <opaque_fragment>`,
    );
}

function nxgPolishHero(
  built,
  heroCfg,
  team,
  isPlayer,
  isPreview,
  isHudPortrait,
) {
  if (!built || !built.group) return;
  if (!nxg.ready) nxgInit();
  const rim = new THREE.Color(heroCfg.primaryHex)
    .lerp(new THREE.Color(0xfff4dc), 0.55)
    .multiplyScalar(isHudPortrait ? 0.5 : 0.85);
  const seen = new Set();
  built.group.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (!m.isMeshStandardMaterial || seen.has(m)) continue;
      seen.add(m);
      if (m.userData.nxgRim) {
        if (m.userData.uNxgRimUniform)
          m.userData.uNxgRimUniform.value.copy(rim);
        continue;
      }
      m.userData.nxgRim = true;
      m.userData.uNxgRimUniform = { value: rim.clone() };
      // Preserve multi-channel PBR roughnessMap/metalnessMap contrast; eliminate plastic sheen
      if (m.metalness > 0.55) {
        m.roughness = Math.max(m.roughness, 0.24);
        m.envMapIntensity = 1.28;
      } else {
        m.roughness = Math.max(m.roughness, 0.62);
        m.metalness = Math.min(m.metalness, 0.12);
        m.envMapIntensity = 0.48;
      }
      m.userData._prevRimCompile = m.onBeforeCompile;
      const prevKey = m.customProgramCacheKey();
      m.onBeforeCompile = _sharedNxgRimCompile;
      m.customProgramCacheKey = () => prevKey + "|nxgrim";
      m.needsUpdate = true;
    }
  });
  if (!isPreview && !isHudPortrait) {
    const rig =
      built.parts && built.parts.hips ? built.parts.hips.parent : null;
    if (rig) rig.scale.multiplyScalar(1.16);
    // Soft halo in the hero's own colour so each champion keeps a presence at night and in crowded fights
    if (built.parts && built.parts.torso && nxg.tex.glow) {
      const aura = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: nxg.tex.glow,
          color: heroCfg.primaryHex,
          transparent: true,
          opacity: 0.17,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      aura.scale.setScalar(4.4);
      aura.position.set(0, 0.9, 0);
      aura.raycast = () => {};
      built.parts.torso.add(aura);
    }
    const ring = built.group.children[0];
    if (ring && ring.geometry && ring.geometry.type === "RingGeometry") {
      ring.geometry.dispose();
      ring.material.dispose();
      ring.geometry = new THREE.PlaneGeometry(5.2, 5.2);
      ring.material = new THREE.MeshBasicMaterial({
        map: nxg.tex.selRing,
        color: isPlayer
          ? 0x34d399
          : team === "radiant"
            ? 0x5eead4
            : 0xfb7185,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      ring.material.color.multiplyScalar(1.5);
      ring.raycast = () => {};
    }
  }
}

function nxgSpring(parts, id, rot, axis, target, dt, w = 24, z = 0.7) {
  const sv = parts._sv || (parts._sv = {});
  let v = sv[id] || 0,
    x = rot[axis];
  if (!(dt > 0)) return;
  if (dt > 0.09) {
    x += (target - x) * Math.min(1, dt * 12);
    v = 0;
  } else {
    const steps = Math.max(1, Math.ceil(dt / 0.017)),
      h = dt / steps;
    for (let i = 0; i < steps; i++) {
      v += (w * w * (target - x) - 2 * z * w * v) * h;
      x += v * h;
    }
  }
  if (!(Math.abs(x) < 12)) {
    x = target;
    v = 0;
  }
  sv[id] = v;
  rot[axis] = x;
}

let _nxgPulseEl = null;
function nxgScreenPulse(colorHex) {
  if (!_nxgPulseEl) {
    _nxgPulseEl = document.createElement("div");
    _nxgPulseEl.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:30;opacity:0;";
    document.body.appendChild(_nxgPulseEl);
  }
  const c = "#" + new THREE.Color(colorHex).getHexString();
  _nxgPulseEl.style.background = `radial-gradient(ellipse at center, transparent 48%, ${c}55 86%, ${c}aa 120%)`;
  if (_nxgPulseEl.animate)
    _nxgPulseEl.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }],
      { duration: 620, easing: "ease-out" },
    );
}

// Signature cast layer shared by all 64 abilities: rune circle, hero-coloured sparks, light pop, per-key pose
function nxgCastFx(caster, key) {
  if (!caster || !caster.mesh || !caster.heroCfg) return;
  if (caster.parts) {
    caster.parts.castKey = key;
    caster.parts.castClock = 0;
  }
  const p = caster.mesh.position;
  if (
    Math.abs(p.x - cameraFocus.x) > 80 ||
    Math.abs(p.z - cameraFocus.z) > 70
  )
    return;
  const c1 = caster.heroCfg.primaryHex,
    c2 = caster.heroCfg.secondaryHex || c1;
  if (key === "R") {
    spawnGroundRuneDecal(p.x, p.z, 5.4, c1, 1.3);
    spawnShockwaveRing(p.x, p.z, 7.5, c2, 0.62);
    nxgEmit(p, c1, 34, {
      speed: 3.2,
      up: 13,
      life: 1.1,
      size: 0.5,
      gravity: -2.5,
      spread: 1.7,
      yOff: 0.3,
    });
    nxgFlash(p.x, p.y + 3, p.z, c1, 48, 34, 0.5);
    if (caster.isPlayer) nxgScreenPulse(c1);
  } else {
    spawnGroundRuneDecal(p.x, p.z, key === "Q" ? 2.5 : 3.1, c1, 0.62);
    nxgEmit(p, key === "E" ? c2 : c1, 11, {
      speed: 4,
      up: 6.5,
      life: 0.6,
      size: 0.36,
      gravity: 3,
      spread: 0.9,
      yOff: 0.6,
    });
  }
}

/* ---------- Saved settings, smart first-run preset, low-health warning ---------- */
const NXG_PREFS_KEY = "dota3d_nxg_prefs_v1";
const NXG_PREF_CHECKS = [
  "set-cinematic",
  "set-bloom",
  "set-ao",
  "set-dynres",
  "set-shadows",
  "set-water-hq",
  "set-clutter",
  "set-particles",
  "set-portraits-3d",
  "set-edge-pan",
  "set-smart-cast",
  "set-cam-shake",
  "set-float-dmg",
];
const NXG_PREF_RANGES = [
  "set-res-scale",
  "set-music-vol",
  "set-sfx-vol",
  "set-voice-vol",
  "set-pan-spd",
];
let _nxgPrefsTimer = null,
  _nxgPrefsLive = false;

function nxgReadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(NXG_PREFS_KEY) || "null");
  } catch (e) {
    return null;
  }
}
function nxgSavePrefsSoon() {
  if (!_nxgPrefsLive) return;
  clearTimeout(_nxgPrefsTimer);
  _nxgPrefsTimer = setTimeout(() => {
    const data = { v: 2, q: userSettings.qualityPreset, c: {}, r: {} };
    NXG_PREF_CHECKS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) data.c[id] = el.checked;
    });
    NXG_PREF_RANGES.forEach((id) => {
      const el = document.getElementById(id);
      if (el) data.r[id] = el.value;
    });
    try {
      localStorage.setItem(NXG_PREFS_KEY, JSON.stringify(data));
    } catch (e) {}
  }, 400);
}
// First run: pick a preset from the hardware instead of always starting on Medium
function nxgDetectPreset(isTouch) {
  const cores = navigator.hardwareConcurrency || 4,
    mem = navigator.deviceMemory || 4;
  let gpu = "";
  try {
    const gl = renderer.getContext(),
      dbg = gl.getExtension("WEBGL_debug_renderer_info");
    gpu = String(
      dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    );
  } catch (e) {}
  const isVeryWeakGpu =
    /mali-t|mali-4|adreno 3|adreno 4|powervr|swiftshader|llvmpipe|software/i.test(
      gpu,
    );
  if (
    LowRamOptimizer.profile.isLowRam ||
    /swiftshader|llvmpipe|software/i.test(gpu) ||
    cores <= 2 ||
    mem <= 2 ||
    isVeryWeakGpu
  )
    return "ultralight";
  if (isTouch) {
    if (mem <= 3 && cores <= 4) return "potato";
    return mem >= 6 && cores >= 6 ? "balanced" : "performance";
  }
  if (
    /rtx|radeon rx [5-9]|rx [5-9]\d{3}|arc|apple m[1-9]|apple gpu/i.test(
      gpu,
    ) &&
    cores >= 8
  )
    return "ultra";
  if (/nvidia|geforce|gtx|radeon|apple/i.test(gpu)) return "high";
  return "balanced";
}
function nxgStartupPreset(isTouch) {
  const saved = nxgReadPrefs();
  const valid = [
    "ultralight",
    "potato",
    "performance",
    "balanced",
    "high",
    "ultra",
    "ultramax",
  ];
  if (saved && valid.includes(saved.q))
    return saved.q === "ultramax" && !isUltraMaxUnlocked()
      ? "ultra"
      : saved.q;
  return nxgDetectPreset(isTouch);
}
function nxgRestorePrefs() {
  const saved = nxgReadPrefs();
  if (saved) {
    Object.entries(saved.c || {}).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!v;
    });
    Object.entries(saved.r || {}).forEach(([id, v]) => {
      // Render scale saved before v2 was relative to the old, much lower per-preset baseline
      if (id === "set-res-scale" && saved.v !== 2) return;
      const el = document.getElementById(id);
      if (el) el.value = v;
    });
    try {
      window.updateGraphicsSettings();
      window.updateAudioMixSettings();
      window.updateGameplaySettings();
    } catch (e) {}
  }
  [
    "setGraphicsQuality",
    "updateGraphicsSettings",
    "updateAudioMixSettings",
    "updateGameplaySettings",
  ].forEach((fn) => {
    const orig = window[fn];
    if (typeof orig !== "function") return;
    window[fn] = function (...args) {
      const r = orig.apply(this, args);
      nxgSavePrefsSoon();
      return r;
    };
  });
  _nxgPrefsLive = true;
}

let _nxgDangerEl = null,
  _nxgDangerShown = -1;
function nxgUpdateDanger() {
  const h = typeof playerHero !== "undefined" ? playerHero : null;
  let level = 0;
  if (h && !h.dead && !inHeroSelect && !gameOver && h.maxHp > 0) {
    const ratio = h.hp / h.maxHp;
    if (ratio < 0.32)
      level =
        Math.min(1, (0.32 - ratio) / 0.22) *
        (0.72 + 0.28 * Math.sin(nxg.time * 5.2));
  }
  const q = Math.round(level * 20) / 20;
  if (q === _nxgDangerShown) return;
  _nxgDangerShown = q;
  if (!_nxgDangerEl) {
    if (q === 0) return;
    _nxgDangerEl = document.createElement("div");
    _nxgDangerEl.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:29;opacity:0;transition:opacity 0.14s linear;background:radial-gradient(ellipse at center, transparent 52%, rgba(190,18,60,0.42) 92%, rgba(136,19,55,0.75) 125%);";
    document.body.appendChild(_nxgDangerEl);
  }
  _nxgDangerEl.style.opacity = String(q);
}

/* ---------- Towers and Ancients: sculpted silhouettes merged into a handful of draw calls each ---------- */
function nxgMergeGeos(list) {
  let total = 0;
  const prepared = list.map(([g, m]) => {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    if (m) ng.applyMatrix4(m);
    g.dispose();
    total += ng.attributes.position.count;
    return ng;
  });
  const pos = new Float32Array(total * 3),
    nor = new Float32Array(total * 3),
    uv = new Float32Array(total * 2);
  let o = 0;
  prepared.forEach((ng) => {
    pos.set(ng.attributes.position.array, o * 3);
    if (ng.attributes.normal) nor.set(ng.attributes.normal.array, o * 3);
    if (ng.attributes.uv) uv.set(ng.attributes.uv.array, o * 2);
    o += ng.attributes.position.count;
    ng.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}
// Place a part at radius/height in its own frame, then swing it around the vertical axis
function nxgRadial(ang, x, y, z = 0, rz = 0, rx = 0) {
  const m = new THREE.Matrix4()
    .makeRotationY(ang)
    .multiply(new THREE.Matrix4().makeTranslation(x, y, z));
  if (rz) m.multiply(new THREE.Matrix4().makeRotationZ(rz));
  if (rx) m.multiply(new THREE.Matrix4().makeRotationX(rx));
  return m;
}
// Curved talon profile in the radial (x) / up (y) plane, extruded to a slab
function nxgTalonGeo(pts, depth) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0], pts[1]);
  sh.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  sh.quadraticCurveTo(pts[6], pts[7], pts[8], pts[9]);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {
    depth,
    bevelEnabled: false,
    curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}
function nxgGlowSprite(colorHex, size, opacity) {
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: nxg.tex.glow,
      color: colorHex,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  sp.scale.setScalar(size);
  sp.raycast = () => {};
  return sp;
}

function nxgBuildTower(unit, group, isRad) {
  if (!nxg.ready) nxgInit();
  const isCitadel = unit.name.includes("Citadel");
  const sc = isCitadel ? 1.26 : 1.02;
  const teamCol = isCitadel
    ? isRad
      ? 0xfacc15
      : 0xf97316
    : isRad
      ? 0x10b981
      : 0xf43f5e;
  const stoneMat = new THREE.MeshStandardMaterial({
    map: marblePBR.map,
    bumpMap: marblePBR.bumpMap,
    bumpScale: 0.3,
    roughness: 0.66,
    metalness: 0.08,
    color: isRad ? 0xc3ccd6 : 0x3b4354,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: isRad ? 0xe9b93a : 0xb3122f,
    metalness: 0.85,
    roughness: 0.3,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: teamCol,
    emissive: teamCol,
    emissiveIntensity: 1.5,
    roughness: 0.3,
    metalness: 0.1,
  });
  attachContactShadow(group, 3.3 * sc);

  const stone = [],
    trim = [],
    glow = [];
  const Y = (y) => new THREE.Matrix4().makeTranslation(0, y, 0);
  stone.push([new THREE.CylinderGeometry(2.72, 3.12, 0.72, 8), Y(0.36)]);
  stone.push([new THREE.CylinderGeometry(2.24, 2.5, 0.62, 8), Y(1.02)]);
  stone.push([
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(2.06, 1.3),
        new THREE.Vector2(1.6, 2.5),
        new THREE.Vector2(1.4, 4.2),
        new THREE.Vector2(1.5, 5.4),
        new THREE.Vector2(2.02, 6.02),
        new THREE.Vector2(2.28, 6.36),
        new THREE.Vector2(2.28, 6.78),
        new THREE.Vector2(1.72, 6.78),
        new THREE.Vector2(1.5, 6.42),
        new THREE.Vector2(0, 6.42),
      ],
      8,
    ),
    null,
  ]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    stone.push([
      new THREE.BoxGeometry(1.5, 4.7, 0.44),
      nxgRadial(a, 1.86, 3.05, 0, 0.13),
    ]);
    stone.push([
      new THREE.BoxGeometry(0.9, 0.5, 0.62),
      nxgRadial(a, 2.62, 0.95),
    ]);
    // Glowing rune slit on each open face, gem on each plinth corner
    glow.push([
      new THREE.BoxGeometry(0.12, 2.5, 0.36),
      nxgRadial(a + Math.PI / 4, 1.47, 3.6),
    ]);
    glow.push([
      new THREE.OctahedronGeometry(0.24, 0),
      nxgRadial(a, 2.62, 1.42),
    ]);
    // Talons cradling the crystal
    const talon = isRad
      ? nxgTalonGeo(
          [1.72, 6.5, 3.15, 7.7, 1.62, 9.35, 2.5, 7.7, 1.2, 6.5],
          0.36,
        )
      : nxgTalonGeo(
          [1.72, 6.5, 3.5, 7.9, 1.5, 10.1, 2.45, 7.8, 1.2, 6.5],
          0.3,
        );
    trim.push([talon, nxgRadial(a + Math.PI / 4, 0, 0)]);
    if (!isRad)
      stone.push([
        new THREE.ConeGeometry(0.3, 1.5, 4),
        nxgRadial(a, 2.35, 5.5, 0, -0.5),
      ]);
  }
  for (let i = 0; i < 8; i++) {
    stone.push([
      new THREE.BoxGeometry(0.5, 0.56, 0.6),
      nxgRadial((i / 8) * Math.PI * 2 + Math.PI / 8, 2.04, 7.02),
    ]);
  }
  const flat = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  trim.push([
    new THREE.TorusGeometry(1.5, 0.11, 6, 20),
    Y(4.25).multiply(flat),
  ]);
  trim.push([
    new THREE.TorusGeometry(2.32, 0.12, 6, 24),
    Y(6.36).multiply(flat),
  ]);
  trim.push([
    new THREE.TorusGeometry(2.56, 0.1, 6, 24),
    Y(1.32).multiply(flat),
  ]);

  const stoneMesh = new THREE.Mesh(
    nxgMergeGeos(stone).scale(sc, sc, sc),
    stoneMat,
  );
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  const trimMesh = new THREE.Mesh(
    nxgMergeGeos(trim).scale(sc, sc, sc),
    trimMat,
  );
  trimMesh.castShadow = true;
  const glowMesh = new THREE.Mesh(
    nxgMergeGeos(glow).scale(sc, sc, sc),
    glowMat,
  );
  group.add(stoneMesh, trimMesh, glowMesh);

  const coreMat = new THREE.MeshStandardMaterial({
    color: teamCol,
    emissive: teamCol,
    emissiveIntensity: 1.5,
    roughness: 0.18,
    metalness: 0.25,
  });
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.42 * sc, isCitadel ? 1 : 0).scale(
      0.8,
      1.32,
      0.8,
    ),
    coreMat,
  );
  core.position.y = 8.2 * sc;
  core.add(nxgGlowSprite(teamCol, 8.5 * sc, 0.5));
  group.add(core);
  unit.parts.crystal = core;
  unit.parts.crystalBaseY = 8.2 * sc;

  const haloRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.42 * sc, 0.1 * sc, 8, 36),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: isRad ? 0xf59e0b : 0xdc2626,
      emissiveIntensity: 1.3,
      metalness: 0.7,
      roughness: 0.3,
    }),
  );
  haloRing.position.y = 8.2 * sc;
  haloRing.rotation.x = Math.PI / 2.6;
  group.add(haloRing);
  unit.parts.haloRing = haloRing;

  const rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(unit.atkRange - 0.18, unit.atkRange, 64),
    new THREE.MeshBasicMaterial({
      color: teamCol,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  rangeRing.rotation.x = -Math.PI / 2;
  rangeRing.position.y = 0.06;
  group.add(rangeRing);
  const fortRadius = Math.max(18.5, unit.atkRange);
  const fortRing = new THREE.Mesh(
    new THREE.RingGeometry(fortRadius - 0.28, fortRadius, 64),
    new THREE.MeshBasicMaterial({
      color: isRad ? 0x34d399 : 0xfb7185,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
  fortRing.rotation.x = -Math.PI / 2;
  fortRing.position.y = 0.05;
  group.add(fortRing);
  rangeRing.raycast = () => {};
  fortRing.raycast = () => {};
}

function nxgBuildAncient(unit, group, isRad) {
  if (!nxg.ready) nxgInit();
  const ancCol = isRad ? 0x10b981 : 0xf43f5e;
  const trimCol = isRad ? 0xfacc15 : 0xf97316;
  const stoneMat = new THREE.MeshStandardMaterial({
    map: marblePBR.map,
    bumpMap: marblePBR.bumpMap,
    bumpScale: 0.3,
    roughness: 0.64,
    metalness: 0.08,
    color: isRad ? 0xc3ccd6 : 0x2f3646,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: trimCol,
    metalness: 0.86,
    roughness: 0.28,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: ancCol,
    emissive: ancCol,
    emissiveIntensity: 1.7,
    roughness: 0.3,
  });
  attachContactShadow(group, 6.8);

  const stone = [],
    trim = [],
    glow = [];
  const Y = (y) => new THREE.Matrix4().makeTranslation(0, y, 0);
  const flat = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  stone.push([
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(6.7, 0),
        new THREE.Vector2(6.4, 0.55),
        new THREE.Vector2(5.5, 0.9),
        new THREE.Vector2(5.3, 1.5),
        new THREE.Vector2(4.5, 1.9),
        new THREE.Vector2(4.3, 2.5),
        new THREE.Vector2(3.5, 2.9),
        new THREE.Vector2(0, 2.9),
      ],
      20,
    ),
    null,
  ]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const talon = isRad
      ? nxgTalonGeo(
          [5.5, 0.5, 7.9, 5.6, 3.3, 10.8, 5.7, 6.0, 4.2, 0.5],
          1.15,
        )
      : nxgTalonGeo(
          [5.5, 0.5, 8.4, 5.9, 3.0, 11.9, 5.6, 6.2, 4.3, 0.5],
          0.95,
        );
    stone.push([talon, nxgRadial(a, 0, 0)]);
    // Gilded spine riding the outside of each talon
    const spine = isRad
      ? nxgTalonGeo(
          [5.62, 0.6, 8.2, 5.6, 3.3, 10.95, 7.75, 5.7, 5.5, 0.6],
          0.34,
        )
      : nxgTalonGeo(
          [5.62, 0.6, 8.7, 5.9, 3.0, 12.05, 8.25, 6.0, 5.5, 0.6],
          0.3,
        );
    trim.push([spine, nxgRadial(a, 0, 0)]);
    // Obelisks between the talons, each capped with a gem
    stone.push([
      new THREE.CylinderGeometry(0.3, 0.58, 3.4, 4),
      nxgRadial(a + Math.PI / 4, 5.75, 2.3),
    ]);
    glow.push([
      new THREE.OctahedronGeometry(0.5, 0),
      nxgRadial(a + Math.PI / 4, 5.75, 4.6),
    ]);
    glow.push([
      new THREE.BoxGeometry(0.16, 0.5, 1.5),
      nxgRadial(a + Math.PI / 4, 4.92, 1.72),
    ]);
  }
  trim.push([
    new THREE.TorusGeometry(4.4, 0.13, 6, 40),
    Y(2.52).multiply(flat),
  ]);
  trim.push([
    new THREE.TorusGeometry(5.4, 0.15, 6, 44),
    Y(1.52).multiply(flat),
  ]);
  glow.push([
    new THREE.RingGeometry(2.3, 2.75, 40),
    Y(2.93).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)),
  ]);

  const stoneMesh = new THREE.Mesh(nxgMergeGeos(stone), stoneMat);
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  const trimMesh = new THREE.Mesh(nxgMergeGeos(trim), trimMat);
  trimMesh.castShadow = true;
  group.add(
    stoneMesh,
    trimMesh,
    new THREE.Mesh(nxgMergeGeos(glow), glowMat),
  );

  const nexus = new THREE.Mesh(
    new THREE.OctahedronGeometry(3.1, 1).scale(0.84, 1.26, 0.84),
    new THREE.MeshStandardMaterial({
      color: ancCol,
      emissive: ancCol,
      emissiveIntensity: 1.9,
      roughness: 0.15,
    }),
  );
  nexus.position.y = 6.9;
  nexus.add(nxgGlowSprite(ancCol, 19, 0.5));
  group.add(nexus);
  unit.parts.crystal = nexus;
  unit.parts.crystalBaseY = 6.9;

  // Pillar of light: the Ancient reads as the objective from anywhere on screen
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.5, 34, 20, 1, true),
    new THREE.MeshBasicMaterial({
      map: nxg.tex.beam,
      color: ancCol,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  beam.position.y = 6.9 + 17;
  beam.raycast = () => {};
  group.add(beam);

  const ringMat1 = new THREE.MeshStandardMaterial({
    color: trimCol,
    emissive: trimCol,
    emissiveIntensity: 1.2,
    metalness: 0.8,
    roughness: 0.3,
  });
  const ringMat2 = new THREE.MeshStandardMaterial({
    color: ancCol,
    emissive: ancCol,
    emissiveIntensity: 1.35,
    metalness: 0.7,
    roughness: 0.3,
  });
  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.6, 0.2, 10, 48),
    ringMat1,
  );
  orbitRing.position.y = 6.9;
  orbitRing.rotation.x = Math.PI / 3;
  orbitRing.raycast = () => {};
  group.add(orbitRing);
  unit.parts.orbitRing = orbitRing;
  const orbitRing2 = new THREE.Mesh(
    new THREE.TorusGeometry(5.3, 0.16, 10, 48),
    ringMat2,
  );
  orbitRing2.position.y = 6.9;
  orbitRing2.rotation.y = Math.PI / 3;
  orbitRing2.raycast = () => {};
  group.add(orbitRing2);
  unit.parts.orbitRing2 = orbitRing2;

  const wardDome = new THREE.Mesh(
    new THREE.SphereGeometry(
      7.6,
      28,
      20,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.52,
    ),
    new THREE.MeshBasicMaterial({
      color: ancCol,
      transparent: true,
      opacity: 0.09,
      wireframe: true,
      depthWrite: false,
    }),
  );
  wardDome.position.y = 0.4;
  wardDome.raycast = () => {};
  group.add(wardDome);
  unit.parts.wardDome = wardDome;
}

// Procedural Radial Contact-Shadow Disc Texture for Grounded Depth
const contactShadowTex = (() => {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, "rgba(2, 6, 16, 0.62)");
  grad.addColorStop(0.55, "rgba(2, 6, 16, 0.28)");
  grad.addColorStop(1, "rgba(2, 6, 16, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const contactShadowMat = new THREE.MeshBasicMaterial({
  map: contactShadowTex,
  transparent: true,
  depthWrite: false,
  opacity: 0.85,
});
function attachContactShadow(group, radius = 1.6) {
  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2.3, radius * 2.3),
    contactShadowMat,
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.04;
  group.add(disc);
  return disc;
}

// Custom GLSL Atmospheric Sky Dome with Sun/Moon Discs, Horizon Scattering, Clouds & Night Stars
let skyDomeUniforms = null;
function initAtmosphericSkyDome() {
  const isUlInit =
    (typeof userSettings !== "undefined" &&
      userSettings.qualityPreset === "ultralight") ||
    _is1GbMobileBoot;
  skyDomeUniforms = {
    uTime: { value: 0 },
    uUltraLight: { value: isUlInit ? 1.0 : 0.0 },
    uSunFactor: { value: 1.0 },
    uSunDir: { value: new THREE.Vector3(0.45, 0.75, 0.45).normalize() },
    uZenithDay: { value: new THREE.Color(0x0c2d57) },
    uHorizonDay: { value: new THREE.Color(0x38bdf8) },
    uZenithNight: { value: new THREE.Color(0x09132b) },
    uHorizonNight: { value: new THREE.Color(0x25396b) },
  };
  const skyGeo = new THREE.SphereGeometry(
    390,
    isUlInit ? 24 : 40,
    isUlInit ? 16 : 28,
  );
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyDomeUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
              varying vec3 vWorldDir;
              void main() {
                  vec4 wp = modelMatrix * vec4(position, 1.0);
                  vWorldDir = normalize(position);
                  gl_Position = projectionMatrix * viewMatrix * wp;
              }
          `,
    fragmentShader: `
              uniform float uTime;
              uniform float uUltraLight;
              uniform float uSunFactor;
              uniform vec3 uSunDir;
              uniform vec3 uZenithDay;
              uniform vec3 uHorizonDay;
              uniform vec3 uZenithNight;
              uniform vec3 uHorizonNight;
              varying vec3 vWorldDir;

              float hash31(vec3 p) {
                  p = fract(p * 0.1031);
                  p += dot(p, p.yzx + 33.33);
                  return fract((p.x + p.y) * p.z);
              }
              float noise2(vec2 p) {
                  vec2 i = floor(p);
                  vec2 f = fract(p);
                  f = f * f * (3.0 - 2.0 * f);
                  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
                  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
                  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
                  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
                  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
              }
              float fbmCloud(vec2 p) {
                  float v = 0.0;
                  float a = 0.5;
                  for (int i = 0; i < 4; i++) {
                      v += a * noise2(p);
                      p = p * 2.04 + vec2(1.7, 9.2);
                      a *= 0.5;
                  }
                  return v;
              }

              void main() {
                  vec3 dir = normalize(vWorldDir);
                  float h = clamp(dir.y, 0.0, 1.0);
                  float horizonCurve = pow(1.0 - h, 2.4);

                  vec3 zenith = mix(uZenithNight, uZenithDay, uSunFactor);
                  vec3 horizon = mix(uHorizonNight, uHorizonDay, uSunFactor);
                  vec3 col = mix(zenith, horizon, horizonCurve);

                  // Golden/Violet twilight rim glow
                  float twilight = sin(uSunFactor * 3.14159) * pow(1.0 - h, 3.2);
                  col += vec3(0.55, 0.24, 0.14) * twilight;

                  // Sun & Moon Glow
                  float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
                  vec3 sunGlowCol = mix(vec3(0.65, 0.85, 1.0), vec3(1.0, 0.90, 0.62), uSunFactor);
                  col += sunGlowCol * pow(sunAmt, 16.0) * 0.45;
                  col += sunGlowCol * smoothstep(0.9965, 0.9992, sunAmt) * 1.4;

                  // Multi-Layered Volumetric-Style Clouds with Silver/Golden Sun Scattering
                  if (dir.y > 0.025) {
                      vec2 uv1 = dir.xz / (dir.y + 0.17) * 1.32 + vec2(uTime * 0.012, -uTime * 0.008);
                      float c;
                      if (uUltraLight > 0.5) {
                          c = noise2(uv1) * 0.68 + noise2(uv1 * 2.05 + vec2(1.7, 9.2)) * 0.32;
                      } else {
                          vec2 uv2 = dir.xz / (dir.y + 0.24) * 2.25 + vec2(uTime * 0.019 + 3.1, -uTime * 0.011);
                          float c1 = fbmCloud(uv1);
                          float c2 = fbmCloud(uv2);
                          c = c1 * 0.68 + c2 * 0.32;
                      }
                      float cloudMask = smoothstep(0.44, 0.78, c) * smoothstep(0.025, 0.26, dir.y);
                      float silverLining = smoothstep(0.42, 0.62, c) * (1.0 - smoothstep(0.62, 0.82, c)) * pow(sunAmt, 3.0);
                      vec3 cloudBase = mix(vec3(0.16, 0.24, 0.44), vec3(0.88, 0.93, 0.99), uSunFactor);
                      vec3 cloudRim = mix(vec3(0.42, 0.68, 0.98), vec3(1.0, 0.88, 0.62), uSunFactor);
                      vec3 cloudCol = cloudBase + cloudRim * (silverLining * 0.75 + pow(sunAmt, 6.0) * 0.22);
                      col = mix(col, cloudCol, cloudMask * 0.52);
                  }

                  // Luminous Aurora Borealis Ribbons & Twinkling Multi-Hue Night Starfield
                  float nightVis = (1.0 - uSunFactor) * smoothstep(0.06, 0.42, dir.y);
                  if (nightVis > 0.01) {
                      float aurWave = sin(dir.x * 5.2 + dir.z * 3.4 + uTime * 0.24 + fbmCloud(dir.xz * 2.4) * 3.2);
                      float aurBand = smoothstep(0.76, 0.99, aurWave) * smoothstep(0.12, 0.48, dir.y) * (1.0 - smoothstep(0.55, 0.92, dir.y));
                      vec3 aurCol = mix(vec3(0.12, 0.88, 0.64), vec3(0.45, 0.52, 0.98), 0.5 + 0.5 * sin(dir.x * 3.0 - uTime * 0.15));
                      col += aurCol * aurBand * nightVis * 0.34;

                      vec3 starCell = floor(dir * 290.0);
                      float rnd = hash31(starCell);
                      if (rnd > 0.989) {
                          float twinkle = 0.55 + 0.45 * sin(uTime * 4.2 + rnd * 95.0);
                          vec3 starTint = rnd > 0.996 ? vec3(1.0, 0.88, 0.68) : (rnd > 0.993 ? vec3(0.68, 0.88, 1.0) : vec3(0.92, 0.96, 1.0));
                          col += starTint * twinkle * nightVis * 1.45;
                      }
                  }

                  // Fade below-horizon hemisphere into deep mountain valley shadow
                  if (dir.y < 0.0) {
                      vec3 nadirCol = mix(vec3(0.03, 0.05, 0.09), vec3(0.07, 0.11, 0.17), uSunFactor);
                      col = mix(col, nadirCol, smoothstep(0.0, -0.22, dir.y));
                  }

                  gl_FragColor = vec4(col, 1.0);
              }
          `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);
}

// Ambient Bioluminescent Fireflies (Radiant) & Volcanic Embers (Dire)
let ambientMotes = null;
let ambientMoteData = [];
function initAmbientMotes() {
  const count = 320;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  ambientMoteData = [];
  for (let i = 0; i < count; i++) {
    const isRadiantSide = i < count / 2;
    let x = (Math.random() - 0.5) * 230;
    let z = (Math.random() - 0.5) * 230;
    if (isRadiantSide && x - z > 0) {
      const tmp = x;
      x = z;
      z = tmp;
    }
    if (!isRadiantSide && x - z < 0) {
      const tmp = x;
      x = z;
      z = tmp;
    }
    const y = 0.6 + Math.random() * 8.5;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;

    const c = isRadiantSide
      ? Math.random() > 0.4
        ? new THREE.Color(0x6ee7b7)
        : new THREE.Color(0xfef08a)
      : Math.random() > 0.35
        ? new THREE.Color(0xf97316)
        : new THREE.Color(0xf43f5e);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    ambientMoteData.push({
      baseX: x,
      baseY: y,
      baseZ: z,
      isRadiantSide,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 0.9,
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const moteCanvas = document.createElement("canvas");
  moteCanvas.width = 32;
  moteCanvas.height = 32;
  const mCtx = moteCanvas.getContext("2d");
  const mGrad = mCtx.createRadialGradient(16, 16, 1, 16, 16, 15);
  mGrad.addColorStop(0, "rgba(255,255,255,1)");
  mGrad.addColorStop(0.3, "rgba(255,255,255,0.4)");
  mGrad.addColorStop(0.62, "rgba(255,255,255,0)");
  mGrad.addColorStop(1, "rgba(255,255,255,0)");
  mCtx.fillStyle = mGrad;
  mCtx.fillRect(0, 0, 32, 32);
  const moteTex = new THREE.CanvasTexture(moteCanvas);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.78 }, uPxScale: { value: 600 } },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
              uniform float uPxScale; varying vec3 vC;
              void main() {
                  vC = color;
                  vec4 mv = modelViewMatrix * vec4(position, 1.0);
                  gl_Position = projectionMatrix * mv;
                  gl_PointSize = 0.5 * uPxScale / max(1.0, -mv.z);
              }`,
    fragmentShader: `
              uniform float uOpacity; varying vec3 vC;
              void main() {
                  float d = length(gl_PointCoord - 0.5) * 2.0;
                  float a = pow(max(0.0, 1.0 - d), 2.2) * uOpacity;
                  if (a < 0.004) discard;
                  gl_FragColor = vec4(vC * 1.25, a);
                  #include <tonemapping_fragment>
                  #include <colorspace_fragment>
              }`,
  });
  ambientMotes = new THREE.Points(geo, mat);
  scene.add(ambientMotes);
}

let _moteAccumDt = 0;
let _moteTick = 0;
function updateAmbientMotes(dt, time, sunFactor) {
  if (!ambientMotes) return;
  ambientMotes.visible = userSettings.particlesEnabled;
  if (!userSettings.particlesEnabled) return;
  _moteAccumDt += dt;
  if ((++_moteTick & 1) !== 0) return;
  const stepDt = _moteAccumDt;
  _moteAccumDt = 0;
  ambientMotes.material.opacity = 0.16 + (1.0 - sunFactor) * 0.66;
  const arr = ambientMotes.geometry.attributes.position.array;
  for (let i = 0; i < ambientMoteData.length; i++) {
    const m = ambientMoteData[i];
    m.phase += stepDt * m.speed;
    arr[i * 3] = m.baseX + Math.sin(m.phase) * 2.2;
    arr[i * 3 + 2] = m.baseZ + Math.cos(m.phase * 0.85) * 2.2;
    if (m.isRadiantSide) {
      arr[i * 3 + 1] = m.baseY + Math.sin(m.phase * 1.8) * 0.85;
    } else {
      arr[i * 3 + 1] = ((m.baseY + time * m.speed * 1.4) % 9.5) + 0.4;
    }
  }
  ambientMotes.geometry.attributes.position.needsUpdate = true;
}

const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x263547, 1.18);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
sunLight.position.set(60, 110, 62);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 55;
sunLight.shadow.camera.far = 195;
const shExt = 66;
sunLight.shadow.camera.left = -shExt;
sunLight.shadow.camera.right = shExt;
sunLight.shadow.camera.top = shExt;
sunLight.shadow.camera.bottom = -shExt;
sunLight.shadow.bias = -0.00018;
sunLight.shadow.normalBias = 0.028;
sunLight.shadow.radius = 2.0;
scene.add(sunLight);
scene.add(sunLight.target);

const rimFillLight = new THREE.DirectionalLight(0x93c5fd, 0.58);
rimFillLight.position.set(-55, 48, -60);
scene.add(rimFillLight);

const radBaseLight = new THREE.PointLight(0x6ee7b7, 1.45, 56);
radBaseLight.position.set(-86, 15, 86);
scene.add(radBaseLight);

const direBaseLight = new THREE.PointLight(0xf43f5e, 3.2, 82);
direBaseLight.position.set(82, 16, -82);
scene.add(direBaseLight);

const torchLights = [];
const arenaAccentLights = [];
// Every visible point light is evaluated per pixel by every lit material, even at intensity 0.
// Keep only the lights the current screen + quality tier can actually show.
function getTorchLightCap() {
  const q = userSettings.qualityPreset;
  return q === "ultralight" || q === "potato" || q === "performance"
    ? 0
    : q === "balanced"
      ? 2
      : torchLights.length;
}
// Point lights are shaded per pixel by every lit material, so their count is the single biggest
// fragment cost. The arena's light sources (bases, torches, shops, spell flashes, hero aura) are
// therefore never rendered directly: a small fixed pool of real lights is re-pointed every frame
// at the sources that matter most near the camera. Shader cost is bounded by the pool size and
// the light count never changes mid-match (no shader recompiles).
const POINT_LIGHT_POOL_MAX = 4;
const pointLightPool = [];
const _plSources = [];
const _plPick = [];
const _plTmp = new THREE.Vector3();
function getPointLightBudget() {
  const q = userSettings.qualityPreset;
  return q === "ultralight" || q === "potato"
    ? 0
    : q === "performance"
      ? 1
      : q === "balanced"
        ? 2
        : q === "ultramax"
          ? 4
          : 3;
}
let _lightBudgetKey = "";
function syncSceneLightBudget() {
  const q = userSettings.qualityPreset;
  const inSelect = inHeroSelect && !inTitleScreen;
  const heroAura =
    typeof ultraMaxHeroLight !== "undefined" ? ultraMaxHeroLight : null;
  const key =
    q +
    (inSelect ? "|s|" : "|a|") +
    torchLights.length +
    "|" +
    nxg.flashes.length +
    (heroAura ? "|h" : "");
  if (key === _lightBudgetKey) return;
  _lightBudgetKey = key;
  if (!pointLightPool.length) {
    for (let i = 0; i < POINT_LIGHT_POOL_MAX; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 30, 2);
      l.position.set(0, -200, 0);
      l.visible = false;
      scene.add(l);
      pointLightPool.push(l);
    }
  }
  stageKeyLight.visible = inSelect;
  stageFillLight.visible = inSelect;
  stageRimLight.visible = inSelect;
  _plSources.length = 0;
  _plSources.push(radBaseLight, direBaseLight);
  for (let i = 0; i < torchLights.length; i++)
    _plSources.push(torchLights[i].light);
  for (let i = 0; i < arenaAccentLights.length; i++)
    _plSources.push(arenaAccentLights[i]);
  for (let i = 0; i < nxg.flashes.length; i++)
    _plSources.push(nxg.flashes[i].light);
  if (heroAura) _plSources.push(heroAura);
  for (let i = 0; i < _plSources.length; i++)
    _plSources[i].visible = false;
  const budget = inSelect ? 0 : getPointLightBudget();
  for (let i = 0; i < pointLightPool.length; i++) {
    pointLightPool[i].visible = i < budget;
    pointLightPool[i].intensity = 0;
  }
}
function updatePointLightPool() {
  const budget =
    inHeroSelect && !inTitleScreen ? 0 : getPointLightBudget();
  if (!budget || !pointLightPool.length) return;
  const fx = inTitleScreen ? 0 : cameraFocus.x;
  const fz = inTitleScreen ? 0 : cameraFocus.z;
  const viewR = inTitleScreen ? 150 : 72;
  _plPick.length = 0;
  for (let i = 0; i < _plSources.length; i++) {
    const src = _plSources[i];
    if (!(src.intensity > 0.01)) continue;
    if (src.parent !== scene) {
      if (!src.parent || !src.parent.visible) continue;
      src.getWorldPosition(_plTmp);
    } else _plTmp.copy(src.position);
    const reach = (src.distance || 60) + viewR;
    const d = Math.hypot(_plTmp.x - fx, _plTmp.z - fz);
    if (d >= reach) continue;
    // Fade in/out over the last 18m so a source entering or leaving the pool never pops
    const fade = Math.min(1, (reach - d) / 18);
    const score = src.intensity * fade * (1.2 - d / reach);
    let j = _plPick.length;
    if (j < budget) _plPick.push(null);
    else if (score <= _plPick[j - 1].s) continue;
    else j--;
    while (j > 0 && _plPick[j - 1].s < score) {
      _plPick[j] = _plPick[j - 1];
      j--;
    }
    _plPick[j] = { s: score, src, fade, x: _plTmp.x, y: _plTmp.y, z: _plTmp.z };
  }
  for (let i = 0; i < budget; i++) {
    const slot = pointLightPool[i];
    const pick = _plPick[i];
    if (!pick) {
      if (slot.intensity !== 0) slot.intensity = 0;
      continue;
    }
    slot.color.copy(pick.src.color);
    slot.intensity = pick.src.intensity * pick.fade;
    slot.distance = pick.src.distance;
    slot.decay = pick.src.decay;
    slot.position.set(pick.x, pick.y, pick.z);
  }
}
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();
const worldCursor = new THREE.Vector3(-52, 0, 52);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const DAY_CYCLE_DURATION = 300.0; // 5 minutes Day (300s) + 5 minutes Night (300s)
let cycleClock = 510.0; // Start 1 min into bright morning daylight
let isNightTime = false;
const WEATHER_MODES = ["clear", "rain", "mist"];
let weatherIdx = 0;
let currentWeather = "clear";
let weatherTimer = 210.0;
let rainPoints = null;
let rainVelocities = null;

function initWeatherParticles() {
  const count = 900;
  const pos = new Float32Array(count * 3);
  rainVelocities = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 240;
    pos[i * 3 + 1] = Math.random() * 52;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 240;
    rainVelocities[i] = 34 + Math.random() * 16;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xbae6fd,
    size: 0.44,
    transparent: true,
    opacity: 0.0,
  });
  rainPoints = new THREE.Points(geo, mat);
  scene.add(rainPoints);
}

function syncDayNightSettingsUI() {
  const dnMode = isNightTime ? "night" : "day";
  document
    .querySelectorAll("#settings-daynight-grid .setting-pill")
    .forEach((btn) => {
      btn.classList.toggle("active-setting", btn.dataset.dn === dnMode);
    });
}

function setWeather(mode) {
  currentWeather = mode;
  document
    .querySelectorAll("#settings-weather-grid .setting-pill")
    .forEach((btn) => {
      btn.classList.toggle("active-setting", btn.dataset.w === mode);
    });
  if (mode === "rain") {
    showBanner(
      "WEATHER SHIFT: GENTLE RAIN",
      "Light rain falls across the river valley!",
      "text-sky-300",
    );
  } else if (mode === "mist") {
    showBanner(
      "WEATHER SHIFT: ARCANE MIST",
      "A soft silver mist drifts over the river!",
      "text-purple-300",
    );
  }
}

function updateDayNightAndWeather(dt) {
  const fullCycle = DAY_CYCLE_DURATION * 2; // 600s total (300s Day + 300s Night)
  cycleClock = (cycleClock + dt) % fullCycle;
  const sunFactor =
    (Math.cos((cycleClock / DAY_CYCLE_DURATION) * Math.PI) + 1) * 0.5;
  const wasNight = isNightTime;
  // Exact 5-minute Night window [0.5*D, 1.5*D) where sunFactor < 0.5, and 5-minute Day window otherwise
  const halfPhase = DAY_CYCLE_DURATION * 0.5;
  const nightEnd = DAY_CYCLE_DURATION * 1.5;
  isNightTime = cycleClock >= halfPhase && cycleClock < nightEnd;
  const phaseElapsed = isNightTime
    ? cycleClock - halfPhase
    : cycleClock >= nightEnd
      ? cycleClock - nightEnd
      : cycleClock + halfPhase;
  const phaseProgress = THREE.MathUtils.clamp(
    phaseElapsed / DAY_CYCLE_DURATION,
    0,
    1,
  );

  if (wasNight !== isNightTime) {
    syncDayNightSettingsUI();
    if (!inHeroSelect && !inTitleScreen) {
      if (isNightTime)
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
  }

  weatherTimer -= dt;
  if (weatherTimer <= 0 && !inHeroSelect) {
    weatherIdx = (weatherIdx + 1) % WEATHER_MODES.length;
    setWeather(WEATHER_MODES[weatherIdx]);
    weatherTimer = currentWeather === "clear" ? 210.0 : 55.0;
  }

  const rainFactor = currentWeather === "rain" ? 1.0 : 0.0;
  const mistFactor = currentWeather === "mist" ? 1.0 : 0.0;

  if (!updateDayNightAndWeather._scratch) {
    updateDayNightAndWeather._scratch = {
      daySky: new THREE.Color(0x1b4678),
      nightSky: new THREE.Color(0x0b162c),
      skyCol: new THREE.Color(),
      dayLightCol: new THREE.Color(0xffefd2),
      moonLightCol: new THREE.Color(0x8bb2eb),
      hemiNight: new THREE.Color(0x476ba8),
      hemiDay: new THREE.Color(0xe0f2fe),
      riverNight: new THREE.Color(0x132b4f),
      riverDay: new THREE.Color(0x38bdf8),
      upVec: new THREE.Vector3(0, 1, 0),
      sunDir: new THREE.Vector3(),
    };
  }
  const sc = updateDayNightAndWeather._scratch;
  sc.skyCol.copy(sc.nightSky).lerp(sc.daySky, sunFactor);

  scene.background.copy(sc.skyCol);
  scene.fog.color.copy(sc.skyCol);
  const targetFog = inHeroSelect
    ? 0.00018
    : 0.0015 +
      (1 - sunFactor) * 0.00045 +
      rainFactor * 0.0008 +
      mistFactor * 0.0015;
  scene.fog.density +=
    (targetFog - scene.fog.density) * Math.min(1, dt * 1.5);

  const angle = (cycleClock / (DAY_CYCLE_DURATION * 2)) * Math.PI * 2;
  sc.sunDir
    .set(
      Math.cos(angle) * 75,
      80 + Math.sin(angle) * 14,
      Math.sin(angle) * 75,
    )
    .normalize();
  window._activeSunDir = sc.sunDir;
  sunLight.color.copy(sc.moonLightCol).lerp(sc.dayLightCol, sunFactor);

  const weatherDim = 1.0 - rainFactor * 0.14 - mistFactor * 0.1;
  const qLight = userSettings.qualityPreset || "ultramax";
  sunLight.intensity = (0.82 + sunFactor * 1.28) * weatherDim;
  hemiLight.intensity = (0.4 + sunFactor * 0.3) * weatherDim;
  hemiLight.color.copy(sc.hemiNight).lerp(sc.hemiDay, sunFactor);
  const baseEnv =
    qLight === "ultramax"
      ? 0.9
      : qLight === "ultra"
        ? 0.82
        : qLight === "high"
          ? 0.74
          : qLight === "balanced"
            ? 0.64
            : qLight === "ultralight"
              ? 0.45
              : 0.54;
  scene.environmentIntensity = baseEnv * (0.55 + sunFactor * 0.45);

  if (riverShaderUniforms) {
    riverShaderUniforms.uSkyColor.value
      .copy(sc.riverNight)
      .lerp(sc.riverDay, sunFactor);
    riverShaderUniforms.uSunColor.value.copy(sunLight.color);
    riverShaderUniforms.uSunDir.value.copy(sc.sunDir);
  }
  if (terrainShaderUniforms) {
    terrainShaderUniforms.uTime.value = cycleClock;
    if (terrainShaderUniforms.uNightAmt) {
      terrainShaderUniforms.uNightAmt.value = THREE.MathUtils.clamp(
        (0.55 - sunFactor) / 0.55,
        0,
        1,
      );
    }
    if (
      terrainShaderUniforms.uTowers &&
      Array.isArray(staticStructures)
    ) {
      const tArr = terrainShaderUniforms.uTowers.value;
      for (let ti = 0; ti < 12; ti++) {
        const st = staticStructures[ti];
        if (st && !st.dead) {
          const lightR =
            st.type === "ancient" || st.name.includes("Citadel")
              ? 44.0
              : 34.0;
          tArr[ti].set(st.mesh.position.x, st.mesh.position.z, lightR);
        } else {
          tArr[ti].set(0, 0, 0);
        }
      }
    }
  }
  if (rimFillLight) {
    const twilightAmt = Math.sin(sunFactor * Math.PI);
    rimFillLight.color.setRGB(
      0.56 + twilightAmt * 0.34,
      0.76 - twilightAmt * 0.14,
      1.0 - twilightAmt * 0.28,
    );
    const rimTierMult =
      qLight === "ultramax"
        ? 1.06
        : qLight === "ultra"
          ? 1.0
          : qLight === "high"
            ? 0.9
            : qLight === "balanced"
              ? 0.78
              : 0.62;
    rimFillLight.intensity =
      (0.56 + (1.0 - sunFactor) * 0.18) * rimTierMult;
  }
  if (skyDomeUniforms) {
    skyDomeUniforms.uTime.value = cycleClock;
    skyDomeUniforms.uSunFactor.value = sunFactor;
    skyDomeUniforms.uSunDir.value.copy(sc.sunDir);
  }
  renderer.toneMappingExposure =
    (qLight === "ultramax" ? 1.01 : 1.06) + sunFactor * 0.05;
  updateAmbientMotes(dt, cycleClock, sunFactor);
  if (godRayGroup) {
    const isUmaxRays = userSettings.qualityPreset === "ultramax";
    const showRays =
      isUmaxRays &&
      !inHeroSelect &&
      userSettings.cinematicEnabled &&
      !isNightTime &&
      currentWeather === "clear" &&
      sunFactor > 0.1;
    godRayGroup.visible = showRays;
    if (showRays && godRayUniforms) {
      godRayUniforms.uTime.value = cycleClock;
      godRayUniforms.uSunFactor.value = sunFactor;
      for (let bi = 0; bi < godRayGroup.children.length; bi++) {
        const beam = godRayGroup.children[bi];
        beam.quaternion.setFromUnitVectors(sc.upVec, sc.sunDir);
        beam.rotateY(beam.userData.phase + cycleClock * 0.03);
      }
    }
  }

  if (rainPoints) {
    rainPoints.visible = userSettings.particlesEnabled;
    const targetOp =
      userSettings.particlesEnabled && currentWeather === "rain"
        ? 0.55
        : 0.0;
    rainPoints.material.opacity +=
      (targetOp - rainPoints.material.opacity) * Math.min(1, dt * 2.5);
    if (
      userSettings.particlesEnabled &&
      rainPoints.material.opacity > 0.02
    ) {
      const pArr = rainPoints.geometry.attributes.position.array;
      for (let i = 0; i < rainVelocities.length; i++) {
        pArr[i * 3 + 1] -= rainVelocities[i] * dt;
        pArr[i * 3] -= 4.0 * dt;
        if (pArr[i * 3 + 1] < 0) {
          pArr[i * 3 + 1] = 48;
          pArr[i * 3] = cameraFocus.x + (Math.random() - 0.5) * 150;
          pArr[i * 3 + 2] = cameraFocus.z + (Math.random() - 0.5) * 150;
        }
      }
      rainPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  const dnIcon = document.getElementById("daynight-icon");
  const dnBar = document.getElementById("daynight-bar");
  if (dnIcon && dnBar) {
    dnIcon.className = isNightTime
      ? "fa-solid fa-moon text-sky-300"
      : "fa-solid fa-sun text-amber-300";
    dnBar.className = `h-full ${isNightTime ? "bg-sky-400" : "bg-amber-400"} transition-all duration-300`;
    dnBar.style.width = `${phaseProgress * 100}%`;
  }
}

