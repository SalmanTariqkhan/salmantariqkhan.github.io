/***********************************************************************
 * 6. EXPANDED 380x380 WORLD-SPACE GLSL TERRAIN, WATER, BRIDGE & DENSE FOREST
 ***********************************************************************/
const MAP_HALF = 190;
let riverShaderUniforms = null;
let terrainShaderUniforms = null;
let ambientButterflies = [];
let ambientDragonflies = [];
let shopEntities = [];

function getTerrainHeightAt(wx, wz) {
  const distRiver = Math.abs(wx - wz) / Math.SQRT2;
  const distLane = Math.abs(wx + wz) / Math.SQRT2;
  const edgeDist = Math.max(Math.abs(wx), Math.abs(wz));
  const rimMask = THREE.MathUtils.smoothstep(edgeDist, 168, 189);
  const rimNoise =
    (Math.sin(wx * 0.14) * Math.cos(wz * 0.14) +
      Math.sin((wx - wz) * 0.08) +
      2.0) *
    0.45;
  const rimHeight = rimMask * (4.2 + rimNoise * 3.8);

  const dRadBase = Math.hypot(wx + 140, wz - 140);
  const dDireBase = Math.hypot(wx - 140, wz + 140);
  const baseTerrace =
    (1.0 -
      THREE.MathUtils.smoothstep(Math.min(dRadBase, dDireBase), 22, 34)) *
    0.35;

  if (distLane < 7.4 && distRiver < 10.5 && rimMask < 0.35) {
    const t = THREE.MathUtils.clamp(distRiver / 10.5, 0, 1);
    return 0.48 + Math.cos(t * Math.PI * 0.5) * 0.58;
  }
  if (distLane < 8.0 && rimMask < 0.35) {
    return baseTerrace + rimHeight * 0.3;
  }
  const undulation =
    (Math.sin(wx * 0.09) * Math.cos(wz * 0.09) +
      Math.sin((wx + wz) * 0.05)) *
    0.36;
  const groundH = Math.max(0, undulation) + baseTerrace + rimHeight;
  if (distRiver < 12.2 && rimMask < 0.45) {
    const bankT = THREE.MathUtils.smoothstep(distRiver, 4.6, 12.2);
    const riverH = -1.48 * (1 - bankT * bankT) + rimHeight * 0.4;
    return THREE.MathUtils.lerp(riverH, groundH, bankT);
  }
  return groundH;
}

const SHARED_ASSETS = new WeakSet();
function registerSharedAsset(asset) {
  if (asset) SHARED_ASSETS.add(asset);
  return asset;
}
const _yUpAxis = new THREE.Vector3(0, 1, 0);
let _prismShardGeo = null;
let _prismShardMat = null;
function getPrismShardAssets() {
  if (!_prismShardGeo) {
    _prismShardGeo = registerSharedAsset(new THREE.ConeGeometry(0.32, 2.6, 5));
    _prismShardMat = registerSharedAsset(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
  }
  return { geo: _prismShardGeo, mat: _prismShardMat };
}
function freezeStaticObject(obj) {
  if (!obj) return obj;
  obj.traverse((child) => {
    child.updateMatrix();
    child.matrixAutoUpdate = false;
    if (
      child.isInstancedMesh &&
      typeof child.computeBoundingSphere === "function"
    ) {
      child.computeBoundingSphere();
    }
  });
  return obj;
}

// Map-wide InstancedMeshes (forest, ferns, rocks...) are culled as ONE object, so every tree on the
// 380m map was drawn each frame (and again in the shadow pass) no matter where the camera looked.
// Splitting them into spatial cells lets normal frustum culling skip everything off-screen.
function chunkStaticInstancedMeshes(cellSize = 64, minTris = 12000) {
  const targets = [];
  for (let i = 0; i < scene.children.length; i++) {
    const o = scene.children[i];
    if (!o.isInstancedMesh || o.matrixAutoUpdate || o.userData.nxgMax)
      continue;
    if (o.userData._chunked || o.count < 16) continue;
    const g = o.geometry;
    const perTris =
      (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (perTris * o.count < minTris) continue;
    if (!o.boundingSphere) o.computeBoundingSphere();
    if (o.boundingSphere.radius < cellSize * 1.25) continue;
    targets.push(o);
  }
  targets.forEach((src) => chunkOneInstancedMesh(src, cellSize));
}
function chunkOneInstancedMesh(src, cellSize = 64) {
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const parent = src.parent || scene;
  {
    const cells = new Map();
    const arr = src.instanceMatrix.array;
    for (let i = 0; i < src.count; i++) {
      const key =
        Math.floor(arr[i * 16 + 12] / cellSize) * 4096 +
        Math.floor(arr[i * 16 + 14] / cellSize);
      let list = cells.get(key);
      if (!list) cells.set(key, (list = []));
      list.push(i);
    }
    const chunks = [];
    cells.forEach((list) => {
      const part = new THREE.InstancedMesh(
        src.geometry,
        src.material,
        list.length,
      );
      for (let j = 0; j < list.length; j++) {
        src.getMatrixAt(list[j], m4);
        part.setMatrixAt(j, m4);
        if (src.instanceColor) {
          src.getColorAt(list[j], col);
          part.setColorAt(j, col);
        }
      }
      part.castShadow = src.castShadow;
      part.receiveShadow = src.receiveShadow;
      part.renderOrder = src.renderOrder;
      part.visible = src.visible;
      part.name = src.name;
      part.layers.mask = src.layers.mask;
      if (src.customDepthMaterial)
        part.customDepthMaterial = src.customDepthMaterial;
      if (Object.prototype.hasOwnProperty.call(src, "raycast"))
        part.raycast = src.raycast;
      part.matrix.copy(src.matrix);
      part.userData._chunked = true;
      freezeStaticObject(part);
      part.matrix.copy(src.matrix);
      part.matrixWorldNeedsUpdate = true;
      part.computeBoundingSphere();
      parent.add(part);
      chunks.push(part);
    });
    parent.remove(src);
    src.dispose();
    const ci = groundClutterMeshes.indexOf(src);
    if (ci >= 0) groundClutterMeshes.splice(ci, 1, ...chunks);
  }
}

function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.geometry && !SHARED_ASSETS.has(child.geometry))
      child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      mats.forEach((m) => {
        if (SHARED_ASSETS.has(m)) return;
        if (
          m.map &&
          !SHARED_ASSETS.has(m.map) &&
          m.map !== cobblePBR.map &&
          m.map !== riverbedPBR.map &&
          m.map !== marblePBR.map &&
          m.map !== barkPBR.map &&
          m.map !== contactShadowTex &&
          !Object.values(_creatureTexCache).some(
            (c) =>
              c.map === m.map ||
              c.bumpMap === m.map ||
              c.emissiveMap === m.map,
          ) &&
          !Object.values(_habitatTexCache).includes(m.map)
        ) {
          m.map.dispose();
        }
        m.dispose();
      });
    }
  });
}

function buildArenaEnvironment() {
  const terrainSegs = _isLowEndMobileBoot
    ? 120
    : _isTouchBoot
      ? 150
      : 192;
  const geo = new THREE.PlaneGeometry(
    MAP_HALF * 2,
    MAP_HALF * 2,
    terrainSegs,
    terrainSegs,
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const cols = [];
  // Rich, natural botanical greens, sunlit meadow olive-gold, and warm forest-floor loam for Radiant
  const cRadDeepMoss = new THREE.Color(0x1b4222);
  const cRadGrass = new THREE.Color(0x2b5e28);
  const cRadSunlit = new THREE.Color(0x4b7d2c);
  const cRadLoam = new THREE.Color(0x3f3323);
  const cRadSanctuaryStone = new THREE.Color(0x64707d);
  const cDireAsh = new THREE.Color(0x2e131d);
  const cDireMagma = new THREE.Color(0x581626);
  const cDireChar = new THREE.Color(0x1c0b12);
  const cLaneStone = new THREE.Color(0x4b596e);
  const cLaneBorder = new THREE.Color(0x64748b);
  const cRiverSand = new THREE.Color(0x2b5c58);
  const cRiverBed = new THREE.Color(0x0d333f);
  const cCliffStone = new THREE.Color(0x374151);

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const distRiver = Math.abs(vx - vz) / Math.SQRT2;
    const distLane = Math.abs(vx + vz) / Math.SQRT2;

    // Perimeter mountain ridge framing the outer edges of the 380x380 arena
    const edgeDist = Math.max(Math.abs(vx), Math.abs(vz));
    const rimMask = THREE.MathUtils.smoothstep(edgeDist, 168, 189);
    const rimNoise =
      (Math.sin(vx * 0.14) * Math.cos(vz * 0.14) +
        Math.sin((vx - vz) * 0.08) +
        2.0) *
      0.45;
    const rimHeight = rimMask * (4.2 + rimNoise * 3.8);

    // Subtle elevated citadel terraces around Radiant (-140,140) and Dire (140,-140)
    const dRadBase = Math.hypot(vx + 140, vz - 140);
    const dDireBase = Math.hypot(vx - 140, vz + 140);
    const baseTerrace =
      (1.0 -
        THREE.MathUtils.smoothstep(
          Math.min(dRadBase, dDireBase),
          22,
          34,
        )) *
      0.35;

    const col = new THREE.Color();
    if (distLane < 8.0 && rimMask < 0.35) {
      col.copy(cLaneStone);
      if (distLane > 5.8 && distLane <= 6.7) {
        col.lerp(cLaneBorder, 0.55);
      } else if (distLane > 6.7) {
        const edgeT = (distLane - 6.7) / 1.3;
        col.lerp(vx - vz < 0 ? cRadGrass : cDireAsh, edgeT * 0.85);
      }
      pos.setY(i, baseTerrace + rimHeight * 0.3);
    } else if (distRiver < 10.8 && rimMask < 0.45) {
      const bankT = THREE.MathUtils.clamp((distRiver - 4.8) / 6.0, 0, 1);
      const depth = -1.48 * (1 - bankT * bankT);
      pos.setY(i, depth + rimHeight * 0.4);
      col.copy(cRiverBed).lerp(cRiverSand, bankT * 0.94);
      if (bankT > 0.8) {
        const shoreT = (bankT - 0.8) / 0.2;
        col.lerp(
          vx - vz < 0 ? cRadLoam.clone().lerp(cRadGrass, 0.65) : cDireAsh,
          shoreT,
        );
      }
    } else {
      const blend = THREE.MathUtils.clamp((vx - vz + 16) / 32, 0, 1);
      const meadowWave =
        (Math.sin(vx * 0.13 + Math.cos(vz * 0.09)) + 1) * 0.5;
      const gladeSun = Math.max(0, Math.cos(vz * 0.1 - vx * 0.08));
      const loamPatch = THREE.MathUtils.smoothstep(
        Math.sin(vx * 0.18) * Math.cos(vz * 0.18),
        0.32,
        0.85,
      );
      const radBase = cRadDeepMoss
        .clone()
        .lerp(cRadGrass, meadowWave)
        .lerp(cRadSunlit, gladeSun * 0.52)
        .lerp(cRadLoam, loamPatch * 0.42);

      // Paved temple stone plaza around the Radiant Sanctuary (-96, 96)
      const radPlaza = 1.0 - THREE.MathUtils.smoothstep(dRadBase, 14, 27);
      radBase.lerp(cRadSanctuaryStone, radPlaza * 0.78);

      const magmaMix = (Math.cos(vz * 0.16) + 1) * 0.5;
      const direBase = cDireAsh
        .clone()
        .lerp(cDireMagma, magmaMix)
        .lerp(cDireChar, Math.max(0, Math.sin(vx * 0.12)) * 0.4);
      col.copy(radBase).lerp(direBase, blend);

      const undulation =
        (Math.sin(vx * 0.09) * Math.cos(vz * 0.09) +
          Math.sin((vx + vz) * 0.05)) *
        0.36;
      const h = Math.max(0, undulation) + baseTerrace + rimHeight;
      pos.setY(i, h);
      col.offsetHSL(0, 0, undulation * 0.04);

      if (rimMask > 0.15) {
        col.lerp(
          cCliffStone,
          THREE.MathUtils.clamp(rimMask * 1.15, 0, 0.92),
        );
      }
    }
    cols.push(col.r, col.g, col.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();

  const isUlTerrain =
    (typeof userSettings !== "undefined" &&
      userSettings.qualityPreset === "ultralight") ||
    _is1GbMobileBoot;
  // Tileable value-noise lattice: one bilinear fetch replaces four hashes per noise sample in the
  // terrain shader (which covers most of the screen and samples noise 6-9 times per pixel).
  const noiseN = 256;
  const noiseData = new Uint16Array(noiseN * noiseN);
  for (let ni = 0; ni < noiseData.length; ni++)
    noiseData[ni] = THREE.DataUtils.toHalfFloat(Math.random());
  const terrainNoiseTex = new THREE.DataTexture(
    noiseData,
    noiseN,
    noiseN,
    THREE.RedFormat,
    THREE.HalfFloatType,
  );
  terrainNoiseTex.wrapS = terrainNoiseTex.wrapT = THREE.RepeatWrapping;
  terrainNoiseTex.magFilter = terrainNoiseTex.minFilter =
    THREE.LinearFilter;
  terrainNoiseTex.generateMipmaps = false;
  terrainNoiseTex.needsUpdate = true;
  terrainShaderUniforms = {
    uNoiseTex: { value: terrainNoiseTex },
    uTime: { value: 0 },
    uUltraMax: { value: 1.0 },
    uUltraLight: { value: isUlTerrain ? 1.0 : 0.0 },
    uNightAmt: { value: 0.0 },
    uTowers: {
      value: Array.from({ length: 12 }, () => new THREE.Vector3(0, 0, 0)),
    },
  };
  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.05,
  });
  terrainMat.onBeforeCompile = (shader) => {
    shader.uniforms.uNoiseTex = terrainShaderUniforms.uNoiseTex;
    shader.uniforms.uTime = terrainShaderUniforms.uTime;
    shader.uniforms.uUltraMax = terrainShaderUniforms.uUltraMax;
    shader.uniforms.uUltraLight = terrainShaderUniforms.uUltraLight;
    shader.uniforms.uNightAmt = terrainShaderUniforms.uNightAmt;
    shader.uniforms.uTowers = terrainShaderUniforms.uTowers;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vTerrainWorldPos;
varying vec3 vTerrainNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uTime;
uniform float uUltraMax;
uniform float uUltraLight;
uniform float uNightAmt;
uniform vec3 uTowers[12];
uniform sampler2D uNoiseTex;
varying vec3 vTerrainWorldPos;
varying vec3 vTerrainNormal;
                  // Smoothstep-interpolated value noise read from a 256x256 lattice texture
                  float valNoise(vec2 p) {
                      vec2 i = floor(p);
                      vec2 f = fract(p);
                      f = f * f * (3.0 - 2.0 * f);
                      return texture2D(uNoiseTex, (i + f + 0.5) * 0.00390625).r;
                  }
                  float fbmTerrain(vec2 p) {
                      mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
                      return valNoise(p) * 0.65 + valNoise(rot * p * 2.05) * 0.35;
                  }
                  float terrainMicroHeight(vec2 wp, float baseMacroMicro) {
                      float blades = valNoise(vec2(wp.x * 3.8 + wp.y * 1.4, wp.y * 4.2 - wp.x * 1.2));
                      return baseMacroMicro + blades * 0.18;
                  }
                  // Fast domain-warped basalt crack seam
                  float direSeam(vec2 p) {
                      vec2 w = p + vec2(sin(p.y * 2.1), cos(p.x * 2.1)) * 0.28;
                      vec2 f = abs(fract(w) - 0.5);
                      return min(f.x, f.y) * 2.2;
                  }
              `,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
                  vec2 wpXZ = vTerrainWorldPos.xz;
                  float nMacro = 0.5;
                  float nMicro = 0.5;
                  float slopeRock = smoothstep(0.92, 0.68, vTerrainNormal.y) + smoothstep(1.2, 3.6, vTerrainWorldPos.y) * 0.75;
                  float side = smoothstep(-15.0, 15.0, vTerrainWorldPos.x - vTerrainWorldPos.z);
                  float crack = 0.0;
                  float crackCore = 0.0;
                  float magmaPulse = 0.9;
                  if (uUltraLight > 0.5) {
                      nMacro = valNoise(wpXZ * 0.09);
                      nMicro = valNoise(wpXZ * 0.45);
                      diffuseColor.rgb *= mix(0.82, 1.18, nMacro * 0.65 + nMicro * 0.35);
                      vec3 cliffCol = mix(vec3(0.10, 0.125, 0.17), vec3(0.20, 0.24, 0.29), nMicro);
                      diffuseColor.rgb = mix(diffuseColor.rgb, cliffCol, clamp(slopeRock, 0.0, 0.92));
                      if (side > 0.02) {
                          float vein = abs(sin(wpXZ.x * 0.24 + nMacro * 3.2) * cos(wpXZ.y * 0.24 - nMicro * 2.6));
                          float molten = smoothstep(0.38, 0.64, nMacro) * smoothstep(7.4, 9.4, abs(wpXZ.x + wpXZ.y) * 0.70710678);
                          crack = (1.0 - smoothstep(0.0, 0.12, vein)) * molten;
                          diffuseColor.rgb += vec3(0.36, 0.075, 0.018) * crack * side;
                      }
                  } else {
                      nMacro = fbmTerrain(wpXZ * 0.065);
                      nMicro = fbmTerrain(wpXZ * 0.48);
                      float nGrass = valNoise(vec2(wpXZ.x * 3.8 + wpXZ.y * 1.4, wpXZ.y * 4.2 - wpXZ.x * 1.2));
                      float nClover = valNoise(wpXZ * 1.65);
                      float grain = mix(0.76, 1.28, nMacro * 0.46 + nMicro * 0.28 + nGrass * 0.16 + nClover * 0.10);
                      diffuseColor.rgb *= grain;

                      // Stratified cliff rock texture on steep slopes or high rim mountains
                      float strata = sin(vTerrainWorldPos.y * 1.9 + nMacro * 5.0) * 0.5 + 0.5;
                      vec3 cliffCol = mix(vec3(0.10, 0.125, 0.17), vec3(0.21, 0.245, 0.30), strata * 0.3 + nMicro * 0.7);
                      diffuseColor.rgb = mix(diffuseColor.rgb, cliffCol, clamp(slopeRock, 0.0, 0.92));

                      // Deep rich forest-emerald grass variation & warm woodland loam on Radiant side
                      vec3 radMeadowGold = vec3(0.032, 0.048, 0.010) * smoothstep(0.58, 0.90, nMacro) * smoothstep(0.48, 0.86, nGrass);
                      vec3 radSoilPatch = vec3(0.035, 0.024, 0.008) * smoothstep(0.72, 0.94, 1.0 - nClover);
                      vec3 radOrganic = radMeadowGold + radSoilPatch;

                      // Animated pulsing molten magma cracks in Dire territory
                      magmaPulse = 0.78 + 0.28 * sin(uTime * 2.1 + wpXZ.x * 0.14 + wpXZ.y * 0.14);
                      if (side > 0.06) {
                          float seam = direSeam(wpXZ * 0.21 + vec2(nMicro * 0.4));
                          float molten = smoothstep(0.38, 0.64, nMacro);
                          // Keep the paved lane and the Dire plaza intact
                          molten *= smoothstep(7.4, 9.4, abs(wpXZ.x + wpXZ.y) * 0.70710678);
                          molten *= smoothstep(26.0, 38.0, length(wpXZ - vec2(140.0, -140.0)));
                          crack = (1.0 - smoothstep(0.0, 0.13, seam)) * molten;
                          crackCore = (1.0 - smoothstep(0.0, 0.04, seam)) * molten;
                      }
                      vec3 direEmber = vec3(0.68, 0.16, 0.025) * crack * magmaPulse + vec3(0.16, 0.025, 0.03) * smoothstep(0.68, 0.92, nMicro);
                      diffuseColor.rgb += mix(radOrganic, direEmber, side) * (1.0 - clamp(slopeRock, 0.0, 0.8));
                      float veinTier = smoothstep(0.25, 0.85, uUltraMax);
                      diffuseColor.rgb += vec3(1.18, 0.38, 0.06) * crackCore * side * magmaPulse * veinTier;
                  }

                  if (uUltraMax > 0.85) {
                      // Ultra Max: Fine high-frequency grass-blade & moss micro-texture (deepens lush emerald contrast)
                      float fineTurf = valNoise(wpXZ * 8.2);
                      diffuseColor.rgb *= mix(0.84, 1.02, fineTurf);

                      // Ultra Max: Carved Mid-Lane Ancient Cobblestone Mosaic & Golden Border Inlay
                      float dLane = abs(wpXZ.x + wpXZ.y) * 0.70710678;
                      if (dLane < 7.8) {
                          vec2 laneUv = vec2((wpXZ.x - wpXZ.y) * 0.70710678, (wpXZ.x + wpXZ.y) * 0.70710678) * 1.15;
                          vec2 cell = fract(laneUv) - 0.5;
                          float cobble = smoothstep(0.46, 0.34, max(abs(cell.x), abs(cell.y)));
                          float laneFade = 1.0 - smoothstep(6.2, 7.8, dLane);
                          diffuseColor.rgb *= mix(1.0, 0.80 + cobble * 0.28, laneFade);
                          float runeEdge = smoothstep(0.24, 0.05, abs(dLane - 6.7));
                          vec3 trimHue = mix(vec3(0.92, 0.76, 0.28), vec3(0.95, 0.32, 0.38), side);
                          diffuseColor.rgb = mix(diffuseColor.rgb, trimHue, runeEdge * 0.65);
                      }
                  }

                  // Smooth circular sanctuary trim around Radiant & Dire Base Plazas (no square grid lines)
                  float dRadP = length(wpXZ - vec2(-140.0, 140.0));
                  float dDireP = length(wpXZ - vec2(140.0, -140.0));
                  float plazaMask = 1.0 - smoothstep(19.0, 32.0, min(dRadP, dDireP));
                  if (plazaMask > 0.02) {
                      float ringTrim = smoothstep(0.18, 0.04, abs(min(dRadP, dDireP) - 22.5));
                      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.68, 0.24), ringTrim * plazaMask * 0.75);
                  }

                  // Wet shoreline darkening & river pebble transition along banks
                  float dRiv = abs(vTerrainWorldPos.x - vTerrainWorldPos.z) * 0.70710678;
                  float wetShore = (1.0 - smoothstep(7.2, 10.3, dRiv)) * (1.0 - clamp(slopeRock, 0.0, 1.0));
                  diffuseColor.rgb *= mix(1.0, 0.68, wetShore * 0.75);

                  // Nighttime wilderness darkening outside standing tower light pools
                  if (uNightAmt > 0.01) {
                      float towerGlow = 0.0;
                      for (int ti = 0; ti < 12; ti++) {
                          float tRad = uTowers[ti].z;
                          if (tRad > 0.5) {
                              float dTow = length(wpXZ - uTowers[ti].xy);
                              float g = 1.0 - smoothstep(tRad * 0.42, tRad, dTow);
                              towerGlow = max(towerGlow, g);
                          }
                      }
                      diffuseColor.rgb *= mix(1.0, 0.44, uNightAmt * (1.0 - towerGlow));
                      diffuseColor.rgb += vec3(0.075, 0.055, 0.024) * (uNightAmt * towerGlow);
                  }
              `,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
                  // World-space grass-blade & stone relief micro-bump normal perturbation (with distance LOD fade)
                  float maxBumpDist = mix(54.0, 78.0, uUltraMax);
                  float detailFade = uUltraLight > 0.5 ? 0.0 : smoothstep(maxBumpDist, 24.0, length(cameraPosition - vTerrainWorldPos));
                  if (detailFade > 0.01) {
                      float baseMM = nMacro * 0.45 + nMicro * 0.30;
                      float hC = terrainMicroHeight(vTerrainWorldPos.xz, baseMM);
                      vec3 worldBump = normalize(vec3(-dFdx(hC) * 22.0, 1.0, -dFdy(hC) * 22.0));
                      vec3 viewBump = normalize((viewMatrix * vec4(worldBump, 0.0)).xyz);
                      normal = normalize(mix(normal, viewBump, mix(0.32, 0.56, uUltraMax) * detailFade));
                  }
              `,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
                  float dRivRough = abs(vTerrainWorldPos.x - vTerrainWorldPos.z) * 0.70710678;
                  float wetSheen = 1.0 - smoothstep(7.2, 10.2, dRivRough);
                  roughnessFactor *= mix(1.0, 0.34, wetSheen);
                  if (uUltraMax > 0.85) {
                      float dewGlint = valNoise(vTerrainWorldPos.xz * 2.4);
                      roughnessFactor *= mix(0.68, 0.96, dewGlint);
                  }
              `,
      );
  };

  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(freezeStaticObject(terrain));

  // Seamless Outer Mountain & Foothill Apron surrounding the 380x380 arena so edges never expose empty void
  const skirtGeo = new THREE.PlaneGeometry(1140, 1140, 96, 96);
  skirtGeo.rotateX(-Math.PI / 2);
  const sPos = skirtGeo.attributes.position;
  const sCols = [];
  const cOuterCliff = new THREE.Color(0x283242);
  const cOuterPeak = new THREE.Color(0x475569);
  const cOuterRadValley = new THREE.Color(0x183924);
  const cOuterDireValley = new THREE.Color(0x281019);
  for (let i = 0; i < sPos.count; i++) {
    const sx = sPos.getX(i);
    const sz = sPos.getZ(i);
    const eDist = Math.max(Math.abs(sx), Math.abs(sz));
    const insideT = 1.0 - THREE.MathUtils.smoothstep(eDist, 178, 192);
    const outerRise = THREE.MathUtils.smoothstep(eDist, 185, 240);
    const ridgeWave =
      (Math.sin(sx * 0.065) * Math.cos(sz * 0.065) +
        Math.sin((sx + sz) * 0.045) +
        2.0) *
      0.5;
    const peakNoise =
      (Math.sin(sx * 0.14) * Math.cos(sz * 0.14) + 1.0) * 0.5;
    const sy =
      insideT * -3.5 +
      (1.0 - insideT) *
        (3.6 + outerRise * (5.5 + ridgeWave * 9.5 + peakNoise * 4.2));
    sPos.setY(i, sy);
    const sideMix = THREE.MathUtils.clamp((sx - sz + 30) / 60, 0, 1);
    const baseValley = cOuterRadValley
      .clone()
      .lerp(cOuterDireValley, sideMix);
    const sc = cOuterCliff
      .clone()
      .lerp(baseValley, 0.35)
      .lerp(
        cOuterPeak,
        THREE.MathUtils.clamp(outerRise * ridgeWave * 0.9, 0, 0.85),
      );
    sCols.push(sc.r, sc.g, sc.b);
  }
  skirtGeo.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(sCols, 3),
  );
  skirtGeo.computeVertexNormals();
  const outerSkirtMesh = new THREE.Mesh(
    skirtGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  scene.add(freezeStaticObject(outerSkirtMesh));

  // Keep river & riverbed cleanly bounded inside the perimeter mountain ridge (never protruding past +-128.5)
  const riverLen = MAP_HALF * 2 * Math.SQRT2 * 0.985;
  const riverbedMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(19.6, riverLen, 16, 72),
    new THREE.MeshStandardMaterial({
      map: riverbedPBR.map,
      bumpMap: riverbedPBR.bumpMap,
      bumpScale: 0.28,
      roughness: 0.85,
      color: 0x4fd1c5,
    }),
  );
  riverbedMesh.rotation.x = -Math.PI / 2;
  riverbedMesh.rotation.z = Math.PI / 4;
  riverbedMesh.position.y = -1.18;
  riverbedMesh.receiveShadow = true;
  scene.add(freezeStaticObject(riverbedMesh));

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x57606f,
    map: marblePBR.map,
    bumpMap: marblePBR.bumpMap,
    bumpScale: 0.24,
    roughness: 0.82,
    metalness: 0.05,
    envMapIntensity: 0.24,
  });
  rockMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vBoulderWorldPos;
varying vec3 vBoulderNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vec4 bWp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
    bWp = instanceMatrix * bWp;
#endif
vBoulderWorldPos = (modelMatrix * bWp).xyz;
vBoulderNormal = normalize(objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vBoulderWorldPos;
varying vec3 vBoulderNormal;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
// Wet waterline darkening near y = -0.56 and subtle river-moss tint on upper rock crowns
float aboveWater = vBoulderWorldPos.y - (-0.56);
float wetZone = 1.0 - smoothstep(-0.08, 0.24, aboveWater);
float mossCap = smoothstep(0.10, 0.38, aboveWater) * smoothstep(0.45, 0.90, vBoulderNormal.y);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.24, 0.34, 0.25), mossCap * 0.42);
diffuseColor.rgb *= mix(1.0, 0.46, wetZone);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
float wetRough = 1.0 - smoothstep(-0.08, 0.24, vBoulderWorldPos.y - (-0.56));
roughnessFactor *= mix(1.0, 0.38, wetRough);`,
      );
  };

  const boulderUniformArray = [];
  const riverRocksData = [];
  for (let i = 0; i < 96; i++) {
    const along = (Math.random() - 0.5) * 310;
    const across = (Math.random() - 0.5) * 18.6;
    if (Math.abs(along) < 14.5) continue;
    const rx = (along + across) / Math.SQRT2;
    const rz = (along - across) / Math.SQRT2;
    const rad = 0.52 + Math.random() * 0.78;
    const absAcross = Math.abs(across);
    const bankT = THREE.MathUtils.clamp((absAcross - 4.8) / 6.0, 0, 1);
    const bankSurfaceY = -1.48 * (1 - bankT * bankT);
    const rockY = absAcross > 6.4 ? bankSurfaceY + 0.02 : -0.96;
    const topY = rockY + 0.52 * rad;
    riverRocksData.push({
      x: rx,
      y: rockY,
      z: rz,
      rad,
      topY,
      rotX: (Math.random() - 0.5) * 0.35,
      rotY: Math.random() * Math.PI * 2,
      rotZ: (Math.random() - 0.5) * 0.35,
    });
  }
  if (riverRocksData.length > 0) {
    // Sculpted smooth river boulder geometry (subdivided icosahedron with organic water-worn lobes)
    const rockGeo = new THREE.IcosahedronGeometry(1.0, 2);
    const rPos = rockGeo.attributes.position;
    for (let k = 0; k < rPos.count; k++) {
      const vx = rPos.getX(k),
        vy = rPos.getY(k),
        vz = rPos.getZ(k);
      const lobe =
        1.0 +
        0.14 * Math.sin(vx * 3.1 + vz * 2.4) +
        0.1 * Math.cos(vy * 2.8 - vx * 2.2);
      const flatTop = vy > 0 ? 1.0 - vy * 0.18 : 1.0;
      rPos.setXYZ(k, vx * lobe, vy * lobe * flatTop, vz * lobe);
    }
    rockGeo.computeVertexNormals();

    const rockInst = new THREE.InstancedMesh(
      rockGeo,
      rockMat,
      riverRocksData.length,
    );
    rockInst.receiveShadow = true;
    const rDummy = new THREE.Object3D();
    riverRocksData.forEach((rk, idx) => {
      rDummy.position.set(rk.x, rk.y, rk.z);
      rDummy.rotation.set(rk.rotX, rk.rotY, rk.rotZ);
      rDummy.scale.set(1.18 * rk.rad, 0.52 * rk.rad, 0.96 * rk.rad);
      rDummy.updateMatrix();
      rockInst.setMatrixAt(idx, rDummy.matrix);
    });
    scene.add(freezeStaticObject(rockInst));

    // Register every rock that pokes through or sits near the -0.56 waterline for foam collar rendering
    riverRocksData
      .filter((rk) => rk.topY > -0.68)
      .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
      .slice(0, 64)
      .forEach((rk) => {
        boulderUniformArray.push(
          new THREE.Vector3(rk.x, rk.z, rk.rad * 0.96),
        );
      });
  }

  // Pre-bake 64x512 river-corridor boulder proximity lookup texture (replaces 48-iteration fragment loop)
  const bMapW = 64,
    bMapH = 512;
  const bMapData = new Uint8Array(bMapW * bMapH * 4);
  for (let py = 0; py < bMapH; py++) {
    const along = ((py + 0.5) / bMapH - 0.5) * riverLen;
    for (let px = 0; px < bMapW; px++) {
      const across = ((px + 0.5) / bMapW - 0.5) * 19.8;
      const wx = (along + across) / Math.SQRT2;
      const wz = (along - across) / Math.SQRT2;
      let maxCollar = 0;
      for (let ri = 0; ri < boulderUniformArray.length; ri++) {
        const rk = boulderUniformArray[ri];
        const dRock = Math.hypot(wx - rk.x, wz - rk.y) - rk.z;
        if (dRock > -0.25 && dRock < 0.58) {
          const c = Math.max(0, Math.min(1, 1.0 - dRock / 0.36));
          if (c > maxCollar) maxCollar = c;
        }
      }
      const idx = (py * bMapW + px) * 4;
      bMapData[idx] = Math.round(maxCollar * 255);
      bMapData[idx + 3] = 255;
    }
  }
  const boulderFoamTex = new THREE.DataTexture(
    bMapData,
    bMapW,
    bMapH,
    THREE.RGBAFormat,
  );
  boulderFoamTex.minFilter = THREE.LinearFilter;
  boulderFoamTex.magFilter = THREE.LinearFilter;
  boulderFoamTex.needsUpdate = true;

  // Pre-bake 256x256 seamless RGBA water texture (R: wave height, G: micro-ripples, B: caustics, A: foam)
  const wTexSize = 256;
  const wTexData = new Uint8Array(wTexSize * wTexSize * 4);
  const pHash = (ix, iy, p) => {
    const x = ((ix % p) + p) % p;
    const y = ((iy % p) + p) % p;
    const s = Math.sin(x * 127.1 + y * 311.7 + p * 17.3) * 43758.5453;
    return s - Math.floor(s);
  };
  const pNoise = (u, v, period) => {
    const x = u * period,
      y = v * period;
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const sx = fx * fx * (3.0 - 2.0 * fx),
      sy = fy * fy * (3.0 - 2.0 * fy);
    const n00 = pHash(ix, iy, period),
      n10 = pHash(ix + 1, iy, period);
    const n01 = pHash(ix, iy + 1, period),
      n11 = pHash(ix + 1, iy + 1, period);
    return (
      (n00 * (1.0 - sx) + n10 * sx) * (1.0 - sy) +
      (n01 * (1.0 - sx) + n11 * sx) * sy
    );
  };
  for (let y = 0; y < wTexSize; y++) {
    const v = y / wTexSize;
    for (let x = 0; x < wTexSize; x++) {
      const u = x / wTexSize;
      const waveH =
        pNoise(u, v, 4) * 0.58 +
        pNoise(u, v, 8) * 0.28 +
        pNoise(u, v, 16) * 0.14;
      const micro = pNoise(u, v, 16) * 0.55 + pNoise(u, v, 32) * 0.45;
      const cA = pNoise(u, v, 8),
        cB = pNoise((u + 0.37) % 1, (v + 0.61) % 1, 16);
      const caust = Math.max(
        0,
        Math.min(1, 1.0 - Math.abs(cA - cB) * 3.4),
      );
      const foam = pNoise(u, v, 12) * 0.6 + pNoise(u, v, 24) * 0.4;
      const o = (y * wTexSize + x) * 4;
      wTexData[o] = Math.round(waveH * 255);
      wTexData[o + 1] = Math.round(micro * 255);
      wTexData[o + 2] = Math.round(caust * 255);
      wTexData[o + 3] = Math.round(foam * 255);
    }
  }
  const waterNoiseTex = new THREE.DataTexture(
    wTexData,
    wTexSize,
    wTexSize,
    THREE.RGBAFormat,
  );
  waterNoiseTex.wrapS = THREE.RepeatWrapping;
  waterNoiseTex.wrapT = THREE.RepeatWrapping;
  waterNoiseTex.minFilter = THREE.LinearFilter;
  waterNoiseTex.magFilter = THREE.LinearFilter;
  waterNoiseTex.needsUpdate = true;

  const laneRoadMat = new THREE.MeshStandardMaterial({
    map: cobblePBR.map,
    bumpMap: cobblePBR.bumpMap,
    bumpScale: 0.22,
    roughnessMap: cobblePBR.roughnessMap,
    roughness: 0.76,
    transparent: true,
    opacity: 0.82,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const halfRoadLen = riverLen * 0.42 - 10.2;
  const roadMidOffset = 10.2 + halfRoadLen * 0.5;
  [-1, 1].forEach((dirSign) => {
    const seg = new THREE.Mesh(
      new THREE.PlaneGeometry(12.6, halfRoadLen),
      laneRoadMat,
    );
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = -Math.PI / 4;
    const d = dirSign * roadMidOffset;
    seg.position.set(d / Math.SQRT2, 0.03, -d / Math.SQRT2);
    seg.receiveShadow = true;
    scene.add(freezeStaticObject(seg));
  });

  riverShaderUniforms = {
    uTime: { value: 0 },
    uFastWater: { value: 0.0 },
    uUltraMax: { value: 1.0 },
    uDeepColor: { value: new THREE.Color(0x042b47) },
    uShallowColor: { value: new THREE.Color(0x0e7c74) },
    uSkyColor: { value: new THREE.Color(0x38bdf8) },
    uSunColor: { value: new THREE.Color(0xfffbeb) },
    uSunDir: { value: new THREE.Vector3(0.55, 0.78, 0.35).normalize() },
    uWaterTex: { value: waterNoiseTex },
    uBoulderMap: { value: boulderFoamTex },
    uRiverLen: { value: riverLen },
  };

  const isLightRiver =
    _isLowEndMobileBoot ||
    (typeof userSettings !== "undefined" &&
      userSettings.qualityPreset === "ultralight");
  const riverGeo = new THREE.PlaneGeometry(
    19.8,
    riverLen,
    isLightRiver ? 28 : 84,
    isLightRiver ? 84 : 240,
  );
  const riverMat = new THREE.ShaderMaterial({
    uniforms: riverShaderUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
              uniform float uTime;
              varying vec3 vWorldPos;
              varying float vBankDist;
              float worldSwell(vec2 wp) {
                  vec2 flow = vec2(0.7071, -0.7071);
                  vec2 crossDir = vec2(0.7071, 0.7071);
                  float d1 = dot(wp, flow * 0.42 + crossDir * 0.28);
                  float d2 = dot(wp, flow * 0.65 - crossDir * 0.35);
                  float d3 = dot(wp, crossDir * 0.85 - flow * 0.20);
                  return (sin(d1 - uTime * 1.15) * 0.042 +
                          cos(d2 - uTime * 1.35) * 0.028 +
                          sin(d3 + uTime * 0.95) * 0.020);
              }
              void main() {
                  vec4 wp = modelMatrix * vec4(position, 1.0);
                  float perpDist = abs(wp.x - wp.z) * 0.70710678;
                  vBankDist = clamp(1.0 - (perpDist / 9.52), 0.0, 1.0);
                  wp.y += worldSwell(wp.xz) * smoothstep(0.0, 0.25, vBankDist);
                  vWorldPos = wp.xyz;
                  gl_Position = projectionMatrix * viewMatrix * wp;
              }
          `,
    fragmentShader: `
              uniform float uTime;
              uniform float uFastWater;
              uniform float uUltraMax;
              uniform vec3 uDeepColor;
              uniform vec3 uShallowColor;
              uniform vec3 uSkyColor;
              uniform vec3 uSunColor;
              uniform vec3 uSunDir;
              uniform sampler2D uWaterTex;
              uniform sampler2D uBoulderMap;
              uniform float uRiverLen;
              varying vec3 vWorldPos;
              varying float vBankDist;

              // Pre-baked multi-octave liquid wave height lookup
              float waterHeight(vec2 wp, bool detail) {
                  vec2 flow = vec2(0.7071, -0.7071);
                  vec2 uv1 = wp * 0.022 - flow * (uTime * 0.045);
                  vec2 uv2 = mat2(0.80, -0.60, 0.60, 0.80) * wp * 0.044 - flow * (uTime * 0.072);
                  float h = texture2D(uWaterTex, uv1).r * 0.68 + texture2D(uWaterTex, uv2).r * 0.32;
                  if (detail && uUltraMax > 0.5) {
                      vec2 uv3 = wp * 0.095 + vec2(-0.55, -0.83) * (uTime * 0.095);
                      h = h * 0.88 + texture2D(uWaterTex, uv3).g * 0.12;
                  }
                  return h * 2.0 - 1.0;
              }

              void main() {
                  vec2 wp = vWorldPos.xz;
                  if (max(abs(wp.x), abs(wp.y)) > 188.5) discard;
                  if (uFastWater > 0.5) {
                      float depthFactor = smoothstep(0.03, 0.68, vBankDist);
                      float ripple = sin(wp.x * 0.45 - uTime * 1.4) * cos(wp.y * 0.45 + uTime * 1.2) * 0.5 + 0.5;
                      vec3 waterCol = mix(uShallowColor, uDeepColor, pow(depthFactor, 0.82));
                      waterCol += vec3(0.06, 0.22, 0.28) * ripple * (1.0 - depthFactor * 0.6);
                      float bankFoam = smoothstep(0.11, 0.01, vBankDist) * 0.55;
                      vec3 finalRGB = mix(waterCol, vec3(0.86, 0.94, 0.98), bankFoam);
                      float alpha = max(smoothstep(0.0, 0.04, vBankDist) * mix(0.32, 0.86, depthFactor), bankFoam);
                      gl_FragColor = vec4(finalRGB, alpha);
                      return;
                  }
                  float hC = waterHeight(wp, true);
                  // Fast screen-space wave normal via hardware derivatives (saves 4 texture lookups)
                  vec3 normal = normalize(vec3(-dFdx(hC) * 36.0, 1.15, -dFdy(hC) * 36.0));
                  vec3 viewDir = normalize(cameraPosition - vWorldPos);
                  float ndotv = max(dot(normal, viewDir), 0.0);

                  // Schlick Fresnel sky reflection
                  float fresnel = 0.04 + 0.68 * pow(1.0 - ndotv, 3.8);
                  float depthFactor = smoothstep(0.03, 0.68, vBankDist);

                  // Natural Beer-Lambert water absorption & Pre-Baked Chromatic RGB shallow sun-caustics
                  vec3 waterCol = mix(uShallowColor, uDeepColor, pow(depthFactor, 0.80));
                  float caustMask = 1.0 - depthFactor * 0.76;
                  vec2 flow = vec2(0.7071, -0.7071);
                  vec4 texCaust1 = texture2D(uWaterTex, wp * 0.036 - flow * uTime * 0.028);
                  vec4 texCaust2 = texture2D(uWaterTex, wp * 0.058 + vec2(0.42, 0.91) * uTime * 0.022 + 0.31);
                  float c1 = texCaust1.b;
                  float c2 = texCaust2.b;
                  if (uUltraMax > 0.5) {
                      float cR = smoothstep(0.50, 0.88, c1 * 0.62 + c2 * 0.38);
                      float cG = smoothstep(0.47, 0.86, c1 * 0.52 + c2 * 0.48);
                      float cB = smoothstep(0.44, 0.84, c1 * 0.42 + c2 * 0.58);
                      waterCol += vec3(cR * 0.18, cG * 0.54, cB * 0.62) * caustMask * 0.44;
                      // Subsurface scattering (SSS) turquoise crest glow when sunlight pierces wave peaks
                      float sss = pow(max(0.0, dot(viewDir, -uSunDir + normal * 0.55)), 3.0) * clamp(hC + 0.35, 0.0, 1.0);
                      waterCol += vec3(0.08, 0.52, 0.56) * sss * 0.48;
                  } else {
                      float caust = smoothstep(0.47, 0.86, c1 * 0.55 + c2 * 0.45) * caustMask;
                      waterCol += vec3(0.14, 0.46, 0.52) * caust * 0.34;
                  }

                  // Subtle depth-band color richness from wave troughs to crests
                  waterCol *= 0.92 + 0.16 * clamp(hC * 0.5 + 0.5, 0.0, 1.0);

                  vec3 surfaceCol = mix(waterCol, uSkyColor * 0.92, clamp(fresnel * mix(0.58, 0.68, uUltraMax), 0.0, 0.70));

                  // Smooth, natural sun sheen & crisp miniature-diorama river sparkles
                  vec3 halfVec = normalize(uSunDir + viewDir);
                  float ndoth = max(dot(normal, halfVec), 0.0);
                  float spec = pow(ndoth, mix(56.0, 96.0, uUltraMax)) * mix(0.62, 0.98, uUltraMax);
                  float microRippleA = texCaust1.g * 2.0 - 1.0;
                  float microRippleB = texCaust2.a * 2.0 - 1.0;
                  vec3 glintNorm = normalize(normal + vec3(microRippleA * 0.48, 0.0, microRippleB * 0.48));
                  float glintDot = max(dot(glintNorm, halfVec), 0.0);
                  float glintSparkle = pow(glintDot, 132.0) * mix(0.75, 1.45, uUltraMax) * smoothstep(0.06, 0.35, vBankDist);
                  float sheen = pow(ndoth, 14.0) * mix(0.14, 0.20, uUltraMax);
                  surfaceCol += uSunColor * (spec + sheen + glintSparkle);

                  // Delicate shoreline & pre-baked emergent boulder foam collars
                  float foamNoise = texCaust1.a;
                  float waveLap = sin(vBankDist * 24.0 - uTime * 1.45 + foamNoise * 2.6) * 0.5 + 0.5;
                  float bankFoam = smoothstep(0.13, 0.01, vBankDist) * smoothstep(0.46, 0.78, foamNoise * 0.65 + waveLap * 0.35);

                  float alongCoord = (wp.x + wp.y) * 0.70710678;
                  float acrossCoord = (wp.x - wp.y) * 0.70710678;
                  vec2 boulderUv = vec2(acrossCoord / 19.8 + 0.5, alongCoord / uRiverLen + 0.5);
                  float boulderProx = texture2D(uBoulderMap, boulderUv).r;
                  float rockFoam = boulderProx * smoothstep(0.36, 0.82, foamNoise * 0.75 + 0.25);

                  float totalFoam = clamp(bankFoam * 0.62 + rockFoam * 0.36, 0.0, 0.8);

                  vec3 finalRGB = mix(surfaceCol, vec3(0.88, 0.95, 0.98), totalFoam);
                  // Translucent shallows so riverbed stones show through naturally; deeper opaque center
                  float alpha = smoothstep(0.0, 0.04, vBankDist) * mix(0.28, 0.86, depthFactor);
                  alpha = max(alpha, totalFoam * 0.75);

                  gl_FragColor = vec4(finalRGB, alpha);
              }
          `,
  });

  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.rotation.x = -Math.PI / 2;
  riverMesh.rotation.z = Math.PI / 4;
  riverMesh.position.y = -0.56;
  scene.add(freezeStaticObject(riverMesh));

  buildLaneCurbsAndRiverFlora();
  buildArchedRiverBridge();
  buildRoshanPit(-50, -50);
  buildFountainSanctuary(-140, 140, "radiant");
  buildFountainSanctuary(140, -140, "dire");
  build3DMerchantShop(-126, 148, "base", "Radiant Armory");
  build3DMerchantShop(126, -148, "base", "Dire Armory");
  build3DMerchantShop(64, 24, "secret", "East Secret Shop");
  build3DMerchantShop(-64, -24, "secret", "West Secret Shop");

  [
    [-22, 6],
    [-6, 22],
    [22, -6],
    [6, -22],
    [-37, -37],
    [-62, -37],
    [-37, -62],
    [62, 20],
  ].forEach(([tx, tz], idx) => {
    buildTorchBrazier(tx, tz, tx - tz < 0 ? 0x34d399 : 0xf97316, idx < 4);
  });

  buildDenseInstancedForest();
  buildDetailedAmbientInsects();
  initVolumetricGodRays();
}

let godRayGroup = null;
let godRayUniforms = null;
function initVolumetricGodRays() {
  godRayGroup = new THREE.Group();
  godRayUniforms = {
    uTime: { value: 0 },
    uSunFactor: { value: 1.0 },
    uColor: { value: new THREE.Color(0xfff4cc) },
  };

  const rayMat = new THREE.ShaderMaterial({
    uniforms: godRayUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
    fog: false,
    vertexShader: `
              varying vec2 vUv;
              varying vec3 vViewNormal;
              varying vec3 vWorldPos;
              void main() {
                  vUv = uv;
                  vec4 wp = modelMatrix * vec4(position, 1.0);
                  vWorldPos = wp.xyz;
                  vViewNormal = normalize(normalMatrix * normal);
                  gl_Position = projectionMatrix * viewMatrix * wp;
              }
          `,
    fragmentShader: `
              uniform float uTime;
              uniform float uSunFactor;
              uniform vec3 uColor;
              varying vec2 vUv;
              varying vec3 vViewNormal;
              varying vec3 vWorldPos;

              void main() {
                  // Soft grazing-angle edge falloff so cone silhouettes dissolve seamlessly to 0
                  float edgeFade = pow(abs(normalize(vViewNormal).z), 2.8);

                  // Smooth vertical fade at both top and bottom + world height fade above ground
                  float vertFade = smoothstep(0.0, 0.34, vUv.y) * smoothstep(1.0, 0.52, vUv.y);
                  float groundFade = smoothstep(3.5, 18.0, vWorldPos.y);

                  // Subtle organic crepuscular ray striations around the shaft circumference
                  float ang = vUv.x * 6.2831853;
                  float streak1 = sin(ang * 5.0 + uTime * 0.32) * 0.5 + 0.5;
                  float streak2 = cos(ang * 9.0 - uTime * 0.21 + vUv.y * 2.0) * 0.5 + 0.5;
                  float streaks = mix(0.45, 1.15, streak1 * 0.6 + streak2 * 0.4);

                  float alpha = edgeFade * vertFade * groundFade * streaks * (0.038 * uSunFactor);
                  gl_FragColor = vec4(uColor, alpha);
              }
          `,
  });

  const rayGeo = new THREE.CylinderGeometry(1.4, 5.2, 66, 28, 1, true);
  const coords = [
    [-88, 80, 0.95],
    [-42, 34, 0.9],
    [0, 0, 1.0],
    [44, -42, 0.9],
    [90, -86, 0.95],
  ];
  coords.forEach(([rx, rz, sc], i) => {
    const beam = new THREE.Mesh(rayGeo, rayMat);
    beam.position.set(rx, 36, rz);
    beam.scale.set(sc, 1.0, sc);
    beam.userData.basePos = new THREE.Vector3(rx, 36, rz);
    beam.userData.phase = i * 1.37;
    godRayGroup.add(beam);
  });
  scene.add(godRayGroup);
}

function buildLaneCurbsAndRiverFlora() {
  const dummy = new THREE.Object3D();
  const tmpCol = new THREE.Color();

  // 1. Carved Stone Lane Curbs & Glowing Arcane Waystones bordering the Mid-Lane
  const curbMat = new THREE.MeshStandardMaterial({
    map: marblePBR.map,
    bumpMap: marblePBR.bumpMap,
    bumpScale: 0.16,
    roughness: 0.56,
    metalness: 0.22,
  });
  const curbBlocks = [];
  const waystones = [];
  for (let s = -168; s <= 168; s += 6.0) {
    if (Math.abs(s) < 15.5) continue; // Keep clear of arched river bridge
    [-6.45, 6.45].forEach((offset, sideIdx) => {
      const wx = (s + offset) / Math.SQRT2;
      const wz = (-s + offset) / Math.SQRT2;
      const gy = getTerrainHeightAt(wx, wz);
      curbBlocks.push({ x: wx, y: gy, z: wz, isRad: s < 0 });
      if (Math.abs(s) % 24 === 0) {
        waystones.push({ x: wx, y: gy, z: wz, isRad: s < 0, sideIdx });
      }
    });
  }
  if (curbBlocks.length > 0) {
    const curbInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.68, 0.36, 4.4),
      curbMat,
      curbBlocks.length,
    );
    curbInst.receiveShadow = true;
    curbInst.castShadow = false;
    curbBlocks.forEach((cb, i) => {
      dummy.position.set(cb.x, cb.y + 0.14, cb.z);
      dummy.rotation.set(0, -Math.PI / 4, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      curbInst.setMatrixAt(i, dummy.matrix);
      tmpCol.setHex(cb.isRad ? 0xdbeafe : 0xfecdd3);
      curbInst.setColorAt(i, tmpCol);
    });
    scene.add(freezeStaticObject(curbInst));
  }
  if (waystones.length > 0) {
    const wsMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.5,
      roughness: 0.25,
    });
    const wsInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.32, 0),
      wsMat,
      waystones.length,
    );
    waystones.forEach((ws, i) => {
      dummy.position.set(ws.x, ws.y + 0.62, ws.z);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.set(0.85, 1.45, 0.85);
      dummy.updateMatrix();
      wsInst.setMatrixAt(i, dummy.matrix);
      tmpCol.setHex(ws.isRad ? 0x34d399 : 0xf43f5e);
      wsInst.setColorAt(i, tmpCol);
    });
    scene.add(freezeStaticObject(wsInst));
  }

  // 2. Floating River Lily Pads & Glowing Lotus Blossoms on Radiant River Reach
  const lilyPads = [];
  for (let i = 0; i < 84; i++) {
    const along = -220 + (i / 84) * 196; // Northwest / Radiant side of bridge
    const across = Math.sin(i * 4.3) * 0.72 * 5.8;
    const lx = (along + across) / Math.SQRT2;
    const lz = (along - across) / Math.SQRT2;
    lilyPads.push({
      x: lx,
      z: lz,
      sc: 0.75 + (i % 4) * 0.22,
      rot: i * 1.1,
      hasLotus: i % 3 === 0,
    });
  }
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x059669,
    roughness: 0.55,
  });
  const padInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(
      0.68,
      0.68,
      0.06,
      12,
      1,
      false,
      0,
      Math.PI * 1.82,
    ),
    padMat,
    lilyPads.length,
  );
  const lotusList = lilyPads.filter((p) => p.hasLotus);
  const lotusMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf472b6,
    emissiveIntensity: 1.15,
  });
  const lotusInst = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.24, 0),
    lotusMat,
    lotusList.length,
  );

  lilyPads.forEach((lp, i) => {
    dummy.position.set(lp.x, -0.51, lp.z);
    dummy.rotation.set(0, lp.rot, 0);
    dummy.scale.setScalar(lp.sc);
    dummy.updateMatrix();
    padInst.setMatrixAt(i, dummy.matrix);
  });
  lotusList.forEach((lt, i) => {
    dummy.position.set(lt.x, -0.39, lt.z);
    dummy.rotation.set(0, lt.rot, 0);
    dummy.scale.set(lt.sc, lt.sc * 0.75, lt.sc);
    dummy.updateMatrix();
    lotusInst.setMatrixAt(i, dummy.matrix);
  });
  scene.add(freezeStaticObject(padInst), freezeStaticObject(lotusInst));
}

function buildArchedRiverBridge() {
  const bridge = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    map: marblePBR.map,
    bumpMap: marblePBR.bumpMap,
    bumpScale: 0.16,
    roughness: 0.58,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.85,
    roughness: 0.22,
  });

  const segs = 12;
  const totalLen = 21.0;
  const segLen = totalLen / segs;
  for (let i = 0; i < segs; i++) {
    const t = (i + 0.5) / segs - 0.5;
    const archY = 0.22 + Math.cos(t * Math.PI) * 0.62;
    const slope = -Math.sin(t * Math.PI) * 0.18;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(14.6, 0.55, segLen + 0.15),
      stoneMat,
    );
    slab.position.set(0, archY, t * totalLen);
    slab.rotation.x = slope;
    slab.receiveShadow = true;
    slab.castShadow = true;
    bridge.add(slab);
  }

  [-7.0, 7.0].forEach((side) => {
    // Curved stone arch rib & parapet balustrade rails along both bridge flanks
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side, 1.45, -9.8),
      new THREE.Vector3(side, 1.98, -4.8),
      new THREE.Vector3(side, 2.18, 0.0),
      new THREE.Vector3(side, 1.98, 4.8),
      new THREE.Vector3(side, 1.45, 9.8),
    ]);
    const topRail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 24, 0.16, 8, false),
      stoneMat,
    );
    topRail.castShadow = true;
    const goldInlay = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 24, 0.06, 6, false),
      goldTrimMat,
    );
    goldInlay.position.y = 0.14;
    bridge.add(topRail, goldInlay);

    [-9.8, -4.8, 0, 4.8, 9.8].forEach((pz, idx) => {
      const t = pz / totalLen;
      const baseH = 0.22 + Math.cos(t * Math.PI) * 0.62;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.74, 2.0, 8),
        stoneMat,
      );
      post.position.set(side, baseH + 0.95, pz);
      post.castShadow = true;
      bridge.add(post);

      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.08, 8, 16),
        goldTrimMat,
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.set(side, baseH + 1.85, pz);
      bridge.add(collar);

      if (idx % 2 === 0) {
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.38, 0),
          new THREE.MeshStandardMaterial({
            color: 0xfacc15,
            emissive: 0xf59e0b,
            emissiveIntensity: 1.65,
          }),
        );
        orb.position.set(side, baseH + 2.35, pz);
        bridge.add(orb);
      }
    });
  });

  bridge.rotation.y = -Math.PI / 4;
  scene.add(freezeStaticObject(bridge));
}

function buildRoshanPit(x, z) {
  const pit = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    map: marblePBR.map,
    bumpMap: marblePBR.bumpMap,
    bumpScale: 0.28,
    color: 0x2d1b2e,
    roughness: 0.58,
    metalness: 0.25,
  });
  const obsidianMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.68,
    metalness: 0.35,
  });
  const magmaRimMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.55,
  });
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(13.2, 14.2, 0.42, 36),
    stoneMat,
  );
  floor.position.y = 0.18;
  floor.receiveShadow = true;
  pit.add(floor);

  const outerRune = new THREE.Mesh(
    new THREE.RingGeometry(11.6, 12.6, 48),
    new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
    }),
  );
  outerRune.rotation.x = -Math.PI / 2;
  outerRune.position.y = 0.41;
  pit.add(outerRune);

  const innerRune = new THREE.Mesh(
    new THREE.RingGeometry(6.8, 7.3, 40),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    }),
  );
  innerRune.rotation.x = -Math.PI / 2;
  innerRune.position.y = 0.42;
  pit.add(innerRune);

  // Glowing magma fissures across the pit dais
  for (let f = 0; f < 6; f++) {
    const fAng = (f / 6) * Math.PI * 2 + 0.3;
    const fissure = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 5.2),
      magmaRimMat,
    );
    fissure.rotation.x = -Math.PI / 2;
    fissure.rotation.z = fAng;
    fissure.position.set(Math.cos(fAng) * 8.6, 0.4, Math.sin(fAng) * 8.6);
    pit.add(fissure);
  }

  // Craggy cavern monoliths & rib arches enclosing the back & flanks of the pit
  for (let i = 0; i < 12; i++) {
    const ang = Math.PI * 0.56 + (i / 11) * Math.PI * 1.42;
    const px = Math.cos(ang) * 12.8;
    const pz = Math.sin(ang) * 12.8;
    const h = 6.2 + (i % 3) * 1.6;
    const col = new THREE.Mesh(
      new THREE.ConeGeometry(1.65, h, 6),
      stoneMat,
    );
    col.position.set(px, h * 0.5, pz);
    col.castShadow = true;
    pit.add(col);

    const ribCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(px, h * 0.72, pz),
      new THREE.Vector3(px * 0.68, h + 2.4, pz * 0.68),
      new THREE.Vector3(px * 0.35, h + 3.2, pz * 0.35),
    ]);
    const rib = new THREE.Mesh(
      new THREE.TubeGeometry(ribCurve, 10, 0.42, 6, false),
      obsidianMat,
    );
    pit.add(rib);

    if (i % 2 === 0) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.72, 0),
        magmaRimMat,
      );
      crystal.position.set(px, h + 0.55, pz);
      pit.add(crystal);
    }
  }
  pit.position.set(x, 0, z);
  scene.add(freezeStaticObject(pit));
}

function createFoliageTextureSet(
  paletteHexes,
  foliageType = "broadleaf",
) {
  const size = 512;
  const mapC = document.createElement("canvas");
  const bumpC = document.createElement("canvas");
  mapC.width = bumpC.width = size;
  mapC.height = bumpC.height = size;
  const ctx = mapC.getContext("2d");
  const btx = bumpC.getContext("2d");

  // Transparent background for true alpha-cutout botanical leaf & needle silhouettes
  ctx.clearRect(0, 0, size, size);
  btx.fillStyle = "#383838";
  btx.fillRect(0, 0, size, size);

  const cols = paletteHexes.map(
    (h) => "#" + new THREE.Color(h).getHexString(),
  );
  let seed =
    foliageType === "pine"
      ? 101
      : foliageType === "willow"
        ? 202
        : foliageType === "dire_ember"
          ? 303
          : 404;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const drawWoodTwig = (x1, y1, x2, y2, width, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(
      (x1 + x2) * 0.5 + (rand() - 0.5) * 14,
      (y1 + y2) * 0.5,
      x2,
      y2,
    );
    ctx.stroke();

    btx.strokeStyle = "#b0b0b0";
    btx.lineWidth = width;
    btx.lineCap = "round";
    btx.beginPath();
    btx.moveTo(x1, y1);
    btx.lineTo(x2, y2);
    btx.stroke();
  };

  if (foliageType === "pine") {
    // Woody conifer branchlets radiating from bottom-center stem
    const twigs = [
      [256, 488, 256, 52, 8],
      [256, 415, 92, 235, 5.5],
      [256, 415, 420, 235, 5.5],
      [256, 325, 76, 148, 5.0],
      [256, 325, 436, 148, 5.0],
      [256, 225, 118, 76, 4.2],
      [256, 225, 394, 76, 4.2],
      [256, 140, 178, 38, 3.2],
      [256, 140, 334, 38, 3.2],
    ];
    twigs.forEach(([x1, y1, x2, y2, w]) =>
      drawWoodTwig(x1, y1, x2, y2, w, "#3d2212"),
    );

    // Dense layered pine-needle fascicle sprays along every branchlet
    twigs.forEach(([x1, y1, x2, y2], tIdx) => {
      const steps = 26;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const bx = x1 + (x2 - x1) * t;
        const by = y1 + (y2 - y1) * t;
        const baseAng = Math.atan2(y2 - y1, x2 - x1);

        for (let side of [-1, 1]) {
          for (let n = 0; n < 5; n++) {
            const spread =
              side * (0.28 + n * 0.19) + (rand() - 0.5) * 0.14;
            const ang = baseAng + spread;
            const needleLen =
              (24 + (1.0 - t * 0.35) * 20) * (0.78 + rand() * 0.42);
            const cIdx = Math.min(
              cols.length - 1,
              Math.floor((t * 0.65 + rand() * 0.45) * cols.length),
            );
            const bShade = Math.floor(115 + t * 85 + rand() * 45);

            ctx.strokeStyle = cols[cIdx];
            ctx.lineWidth = 2.4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(
              bx + Math.cos(ang) * needleLen,
              by + Math.sin(ang) * needleLen,
            );
            ctx.stroke();

            btx.strokeStyle = `rgb(${bShade},${bShade},${bShade})`;
            btx.lineWidth = 2.2;
            btx.beginPath();
            btx.moveTo(bx, by);
            btx.lineTo(
              bx + Math.cos(ang) * needleLen,
              by + Math.sin(ang) * needleLen,
            );
            btx.stroke();
          }
        }
      }
      // Resinous amber-brown pinecones at branch forks
      if (tIdx > 0 && tIdx < 7) {
        const px = x1 + (x2 - x1) * 0.25;
        const py = y1 + (y2 - y1) * 0.25;
        ctx.fillStyle = "#5c3317";
        ctx.beginPath();
        ctx.ellipse(px, py, 6, 10, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#854d27";
        ctx.beginPath();
        ctx.ellipse(px - 1, py - 2, 3.5, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  } else if (foliageType === "willow") {
    // Cascading hanging willow stems & slender lanceolate leaves
    const strands = 15;
    for (let st = 0; st < strands; st++) {
      const sx = 46 + (st / (strands - 1)) * 420 + (rand() - 0.5) * 14;
      const topY = 18 + Math.abs(st - 7) * 5;
      const botY = 465 - (st % 3) * 28 - rand() * 24;
      const sway = (rand() - 0.5) * 26;

      ctx.strokeStyle = "#3f5222";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx, topY);
      ctx.quadraticCurveTo(
        sx + sway,
        (topY + botY) * 0.5,
        sx + sway * 0.4,
        botY,
      );
      ctx.stroke();

      const leafCount = 24;
      for (let l = 0; l < leafCount; l++) {
        const t = l / leafCount;
        const lx = sx + Math.sin(t * Math.PI) * sway * 0.65;
        const ly = topY + (botY - topY) * t;
        const side = l % 2 === 0 ? 1 : -1;
        const ang = Math.PI * 0.5 + side * (0.34 + rand() * 0.16);
        const len = 24 + Math.sin(t * Math.PI) * 10;
        const cIdx = Math.min(
          cols.length - 1,
          Math.floor((t * 0.55 + rand() * 0.55) * cols.length),
        );

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(ang);
        ctx.fillStyle = cols[cIdx];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.45, -4.5, len, 0);
        ctx.quadraticCurveTo(len * 0.45, 4.5, 0, 0);
        ctx.fill();
        ctx.restore();

        btx.save();
        btx.translate(lx, ly);
        btx.rotate(ang);
        btx.fillStyle = "#c8c8c8";
        btx.beginPath();
        btx.ellipse(len * 0.5, 0, len * 0.48, 3.6, 0, 0, Math.PI * 2);
        btx.fill();
        btx.restore();
      }
    }
  } else {
    // Broadleaf Oak OR Dire Ember-Leaf botanical cluster
    const isDire = foliageType === "dire_ember";
    const twigCol = isDire ? "#1f0d14" : "#3b2314";
    const branches = [
      [256, 486, 256, 95, 8.5],
      [256, 405, 96, 255, 6.0],
      [256, 405, 416, 255, 6.0],
      [256, 305, 82, 138, 5.2],
      [256, 305, 430, 138, 5.2],
      [256, 210, 145, 68, 4.2],
      [256, 210, 367, 68, 4.2],
    ];
    branches.forEach(([x1, y1, x2, y2, w]) =>
      drawWoodTwig(x1, y1, x2, y2, w, twigCol),
    );

    // Draw ~210 individual veined, serrated/lobed leaves with depth shadows
    const leafPoints = [];
    branches.forEach(([x1, y1, x2, y2]) => {
      for (let k = 0; k < 28; k++) {
        const t = 0.14 + rand() * 0.92;
        const spread = (rand() - 0.5) * 118 * (0.45 + t * 0.65);
        const perpAng = Math.atan2(y2 - y1, x2 - x1) + Math.PI * 0.5;
        const lx = x1 + (x2 - x1) * t + Math.cos(perpAng) * spread;
        const ly = y1 + (y2 - y1) * t + Math.sin(perpAng) * spread;
        if (lx < 28 || lx > size - 28 || ly < 24 || ly > size - 28)
          continue;
        leafPoints.push({
          x: lx,
          y: ly,
          t,
          ang:
            perpAng + (spread >= 0 ? -0.35 : 0.35) + (rand() - 0.5) * 0.9,
        });
      }
    });

    leafPoints.forEach((lp, idx) => {
      const scale = 0.78 + rand() * 0.52;
      const lw = (isDire ? 22 : 24) * scale;
      const lh = (isDire ? 10.5 : 13.5) * scale;
      const cIdx = Math.min(
        cols.length - 1,
        Math.floor((lp.t * 0.55 + rand() * 0.55) * cols.length),
      );
      const bVal = Math.floor(110 + (idx % 5) * 26);

      // Soft ambient occlusion shadow beneath leaf
      ctx.save();
      ctx.translate(lp.x + 2.5, lp.y + 3.5);
      ctx.rotate(lp.ang);
      ctx.fillStyle = "rgba(8, 16, 12, 0.34)";
      ctx.beginPath();
      ctx.ellipse(lw * 0.45, 0, lw * 0.52, lh * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Sculpted leaf silhouette
      ctx.save();
      ctx.translate(lp.x, lp.y);
      ctx.rotate(lp.ang);
      ctx.fillStyle = cols[cIdx];
      ctx.beginPath();
      if (isDire) {
        // Sharp jagged thorn-leaf
        ctx.moveTo(0, 0);
        ctx.lineTo(lw * 0.35, -lh * 0.65);
        ctx.lineTo(lw * 0.52, -lh * 0.35);
        ctx.lineTo(lw * 0.78, -lh * 0.55);
        ctx.lineTo(lw * 1.12, 0);
        ctx.lineTo(lw * 0.78, lh * 0.55);
        ctx.lineTo(lw * 0.52, lh * 0.35);
        ctx.lineTo(lw * 0.35, lh * 0.65);
        ctx.closePath();
      } else {
        // Lobed oak / birch leaf blade
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(
          lw * 0.25,
          -lh * 0.78,
          lw * 0.72,
          -lh * 0.74,
          lw,
          0,
        );
        ctx.bezierCurveTo(
          lw * 0.72,
          lh * 0.74,
          lw * 0.25,
          lh * 0.78,
          0,
          0,
        );
      }
      ctx.fill();

      // Central leaf midrib & lateral veins
      ctx.strokeStyle = isDire
        ? "rgba(251, 146, 60, 0.55)"
        : "rgba(254, 249, 195, 0.28)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(lw * 0.88, 0);
      ctx.moveTo(lw * 0.35, 0);
      ctx.lineTo(lw * 0.55, -lh * 0.35);
      ctx.moveTo(lw * 0.35, 0);
      ctx.lineTo(lw * 0.55, lh * 0.35);
      ctx.stroke();
      ctx.restore();

      btx.save();
      btx.translate(lp.x, lp.y);
      btx.rotate(lp.ang);
      btx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      btx.beginPath();
      btx.ellipse(lw * 0.5, 0, lw * 0.5, lh * 0.5, 0, 0, Math.PI * 2);
      btx.fill();
      btx.restore();
    });
  }

  // Fill lush inner botanical cluster in center so inner crown UVs & mid-bough cards stay rich and full at all distances
  for (let c = 0; c < 110; c++) {
    const ang = rand() * Math.PI * 2;
    const rad = Math.pow(rand(), 0.6) * 145;
    const cx = 256 + Math.cos(ang) * rad;
    const cy = 262 + Math.sin(ang) * rad * 0.92;
    const cIdx = Math.floor(rand() * cols.length);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang + (rand() - 0.5) * 1.4);
    ctx.fillStyle = cols[cIdx];
    ctx.beginPath();
    if (foliageType === "pine") {
      ctx.ellipse(
        0,
        0,
        18 + rand() * 10,
        5.5 + rand() * 3,
        0,
        0,
        Math.PI * 2,
      );
    } else if (foliageType === "willow") {
      ctx.ellipse(
        0,
        0,
        6 + rand() * 3,
        20 + rand() * 10,
        0,
        0,
        Math.PI * 2,
      );
    } else {
      ctx.ellipse(
        0,
        0,
        16 + rand() * 9,
        10 + rand() * 6,
        0,
        0,
        Math.PI * 2,
      );
    }
    ctx.fill();
    ctx.restore();
  }

  // Dilate RGB colors into transparent pixels (alpha=0) so GPU mipmapping never bleeds black borders
  const imgData = ctx.getImageData(0, 0, size, size);
  const px = imgData.data;
  let srcBuf = new Uint8ClampedArray(px);
  let dstBuf = new Uint8ClampedArray(px);
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = (y * size + x) * 4;
        if (srcBuf[idx + 3] > 0) continue;
        let rSum = 0,
          gSum = 0,
          bSum = 0,
          cnt = 0;
        const neighbors = [
          idx - 4,
          idx + 4,
          idx - size * 4,
          idx + size * 4,
        ];
        for (let n = 0; n < 4; n++) {
          const nIdx = neighbors[n];
          if (srcBuf[nIdx + 3] > 0) {
            rSum += srcBuf[nIdx];
            gSum += srcBuf[nIdx + 1];
            bSum += srcBuf[nIdx + 2];
            cnt++;
          }
        }
        if (cnt > 0) {
          dstBuf[idx] = Math.round(rSum / cnt);
          dstBuf[idx + 1] = Math.round(gSum / cnt);
          dstBuf[idx + 2] = Math.round(bSum / cnt);
          dstBuf[idx + 3] = 1;
          changed = true;
        }
      }
    }
    srcBuf.set(dstBuf);
    if (!changed) break;
  }
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0 && srcBuf[i + 3] > 0) {
      px[i] = srcBuf[i];
      px[i + 1] = srcBuf[i + 1];
      px[i + 2] = srcBuf[i + 2];
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const map = new THREE.CanvasTexture(mapC);
  const bumpMap = new THREE.CanvasTexture(bumpC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  bumpMap.anisotropy = 4;
  map.wrapS =
    map.wrapT =
    bumpMap.wrapS =
    bumpMap.wrapT =
      THREE.ClampToEdgeWrapping;
  return { map, bumpMap };
}

function remapInnerCoreUVs(geo) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, 0.36 + uv.getX(i) * 0.28, 0.36 + uv.getY(i) * 0.28);
  }
  uv.needsUpdate = true;
  return geo;
}

function appendMergedPart(
  geo,
  posList,
  normList,
  uvList,
  idxList,
  vertOffset,
) {
  geo.computeVertexNormals();
  const gp = geo.attributes.position;
  const gn = geo.attributes.normal;
  const gu = geo.attributes.uv;
  const gi = geo.index;
  for (let i = 0; i < gp.count; i++) {
    posList.push(gp.getX(i), gp.getY(i), gp.getZ(i));
    normList.push(gn.getX(i), gn.getY(i), gn.getZ(i));
    uvList.push(gu ? gu.getX(i) : 0.5, gu ? gu.getY(i) : 0.5);
  }
  if (gi) {
    for (let i = 0; i < gi.count; i++)
      idxList.push(gi.getX(i) + vertOffset);
  } else {
    for (let i = 0; i < gp.count; i++) idxList.push(i + vertOffset);
  }
  const nextOffset = vertOffset + gp.count;
  geo.dispose();
  return nextOffset;
}

function createOrganicBranchTube(
  points,
  rStart,
  rEnd,
  tubularSegs = 10,
  radialSegs = 7,
  rootFlare = 0,
) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(
    curve,
    tubularSegs,
    1.0,
    radialSegs,
    false,
  );
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ringIdx = Math.floor(i / (radialSegs + 1));
    const t = THREE.MathUtils.clamp(ringIdx / tubularSegs, 0, 1);
    const center = curve.getPointAt(t);
    let dx = pos.getX(i) - center.x;
    let dy = pos.getY(i) - center.y;
    let dz = pos.getZ(i) - center.z;
    const ang = Math.atan2(dz, dx);
    const flare =
      rootFlare > 0
        ? Math.pow(1.0 - t, 2.6) *
          rootFlare *
          (0.45 * Math.max(0, Math.cos(ang * 5.0)) + 0.25)
        : 0;
    const r =
      THREE.MathUtils.lerp(rStart, rEnd, Math.pow(t, 0.85)) *
      (1.0 + flare);
    pos.setXYZ(
      i,
      center.x + dx * r,
      center.y + dy * r,
      center.z + dz * r,
    );
  }
  return geo;
}

// 1. Ancient Sylvan Oak Trunk with Flared Buttress Roots + 5 Primary Boughs + Secondary Limbs
function createAncientOakTrunkGeo() {
  const posList = [],
    normList = [],
    uvList = [],
    idxList = [];
  let vOff = 0;

  // Main sculpted bole with 5 buttress root spurs
  const mainTrunk = createOrganicBranchTube(
    [
      new THREE.Vector3(0.0, -0.25, 0.0),
      new THREE.Vector3(0.08, 1.15, -0.05),
      new THREE.Vector3(-0.06, 2.35, 0.08),
      new THREE.Vector3(0.04, 3.45, -0.04),
    ],
    0.56,
    0.28,
    12,
    12,
    0.65,
  );
  vOff = appendMergedPart(
    mainTrunk,
    posList,
    normList,
    uvList,
    idxList,
    vOff,
  );

  // 5 Exposed surface root spurs gripping the forest floor
  for (let r = 0; r < 5; r++) {
    const ang = (r / 5) * Math.PI * 2 + 0.3;
    const root = createOrganicBranchTube(
      [
        new THREE.Vector3(
          Math.cos(ang) * 0.22,
          0.95,
          Math.sin(ang) * 0.22,
        ),
        new THREE.Vector3(
          Math.cos(ang) * 0.68,
          0.28,
          Math.sin(ang) * 0.68,
        ),
        new THREE.Vector3(
          Math.cos(ang) * 1.18,
          -0.18,
          Math.sin(ang) * 1.18,
        ),
      ],
      0.22,
      0.06,
      7,
      6,
      0,
    );
    vOff = appendMergedPart(
      root,
      posList,
      normList,
      uvList,
      idxList,
      vOff,
    );
  }

  // 5 Spreading Primary Crown Boughs + Secondary Sub-Branches
  const boughs = [
    { ang: 0.2, y0: 2.55, y1: 4.55, rOut: 1.85, r0: 0.19 },
    { ang: 1.45, y0: 2.75, y1: 4.85, rOut: 1.75, r0: 0.18 },
    { ang: 2.7, y0: 2.6, y1: 4.45, rOut: 1.9, r0: 0.19 },
    { ang: 3.95, y0: 2.85, y1: 4.95, rOut: 1.7, r0: 0.17 },
    { ang: 5.2, y0: 2.7, y1: 4.65, rOut: 1.8, r0: 0.18 },
  ];
  boughs.forEach((b, idx) => {
    const bx1 = Math.cos(b.ang) * b.rOut;
    const bz1 = Math.sin(b.ang) * b.rOut;
    const bough = createOrganicBranchTube(
      [
        new THREE.Vector3(0, b.y0, 0),
        new THREE.Vector3(bx1 * 0.52, (b.y0 + b.y1) * 0.52, bz1 * 0.52),
        new THREE.Vector3(bx1, b.y1, bz1),
      ],
      b.r0,
      0.055,
      8,
      6,
      0,
    );
    vOff = appendMergedPart(
      bough,
      posList,
      normList,
      uvList,
      idxList,
      vOff,
    );

    // Secondary fork limb
    const forkAng = b.ang + (idx % 2 === 0 ? 0.55 : -0.55);
    const sub = createOrganicBranchTube(
      [
        new THREE.Vector3(bx1 * 0.55, (b.y0 + b.y1) * 0.52, bz1 * 0.55),
        new THREE.Vector3(
          Math.cos(forkAng) * (b.rOut * 0.92),
          b.y1 + 0.45,
          Math.sin(forkAng) * (b.rOut * 0.92),
        ),
      ],
      b.r0 * 0.62,
      0.04,
      6,
      5,
      0,
    );
    vOff = appendMergedPart(
      sub,
      posList,
      normList,
      uvList,
      idxList,
      vOff,
    );
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posList, 3),
  );
  merged.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normList, 3),
  );
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvList, 2));
  merged.setIndex(idxList);
  return merged;
}

// Helper: Build a curved botanical leaf-cluster card with outward-pointing crown normals for lush 3D shading
function createCamberedFoliageCard(
  width,
  height,
  archDepth,
  pos,
  rotEuler,
  crownCenterY = 4.6,
) {
  const card = new THREE.PlaneGeometry(width, height, 3, 3);
  const p = card.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i);
    const vy = p.getY(i);
    const nx = vx / (width * 0.5);
    const ny = vy / (height * 0.5);
    // Gentle spherical camber so leaf clusters catch directional light softly
    const camber =
      (1.0 - Math.min(1.0, (nx * nx + ny * ny) * 0.55)) * archDepth;
    p.setZ(i, camber);
  }
  card.rotateX(rotEuler.x);
  card.rotateY(rotEuler.y);
  card.rotateZ(rotEuler.z);
  card.translate(pos.x, pos.y, pos.z);

  // Blend geometric normal with outward crown normal so double-sided leaf cards shade like a unified 3D volume
  card.computeVertexNormals();
  const n = card.attributes.normal;
  const outVec = new THREE.Vector3();
  const geoN = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    outVec
      .set(p.getX(i), p.getY(i) - crownCenterY, p.getZ(i))
      .normalize();
    geoN.set(n.getX(i), n.getY(i), n.getZ(i));
    geoN.lerp(outVec, 0.68).normalize();
    n.setXYZ(i, geoN.x, geoN.y, geoN.z);
  }
  return card;
}

// 1B. Broadleaf Oak Canopy: Shaded Inner Volume + 38 Multi-Angled Botanical Leaf-Cluster Cards
function createSculptedBroadleafCanopyGeo() {
  const posList = [],
    normList = [],
    uvList = [],
    idxList = [];
  let vOff = 0;

  // Compact shaded interior foliage volume so crown has rich self-shadowed depth
  const innerClusters = [
    { x: 0.0, y: 4.55, z: 0.0, r: 1.28 },
    { x: -0.78, y: 4.15, z: 0.42, r: 0.96 },
    { x: 0.82, y: 4.2, z: 0.36, r: 0.96 },
    { x: 0.05, y: 4.1, z: -0.82, r: 0.98 },
  ];
  innerClusters.forEach((cl) => {
    const g = remapInnerCoreUVs(new THREE.IcosahedronGeometry(cl.r, 1));
    g.scale(1.05, 0.82, 1.05);
    g.translate(cl.x, cl.y, cl.z);
    vOff = appendMergedPart(g, posList, normList, uvList, idxList, vOff);
  });

  // 38 Outer Airy Botanical Leaf-Cluster Cards arranged in 3 organic tiers
  const tiers = [
    {
      count: 14,
      y: 3.65,
      rMin: 1.45,
      rMax: 2.15,
      w: 2.15,
      h: 2.05,
      tiltX: 0.58,
    },
    {
      count: 14,
      y: 4.65,
      rMin: 1.25,
      rMax: 1.95,
      w: 2.1,
      h: 2.0,
      tiltX: 0.32,
    },
    {
      count: 10,
      y: 5.55,
      rMin: 0.45,
      rMax: 1.25,
      w: 1.95,
      h: 1.85,
      tiltX: -0.18,
    },
  ];
  tiers.forEach((tr, tIdx) => {
    for (let i = 0; i < tr.count; i++) {
      const ang =
        (i / tr.count) * Math.PI * 2 +
        tIdx * 0.47 +
        Math.sin(i * 2.3) * 0.18;
      const rad = THREE.MathUtils.lerp(tr.rMin, tr.rMax, (i % 3) / 2);
      const py = tr.y + Math.sin(i * 1.9 + tIdx) * 0.28;
      const pos = new THREE.Vector3(
        Math.cos(ang) * rad,
        py,
        Math.sin(ang) * rad,
      );
      const rot = new THREE.Euler(
        tr.tiltX + Math.sin(i * 3.1) * 0.24,
        -ang + Math.PI * 0.5 + Math.cos(i * 2.7) * 0.35,
        Math.sin(i * 1.7) * 0.32,
        "YXZ",
      );
      const card = createCamberedFoliageCard(
        tr.w,
        tr.h,
        0.34,
        pos,
        rot,
        4.4,
      );
      vOff = appendMergedPart(
        card,
        posList,
        normList,
        uvList,
        idxList,
        vOff,
      );
    }
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posList, 3),
  );
  merged.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normList, 3),
  );
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvList, 2));
  merged.setIndex(idxList);
  return merged;
}

// 2A. Towering Alpine Conifer Trunk + Whirled Wooden Boughs
function createConiferTrunkGeo() {
  const posList = [],
    normList = [],
    uvList = [],
    idxList = [];
  let vOff = 0;

  const bole = createOrganicBranchTube(
    [
      new THREE.Vector3(0, -0.25, 0),
      new THREE.Vector3(0.04, 2.2, -0.03),
      new THREE.Vector3(-0.03, 4.8, 0.03),
      new THREE.Vector3(0, 7.2, 0),
    ],
    0.48,
    0.08,
    12,
    10,
    0.58,
  );
  vOff = appendMergedPart(bole, posList, normList, uvList, idxList, vOff);

  // 4 whorls of slender drooping bough spokes inside the conifer tiers
  [2.2, 3.4, 4.6, 5.7].forEach((wy, wIdx) => {
    const spokes = 5;
    const reach = 1.65 - wIdx * 0.28;
    for (let s = 0; s < spokes; s++) {
      const ang = (s / spokes) * Math.PI * 2 + wIdx * 0.62;
      const limb = createOrganicBranchTube(
        [
          new THREE.Vector3(0, wy, 0),
          new THREE.Vector3(
            Math.cos(ang) * reach * 0.55,
            wy - 0.14,
            Math.sin(ang) * reach * 0.55,
          ),
          new THREE.Vector3(
            Math.cos(ang) * reach,
            wy - 0.38,
            Math.sin(ang) * reach,
          ),
        ],
        0.1 - wIdx * 0.015,
        0.025,
        5,
        5,
        0,
      );
      vOff = appendMergedPart(
        limb,
        posList,
        normList,
        uvList,
        idxList,
        vOff,
      );
    }
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posList, 3),
  );
  merged.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normList, 3),
  );
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvList, 2));
  merged.setIndex(idxList);
  return merged;
}

// 2B. Alpine Conifer Canopy: Slim Inner Needle Core + 46 Drooping Pine-Bough Frond Cards
function createSculptedPineCanopyGeo() {
  const posList = [],
    normList = [],
    uvList = [],
    idxList = [];
  let vOff = 0;

  // Slim inner dark-spruce needle core for dense interior shadow
  const innerCone = remapInnerCoreUVs(
    new THREE.ConeGeometry(1.32, 5.6, 14, 4, false),
  );
  innerCone.translate(0, 4.6, 0);
  vOff = appendMergedPart(
    innerCone,
    posList,
    normList,
    uvList,
    idxList,
    vOff,
  );

  // 6 graceful whorls of drooping pine-bough frond cards tapering to a leader spire
  const whorls = [
    { count: 10, y: 2.15, rad: 1.55, w: 2.15, h: 2.25, droop: 0.88 },
    { count: 9, y: 3.25, rad: 1.32, w: 1.95, h: 2.05, droop: 0.82 },
    { count: 8, y: 4.3, rad: 1.08, w: 1.72, h: 1.85, droop: 0.76 },
    { count: 7, y: 5.3, rad: 0.82, w: 1.48, h: 1.65, droop: 0.68 },
    { count: 6, y: 6.25, rad: 0.54, w: 1.22, h: 1.45, droop: 0.56 },
    { count: 4, y: 7.15, rad: 0.24, w: 0.95, h: 1.35, droop: 0.34 },
  ];
  whorls.forEach((wh, wIdx) => {
    for (let i = 0; i < wh.count; i++) {
      const ang = (i / wh.count) * Math.PI * 2 + wIdx * 0.53;
      const pos = new THREE.Vector3(
        Math.cos(ang) * wh.rad,
        wh.y + (i % 2) * 0.12,
        Math.sin(ang) * wh.rad,
      );
      const rot = new THREE.Euler(
        wh.droop + ((i % 3) - 1) * 0.08,
        -ang + Math.PI * 0.5,
        Math.sin(i * 2.1) * 0.14,
        "YXZ",
      );
      const card = createCamberedFoliageCard(
        wh.w,
        wh.h,
        0.28,
        pos,
        rot,
        4.8,
      );
      vOff = appendMergedPart(
        card,
        posList,
        normList,
        uvList,
        idxList,
        vOff,
      );
    }
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posList, 3),
  );
  merged.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normList, 3),
  );
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvList, 2));
  merged.setIndex(idxList);
  return merged;
}

// 3A. Sacred Weeping Willow Trunk (Gnarled Leaning Trunk + Wide Arching Crown Boughs)
function createWillowTrunkGeo() {
  const posList = [],
    normList = [],
    uvList = [],
    idxList = [];
  let vOff = 0;

  const trunk = createOrganicBranchTube(
    [
      new THREE.Vector3(0.0, -0.25, 0.0),
      new THREE.Vector3(0.18, 1.15, 0.1),
      new THREE.Vector3(0.32, 2.35, 0.14),
      new THREE.Vector3(0.22, 3.3, 0.06),
    ],
    0.62,
    0.32,
    10,
    12,
    0.62,
  );
  vOff = appendMergedPart(
    trunk,
    posList,
    normList,
    uvList,
    idxList,
    vOff,
  );

  for (let b = 0; b < 5; b++) {
    const ang = (b / 5) * Math.PI * 2 + 0.15;
    const arch = createOrganicBranchTube(
      [
        new THREE.Vector3(0.22, 2.95, 0.06),
        new THREE.Vector3(
          0.22 + Math.cos(ang) * 1.15,
          4.05,
          0.06 + Math.sin(ang) * 1.15,
        ),
        new THREE.Vector3(
          0.22 + Math.cos(ang) * 2.15,
          3.65,
          0.06 + Math.sin(ang) * 2.15,
        ),
      ],
      0.21,
      0.06,
      8,
      6,
      0,
    );
    vOff = appendMergedPart(
      arch,
      posList,
      normList,
      uvList,
      idxList,
      vOff,
    );
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posList, 3),
  );
  merged.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normList, 3),
  );
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvList, 2));
  merged.setIndex(idxList);
  return merged;
}

// 3B. Sacred Weeping Willow Canopy (Crown Dome + 28 Cascading Hanging Frond Curtains)
function createWillowCanopyGeo() {
  const posList = [],
    normList = [],
    uvList = [],
    idxList = [];
  let vOff = 0;

  // Upper crown dome cards
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const rad = i < 8 ? 1.45 : 0.55;
    const py = i < 8 ? 4.35 : 4.95;
    const pos = new THREE.Vector3(
      0.22 + Math.cos(ang) * rad,
      py,
      0.06 + Math.sin(ang) * rad,
    );
    const rot = new THREE.Euler(
      i < 8 ? 0.55 : 0.12,
      -ang + Math.PI * 0.5,
      0,
      "YXZ",
    );
    const capCard = createCamberedFoliageCard(
      2.15,
      2.05,
      0.32,
      pos,
      rot,
      4.2,
    );
    vOff = appendMergedPart(
      capCard,
      posList,
      normList,
      uvList,
      idxList,
      vOff,
    );
  }

  for (let i = 0; i < 14; i++) {
    const inner = i < 6;
    const ang = (i / (inner ? 6 : 8)) * Math.PI * 2 + (inner ? 0.3 : 0.1);
    const rad = inner ? 0.85 : 1.9;
    const pos = new THREE.Vector3(
      0.22 + Math.cos(ang) * rad,
      inner ? 4.7 : 4.05,
      0.06 + Math.sin(ang) * rad,
    );
    const rot = new THREE.Euler(
      inner ? 1.25 : 0.98,
      -ang + Math.PI * 0.5,
      0,
      "YXZ",
    );
    const coverCard = createCamberedFoliageCard(
      2.3,
      2.2,
      0.3,
      pos,
      rot,
      4.2,
    );
    vOff = appendMergedPart(
      coverCard,
      posList,
      normList,
      uvList,
      idxList,
      vOff,
    );
  }
  // 28 Cascading vertical-draped willow vine curtains around the perimeter
  const rings = [
    { count: 16, r: 2.18, yMid: 2.65, w: 1.45, h: 2.95, flare: 0.14 },
    { count: 12, r: 1.62, yMid: 2.85, w: 1.38, h: 2.75, flare: 0.1 },
  ];
  rings.forEach((rg, rIdx) => {
    for (let i = 0; i < rg.count; i++) {
      const ang = (i / rg.count) * Math.PI * 2 + rIdx * 0.25;
      const pos = new THREE.Vector3(
        0.22 + Math.cos(ang) * rg.r,
        rg.yMid + ((i % 3) - 1) * 0.15,
        0.06 + Math.sin(ang) * rg.r,
      );
      const rot = new THREE.Euler(
        rg.flare,
        -ang + Math.PI * 0.5,
        0,
        "YXZ",
      );
      const curtain = createCamberedFoliageCard(
        rg.w,
        rg.h,
        0.26,
        pos,
        rot,
        3.8,
      );
      vOff = appendMergedPart(
        curtain,
        posList,
        normList,
        uvList,
        idxList,
        vOff,
      );
    }
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posList, 3),
  );
  merged.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normList, 3),
  );
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvList, 2));
  merged.setIndex(idxList);
  return merged;
}

// 4A. Dire Gnarled Weirwood Trunk (Twisted Fluted Bole + Claw Roots + 5 Jagged Limbs)
function createGnarledDireTreeGeo() {
  const posList = [],
    normList = [],
    uvList = [],
    idxList = [];
  let vOff = 0;

  const bole = createOrganicBranchTube(
    [
      new THREE.Vector3(0.0, -0.25, 0.0),
      new THREE.Vector3(0.24, 1.25, 0.14),
      new THREE.Vector3(-0.18, 2.55, -0.12),
      new THREE.Vector3(0.14, 3.85, 0.08),
    ],
    0.62,
    0.24,
    12,
    10,
    0.72,
  );
  vOff = appendMergedPart(bole, posList, normList, uvList, idxList, vOff);

  // 5 Clawed exposed weirwood roots
  for (let r = 0; r < 5; r++) {
    const ang = (r / 5) * Math.PI * 2 + 0.5;
    const claw = createOrganicBranchTube(
      [
        new THREE.Vector3(
          Math.cos(ang) * 0.26,
          1.05,
          Math.sin(ang) * 0.26,
        ),
        new THREE.Vector3(
          Math.cos(ang) * 0.85,
          0.36,
          Math.sin(ang) * 0.85,
        ),
        new THREE.Vector3(
          Math.cos(ang) * 1.32,
          -0.18,
          Math.sin(ang) * 1.32,
        ),
      ],
      0.22,
      0.04,
      7,
      6,
      0,
    );
    vOff = appendMergedPart(
      claw,
      posList,
      normList,
      uvList,
      idxList,
      vOff,
    );
  }

  // 5 Crooked, jagged reaching branches
  const limbs = [
    { ang: 0.1, y0: 2.5, y1: 4.8, rOut: 2.05 },
    { ang: 1.35, y0: 2.8, y1: 5.2, rOut: 1.85 },
    { ang: 2.6, y0: 2.4, y1: 4.6, rOut: 2.1 },
    { ang: 3.85, y0: 2.9, y1: 5.3, rOut: 1.8 },
    { ang: 5.1, y0: 2.6, y1: 4.9, rOut: 1.95 },
  ];
  limbs.forEach((lm, idx) => {
    const mx = Math.cos(lm.ang + 0.25) * (lm.rOut * 0.55);
    const mz = Math.sin(lm.ang + 0.25) * (lm.rOut * 0.55);
    const ex = Math.cos(lm.ang) * lm.rOut;
    const ez = Math.sin(lm.ang) * lm.rOut;
    const branch = createOrganicBranchTube(
      [
        new THREE.Vector3(0, lm.y0, 0),
        new THREE.Vector3(mx, (lm.y0 + lm.y1) * 0.48, mz),
        new THREE.Vector3(ex, lm.y1, ez),
      ],
      0.18,
      0.035,
      8,
      6,
      0,
    );
    vOff = appendMergedPart(
      branch,
      posList,
      normList,
      uvList,
      idxList,
      vOff,
    );
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posList, 3),
  );
  merged.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normList, 3),
  );
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvList, 2));
  merged.setIndex(idxList);
  return merged;
}

// 4B. Dire Cinder-Weirwood Crown (Smoldering Core + 34 Jagged Ember-Foliage Cards)
function createDireCanopyGeo() {
  const posList = [],
    normList = [],
    uvList = [],
    idxList = [];
  let vOff = 0;

  const core = remapInnerCoreUVs(new THREE.IcosahedronGeometry(1.12, 1));
  core.scale(1.15, 0.72, 1.15);
  core.translate(0, 4.45, 0);
  vOff = appendMergedPart(core, posList, normList, uvList, idxList, vOff);

  const tiers = [
    {
      count: 14,
      y: 3.75,
      rMin: 1.45,
      rMax: 2.25,
      w: 2.25,
      h: 2.05,
      tiltX: 0.62,
    },
    {
      count: 12,
      y: 4.75,
      rMin: 1.15,
      rMax: 1.85,
      w: 2.05,
      h: 1.9,
      tiltX: 0.28,
    },
    {
      count: 8,
      y: 5.55,
      rMin: 0.4,
      rMax: 1.15,
      w: 1.85,
      h: 1.75,
      tiltX: -0.22,
    },
  ];
  tiers.forEach((tr, tIdx) => {
    for (let i = 0; i < tr.count; i++) {
      const ang = (i / tr.count) * Math.PI * 2 + tIdx * 0.58;
      const rad = THREE.MathUtils.lerp(tr.rMin, tr.rMax, (i % 3) / 2);
      const pos = new THREE.Vector3(
        Math.cos(ang) * rad,
        tr.y + Math.cos(i * 2.1) * 0.25,
        Math.sin(ang) * rad,
      );
      const rot = new THREE.Euler(
        tr.tiltX + Math.sin(i * 2.7) * 0.28,
        -ang + Math.PI * 0.5 + Math.cos(i * 1.9) * 0.4,
        Math.sin(i * 2.3) * 0.35,
        "YXZ",
      );
      const card = createCamberedFoliageCard(
        tr.w,
        tr.h,
        0.36,
        pos,
        rot,
        4.4,
      );
      vOff = appendMergedPart(
        card,
        posList,
        normList,
        uvList,
        idxList,
        vOff,
      );
    }
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posList, 3),
  );
  merged.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normList, 3),
  );
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvList, 2));
  merged.setIndex(idxList);
  return merged;
}

function applyFoliageWindShader(
  mat,
  swayAmp = 0.16,
  sssTintHex = 0x84cc16,
  sssStrength = 0.26,
) {
  const sssCol = new THREE.Color(sssTintHex);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = { value: 0 };
    shader.uniforms.uSssColor = { value: sssCol };
    mat.userData.windShader = shader;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uWindTime;
varying float vCanopyHeight;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vCanopyHeight = position.y;
float windHeight = clamp((position.y - 1.4) / 5.2, 0.0, 1.45);
vec3 instOffset = vec3(0.0);
#ifdef USE_INSTANCING
    instOffset = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
#endif
float macroGust = sin(uWindTime * 1.72 + instOffset.x * 0.14 + instOffset.z * 0.13 + position.y * 0.45);
float microFlutter = sin(uWindTime * 4.85 + position.x * 3.4 + position.y * 2.9 + instOffset.z * 0.35) * 0.28;
transformed.x += (macroGust + microFlutter) * ${swayAmp.toFixed(3)} * windHeight;
transformed.z += (cos(uWindTime * 1.38 + instOffset.z * 0.17) + microFlutter * 0.7) * ${(swayAmp * 0.68).toFixed(3)} * windHeight;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 uSssColor;
varying float vCanopyHeight;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float crownGrad = clamp((vCanopyHeight - 1.9) / 4.8, 0.0, 1.0);
// Deep interior ambient occlusion at base of crown + warm sunlit subsurface translucency at upper canopy
float crownAO = mix(0.70, 1.24, crownGrad);
diffuseColor.rgb = diffuseColor.rgb * crownAO + uSssColor * (pow(crownGrad, 2.2) * ${sssStrength.toFixed(3)});`,
      );
  };
}

function applyTrunkAOShader(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vTrunkY;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vTrunkY = position.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vTrunkY;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float groundAO = smoothstep(-0.2, 1.35, vTrunkY);
float canopyShade = 1.0 - smoothstep(2.4, 5.2, vTrunkY) * 0.28;
diffuseColor.rgb *= mix(0.58, 1.04, groundAO) * canopyShade;`,
      );
  };
}

let animatedFoliageMaterials = [];

function buildDenseInstancedForest() {
  const clearZones = [
    { x: -126, z: 148, r: 13 },
    { x: 126, z: -148, r: 13 },
    { x: 64, z: 24, r: 13 },
    { x: -64, z: -24, r: 13 },
    { x: -50, z: -50, r: 19 },
    // 22 Deep-Forest & Riverbank Neutral Camp Clearings across the 380x380 map
    { x: -158, z: 56, r: 12.5 },
    { x: -120, z: 46, r: 12.5 },
    { x: -164, z: 10, r: 12.5 },
    { x: -56, z: 158, r: 12.5 },
    { x: -144, z: -12, r: 13.0 },
    { x: -10, z: 164, r: 13.0 },
    { x: -84, z: 22, r: 12.0 },
    { x: -24, z: 86, r: 12.0 },
    { x: -108, z: 66, r: 12.0 },
    { x: -124, z: -6, r: 12.0 },
    { x: -94, z: -64, r: 13.0 },
    { x: 158, z: -56, r: 12.5 },
    { x: 120, z: -46, r: 12.5 },
    { x: 164, z: -10, r: 12.5 },
    { x: 56, z: -158, r: 12.5 },
    { x: 144, z: 12, r: 13.0 },
    { x: 10, z: -164, r: 13.0 },
    { x: 84, z: -22, r: 12.0 },
    { x: 24, z: -86, r: 12.0 },
    { x: 108, z: -66, r: 12.0 },
    { x: 124, z: 6, r: 12.0 },
    { x: 94, z: 64, r: 13.0 },
    // Single Vampire Sanctuary Clearing at (-158, -50) [Map Square] & Symmetrical Dire Werewolf Clearing at (158, 50)
    { x: -158, z: -50, r: 15.0 },
    { x: 158, z: 50, r: 15.0 },
  ];

  const radOaks = [];
  const radPines = [];
  const radWillows = [];
  const direSpires = [];

  const placedTrees = [];
  for (let i = 0; i < 920; i++) {
    const tx = (Math.random() - 0.5) * 368;
    const tz = (Math.random() - 0.5) * 368;
    const distLane = Math.abs(tx + tz) / Math.SQRT2;
    const distRiver = Math.abs(tx - tz) / Math.SQRT2;
    if (distLane < 12.8 || distRiver < 11.6) continue;
    if (
      Math.hypot(tx + 124, tz - 124) < 34 ||
      Math.hypot(tx - 124, tz + 124) < 34
    )
      continue;
    if (clearZones.some((c) => Math.hypot(tx - c.x, tz - c.z) < c.r))
      continue;
    // Minimum 5.8m spacing between any two trees eliminates all foliage collision, clipping, and z-fighting
    if (placedTrees.some((p) => Math.hypot(tx - p.x, tz - p.z) < 5.8))
      continue;
    placedTrees.push({ x: tx, z: tz });

    const isRad = tx - tz < 0;
    const sc = 0.86 + Math.random() * 0.72;
    const rot = Math.random() * Math.PI * 2;
    const gy = getTerrainHeightAt(tx, tz);
    if (isRad) {
      // Place Sacred Weeping Willows preferentially near the river valley & lush glades
      if (distRiver < 24.0 && i % 2 === 0) {
        radWillows.push({ x: tx, y: gy, z: tz, sc: sc * 1.04, rot });
      } else if (i % 5 <= 1) {
        radOaks.push({ x: tx, y: gy, z: tz, sc, rot });
      } else {
        radPines.push({ x: tx, y: gy, z: tz, sc, rot });
      }
    } else {
      direSpires.push({ x: tx, y: gy, z: tz, sc, rot });
    }
  }

  const pineLeafTex = createFoliageTextureSet(
    [0x064e3b, 0x047857, 0x10b981, 0x34d399],
    "pine",
  );
  const oakLeafTex = createFoliageTextureSet(
    [0x14532d, 0x15803d, 0x22c55e, 0x84cc16],
    "broadleaf",
  );
  const willowLeafTex = createFoliageTextureSet(
    [0x115e59, 0x0d9488, 0x2dd4bf, 0xa3e635],
    "willow",
  );
  const direEmberTex = createFoliageTextureSet(
    [0x3b0712, 0x881337, 0xe11d48, 0xf97316],
    "dire_ember",
  );

  const trunkMat = new THREE.MeshStandardMaterial({
    map: barkPBR.map,
    bumpMap: barkPBR.bumpMap,
    bumpScale: 0.34,
    roughness: 0.88,
    color: 0xe7d8c5,
  });
  applyTrunkAOShader(trunkMat);

  const pineCanopyMat = new THREE.MeshStandardMaterial({
    map: pineLeafTex.map,
    bumpMap: pineLeafTex.bumpMap,
    bumpScale: 0.22,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    roughness: 0.78,
    metalness: 0.02,
    envMapIntensity: 0.22,
  });
  const oakCanopyMat = new THREE.MeshStandardMaterial({
    map: oakLeafTex.map,
    bumpMap: oakLeafTex.bumpMap,
    bumpScale: 0.22,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    roughness: 0.76,
    metalness: 0.02,
    envMapIntensity: 0.22,
  });
  const willowCanopyMat = new THREE.MeshStandardMaterial({
    map: willowLeafTex.map,
    bumpMap: willowLeafTex.bumpMap,
    bumpScale: 0.18,
    alphaTest: 0.2,
    side: THREE.DoubleSide,
    roughness: 0.75,
    metalness: 0.02,
    envMapIntensity: 0.22,
  });

  applyFoliageWindShader(pineCanopyMat, 0.13, 0x34d399, 0.22);
  applyFoliageWindShader(oakCanopyMat, 0.18, 0xa3e635, 0.28);
  applyFoliageWindShader(willowCanopyMat, 0.24, 0x5eead4, 0.26);
  animatedFoliageMaterials = [
    pineCanopyMat,
    oakCanopyMat,
    willowCanopyMat,
  ];

  const oakTrunkGeo = createAncientOakTrunkGeo();
  const oakCanopyGeo = createSculptedBroadleafCanopyGeo();
  const coniferTrunkGeo = createConiferTrunkGeo();
  const pineCanopyGeo = createSculptedPineCanopyGeo();
  const willowTrunkGeo = createWillowTrunkGeo();
  const willowCanopyGeo = createWillowCanopyGeo();

  const dummy = new THREE.Object3D();
  const tmpCol = new THREE.Color();

  // 1. Ancient Sylvan Broadleaf Oaks
  if (radOaks.length > 0) {
    const oakTrunkInst = new THREE.InstancedMesh(
      oakTrunkGeo,
      trunkMat,
      radOaks.length,
    );
    oakTrunkInst.castShadow = true;
    oakTrunkInst.receiveShadow = true;
    const oakInst = new THREE.InstancedMesh(
      oakCanopyGeo,
      oakCanopyMat,
      radOaks.length,
    );
    oakInst.castShadow = false;
    oakInst.receiveShadow = false;

    radOaks.forEach((t, i) => {
      const sx = t.sc * (1.02 + (i % 3) * 0.06);
      const sy = t.sc * (0.94 + (i % 4) * 0.05);
      dummy.position.set(t.x, t.y - 0.1, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.set(sx, sy, sx);
      dummy.updateMatrix();
      oakTrunkInst.setMatrixAt(i, dummy.matrix);
      oakInst.setMatrixAt(i, dummy.matrix);

      // Golden-amber autumn sentinel oaks interspersed with lush viridian/emerald oaks
      if (i % 6 === 0) tmpCol.setHSL(0.11, 0.62, 0.88);
      else if (i % 6 === 3) tmpCol.setHSL(0.24, 0.45, 0.92);
      else
        tmpCol.setHSL(0.35 + (i % 5) * 0.012, 0.26, 0.9 + (i % 3) * 0.04);
      oakInst.setColorAt(i, tmpCol);
    });
    scene.add(
      freezeStaticObject(oakTrunkInst),
      freezeStaticObject(oakInst),
    );
  }

  // 2. Towering Alpine Conifers & Pines
  if (radPines.length > 0) {
    const pineTrunkInst = new THREE.InstancedMesh(
      coniferTrunkGeo,
      trunkMat,
      radPines.length,
    );
    pineTrunkInst.castShadow = true;
    pineTrunkInst.receiveShadow = true;
    const pineInst = new THREE.InstancedMesh(
      pineCanopyGeo,
      pineCanopyMat,
      radPines.length,
    );
    pineInst.castShadow = false;
    pineInst.receiveShadow = false;

    radPines.forEach((t, i) => {
      const sx = t.sc * (0.94 + (i % 3) * 0.05);
      const sy = t.sc * (0.96 + (i % 5) * 0.06);
      dummy.position.set(t.x, t.y - 0.1, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.set(sx, sy, sx);
      dummy.updateMatrix();
      pineTrunkInst.setMatrixAt(i, dummy.matrix);
      pineInst.setMatrixAt(i, dummy.matrix);

      // Spruce, Blue-Spruce & Alpine Emerald variation
      if (i % 5 === 0) tmpCol.setHSL(0.47, 0.34, 0.88);
      else
        tmpCol.setHSL(0.4 + (i % 6) * 0.01, 0.24, 0.88 + (i % 4) * 0.04);
      pineInst.setColorAt(i, tmpCol);
    });
    scene.add(
      freezeStaticObject(pineTrunkInst),
      freezeStaticObject(pineInst),
    );
  }

  // 3. Sacred Riverbank Weeping Willows
  if (radWillows.length > 0) {
    const willowTrunkInst = new THREE.InstancedMesh(
      willowTrunkGeo,
      trunkMat,
      radWillows.length,
    );
    willowTrunkInst.castShadow = true;
    willowTrunkInst.receiveShadow = true;
    const willowInst = new THREE.InstancedMesh(
      willowCanopyGeo,
      willowCanopyMat,
      radWillows.length,
    );
    willowInst.castShadow = false;
    willowInst.receiveShadow = false;

    radWillows.forEach((t, i) => {
      dummy.position.set(t.x, t.y - 0.1, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.set(t.sc * 1.05, t.sc * 0.98, t.sc * 1.05);
      dummy.updateMatrix();
      willowTrunkInst.setMatrixAt(i, dummy.matrix);
      willowInst.setMatrixAt(i, dummy.matrix);
      tmpCol.setHSL(0.36 + (i % 4) * 0.02, 0.28, 0.92);
      willowInst.setColorAt(i, tmpCol);
    });
    scene.add(
      freezeStaticObject(willowTrunkInst),
      freezeStaticObject(willowInst),
    );
  }

  const allRadTrees = [...radOaks, ...radPines, ...radWillows];

  // Bioluminescent Forest Mushrooms nestled between buttress roots
  if (allRadTrees.length > 0) {
    const shroomMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.4,
    });
    const shroomInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.24, 7, 6),
      shroomMat,
      Math.min(110, allRadTrees.length),
    );
    for (let i = 0; i < shroomInst.count; i++) {
      const t = allRadTrees[(i * 3) % allRadTrees.length];
      dummy.position.set(
        t.x + 0.78 * t.sc,
        t.y + 0.12,
        t.z + 0.68 * t.sc,
      );
      dummy.scale.set(0.9 + (i % 3) * 0.22, 0.65, 0.9 + (i % 3) * 0.22);
      dummy.updateMatrix();
      shroomInst.setMatrixAt(i, dummy.matrix);
    }
    scene.add(freezeStaticObject(shroomInst));
  }

  // 4. Dire Gnarled Weirwood / Cinder-Ash Trees with Jagged Ember Foliage
  const direBarkMat = new THREE.MeshStandardMaterial({
    map: barkPBR.map,
    bumpMap: barkPBR.bumpMap,
    bumpScale: 0.36,
    color: 0x381c26,
    roughness: 0.86,
    metalness: 0.18,
  });
  applyTrunkAOShader(direBarkMat);

  const direCanopyMat = new THREE.MeshStandardMaterial({
    map: direEmberTex.map,
    bumpMap: direEmberTex.bumpMap,
    bumpScale: 0.24,
    alphaTest: 0.22,
    side: THREE.DoubleSide,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.36,
    roughness: 0.78,
    metalness: 0.02,
    envMapIntensity: 0.2,
  });
  applyFoliageWindShader(direCanopyMat, 0.14, 0xf97316, 0.34);
  animatedFoliageMaterials.push(direCanopyMat);

  const gnarledDireGeo = createGnarledDireTreeGeo();
  const direCrownGeo = createDireCanopyGeo();
  if (direSpires.length > 0) {
    const direTrunkInst = new THREE.InstancedMesh(
      gnarledDireGeo,
      direBarkMat,
      direSpires.length,
    );
    direTrunkInst.castShadow = true;
    direTrunkInst.receiveShadow = true;

    const direCrownInst = new THREE.InstancedMesh(
      direCrownGeo,
      direCanopyMat,
      direSpires.length,
    );
    direCrownInst.castShadow = false;
    direCrownInst.receiveShadow = false;

    direSpires.forEach((s, i) => {
      dummy.position.set(s.x, s.y - 0.1, s.z);
      dummy.rotation.set(0, s.rot, 0);
      dummy.scale.setScalar(s.sc);
      dummy.updateMatrix();
      direTrunkInst.setMatrixAt(i, dummy.matrix);
      direCrownInst.setMatrixAt(i, dummy.matrix);

      if (i % 4 === 0) tmpCol.setHSL(0.05, 0.75, 0.6);
      else tmpCol.setHSL(0.98, 0.62, 0.62 + (i % 4) * 0.04);
      direCrownInst.setColorAt(i, tmpCol);
    });
    scene.add(
      freezeStaticObject(direTrunkInst),
      freezeStaticObject(direCrownInst),
    );
  }

  // Ground Root-Litter & Soft Contact-Shadow Discs under all trees for grounded botanical realism
  const allTreesForBase = [...allRadTrees, ...direSpires];
  if (allTreesForBase.length > 0) {
    const baseDiscGeo = new THREE.CircleGeometry(1.95, 14);
    baseDiscGeo.rotateX(-Math.PI / 2);
    const baseDiscMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const baseDiscInst = new THREE.InstancedMesh(
      baseDiscGeo,
      baseDiscMat,
      allTreesForBase.length,
    );
    allTreesForBase.forEach((t, i) => {
      dummy.position.set(t.x, t.y + 0.04, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.set(t.sc, 1, t.sc);
      dummy.updateMatrix();
      baseDiscInst.setMatrixAt(i, dummy.matrix);
    });
    scene.add(freezeStaticObject(baseDiscInst));
  }

  // Lush Instanced Ground Foliage: skip building 1,800 hidden clutter instances when booting on Ultra Light
  if (
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultralight"
  ) {
    return;
  }
  const grassTufts = [];
  const fernClusters = [];
  const wildflowers = [];
  const direCrystals = [];
  for (let i = 0; i < 860; i++) {
    const gx = (Math.random() - 0.5) * 236;
    const gz = (Math.random() - 0.5) * 236;
    const dLane = Math.abs(gx + gz) / Math.SQRT2;
    const dRiver = Math.abs(gx - gz) / Math.SQRT2;
    if (dLane < 8.4 || dRiver < 9.2) continue;
    if (
      clearZones.some((c) => Math.hypot(gx - c.x, gz - c.z) < c.r * 0.85)
    )
      continue;
    const gy = getTerrainHeightAt(gx, gz);
    if (gx - gz < 0) {
      grassTufts.push({
        x: gx,
        y: gy,
        z: gz,
        sc: 0.75 + Math.random() * 0.7,
        rot: Math.random() * Math.PI * 2,
      });
      if (i % 4 === 0)
        fernClusters.push({
          x: gx - 0.35,
          y: gy,
          z: gz + 0.35,
          sc: 0.85 + Math.random() * 0.65,
          rot: Math.random() * Math.PI * 2,
        });
      if (i % 3 === 0)
        wildflowers.push({
          x: gx + 0.4,
          y: gy,
          z: gz - 0.3,
          sc: 0.8 + Math.random() * 0.5,
        });
    } else if (i % 2 === 0) {
      direCrystals.push({
        x: gx,
        y: gy,
        z: gz,
        sc: 0.7 + Math.random() * 0.85,
        rot: Math.random() * Math.PI * 2,
      });
    }
  }

  if (grassTufts.length > 0) {
    // Multi-blade fanned meadow grass clump geometry for rich ground texture
    const gPos = [],
      gNorm = [],
      gUv = [],
      gIdx = [];
    let gOff = 0;
    for (let b = 0; b < 5; b++) {
      const ang = (b / 5) * Math.PI * 2 + 0.3;
      const blade = new THREE.ConeGeometry(
        0.11,
        0.88 + (b % 2) * 0.24,
        4,
      );
      blade.scale(1.2, 1.0, 0.35);
      blade.translate(0, 0.42, 0);
      blade.rotateX(0.26);
      blade.rotateY(ang);
      blade.translate(Math.cos(ang) * 0.16, 0, Math.sin(ang) * 0.16);
      gOff = appendMergedPart(blade, gPos, gNorm, gUv, gIdx, gOff);
    }
    const grassClumpGeo = new THREE.BufferGeometry();
    grassClumpGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(gPos, 3),
    );
    grassClumpGeo.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(gNorm, 3),
    );
    grassClumpGeo.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(gUv, 2),
    );
    grassClumpGeo.setIndex(gIdx);

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x3f8f38,
      roughness: 0.78,
    });
    const grassInst = new THREE.InstancedMesh(
      grassClumpGeo,
      grassMat,
      grassTufts.length,
    );
    grassTufts.forEach((g, i) => {
      dummy.position.set(g.x, g.y - 0.02, g.z);
      dummy.rotation.set(0, g.rot, 0);
      dummy.scale.set(g.sc * 1.15, g.sc * 0.95, g.sc * 1.15);
      dummy.updateMatrix();
      grassInst.setMatrixAt(i, dummy.matrix);
      tmpCol.setHSL(0.26 + (i % 7) * 0.016, 0.56, 0.42 + (i % 4) * 0.05);
      grassInst.setColorAt(i, tmpCol);
    });
    scene.add(freezeStaticObject(grassInst));
    grassInst.count = 0;
    groundClutterMeshes.push(grassInst);

    // Smooth Sculpted Mossy Woodland Boulders seated firmly in Radiant glades
    const mossyRocks = grassTufts.filter((_, idx) => idx % 10 === 0);
    if (mossyRocks.length > 0) {
      const bGeo = new THREE.IcosahedronGeometry(0.56, 2);
      const bPos = bGeo.attributes.position;
      for (let vi = 0; vi < bPos.count; vi++) {
        const vx = bPos.getX(vi),
          vy = bPos.getY(vi),
          vz = bPos.getZ(vi);
        const n =
          1.0 +
          0.14 * Math.sin(vx * 5.2 + vz * 4.1) +
          0.09 * Math.cos(vy * 6.4 - vx * 3.7);
        bPos.setXYZ(vi, vx * n, vy * n * (vy < 0 ? 0.55 : 0.82), vz * n);
      }
      bGeo.computeVertexNormals();
      const mRockMat = new THREE.MeshStandardMaterial({
        color: 0x3f5243,
        map: cobblePBR.map,
        bumpMap: cobblePBR.bumpMap,
        bumpScale: 0.18,
        roughness: 0.86,
        metalness: 0.06,
      });
      const mRockInst = new THREE.InstancedMesh(
        bGeo,
        mRockMat,
        mossyRocks.length,
      );
      mRockInst.castShadow = false;
      mRockInst.receiveShadow = true;
      mossyRocks.forEach((mr, i) => {
        dummy.position.set(mr.x + 0.65, mr.y + 0.08 * mr.sc, mr.z - 0.55);
        dummy.rotation.set(0.08, mr.rot, -0.06);
        dummy.scale.set(1.3 * mr.sc, 0.56 * mr.sc, 1.12 * mr.sc);
        dummy.updateMatrix();
        mRockInst.setMatrixAt(i, dummy.matrix);
      });
      scene.add(freezeStaticObject(mRockInst));
    }
  }

  if (fernClusters.length > 0) {
    const fPos = [],
      fNorm = [],
      fUv = [],
      fIdx = [];
    let fOff = 0;
    for (let f = 0; f < 5; f++) {
      const fa = (f / 5) * Math.PI * 2;
      const fCard = createCamberedFoliageCard(
        1.05,
        0.95,
        0.16,
        new THREE.Vector3(Math.cos(fa) * 0.38, 0.36, Math.sin(fa) * 0.38),
        new THREE.Euler(0.92, -fa + Math.PI * 0.5, 0, "YXZ"),
        0.4,
      );
      fOff = appendMergedPart(fCard, fPos, fNorm, fUv, fIdx, fOff);
    }
    const fernGeo = new THREE.BufferGeometry();
    fernGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(fPos, 3),
    );
    fernGeo.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(fNorm, 3),
    );
    fernGeo.setAttribute("uv", new THREE.Float32BufferAttribute(fUv, 2));
    fernGeo.setIndex(fIdx);

    const fernInst = new THREE.InstancedMesh(
      fernGeo,
      oakCanopyMat,
      fernClusters.length,
    );
    fernClusters.forEach((fn, i) => {
      dummy.position.set(fn.x, fn.y - 0.02, fn.z);
      dummy.rotation.set(0, fn.rot, 0);
      dummy.scale.setScalar(fn.sc);
      dummy.updateMatrix();
      fernInst.setMatrixAt(i, dummy.matrix);
      tmpCol.setHSL(0.35 + (i % 5) * 0.015, 0.32, 0.86);
      fernInst.setColorAt(i, tmpCol);
    });
    scene.add(freezeStaticObject(fernInst));
    groundClutterMeshes.push(fernInst);
  }

  if (wildflowers.length > 0) {
    const flowerMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.06,
      roughness: 0.8,
    });
    const flowerInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.22, 0),
      flowerMat,
      wildflowers.length,
    );
    const flowerCols = [0xfef08a, 0x38bdf8, 0xf472b6, 0xa7f3d0];
    wildflowers.forEach((f, i) => {
      dummy.position.set(f.x, f.y + 0.28 * f.sc, f.z);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.setScalar(f.sc);
      dummy.updateMatrix();
      flowerInst.setMatrixAt(i, dummy.matrix);
      tmpCol.setHex(flowerCols[i % flowerCols.length]);
      flowerInst.setColorAt(i, tmpCol);
    });
    scene.add(freezeStaticObject(flowerInst));
    groundClutterMeshes.push(flowerInst);
  }

  if (direCrystals.length > 0) {
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x9f1239,
      emissive: 0xbe123c,
      emissiveIntensity: 0.22,
      roughness: 0.3,
      metalness: 0.2,
    });
    const crystalInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.42, 0),
      crystalMat,
      direCrystals.length,
    );
    direCrystals.forEach((c, i) => {
      dummy.position.set(c.x, c.y + 0.42 * c.sc, c.z);
      dummy.rotation.set(0.2, c.rot, -0.15);
      dummy.scale.set(c.sc * 0.85, c.sc * 1.55, c.sc * 0.85);
      dummy.updateMatrix();
      crystalInst.setMatrixAt(i, dummy.matrix);
    });
    crystalInst.count = Math.ceil(direCrystals.length * 0.5);
    scene.add(freezeStaticObject(crystalInst));
    groundClutterMeshes.push(crystalInst);
  }

  // Riverbank Cattail Reeds & Marsh Grasses seated along the shoreline
  const reeds = [];
  for (let i = 0; i < 180; i++) {
    const along = (Math.random() - 0.5) * 300;
    if (Math.abs(along) < 13.5) continue;
    const side = i % 2 === 0 ? -1 : 1;
    const across = side * (8.9 + Math.random() * 1.6);
    const rx = (along + across) / Math.SQRT2;
    const rz = (along - across) / Math.SQRT2;
    const gy = getTerrainHeightAt(rx, rz);
    reeds.push({ x: rx, y: gy, z: rz, sc: 0.65 + Math.random() * 0.55 });
  }
  const reedGeo = new THREE.ConeGeometry(0.055, 1.35, 5);
  reedGeo.translate(0, 0.675, 0);
  const reedMat = new THREE.MeshStandardMaterial({
    color: 0x3b6e3c,
    roughness: 0.82,
    envMapIntensity: 0.25,
  });
  reedMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime =
      typeof nxg !== "undefined" && nxg.grassUniforms
        ? nxg.grassUniforms.uTime
        : riverShaderUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
                  float rMask = clamp(position.y / 1.35, 0.0, 1.0);
                  float rPhase = instanceMatrix[3][0] * 0.25 + instanceMatrix[3][2] * 0.25;
                  transformed.x += sin(uTime * 2.1 + rPhase) * 0.14 * rMask * rMask;
                  transformed.z += cos(uTime * 1.8 + rPhase) * 0.10 * rMask * rMask;`,
      );
  };
  reedMat.customProgramCacheKey = () => "river_reed_sway";
  const reedInst = new THREE.InstancedMesh(
    reedGeo,
    reedMat,
    reeds.length,
  );
  reedInst.castShadow = false;
  reedInst.receiveShadow = true;
  reeds.forEach((r, i) => {
    dummy.position.set(r.x, r.y - 0.06, r.z);
    dummy.rotation.set(
      ((i % 3) - 1) * 0.16,
      i * 0.9,
      ((i % 2) - 0.5) * 0.18,
    );
    dummy.scale.setScalar(r.sc);
    dummy.updateMatrix();
    reedInst.setMatrixAt(i, dummy.matrix);
    tmpCol.setHSL(0.24 + (i % 5) * 0.015, 0.42, 0.34 + (i % 3) * 0.05);
    reedInst.setColorAt(i, tmpCol);
  });
  scene.add(freezeStaticObject(reedInst));
  groundClutterMeshes.push(reedInst);

  if (
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax"
  ) {
    buildUltraMaxEnvironmentDetails();
  }
}

let ultraMaxEnvGroup = null;
let ultraMaxFireflies = null;
let ultraMaxConfluencePylons = [];
let ultraMaxHeroLight = null;

function buildUltraMaxEnvironmentDetails() {
  if (ultraMaxEnvGroup) return;
  ultraMaxEnvGroup = new THREE.Group();
  ultraMaxEnvGroup.visible =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // 1B. 480 Sculpted Smooth River-Worn Cobblestone & Granite Pebble Clusters seated flush in turf
  const pPos = [],
    pNorm = [],
    pUv = [],
    pIdx = [];
  let pOff = 0;
  const pebbleOffsets = [
    { x: 0.0, z: 0.0, rx: 0.28, ry: 0.11, rz: 0.24, rot: 0.2 },
    { x: 0.26, z: 0.14, rx: 0.19, ry: 0.08, rz: 0.16, rot: 1.1 },
    { x: -0.21, z: 0.18, rx: 0.16, ry: 0.07, rz: 0.15, rot: 2.3 },
  ];
  pebbleOffsets.forEach((po) => {
    const subGeo = new THREE.IcosahedronGeometry(1.0, 1);
    const sp = subGeo.attributes.position;
    for (let vi = 0; vi < sp.count; vi++) {
      const vx = sp.getX(vi),
        vy = sp.getY(vi),
        vz = sp.getZ(vi);
      const n = 1.0 + 0.12 * Math.sin(vx * 4.5 + vz * 3.8);
      sp.setXYZ(
        vi,
        vx * po.rx * n,
        Math.max(-0.25, vy) * po.ry * n,
        vz * po.rz * n,
      );
    }
    subGeo.computeVertexNormals();
    subGeo.rotateY(po.rot);
    subGeo.translate(po.x, 0, po.z);
    pOff = appendMergedPart(subGeo, pPos, pNorm, pUv, pIdx, pOff);
  });
  const pebbleClusterGeo = new THREE.BufferGeometry();
  pebbleClusterGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(pPos, 3),
  );
  pebbleClusterGeo.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(pNorm, 3),
  );
  pebbleClusterGeo.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(pUv, 2),
  );
  pebbleClusterGeo.setIndex(pIdx);

  const pebbleCount = 480;
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: cobblePBR.map,
    bumpMap: cobblePBR.bumpMap,
    bumpScale: 0.14,
    roughness: 0.78,
    metalness: 0.08,
  });
  const pebbleInst = new THREE.InstancedMesh(
    pebbleClusterGeo,
    pebbleMat,
    pebbleCount,
  );
  pebbleInst.receiveShadow = true;
  let pPlaced = 0;
  const stonePalette = [0x57534e, 0x64748b, 0x4b5563, 0x44403c, 0x526055];
  for (let i = 0; i < pebbleCount * 2 && pPlaced < pebbleCount; i++) {
    const px = (Math.random() - 0.5) * 234;
    const pz = (Math.random() - 0.5) * 234;
    const distRiver = Math.abs(px - pz) / Math.SQRT2;
    const distLane = Math.abs(px + pz) / Math.SQRT2;
    if (distRiver < 8.6 || distLane < 7.6) continue;
    const py = getTerrainHeightAt(px, pz);
    if (py > 2.3) continue;

    dummy.position.set(px, py - 0.01, pz);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    const ps = 0.75 + Math.random() * 0.65;
    dummy.scale.set(ps, ps, ps);
    dummy.updateMatrix();
    pebbleInst.setMatrixAt(pPlaced, dummy.matrix);
    col.setHex(stonePalette[pPlaced % stonePalette.length]);
    pebbleInst.setColorAt(pPlaced, col);
    pPlaced++;
  }
  pebbleInst.count = pPlaced;
  pebbleInst.instanceMatrix.needsUpdate = true;
  if (pebbleInst.instanceColor)
    pebbleInst.instanceColor.needsUpdate = true;
  ultraMaxEnvGroup.add(pebbleInst);
  chunkOneInstancedMesh(pebbleInst, 48);

  // 2. 4 Towering Carved Marble & Arcane Faction Archway Gates spanning the Mid-Lane
  const archCoords = [
    { x: -54, z: 54, hex: 0x34d399, stoneCol: 0xe2e8f0 },
    { x: -24, z: 24, hex: 0xfacc15, stoneCol: 0xcbd5e1 },
    { x: 24, z: -24, hex: 0xf97316, stoneCol: 0x334155 },
    { x: 54, z: -54, hex: 0xf43f5e, stoneCol: 0x1e293b },
  ];
  const sharedArchColGeo = registerSharedAsset(
    new THREE.CylinderGeometry(0.85, 1.25, 11.2, 8),
  );
  const sharedArchBandGeo = registerSharedAsset(
    new THREE.TorusGeometry(0.98, 0.08, 8, 24),
  );
  const sharedArchCapGeo = registerSharedAsset(
    new THREE.OctahedronGeometry(0.72, 0),
  );
  const sharedArchLintelGeo = registerSharedAsset(
    new THREE.BoxGeometry(19.6, 1.35, 1.65),
  );
  const sharedArchKeyGeo = registerSharedAsset(
    new THREE.OctahedronGeometry(1.15, 0),
  );
  archCoords.forEach((ac, idx) => {
    const ay = getTerrainHeightAt(ac.x, ac.z);
    const archGroup = new THREE.Group();
    archGroup.position.set(ac.x, ay, ac.z);
    archGroup.rotation.y = -Math.PI / 4;

    const pillarMat = new THREE.MeshStandardMaterial({
      map: marblePBR.map,
      bumpMap: marblePBR.bumpMap,
      bumpScale: 0.22,
      color: ac.stoneCol,
      roughness: 0.4,
      metalness: 0.52,
    });
    const runeMat = new THREE.MeshStandardMaterial({
      color: ac.hex,
      emissive: ac.hex,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.85,
    });

    [-8.4, 8.4].forEach((px) => {
      const colMesh = new THREE.Mesh(sharedArchColGeo, pillarMat);
      colMesh.position.set(px, 5.6, 0);
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      archGroup.add(colMesh);

      const runeBand = new THREE.Mesh(sharedArchBandGeo, runeMat);
      runeBand.rotation.x = Math.PI / 2;
      runeBand.position.set(px, 7.8, 0);
      archGroup.add(runeBand);

      const capOrb = new THREE.Mesh(sharedArchCapGeo, runeMat);
      capOrb.position.set(px, 12.1, 0);
      archGroup.add(capOrb);
    });

    const lintel = new THREE.Mesh(sharedArchLintelGeo, pillarMat);
    lintel.position.set(0, 11.2, 0);
    lintel.castShadow = true;
    archGroup.add(lintel);

    const keystone = new THREE.Mesh(sharedArchKeyGeo, runeMat);
    keystone.position.set(0, 12.4, 0);
    archGroup.add(keystone);

    ultraMaxEnvGroup.add(archGroup);
    ultraMaxConfluencePylons.push({
      crystal: keystone,
      ring: null,
      baseY: 12.4,
      phase: idx * 1.1,
    });
  });

  // 5. Dynamic Hero-Tracking Celestial Spotlight (illuminates armor, crown & floating cubes with crisp falloff)
  ultraMaxHeroLight = new THREE.PointLight(0xfacc15, 2.8, 28, 1.65);
  ultraMaxHeroLight.position.set(0, 5.2, 0);
  ultraMaxEnvGroup.add(ultraMaxHeroLight);

  scene.add(ultraMaxEnvGroup);
}

function updateUltraMaxEnvironmentAnimations(time, dt) {
  if (!ultraMaxEnvGroup || !ultraMaxEnvGroup.visible) return;
  for (let i = 0; i < ultraMaxConfluencePylons.length; i++) {
    const py = ultraMaxConfluencePylons[i];
    py.crystal.rotation.y += dt * 2.1;
    py.crystal.position.y =
      py.baseY + Math.sin(time * 2.6 + py.phase) * 0.3;
    if (py.ring) {
      py.ring.rotation.z += dt * 1.4;
      py.ring.rotation.y = Math.sin(time * 1.4 + py.phase) * 0.38;
    }
  }
  if (ultraMaxFireflies) {
    ultraMaxFireflies.rotation.y = Math.sin(time * 0.09) * 0.035;
    ultraMaxFireflies.position.y = Math.sin(time * 1.4) * 0.35;
  }
  if (
    ultraMaxHeroLight &&
    typeof playerHero !== "undefined" &&
    playerHero &&
    playerHero.mesh
  ) {
    ultraMaxHeroLight.position.set(
      playerHero.mesh.position.x,
      playerHero.mesh.position.y + 5.2,
      playerHero.mesh.position.z,
    );
    if (playerHero.heroCfg)
      ultraMaxHeroLight.color.setHex(playerHero.heroCfg.primaryHex);
    const combatBoost =
      playerHero.swingAnim > 0 || playerHero.castAnim > 0 ? 5.2 : 2.8;
    ultraMaxHeroLight.intensity +=
      (combatBoost - ultraMaxHeroLight.intensity) * Math.min(1, dt * 12);
  }
}

function buildDetailedAmbientInsects() {
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.6,
  });
  const makeWingTexture = (isMorpho) => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = isMorpho ? "#0284c7" : "#f97316";
    ctx.strokeStyle = "#090d16";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(6, 56);
    ctx.bezierCurveTo(36, 8, 118, 12, 116, 52);
    ctx.bezierCurveTo(114, 72, 46, 68, 6, 56);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 62);
    ctx.bezierCurveTo(44, 62, 102, 76, 88, 112);
    ctx.bezierCurveTo(64, 124, 18, 96, 6, 62);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(102, 42, 4, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const monarchMat = new THREE.MeshBasicMaterial({
    map: makeWingTexture(false),
    transparent: true,
    side: THREE.DoubleSide,
    alphaTest: 0.1,
  });
  const morphoMat = new THREE.MeshBasicMaterial({
    map: makeWingTexture(true),
    transparent: true,
    side: THREE.DoubleSide,
    alphaTest: 0.1,
  });
  const wingPlane = new THREE.PlaneGeometry(0.68, 0.68);
  wingPlane.rotateX(-Math.PI / 2);
  wingPlane.translate(0.34, 0, 0);

  [
    [-34, 28],
    [-54, 44],
    [-22, 56],
    [-68, 62],
    [-42, 74],
    [-20, 18],
  ].forEach(([bx, bz], i) => {
    const root = new THREE.Group();
    const thorax = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 0.36, 4, 8),
      bodyMat,
    );
    thorax.rotation.x = Math.PI / 2;
    root.add(thorax);
    const wMat = i % 2 === 0 ? monarchMat : morphoMat;
    const leftWing = new THREE.Mesh(wingPlane, wMat);
    const rightWing = new THREE.Mesh(wingPlane, wMat);
    rightWing.scale.x = -1;
    root.add(leftWing, rightWing);
    root.position.set(bx, 1.8, bz);
    scene.add(root);
    ambientButterflies.push({
      group: root,
      leftWing,
      rightWing,
      baseX: bx,
      baseZ: bz,
      rx: 4.5 + i * 0.6,
      rz: 3.8 + (i % 3) * 0.8,
      speed: 0.55 + (i % 3) * 0.14,
      phase: i * 1.15,
    });
  });

  const dfWingMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.68,
    side: THREE.DoubleSide,
  });
  const dfThoraxMat = new THREE.MeshStandardMaterial({
    color: 0x0d9488,
    metalness: 0.75,
    roughness: 0.2,
  });
  [
    [-18, -12],
    [-5, 7],
    [14, 16],
    [28, 30],
  ].forEach(([dx, dz], i) => {
    const df = new THREE.Group();
    const thorax = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      dfThoraxMat,
    );
    thorax.scale.set(0.85, 0.85, 1.6);
    df.add(thorax);
    const foreWingGeo = new THREE.PlaneGeometry(0.62, 0.12);
    foreWingGeo.rotateX(-Math.PI / 2);
    foreWingGeo.translate(0.31, 0, 0);
    const fl = new THREE.Mesh(foreWingGeo, dfWingMat);
    fl.position.set(0.04, 0.05, 0.06);
    const fr = new THREE.Mesh(foreWingGeo, dfWingMat);
    fr.scale.x = -1;
    fr.position.set(-0.04, 0.05, 0.06);
    df.add(fl, fr);
    df.position.set(dx, 0.85, dz);
    scene.add(df);
    ambientDragonflies.push({
      group: df,
      wings: [fl, fr],
      baseX: dx,
      baseZ: dz,
      phase: i * 1.6,
      speed: 1.25 + i * 0.18,
    });
  });
}

function updateAmbientWildlife(dt, time) {
  if (!userSettings.clutterEnabled) {
    for (let i = 0; i < ambientButterflies.length; i++)
      ambientButterflies[i].group.visible = false;
    for (let i = 0; i < ambientDragonflies.length; i++)
      ambientDragonflies[i].group.visible = false;
    return;
  }
  const butterflyVis = currentWeather !== "rain";
  ambientButterflies.forEach((b) => {
    b.group.visible = butterflyVis;
    if (!butterflyVis) return;
    b.phase += dt * b.speed;
    const nx = b.baseX + Math.sin(b.phase) * b.rx;
    const nz = b.baseZ + Math.sin(b.phase * 2.0) * b.rz * 0.55;
    const dx = nx - b.group.position.x,
      dz = nz - b.group.position.z;
    if (Math.hypot(dx, dz) > 0.001)
      b.group.rotation.y = Math.atan2(dx, dz);
    b.group.position.set(nx, 1.7 + Math.sin(b.phase * 3.4) * 0.45, nz);
    const flap = Math.sin(time * 16 + b.phase) * 0.82;
    b.leftWing.rotation.z = flap;
    b.rightWing.rotation.z = -flap;
  });

  ambientDragonflies.forEach((d) => {
    d.phase += dt * d.speed;
    const nx = d.baseX + Math.cos(d.phase) * 3.4;
    const nz = d.baseZ + Math.sin(d.phase * 1.5) * 3.4;
    const dx = nx - d.group.position.x,
      dz = nz - d.group.position.z;
    if (Math.hypot(dx, dz) > 0.001)
      d.group.rotation.y = Math.atan2(dx, dz);
    d.group.position.set(nx, 0.8 + Math.sin(d.phase * 4.2) * 0.16, nz);
    const buzz = Math.sin(time * 42 + d.phase) * 0.25;
    d.wings[0].rotation.z = buzz;
    d.wings[1].rotation.z = -buzz;
  });
}

let fountainPillars = [];
function buildFountainSanctuary(x, z, team) {
  const g = new THREE.Group();
  const glowCol = team === "radiant" ? 0x34d399 : 0xf43f5e;
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(9.5, 10.8, 0.6, 28),
    new THREE.MeshStandardMaterial({
      map: marblePBR.map,
      bumpMap: marblePBR.bumpMap,
      bumpScale: 0.15,
      roughness: 0.6,
    }),
  );
  dais.position.y = 0.3;
  dais.receiveShadow = true;
  g.add(dais);
  const well = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 7.2, 0.68, 28),
    new THREE.MeshStandardMaterial({
      color: glowCol,
      emissive: glowCol,
      emissiveIntensity: 1.35,
    }),
  );
  well.position.y = 0.32;
  g.add(well);

  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(8.2, 8.9, 44),
    new THREE.MeshBasicMaterial({
      color: glowCol,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    }),
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.64;
  g.add(auraRing);

  const crystals = [];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const px = Math.cos(ang) * 8.6;
    const pz = Math.sin(ang) * 8.6;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.65, 3.2, 6),
      new THREE.MeshStandardMaterial({
        map: marblePBR.map,
        roughness: 0.5,
      }),
    );
    pillar.position.set(px, 1.9, pz);
    pillar.castShadow = true;
    g.add(pillar);

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62, 0),
      new THREE.MeshStandardMaterial({
        color: glowCol,
        emissive: glowCol,
        emissiveIntensity: 1.9,
      }),
    );
    crystal.position.set(px, 4.3, pz);
    g.add(crystal);
    crystals.push({ mesh: crystal, baseY: 4.3, phase: i * 1.57 });
  }
  g.position.set(x, 0, z);
  scene.add(g);
  fountainPillars.push({ auraRing, crystals });
}

function build3DMerchantShop(x, z, type, label) {
  const g = new THREE.Group();
  const isSecret = type === "secret";
  const accentCol = isSecret ? 0xa855f7 : 0xfacc15;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.8, 0.45, 8),
    new THREE.MeshStandardMaterial({
      map: marblePBR.map,
      roughness: 0.65,
    }),
  );
  base.position.y = 0.22;
  base.receiveShadow = true;
  g.add(base);

  const woodMat = new THREE.MeshStandardMaterial({
    map: barkPBR.map,
    bumpMap: barkPBR.bumpMap,
    bumpScale: 0.12,
    roughness: 0.8,
  });
  [
    [-2.4, -2.0],
    [2.4, -2.0],
    [-2.4, 2.0],
    [2.4, 2.0],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 3.8, 8),
      woodMat,
    );
    post.position.set(px, 2.1, pz);
    post.castShadow = true;
    g.add(post);
  });

  const isRadSecret = isSecret && x - z > 0;
  const roofMat = isRadSecret
    ? new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        emissive: 0xd946ef,
        emissiveIntensity: 1.05,
        roughness: 0.38,
      })
    : new THREE.MeshStandardMaterial({
        color: isSecret ? 0x581c87 : 0x78350f,
        roughness: 0.55,
      });
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4.3, 2.3, isRadSecret ? 8 : 4),
    roofMat,
  );
  roof.position.y = 4.95;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  if (isRadSecret) {
    const gazeboHalo = new THREE.Mesh(
      new THREE.RingGeometry(5.6, 6.4, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf472b6,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      }),
    );
    gazeboHalo.rotation.x = -Math.PI / 2;
    gazeboHalo.position.y = 0.14;
    g.add(gazeboHalo);
    const gazeboLight = new THREE.PointLight(0xf472b6, 3.2, 24);
    gazeboLight.position.set(x, 4.2, z);
    scene.add(gazeboLight);
    arenaAccentLights.push(gazeboLight);
  }

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.1, 1.1),
    woodMat,
  );
  counter.position.set(0, 0.95, 1.2);
  g.add(counter);

  const npc = new THREE.Group();
  const robePts = [
    new THREE.Vector2(0.85, 0),
    new THREE.Vector2(0.62, 1.2),
    new THREE.Vector2(0.45, 2.1),
    new THREE.Vector2(0.0, 2.2),
  ];
  const robe = new THREE.Mesh(
    new THREE.LatheGeometry(robePts, 14),
    new THREE.MeshStandardMaterial({
      color: isSecret ? 0x6b21a8 : 0xb45309,
      roughness: 0.6,
    }),
  );
  robe.position.y = 0.25;
  npc.add(robe);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xfde68a }),
  );
  head.position.y = 2.65;
  npc.add(head);
  const hat = new THREE.Mesh(
    new THREE.ConeGeometry(0.68, 1.1, 12),
    new THREE.MeshStandardMaterial({
      color: isSecret ? 0x3b0764 : 0x92400e,
    }),
  );
  hat.position.y = 3.35;
  npc.add(hat);
  npc.position.set(0, 0.3, -0.3);
  g.add(npc);

  const signMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.75, 0),
    new THREE.MeshStandardMaterial({
      color: accentCol,
      emissive: accentCol,
      emissiveIntensity: 1.5,
    }),
  );
  signMesh.position.set(0, 6.7, 0);
  g.add(signMesh);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(11.6, 12.0, 48),
    new THREE.MeshBasicMaterial({
      color: accentCol,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);

  const hitVolume = new THREE.Mesh(
    new THREE.CylinderGeometry(5.6, 5.8, 7.6, 16),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    }),
  );
  hitVolume.position.y = 3.8;
  g.add(hitVolume);

  g.position.set(x, 0, z);
  scene.add(g);
  g.updateMatrixWorld(true);
  const shopEntry = {
    x,
    z,
    type,
    name: label,
    signMesh,
    npcMesh: npc,
    mesh: g,
  };
  g.traverse((ch) => {
    ch.userData.shopEntity = shopEntry;
  });
  shopEntities.push(shopEntry);
}

function buildTorchBrazier(x, z, colorHex, castLight) {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.9, 2.2, 8),
    new THREE.MeshStandardMaterial({
      map: marblePBR.map,
      bumpMap: marblePBR.bumpMap,
      bumpScale: 0.14,
      roughness: 0.65,
    }),
  );
  ped.position.y = 1.1;
  g.add(ped);
  const flame = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 2.0,
    }),
  );
  flame.position.y = 2.65;
  g.add(flame);
  g.position.set(x, 0, z);
  scene.add(g);

  if (castLight) {
    const pt = new THREE.PointLight(colorHex, 2.6, 26);
    pt.position.set(x, 3.8, z);
    scene.add(pt);
    torchLights.push({
      light: pt,
      flame,
      baseIntensity: 2.6,
      phase: Math.random() * 6.28,
    });
  }
}

