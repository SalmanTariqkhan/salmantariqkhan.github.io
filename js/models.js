/***********************************************************************
 * 8. HIGH-CRAFT ANATOMICAL HEROES, SCULPTED FACES, ORGANIC DRAGON & MEGA CREEPS
 ***********************************************************************/
let uidCounter = 1;

// Lofted Multi-Station Anatomical & Armor Mesh Builder
function buildLoftedMesh(stations, radialSegs, material, options = {}) {
  const {
    capBottom = true,
    capTop = true,
    archFront = 0,
    archBack = 0,
    flattenFront = 0,
  } = options;

  const rows = stations.length;
  const cols = radialSegs + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r < rows; r++) {
    const st = stations[r];
    const v = r / Math.max(1, rows - 1);
    const rx = st.rx;
    const rz = st.rz;
    const y = st.y;
    const zOff = st.zOff || 0;
    const xOff = st.xOff || 0;
    const h2 = st.h2 || 0; // harmonic 2: broader chest/back or fluted plate
    const h4 = st.h4 || 0; // harmonic 4: faceted armor bevel

    for (let c = 0; c <= radialSegs; c++) {
      const u = c / radialSegs;
      const theta = u * Math.PI * 2;
      const sinT = Math.sin(theta); // X axis
      const cosT = Math.cos(theta); // Z axis (+1 = front, -1 = back)

      const mod =
        1.0 + h2 * Math.cos(2 * theta) + h4 * Math.cos(4 * theta);
      let px = sinT * rx * mod + xOff;
      let pz = cosT * rz * mod + zOff;

      if (cosT > 0 && archFront !== 0) {
        pz += Math.pow(cosT, 1.5) * archFront;
      }
      if (cosT < 0 && archBack !== 0) {
        pz -= Math.pow(-cosT, 1.5) * archBack;
      }
      if (cosT > 0.35 && flattenFront > 0) {
        pz -= (cosT - 0.35) * rz * flattenFront;
      }

      positions.push(px, y, pz);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, b, d);
      indices.push(b, e, d);
    }
  }

  if (capBottom) {
    const st0 = stations[0];
    const centerIdx = positions.length / 3;
    positions.push(st0.xOff || 0, st0.y, st0.zOff || 0);
    uvs.push(0.5, 0);
    for (let c = 0; c < radialSegs; c++) {
      indices.push(centerIdx, c + 1, c);
    }
  }

  if (capTop) {
    const stTop = stations[rows - 1];
    const centerIdx = positions.length / 3;
    positions.push(stTop.xOff || 0, stTop.y, stTop.zOff || 0);
    uvs.push(0.5, 1);
    const baseRow = (rows - 1) * cols;
    for (let c = 0; c < radialSegs; c++) {
      indices.push(centerIdx, baseRow + c, baseRow + c + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Pleated Draped Cloth Cape / Tabard Geometry with GPU Vertex-Shader Wave Simulation
function _sharedCapeVertexCompile(shader, r) {
  if (this.userData && this.userData._prevCapeCompile) {
    this.userData._prevCapeCompile.call(this, shader, r);
  }
  const u = this.userData.capeUniforms;
  shader.uniforms.uCapeTime = u.uCapeTime;
  shader.uniforms.uCapeAmp = u.uCapeAmp;
  shader.uniforms.uCapeFreq = u.uCapeFreq;
  shader.uniforms.uCapeLen = u.uCapeLen;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      "#include <common>\nuniform float uCapeTime;\nuniform float uCapeAmp;\nuniform float uCapeFreq;\nuniform float uCapeLen;",
    )
    .replace(
      "#include <begin_vertex>",
      `
              #include <begin_vertex>
              float capeV = clamp(abs(transformed.y) / max(0.01, uCapeLen), 0.0, 1.0);
              transformed.z += sin(uCapeTime * uCapeFreq - capeV * 5.4 + transformed.x * 3.8) * uCapeAmp * capeV * capeV;
          `,
    );
}

function buildDrapedCapeMesh(topW, botW, length, folds, material) {
  const segX = 20;
  const segY = 14;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= segY; iy++) {
    const v = iy / segY; // 0 = shoulders, 1 = hem
    const y = -v * length;
    const halfW = THREE.MathUtils.lerp(
      topW * 0.5,
      botW * 0.5,
      Math.pow(v, 0.92),
    );
    const curveZ = -0.06 - Math.sin(v * Math.PI * 0.65) * 0.22 - v * 0.14;
    const foldAmp = 0.015 + v * 0.055;

    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const nx = (u - 0.5) * 2; // -1 .. +1
      const shoulderWrap = (1 - v) * (1 - nx * nx) * 0.14;
      const x = nx * halfW;
      const pleat =
        Math.cos(nx * Math.PI * folds) *
        foldAmp *
        (1 - Math.pow(Math.abs(nx), 4) * 0.5);
      const z = curveZ + shoulderWrap + pleat;
      positions.push(x, y, z);
      uvs.push(u, 1 - v);
    }
  }

  const cols = segX + 1;
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = (iy + 1) * cols + ix;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const capeUniforms = {
    uCapeTime: { value: 0 },
    uCapeAmp: { value: 0.035 },
    uCapeFreq: { value: 3.6 },
    uCapeLen: { value: length },
  };
  const capeMat = material.clone();
  capeMat.userData.capeUniforms = capeUniforms;
  capeMat.userData._prevCapeCompile = capeMat.onBeforeCompile;
  const prevKey = capeMat.customProgramCacheKey();
  capeMat.onBeforeCompile = _sharedCapeVertexCompile;
  capeMat.customProgramCacheKey = () => prevKey + "|nxgcape";

  const mesh = new THREE.Mesh(geo, capeMat);
  mesh.castShadow = true;
  mesh.userData.isDrapedCape = true;
  mesh.userData.capeUniforms = capeUniforms;
  mesh.userData.capeLength = length;
  return mesh;
}

// Procedural Engraved Armor, Scale & Fabric Multi-Channel PBR Texture Generator (Diffuse + Bump + Roughness + Metalness)
const _heroMatSetCache = new Map();
function createHeroMaterialSet(baseHex, trimHex, patternType = "plate") {
  const isUltraMax =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  const cacheKey = `${baseHex}_${trimHex}_${patternType}_${isUltraMax ? "umax" : "std"}_v136`;
  if (_heroMatSetCache.has(cacheKey))
    return _heroMatSetCache.get(cacheKey);
  const size = isUltraMax ? 512 : 256;
  const sc = size / 256;
  const cMap = document.createElement("canvas");
  const cBump = document.createElement("canvas");
  const cRough = document.createElement("canvas");
  const cMetal = document.createElement("canvas");
  cMap.width = cBump.width = cRough.width = cMetal.width = size;
  cMap.height = cBump.height = cRough.height = cMetal.height = size;
  const ctx = cMap.getContext("2d");
  const btx = cBump.getContext("2d");
  const rtx = cRough.getContext("2d");
  const mtx = cMetal.getContext("2d");

  const baseCol = new THREE.Color(baseHex);
  const trimCol = new THREE.Color(trimHex);
  const darkCol = baseCol.clone().multiplyScalar(0.54);
  const hiCol = baseCol.clone().lerp(new THREE.Color(0xffffff), 0.24);

  ctx.fillStyle = "#" + baseCol.getHexString();
  ctx.fillRect(0, 0, size, size);
  btx.fillStyle = "#808080";
  btx.fillRect(0, 0, size, size);
  rtx.fillStyle =
    patternType === "cloth"
      ? "#e4e4e4"
      : patternType === "scale"
        ? "#828282"
        : "#585858";
  rtx.fillRect(0, 0, size, size);
  mtx.fillStyle =
    patternType === "cloth"
      ? "#0c0c0c"
      : patternType === "scale"
        ? "#4a4a4a"
        : "#d6d6d6";
  mtx.fillRect(0, 0, size, size);

  if (patternType === "plate") {
    // Anisotropic brushed metal grain + subtle roughness micro-variation
    for (let y = 0; y < size; y += 2) {
      const even = y % 4 === 0;
      ctx.fillStyle = even
        ? "rgba(255,255,255,0.022)"
        : "rgba(0,0,0,0.026)";
      ctx.fillRect(0, y, size, 1);
      rtx.fillStyle = even
        ? "rgba(115,115,115,0.22)"
        : "rgba(68,68,68,0.22)";
      rtx.fillRect(0, y, size, 1);
    }
    // Forged hammer-dimple micro-relief across all quality levels
    const dimpleCount = isUltraMax ? 220 : 110;
    for (let i = 0; i < dimpleCount; i++) {
      const hx = (i * 73.1) % size;
      const hy = (i * 139.7) % size;
      ctx.fillStyle =
        i % 2 === 0 ? "rgba(255,255,255,0.028)" : "rgba(0,0,0,0.034)";
      ctx.beginPath();
      ctx.arc(hx, hy, 5.2 * sc, 0, Math.PI * 2);
      ctx.fill();
      btx.fillStyle =
        i % 2 === 0 ? "rgba(146,146,146,0.38)" : "rgba(112,112,112,0.38)";
      btx.beginPath();
      btx.arc(hx, hy, 4.6 * sc, 0, Math.PI * 2);
      btx.fill();
      rtx.fillStyle =
        i % 2 === 0 ? "rgba(128,128,128,0.28)" : "rgba(58,58,58,0.28)";
      rtx.beginPath();
      rtx.arc(hx, hy, 4.8 * sc, 0, Math.PI * 2);
      rtx.fill();
    }

    // Outer & inner beveled metallic filigree border
    ctx.strokeStyle = "#" + trimCol.getHexString();
    ctx.lineWidth = 6 * sc;
    ctx.strokeRect(10 * sc, 10 * sc, size - 20 * sc, size - 20 * sc);
    btx.strokeStyle = "#ececec";
    btx.lineWidth = 6 * sc;
    btx.strokeRect(10 * sc, 10 * sc, size - 20 * sc, size - 20 * sc);
    rtx.strokeStyle = "#262626";
    rtx.lineWidth = 6 * sc;
    rtx.strokeRect(10 * sc, 10 * sc, size - 20 * sc, size - 20 * sc);
    mtx.strokeStyle = "#f8f8f8";
    mtx.lineWidth = 6 * sc;
    mtx.strokeRect(10 * sc, 10 * sc, size - 20 * sc, size - 20 * sc);

    ctx.strokeStyle = "#" + hiCol.getHexString();
    ctx.lineWidth = 2 * sc;
    ctx.strokeRect(18 * sc, 18 * sc, size - 36 * sc, size - 36 * sc);
    btx.strokeStyle = "#cccccc";
    btx.lineWidth = 2 * sc;
    btx.strokeRect(18 * sc, 18 * sc, size - 36 * sc, size - 36 * sc);
    rtx.strokeStyle = "#343434";
    rtx.lineWidth = 2 * sc;
    rtx.strokeRect(18 * sc, 18 * sc, size - 36 * sc, size - 36 * sc);
    mtx.strokeStyle = "#ececec";
    mtx.lineWidth = 2 * sc;
    mtx.strokeRect(18 * sc, 18 * sc, size - 36 * sc, size - 36 * sc);

    // Corner armor rivets
    [22 * sc, size - 22 * sc].forEach((rx) => {
      [22 * sc, size - 22 * sc].forEach((ry) => {
        ctx.fillStyle = "#" + trimCol.getHexString();
        btx.fillStyle = "#ffffff";
        rtx.fillStyle = "#202020";
        mtx.fillStyle = "#ffffff";
        [ctx, btx, rtx, mtx].forEach((g) => {
          g.beginPath();
          g.arc(rx, ry, 3.6 * sc, 0, Math.PI * 2);
          g.fill();
        });
      });
    });

    // Ornate diamond filigree motifs
    ctx.fillStyle = "#" + trimCol.getHexString();
    btx.fillStyle = "#ffffff";
    rtx.fillStyle = "#222222";
    mtx.fillStyle = "#ffffff";
    [64 * sc, 192 * sc].forEach((cx) => {
      [64 * sc, 192 * sc].forEach((cy) => {
        [ctx, btx, rtx, mtx].forEach((g) => {
          g.beginPath();
          g.moveTo(cx, cy - 14 * sc);
          g.lineTo(cx + 10 * sc, cy);
          g.lineTo(cx, cy + 14 * sc);
          g.lineTo(cx - 10 * sc, cy);
          g.closePath();
          g.fill();
        });
      });
    });
  } else if (patternType === "scale") {
    // Overlapping dragon/ranger scales with metallic edge trim & matte leather scale body
    const rows = isUltraMax ? 16 : 12;
    const stepY = size / rows;
    const stepX = stepY * 1.45;
    for (let row = 0; row <= rows; row++) {
      const y = row * stepY;
      const shift = (row % 2) * (stepX * 0.5);
      for (let col = -1; col < 14; col++) {
        const x = col * stepX + shift;
        ctx.fillStyle =
          row % 2 === 0
            ? "#" + baseCol.getHexString()
            : "#" + darkCol.getHexString();
        ctx.beginPath();
        ctx.arc(x, y, stepX * 0.52, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#" + trimCol.getHexString();
        ctx.lineWidth = (isUltraMax ? 1.8 : 1.5) * sc;
        ctx.stroke();

        btx.fillStyle = row % 2 === 0 ? "#c8c8c8" : "#a4a4a4";
        btx.beginPath();
        btx.arc(x, y, stepX * 0.48, 0, Math.PI);
        btx.fill();

        rtx.fillStyle = row % 2 === 0 ? "#888888" : "#9c9c9c";
        rtx.beginPath();
        rtx.arc(x, y, stepX * 0.48, 0, Math.PI);
        rtx.fill();
        rtx.strokeStyle = "#343434";
        rtx.lineWidth = 2.0 * sc;
        rtx.stroke();

        mtx.strokeStyle = "#c8c8c8";
        mtx.lineWidth = 2.0 * sc;
        mtx.beginPath();
        mtx.arc(x, y, stepX * 0.5, 0, Math.PI);
        mtx.stroke();
      }
    }
  } else {
    // Matte woven royal fabric with metallic gold/silver brocade trim hem
    const threadCount = isUltraMax ? 1600 : 800;
    for (let i = 0; i < threadCount; i++) {
      const tx = (i * 47.3) % size;
      const ty = (i * 89.1) % size;
      ctx.fillStyle =
        i % 2 === 0 ? "rgba(255,255,255,0.038)" : "rgba(0,0,0,0.075)";
      ctx.fillRect(tx, ty, 2.5 * sc, 11 * sc);
      btx.fillStyle =
        i % 2 === 0 ? "rgba(155,155,155,0.35)" : "rgba(105,105,105,0.35)";
      btx.fillRect(tx, ty, 2.5 * sc, 10 * sc);
      rtx.fillStyle = i % 2 === 0 ? "#ededed" : "#d2d2d2";
      rtx.fillRect(tx, ty, 2.5 * sc, 10 * sc);
    }
    // Metallic embroidered brocade hem
    ctx.fillStyle = "#" + trimCol.getHexString();
    ctx.fillRect(0, size - 22 * sc, size, 14 * sc);
    btx.fillStyle = "#e6e6e6";
    btx.fillRect(0, size - 22 * sc, size, 14 * sc);
    rtx.fillStyle = "#303030";
    rtx.fillRect(0, size - 22 * sc, size, 14 * sc);
    mtx.fillStyle = "#eaeaea";
    mtx.fillRect(0, size - 22 * sc, size, 14 * sc);
  }

  const map = registerSharedAsset(new THREE.CanvasTexture(cMap));
  const bumpMap = registerSharedAsset(new THREE.CanvasTexture(cBump));
  const roughnessMap = registerSharedAsset(
    new THREE.CanvasTexture(cRough),
  );
  const metalnessMap = registerSharedAsset(
    new THREE.CanvasTexture(cMetal),
  );
  map.colorSpace = THREE.SRGBColorSpace;
  [map, bumpMap, roughnessMap, metalnessMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });
  const res = { map, bumpMap, roughnessMap, metalnessMap };
  _heroMatSetCache.set(cacheKey, res);
  return res;
}

function makeHeroPBRMaterial(texSet, opts = {}) {
  return new THREE.MeshStandardMaterial({
    map: texSet.map,
    bumpMap: texSet.bumpMap,
    roughnessMap: texSet.roughnessMap,
    metalnessMap: texSet.metalnessMap,
    bumpScale: opts.bumpScale ?? 0.09,
    roughness: opts.roughness ?? 1.0,
    metalness: opts.metalness ?? 1.0,
    side: opts.side ?? THREE.FrontSide,
  });
}

// Procedural Longitudinal Hair-Strand Texture Generator (eliminates smooth plastic hair tubes)
const _hairTexCache = new Map();
function createHairStrandTextureSet(hairHex) {
  if (_hairTexCache.has(hairHex)) return _hairTexCache.get(hairHex);
  const size = 256;
  const cMap = document.createElement("canvas");
  const cBump = document.createElement("canvas");
  const cRough = document.createElement("canvas");
  cMap.width = cBump.width = cRough.width = size;
  cMap.height = cBump.height = cRough.height = size;
  const ctx = cMap.getContext("2d");
  const btx = cBump.getContext("2d");
  const rtx = cRough.getContext("2d");

  const base = new THREE.Color(hairHex);
  const dark = base.clone().multiplyScalar(0.58);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.24);

  ctx.fillStyle = "#" + base.getHexString();
  ctx.fillRect(0, 0, size, size);
  btx.fillStyle = "#808080";
  btx.fillRect(0, 0, size, size);
  rtx.fillStyle = "#9a9a9a";
  rtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 420; i++) {
    const x = (i * 19.7) % size;
    const w = 1.2 + (i % 3) * 0.7;
    const mode = i % 3;
    ctx.fillStyle =
      mode === 0
        ? "#" + light.getHexString()
        : mode === 1
          ? "#" + dark.getHexString()
          : "#" + base.getHexString();
    ctx.globalAlpha = 0.42;
    ctx.fillRect(x, 0, w, size);

    btx.fillStyle =
      mode === 0 ? "#b8b8b8" : mode === 1 ? "#4c4c4c" : "#808080";
    btx.globalAlpha = 0.55;
    btx.fillRect(x, 0, w, size);

    rtx.fillStyle =
      mode === 0 ? "#747474" : mode === 1 ? "#c8c8c8" : "#969696";
    rtx.globalAlpha = 0.55;
    rtx.fillRect(x, 0, w, size);
  }
  ctx.globalAlpha = btx.globalAlpha = rtx.globalAlpha = 1.0;

  const map = registerSharedAsset(new THREE.CanvasTexture(cMap));
  const bumpMap = registerSharedAsset(new THREE.CanvasTexture(cBump));
  const roughnessMap = registerSharedAsset(
    new THREE.CanvasTexture(cRough),
  );
  map.colorSpace = THREE.SRGBColorSpace;
  [map, bumpMap, roughnessMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
  });
  const out = { map, bumpMap, roughnessMap };
  _hairTexCache.set(hairHex, out);
  return out;
}

const _irisTexCache = new Map();
function createAAAStylizedIrisTexture(irisHex) {
  if (_irisTexCache.has(irisHex)) return _irisTexCache.get(irisHex);
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  const baseCol = new THREE.Color(irisHex);
  const darkRim = baseCol.clone().multiplyScalar(0.25);
  const innerGlow = baseCol.clone().lerp(new THREE.Color(0xffffff), 0.45);

  const grad = ctx.createRadialGradient(64, 68, 12, 64, 64, 58);
  grad.addColorStop(0.0, "#" + innerGlow.getHexString());
  grad.addColorStop(0.42, "#" + baseCol.getHexString());
  grad.addColorStop(
    0.84,
    "#" + baseCol.clone().multiplyScalar(0.68).getHexString(),
  );
  grad.addColorStop(1.0, "#" + darkRim.getHexString());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  ctx.save();
  ctx.translate(64, 64);
  for (let i = 0; i < 36; i++) {
    ctx.rotate((Math.PI * 2) / 36);
    ctx.strokeStyle =
      i % 2 === 0 ? "rgba(255,255,255,0.28)" : "rgba(10,15,30,0.24)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(52, 0);
    ctx.stroke();
  }
  ctx.restore();

  const tex = registerSharedAsset(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  _irisTexCache.set(irisHex, tex);
  return tex;
}

// Exact Planar-Projected Facial Complexion Texture Tailored to All 16 Champions
const _faceTexCache = new Map();
function createPlanarFaceTexture(skinHex, style) {
  const isUltraMax =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  const fKey = `${skinHex}_${style}_${isUltraMax ? "umax" : "std"}_v136`;
  if (_faceTexCache.has(fKey)) return _faceTexCache.get(fKey);
  const size = isUltraMax ? 512 : 256;
  const sc = size / 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");

  const skin = new THREE.Color(skinHex);
  const isDarkAbyssal = ["malakor", "dravenor", "terrakor"].includes(
    style,
  );
  const warmShadow = skin
    .clone()
    .lerp(new THREE.Color(isDarkAbyssal ? 0x581c87 : 0x9a3412), 0.22);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, size);
  bgGrad.addColorStop(
    0.0,
    "#" +
      skin.clone().lerp(new THREE.Color(0xffffff), 0.09).getHexString(),
  );
  bgGrad.addColorStop(0.55, "#" + skin.getHexString());
  bgGrad.addColorStop(1.0, "#" + warmShadow.getHexString());
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  const toU = (x) => (x / 0.64 + 0.5) * size;
  const toV = (y) => (1.0 - (y + 0.04) / 0.66) * size;

  // Soft cheekbone blush & warmth
  const blushRgb = isDarkAbyssal
    ? "168, 85, 247"
    : style === "thalindor" || style === "nyxia"
      ? "45, 212, 191"
      : "232, 92, 92";
  [-0.14, 0.14].forEach((cx) => {
    const ux = toU(cx),
      uy = toV(0.21);
    const g = ctx.createRadialGradient(ux, uy, 2 * sc, ux, uy, 26 * sc);
    g.addColorStop(0, `rgba(${blushRgb}, 0.24)`);
    g.addColorStop(1, `rgba(${blushRgb}, 0.0)`);
    ctx.fillStyle = g;
    ctx.fillRect(ux - 28 * sc, uy - 28 * sc, 56 * sc, 56 * sc);
  });

  // Soft orbital eye shadow & upper lash liner contour
  [-0.105, 0.105].forEach((ex) => {
    const ux = toU(ex),
      uy = toV(0.295);
    const g = ctx.createRadialGradient(ux, uy, 3 * sc, ux, uy, 20 * sc);
    g.addColorStop(0, "rgba(30, 18, 36, 0.30)");
    g.addColorStop(1, "rgba(30, 18, 36, 0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(ux - 22 * sc, uy - 22 * sc, 44 * sc, 44 * sc);
  });

  // Nose bridge highlight & tip blush
  const nx = toU(0),
    ny = toV(0.205);
  const ng = ctx.createRadialGradient(nx, ny, 1 * sc, nx, ny, 14 * sc);
  ng.addColorStop(0, `rgba(${blushRgb}, 0.22)`);
  ng.addColorStop(1, `rgba(${blushRgb}, 0.0)`);
  ctx.fillStyle = ng;
  ctx.fillRect(nx - 16 * sc, ny - 16 * sc, 32 * sc, 32 * sc);

  // Luminous nose bridge specular
  const bridgeGrad = ctx.createLinearGradient(
    nx,
    toV(0.32),
    nx,
    toV(0.16),
  );
  bridgeGrad.addColorStop(0, "rgba(255,255,255,0.0)");
  bridgeGrad.addColorStop(0.55, "rgba(255,255,255,0.20)");
  bridgeGrad.addColorStop(1, "rgba(255,255,255,0.0)");
  ctx.fillStyle = bridgeGrad;
  ctx.fillRect(nx - 4 * sc, toV(0.32), 8 * sc, 60 * sc);

  // Hero-specific facial war-paint, arcane runes, and markings
  const markMap = {
    ignis: "rgba(249, 115, 22, 0.44)",
    sylphira: "rgba(56, 189, 248, 0.42)",
    malakor: "rgba(52, 211, 153, 0.44)",
    zephyros: "rgba(56, 189, 248, 0.44)",
    vespera: "rgba(217, 70, 239, 0.44)",
    terrakor: "rgba(52, 211, 153, 0.48)",
    aurelia: "rgba(250, 204, 21, 0.40)",
    kaelthar: "rgba(34, 211, 238, 0.42)",
    valkyra: "rgba(225, 29, 72, 0.56)",
    dravenor: "rgba(168, 85, 247, 0.46)",
    nyxia: "rgba(132, 204, 22, 0.44)",
    thalindor: "rgba(6, 182, 212, 0.44)",
    solenne: "rgba(244, 114, 182, 0.42)",
    seraphina: "rgba(45, 212, 191, 0.42)",
  };
  if (markMap[style]) {
    ctx.strokeStyle = markMap[style];
    ctx.lineWidth = (style === "valkyra" ? 3.2 : 2.0) * sc;
    [-1, 1].forEach((side) => {
      const mx = toU(side * 0.165);
      const my = toV(0.235);
      ctx.beginPath();
      if (style === "valkyra") {
        ctx.moveTo(mx - side * 12 * sc, my - 4 * sc);
        ctx.lineTo(mx + side * 14 * sc, my + 8 * sc);
      } else {
        ctx.moveTo(mx, my - 10 * sc);
        ctx.lineTo(mx + side * 8 * sc, my);
        ctx.lineTo(mx, my + 12 * sc);
      }
      ctx.stroke();
    });
  }

  if (style !== "aurelius" && style !== "garrick") {
    const lx = toU(0),
      ly = toV(0.115);
    const isFemFace = [
      "ignis",
      "sylphira",
      "vespera",
      "aurelia",
      "valkyra",
      "nyxia",
      "solenne",
      "seraphina",
    ].includes(style);
    const lipFill =
      style === "ignis" || style === "valkyra"
        ? "rgba(190, 24, 60, 0.78)"
        : style === "sylphira" || style === "aurelia"
          ? "rgba(219, 82, 128, 0.66)"
          : style === "solenne" || style === "seraphina"
            ? "rgba(236, 72, 153, 0.64)"
            : isFemFace
              ? "rgba(162, 28, 175, 0.68)"
              : "rgba(95, 65, 75, 0.45)";
    ctx.fillStyle = lipFill;
    ctx.beginPath();
    ctx.moveTo(lx - 18 * sc, ly);
    ctx.quadraticCurveTo(lx - 7 * sc, ly - 6 * sc, lx, ly - 3 * sc);
    ctx.quadraticCurveTo(lx + 7 * sc, ly - 6 * sc, lx + 18 * sc, ly);
    ctx.quadraticCurveTo(lx, ly + 8 * sc, lx - 18 * sc, ly);
    ctx.fill();

    ctx.strokeStyle = "rgba(35, 12, 20, 0.50)";
    ctx.lineWidth = 1.5 * sc;
    ctx.beginPath();
    ctx.moveTo(lx - 17 * sc, ly);
    ctx.quadraticCurveTo(lx, ly + 1.5 * sc, lx + 17 * sc, ly);
    ctx.stroke();
  }

  const tex = registerSharedAsset(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  _faceTexCache.set(fKey, tex);
  return tex;
}

function buildRefinedHeroFace(skinHex, irisHex, hairHex, style) {
  const isUltraMax =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  const headGroup = new THREE.Group();
  const isFeminine = [
    "ignis",
    "sylphira",
    "vespera",
    "aurelia",
    "valkyra",
    "nyxia",
    "solenne",
    "seraphina",
  ].includes(style);
  const sssColor = new THREE.Color(
    ["malakor", "dravenor", "vespera"].includes(style)
      ? 0xc084fc
      : style === "terrakor"
        ? 0x34d399
        : 0xff8a75,
  );

  const faceTex = createPlanarFaceTexture(skinHex, style);
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: faceTex,
    roughness:
      style === "terrakor" ? 0.84 : style === "solenne" ? 0.34 : 0.64,
    metalness: style === "solenne" ? 0.25 : 0.01,
    sheen: style === "terrakor" ? 0.0 : isUltraMax ? 0.42 : 0.28,
    sheenRoughness: 0.65,
    sheenColor: sssColor,
  });
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: skinHex,
    roughness:
      style === "terrakor" ? 0.84 : style === "solenne" ? 0.34 : 0.64,
    metalness: style === "solenne" ? 0.25 : 0.01,
    sheen: style === "terrakor" ? 0.0 : isUltraMax ? 0.42 : 0.28,
    sheenRoughness: 0.65,
    sheenColor: sssColor,
  });
  const hairTex = createHairStrandTextureSet(hairHex);
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: hairTex.map,
    bumpMap: hairTex.bumpMap,
    roughnessMap: hairTex.roughnessMap,
    bumpScale: 0.045,
    roughness: 0.72,
    metalness: 0.03,
  });

  const wScale = isFeminine
    ? 0.88
    : style === "garrick" || style === "terrakor"
      ? 1.04
      : 0.96;
  const headStations = [
    { y: -0.02, rx: 0.04 * wScale, rz: 0.05, zOff: 0.08 },
    { y: 0.03, rx: 0.11 * wScale, rz: 0.15, zOff: 0.07 },
    { y: 0.1, rx: 0.19 * wScale, rz: 0.23, zOff: 0.04 },
    { y: 0.19, rx: 0.25 * wScale, rz: 0.28, zOff: 0.02, h2: 0.03 },
    { y: 0.28, rx: 0.28 * wScale, rz: 0.31, zOff: 0.0, h2: 0.02 },
    { y: 0.38, rx: 0.29 * wScale, rz: 0.32, zOff: -0.01 },
    { y: 0.48, rx: 0.26 * wScale, rz: 0.29, zOff: -0.02 },
    { y: 0.56, rx: 0.18 * wScale, rz: 0.2, zOff: -0.02 },
    { y: 0.61, rx: 0.03 * wScale, rz: 0.03, zOff: -0.02 },
  ];
  const cranium = buildLoftedMesh(
    headStations,
    isUltraMax ? 48 : 36,
    faceMat,
    { archFront: 0.022, archBack: 0.03 },
  );

  const cPos = cranium.geometry.attributes.position;
  const cUv = cranium.geometry.attributes.uv;
  for (let i = 0; i < cPos.count; i++) {
    const vx = cPos.getX(i);
    const vy = cPos.getY(i);
    const vz = cPos.getZ(i);
    if (vz > 0) {
      const u = THREE.MathUtils.clamp(vx / 0.64 + 0.5, 0.02, 0.98);
      const v = THREE.MathUtils.clamp((vy + 0.04) / 0.66, 0.02, 0.98);
      cUv.setXY(i, u, v);
    } else {
      cUv.setXY(i, 0.04, 0.85);
    }
  }
  cUv.needsUpdate = true;
  headGroup.add(cranium);

  const neckStations = [
    {
      y: -0.22,
      rx: isFeminine ? 0.145 : 0.175,
      rz: isFeminine ? 0.14 : 0.17,
      zOff: -0.03,
    },
    {
      y: -0.1,
      rx: isFeminine ? 0.125 : 0.155,
      rz: isFeminine ? 0.125 : 0.155,
      zOff: -0.025,
    },
    {
      y: 0.04,
      rx: isFeminine ? 0.12 : 0.148,
      rz: isFeminine ? 0.12 : 0.148,
      zOff: -0.015,
    },
  ];
  headGroup.add(
    buildLoftedMesh(neckStations, isUltraMax ? 32 : 24, skinMat),
  );

  const noseStations = [
    {
      y: 0.185,
      rx: style === "garrick" ? 0.034 : 0.026,
      rz: style === "garrick" ? 0.04 : 0.032,
      zOff: 0.316,
    },
    {
      y: 0.215,
      rx: style === "garrick" ? 0.028 : 0.022,
      rz: style === "garrick" ? 0.036 : 0.03,
      zOff: 0.324,
    },
    { y: 0.265, rx: 0.016, rz: 0.02, zOff: 0.316 },
    { y: 0.315, rx: 0.014, rz: 0.014, zOff: 0.304 },
  ];
  headGroup.add(
    buildLoftedMesh(noseStations, isUltraMax ? 24 : 16, skinMat),
  );

  // Sculpted 3D nostril wings & nasal tip
  const noseTip = new THREE.Mesh(
    new THREE.SphereGeometry(style === "garrick" ? 0.026 : 0.02, 12, 10),
    skinMat,
  );
  noseTip.position.set(0, 0.205, 0.335);
  headGroup.add(noseTip);
  [-0.022, 0.022].forEach((nxOff) => {
    const wing = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 10, 8),
      skinMat,
    );
    wing.scale.set(1.1, 0.85, 0.9);
    wing.position.set(nxOff, 0.194, 0.324);
    headGroup.add(wing);
  });

  // Only Sylvan & Shadow champions have elven ears; human/celestial champions have proper ears!
  const isElven = ["sylphira", "nyxia", "malakor"].includes(style);
  [-1, 1].forEach((side) => {
    const earX = side * (isFeminine ? 0.255 : 0.275);
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 12, 12),
      skinMat,
    );
    ear.scale.set(0.36, 1.35, 0.72);
    ear.position.set(earX, 0.26, -0.01);
    ear.rotation.y = side * -0.25;
    headGroup.add(ear);

    if (isElven) {
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.025, 0.13, 8),
        skinMat,
      );
      tip.position.set(earX + side * 0.035, 0.32, -0.04);
      tip.rotation.z = side * -0.75;
      tip.rotation.x = -0.35;
      headGroup.add(tip);
      if (style === "sylphira" || style === "nyxia") {
        const cuffCol = style === "sylphira" ? 0x38bdf8 : 0x84cc16;
        const cuff = new THREE.Mesh(
          new THREE.TorusGeometry(0.026, 0.007, 6, 12),
          new THREE.MeshStandardMaterial({
            color: cuffCol,
            emissive: cuffCol,
            emissiveIntensity: 1.2,
            roughness: 0.25,
          }),
        );
        cuff.position.set(earX + side * 0.02, 0.29, -0.025);
        cuff.rotation.y = Math.PI / 2;
        headGroup.add(cuff);
      }
    } else if (style === "thalindor") {
      // Aquatic Leviathan gill-fin cheek crests
      const gillFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.2, 4),
        new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          emissive: 0x0891b2,
          emissiveIntensity: 0.9,
          roughness: 0.3,
        }),
      );
      gillFin.scale.set(0.4, 1.0, 1.3);
      gillFin.position.set(earX + side * 0.03, 0.27, -0.04);
      gillFin.rotation.set(-0.35, side * 0.25, -side * 0.55);
      headGroup.add(gillFin);
    }
  });

  const irisTex = createAAAStylizedIrisTexture(irisHex);
  const scleraMat = new THREE.MeshStandardMaterial({
    color: ["malakor", "dravenor"].includes(style)
      ? 0x1e1b4b
      : style === "terrakor"
        ? 0x064e3b
        : 0xf8fafc,
    roughness: 0.14,
    metalness: 0.02,
  });
  const irisMat = new THREE.MeshBasicMaterial({ map: irisTex });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const browMat = new THREE.MeshStandardMaterial({
    color: hairHex,
    roughness: 0.72,
    metalness: 0.02,
  });
  const lashMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.65,
    metalness: 0.02,
  });
  const corneaMat = isUltraMax
    ? new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.16,
        roughness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
      })
    : null;

  [-0.105, 0.105].forEach((sideX) => {
    const eyeGrp = new THREE.Group();

    const sclera = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 18, 14),
      scleraMat,
    );
    sclera.scale.set(1.24, 0.8, 0.62);
    eyeGrp.add(sclera);

    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 12),
      irisMat,
    );
    iris.scale.set(1.0, 1.0, 0.42);
    iris.position.z = 0.024;
    eyeGrp.add(iris);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 12, 10),
      pupilMat,
    );
    pupil.scale.set(1.0, 1.0, 0.42);
    pupil.position.z = 0.033;
    eyeGrp.add(pupil);

    const glint1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.0075, 8, 8),
      catchMat,
    );
    glint1.position.set(0.01, 0.01, 0.037);
    eyeGrp.add(glint1);

    const glint2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.004, 6, 6),
      catchMat,
    );
    glint2.position.set(-0.008, -0.007, 0.037);
    eyeGrp.add(glint2);

    if (corneaMat) {
      const cornea = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 16, 12),
        corneaMat,
      );
      cornea.scale.set(1.24, 0.82, 0.72);
      cornea.position.z = 0.004;
      eyeGrp.add(cornea);
    }

    const upperLash = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.008, 8, 20, Math.PI * 0.88),
      isFeminine ? lashMat : browMat,
    );
    upperLash.scale.set(1.22, 0.84, 0.7);
    upperLash.rotation.z = Math.PI * 0.06;
    upperLash.position.z = 0.012;
    eyeGrp.add(upperLash);

    if (isFeminine) {
      const dirSign = sideX < 0 ? -1 : 1;
      [0.016, 0.026].forEach((off, li) => {
        const lashTuft = new THREE.Mesh(
          new THREE.ConeGeometry(0.0045, 0.024, 5),
          lashMat,
        );
        lashTuft.position.set(
          dirSign * (0.048 + off * 0.35),
          0.012 - li * 0.005,
          0.014,
        );
        lashTuft.rotation.z = -dirSign * (0.85 + li * 0.22);
        eyeGrp.add(lashTuft);
      });
    }

    const eyelid = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.051,
        14,
        10,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.52,
      ),
      skinMat,
    );
    eyelid.scale.set(1.25, 0.82, 0.68);
    eyelid.rotation.x = -Math.PI * 0.48;
    eyeGrp.add(eyelid);
    if (!headGroup.userData.eyelids) headGroup.userData.eyelids = [];
    headGroup.userData.eyelids.push(eyelid);

    eyeGrp.position.set(sideX, 0.295, 0.297);
    eyeGrp.rotation.y = sideX < 0 ? -0.18 : 0.18;
    headGroup.add(eyeGrp);

    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sideX * 0.56, 0.342, 0.326),
      new THREE.Vector3(sideX * 1.04, 0.358, 0.314),
      new THREE.Vector3(sideX * 1.48, 0.346, 0.284),
    ]);
    headGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          browCurve,
          12,
          isFeminine ? 0.009 : 0.014,
          6,
          false,
        ),
        browMat,
      ),
    );
  });

  // Bespoke Facial Hair & Signature Head/Face Gear per Champion
  if (style === "aurelius") {
    const beardStations = [
      { y: -0.02, rx: 0.07, rz: 0.08, zOff: 0.14 },
      { y: 0.05, rx: 0.17, rz: 0.18, zOff: 0.1 },
      { y: 0.13, rx: 0.23, rz: 0.22, zOff: 0.06 },
    ];
    headGroup.add(
      buildLoftedMesh(beardStations, 24, hairMat, { archFront: 0.028 }),
    );

    [-1, 1].forEach((side) => {
      const stache = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.142, 0.305),
        new THREE.Vector3(side * 0.05, 0.132, 0.298),
        new THREE.Vector3(side * 0.092, 0.102, 0.272),
      ]);
      headGroup.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(stache, 10, 0.015, 6, false),
          hairMat,
        ),
      );
    });
  } else if (style === "garrick") {
    // Full Braided Dwarven Beard with Twin Brass Rings + Forehead Forgemaster Goggles
    const dwarfBeardStations = [
      { y: -0.14, rx: 0.09, rz: 0.09, zOff: 0.18 },
      { y: -0.02, rx: 0.18, rz: 0.18, zOff: 0.14 },
      { y: 0.08, rx: 0.24, rz: 0.22, zOff: 0.09 },
      { y: 0.15, rx: 0.25, rz: 0.22, zOff: 0.05 },
    ];
    headGroup.add(
      buildLoftedMesh(dwarfBeardStations, 24, hairMat, {
        archFront: 0.035,
      }),
    );

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.88,
      roughness: 0.24,
    });
    [-0.08, 0.08].forEach((bx) => {
      const braidCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(bx, 0.12, 0.29),
        new THREE.Vector3(bx * 1.15, -0.04, 0.28),
        new THREE.Vector3(bx * 1.1, -0.2, 0.24),
      ]);
      headGroup.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(braidCurve, 12, 0.028, 8, false),
          hairMat,
        ),
      );
      const claspRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.032, 0.009, 6, 14),
        brassMat,
      );
      claspRing.rotation.x = Math.PI / 2;
      claspRing.position.set(bx * 1.12, -0.12, 0.26);
      headGroup.add(claspRing);
    });

    // Forehead Blast-Goggles
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xea580c,
      emissiveIntensity: 0.9,
      roughness: 0.18,
      metalness: 0.3,
    });
    [-0.095, 0.095].forEach((gx) => {
      const frame = new THREE.Mesh(
        new THREE.CylinderGeometry(0.054, 0.054, 0.034, 16),
        brassMat,
      );
      frame.rotation.x = Math.PI / 2;
      frame.position.set(gx, 0.41, 0.265);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.038, 16),
        lensMat,
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.copy(frame.position);
      headGroup.add(frame, lens);
    });
  } else {
    const lipCol = ["ignis", "valkyra"].includes(style)
      ? 0xbe123c
      : ["sylphira", "aurelia", "solenne"].includes(style)
        ? 0xdb2777
        : isFeminine
          ? 0x9d174d
          : 0x7c5862;
    const lipMat = new THREE.MeshStandardMaterial({
      color: lipCol,
      roughness: 0.44,
      metalness: 0.02,
    });
    const upperLip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.011, 0.065, 4, 8),
      lipMat,
    );
    upperLip.rotation.z = Math.PI / 2;
    upperLip.position.set(0, 0.122, 0.304);
    headGroup.add(upperLip);

    const lowerLip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.011, 0.052, 4, 8),
      lipMat,
    );
    lowerLip.rotation.z = Math.PI / 2;
    lowerLip.position.set(0, 0.105, 0.299);
    headGroup.add(lowerLip);
  }

  // Signature Facial Accessories (Blindfold, Shadow Veil, Horologist Monocle, Stone Brow)
  if (style === "seraphina") {
    // Blindfolded Twin-Moon Oracle Silk Band + Crescent Brow Gem
    const blindfoldMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      roughness: 0.76,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    const trimGold = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      metalness: 0.88,
      roughness: 0.22,
    });
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.268, 0.268, 0.088, 28, 1, true),
      blindfoldMat,
    );
    band.position.set(0, 0.296, 0.018);
    const topTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.269, 0.008, 6, 28),
      trimGold,
    );
    topTrim.rotation.x = Math.PI / 2;
    topTrim.position.set(0, 0.338, 0.018);
    const botTrim = topTrim.clone();
    botTrim.position.y = 0.254;
    headGroup.add(band, topTrim, botTrim);
  } else if (style === "vespera") {
    // Lower-Face Void Assassin Veil Mask
    const maskMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.72,
      metalness: 0.15,
    });
    const maskStations = [
      { y: 0.01, rx: 0.13, rz: 0.16, zOff: 0.09 },
      { y: 0.09, rx: 0.2, rz: 0.24, zOff: 0.05 },
      { y: 0.18, rx: 0.24, rz: 0.28, zOff: 0.03 },
    ];
    headGroup.add(
      buildLoftedMesh(maskStations, 22, maskMat, { archFront: 0.025 }),
    );
  } else if (style === "kaelthar") {
    // Golden Horologist Monocle Lens over Right Eye
    const monoFrame = new THREE.Mesh(
      new THREE.TorusGeometry(0.058, 0.009, 8, 20),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.9,
        roughness: 0.2,
      }),
    );
    monoFrame.position.set(0.108, 0.296, 0.328);
    monoFrame.rotation.y = 0.18;
    const monoGlass = new THREE.Mesh(
      new THREE.CircleGeometry(0.052, 18),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    monoGlass.position.copy(monoFrame.position);
    monoGlass.rotation.y = 0.18;
    headGroup.add(monoFrame, monoGlass);
  } else if (style === "terrakor") {
    // Craggy Carved Stone Brow Ridge
    const stoneBrow = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.065, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x064e3b,
        roughness: 0.86,
        metalness: 0.15,
      }),
    );
    stoneBrow.position.set(0, 0.352, 0.275);
    headGroup.add(stoneBrow);
  }

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.312,
      isUltraMax ? 40 : 32,
      isUltraMax ? 30 : 24,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.66,
    ),
    hairMat,
  );
  hairCap.scale.set(wScale * 1.03, 1.06, 1.09);
  hairCap.position.set(0, 0.33, -0.035);
  hairCap.rotation.x = -0.32;
  headGroup.add(hairCap);

  const centerLockCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.56, 0.12),
    new THREE.Vector3(0.02, 0.5, 0.25),
    new THREE.Vector3(0.05, 0.41, 0.28),
  ]);
  headGroup.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(
        centerLockCurve,
        12,
        isFeminine ? 0.024 : 0.028,
        8,
        false,
      ),
      hairMat,
    ),
  );

  [-1, 1].forEach((side) => {
    const fringeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.03, 0.54, 0.19),
      new THREE.Vector3(side * 0.18, 0.46, 0.22),
      new THREE.Vector3(side * 0.27, 0.3, 0.14),
      new THREE.Vector3(side * 0.25, isFeminine ? 0.02 : 0.15, 0.06),
    ]);
    headGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          fringeCurve,
          18,
          isFeminine ? 0.038 : 0.032,
          8,
          false,
        ),
        hairMat,
      ),
    );

    const wispCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.11, 0.52, 0.14),
      new THREE.Vector3(side * 0.24, 0.38, 0.12),
      new THREE.Vector3(side * 0.29, 0.18, 0.0),
      new THREE.Vector3(side * 0.26, isFeminine ? -0.08 : 0.08, -0.08),
    ]);
    headGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          wispCurve,
          16,
          isFeminine ? 0.026 : 0.022,
          8,
          false,
        ),
        hairMat,
      ),
    );
  });

  const backHairGroup = new THREE.Group();
  headGroup.add(backHairGroup);
  headGroup.userData.backHairGroup = backHairGroup;
  const tressOffsets = isUltraMax
    ? [-0.24, -0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18, 0.24]
    : [-0.21, -0.14, -0.07, 0, 0.07, 0.14, 0.21];
  tressOffsets.forEach((hx, idx) => {
    const drop = isFeminine
      ? 0.62
      : ["malakor", "kaelthar", "zephyros"].includes(style)
        ? 0.48
        : 0.22;
    const tressCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx * 0.85, 0.44, -0.22),
      new THREE.Vector3(hx * 1.05, 0.24, -0.32 - (idx % 2) * 0.02),
      new THREE.Vector3(
        hx * 1.15,
        0.22 - drop * 0.55,
        -0.36 - (idx % 2) * 0.03,
      ),
      new THREE.Vector3(hx * 1.02, 0.2 - drop, -0.33),
    ]);
    const tress = new THREE.Mesh(
      new THREE.TubeGeometry(
        tressCurve,
        isUltraMax ? 20 : 16,
        isFeminine ? 0.044 : 0.04,
        8,
        false,
      ),
      hairMat,
    );
    backHairGroup.add(tress);
  });

  return headGroup;
}

function attachHeroSignatureArmor(ctx) {
  const {
    hid,
    isFem,
    isDjinn,
    isCentaur,
    isDwarf,
    isGolem,
    isLeviathan,
    isCrystal,
    torso,
    neckPivot,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    capePivot,
    coreMat,
    trimMat,
    goldTrimMat,
    silverTrimMat,
    obsidianMat,
    bootMat,
  } = ctx;

  const heroCfgObj =
    typeof HERO_ROSTER !== "undefined" && HERO_ROSTER[hid]
      ? HERO_ROSTER[hid]
      : null;
  const wMult = isGolem
    ? 1.24
    : isDwarf || isLeviathan || hid === "malakor"
      ? 1.16
      : isFem
        ? 0.84
        : 1.0;
  const dMult = isGolem
    ? 1.2
    : isDwarf || isLeviathan
      ? 1.14
      : isFem
        ? 0.84
        : 1.0;

  // 1. Sculpted Gorget Collar & Twin Cloak Clasp Medallions + Draped Chest Chain
  if (!isGolem && !isLeviathan && !isCrystal) {
    const gorget = new THREE.Mesh(
      new THREE.TorusGeometry(0.31 * wMult, 0.038, 10, 28),
      trimMat,
    );
    gorget.rotation.x = Math.PI * 0.46;
    gorget.position.set(0, 1.5, 0.01);
    torso.add(gorget);

    if (hid !== "aurelius" && hid !== "garrick") {
      [-1, 1].forEach((side) => {
        const clasp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.075, 0.085, 0.036, 12),
          trimMat,
        );
        clasp.rotation.x = Math.PI / 2;
        clasp.position.set(side * 0.31 * wMult, 1.38, 0.34 * dMult);
        const claspGem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.045, 0),
          coreMat,
        );
        claspGem.position.set(side * 0.31 * wMult, 1.38, 0.368 * dMult);
        torso.add(clasp, claspGem);
      });

      const chainCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.31 * wMult, 1.38, 0.35 * dMult),
        new THREE.Vector3(-0.15 * wMult, 1.25, 0.44 * dMult),
        new THREE.Vector3(0, 1.2, 0.47 * dMult),
        new THREE.Vector3(0.15 * wMult, 1.25, 0.44 * dMult),
        new THREE.Vector3(0.31 * wMult, 1.38, 0.35 * dMult),
      ]);
      torso.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(chainCurve, 20, 0.015, 6, false),
          trimMat,
        ),
      );
    }
  }

  // 2. Segmented Abdominal Armor Lames & Sculpted Hip Tassets
  if (!isCrystal) {
    for (let l = 0; l < 3; l++) {
      const lameY = 0.22 + l * 0.14;
      const lameRx = (0.37 + l * 0.03) * wMult;
      const lameRz = (0.27 + l * 0.02) * dMult;
      const lame = new THREE.Mesh(
        new THREE.TorusGeometry(lameRx, 0.026, 8, 24, Math.PI * 0.85),
        l % 2 === 0 ? trimMat : obsidianMat,
      );
      lame.rotation.set(Math.PI / 2, 0, Math.PI * 0.075);
      lame.scale.set(1.0, lameRz / lameRx, 1.0);
      lame.position.set(0, lameY, 0.03);
      torso.add(lame);
    }

    if (!isDjinn && !isCentaur && hid !== "ignis") {
      [-1, 1].forEach((side) => {
        const tasset = new THREE.Mesh(
          new THREE.BoxGeometry(0.25 * wMult, 0.46, 0.055),
          obsidianMat,
        );
        tasset.position.set(side * 0.43 * wMult, -0.14, 0.1 * dMult);
        tasset.rotation.set(-0.14, side * 0.35, -side * 0.24);
        const tassetRim = new THREE.Mesh(
          new THREE.BoxGeometry(0.27 * wMult, 0.48, 0.03),
          trimMat,
        );
        tassetRim.position.copy(tasset.position);
        tassetRim.rotation.copy(tasset.rotation);
        torso.add(tasset, tassetRim);
      });
    }
  }

  // 3. Layered Sculpted Shoulder Pauldrons, Crest Flares & 5-Finger Articulated Gauntlets
  const aScale = isFem ? 0.84 : 1.0;
  const hasLargePauldron = [
    "aurelius",
    "terrakor",
    "valkyra",
    "malakor",
  ].includes(hid);
  [leftShoulder, rightShoulder].forEach((sp, idx) => {
    const side = idx === 0 ? -1 : 1;
    const elPivot = idx === 0 ? leftElbow : rightElbow;

    if (!hasLargePauldron && !isCrystal) {
      const pauldronDome = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.32 * aScale,
          16,
          12,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.54,
        ),
        obsidianMat,
      );
      pauldronDome.position.set(side * 0.07 * aScale, 0.02, 0);
      pauldronDome.rotation.z = -side * 0.28;
      pauldronDome.castShadow = true;

      const pauldronTrim = new THREE.Mesh(
        new THREE.TorusGeometry(0.315 * aScale, 0.028, 8, 22),
        trimMat,
      );
      pauldronTrim.rotation.set(Math.PI / 2, -side * 0.28, 0);
      pauldronTrim.position.set(side * 0.07 * aScale, 0.02, 0);

      const crestFlare = new THREE.Mesh(
        new THREE.ConeGeometry(0.085 * aScale, 0.44 * aScale, 4),
        coreMat,
      );
      crestFlare.position.set(side * 0.26 * aScale, 0.24 * aScale, -0.02);
      crestFlare.rotation.z = -side * 0.56;
      sp.add(pauldronDome, pauldronTrim, crestFlare);
    } else {
      const pRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.34 * aScale, 0.028, 8, 22),
        trimMat,
      );
      pRim.rotation.set(0.18, 0, -side * 0.42);
      pRim.position.set(side * 0.06, 0.06, 0);
      const pGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08 * aScale, 0),
        coreMat,
      );
      pGem.position.set(side * 0.22 * aScale, 0.16, 0.14 * aScale);
      sp.add(pRim, pGem);
    }

    const couter = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.098 * aScale,
        0.098 * aScale,
        0.038,
        12,
      ),
      trimMat,
    );
    couter.rotation.z = Math.PI / 2;
    couter.position.set(side * 0.12 * aScale, 0, -0.02);
    const vambraceRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.122 * aScale, 0.02, 8, 18),
      coreMat,
    );
    vambraceRing.rotation.x = Math.PI / 2;
    vambraceRing.position.set(0, -0.44, 0);
    elPivot.add(couter, vambraceRing);

    const fGroup = new THREE.Group();
    fGroup.position.set(0, -0.66, 0.02);
    for (let fi = 0; fi < 4; fi++) {
      const fx = (fi - 1.5) * 0.036 * aScale;
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.014 * aScale, 0.065 * aScale, 4, 6),
        trimMat,
      );
      finger.position.set(fx, -0.02, 0.03 * aScale);
      finger.rotation.x = 0.55;
      fGroup.add(finger);
    }
    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.015 * aScale, 0.055 * aScale, 4, 6),
      trimMat,
    );
    thumb.position.set(-side * 0.075 * aScale, 0.01, 0.045 * aScale);
    thumb.rotation.set(0.45, 0, side * 0.65);
    fGroup.add(thumb);
    elPivot.add(fGroup);
  });

  // 4. Bipedal Knee Poleyn Wings, Shin Greave Ridges & Sabaton Toe Plates
  if (
    !isDjinn &&
    !isCentaur &&
    leftKnee &&
    rightKnee &&
    leftAnkle &&
    rightAnkle
  ) {
    const rScale = isFem ? 0.86 : 1.0;
    [leftHip, rightHip].forEach((hp, idx) => {
      const side = idx === 0 ? -1 : 1;
      const kp = idx === 0 ? leftKnee : rightKnee;
      const ap = idx === 0 ? leftAnkle : rightAnkle;

      const poleynFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.062 * rScale, 0.22 * rScale, 4),
        trimMat,
      );
      poleynFin.position.set(side * 0.128 * rScale, -0.02, 0.05 * rScale);
      poleynFin.rotation.z = -side * 0.48;
      kp.add(poleynFin);

      const shinCrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.038 * rScale, 0.48, 0.055 * rScale),
        trimMat,
      );
      shinCrest.position.set(0, -0.32, 0.145 * rScale);
      const ankleRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.118 * rScale, 0.022, 8, 16),
        trimMat,
      );
      ankleRing.rotation.x = Math.PI / 2;
      ankleRing.position.set(0, -0.58, 0);
      kp.add(shinCrest, ankleRing);

      const sabaton = new THREE.Mesh(
        new THREE.BoxGeometry(0.19 * rScale, 0.055, 0.24),
        bootMat,
      );
      sabaton.position.set(0, 0.035, 0.12);
      sabaton.rotation.x = 0.22;
      ap.add(sabaton);
    });
  }

  // 5. Tailored Pleated War-Capes for Malakor, Valkyra & Garrick (multi-channel matte fabric + metallic trim)
  if (
    heroCfgObj &&
    capePivot &&
    ["malakor", "valkyra", "garrick"].includes(hid)
  ) {
    const baseHex =
      hid === "malakor"
        ? 0x064e3b
        : hid === "valkyra"
          ? 0x881337
          : 0x78350f;
    const cTex = createHeroMaterialSet(
      baseHex,
      heroCfgObj.primaryHex,
      "cloth",
    );
    const cMat = makeHeroPBRMaterial(cTex, {
      bumpScale: 0.08,
      side: THREE.DoubleSide,
    });
    const topW =
      hid === "garrick" ? 1.52 : hid === "malakor" ? 1.48 : 1.04;
    const botW =
      hid === "garrick" ? 2.02 : hid === "malakor" ? 1.98 : 1.54;
    const capeLen = hid === "garrick" ? 1.62 : 1.94;
    capePivot.add(buildDrapedCapeMesh(topW, botW, capeLen, 5, cMat));
  }

  // 6. Champion-Specific Masterwork Signature Details & Weapon Enchantment Aura
  if (hid === "ignis") {
    const diadem = new THREE.Mesh(
      new THREE.TorusGeometry(0.285, 0.024, 8, 24),
      goldTrimMat,
    );
    diadem.rotation.x = Math.PI / 2;
    diadem.position.set(0, 0.45, 0);
    neckPivot.add(diadem);
  } else if (hid === "sylphira") {
    const bowString = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 2.75, 6),
      coreMat,
    );
    bowString.position.set(0, -0.58, -0.21);
    leftElbow.add(bowString);
  } else if (hid === "malakor") {
    const lantern = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      coreMat,
    );
    lantern.position.set(0.46, -0.18, 0.26);
    const lanternCageMat = new THREE.MeshBasicMaterial({
      color: 0x334155,
      wireframe: true,
    });
    const lanternCage = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.19, 0),
      lanternCageMat,
    );
    lanternCage.position.copy(lantern.position);
    torso.add(lantern, lanternCage);
  } else if (hid === "zephyros") {
    const torc = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.044, 10, 28, Math.PI * 1.55),
      goldTrimMat,
    );
    torc.rotation.set(Math.PI / 2, 0, -Math.PI * 0.27);
    torc.position.set(0, 1.42, 0.04);
    torso.add(torc);
  } else if (hid === "vespera") {
    [-0.14, 0, 0.14].forEach((kx, ki) => {
      const kunai = new THREE.Mesh(
        new THREE.ConeGeometry(0.036, 0.28, 4),
        silverTrimMat,
      );
      kunai.position.set(kx, 0.72 + ki * 0.12, 0.34);
      kunai.rotation.z = -0.65;
      torso.add(kunai);
    });
  } else if (hid === "terrakor") {
    [-0.24, 0, 0.24].forEach((rx, ri) => {
      const runePillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.38 - Math.abs(ri - 1) * 0.08, 0.07),
        coreMat,
      );
      runePillar.position.set(rx, 1.02, 0.56);
      torso.add(runePillar);
    });
  } else if (hid === "aurelia") {
    const haloCore = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.022, 8, 28),
      coreMat,
    );
    haloCore.position.set(0, 0.46, -0.22);
    neckPivot.add(haloCore);
  } else if (hid === "kaelthar") {
    const beltHourglass = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.17, 0),
      coreMat,
    );
    beltHourglass.scale.set(0.8, 1.5, 0.6);
    beltHourglass.position.set(-0.36, 0.02, 0.24);
    torso.add(beltHourglass);
  } else if (hid === "valkyra") {
    [-1, 1].forEach((side) => {
      const helmWing = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.52, 4),
        goldTrimMat,
      );
      helmWing.position.set(side * 0.29, 0.44, -0.02);
      helmWing.rotation.z = -side * 0.45;
      neckPivot.add(helmWing);
    });
  } else if (hid === "dravenor") {
    const tomeTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.026, 6, 16),
      goldTrimMat,
    );
    tomeTrim.position.set(-0.08, -0.58, 0.29);
    leftElbow.add(tomeTrim);
  } else if (hid === "nyxia") {
    const blossomBelt = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.15, 0),
      coreMat,
    );
    blossomBelt.position.set(0, 0.08, 0.32);
    torso.add(blossomBelt);
  } else if (hid === "thalindor") {
    [-0.32, 0.32].forEach((bx) => {
      const barnacle = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.36, 6),
        coreMat,
      );
      barnacle.position.set(bx, 1.32, -0.44);
      barnacle.rotation.x = -0.65;
      torso.add(barnacle);
    });
  } else if (hid === "solenne") {
    const innerPrismRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.74, 0.03, 8, 32),
      silverTrimMat,
    );
    innerPrismRing.position.set(0, 1.5, -0.25);
    torso.add(innerPrismRing);
  } else if (hid === "garrick") {
    const gaugeRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.038, 8, 24),
      goldTrimMat,
    );
    gaugeRim.position.set(0, 0.98, 0.63);
    torso.add(gaugeRim);
  } else if (hid === "seraphina") {
    const crescent = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.024, 8, 20, Math.PI * 1.25),
      goldTrimMat,
    );
    crescent.position.set(0, 0.48, 0.26);
    crescent.rotation.z = Math.PI * 0.88;
    neckPivot.add(crescent);
  }

  // 7. Specialised Sovereign Crown (Ultra Max Exclusive royal headpiece on neckPivot)
  const isUltraMaxMode =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  if (isUltraMaxMode && heroCfgObj && neckPivot) {
    const crownGroup = new THREE.Group();
    const crownY =
      hid === "nyxia"
        ? 0.72
        : hid === "thalindor"
          ? 0.68
          : hid === "dravenor"
            ? 0.66
            : 0.56;
    const crownScale = isGolem
      ? 1.14
      : isDwarf || isLeviathan
        ? 1.08
        : isFem
          ? 0.94
          : 1.0;
    crownGroup.position.set(0, crownY, 0.01);
    crownGroup.scale.setScalar(crownScale);
    crownGroup.userData.baseY = crownY;

    const isSunCelestial = [
      "aurelius",
      "aurelia",
      "solenne",
      "seraphina",
    ].includes(hid);
    const isArcaneMage = [
      "ignis",
      "zephyros",
      "kaelthar",
      "dravenor",
    ].includes(hid);
    const isWarlordTitan = [
      "terrakor",
      "garrick",
      "thalindor",
      "valkyra",
      "malakor",
    ].includes(hid);

    const crownMetal = isSunCelestial
      ? goldTrimMat
      : isWarlordTitan
        ? trimMat
        : isArcaneMage
          ? goldTrimMat
          : silverTrimMat;

    const baseBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.245, 0.022, 10, 32),
      crownMetal,
    );
    baseBand.rotation.x = Math.PI / 2;
    crownGroup.add(baseBand);

    const innerFiligree = new THREE.Mesh(
      new THREE.TorusGeometry(0.232, 0.012, 8, 28),
      coreMat,
    );
    innerFiligree.rotation.x = Math.PI / 2;
    innerFiligree.position.y = 0.022;
    crownGroup.add(innerFiligree);

    if (isSunCelestial) {
      const spireCount = 7;
      for (let si = 0; si < spireCount; si++) {
        const ang = (si / spireCount) * Math.PI * 2 - Math.PI / 2;
        const isFront = si === 0;
        const h = isFront
          ? 0.22
          : si === 1 || si === spireCount - 1
            ? 0.16
            : 0.12;
        const spire = new THREE.Mesh(
          new THREE.ConeGeometry(isFront ? 0.036 : 0.026, h, 4),
          crownMetal,
        );
        spire.position.set(
          Math.cos(ang) * 0.24,
          h * 0.5,
          Math.sin(ang) * 0.24,
        );
        spire.rotation.z = -Math.cos(ang) * 0.18;
        spire.rotation.x = Math.sin(ang) * 0.18;
        crownGroup.add(spire);

        const tipGem = new THREE.Mesh(
          new THREE.OctahedronGeometry(isFront ? 0.034 : 0.022, 0),
          coreMat,
        );
        tipGem.position.set(
          Math.cos(ang) * 0.265,
          h + 0.02,
          Math.sin(ang) * 0.265,
        );
        crownGroup.add(tipGem);
      }
      const upperHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.29, 0.014, 8, 32),
        coreMat,
      );
      upperHalo.rotation.x = Math.PI / 2;
      upperHalo.position.y = 0.24;
      crownGroup.add(upperHalo);
      crownGroup.userData.spinHalo = upperHalo;
    } else if (isArcaneMage) {
      for (let si = 0; si < 5; si++) {
        const ang = (si / 5) * Math.PI * 2 - Math.PI / 2;
        const isFront = si === 0;
        const h = isFront ? 0.24 : 0.16;
        const prong = new THREE.Mesh(
          new THREE.ConeGeometry(0.03, h, 5),
          crownMetal,
        );
        prong.position.set(
          Math.cos(ang) * 0.24,
          h * 0.5,
          Math.sin(ang) * 0.24,
        );
        prong.rotation.z = -Math.cos(ang) * 0.24;
        prong.rotation.x = Math.sin(ang) * 0.24;
        crownGroup.add(prong);
      }
      const apexCrystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.068, 0),
        coreMat,
      );
      apexCrystal.scale.set(0.85, 1.35, 0.85);
      apexCrystal.position.set(0, 0.24, 0.04);
      crownGroup.add(apexCrystal);
      crownGroup.userData.apexGem = apexCrystal;
    } else if (isWarlordTitan) {
      for (let bi = 0; bi < 6; bi++) {
        const ang = (bi / 6) * Math.PI * 2 - Math.PI / 2;
        const isFront = bi === 0;
        const bh = isFront ? 0.17 : 0.12;
        const merlon = new THREE.Mesh(
          new THREE.BoxGeometry(isFront ? 0.11 : 0.085, bh, 0.036),
          crownMetal,
        );
        merlon.position.set(
          Math.cos(ang) * 0.24,
          bh * 0.5,
          Math.sin(ang) * 0.24,
        );
        merlon.rotation.y = -ang + Math.PI / 2;
        crownGroup.add(merlon);
      }
      [-1, 1].forEach((side) => {
        const sideHorn = new THREE.Mesh(
          new THREE.ConeGeometry(0.042, 0.24, 5),
          coreMat,
        );
        sideHorn.position.set(side * 0.28, 0.12, 0);
        sideHorn.rotation.z = -side * 0.58;
        crownGroup.add(sideHorn);
      });
      const apexCube = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.075, 0.075),
        coreMat,
      );
      apexCube.position.set(0, 0.22, 0.12);
      apexCube.rotation.set(0.6, 0.8, 0.4);
      crownGroup.add(apexCube);
      crownGroup.userData.apexGem = apexCube;
    } else {
      [-1, 1].forEach((side) => {
        const wingBlade = new THREE.Mesh(
          new THREE.ConeGeometry(0.045, 0.26, 4),
          crownMetal,
        );
        wingBlade.scale.set(0.55, 1.0, 1.35);
        wingBlade.position.set(side * 0.23, 0.12, -0.04);
        wingBlade.rotation.set(-0.35, side * 0.35, -side * 0.48);
        crownGroup.add(wingBlade);
      });
      const frontPeak = new THREE.Mesh(
        new THREE.ConeGeometry(0.038, 0.19, 4),
        crownMetal,
      );
      frontPeak.position.set(0, 0.095, 0.245);
      frontPeak.rotation.x = 0.22;
      const frontStar = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.056, 0),
        coreMat,
      );
      frontStar.position.set(0, 0.21, 0.26);
      crownGroup.add(frontPeak, frontStar);
      crownGroup.userData.apexGem = frontStar;
    }

    neckPivot.add(crownGroup);
    ctx.umaxCrown = crownGroup;
  }

  // 8. Enchanted Weapon Rune Ring around primary weapon hand (Ultra Max Exclusive)
  if (isUltraMaxMode && heroCfgObj) {
    const weapPivot = ["sylphira", "nyxia"].includes(hid)
      ? leftElbow
      : rightElbow;
    const weapAura = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.022, 8, 24),
      coreMat,
    );
    weapAura.rotation.x = Math.PI / 2;
    weapAura.position.set(0, -0.64, 0.14);
    weapPivot.add(weapAura);
    ctx.umaxWeapAura = weapAura;
  }

  // 9. Ground Faction Rune Aura (Ultra Max Exclusive)
  if (isUltraMaxMode && heroCfgObj && ctx.root && !ctx.isPreview) {
    const umaxGroundRing = new THREE.Mesh(
      new THREE.RingGeometry(1.26, 1.46, 80),
      new THREE.MeshBasicMaterial({
        color: heroCfgObj.primaryHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
      }),
    );
    umaxGroundRing.rotation.x = -Math.PI / 2;
    umaxGroundRing.position.y = 0.055;
    ctx.root.add(umaxGroundRing);
    ctx.umaxGroundRing = umaxGroundRing;
  }
}

function buildSculptedHeroMesh(
  heroCfg,
  team,
  isPlayer,
  isPreview = false,
  isHudPortrait = false,
) {
  const built = _buildSculptedHeroMeshBase(
    heroCfg,
    team,
    isPlayer,
    isPreview,
    isHudPortrait,
  );
  try {
    nxgPolishHero(
      built,
      heroCfg,
      team,
      isPlayer,
      isPreview,
      isHudPortrait,
    );
  } catch (e) {}
  return built;
}

function _buildSculptedHeroMeshBase(
  heroCfg,
  team,
  isPlayer,
  isPreview = false,
  isHudPortrait = false,
) {
  const root = new THREE.Group();
  const hid = heroCfg.id;
  const isFem = [
    "ignis",
    "sylphira",
    "vespera",
    "aurelia",
    "valkyra",
    "nyxia",
    "solenne",
    "seraphina",
  ].includes(hid);

  // Distinct Body-Plan Classifications so all 16 champions have unmistakable silhouettes!
  const isDjinn = hid === "zephyros"; // Legless floating tornado-djinn tail!
  const isCentaur = hid === "nyxia"; // 4-legged Sylvan Stag-Centaur body!
  const isDwarf = hid === "garrick"; // Short, ultra-wide stocky Dwarven Mech-Forgemaster!
  const isGolem = hid === "terrakor"; // Towering 1.36x Boulder Golem!
  const isLeviathan = hid === "thalindor"; // Hunchbacked crab-shell sea-beast with giant claw!
  const isButcher = hid === "malakor"; // Broad-shouldered Butcher with cleaver + chain-hook!
  const isCrystal = hid === "solenne"; // Geometric floating prism construct!

  // Per-champion silhouette scale multipliers
  let bodyScaleX = 1.0,
    bodyScaleY = 1.0,
    bodyScaleZ = 1.0;
  if (isDwarf) {
    bodyScaleX = 1.34;
    bodyScaleY = 0.8;
    bodyScaleZ = 1.28;
  } else if (isGolem) {
    bodyScaleX = 1.36;
    bodyScaleY = 1.28;
    bodyScaleZ = 1.32;
  } else if (isLeviathan) {
    bodyScaleX = 1.28;
    bodyScaleY = 1.2;
    bodyScaleZ = 1.26;
  } else if (isButcher) {
    bodyScaleX = 1.24;
    bodyScaleY = 1.14;
    bodyScaleZ = 1.2;
  } else if (hid === "vespera") {
    bodyScaleX = 0.9;
    bodyScaleY = 0.96;
    bodyScaleZ = 0.9;
  }

  if (!isPreview) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.88, 36),
      new THREE.MeshBasicMaterial({
        color: isPlayer ? 0x34d399 : 0xf43f5e,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    root.add(ring);
  }

  const coreMat = new THREE.MeshStandardMaterial({
    color: heroCfg.primaryHex,
    emissive: heroCfg.primaryHex,
    emissiveIntensity: 0.95,
    roughness: 0.24,
    metalness: 0.35,
  });
  const goldTrimMat = makeHeroPBRMaterial(
    createHeroMaterialSet(0xf59e0b, 0xfef08a, "plate"),
    { bumpScale: 0.06 },
  );
  const silverTrimMat = makeHeroPBRMaterial(
    createHeroMaterialSet(0xcbd5e1, 0xf8fafc, "plate"),
    { bumpScale: 0.06 },
  );
  const obsidianMat = makeHeroPBRMaterial(
    createHeroMaterialSet(0x111827, 0x475569, "plate"),
    { bumpScale: 0.08 },
  );
  const trimMat = [
    "aurelius",
    "ignis",
    "aurelia",
    "kaelthar",
    "garrick",
  ].includes(hid)
    ? goldTrimMat
    : ["sylphira", "solenne", "seraphina", "thalindor"].includes(hid)
      ? silverTrimMat
      : makeHeroPBRMaterial(
          createHeroMaterialSet(0x6b21a8, 0xe879f9, "plate"),
          { bumpScale: 0.07 },
        );

  const bodyRig = new THREE.Group();
  bodyRig.scale.set(bodyScaleX, bodyScaleY, bodyScaleZ);
  root.add(bodyRig);

  const hips = new THREE.Group();
  hips.position.y = isDjinn ? 1.75 : isCentaur ? 1.48 : 1.42;
  bodyRig.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  // Sculpted Pelvis & Armored Belt
  const pelvisStations = isFem
    ? [
        { y: -0.14, rx: 0.36, rz: 0.28 },
        { y: 0.0, rx: 0.42, rz: 0.31, h2: 0.04 },
        { y: 0.12, rx: 0.34, rz: 0.25 },
      ]
    : [
        { y: -0.14, rx: 0.38, rz: 0.28 },
        { y: 0.0, rx: 0.44, rz: 0.32, h2: 0.04 },
        { y: 0.14, rx: 0.41, rz: 0.29 },
      ];
  torso.add(buildLoftedMesh(pelvisStations, 24, obsidianMat));

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(
      isFem ? 0.35 : 0.42,
      isFem ? 0.42 : 0.46,
      0.18,
      22,
    ),
    trimMat,
  );
  belt.scale.set(1.0, 1.0, 0.76);
  belt.position.y = 0.06;
  torso.add(belt);

  const beltBuckle = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.13, 0),
    coreMat,
  );
  beltBuckle.position.set(0, 0.06, isFem ? 0.33 : 0.38);
  torso.add(beltBuckle);

  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 1.54, 0.02);
  torso.add(neckPivot);

  const shoulderX = isFem ? 0.66 : 0.84;
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-shoulderX, 1.36, 0);
  torso.add(leftShoulder);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.66, 0);
  leftShoulder.add(leftElbow);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(shoulderX, 1.36, 0);
  torso.add(rightShoulder);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.66, 0);
  rightShoulder.add(rightElbow);

  const hipX = isFem ? 0.26 : 0.31;
  const leftHip = new THREE.Group();
  leftHip.position.set(-hipX, 0, isCentaur ? 0.45 : 0);
  hips.add(leftHip);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.68, 0);
  leftHip.add(leftKnee);

  const rightHip = new THREE.Group();
  rightHip.position.set(hipX, 0, isCentaur ? 0.45 : 0);
  hips.add(rightHip);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.68, 0);
  rightHip.add(rightKnee);

  // Sculpted Sylvan Stag-Dryad Cervine Body, Saddle Blanket, 3-Joint Tail & Hind Legs for Nyxia
  let hindLeftHip = null,
    hindRightHip = null,
    hindLeftKnee = null,
    hindRightKnee = null;
  let hindLeftAnkle = null,
    hindRightAnkle = null;
  let tailBase = null,
    tailMid = null,
    tailTip = null;
  let stagCoatMat = null,
    stagBellyMat = null,
    stagLeafMat = null,
    stagHoofMat = null;
  if (isCentaur) {
    const coatTex = createHeroMaterialSet(0x3b6e52, 0x84cc16, "cloth");
    const bellyTex = createHeroMaterialSet(0xa7c99e, 0xd9f99d, "cloth");
    stagCoatMat = makeHeroPBRMaterial(coatTex, { bumpScale: 0.06 });
    stagBellyMat = makeHeroPBRMaterial(bellyTex, { bumpScale: 0.05 });
    stagLeafMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      emissiveIntensity: 0.32,
      roughness: 0.54,
      metalness: 0.06,
      side: THREE.DoubleSide,
    });
    stagHoofMat = goldTrimMat;

    const barrelStations = [
      { y: -0.26, rx: 0.31, rz: 0.66, zOff: -0.2 },
      { y: -0.08, rx: 0.42, rz: 0.82, zOff: -0.2, h2: 0.04 },
      { y: 0.1, rx: 0.41, rz: 0.8, zOff: -0.18, h2: 0.05 },
      { y: 0.24, rx: 0.3, rz: 0.62, zOff: -0.16 },
    ];
    hips.add(buildLoftedMesh(barrelStations, 24, stagCoatMat));

    const stagBelly = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 16, 14),
      stagBellyMat,
    );
    stagBelly.scale.set(0.76, 0.58, 1.56);
    stagBelly.position.set(0, -0.16, -0.18);
    hips.add(stagBelly);

    const stagChest = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 14),
      stagCoatMat,
    );
    stagChest.scale.set(0.86, 0.94, 0.92);
    stagChest.position.set(0, 0.04, 0.44);
    hips.add(stagChest);

    const stagHaunch = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 16, 14),
      stagCoatMat,
    );
    stagHaunch.scale.set(0.88, 0.92, 0.92);
    stagHaunch.position.set(0, 0.02, -0.76);
    hips.add(stagHaunch);

    const saddleBlanket = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.44,
        0.48,
        0.78,
        20,
        1,
        true,
        -Math.PI * 0.68,
        Math.PI * 1.36,
      ),
      stagLeafMat,
    );
    saddleBlanket.rotation.x = Math.PI / 2;
    saddleBlanket.position.set(0, 0.08, -0.24);
    hips.add(saddleBlanket);

    const saddleTrimFront = new THREE.Mesh(
      new THREE.TorusGeometry(0.445, 0.024, 8, 24, Math.PI * 1.32),
      stagHoofMat,
    );
    saddleTrimFront.rotation.z = -Math.PI * 0.16;
    saddleTrimFront.position.set(0, 0.08, 0.14);
    const saddleTrimBack = saddleTrimFront.clone();
    saddleTrimBack.position.z = -0.62;
    hips.add(saddleTrimFront, saddleTrimBack);

    tailBase = new THREE.Group();
    tailBase.position.set(0, 0.18, -1.08);
    hips.add(tailBase);

    const tailUpperMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.44, 8),
      stagLeafMat,
    );
    tailUpperMesh.position.set(0, -0.14, -0.14);
    tailUpperMesh.rotation.x = -0.75;
    tailBase.add(tailUpperMesh);

    tailMid = new THREE.Group();
    tailMid.position.set(0, -0.26, -0.26);
    tailBase.add(tailMid);

    const tailMidMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.42, 8),
      coreMat,
    );
    tailMidMesh.position.set(0, -0.14, -0.12);
    tailMidMesh.rotation.x = -0.65;
    tailMid.add(tailMidMesh);

    tailTip = new THREE.Group();
    tailTip.position.set(0, -0.24, -0.2);
    tailMid.add(tailTip);

    const tailTipMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      stagHoofMat,
    );
    tailTipMesh.scale.set(0.8, 1.6, 0.8);
    tailTipMesh.position.set(0, -0.1, -0.06);
    tailTip.add(tailTipMesh);

    hindLeftHip = new THREE.Group();
    hindLeftHip.position.set(-0.27, -0.06, -0.78);
    hindRightHip = new THREE.Group();
    hindRightHip.position.set(0.27, -0.06, -0.78);
    hips.add(hindLeftHip, hindRightHip);

    hindLeftKnee = new THREE.Group();
    hindLeftKnee.position.set(0, -0.66, -0.06);
    hindLeftHip.add(hindLeftKnee);

    hindRightKnee = new THREE.Group();
    hindRightKnee.position.set(0, -0.66, -0.06);
    hindRightHip.add(hindRightKnee);

    hindLeftAnkle = new THREE.Group();
    hindLeftAnkle.position.set(0, -0.66, 0.03);
    hindLeftKnee.add(hindLeftAnkle);

    hindRightAnkle = new THREE.Group();
    hindRightAnkle.position.set(0, -0.66, 0.03);
    hindRightKnee.add(hindRightAnkle);

    [hindLeftHip, hindRightHip].forEach((hh, idx) => {
      const hk = idx === 0 ? hindLeftKnee : hindRightKnee;
      const ha = idx === 0 ? hindLeftAnkle : hindRightAnkle;

      const haunchCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 10),
        stagCoatMat,
      );
      hh.add(haunchCap);

      const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.088, 0.68, 12),
        stagCoatMat,
      );
      thigh.position.set(0, -0.33, -0.02);
      thigh.rotation.x = 0.06;
      hh.add(thigh);

      const hockJoint = new THREE.Mesh(
        new THREE.SphereGeometry(0.092, 10, 8),
        stagBellyMat,
      );
      hk.add(hockJoint);

      const cannon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.056, 0.66, 12),
        stagBellyMat,
      );
      cannon.position.set(0, -0.33, 0.01);
      hk.add(cannon);

      const fetlockTuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.095, 0.18, 7),
        stagLeafMat,
      );
      fetlockTuft.position.set(0, 0.06, -0.04);
      fetlockTuft.rotation.x = 0.35;
      const hoof = new THREE.Mesh(
        new THREE.CylinderGeometry(0.066, 0.094, 0.13, 12),
        stagHoofMat,
      );
      hoof.position.set(0, -0.02, 0.02);
      ha.add(fetlockTuft, hoof);
    });
  }

  const limbBaseMap = {
    aurelius: 0xb45309,
    ignis: 0x7f1d1d,
    sylphira: 0x164e63,
    malakor: 0x1e1b4b,
    zephyros: 0x1d4ed8,
    vespera: 0x3b0764,
    terrakor: 0x065f46,
    aurelia: 0xd97706,
    kaelthar: 0x1e3a8a,
    valkyra: 0x881337,
    dravenor: 0x311042,
    nyxia: 0x065f46,
    thalindor: 0x0e7490,
    solenne: 0x831843,
    garrick: 0x44403c,
    seraphina: 0x134e4a,
  };
  const clothLimbHeroes = [
    "ignis",
    "zephyros",
    "kaelthar",
    "dravenor",
    "seraphina",
  ];
  const scaleLimbHeroes = ["sylphira", "vespera", "nyxia", "thalindor"];
  const limbPattern = clothLimbHeroes.includes(hid)
    ? "cloth"
    : scaleLimbHeroes.includes(hid)
      ? "scale"
      : "plate";
  const limbTex = createHeroMaterialSet(
    limbBaseMap[hid] || 0x1e1b4b,
    ["sylphira", "thalindor", "solenne", "seraphina"].includes(hid)
      ? 0xbae6fd
      : 0xfacc15,
    limbPattern,
  );
  const limbMat = makeHeroPBRMaterial(limbTex, { bumpScale: 0.08 });
  const bootTex = createHeroMaterialSet(0x1f2937, 0x64748b, "scale");
  const bootMat = makeHeroPBRMaterial(bootTex, { bumpScale: 0.07 });

  let djinnVortexRings = [];
  let leftAnkle = null,
    rightAnkle = null;
  if (isDjinn) {
    for (let vr = 0; vr < 6; vr++) {
      const rad = 0.42 - vr * 0.055;
      const vRing = new THREE.Mesh(
        new THREE.TorusGeometry(rad, 0.085 - vr * 0.008, 8, 22),
        vr % 2 === 0 ? coreMat : trimMat,
      );
      vRing.rotation.x = Math.PI / 2;
      vRing.position.y = -0.18 - vr * 0.24;
      hips.add(vRing);
      djinnVortexRings.push(vRing);
    }
  } else {
    leftAnkle = new THREE.Group();
    leftAnkle.position.set(0, -0.66, 0.04);
    leftKnee.add(leftAnkle);

    rightAnkle = new THREE.Group();
    rightAnkle.position.set(0, -0.66, 0.04);
    rightKnee.add(rightAnkle);

    [leftHip, rightHip].forEach((hipPivot, idx) => {
      const kneePivot = idx === 0 ? leftKnee : rightKnee;
      const anklePivot = idx === 0 ? leftAnkle : rightAnkle;
      if (isCentaur) {
        const shoulderCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 12, 10),
          stagCoatMat,
        );
        hipPivot.add(shoulderCap);

        const foreArm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.135, 0.082, 0.68, 12),
          stagCoatMat,
        );
        foreArm.position.y = -0.34;
        hipPivot.add(foreArm);

        const kneeSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.086, 10, 8),
          stagBellyMat,
        );
        kneePivot.add(kneeSphere);

        const foreCannon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.074, 0.056, 0.66, 12),
          stagBellyMat,
        );
        foreCannon.position.y = -0.33;
        kneePivot.add(foreCannon);

        const fetlockTuft = new THREE.Mesh(
          new THREE.ConeGeometry(0.092, 0.18, 7),
          stagLeafMat,
        );
        fetlockTuft.position.set(0, 0.06, -0.04);
        fetlockTuft.rotation.x = 0.35;
        const hoof = new THREE.Mesh(
          new THREE.CylinderGeometry(0.066, 0.094, 0.13, 12),
          stagHoofMat,
        );
        hoof.position.set(0, -0.02, 0.02);
        anklePivot.add(fetlockTuft, hoof);
        return;
      }
      const rScale = isFem ? 0.86 : 1.0;
      const hipCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.21 * rScale, 14, 12),
        limbMat,
      );
      hipCap.position.y = -0.02;
      hipPivot.add(hipCap);

      const thighStations = [
        { y: -0.66, rx: 0.13 * rScale, rz: 0.135 * rScale },
        {
          y: -0.45,
          rx: 0.165 * rScale,
          rz: 0.17 * rScale,
          archFront: 0.02,
        },
        {
          y: -0.22,
          rx: 0.2 * rScale,
          rz: 0.205 * rScale,
          archFront: 0.025,
        },
        { y: -0.02, rx: 0.21 * rScale, rz: 0.215 * rScale },
      ];
      hipPivot.add(buildLoftedMesh(thighStations, 18, limbMat));

      const kneeCop = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.145 * rScale, 1),
        trimMat,
      );
      kneeCop.scale.set(0.95, 1.15, 0.75);
      kneeCop.position.set(0, -0.66, 0.12 * rScale);
      hipPivot.add(kneeCop);

      const kneeSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.14 * rScale, 14, 12),
        bootMat,
      );
      kneePivot.add(kneeSphere);

      const greaveStations = [
        { y: -0.62, rx: 0.11 * rScale, rz: 0.12 * rScale, h4: 0.04 },
        {
          y: -0.36,
          rx: 0.145 * rScale,
          rz: 0.16 * rScale,
          archBack: 0.03,
          h4: 0.04,
        },
        { y: -0.12, rx: 0.155 * rScale, rz: 0.165 * rScale, h4: 0.04 },
        { y: 0.0, rx: 0.135 * rScale, rz: 0.14 * rScale },
      ];
      kneePivot.add(buildLoftedMesh(greaveStations, 18, bootMat));

      const bootGrp = new THREE.Group();
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.22 * rScale, 0.08, 0.44),
        bootMat,
      );
      sole.position.set(0, -0.02, 0.06);
      const toeCap = new THREE.Mesh(
        new THREE.ConeGeometry(0.12 * rScale, 0.26, 6),
        trimMat,
      );
      toeCap.rotation.x = Math.PI / 2;
      toeCap.scale.set(1.0, 1.0, 0.65);
      toeCap.position.set(0, 0.04, 0.22);
      bootGrp.add(sole, toeCap);
      anklePivot.add(bootGrp);
    });
  }

  [leftShoulder, rightShoulder].forEach((shPivot, idx) => {
    const aScale = isFem ? 0.8 : 1.0;
    const side = idx === 0 ? -1 : 1;
    const shoulderSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * aScale, 14, 12),
      limbMat,
    );
    shoulderSphere.position.set(-side * 0.04, 0.0, 0);
    shPivot.add(shoulderSphere);

    const upperArmStations = [
      { y: -0.64, rx: 0.105 * aScale, rz: 0.105 * aScale },
      {
        y: -0.42,
        rx: 0.135 * aScale,
        rz: 0.14 * aScale,
        archFront: 0.015,
      },
      { y: -0.18, rx: 0.165 * aScale, rz: 0.17 * aScale },
      { y: 0.02, rx: 0.15 * aScale, rz: 0.15 * aScale },
    ];
    shPivot.add(buildLoftedMesh(upperArmStations, 16, limbMat));

    const elPivot = idx === 0 ? leftElbow : rightElbow;
    const elbowCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.125 * aScale, 14, 12),
      trimMat,
    );
    elPivot.add(elbowCap);

    const forearmStations = [
      { y: -0.56, rx: 0.095 * aScale, rz: 0.1 * aScale },
      { y: -0.36, rx: 0.13 * aScale, rz: 0.135 * aScale, h4: 0.04 },
      { y: -0.14, rx: 0.14 * aScale, rz: 0.145 * aScale, h4: 0.04 },
      { y: 0.0, rx: 0.11 * aScale, rz: 0.11 * aScale },
    ];
    elPivot.add(buildLoftedMesh(forearmStations, 16, trimMat));

    const handGrp = new THREE.Group();
    handGrp.position.set(0, -0.6, 0.02);
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 * aScale, 0.16 * aScale, 0.11 * aScale),
      bootMat,
    );
    const knuckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.17 * aScale, 0.06 * aScale, 0.13 * aScale),
      trimMat,
    );
    knuckle.position.set(0, -0.02, 0.02);
    handGrp.add(palm, knuckle);
    elPivot.add(handGrp);
  });

  const capePivot = new THREE.Group();
  capePivot.position.set(0, 1.46, -0.26);
  torso.add(capePivot);

  let extraParts = {};

  if (hid === "aurelius") {
    const goldPlateTex = createHeroMaterialSet(
      0xf59e0b,
      0xfef08a,
      "plate",
    );
    const cuirassMat = makeHeroPBRMaterial(goldPlateTex, {
      bumpScale: 0.1,
    });
    const chestStations = [
      { y: 0.04, rx: 0.42, rz: 0.29, h2: 0.04 },
      { y: 0.42, rx: 0.45, rz: 0.32, h2: 0.05 },
      {
        y: 0.86,
        rx: 0.64,
        rz: 0.42,
        archFront: 0.09,
        archBack: 0.05,
        h2: 0.08,
      },
      {
        y: 1.24,
        rx: 0.76,
        rz: 0.45,
        archFront: 0.08,
        archBack: 0.06,
        h2: 0.1,
      },
      { y: 1.48, rx: 0.46, rz: 0.3 },
      { y: 1.56, rx: 0.24, rz: 0.22 },
    ];
    torso.add(buildLoftedMesh(chestStations, 28, cuirassMat));

    const sunCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 1),
      coreMat,
    );
    sunCore.position.set(0, 0.98, 0.49);
    torso.add(sunCore);

    const sunHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.05, 8, 32),
      coreMat,
    );
    sunHalo.position.set(0, 1.48, -0.26);
    torso.add(sunHalo);
    extraParts.backHalo = sunHalo;

    const crimsonClothTex = createHeroMaterialSet(
      0x991b1b,
      0xfacc15,
      "cloth",
    );
    const crimsonClothMat = makeHeroPBRMaterial(crimsonClothTex, {
      bumpScale: 0.06,
      side: THREE.DoubleSide,
    });
    const frontTabard = buildDrapedCapeMesh(
      0.42,
      0.54,
      0.96,
      2,
      crimsonClothMat,
    );
    frontTabard.position.set(0, 0.02, 0.36);
    frontTabard.rotation.y = Math.PI;
    frontTabard.rotation.x = -0.06;
    torso.add(frontTabard);

    [leftShoulder, rightShoulder].forEach((sp, i) => {
      const side = i === 0 ? -1 : 1;
      const pUpper = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.4,
          18,
          14,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.58,
        ),
        cuirassMat,
      );
      const wing = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.6, 5),
        coreMat,
      );
      wing.position.set(side * 0.34, 0.34, -0.06);
      wing.rotation.z = -side * 0.58;
      sp.add(pUpper, wing);
    });

    capePivot.add(
      buildDrapedCapeMesh(1.42, 1.94, 2.08, 5, crimsonClothMat),
    );

    const face = buildRefinedHeroFace(
      0xf0c4a2,
      0x38bdf8,
      0xb45309,
      "aurelius",
    );
    neckPivot.add(face);
    const crownBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.295, 0.032, 8, 24),
      trimMat,
    );
    crownBand.rotation.x = Math.PI / 2;
    crownBand.position.set(0, 0.455, -0.01);
    neckPivot.add(crownBand);

    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 0.86);
    shieldShape.lineTo(0.56, 0.5);
    shieldShape.lineTo(0.44, -0.26);
    shieldShape.lineTo(0, -0.92);
    shieldShape.lineTo(-0.44, -0.26);
    shieldShape.lineTo(-0.56, 0.5);
    shieldShape.closePath();
    const kiteShield = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shieldShape, {
        depth: 0.11,
        bevelEnabled: true,
        bevelSize: 0.04,
        bevelThickness: 0.04,
      }),
      cuirassMat,
    );
    kiteShield.position.set(-0.18, -0.35, 0.22);
    kiteShield.rotation.y = -Math.PI / 2;
    leftElbow.add(kiteShield);

    const swordGroup = new THREE.Group();
    swordGroup.position.set(0, -0.62, 0.06);
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.14, 0.2),
      trimMat,
    );
    guard.position.y = 0.24;
    const bladeOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 3.05, 4),
      silverTrimMat,
    );
    bladeOuter.position.set(0, 1.78, 0);
    bladeOuter.scale.set(1.15, 1.0, 0.24);
    const bladeFuller = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 2.65, 4),
      coreMat,
    );
    bladeFuller.position.set(0, 1.62, 0);
    bladeFuller.scale.set(1.05, 1.0, 0.3);
    swordGroup.add(guard, bladeOuter, bladeFuller);
    swordGroup.rotation.x = Math.PI * 0.38;
    rightElbow.add(swordGroup);
  } else if (hid === "ignis") {
    const silkTex = createHeroMaterialSet(0xb91c1c, 0xfacc15, "cloth");
    const silkMat = makeHeroPBRMaterial(silkTex, {
      bumpScale: 0.07,
      side: THREE.DoubleSide,
    });
    const bodiceStations = [
      { y: 0.04, rx: 0.34, rz: 0.24 },
      { y: 0.46, rx: 0.32, rz: 0.23 },
      { y: 0.92, rx: 0.46, rz: 0.34, archFront: 0.09, h2: 0.06 },
      { y: 1.24, rx: 0.5, rz: 0.32, archFront: 0.05, h2: 0.08 },
      { y: 1.46, rx: 0.34, rz: 0.24 },
      { y: 1.54, rx: 0.2, rz: 0.19 },
    ];
    torso.add(buildLoftedMesh(bodiceStations, 28, silkMat));

    const gown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.92, 1.38, 28, 1, true),
      silkMat,
    );
    gown.position.y = -0.62;
    torso.add(gown);
    extraParts.gownMesh = gown;

    [-1, 1].forEach((side) => {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.24, 1.38, -0.26);
      for (let w = 0; w < 4; w++) {
        const plume = new THREE.Mesh(
          new THREE.ConeGeometry(0.18 - w * 0.02, 1.85 - w * 0.24, 4),
          w % 2 === 0 ? coreMat : trimMat,
        );
        plume.scale.set(1.25, 1.0, 0.18);
        plume.position.set(
          side * (0.48 + w * 0.26),
          0.1 - w * 0.26,
          -0.06,
        );
        plume.rotation.z = -side * (0.68 + w * 0.2);
        wingPivot.add(plume);
      }
      torso.add(wingPivot);
      if (side < 0) extraParts.leftWing = wingPivot;
      else extraParts.rightWing = wingPivot;
    });

    const face = buildRefinedHeroFace(
      0xf0c4a2,
      0xf97316,
      0xdc2626,
      "ignis",
    );
    neckPivot.add(face);
    for (let f = -2; f <= 2; f++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.48 - Math.abs(f) * 0.06, 6),
        coreMat,
      );
      flame.position.set(f * 0.1, 0.66, 0.06);
      flame.rotation.z = -f * 0.18;
      neckPivot.add(flame);
    }

    const leftOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 14),
      coreMat,
    );
    leftOrb.position.set(0, -0.62, 0.22);
    leftElbow.add(leftOrb);
    const rightOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 14),
      coreMat,
    );
    rightOrb.position.set(0, -0.62, 0.22);
    rightElbow.add(rightOrb);
    extraParts.leftOrb = leftOrb;
    extraParts.rightOrb = rightOrb;
  } else if (hid === "sylphira") {
    const scaleTex = createHeroMaterialSet(0x0e7490, 0xbae6fd, "scale");
    const rangerMat = makeHeroPBRMaterial(scaleTex, {
      bumpScale: 0.08,
      side: THREE.DoubleSide,
    });
    const cloakTex = createHeroMaterialSet(0x083344, 0x38bdf8, "cloth");
    const cloakMat = makeHeroPBRMaterial(cloakTex, {
      bumpScale: 0.06,
      side: THREE.DoubleSide,
    });
    const jerkinStations = [
      { y: 0.04, rx: 0.35, rz: 0.25 },
      { y: 0.46, rx: 0.33, rz: 0.24 },
      { y: 0.94, rx: 0.47, rz: 0.34, archFront: 0.08, h2: 0.06 },
      { y: 1.26, rx: 0.52, rz: 0.33, archFront: 0.04, h2: 0.08 },
      { y: 1.48, rx: 0.36, rz: 0.25 },
      { y: 1.54, rx: 0.21, rz: 0.2 },
    ];
    torso.add(buildLoftedMesh(jerkinStations, 26, rangerMat));

    const cowl = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.11, 8, 20),
      cloakMat,
    );
    cowl.rotation.x = Math.PI / 2.2;
    cowl.position.set(0, 1.42, 0);
    torso.add(cowl);

    const quiver = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.12, 1.18, 12),
      obsidianMat,
    );
    quiver.position.set(-0.26, 0.96, -0.36);
    quiver.rotation.z = -0.36;
    torso.add(quiver);
    [-0.06, 0, 0.06].forEach((ax) => {
      const fletch = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.35, 5),
        coreMat,
      );
      fletch.position.set(-0.4 + ax, 1.56, -0.36);
      fletch.rotation.z = -0.36;
      torso.add(fletch);
    });

    capePivot.add(buildDrapedCapeMesh(1.06, 1.56, 1.85, 4, cloakMat));

    const face = buildRefinedHeroFace(
      0xf7dcc6,
      0x22d3ee,
      0xe2e8f0,
      "sylphira",
    );
    neckPivot.add(face);
    const tiara = new THREE.Mesh(
      new THREE.TorusGeometry(0.275, 0.02, 8, 24, Math.PI * 1.15),
      trimMat,
    );
    tiara.rotation.x = Math.PI / 2;
    tiara.position.set(0, 0.445, 0.01);
    neckPivot.add(tiara);

    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, -0.58, 0.14);
    const bowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -1.42, -0.35),
      new THREE.Vector3(0, -0.82, 0.28),
      new THREE.Vector3(0, 0.0, 0.58),
      new THREE.Vector3(0, 0.82, 0.28),
      new THREE.Vector3(0, 1.42, -0.35),
    ]);
    bowGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(bowCurve, 32, 0.062, 8, false),
        coreMat,
      ),
    );
    const nockedArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 1.45, 5),
      coreMat,
    );
    nockedArrow.rotation.x = Math.PI / 2;
    nockedArrow.position.set(0, 0, 0.34);
    bowGroup.add(nockedArrow);
    leftElbow.add(bowGroup);
  } else if (hid === "malakor") {
    const darkPlateTex = createHeroMaterialSet(
      0x1e1b4b,
      0x10b981,
      "plate",
    );
    const dreadArmorMat = makeHeroPBRMaterial(darkPlateTex, {
      bumpScale: 0.12,
    });
    const dreadStations = [
      { y: 0.04, rx: 0.46, rz: 0.32, h2: 0.04 },
      { y: 0.44, rx: 0.52, rz: 0.36, h2: 0.06 },
      {
        y: 0.88,
        rx: 0.72,
        rz: 0.46,
        archFront: 0.12,
        archBack: 0.08,
        h2: 0.08,
      },
      {
        y: 1.28,
        rx: 0.84,
        rz: 0.5,
        archFront: 0.1,
        archBack: 0.08,
        h2: 0.1,
      },
      { y: 1.5, rx: 0.5, rz: 0.34 },
      { y: 1.58, rx: 0.26, rz: 0.24 },
    ];
    torso.add(buildLoftedMesh(dreadStations, 26, dreadArmorMat));

    for (let c = 0; c < 3; c++) {
      const chainRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.66, 0.045, 6, 20),
        coreMat,
      );
      chainRing.position.set(-0.08, 0.85 + c * 0.14, 0.02);
      chainRing.rotation.set(0.35, 0.2, 0.52);
      torso.add(chainRing);
    }

    [leftShoulder, rightShoulder].forEach((sp, idx) => {
      const side = idx === 0 ? -1 : 1;
      const spikePauldron = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 1.05, 6),
        trimMat,
      );
      spikePauldron.position.set(side * 0.16, 0.36, 0);
      spikePauldron.rotation.z = -side * 0.52;
      sp.add(spikePauldron);
    });

    const face = buildRefinedHeroFace(
      0xd8b4fe,
      0x34d399,
      0xf8fafc,
      "malakor",
    );
    neckPivot.add(face);
    [-0.32, 0.32].forEach((hx) => {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.72, 6),
        obsidianMat,
      );
      horn.position.set(hx, 0.62, 0.08);
      horn.rotation.z = hx < 0 ? 0.46 : -0.46;
      neckPivot.add(horn);
    });

    const hookGrp = new THREE.Group();
    hookGrp.position.set(0, -0.6, 0.1);
    const hookCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.45, 0.18),
      new THREE.Vector3(0, 0.82, 0.02),
      new THREE.Vector3(0, 0.65, -0.32),
    ]);
    hookGrp.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(hookCurve, 18, 0.075, 7, false),
        coreMat,
      ),
    );
    hookGrp.rotation.x = Math.PI * 0.35;
    leftElbow.add(hookGrp);

    const cleaverGrp = new THREE.Group();
    cleaverGrp.position.set(0, -0.6, 0.08);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.75, 8),
      obsidianMat,
    );
    handle.position.y = 0.2;
    const cleaverBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.85, 0.68),
      silverTrimMat,
    );
    cleaverBlade.position.set(0, 1.35, 0.24);
    const cleaverEdge = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.85, 0.12),
      coreMat,
    );
    cleaverEdge.position.set(0, 1.35, 0.56);
    cleaverGrp.add(handle, cleaverBlade, cleaverEdge);
    cleaverGrp.rotation.x = Math.PI * 0.34;
    rightElbow.add(cleaverGrp);
  } else if (hid === "zephyros") {
    const stormClothTex = createHeroMaterialSet(
      0x1d4ed8,
      0x38bdf8,
      "cloth",
    );
    const stormRobeMat = makeHeroPBRMaterial(stormClothTex, {
      bumpScale: 0.08,
    });
    const chestStations = [
      { y: 0.04, rx: 0.36, rz: 0.26 },
      { y: 0.44, rx: 0.44, rz: 0.3 },
      { y: 0.88, rx: 0.62, rz: 0.4, archFront: 0.08, h2: 0.06 },
      { y: 1.24, rx: 0.72, rz: 0.42, archFront: 0.06, h2: 0.08 },
      { y: 1.48, rx: 0.44, rz: 0.28 },
      { y: 1.54, rx: 0.22, rz: 0.2 },
    ];
    torso.add(buildLoftedMesh(chestStations, 26, stormRobeMat));

    const thunderHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.02, 0.045, 8, 32),
      coreMat,
    );
    thunderHalo.position.set(0, 1.52, -0.24);
    torso.add(thunderHalo);
    extraParts.backHalo = thunderHalo;

    [leftShoulder, rightShoulder].forEach((sp, i) => {
      const side = i === 0 ? -1 : 1;
      const boltFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.72, 4),
        trimMat,
      );
      boltFin.position.set(side * 0.24, 0.32, 0);
      boltFin.rotation.z = -side * 0.55;
      sp.add(boltFin);
    });

    const face = buildRefinedHeroFace(
      0xe0f2fe,
      0x38bdf8,
      0xf8fafc,
      "zephyros",
    );
    neckPivot.add(face);
    const stormCrown = new THREE.Mesh(
      new THREE.TorusGeometry(0.29, 0.028, 8, 24),
      trimMat,
    );
    stormCrown.rotation.x = Math.PI / 2;
    stormCrown.position.set(0, 0.46, 0);
    neckPivot.add(stormCrown);

    const staffGrp = new THREE.Group();
    staffGrp.position.set(0, -0.6, 0.08);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.052, 2.85, 10),
      obsidianMat,
    );
    shaft.position.y = 0.65;
    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.26, 1),
      coreMat,
    );
    orb.position.y = 2.15;
    staffGrp.add(shaft, orb);
    staffGrp.rotation.x = Math.PI * 0.34;
    rightElbow.add(staffGrp);
    extraParts.rightOrb = orb;
  } else if (hid === "vespera") {
    const voidTex = createHeroMaterialSet(0x3b0764, 0xe879f9, "scale");
    const voidMat = makeHeroPBRMaterial(voidTex, {
      bumpScale: 0.08,
      side: THREE.DoubleSide,
    });
    const assassinStations = [
      { y: 0.04, rx: 0.32, rz: 0.22 },
      { y: 0.46, rx: 0.3, rz: 0.21 },
      { y: 0.92, rx: 0.44, rz: 0.31, archFront: 0.08, h2: 0.06 },
      { y: 1.25, rx: 0.48, rz: 0.3, archFront: 0.04, h2: 0.08 },
      { y: 1.48, rx: 0.34, rz: 0.23 },
      { y: 1.54, rx: 0.2, rz: 0.19 },
    ];
    torso.add(buildLoftedMesh(assassinStations, 26, voidMat));

    const scarfTex = createHeroMaterialSet(0x581c87, 0xf0abfc, "cloth");
    const scarfMat = makeHeroPBRMaterial(scarfTex, {
      bumpScale: 0.06,
      side: THREE.DoubleSide,
    });
    [-0.22, 0.22].forEach((sx) => {
      const ribbon = buildDrapedCapeMesh(0.28, 0.46, 2.15, 2, scarfMat);
      ribbon.position.set(sx, 1.44, -0.24);
      torso.add(ribbon);
    });

    const face = buildRefinedHeroFace(
      0xf3e8ff,
      0xe879f9,
      0x1e1b4b,
      "vespera",
    );
    neckPivot.add(face);

    [leftElbow, rightElbow].forEach((elP) => {
      const daggerGrp = new THREE.Group();
      daggerGrp.position.set(0, -0.6, 0.06);
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 1.55, 4),
        coreMat,
      );
      blade.position.y = -0.65;
      blade.rotation.x = Math.PI;
      blade.scale.set(1.2, 1.0, 0.22);
      daggerGrp.add(blade);
      daggerGrp.rotation.x = Math.PI * 0.42;
      elP.add(daggerGrp);
    });
  } else if (hid === "terrakor") {
    const stoneTex = createHeroMaterialSet(0x065f46, 0xfbbf24, "plate");
    const earthMat = makeHeroPBRMaterial(stoneTex, { bumpScale: 0.16 });
    const titanStations = [
      { y: 0.04, rx: 0.52, rz: 0.38, h2: 0.05 },
      { y: 0.44, rx: 0.58, rz: 0.42, h2: 0.06 },
      {
        y: 0.88,
        rx: 0.78,
        rz: 0.52,
        archFront: 0.14,
        archBack: 0.1,
        h2: 0.09,
      },
      {
        y: 1.28,
        rx: 0.9,
        rz: 0.56,
        archFront: 0.12,
        archBack: 0.1,
        h2: 0.1,
      },
      { y: 1.5, rx: 0.54, rz: 0.36 },
      { y: 1.58, rx: 0.26, rz: 0.24 },
    ];
    torso.add(buildLoftedMesh(titanStations, 20, earthMat));

    [leftShoulder, rightShoulder].forEach((sp, i) => {
      const side = i === 0 ? -1 : 1;
      const boulder = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.46, 0),
        earthMat,
      );
      boulder.position.set(side * 0.16, 0.22, 0);
      const runeGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        coreMat,
      );
      runeGem.position.set(side * 0.22, 0.66, 0);
      sp.add(boulder, runeGem);
    });

    const face = buildRefinedHeroFace(
      0xa7f3d0,
      0x34d399,
      0x1c1917,
      "terrakor",
    );
    neckPivot.add(face);

    const totemGrp = new THREE.Group();
    totemGrp.position.set(0, -0.62, 0.08);
    const headBlock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.42, 2.35, 7),
      earthMat,
    );
    headBlock.position.y = 1.15;
    const runeCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      coreMat,
    );
    runeCore.position.set(0, 1.55, 0.38);
    totemGrp.add(headBlock, runeCore);
    totemGrp.rotation.x = Math.PI * 0.36;
    rightElbow.add(totemGrp);
  } else if (hid === "aurelia") {
    const valkTex = createHeroMaterialSet(0xf59e0b, 0xbae6fd, "plate");
    const valkMat = makeHeroPBRMaterial(valkTex, {
      bumpScale: 0.09,
      side: THREE.DoubleSide,
    });
    const valkStations = [
      { y: 0.04, rx: 0.35, rz: 0.25 },
      { y: 0.46, rx: 0.34, rz: 0.24 },
      { y: 0.94, rx: 0.48, rz: 0.34, archFront: 0.09, h2: 0.06 },
      { y: 1.26, rx: 0.53, rz: 0.33, archFront: 0.05, h2: 0.08 },
      { y: 1.48, rx: 0.36, rz: 0.25 },
      { y: 1.54, rx: 0.21, rz: 0.2 },
    ];
    torso.add(buildLoftedMesh(valkStations, 26, valkMat));

    [-1, 1].forEach((side) => {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.24, 1.36, -0.26);
      for (let w = 0; w < 3; w++) {
        const feather = new THREE.Mesh(
          new THREE.ConeGeometry(0.18 - w * 0.02, 1.85 - w * 0.24, 4),
          w === 0 ? trimMat : coreMat,
        );
        feather.scale.set(1.25, 1.0, 0.2);
        feather.position.set(
          side * (0.52 + w * 0.28),
          0.08 - w * 0.3,
          -0.06 - w * 0.04,
        );
        feather.rotation.z = -side * (0.68 + w * 0.18);
        wingPivot.add(feather);
      }
      torso.add(wingPivot);
      if (side < 0) extraParts.leftWing = wingPivot;
      else extraParts.rightWing = wingPivot;
    });

    const face = buildRefinedHeroFace(
      0xf7dcc6,
      0x38bdf8,
      0xfacc15,
      "aurelia",
    );
    neckPivot.add(face);
    const circlet = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.024, 8, 24),
      trimMat,
    );
    circlet.rotation.x = Math.PI / 2;
    circlet.position.set(0, 0.45, 0);
    neckPivot.add(circlet);

    const spearGrp = new THREE.Group();
    spearGrp.position.set(0, -0.6, 0.06);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.042, 3.25, 8),
      trimMat,
    );
    shaft.position.y = 0.72;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.9, 4),
      coreMat,
    );
    tip.position.y = 2.6;
    spearGrp.add(shaft, tip);
    spearGrp.rotation.x = Math.PI * 0.38;
    rightElbow.add(spearGrp);
  } else if (hid === "kaelthar") {
    const chronoTex = createHeroMaterialSet(0x1e3a8a, 0x22d3ee, "cloth");
    const chronoMat = makeHeroPBRMaterial(chronoTex, {
      bumpScale: 0.08,
      side: THREE.DoubleSide,
    });
    const robeStations = [
      { y: 0.04, rx: 0.38, rz: 0.27 },
      { y: 0.44, rx: 0.42, rz: 0.3 },
      { y: 0.88, rx: 0.58, rz: 0.38, archFront: 0.08, h2: 0.06 },
      { y: 1.24, rx: 0.66, rz: 0.4, archFront: 0.06, h2: 0.08 },
      { y: 1.48, rx: 0.42, rz: 0.28 },
      { y: 1.54, rx: 0.22, rz: 0.2 },
    ];
    torso.add(buildLoftedMesh(robeStations, 26, chronoMat));

    const astrolabeHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.38, 0.055, 8, 36),
      trimMat,
    );
    astrolabeHalo.position.set(0, 1.52, -0.28);
    const innerDial = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.035, 6, 24),
      coreMat,
    );
    astrolabeHalo.add(innerDial);
    for (let spk = 0; spk < 8; spk++) {
      const a = (spk / 8) * Math.PI * 2;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.42, 0.05),
        trimMat,
      );
      tick.position.set(Math.cos(a) * 1.16, Math.sin(a) * 1.16, 0);
      tick.rotation.z = a + Math.PI / 2;
      astrolabeHalo.add(tick);
    }
    torso.add(astrolabeHalo);
    extraParts.backHalo = astrolabeHalo;

    capePivot.add(buildDrapedCapeMesh(1.22, 1.74, 1.96, 5, chronoMat));
    const face = buildRefinedHeroFace(
      0xe0f2fe,
      0x22d3ee,
      0xfacc15,
      "kaelthar",
    );
    neckPivot.add(face);

    const staffGrp = new THREE.Group();
    staffGrp.position.set(0, -0.6, 0.08);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.05, 2.85, 10),
      trimMat,
    );
    shaft.position.y = 0.65;
    const hgRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.032, 8, 20),
      coreMat,
    );
    hgRing.position.y = 2.1;
    staffGrp.add(shaft, hgRing);
    staffGrp.rotation.x = Math.PI * 0.34;
    rightElbow.add(staffGrp);
  } else if (hid === "valkyra") {
    const bloodPlateTex = createHeroMaterialSet(
      0x881337,
      0xfbbf24,
      "plate",
    );
    const bloodMat = makeHeroPBRMaterial(bloodPlateTex, {
      bumpScale: 0.1,
    });
    const vkrStations = [
      { y: 0.04, rx: 0.36, rz: 0.25 },
      { y: 0.46, rx: 0.34, rz: 0.24 },
      { y: 0.94, rx: 0.49, rz: 0.34, archFront: 0.09, h2: 0.06 },
      { y: 1.26, rx: 0.54, rz: 0.33, archFront: 0.05, h2: 0.08 },
      { y: 1.48, rx: 0.36, rz: 0.25 },
      { y: 1.54, rx: 0.21, rz: 0.2 },
    ];
    torso.add(buildLoftedMesh(vkrStations, 26, bloodMat));

    [leftShoulder, rightShoulder].forEach((sp, i) => {
      const side = i === 0 ? -1 : 1;
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.76, 5),
        coreMat,
      );
      horn.position.set(side * 0.2, 0.28, 0);
      horn.rotation.z = -side * 0.62;
      sp.add(horn);
    });

    const face = buildRefinedHeroFace(
      0xf0c4a2,
      0xf43f5e,
      0x1e1b4b,
      "valkyra",
    );
    neckPivot.add(face);

    const axeGrp = new THREE.Group();
    axeGrp.position.set(0, -0.6, 0.06);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.05, 3.1, 10),
      obsidianMat,
    );
    shaft.position.y = 0.72;
    const bladeL = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.52,
        0.52,
        0.08,
        12,
        1,
        false,
        0,
        Math.PI,
      ),
      coreMat,
    );
    bladeL.rotation.z = Math.PI / 2;
    bladeL.position.set(-0.24, 1.95, 0);
    const bladeR = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.52,
        0.52,
        0.08,
        12,
        1,
        false,
        0,
        Math.PI,
      ),
      coreMat,
    );
    bladeR.rotation.z = -Math.PI / 2;
    bladeR.position.set(0.24, 1.95, 0);
    axeGrp.add(shaft, bladeL, bladeR);
    axeGrp.rotation.x = Math.PI * 0.36;
    rightElbow.add(axeGrp);
  } else if (hid === "dravenor") {
    const warlockTex = createHeroMaterialSet(0x3b0764, 0xf97316, "cloth");
    const warlockMat = makeHeroPBRMaterial(warlockTex, {
      bumpScale: 0.08,
      side: THREE.DoubleSide,
    });
    const drvStations = [
      { y: 0.04, rx: 0.42, rz: 0.29 },
      { y: 0.44, rx: 0.46, rz: 0.33 },
      { y: 0.88, rx: 0.64, rz: 0.42, archFront: 0.09, h2: 0.07 },
      { y: 1.26, rx: 0.74, rz: 0.44, archFront: 0.07, h2: 0.09 },
      { y: 1.48, rx: 0.46, rz: 0.3 },
      { y: 1.56, rx: 0.24, rz: 0.22 },
    ];
    torso.add(buildLoftedMesh(drvStations, 26, warlockMat));

    const orbL = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 0),
      coreMat,
    );
    orbL.position.set(-0.92, 1.88, -0.1);
    const orbR = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 0),
      coreMat,
    );
    orbR.position.set(0.92, 1.88, -0.1);
    torso.add(orbL, orbR);
    extraParts.leftOrb = orbL;
    extraParts.rightOrb = orbR;

    capePivot.add(buildDrapedCapeMesh(1.32, 1.86, 2.02, 5, warlockMat));
    const face = buildRefinedHeroFace(
      0xe9d5ff,
      0xf97316,
      0x311042,
      "dravenor",
    );
    neckPivot.add(face);
    const hoodPeak = new THREE.Mesh(
      new THREE.ConeGeometry(0.34, 0.48, 6),
      warlockMat,
    );
    hoodPeak.position.set(0, 0.56, -0.06);
    hoodPeak.rotation.x = -0.35;
    neckPivot.add(hoodPeak);

    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.58, 0.16),
      coreMat,
    );
    book.position.set(-0.08, -0.58, 0.2);
    leftElbow.add(book);

    const staffGrp = new THREE.Group();
    staffGrp.position.set(0, -0.6, 0.08);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.054, 2.95, 10),
      obsidianMat,
    );
    shaft.position.y = 0.7;
    const crownGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      coreMat,
    );
    crownGem.position.y = 2.24;
    staffGrp.add(shaft, crownGem);
    staffGrp.rotation.x = Math.PI * 0.34;
    rightElbow.add(staffGrp);
  } else if (hid === "nyxia") {
    torso.position.set(0, 0.22, 0.42);
    const dryadTex = createHeroMaterialSet(0x065f46, 0xbef264, "scale");
    const dryadMat = makeHeroPBRMaterial(dryadTex, {
      bumpScale: 0.08,
      side: THREE.DoubleSide,
    });
    const blossomGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0x84cc16,
      emissiveIntensity: 1.15,
      roughness: 0.24,
    });
    const livingWoodTex = createHeroMaterialSet(
      0x5c4033,
      0xa16207,
      "cloth",
    );
    const livingWoodMat = makeHeroPBRMaterial(livingWoodTex, {
      bumpScale: 0.09,
    });

    for (let pi = 0; pi < 8; pi++) {
      const pAng = (pi / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 0.56, 6),
        pi % 2 === 0 ? stagLeafMat : dryadMat,
      );
      petal.position.set(
        Math.sin(pAng) * 0.34,
        0.04,
        Math.cos(pAng) * 0.34,
      );
      petal.rotation.set(
        Math.cos(pAng) * 0.52,
        0,
        -Math.sin(pAng) * 0.52,
      );
      torso.add(petal);
    }

    const nyxStations = [
      { y: 0.04, rx: 0.32, rz: 0.23 },
      { y: 0.46, rx: 0.29, rz: 0.21 },
      { y: 0.92, rx: 0.45, rz: 0.31, archFront: 0.08, h2: 0.06 },
      { y: 1.25, rx: 0.48, rz: 0.3, archFront: 0.04, h2: 0.08 },
      { y: 1.48, rx: 0.33, rz: 0.23 },
      { y: 1.54, rx: 0.2, rz: 0.19 },
    ];
    torso.add(buildLoftedMesh(nyxStations, 26, dryadMat));

    [leftShoulder, rightShoulder].forEach((sp, si) => {
      const side = si === 0 ? -1 : 1;
      const leafPauldron = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.44, 6),
        stagLeafMat,
      );
      leafPauldron.position.set(side * 0.08, 0.06, 0);
      leafPauldron.rotation.z = -side * 0.92;
      sp.add(leafPauldron);
    });

    const quiverGrp = new THREE.Group();
    quiverGrp.position.set(0.22, 1.05, -0.34);
    quiverGrp.rotation.z = -0.38;
    const quiverBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.08, 0.88, 10),
      livingWoodMat,
    );
    quiverGrp.add(quiverBody);
    for (let ai = 0; ai < 4; ai++) {
      const aAng = (ai / 4) * Math.PI * 2;
      const fletch = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.22, 4),
        blossomGlowMat,
      );
      fletch.position.set(
        Math.cos(aAng) * 0.045,
        0.52,
        Math.sin(aAng) * 0.045,
      );
      quiverGrp.add(fletch);
    }
    torso.add(quiverGrp);

    const face = buildRefinedHeroFace(
      0xdcfce7,
      0x10b981,
      0x14532d,
      "nyxia",
    );
    neckPivot.add(face);

    [-1, 1].forEach((side) => {
      const antlerGrp = new THREE.Group();
      antlerGrp.position.set(side * 0.16, 0.48, 0.02);
      antlerGrp.rotation.z = -side * 0.34;

      const mainBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.048, 0.78, 8),
        trimMat,
      );
      mainBeam.position.y = 0.36;
      antlerGrp.add(mainBeam);

      const tineOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.03, 0.44, 7),
        trimMat,
      );
      tineOuter.position.set(side * 0.14, 0.42, 0.05);
      tineOuter.rotation.set(0.25, 0, -side * 0.62);
      antlerGrp.add(tineOuter);

      const tineInner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.026, 0.36, 7),
        trimMat,
      );
      tineInner.position.set(-side * 0.08, 0.56, -0.04);
      tineInner.rotation.set(-0.2, 0, side * 0.48);
      antlerGrp.add(tineInner);

      const topBlossom = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.085, 0),
        blossomGlowMat,
      );
      topBlossom.position.set(0, 0.76, 0);
      const sideBlossom = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.062, 0),
        blossomGlowMat,
      );
      sideBlossom.position.set(side * 0.26, 0.58, 0.08);
      antlerGrp.add(topBlossom, sideBlossom);

      neckPivot.add(antlerGrp);
    });

    const bowGrp = new THREE.Group();
    bowGrp.position.set(0, -0.58, 0.14);
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(1.14, 0.052, 8, 28, Math.PI * 0.94),
      livingWoodMat,
    );
    arc.rotation.y = Math.PI / 2;
    arc.rotation.z = -Math.PI * 0.47;
    const innerGlowArc = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.024, 6, 24, Math.PI * 0.88),
      coreMat,
    );
    innerGlowArc.rotation.y = Math.PI / 2;
    innerGlowArc.rotation.z = -Math.PI * 0.44;
    const bowString = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 2.22, 6),
      blossomGlowMat,
    );
    bowString.position.set(0, 0, -0.14);
    bowGrp.add(arc, innerGlowArc, bowString);
    leftElbow.add(bowGrp);
  } else if (hid === "thalindor") {
    const seaTex = createHeroMaterialSet(0x0e7490, 0x38bdf8, "scale");
    const seaMat = makeHeroPBRMaterial(seaTex, { bumpScale: 0.12 });
    const thaStations = [
      { y: 0.04, rx: 0.46, rz: 0.32, h2: 0.04 },
      { y: 0.44, rx: 0.52, rz: 0.36, h2: 0.06 },
      {
        y: 0.88,
        rx: 0.72,
        rz: 0.46,
        archFront: 0.1,
        archBack: 0.12,
        h2: 0.08,
      },
      {
        y: 1.28,
        rx: 0.84,
        rz: 0.5,
        archFront: 0.08,
        archBack: 0.12,
        h2: 0.1,
      },
      { y: 1.5, rx: 0.5, rz: 0.34 },
      { y: 1.58, rx: 0.25, rz: 0.23 },
    ];
    torso.add(buildLoftedMesh(thaStations, 26, seaMat));

    const carapace = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.95,
        16,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.55,
      ),
      seaMat,
    );
    carapace.rotation.x = -Math.PI * 0.42;
    carapace.position.set(0, 1.05, -0.35);
    torso.add(carapace);

    const face = buildRefinedHeroFace(
      0xcffafe,
      0x06b6d4,
      0x164e63,
      "thalindor",
    );
    neckPivot.add(face);
    const finCrest = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.62, 4),
      coreMat,
    );
    finCrest.position.set(0, 0.6, -0.02);
    neckPivot.add(finCrest);

    const clawUpper = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.95, 6),
      coreMat,
    );
    clawUpper.position.set(-0.08, -0.62, 0.32);
    clawUpper.rotation.x = Math.PI * 0.45;
    leftElbow.add(clawUpper);

    const tridentGrp = new THREE.Group();
    tridentGrp.position.set(0, -0.6, 0.06);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 3.1, 10),
      silverTrimMat,
    );
    shaft.position.y = 0.7;
    const crossbar = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.12, 0.14),
      silverTrimMat,
    );
    crossbar.position.y = 2.15;
    tridentGrp.add(shaft, crossbar);
    [-0.34, 0, 0.34].forEach((px, idx) => {
      const prong = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, idx === 1 ? 0.88 : 0.68, 5),
        coreMat,
      );
      prong.position.set(px, idx === 1 ? 2.58 : 2.48, 0);
      tridentGrp.add(prong);
    });
    tridentGrp.rotation.x = Math.PI * 0.36;
    rightElbow.add(tridentGrp);
  } else if (hid === "solenne") {
    const prismTex = createHeroMaterialSet(0xfce7f3, 0xf472b6, "plate");
    const prismMat = makeHeroPBRMaterial(prismTex, { bumpScale: 0.06 });
    const solStations = [
      { y: 0.04, rx: 0.34, rz: 0.24 },
      { y: 0.46, rx: 0.32, rz: 0.23 },
      { y: 0.92, rx: 0.47, rz: 0.33, archFront: 0.08, h2: 0.06 },
      { y: 1.25, rx: 0.51, rz: 0.32, archFront: 0.04, h2: 0.08 },
      { y: 1.48, rx: 0.35, rz: 0.24 },
      { y: 1.54, rx: 0.2, rz: 0.19 },
    ];
    torso.add(buildLoftedMesh(solStations, 8, prismMat));

    const prismHalo = new THREE.Group();
    prismHalo.position.set(0, 1.5, -0.25);
    for (let sh = 0; sh < 6; sh++) {
      const ang = (sh / 6) * Math.PI * 2;
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        sh % 2 === 0 ? coreMat : silverTrimMat,
      );
      shard.scale.set(0.65, 1.85, 0.35);
      shard.position.set(Math.cos(ang) * 1.15, Math.sin(ang) * 1.15, 0);
      shard.rotation.z = ang - Math.PI / 2;
      prismHalo.add(shard);
    }
    torso.add(prismHalo);
    extraParts.backHalo = prismHalo;

    const face = buildRefinedHeroFace(
      0xfff1f2,
      0xf472b6,
      0xfacc15,
      "solenne",
    );
    neckPivot.add(face);

    const scepterGrp = new THREE.Group();
    scepterGrp.position.set(0, -0.6, 0.08);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.044, 2.75, 8),
      silverTrimMat,
    );
    shaft.position.y = 0.62;
    const prismGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3, 0),
      coreMat,
    );
    prismGem.position.y = 2.12;
    scepterGrp.add(shaft, prismGem);
    scepterGrp.rotation.x = Math.PI * 0.34;
    rightElbow.add(scepterGrp);
  } else if (hid === "garrick") {
    const ironTex = createHeroMaterialSet(0x44403c, 0xfb923c, "plate");
    const ironMat = makeHeroPBRMaterial(ironTex, { bumpScale: 0.14 });
    const garStations = [
      { y: 0.04, rx: 0.5, rz: 0.36, h2: 0.05 },
      { y: 0.44, rx: 0.56, rz: 0.4, h2: 0.06 },
      {
        y: 0.88,
        rx: 0.76,
        rz: 0.5,
        archFront: 0.12,
        archBack: 0.08,
        h2: 0.09,
      },
      {
        y: 1.28,
        rx: 0.88,
        rz: 0.54,
        archFront: 0.1,
        archBack: 0.08,
        h2: 0.1,
      },
      { y: 1.5, rx: 0.54, rz: 0.36 },
      { y: 1.58, rx: 0.26, rz: 0.24 },
    ];
    torso.add(buildLoftedMesh(garStations, 24, ironMat));

    const furnaceCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.2, 16),
      coreMat,
    );
    furnaceCore.rotation.x = Math.PI / 2;
    furnaceCore.position.set(0, 0.98, 0.54);
    torso.add(furnaceCore);

    [-0.44, 0.44].forEach((cx) => {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, 1.15, 10),
        ironMat,
      );
      stack.position.set(cx, 1.72, -0.36);
      stack.rotation.z = cx < 0 ? 0.18 : -0.18;
      const emberTop = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        coreMat,
      );
      emberTop.position.set(cx * 1.15, 2.3, -0.36);
      torso.add(stack, emberTop);
    });

    const face = buildRefinedHeroFace(
      0xf0c4a2,
      0xfb923c,
      0x78350f,
      "garrick",
    );
    neckPivot.add(face);

    const waraxeGrp = new THREE.Group();
    waraxeGrp.position.set(0, -0.62, 0.08);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 2.95, 10),
      obsidianMat,
    );
    shaft.position.y = 0.7;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.22, 0.72, 0.16),
      ironMat,
    );
    head.position.y = 1.92;
    const edgeGlow = new THREE.Mesh(
      new THREE.BoxGeometry(1.32, 0.64, 0.06),
      coreMat,
    );
    edgeGlow.position.y = 1.92;
    waraxeGrp.add(shaft, head, edgeGlow);
    waraxeGrp.rotation.x = Math.PI * 0.36;
    rightElbow.add(waraxeGrp);
  } else {
    const moonTex = createHeroMaterialSet(0x134e4a, 0x2dd4bf, "cloth");
    const moonMat = makeHeroPBRMaterial(moonTex, {
      bumpScale: 0.07,
      side: THREE.DoubleSide,
    });
    const serStations = [
      { y: 0.04, rx: 0.34, rz: 0.24 },
      { y: 0.46, rx: 0.32, rz: 0.23 },
      { y: 0.92, rx: 0.47, rz: 0.33, archFront: 0.08, h2: 0.06 },
      { y: 1.25, rx: 0.51, rz: 0.32, archFront: 0.04, h2: 0.08 },
      { y: 1.48, rx: 0.35, rz: 0.24 },
      { y: 1.54, rx: 0.2, rz: 0.19 },
    ];
    torso.add(buildLoftedMesh(serStations, 26, moonMat));

    const moonHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.045, 8, 28, Math.PI * 1.45),
      coreMat,
    );
    moonHalo.position.set(0, 1.5, -0.25);
    torso.add(moonHalo);
    extraParts.backHalo = moonHalo;

    const face = buildRefinedHeroFace(
      0xecfdf5,
      0x2dd4bf,
      0xe2e8f0,
      "seraphina",
    );
    neckPivot.add(face);

    [leftElbow, rightElbow].forEach((elP) => {
      const chakram = new THREE.Mesh(
        new THREE.TorusGeometry(0.54, 0.06, 8, 24),
        coreMat,
      );
      chakram.position.set(0, -0.6, 0.18);
      chakram.rotation.x = Math.PI / 2;
      elP.add(chakram);
    });
  }

  // Archetype Ground Sigils & Orbiting Wisps
  let groundSigil = null;
  const orbitWisps = [];
  const isLevitator = [
    "kaelthar",
    "solenne",
    "seraphina",
    "aurelia",
    "zephyros",
  ].includes(hid);
  const isJuggernaut = [
    "terrakor",
    "garrick",
    "thalindor",
    "malakor",
  ].includes(hid);

  if (isLevitator || isJuggernaut) {
    const sigilGroup = new THREE.Group();
    sigilGroup.position.y = 0.11;
    const sigilOuter = new THREE.Mesh(
      new THREE.RingGeometry(
        isJuggernaut ? 1.35 : 1.05,
        isJuggernaut ? 1.52 : 1.18,
        isLevitator ? 6 : 8,
      ),
      new THREE.MeshBasicMaterial({
        color: heroCfg.primaryHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.58,
      }),
    );
    sigilOuter.rotation.x = -Math.PI / 2;
    sigilGroup.add(sigilOuter);
    root.add(sigilGroup);
    groundSigil = sigilGroup;
  }

  if (
    [
      "nyxia",
      "kaelthar",
      "solenne",
      "thalindor",
      "ignis",
      "seraphina",
    ].includes(hid)
  ) {
    const wispCount = hid === "seraphina" ? 2 : 3;
    for (let wi = 0; wi < wispCount; wi++) {
      const wGeo =
        hid === "seraphina"
          ? new THREE.TorusGeometry(0.32, 0.04, 6, 16, Math.PI * 1.3)
          : new THREE.OctahedronGeometry(0.14, 0);
      const wMesh = new THREE.Mesh(
        wGeo,
        wi % 2 === 0 ? coreMat : trimMat,
      );
      torso.add(wMesh);
      orbitWisps.push({
        mesh: wMesh,
        angle: (wi / wispCount) * Math.PI * 2,
        radius: hid === "seraphina" ? 1.35 : 1.12,
        baseY: 1.12 + (wi % 2) * 0.25,
        speed: hid === "kaelthar" ? 2.2 : 1.6,
      });
    }
  }

  // Always attach layered signature armor, gauntlets, greaves & tailored war-capes across all quality presets
  const sigArmorCtx = {
    root,
    isPreview,
    isHudPortrait,
    hid,
    isFem,
    isDjinn,
    isCentaur,
    isDwarf,
    isGolem,
    isLeviathan,
    isCrystal,
    hips,
    torso,
    neckPivot,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    capePivot,
    coreMat,
    trimMat,
    goldTrimMat,
    silverTrimMat,
    obsidianMat,
    limbMat,
    bootMat,
  };
  attachHeroSignatureArmor(sigArmorCtx);
  if (sigArmorCtx.umaxCrown) extraParts.umaxCrown = sigArmorCtx.umaxCrown;
  if (sigArmorCtx.umaxWeapAura)
    extraParts.umaxWeapAura = sigArmorCtx.umaxWeapAura;
  if (sigArmorCtx.umaxGroundRing)
    extraParts.umaxGroundRing = sigArmorCtx.umaxGroundRing;

  const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 22, 22),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.34,
      wireframe: true,
    }),
  );
  shieldBubble.position.y = 1.9;
  shieldBubble.visible = false;
  root.add(shieldBubble);

  const radAura = new THREE.Mesh(
    new THREE.RingGeometry(6.8, 7.25, 48),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    }),
  );
  radAura.rotation.x = -Math.PI / 2;
  radAura.position.y = 0.14;
  radAura.visible = false;
  root.add(radAura);

  return {
    group: root,
    parts: {
      hips,
      torso,
      neckPivot,
      leftShoulder,
      leftElbow,
      rightShoulder,
      rightElbow,
      leftHip,
      leftKnee,
      leftAnkle,
      rightHip,
      rightKnee,
      rightAnkle,
      capePivot,
      shieldBubble,
      radAura,
      groundSigil,
      orbitWisps,
      djinnVortexRings,
      hindLeftHip,
      hindRightHip,
      hindLeftKnee,
      hindRightKnee,
      hindLeftAnkle,
      hindRightAnkle,
      tailBase,
      tailMid,
      tailTip,
      heroId: hid,
      ...extraParts,
    },
  };
}

function updateHeroSkeletalAnimation(
  parts,
  state,
  time,
  dt,
  isRanged = false,
  stateProgress = 0,
  turnRoll = 0,
  comboIdx = 0,
  speedRatio = 1.0,
) {
  if (!parts || !parts.hips) return;
  const k = Math.min(1, dt * 16);
  const hid = parts.heroId || "";
  const isDjinn = hid === "zephyros";
  const isCentaur = hid === "nyxia";
  const isLevitator = [
    "kaelthar",
    "solenne",
    "seraphina",
    "aurelia",
    "zephyros",
  ].includes(hid);
  const isHeavy = [
    "terrakor",
    "garrick",
    "thalindor",
    "malakor",
  ].includes(hid);
  const isAgile = ["vespera", "sylphira"].includes(hid);

  // Speed-synchronized phase accumulator & smooth locomotion blend (prevents foot-sliding & abrupt snaps)
  const baseFreq = isCentaur
    ? 12.6
    : hid === "terrakor"
      ? 8.4
      : hid === "garrick"
        ? 12.4
        : isHeavy
          ? 9.6
          : isAgile
            ? 13.2
            : 11.4;
  const clampedSpeedRatio = THREE.MathUtils.clamp(
    speedRatio || 1.0,
    0.55,
    1.75,
  );
  parts.stridePhase =
    (parts.stridePhase || 0) +
    dt * baseFreq * (state === "RUN" ? clampedSpeedRatio : 0.35);
  parts.runBlend = THREE.MathUtils.lerp(
    parts.runBlend || 0,
    state === "RUN" ? 1 : 0,
    Math.min(1, dt * 11),
  );
  const rb = parts.runBlend;

  if (parts.groundSigil) {
    parts.groundSigil.rotation.y = time * (isLevitator ? 1.15 : -0.55);
  }
  if (
    parts.djinnVortexRings &&
    parts.djinnVortexRings.length > 0 &&
    state !== "RUN"
  ) {
    for (let vi = 0; vi < parts.djinnVortexRings.length; vi++) {
      const vr = parts.djinnVortexRings[vi];
      vr.rotation.z = time * (vi % 2 === 0 ? 5.5 : -5.5);
      vr.rotation.x += (Math.PI / 2 - vr.rotation.x) * k;
      vr.position.x =
        Math.sin(time * 4.5 + vi * 0.8) * (0.04 + vi * 0.02);
      vr.position.z += (0 - vr.position.z) * k;
    }
  }
  if (parts.orbitWisps && parts.orbitWisps.length > 0) {
    for (let wi = 0; wi < parts.orbitWisps.length; wi++) {
      const w = parts.orbitWisps[wi];
      const ang = w.angle + time * w.speed;
      w.mesh.position.set(
        Math.cos(ang) * w.radius,
        w.baseY + Math.sin(time * 3.6 + wi * 2.1) * 0.16,
        Math.sin(ang) * w.radius,
      );
      w.mesh.rotation.y = time * 2.6;
    }
  }

  const baseHipY = isDjinn
    ? 1.75
    : isCentaur
      ? 1.48
      : isLevitator
        ? 1.68
        : 1.42;
  let targetHipX = 0,
    targetHipY = baseHipY,
    targetHipZ = 0;
  let targetHipRotX = 0,
    targetHipRotY = 0,
    targetHipRotZ = turnRoll;
  let targetTorsoX = 0,
    targetTorsoY = 0;
  let targetHeadX = 0,
    targetHeadY = 0,
    targetHeadZ = 0;
  let lHipX = 0,
    lKneeX = 0,
    lAnkleX = 0;
  let rHipX = 0,
    rKneeX = 0,
    rAnkleX = 0;
  let lShX = 0,
    lShZ = -0.14,
    lElX = -0.25;
  let rShX = 0,
    rShZ = 0.14,
    rElX = -0.35;
  let capeX = 0.12;
  let wingSweepY = 0,
    wingFlapZ = 0;

  if (parts.leftOrb && parts.rightOrb) {
    const orbPulse = 1.0 + Math.sin(time * 5.5) * 0.14;
    parts.leftOrb.scale.setScalar(orbPulse);
    parts.rightOrb.scale.setScalar(orbPulse);
  }
  if (parts.backHalo) {
    parts.backHalo.rotation.z = time * 1.4;
  }
  if (
    parts.neckPivot &&
    parts.neckPivot.children[0] &&
    parts.neckPivot.children[0].userData.eyelids
  ) {
    const blinkPhase = (time * 0.37) % 1.0;
    const blinkAmt =
      blinkPhase > 0.94
        ? Math.sin(((blinkPhase - 0.94) / 0.06) * Math.PI)
        : 0;
    const lidRotX = -Math.PI * 0.48 + blinkAmt * Math.PI * 0.46;
    parts.neckPivot.children[0].userData.eyelids.forEach((lid) => {
      lid.rotation.x = lidRotX;
    });
  }

  if (state === "DEATH") {
    const p = THREE.MathUtils.clamp(stateProgress, 0, 1);
    targetHipY = baseHipY - p * 1.12;
    targetHipRotX = -p * 1.42;
    targetHipRotZ = p * 0.24;
    lShX = -p * 0.6;
    lShZ = -0.75 * p;
    rShX = -p * 0.5;
    rShZ = 0.75 * p;
    capeX = 0.04;
  } else if (state === "STUNNED") {
    targetHipY = baseHipY - 0.14 + Math.sin(time * 6.0) * 0.04;
    targetTorsoX = 0.34;
    targetTorsoY = Math.sin(time * 4.5) * 0.18;
    targetHeadX = 0.28;
    targetHeadY = Math.sin(time * 7.5) * 0.32;
    targetHeadZ = Math.cos(time * 7.5) * 0.22;
    lHipX = -0.22;
    lKneeX = 0.42;
    lAnkleX = -0.18;
    rHipX = -0.18;
    rKneeX = 0.38;
    rAnkleX = -0.16;
    lShX = 0.24;
    lShZ = -0.28;
    lElX = -0.15;
    rShX = 0.24;
    rShZ = 0.28;
    rElX = -0.15;
    capeX = 0.08;
  } else if (state === "CELEBRATE") {
    const jump = Math.abs(Math.sin(time * 9.5)) * 0.95;
    targetHipY = baseHipY + jump;
    targetTorsoY = time * 8.5;
    lShX = -2.65;
    lShZ = -0.35;
    lElX = -0.2;
    rShX = -2.85;
    rShZ = 0.35;
    rElX = -0.2;
    capeX = 0.55;
    wingFlapZ = 0.22;
  } else if (state === "WHIRLWIND") {
    targetHipY = baseHipY + 0.12;
    targetTorsoY = time * 21.0;
    targetTorsoX = 0.12;
    lShX = -1.45;
    lShZ = -1.15;
    lElX = -0.15;
    rShX = -1.45;
    rShZ = 1.15;
    rElX = -0.15;
    capeX = 0.78;
  } else if (state === "RUN") {
    const cyc = parts.stridePhase;
    const sinC = Math.sin(cyc);
    const cosC = Math.cos(cyc);
    const sin2C = Math.sin(cyc * 2);

    if (isDjinn) {
      // Zephyros: Aerodynamic legless storm-djinn glide with trailing S-wave vortex rings
      targetHipY = 1.78 + Math.sin(time * 4.2) * 0.08;
      targetHipRotZ = turnRoll * 1.45;
      targetTorsoX = 0.34;
      targetTorsoY = Math.sin(time * 2.6) * 0.08;
      targetHeadX = -0.22;
      lShX = 0.42;
      lShZ = -0.34;
      lElX = -0.35;
      rShX = -0.24;
      rShZ = 0.26;
      rElX = -0.58;
      capeX = 0.65;
      if (parts.djinnVortexRings) {
        for (let vi = 0; vi < parts.djinnVortexRings.length; vi++) {
          const vr = parts.djinnVortexRings[vi];
          vr.rotation.z = time * (vi % 2 === 0 ? 7.5 : -7.5);
          vr.rotation.x = Math.PI / 2 - 0.16 - vi * 0.055;
          vr.position.z = -0.05 - vi * 0.11;
          vr.position.x =
            Math.sin(time * 6.0 - vi * 0.7) * (0.04 + vi * 0.025);
        }
      }
    } else if (isCentaur) {
      // Nyxia: Natural Biomechanical Cervine Trot/Canter with Counter-Stabilized Dryad Torso & Flowing Tail
      const foreAmp = 0.68 * rb;
      const hindAmp = 0.66 * rb;
      const hindPhase = cyc + 0.24; // Subtle phase lag so hind hooves drive naturally after forelegs
      const sinH = Math.sin(hindPhase);
      const cosH = Math.cos(hindPhase);

      // Double-beat suspension bounce + natural spine pitch wave
      const bounce = Math.abs(cosC) * 0.115 * rb;
      const stanceYield = Math.abs(sinC) * 0.045 * rb;
      targetHipY = 1.46 + bounce - stanceYield;
      targetHipX = -sinC * 0.055 * rb;
      targetHipRotX = 0.055 + sin2C * 0.048 * rb;
      targetHipRotZ = turnRoll * 1.15 + sinC * 0.045 * rb;

      // Upper dryad torso counter-balances the stag spine so her bow & head stay steady
      targetTorsoX = -0.045 - sin2C * 0.036 * rb;
      targetTorsoY = sinC * 0.09 * rb;
      targetHeadX = -0.02;
      targetHeadY = -sinC * 0.07 * rb;
      targetHeadZ = -turnRoll * 0.35;

      // Front legs: forward swing folds knee upward (+) and flexes fetlock/hoof naturally
      lHipX = sinC * foreAmp;
      lKneeX = (Math.max(0, -cosC) * 0.92 + Math.max(0, cosC) * 0.1) * rb;
      lAnkleX = (-sinC * 0.28 + Math.max(0, -cosC) * 0.34) * rb;

      rHipX = -sinC * foreAmp;
      rKneeX = (Math.max(0, cosC) * 0.92 + Math.max(0, -cosC) * 0.1) * rb;
      rAnkleX = (sinC * 0.28 + Math.max(0, cosC) * 0.34) * rb;

      // Hind legs: diagonal pairing (FL+BR, FR+BL) with authentic reverse-bending hock joint (-)
      if (parts.hindLeftHip && parts.hindRightHip) {
        parts.hindLeftHip.rotation.x = -sinH * hindAmp - 0.06 * rb;
        parts.hindRightHip.rotation.x = sinH * hindAmp - 0.06 * rb;
      }
      if (parts.hindLeftKnee && parts.hindRightKnee) {
        parts.hindLeftKnee.rotation.x =
          (0.24 - Math.max(0, cosH) * 0.78) * rb;
        parts.hindRightKnee.rotation.x =
          (0.24 - Math.max(0, -cosH) * 0.78) * rb;
      }
      if (parts.hindLeftAnkle && parts.hindRightAnkle) {
        parts.hindLeftAnkle.rotation.x =
          (sinH * 0.26 - Math.max(0, cosH) * 0.24) * rb;
        parts.hindRightAnkle.rotation.x =
          (-sinH * 0.26 - Math.max(0, -cosH) * 0.24) * rb;
      }
      if (parts.tailBase && parts.tailMid && parts.tailTip) {
        parts.tailBase.rotation.x = 0.28 + sin2C * 0.16 * rb;
        parts.tailBase.rotation.y = cosC * 0.24 * rb;
        parts.tailMid.rotation.x =
          0.18 + Math.sin(cyc * 2 - 0.7) * 0.2 * rb;
        parts.tailMid.rotation.y = Math.cos(cyc - 0.7) * 0.26 * rb;
        parts.tailTip.rotation.y = Math.cos(cyc - 1.4) * 0.3 * rb;
      }

      // Natural archer running arm carriage (bow held ready across body, right arm counter-swinging)
      lShX = -0.44 + sinC * 0.1 * rb;
      lShZ = -0.22;
      lElX = -0.56;
      rShX = 0.24 - sinC * 0.34 * rb;
      rShZ = 0.2;
      rElX = -0.46 - Math.max(0, -sinC) * 0.22 * rb;
    } else if (isLevitator) {
      // Kael'Thar, Solenne, Seraphina, Aurelia: Harmonic aerial hover-glide
      const glideBob = Math.sin(time * 4.4);
      targetHipY = 1.74 + glideBob * 0.09;
      targetHipX = hid === "seraphina" ? Math.sin(time * 2.8) * 0.09 : 0;
      targetHipRotZ =
        turnRoll * 1.35 +
        (hid === "seraphina" ? Math.sin(time * 2.8) * 0.06 : 0);
      targetTorsoX = hid === "aurelia" ? 0.3 : 0.22;
      targetTorsoY = Math.sin(time * 2.4) * 0.08;
      targetHeadX = -targetTorsoX * 0.65;
      lHipX = 0.18 + glideBob * 0.06;
      lKneeX = 0.36;
      lAnkleX = 0.28;
      rHipX = 0.38 - glideBob * 0.06;
      rKneeX = 0.52;
      rAnkleX = 0.34;
      if (hid === "aurelia") {
        lShX = 0.34;
        lShZ = -0.32;
        lElX = -0.38;
        rShX = -0.62;
        rShZ = 0.22;
        rElX = -0.48;
        wingSweepY = 0.26;
        wingFlapZ = Math.sin(time * 7.2) * 0.14;
      } else {
        lShX = 0.28;
        lShZ = -0.28;
        lElX = -0.34;
        rShX = 0.24;
        rShZ = 0.28;
        rElX = -0.42;
      }
      capeX = 0.62 + glideBob * 0.08;
    } else {
      // Grounded Bipedal Heroes tailored to heavy/dwarven/crab/ninja/knight anatomy
      const isDwarf = hid === "garrick";
      const isNinja = hid === "vespera";
      const isCrab = hid === "thalindor";
      const hipAmp =
        (isNinja ? 0.92 : isDwarf ? 0.66 : isHeavy ? 0.68 : 0.78) * rb;
      const kneeAmp =
        (isNinja ? 1.18 : isDwarf ? 0.82 : isHeavy ? 0.78 : 0.96) * rb;
      const swayAmp = (isHeavy ? 0.14 : isAgile ? 0.05 : 0.08) * rb;
      const hipRollAmp = (isDwarf ? 0.11 : isHeavy ? 0.085 : 0.045) * rb;

      // Hip drops at double-support stride extension so planted feet stay grounded
      const stanceLift = Math.abs(cosC) * (isHeavy ? 0.13 : 0.11) * rb;
      const strideDrop = Math.abs(sinC) * (isHeavy ? 0.09 : 0.07) * rb;
      targetHipY = (isNinja ? 1.34 : 1.42) + stanceLift - strideDrop;
      targetHipX = -sinC * swayAmp;
      targetHipRotY = -sinC * (isHeavy ? 0.13 : 0.09) * rb;
      targetHipRotZ = turnRoll + sinC * hipRollAmp;

      // Upper torso counter-rotates against pelvis; head stabilizes forward
      targetTorsoX =
        (isNinja ? 0.36 : isCrab ? 0.3 : isHeavy ? 0.23 : 0.17) * rb;
      targetTorsoY = sinC * (isHeavy ? 0.22 : 0.15) * rb;
      targetHeadX = -targetTorsoX * 0.62;
      targetHeadY = -sinC * 0.09 * rb;

      // Thigh swing + Swing-phase knee fold + Stance-loading knee yield + Heel-to-toe ankle roll
      lHipX = sinC * hipAmp;
      lKneeX =
        Math.max(0, -cosC) * kneeAmp + Math.max(0, cosC) * 0.14 * rb;
      lAnkleX = (-sinC * 0.32 + Math.max(0, -cosC) * 0.28) * rb;

      rHipX = -sinC * hipAmp;
      rKneeX =
        Math.max(0, cosC) * kneeAmp + Math.max(0, -cosC) * 0.14 * rb;
      rAnkleX = (sinC * 0.32 + Math.max(0, cosC) * 0.28) * rb;

      if (isNinja) {
        lShX = 0.62 + sinC * 0.16;
        lShZ = -0.26;
        lElX = -0.32;
        rShX = 0.62 - sinC * 0.16;
        rShZ = 0.26;
        rElX = -0.32;
      } else if (hid === "aurelius" || isCrab) {
        lShX = -0.42 - sinC * 0.22;
        lShZ = -0.22;
        lElX = -0.62;
        rShX = sinC * 0.62;
        rShZ = 0.18;
        rElX = -0.45 - Math.max(0, -sinC) * 0.35;
      } else if (hid === "sylphira" || hid === "dravenor") {
        lShX = -0.48 - sinC * 0.14;
        lShZ = -0.2;
        lElX = -0.68;
        rShX = sinC * 0.54;
        rShZ = 0.18;
        rElX = -0.42 - Math.max(0, -sinC) * 0.32;
      } else {
        const armAmp = (isDwarf ? 0.72 : 0.6) * rb;
        lShX = -sinC * armAmp;
        lElX = -0.42 - Math.max(0, sinC) * 0.38;
        rShX = sinC * armAmp;
        rElX = -0.42 - Math.max(0, -sinC) * 0.38;
      }
      if (hid === "ignis") {
        wingSweepY = 0.24;
        wingFlapZ = Math.sin(cyc) * 0.1;
      }
      capeX = (isNinja ? 0.66 : 0.44) + sin2C * 0.11;
    }
  } else if (state === "ATTACK") {
    const p = THREE.MathUtils.clamp(stateProgress, 0, 1);
    let curve = 0;
    if (p < 0.28) curve = -(p / 0.28) * 0.9;
    else if (p < 0.68)
      curve = -0.9 + Math.sin(((p - 0.28) / 0.4) * Math.PI * 0.5) * 2.25;
    else curve = 1.35 * (1 - (p - 0.68) / 0.32);

    const cStep = comboIdx % 3;
    const lunge = Math.max(0, curve) * (cStep === 2 ? 0.32 : 0.18);
    targetHipZ = lunge;
    targetHipY =
      baseHipY +
      (cStep === 2 ? Math.sin(p * Math.PI) * 0.26 : -lunge * 0.18);

    if (isRanged) {
      if (cStep === 1) {
        targetTorsoY = -curve * 0.3;
        rShX = -1.22;
        rShZ = -0.22;
        rElX = -0.24;
        lShX = -1.36 - curve * 0.24;
        lShZ = 0.22;
        lElX = -1.28 + curve * 0.44;
      } else if (cStep === 2) {
        targetTorsoX = curve * 0.15;
        lShX = -1.45 - curve * 0.18;
        lShZ = 0.18;
        lElX = -0.2;
        rShX = -1.45 - curve * 0.18;
        rShZ = -0.18;
        rElX = -0.2;
      } else {
        targetTorsoY = curve * 0.34;
        lShX = -1.25;
        lShZ = 0.24;
        lElX = -0.22;
        rShX = -1.32 - curve * 0.22;
        rShZ = -0.22;
        rElX = -1.3 + curve * 0.42;
      }
    } else {
      if (cStep === 1) {
        targetTorsoY = -curve * 0.42;
        targetTorsoX = curve * 0.14;
        lShX = -1.35 + curve * 1.25;
        lShZ = -0.28;
        lElX = -0.35 + curve * 0.45;
        rShX = 0.35 - curve * 0.2;
      } else if (cStep === 2) {
        targetTorsoX = -0.22 + curve * 0.48;
        targetTorsoY = curve * 0.18;
        rShX = -1.85 + curve * 1.75;
        lShX = -1.65 + curve * 1.55;
        rElX = -0.22;
        lElX = -0.22;
      } else {
        targetTorsoY = curve * 0.36;
        targetTorsoX = curve * 0.12;
        rShX = -1.28 + curve * 1.22;
        rElX = -0.3 + curve * 0.48;
        lShX = 0.35 - curve * 0.22;
      }
    }
    capeX = 0.28 + Math.max(0, curve) * 0.22;
  } else if (state === "CAST") {
    if (isCentaur) {
      // Graceful Sylvan Stag-Dryad Rear & Nature Invocation
      targetHipY = baseHipY + 0.22 + Math.sin(time * 7.5) * 0.04;
      targetHipRotX = -0.22;
      targetTorsoX = -0.1;
      lHipX = -0.62;
      lKneeX = 0.92;
      lAnkleX = 0.25;
      rHipX = -0.44;
      rKneeX = 0.78;
      rAnkleX = 0.2;
      if (parts.hindLeftHip && parts.hindRightHip) {
        parts.hindLeftHip.rotation.x +=
          (0.24 - parts.hindLeftHip.rotation.x) * k;
        parts.hindRightHip.rotation.x +=
          (0.2 - parts.hindRightHip.rotation.x) * k;
      }
      if (parts.hindLeftKnee && parts.hindRightKnee) {
        parts.hindLeftKnee.rotation.x +=
          (-0.34 - parts.hindLeftKnee.rotation.x) * k;
        parts.hindRightKnee.rotation.x +=
          (-0.3 - parts.hindRightKnee.rotation.x) * k;
      }
      if (parts.tailBase) parts.tailBase.rotation.x = 0.42;
    } else {
      targetHipY = isLevitator ? 1.78 : baseHipY + 0.06;
      targetTorsoX = -0.12;
    }
    lShX = -2.2;
    lShZ = -0.35;
    lElX = -0.35;
    rShX = -2.2;
    rShZ = 0.35;
    rElX = -0.35;
    capeX = 0.35;
    wingFlapZ = 0.18;
    parts.castClock = (parts.castClock || 0) + dt;
    const cw = Math.min(1, parts.castClock / 0.17);
    const rel = cw * cw * (3 - 2 * cw);
    const ck = parts.castKey || "R";
    if (ck === "Q") {
      // One-handed forward thrust
      targetTorsoY = -0.55 + rel * 0.95;
      targetTorsoX = 0.1 + rel * 0.1;
      targetHipZ = rel * 0.22;
      rShX = -0.5 - rel * 1.15;
      rShZ = 0.1;
      rElX = -1.2 + rel * 1.05;
      lShX = 0.45 - rel * 0.25;
      lShZ = -0.42;
      lElX = -0.75;
      capeX = 0.3 + rel * 0.25;
    } else if (ck === "W") {
      // Sweeping off-hand arc
      targetTorsoY = 0.6 - rel * 1.05;
      targetTorsoX = 0.16;
      targetHipY -= 0.1 * rel;
      lShX = -1.35;
      lShZ = -1.25 + rel * 1.15;
      lElX = -0.25;
      rShX = 0.25;
      rShZ = 0.45;
      rElX = -0.7;
    } else if (ck === "E") {
      // Brace, then burst outward
      targetTorsoX = 0.22 - rel * 0.4;
      targetHipY -= 0.12 * (1 - rel);
      lShX = -0.9 + rel * 0.2;
      lShZ = 0.35 - rel * 1.45;
      lElX = -1.5 + rel * 1.3;
      rShX = -0.9 + rel * 0.2;
      rShZ = -0.35 + rel * 1.45;
      rElX = -1.5 + rel * 1.3;
      capeX = 0.2 + rel * 0.45;
    } else {
      // Ultimate: rise and channel overhead
      targetHipY += 0.16 * rel;
      targetTorsoX = -0.12 - rel * 0.14;
      targetHeadX = -0.3 * rel;
      lShX = -2.2 - rel * 0.35;
      rShX = -2.2 - rel * 0.35;
      lShZ = -0.35 - (1 - rel) * 0.5;
      rShZ = 0.35 + (1 - rel) * 0.5;
      capeX = 0.35 + rel * 0.3;
      wingFlapZ = 0.3;
    }
  } else if (state === "PORTRAIT") {
    const breath = Math.sin(time * 2.2);
    targetHipY = baseHipY + breath * 0.015;
    targetTorsoY = 0.04;
    targetHeadY = Math.sin(time * 1.1) * 0.12;
    lShX = 0.06;
    lShZ = -0.26;
    lElX = -0.06;
    rShX = 0.06;
    rShZ = 0.26;
    rElX = -0.06;
    capeX = 0.08;
  } else {
    const breath = Math.sin(time * 2.4);
    if (isLevitator) {
      targetHipY = baseHipY + Math.sin(time * 2.6) * 0.09;
      targetTorsoX = 0.04 + breath * 0.02;
      targetHeadY = Math.sin(time * 1.2) * 0.14;
      lShX = -0.12;
      lShZ = -0.26 - breath * 0.04;
      lElX = -0.32;
      rShX = -0.12;
      rShZ = 0.26 + breath * 0.04;
      rElX = -0.32;
      wingFlapZ = breath * 0.06;
    } else if (isHeavy) {
      targetHipY = baseHipY - 0.02 + breath * 0.025;
      targetTorsoX = 0.07 + breath * 0.03;
      targetHeadY = Math.sin(time * 0.9) * 0.12;
      lShZ = -0.24 - breath * 0.03;
      rShZ = 0.24 + breath * 0.03;
    } else {
      const shift = Math.sin(time * 0.55);
      targetHipY = baseHipY + breath * 0.03;
      targetHipX = shift * 0.05;
      targetHipRotZ = turnRoll + shift * 0.022;
      targetTorsoX = breath * 0.03;
      targetTorsoY = Math.sin(time * 0.42) * 0.07;
      targetHeadY = Math.sin(time * 1.1) * 0.14 - shift * 0.05;
      lShX = Math.sin(time * 0.9) * 0.05;
      rShX = -Math.sin(time * 0.9) * 0.05;
      lShZ = -0.14 - breath * 0.03;
      rShZ = 0.14 + breath * 0.03;
      wingFlapZ = breath * 0.05;
    }
    if (isCentaur) {
      // Alert Sylvan woodland idle: staggered 4-hoof stance, gentle tail swish & head curiosity
      targetHipY = baseHipY + breath * 0.026;
      targetTorsoX = breath * 0.025;
      targetTorsoY = Math.sin(time * 0.95) * 0.065;
      targetHeadY = Math.sin(time * 0.78) * 0.16;
      targetHeadZ = Math.cos(time * 0.65) * 0.04;
      lHipX = -0.05;
      lKneeX = 0.08;
      lAnkleX = -0.03;
      rHipX = 0.06;
      rKneeX = 0.06;
      rAnkleX = -0.04;
      lShX = -0.24 + breath * 0.03;
      lShZ = -0.2;
      lElX = -0.48;
      rShX = 0.08 - breath * 0.03;
      rShZ = 0.18;
      rElX = -0.36;
      if (parts.hindLeftHip && parts.hindRightHip) {
        parts.hindLeftHip.rotation.x +=
          (0.05 - parts.hindLeftHip.rotation.x) * k;
        parts.hindRightHip.rotation.x +=
          (-0.06 - parts.hindRightHip.rotation.x) * k;
      }
      if (parts.hindLeftKnee && parts.hindRightKnee) {
        parts.hindLeftKnee.rotation.x +=
          (-0.1 - parts.hindLeftKnee.rotation.x) * k;
        parts.hindRightKnee.rotation.x +=
          (-0.08 - parts.hindRightKnee.rotation.x) * k;
      }
      if (parts.hindLeftAnkle && parts.hindRightAnkle) {
        parts.hindLeftAnkle.rotation.x +=
          (0.05 - parts.hindLeftAnkle.rotation.x) * k;
        parts.hindRightAnkle.rotation.x +=
          (0.06 - parts.hindRightAnkle.rotation.x) * k;
      }
      if (parts.tailBase && parts.tailMid && parts.tailTip) {
        parts.tailBase.rotation.x = 0.06 + Math.sin(time * 1.8) * 0.07;
        parts.tailBase.rotation.y = Math.sin(time * 1.25) * 0.22;
        parts.tailMid.rotation.y = Math.sin(time * 1.25 - 0.6) * 0.26;
        parts.tailTip.rotation.y = Math.sin(time * 1.25 - 1.2) * 0.3;
      }
    } else {
      if (parts.hindLeftHip && parts.hindRightHip) {
        parts.hindLeftHip.rotation.x *= 0.85;
        parts.hindRightHip.rotation.x *= 0.85;
      }
      if (parts.hindLeftKnee && parts.hindRightKnee) {
        parts.hindLeftKnee.rotation.x *= 0.85;
        parts.hindRightKnee.rotation.x *= 0.85;
      }
    }
  }

  parts.hips.position.x += (targetHipX - parts.hips.position.x) * k;
  parts.hips.position.y += (targetHipY - parts.hips.position.y) * k;
  parts.hips.position.z += (targetHipZ - parts.hips.position.z) * k;
  parts.hips.rotation.x += (targetHipRotX - parts.hips.rotation.x) * k;
  parts.hips.rotation.y += (targetHipRotY - parts.hips.rotation.y) * k;
  parts.hips.rotation.z += (targetHipRotZ - parts.hips.rotation.z) * k;
  nxgSpring(
    parts,
    "tx",
    parts.torso.rotation,
    "x",
    targetTorsoX,
    dt,
    20,
    0.66,
  );
  if (state === "CELEBRATE" || state === "WHIRLWIND")
    parts.torso.rotation.y = targetTorsoY;
  else
    parts.torso.rotation.y += (targetTorsoY - parts.torso.rotation.y) * k;
  nxgSpring(
    parts,
    "nx",
    parts.neckPivot.rotation,
    "x",
    targetHeadX,
    dt,
    17,
    0.7,
  );
  parts.neckPivot.rotation.y +=
    (targetHeadY - parts.neckPivot.rotation.y) * k;
  parts.neckPivot.rotation.z +=
    (targetHeadZ - parts.neckPivot.rotation.z) * k;

  parts.leftHip.rotation.x += (lHipX - parts.leftHip.rotation.x) * k;
  parts.leftKnee.rotation.x += (lKneeX - parts.leftKnee.rotation.x) * k;
  if (parts.leftAnkle)
    parts.leftAnkle.rotation.x +=
      (lAnkleX - parts.leftAnkle.rotation.x) * k;
  parts.rightHip.rotation.x += (rHipX - parts.rightHip.rotation.x) * k;
  parts.rightKnee.rotation.x += (rKneeX - parts.rightKnee.rotation.x) * k;
  if (parts.rightAnkle)
    parts.rightAnkle.rotation.x +=
      (rAnkleX - parts.rightAnkle.rotation.x) * k;

  nxgSpring(parts, "lsx", parts.leftShoulder.rotation, "x", lShX, dt);
  nxgSpring(parts, "lsz", parts.leftShoulder.rotation, "z", lShZ, dt);
  nxgSpring(
    parts,
    "lex",
    parts.leftElbow.rotation,
    "x",
    lElX,
    dt,
    27,
    0.66,
  );
  nxgSpring(parts, "rsx", parts.rightShoulder.rotation, "x", rShX, dt);
  nxgSpring(parts, "rsz", parts.rightShoulder.rotation, "z", rShZ, dt);
  nxgSpring(
    parts,
    "rex",
    parts.rightElbow.rotation,
    "x",
    rElX,
    dt,
    27,
    0.66,
  );

  if (parts.leftWing) {
    parts.leftWing.rotation.y +=
      (wingSweepY - parts.leftWing.rotation.y) * k;
    parts.leftWing.rotation.z +=
      (-wingFlapZ - parts.leftWing.rotation.z) * k;
  }
  if (parts.rightWing) {
    parts.rightWing.rotation.y +=
      (-wingSweepY - parts.rightWing.rotation.y) * k;
    parts.rightWing.rotation.z +=
      (wingFlapZ - parts.rightWing.rotation.z) * k;
  }
  if (parts.gownMesh) {
    const targetGownX = state === "RUN" ? -0.14 : 0;
    parts.gownMesh.rotation.x +=
      (targetGownX - parts.gownMesh.rotation.x) * k;
  }
  if (parts.capePivot) {
    const isMoving = state === "RUN" || state === "WHIRLWIND";
    const clothWave =
      Math.sin(time * (isMoving ? 11.5 : 3.2)) *
      (isMoving ? 0.09 : 0.025);
    parts.capePivot.rotation.x +=
      (capeX + clothWave - parts.capePivot.rotation.x) * k;
    const targetCapeZ = isMoving
      ? THREE.MathUtils.clamp(-turnRoll * 0.65, -0.22, 0.22)
      : Math.cos(time * 2.4) * 0.02;
    parts.capePivot.rotation.z +=
      (targetCapeZ - parts.capePivot.rotation.z) * k;

    // Zero-CPU GPU vertex shader wave simulation across all quality settings
    if (parts.capePivot.children.length > 0) {
      const cMesh = parts.capePivot.children[0];
      const cu = cMesh && cMesh.userData && cMesh.userData.capeUniforms;
      if (cu) {
        cu.uCapeTime.value = time;
        cu.uCapeAmp.value = isMoving
          ? 0.13 * clampedSpeedRatio
          : state === "ATTACK" || state === "CAST"
            ? 0.09
            : 0.035;
        cu.uCapeFreq.value = isMoving ? 12.0 : 3.6;
      }
    }
  }
  if (parts.umaxCrown) {
    const baseCrownY = parts.umaxCrown.userData.baseY || 0.56;
    parts.umaxCrown.position.y =
      baseCrownY + Math.sin(time * 3.0) * 0.018;
    if (parts.umaxCrown.userData.spinHalo) {
      parts.umaxCrown.userData.spinHalo.rotation.z = time * 2.2;
    }
    if (parts.umaxCrown.userData.apexGem) {
      parts.umaxCrown.userData.apexGem.rotation.y = time * 3.2;
      parts.umaxCrown.userData.apexGem.rotation.x =
        Math.sin(time * 2.4) * 0.35;
    }
  }
  if (parts.umaxRelicGroup) {
    const orbitSpd =
      state === "ATTACK" || state === "CAST" || state === "WHIRLWIND"
        ? 5.6
        : state === "RUN"
          ? 2.8
          : 1.45;
    parts.umaxRelicGroup.rotation.y = time * orbitSpd;
    parts.umaxRelicGroup.position.y = 1.48 + Math.sin(time * 3.2) * 0.11;
    const rKids = parts.umaxRelicGroup.children;
    for (let ri = 0; ri < rKids.length; ri++) {
      rKids[ri].rotation.x = time * 1.9 + ri;
      rKids[ri].rotation.y = time * 2.5 + ri * 1.3;
    }
  }
  if (parts.umaxCrest) {
    parts.umaxCrest.rotation.z = -time * (state === "CAST" ? 3.8 : 1.05);
    const cScale =
      state === "CAST" || state === "ATTACK"
        ? 1.14
        : 1.0 + Math.sin(time * 2.6) * 0.035;
    parts.umaxCrest.scale.setScalar(cScale);
  }
  if (parts.umaxWeapAura) {
    parts.umaxWeapAura.rotation.z =
      time * (state === "ATTACK" ? 9.5 : 2.8);
    const wScale =
      state === "ATTACK"
        ? 1.38
        : state === "CAST"
          ? 1.25
          : 1.0 + Math.sin(time * 4.0) * 0.08;
    parts.umaxWeapAura.scale.setScalar(wScale);
  }
  if (parts.umaxGroundRing) {
    parts.umaxGroundRing.rotation.z = -time * 0.9;
    parts.umaxGroundRing.material.opacity =
      state === "CAST" || state === "ATTACK" ? 0.76 : 0.44;
  }
}

const _creepArchetypeCache = new Map();
function getCreepArchetype(team, subType, isMega) {
  const key = `${team}_${subType}_${isMega ? 1 : 0}`;
  let arch = _creepArchetypeCache.get(key);
  if (arch) return arch;

  const isRad = team === "radiant";
  const isRanged = subType === "ranged";
  const sc = isMega ? 1.55 : 1.0;
  const armorCol = isMega
    ? isRad
      ? 0xfacc15
      : 0xdc2626
    : isRad
      ? isRanged
        ? 0x0284c7
        : 0x059669
      : isRanged
        ? 0x7e22ce
        : 0xbe123c;
  const trimCol = isMega ? 0xfef08a : isRad ? 0xa7f3d0 : 0xfecdd3;

  arch = {
    sc,
    bodyMat: registerSharedAsset(
      new THREE.MeshStandardMaterial({
        color: armorCol,
        metalness: isMega ? 0.78 : 0.45,
        roughness: 0.35,
      }),
    ),
    trimMat: registerSharedAsset(
      new THREE.MeshStandardMaterial({
        color: trimCol,
        emissive: isMega ? trimCol : 0x000000,
        emissiveIntensity: isMega ? 0.65 : 0.15,
      }),
    ),
    legMat: registerSharedAsset(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.65,
        metalness: 0.35,
      }),
    ),
    torsoGeo: registerSharedAsset(
      new THREE.CylinderGeometry(0.45 * sc, 0.38 * sc, 1.05 * sc, 12),
    ),
    pauldronGeo: registerSharedAsset(
      new THREE.SphereGeometry(0.24 * sc, 10, 10),
    ),
    limbGeo: registerSharedAsset(
      new THREE.CapsuleGeometry(0.11 * sc, 0.45 * sc, 6, 8),
    ),
    legGeo: registerSharedAsset(
      new THREE.CapsuleGeometry(0.12 * sc, 0.36 * sc, 6, 8),
    ),
    skullGeo: registerSharedAsset(
      new THREE.SphereGeometry(0.32 * sc, 12, 12),
    ),
    crestGeo: isRad
      ? registerSharedAsset(
          new THREE.BoxGeometry(0.08 * sc, 0.35 * sc, 0.45 * sc),
        )
      : null,
    hornGeo: !isRad
      ? registerSharedAsset(
          new THREE.ConeGeometry(0.08 * sc, 0.42 * sc, 5),
        )
      : null,
    staffGeo: isRanged
      ? registerSharedAsset(
          new THREE.CylinderGeometry(0.04 * sc, 0.04 * sc, 2.1 * sc, 8),
        )
      : null,
    orbGeo: isRanged
      ? registerSharedAsset(new THREE.OctahedronGeometry(0.22 * sc, 0))
      : null,
    shieldGeo: !isRanged
      ? registerSharedAsset(
          new THREE.BoxGeometry(0.12 * sc, 0.92 * sc, 0.62 * sc),
        )
      : null,
    bladeGeo: !isRanged
      ? registerSharedAsset(
          new THREE.BoxGeometry(0.1 * sc, 1.32 * sc, 0.22 * sc),
        )
      : null,
    auraGeo: isMega
      ? registerSharedAsset(new THREE.RingGeometry(1.15, 1.42, 24))
      : null,
    auraMat: isMega
      ? getCachedBasicMat(isRad ? 0xfacc15 : 0xf43f5e, false, 1.0, false)
      : null,
  };
  _creepArchetypeCache.set(key, arch);
  return arch;
}

function buildDetailedCreepMesh(team, subType, isMega) {
  const group = new THREE.Group();
  const isRad = team === "radiant";
  const isRanged = subType === "ranged";
  const arch = getCreepArchetype(team, subType, isMega);
  const sc = arch.sc;

  attachContactShadow(group, 0.92 * sc);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.52 * sc;
  group.add(bodyPivot);

  const torso = new THREE.Mesh(arch.torsoGeo, arch.bodyMat);
  torso.position.y = 0.52 * sc;
  torso.castShadow = isMega;
  bodyPivot.add(torso);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.5 * sc, 0.94 * sc, 0);
  bodyPivot.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.5 * sc, 0.94 * sc, 0);
  bodyPivot.add(rightArm);

  [leftArm, rightArm].forEach((armP) => {
    const pauldron = new THREE.Mesh(arch.pauldronGeo, arch.trimMat);
    armP.add(pauldron);
    const limb = new THREE.Mesh(arch.limbGeo, arch.bodyMat);
    limb.position.y = -0.32 * sc;
    armP.add(limb);
  });

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.22 * sc, 0.52 * sc, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.22 * sc, 0.52 * sc, 0);
  group.add(rightLeg);

  [leftLeg, rightLeg].forEach((lp) => {
    const legMesh = new THREE.Mesh(arch.legGeo, arch.legMat);
    legMesh.position.y = -0.24 * sc;
    legMesh.castShadow = isMega;
    lp.add(legMesh);
  });

  const head = new THREE.Group();
  head.position.y = 1.26 * sc;
  bodyPivot.add(head);

  const skull = new THREE.Mesh(arch.skullGeo, arch.bodyMat);
  head.add(skull);

  if (isRad) {
    const crest = new THREE.Mesh(arch.crestGeo, arch.trimMat);
    crest.position.set(0, 0.3 * sc, 0);
    head.add(crest);
  } else {
    [-0.22 * sc, 0.22 * sc].forEach((hx) => {
      const horn = new THREE.Mesh(arch.hornGeo, arch.trimMat);
      horn.position.set(hx, 0.28 * sc, 0);
      horn.rotation.z = hx < 0 ? 0.4 : -0.4;
      head.add(horn);
    });
  }

  let weaponOrb = null;
  if (isRanged) {
    const staff = new THREE.Mesh(arch.staffGeo, arch.trimMat);
    staff.position.set(0.06 * sc, -0.25 * sc, 0.25 * sc);
    rightArm.add(staff);
    weaponOrb = new THREE.Mesh(arch.orbGeo, arch.trimMat);
    weaponOrb.position.set(0.06 * sc, 0.85 * sc, 0.25 * sc);
    rightArm.add(weaponOrb);
  } else {
    const shield = new THREE.Mesh(arch.shieldGeo, arch.trimMat);
    shield.position.set(-0.08 * sc, -0.35 * sc, 0.22 * sc);
    leftArm.add(shield);
    const blade = new THREE.Mesh(arch.bladeGeo, arch.trimMat);
    blade.position.set(0.06 * sc, -0.2 * sc, 0.42 * sc);
    blade.rotation.x = 0.65;
    rightArm.add(blade);
  }

  if (isMega) {
    const aura = new THREE.Mesh(arch.auraGeo, arch.auraMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.08;
    group.add(aura);
  }

  return {
    group,
    parts: {
      bodyPivot,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      weaponOrb,
      baseY: 0.52 * sc,
    },
  };
}

function updateCreepAnimation(creep, time, dt, isMoving) {
  const p = creep.parts;
  if (!p || !p.bodyPivot) return;
  const k = Math.min(1, dt * 15);
  const isRanged = creep.subType === "ranged";
  const baseFreq = creep.isMega ? 9.2 : 11.4;
  p.stridePhase = (p.stridePhase || 0) + dt * (isMoving ? baseFreq : 2.8);

  let hipX = 0,
    hipY = p.baseY;
  let torsoX = 0,
    torsoY = 0,
    torsoZ = 0;
  let headY = 0;
  let lLegX = 0,
    rLegX = 0;
  let lArmX = 0,
    rArmX = 0;

  if (creep.swingAnim > 0) {
    const prog = 1 - creep.swingAnim / 0.34;
    const strike = Math.sin(prog * Math.PI);
    torsoY = strike * 0.35;
    rArmX = -1.35 * strike;
    lArmX = isRanged ? 0.25 * strike : -0.42 + 0.25 * strike;
  } else if (isMoving) {
    const cyc = p.stridePhase;
    const s = Math.sin(cyc);
    const c = Math.cos(cyc);
    hipY = p.baseY + Math.abs(c) * 0.1 - Math.abs(s) * 0.04;
    hipX = -s * 0.045;
    torsoX = creep.isMega ? 0.18 : 0.14;
    torsoY = s * 0.14;
    torsoZ = s * 0.05;
    headY = -s * 0.09;
    lLegX = s * 0.72;
    rLegX = -s * 0.72;
    if (isRanged) {
      lArmX = -s * 0.56;
      rArmX = -0.32 + s * 0.24;
    } else {
      // Melee soldier braces shield forward on left while sword arm pumps
      lArmX = -0.45 - s * 0.18;
      rArmX = s * 0.62;
    }
  } else {
    const breath = Math.sin(p.stridePhase);
    hipY = p.baseY + breath * 0.03;
    lArmX = isRanged ? 0 : -0.32;
    rArmX = -0.15 + breath * 0.05;
  }

  p.bodyPivot.position.x += (hipX - p.bodyPivot.position.x) * k;
  p.bodyPivot.position.y += (hipY - p.bodyPivot.position.y) * k;
  p.bodyPivot.rotation.x += (torsoX - p.bodyPivot.rotation.x) * k;
  p.bodyPivot.rotation.y += (torsoY - p.bodyPivot.rotation.y) * k;
  p.bodyPivot.rotation.z += (torsoZ - p.bodyPivot.rotation.z) * k;
  if (p.head) p.head.rotation.y += (headY - p.head.rotation.y) * k;
  p.leftLeg.rotation.x += (lLegX - p.leftLeg.rotation.x) * k;
  p.rightLeg.rotation.x += (rLegX - p.rightLeg.rotation.x) * k;
  p.leftArm.rotation.x += (lArmX - p.leftArm.rotation.x) * k;
  p.rightArm.rotation.x += (rArmX - p.rightArm.rotation.x) * k;
  if (p.weaponOrb) p.weaponOrb.rotation.y += dt * 3.5;
}

// Procedural AAA Creature PBR Texture Generator (Scales, Wing Membranes, Magma Basalt, Fur, Oni Lacquer)
const _creatureTexCache = {};
function getCreatureTextureSet(kind) {
  if (_creatureTexCache[kind]) return _creatureTexCache[kind];
  const size = 256;
  const cMap = document.createElement("canvas");
  const cBump = document.createElement("canvas");
  const cEmissive = document.createElement("canvas");
  cMap.width = cBump.width = cEmissive.width = size;
  cMap.height = cBump.height = cEmissive.height = size;
  const ctx = cMap.getContext("2d");
  const btx = cBump.getContext("2d");
  const etx = cEmissive.getContext("2d");

  etx.fillStyle = "#000000";
  etx.fillRect(0, 0, size, size);

  if (kind === "dragon_scales") {
    ctx.fillStyle = "#334155";
    ctx.fillRect(0, 0, size, size);
    btx.fillStyle = "#252525";
    btx.fillRect(0, 0, size, size);
    const rows = 14,
      cols = 10;
    const cellW = size / cols,
      cellH = size / rows;
    for (let r = -1; r <= rows; r++) {
      const shift = (r % 2) * (cellW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const cx = c * cellW + shift;
        const cy = r * cellH;
        const grad = ctx.createRadialGradient(
          cx,
          cy - cellH * 0.2,
          2,
          cx,
          cy,
          cellW * 0.65,
        );
        grad.addColorStop(0, "#94a3b8");
        grad.addColorStop(0.55, "#475569");
        grad.addColorStop(0.88, "#1e293b");
        grad.addColorStop(1, "#38bdf8");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, cellW * 0.56, 0, Math.PI);
        ctx.fill();

        const bGrad = btx.createRadialGradient(
          cx,
          cy - cellH * 0.15,
          2,
          cx,
          cy,
          cellW * 0.6,
        );
        bGrad.addColorStop(0, "#ffffff");
        bGrad.addColorStop(0.75, "#909090");
        bGrad.addColorStop(1, "#181818");
        btx.fillStyle = bGrad;
        btx.beginPath();
        btx.arc(cx, cy, cellW * 0.54, 0, Math.PI);
        btx.fill();
      }
    }
  } else if (kind === "dragon_wing") {
    const bg = ctx.createLinearGradient(0, 0, size, size);
    bg.addColorStop(0, "#1e293b");
    bg.addColorStop(0.5, "#334155");
    bg.addColorStop(1, "#0f172a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    btx.fillStyle = "#606060";
    btx.fillRect(0, 0, size, size);

    // Glowing lightning-vein filigree across wing membrane
    for (let v = 0; v < 18; v++) {
      const y0 = (v / 18) * size;
      ctx.strokeStyle =
        v % 3 === 0
          ? "rgba(56, 189, 248, 0.65)"
          : "rgba(148, 163, 184, 0.25)";
      ctx.lineWidth = v % 3 === 0 ? 2.5 : 1.2;
      etx.strokeStyle = v % 3 === 0 ? "#0284c7" : "#000000";
      etx.lineWidth = 2.2;
      ctx.beginPath();
      etx.beginPath();
      ctx.moveTo(0, y0);
      etx.moveTo(0, y0);
      for (let x = 32; x <= size; x += 32) {
        const wy = y0 + Math.sin(x * 0.05 + v) * 14;
        ctx.lineTo(x, wy);
        etx.lineTo(x, wy);
      }
      ctx.stroke();
      etx.stroke();
    }
  } else if (kind === "roshan_basalt") {
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 0, size, size);
    btx.fillStyle = "#1a1a1a";
    btx.fillRect(0, 0, size, size);
    // Craggy volcanic stone plates with glowing molten lava fissures
    for (let i = 0; i < 65; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const rad = 18 + Math.random() * 28;
      ctx.fillStyle = i % 2 === 0 ? "#292524" : "#36312e";
      btx.fillStyle = i % 2 === 0 ? "#d8d8d8" : "#a8a8a8";
      ctx.beginPath();
      btx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const rr = rad * (0.72 + ((i + k) % 3) * 0.14);
        const vx = px + Math.cos(a) * rr;
        const vy = py + Math.sin(a) * rr;
        if (k === 0) {
          ctx.moveTo(vx, vy);
          btx.moveTo(vx, vy);
        } else {
          ctx.lineTo(vx, vy);
          btx.lineTo(vx, vy);
        }
      }
      ctx.closePath();
      btx.closePath();
      ctx.fill();
      btx.fill();
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 2.2;
      ctx.stroke();
      etx.strokeStyle = "#f97316";
      etx.lineWidth = 2.0;
      etx.stroke();
    }
  } else if (kind === "kong_fur") {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, size, size);
    btx.fillStyle = "#505050";
    btx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 10 + Math.random() * 16;
      const tilt = (Math.random() - 0.5) * 4;
      ctx.strokeStyle =
        i % 5 === 0 ? "#3f3f46" : i % 9 === 0 ? "#52525b" : "#09090b";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + tilt, y + len);
      ctx.stroke();

      btx.strokeStyle = i % 3 === 0 ? "#dcdcdc" : "#303030";
      btx.lineWidth = 1.5;
      btx.beginPath();
      btx.moveTo(x, y);
      btx.lineTo(x + tilt, y + len);
      btx.stroke();
    }
  } else if (kind === "oni_lacquer") {
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(0, 0, size, size);
    btx.fillStyle = "#808080";
    btx.fillRect(0, 0, size, size);
    // Layered Samurai Lamellar Scale Bands + Gold Rivets
    for (let row = 0; row < 8; row++) {
      const y = row * 32;
      ctx.fillStyle = row % 2 === 0 ? "#991b1b" : "#6b1414";
      ctx.fillRect(0, y, size, 28);
      ctx.fillStyle = "#facc15";
      ctx.fillRect(0, y + 27, size, 3);
      btx.fillStyle = "#c8c8c8";
      btx.fillRect(0, y + 2, size, 24);
      btx.fillStyle = "#202020";
      btx.fillRect(0, y + 27, size, 5);
      for (let col = 0; col < 8; col++) {
        const rx = col * 32 + 16;
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(rx, y + 14, 2.5, 0, Math.PI * 2);
        ctx.fill();
        btx.fillStyle = "#ffffff";
        btx.beginPath();
        btx.arc(rx, y + 14, 3.0, 0, Math.PI * 2);
        btx.fill();
      }
    }
  }

  const map = new THREE.CanvasTexture(cMap);
  const bumpMap = new THREE.CanvasTexture(cBump);
  const emissiveMap = new THREE.CanvasTexture(cEmissive);
  map.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  [map, bumpMap, emissiveMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });
  const res = { map, bumpMap, emissiveMap };
  _creatureTexCache[kind] = res;
  return res;
}

// 1. SCULPTED CELESTIAL ELDER SKY-DRAGON (Lofted Wyrm Body, Crowned Horned Skull, Articulated Jaw, Phalangeal Storm Wings & 8-Segment Whip-Tail)
function buildElderDragonMesh() {
  const group = new THREE.Group();
  attachContactShadow(group, 4.4);

  const isUltraMax =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  const scaleTex = getCreatureTextureSet("dragon_scales");
  const wingTex = getCreatureTextureSet("dragon_wing");

  const scaleMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0xe0f2fe : 0xcbd5e1,
    map: scaleTex.map,
    bumpMap: scaleTex.bumpMap,
    bumpScale: isUltraMax ? 0.42 : 0.28,
    emissive: isUltraMax ? 0x0369a1 : 0x000000,
    emissiveIntensity: isUltraMax ? 0.22 : 0.0,
    roughness: isUltraMax ? 0.22 : 0.34,
    metalness: isUltraMax ? 0.74 : 0.56,
  });
  const bellyArmorMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0xf8fafc : 0xe2e8f0,
    roughness: isUltraMax ? 0.2 : 0.3,
    metalness: isUltraMax ? 0.86 : 0.72,
  });
  const obsidianPlateMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: isUltraMax ? 0.9 : 0.82,
    roughness: isUltraMax ? 0.18 : 0.24,
  });
  const plasmaMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0ea5e9,
    emissiveIntensity: isUltraMax ? 2.25 : 1.35,
    roughness: 0.16,
  });
  const goldCrestMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: isUltraMax ? 0.98 : 0.45,
    metalness: 0.92,
    roughness: 0.15,
  });
  const hornMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.88,
    roughness: 0.2,
  });

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 4.6;
  group.add(bodyPivot);

  // Lofted Multi-Station Muscular Wyrm Torso (oriented along +Z flight axis)
  const wyrmStations = [
    { y: -3.1, rx: 0.15, rz: 0.15 },
    { y: -2.2, rx: 1.05, rz: 0.95, h2: 0.05 },
    { y: -0.9, rx: 1.65, rz: 1.48, archFront: 0.18, h2: 0.08 },
    {
      y: 0.5,
      rx: 2.15,
      rz: 1.88,
      archFront: 0.28,
      archBack: 0.14,
      h2: 0.1,
    },
    { y: 1.8, rx: 1.85, rz: 1.62, archFront: 0.22, h2: 0.08 },
    { y: 2.8, rx: 1.12, rz: 1.05 },
    { y: 3.3, rx: 0.45, rz: 0.45 },
  ];
  const torso = buildLoftedMesh(wyrmStations, 28, scaleMat);
  torso.rotation.x = Math.PI / 2.08;
  bodyPivot.add(torso);

  // Overlapping Armored Sternum Scutes along Underbelly
  for (let b = 0; b < 7; b++) {
    const scute = new THREE.Mesh(
      new THREE.CylinderGeometry(
        1.42 - b * 0.09,
        1.54 - b * 0.09,
        0.56,
        16,
        1,
        false,
        Math.PI * 0.62,
        Math.PI * 0.76,
      ),
      bellyArmorMat,
    );
    scute.rotation.x = Math.PI / 2;
    scute.position.set(0, -0.78 - b * 0.03, 2.05 - b * 0.68);
    bodyPivot.add(scute);
  }

  // Recessed Celestial Storm-Heart Reactor with Gilded Rib Cage
  const chestCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.05, 1),
    plasmaMat,
  );
  chestCore.scale.set(1.0, 0.85, 1.25);
  chestCore.position.set(0, -0.68, 1.55);
  const coreFrame = new THREE.Mesh(
    new THREE.TorusGeometry(1.12, 0.12, 8, 24),
    goldCrestMat,
  );
  coreFrame.rotation.x = Math.PI / 2.4;
  coreFrame.position.set(0, -0.66, 1.55);
  bodyPivot.add(chestCore, coreFrame);

  // Swept Curved Dorsal Spine Blades along Torso Ridge
  for (let d = 0; d < 6; d++) {
    const finCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.48 - d * 0.05, 2.0 - d * 0.78),
      new THREE.Vector3(0, 2.15 - d * 0.07, 1.55 - d * 0.78),
      new THREE.Vector3(0, 2.65 - d * 0.08, 0.95 - d * 0.78),
    ]);
    bodyPivot.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(finCurve, 10, 0.16 - d * 0.012, 6, false),
        goldCrestMat,
      ),
    );
  }

  // Articulated 4 Wyvern/Dragon Limbs with Shoulder Caps, Thighs, Shins & 3 Curved Talons
  [
    [-1.52, -0.72, 1.55],
    [1.52, -0.72, 1.55],
    [-1.58, -0.88, -1.55],
    [1.58, -0.88, -1.55],
  ].forEach(([lx, ly, lz], idx) => {
    const limb = new THREE.Group();
    limb.position.set(lx, ly, lz);
    const shoulderCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.76, 14, 12),
      obsidianPlateMat,
    );
    limb.add(shoulderCap);
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.44, 1.15, 6, 12),
      scaleMat,
    );
    thigh.position.y = -0.58;
    thigh.rotation.x = idx < 2 ? 0.42 : -0.28;
    limb.add(thigh);
    const shin = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.95, 6, 10),
      obsidianPlateMat,
    );
    shin.position.set(0, -1.28, idx < 2 ? 0.25 : -0.15);
    shin.rotation.x = idx < 2 ? -0.35 : 0.35;
    limb.add(shin);
    [-0.24, 0, 0.24].forEach((cx) => {
      const claw = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.82, 5),
        goldCrestMat,
      );
      claw.position.set(cx, -1.78, idx < 2 ? 0.52 : 0.18);
      claw.rotation.x = Math.PI / 2.1;
      limb.add(claw);
    });
    bodyPivot.add(limb);
  });

  // 6-Segment Curved Serpentine Neck with Overlapping Dorsal Plumes
  const neckSegments = [];
  let parentNeck = bodyPivot;
  for (let s = 0; s < 6; s++) {
    const segPivot = new THREE.Group();
    segPivot.position.set(
      0,
      s === 0 ? 1.12 : 0.68,
      s === 0 ? 2.42 : 0.46,
    );
    const rad = 0.96 - s * 0.082;
    const jointCap = new THREE.Mesh(
      new THREE.SphereGeometry(rad * 0.96, 14, 12),
      scaleMat,
    );
    const segMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(rad * 0.86, rad, 0.92, 16),
      scaleMat,
    );
    segMesh.rotation.x = 0.44;
    segMesh.castShadow = true;
    segPivot.add(jointCap, segMesh);

    const spineFin = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.12, 5),
      plasmaMat,
    );
    spineFin.position.set(0, 0.64, -0.26);
    spineFin.rotation.x = -0.52;
    segPivot.add(spineFin);

    parentNeck.add(segPivot);
    neckSegments.push(segPivot);
    parentNeck = segPivot;
  }

  // Sculpted Horned Dragon Skull with Lofted Snout, Brow Ridges, Crown Horns, Gill Frills & Hinged Jaw
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.72, 0.52);
  parentNeck.add(headGroup);

  const skullStations = [
    { y: -0.65, rx: 0.72, rz: 0.75 },
    { y: 0.0, rx: 1.05, rz: 0.95, h2: 0.08 },
    { y: 0.75, rx: 0.96, rz: 0.85, archFront: 0.15 },
    { y: 1.55, rx: 0.64, rz: 0.54 },
    { y: 2.35, rx: 0.34, rz: 0.28 },
    { y: 2.55, rx: 0.08, rz: 0.08 },
  ];
  const cranium = buildLoftedMesh(skullStations, 22, obsidianPlateMat);
  cranium.rotation.x = Math.PI / 2;
  headGroup.add(cranium);

  // Gilded Nasal Crest & Flaring Plasma Nostrils
  const nasalCrest = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.95, 5),
    goldCrestMat,
  );
  nasalCrest.position.set(0, 0.48, 1.95);
  nasalCrest.rotation.x = 0.45;
  headGroup.add(nasalCrest);

  [-0.22, 0.22].forEach((nx) => {
    const nostril = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      plasmaMat,
    );
    nostril.position.set(nx, 0.22, 2.22);
    headGroup.add(nostril);
  });

  // Interlocking Upper & Lower Fangs
  [-0.36, 0.36].forEach((fx) => {
    const fang = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.52, 5),
      bellyArmorMat,
    );
    fang.position.set(fx, -0.18, 1.88);
    fang.rotation.x = Math.PI;
    headGroup.add(fang);
  });

  const lowerJawPivot = new THREE.Group();
  lowerJawPivot.position.set(0, -0.24, 0.25);
  headGroup.add(lowerJawPivot);

  const lowerJaw = new THREE.Mesh(
    new THREE.ConeGeometry(0.66, 2.2, 8),
    scaleMat,
  );
  lowerJaw.rotation.x = Math.PI / 2;
  lowerJaw.position.set(0, -0.05, 1.05);
  lowerJawPivot.add(lowerJaw);

  [-0.28, 0.28].forEach((fx) => {
    const lowerFang = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.36, 5),
      bellyArmorMat,
    );
    lowerFang.position.set(fx, 0.14, 1.65);
    lowerJawPivot.add(lowerFang);
  });

  const mawOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 12),
    plasmaMat,
  );
  mawOrb.position.set(0, 0.04, 0.82);
  headGroup.add(mawOrb);

  // Dual-Layer Volumetric Solar/Storm Dragonfire Breath Cone
  const fireCone = new THREE.Group();
  const outerBreath = new THREE.Mesh(
    new THREE.ConeGeometry(3.0, 12.0, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  outerBreath.rotation.x = Math.PI / 2;
  const innerBreath = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 10.5, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  innerBreath.rotation.x = Math.PI / 2;
  fireCone.add(outerBreath, innerBreath);
  fireCone.position.set(0, -0.25, 6.8);
  fireCone.visible = false;
  headGroup.add(fireCone);

  // Fierce Amber Slit-Pupil Eyes, Sculpted Brow Plates, Swept Crown Horns & Cheek Frills
  [-0.56, 0.56].forEach((ex) => {
    const side = ex < 0 ? -1 : 1;
    const browPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.16, 0.65),
      goldCrestMat,
    );
    browPlate.position.set(ex, 0.44, 0.72);
    browPlate.rotation.z = -side * 0.25;
    headGroup.add(browPlate);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    );
    eye.position.set(ex, 0.28, 0.74);
    headGroup.add(eye);

    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.34, 0.08),
      hornMat,
    );
    slit.position.set(ex, 0.28, 0.95);
    headGroup.add(slit);

    // Sweeping Primary Crown Horn + Secondary Cheek Horn
    const mainHornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ex * 0.75, 0.56, -0.05),
      new THREE.Vector3(ex * 1.45, 1.42, -1.25),
      new THREE.Vector3(ex * 1.18, 1.98, -2.55),
    ]);
    headGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(mainHornCurve, 16, 0.22, 8, false),
        hornMat,
      ),
    );

    const cheekHornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ex * 1.15, 0.05, 0.15),
      new THREE.Vector3(ex * 1.75, 0.35, -0.75),
      new THREE.Vector3(ex * 1.65, 0.68, -1.55),
    ]);
    headGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(cheekHornCurve, 12, 0.14, 7, false),
        goldCrestMat,
      ),
    );
  });

  // Articulated Phalangeal Storm-Dragon Wings with Veined Membranes & Wing-Tip Talons
  const wingMembraneMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0xbae6fd : 0x94a3b8,
    map: wingTex.map,
    emissive: 0x0ea5e9,
    emissiveMap: wingTex.emissiveMap,
    emissiveIntensity: isUltraMax ? 1.65 : 0.95,
    side: THREE.DoubleSide,
    roughness: isUltraMax ? 0.28 : 0.42,
    metalness: isUltraMax ? 0.46 : 0.3,
  });
  const leftWingInner = new THREE.Group();
  leftWingInner.position.set(-1.48, 1.28, 0.75);
  bodyPivot.add(leftWingInner);

  const rightWingInner = new THREE.Group();
  rightWingInner.position.set(1.48, 1.28, 0.75);
  bodyPivot.add(rightWingInner);

  let leftWingOuter = null;
  let rightWingOuter = null;

  [leftWingInner, rightWingInner].forEach((wp, idx) => {
    const side = idx === 0 ? -1 : 1;
    const shoulderJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 10),
      obsidianPlateMat,
    );
    wp.add(shoulderJoint);

    const innerShape = new THREE.Shape();
    innerShape.moveTo(0, 1.3);
    innerShape.lineTo(side * 4.3, 1.5);
    innerShape.quadraticCurveTo(side * 3.3, 0.0, side * 3.9, -1.9);
    innerShape.quadraticCurveTo(side * 2.0, -1.1, 0, -1.6);
    innerShape.closePath();

    const innerMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(innerShape, {
        depth: 0.08,
        bevelEnabled: false,
      }),
      wingMembraneMat,
    );
    innerMesh.rotation.x = Math.PI / 2;
    wp.add(innerMesh);

    const innerBone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 4.4, 8),
      obsidianPlateMat,
    );
    innerBone.rotation.z = Math.PI / 2;
    innerBone.position.set(side * 2.15, 0.06, 1.4);
    wp.add(innerBone);

    const outerPivot = new THREE.Group();
    outerPivot.position.set(side * 4.2, 0, 1.35);
    wp.add(outerPivot);

    const wristJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      goldCrestMat,
    );
    const wristClaw = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.75, 5),
      goldCrestMat,
    );
    wristClaw.position.set(side * 0.15, 0.12, 0.42);
    wristClaw.rotation.x = Math.PI / 2.2;
    outerPivot.add(wristJoint, wristClaw);

    const outerShape = new THREE.Shape();
    outerShape.moveTo(0, 0.15);
    outerShape.lineTo(side * 5.4, 0.45);
    outerShape.quadraticCurveTo(side * 3.9, -1.2, side * 4.3, -2.7);
    outerShape.quadraticCurveTo(side * 2.2, -2.1, side * 2.5, -3.4);
    outerShape.quadraticCurveTo(side * 1.0, -2.2, -side * 0.3, -3.2);
    outerShape.closePath();

    const outerMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(outerShape, {
        depth: 0.06,
        bevelEnabled: false,
      }),
      wingMembraneMat,
    );
    outerMesh.rotation.x = Math.PI / 2;
    outerPivot.add(outerMesh);

    [
      { len: 5.5, angY: 0.06, r: 0.15 },
      { len: 4.6, angY: 0.48, r: 0.11 },
      { len: 3.9, angY: 0.88, r: 0.09 },
    ].forEach((sp) => {
      const spar = new THREE.Mesh(
        new THREE.CylinderGeometry(sp.r, sp.r * 0.4, sp.len, 7),
        hornMat,
      );
      spar.rotation.z = Math.PI / 2;
      spar.rotation.y = side * sp.angY;
      spar.position.set(
        side * Math.cos(sp.angY) * sp.len * 0.5,
        0.04,
        -Math.sin(sp.angY) * sp.len * 0.5,
      );
      outerPivot.add(spar);
    });

    if (idx === 0) leftWingOuter = outerPivot;
    else rightWingOuter = outerPivot;
  });

  // 8-Segment Tapered Spiked Whip-Tail with Gilded Tail-Lance
  const tailSegments = [];
  let parentTail = bodyPivot;
  for (let t = 0; t < 8; t++) {
    const tPivot = new THREE.Group();
    tPivot.position.set(
      0,
      t === 0 ? -0.35 : -0.04,
      t === 0 ? -2.45 : -0.96,
    );
    const tRad = Math.max(0.12, 0.94 - t * 0.105);
    const tJoint = new THREE.Mesh(
      new THREE.SphereGeometry(tRad * 0.94, 10, 8),
      scaleMat,
    );
    const tSeg = new THREE.Mesh(
      new THREE.CylinderGeometry(tRad * 0.78, tRad, 1.08, 12),
      scaleMat,
    );
    tSeg.rotation.x = Math.PI / 2;
    tSeg.castShadow = true;
    tPivot.add(tJoint, tSeg);

    if (t >= 5) {
      const tailBlade = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62, 0),
        goldCrestMat,
      );
      tailBlade.scale.set(1.85, 0.22, 1.55);
      tailBlade.position.set(0, 0, -0.42);
      tPivot.add(tailBlade);
    }

    parentTail.add(tPivot);
    tailSegments.push(tPivot);
    parentTail = tPivot;
  }

  const bossRing = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.2, 48),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
    }),
  );
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.y = 0.25;
  group.add(bossRing);

  let umaxDragonHalo = null;
  let umaxDragonCoreOrbiters = null;
  let umaxGroundRingA = null;
  let umaxGroundRingB = null;
  if (isUltraMax) {
    // Celestial Astrolabe Halo & 6 Starlight Crown Prisms behind Dragon Skull
    umaxDragonHalo = new THREE.Group();
    umaxDragonHalo.position.set(0, 1.35, -0.75);
    const haloRingOuter = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.08, 10, 36),
      goldCrestMat,
    );
    const haloRingInner = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.055, 8, 28),
      plasmaMat,
    );
    umaxDragonHalo.add(haloRingOuter, haloRingInner);
    for (let ci = 0; ci < 6; ci++) {
      const ang = (ci / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        ci % 2 === 0 ? plasmaMat : goldCrestMat,
      );
      spike.scale.set(0.7, 1.7, 0.7);
      spike.position.set(Math.cos(ang) * 1.65, Math.sin(ang) * 1.65, 0);
      spike.rotation.z = ang - Math.PI / 2;
      umaxDragonHalo.add(spike);
    }
    headGroup.add(umaxDragonHalo);

    // Orbiting Tempest Lightning Crystals around Storm-Heart Reactor
    umaxDragonCoreOrbiters = new THREE.Group();
    umaxDragonCoreOrbiters.position.set(0, -0.68, 1.55);
    for (let oi = 0; oi < 4; oi++) {
      const ang = (oi / 4) * Math.PI * 2;
      const orbCry = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        oi % 2 === 0 ? plasmaMat : goldCrestMat,
      );
      orbCry.position.set(
        Math.cos(ang) * 1.65,
        Math.sin(ang) * 0.45,
        Math.sin(ang) * 1.65,
      );
      umaxDragonCoreOrbiters.add(orbCry);
    }
    bodyPivot.add(umaxDragonCoreOrbiters);

    // Wing-tip Celestial Starlight Nodes
    [leftWingOuter, rightWingOuter].forEach((ow, wIdx) => {
      if (!ow) return;
      const s = wIdx === 0 ? -1 : 1;
      const tipStar = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        plasmaMat,
      );
      tipStar.position.set(s * 5.4, 0.12, 0.45);
      ow.add(tipStar);
    });

    // Counter-rotating Sky-Mandala Ground Sigils
    umaxGroundRingA = new THREE.Mesh(
      new THREE.RingGeometry(5.35, 5.75, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      }),
    );
    umaxGroundRingA.rotation.x = -Math.PI / 2;
    umaxGroundRingA.position.y = 0.28;
    umaxGroundRingB = new THREE.Mesh(
      new THREE.RingGeometry(3.85, 4.25, 8),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.68,
      }),
    );
    umaxGroundRingB.rotation.x = -Math.PI / 2;
    umaxGroundRingB.position.y = 0.27;
    group.add(umaxGroundRingA, umaxGroundRingB);
  }

  return {
    group,
    parts: {
      bodyPivot,
      chestCore,
      neckSegments,
      headGroup,
      lowerJawPivot,
      mawOrb,
      fireCone,
      leftWingInner,
      rightWingInner,
      leftWingOuter,
      rightWingOuter,
      tailSegments,
      umaxDragonHalo,
      umaxDragonCoreOrbiters,
      umaxGroundRingA,
      umaxGroundRingB,
    },
  };
}

function updateElderDragonAnimation(dragon, time, dt) {
  const p = dragon.parts;
  if (!p || !p.bodyPivot) return;

  if (dragon.dragonAnimTimer > 0) {
    dragon.dragonAnimTimer = Math.max(0, dragon.dragonAnimTimer - dt);
    if (dragon.dragonAnimTimer === 0) dragon.dragonAnimState = "HOVER";
  }

  const st = dragon.dragonAnimState || "HOVER";
  const k = Math.min(1, dt * 12);
  const isFlying = !!(dragon.targetPos || dragon.targetUnit);

  // Asymmetric powerful downstroke vs brisk upstroke wingbeat
  const flapRate = st === "SKY_BREATH" ? 14.5 : isFlying ? 8.6 : 6.4;
  p.wingPhase = (p.wingPhase || 0) + dt * flapRate;
  const wp = p.wingPhase;
  const asymFlap = Math.sin(wp) + 0.22 * Math.sin(wp * 2);

  let targetY = 4.6 + Math.cos(wp - 0.5) * 0.36;
  let targetPitch = isFlying ? 0.16 : 0.06;
  let targetYawSpin = 0;
  let wingFlap = asymFlap * (isFlying ? 0.72 : 0.58);
  let jawOpen = 0.14 + Math.max(0, Math.sin(time * 2.1)) * 0.28;
  let mawScale = 0.6;
  let neckPitch = Math.sin(wp - 0.8) * 0.08;
  let tailSweep =
    Math.sin(time * (isFlying ? 5.6 : 4.2)) * (isFlying ? 0.32 : 0.24);
  let showFireCone = false;

  if (st === "LUNGE_BITE") {
    const prog = 1 - dragon.dragonAnimTimer / 0.55;
    const lunge = Math.sin(prog * Math.PI);
    targetY = 3.5 - lunge * 1.15;
    targetPitch = 0.36 * lunge;
    wingFlap = 0.88 * lunge;
    jawOpen = 0.88 * lunge;
    neckPitch = 0.24 * lunge;
    mawScale = 1.25;
  } else if (st === "TAIL_SWEEP") {
    const prog = 1 - dragon.dragonAnimTimer / 0.65;
    targetYawSpin = prog * Math.PI * 2;
    targetY = 5.1;
    wingFlap = 0.78;
    tailSweep = 0.52;
  } else if (st === "SKY_BREATH") {
    const prog = 1 - dragon.dragonAnimTimer / 0.85;
    const rear = Math.sin(prog * Math.PI);
    targetY = 5.6 + rear * 1.1;
    targetPitch = -0.26 * rear;
    wingFlap = asymFlap * 0.85;
    jawOpen = 0.94;
    mawScale = 2.8;
    neckPitch = -0.12 * rear;
    showFireCone = true;
  }

  p.bodyPivot.position.y += (targetY - p.bodyPivot.position.y) * k;
  p.bodyPivot.rotation.x += (targetPitch - p.bodyPivot.rotation.x) * k;
  p.bodyPivot.rotation.y = targetYawSpin;

  p.leftWingInner.rotation.z = wingFlap;
  p.rightWingInner.rotation.z = -wingFlap;
  if (p.leftWingOuter)
    p.leftWingOuter.rotation.z = Math.sin(wp - 0.55) * 0.65;
  if (p.rightWingOuter)
    p.rightWingOuter.rotation.z = -Math.sin(wp - 0.55) * 0.65;

  p.lowerJawPivot.rotation.x +=
    (jawOpen - p.lowerJawPivot.rotation.x) * k;
  p.mawOrb.scale.setScalar(mawScale);
  if (p.fireCone) {
    p.fireCone.visible = showFireCone;
    if (showFireCone) {
      p.fireCone.rotation.z += dt * 14;
      p.fireCone.scale.setScalar(0.9 + Math.sin(time * 28) * 0.18);
    }
  }

  p.neckSegments.forEach((seg, idx) => {
    seg.rotation.x = neckPitch - 0.05 + Math.sin(wp - idx * 0.45) * 0.06;
    seg.rotation.y = Math.sin(time * 2.2 - idx * 0.4) * 0.08;
  });

  p.tailSegments.forEach((seg, idx) => {
    seg.rotation.y = Math.sin(time * 5.0 - idx * 0.55) * tailSweep;
    seg.rotation.x = Math.cos(wp - idx * 0.42) * 0.08;
  });

  if (p.umaxDragonHalo) {
    p.umaxDragonHalo.rotation.z = time * 1.45;
  }
  if (p.umaxDragonCoreOrbiters) {
    p.umaxDragonCoreOrbiters.rotation.y = time * 3.1;
    p.umaxDragonCoreOrbiters.rotation.z = Math.sin(time * 2.0) * 0.25;
  }
  if (p.umaxGroundRingA) p.umaxGroundRingA.rotation.z = time * 0.65;
  if (p.umaxGroundRingB) p.umaxGroundRingB.rotation.z = -time * 0.95;
}

// 2. SCULPTED ROSHAN, THE IMMORTAL TITAN (Magma-Fissured Basalt Colossus, Broken Aegis Chains, Articulated Elbows/Knees & Jaw)
function buildRefinedRoshanMesh() {
  const group = new THREE.Group();
  attachContactShadow(group, 3.4);

  const isUltraMax =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  const basaltTex = getCreatureTextureSet("roshan_basalt");
  const graniteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: basaltTex.map,
    bumpMap: basaltTex.bumpMap,
    bumpScale: isUltraMax ? 0.46 : 0.32,
    emissive: 0xf97316,
    emissiveMap: basaltTex.emissiveMap,
    emissiveIntensity: isUltraMax ? 1.25 : 0.72,
    roughness: isUltraMax ? 0.48 : 0.64,
    metalness: isUltraMax ? 0.42 : 0.28,
  });
  const armorPlateMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0x292524 : 0x44403c,
    metalness: isUltraMax ? 0.88 : 0.74,
    roughness: isUltraMax ? 0.2 : 0.3,
  });
  const chainMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0xfbbf24 : 0x78716c,
    emissive: isUltraMax ? 0xd97706 : 0x000000,
    emissiveIntensity: isUltraMax ? 0.35 : 0.0,
    metalness: 0.88,
    roughness: 0.22,
  });
  const magmaMat = new THREE.MeshStandardMaterial({
    color: 0xfb923c,
    emissive: 0xf97316,
    emissiveIntensity: isUltraMax ? 2.25 : 1.35,
    roughness: 0.18,
  });

  const hips = new THREE.Group();
  hips.position.y = 2.15;
  group.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  // Lofted Titan Colossus Torso (Broad Hunched Back, Heavy Pectorals, Tapered Stone Pelvis)
  const roshanTorsoStations = [
    { y: -0.25, rx: 1.25, rz: 0.92 },
    { y: 0.25, rx: 1.48, rz: 1.08, h2: 0.05 },
    {
      y: 1.15,
      rx: 1.92,
      rz: 1.36,
      archFront: 0.22,
      archBack: 0.18,
      h2: 0.08,
    },
    {
      y: 2.15,
      rx: 2.42,
      rz: 1.62,
      archFront: 0.28,
      archBack: 0.32,
      h2: 0.1,
    },
    { y: 2.85, rx: 1.85, rz: 1.28, archBack: 0.22 },
    { y: 3.25, rx: 0.95, rz: 0.82 },
  ];
  torso.add(buildLoftedMesh(roshanTorsoStations, 24, graniteMat));

  // Heavy Chained Iron Aegis-Collar & Hanging Broken Shackles
  const ironCollar = new THREE.Mesh(
    new THREE.TorusGeometry(1.78, 0.24, 10, 24),
    chainMat,
  );
  ironCollar.rotation.x = Math.PI / 2.25;
  ironCollar.position.set(0, 2.75, 0.32);
  torso.add(ironCollar);

  [-1.35, 1.35].forEach((cx) => {
    for (let link = 0; link < 3; link++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.055, 6, 12),
        chainMat,
      );
      ring.position.set(cx, 2.25 - link * 0.28, 1.18 - link * 0.05);
      ring.rotation.y = (link % 2) * (Math.PI / 2);
      torso.add(ring);
    }
  });

  // Jagged Dorsal Magma Spires along Spine
  for (let s = 0; s < 4; s++) {
    const backSpike = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 1.48 - s * 0.16, 5),
      magmaMat,
    );
    backSpike.position.set(0, 2.65 - s * 0.48, -1.62 - s * 0.12);
    backSpike.rotation.x = -0.68;
    torso.add(backSpike);
  }

  // Recessed Molten Aegis Core Framed by Jagged Obsidian Ribs
  const magmaHeart = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.92, 1),
    magmaMat,
  );
  magmaHeart.position.set(0, 1.78, 1.72);
  const heartCage = new THREE.Mesh(
    new THREE.TorusGeometry(0.98, 0.14, 8, 18),
    armorPlateMat,
  );
  heartCage.position.set(0, 1.78, 1.68);
  torso.add(magmaHeart, heartCage);

  // Sculpted Behemoth Head with Brow Ridge, Articulated Jaw, Tusks & Swept Magma Horns
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 2.85, 1.18);
  torso.add(headPivot);

  const skullStations = [
    { y: -0.45, rx: 0.65, rz: 0.72 },
    { y: 0.0, rx: 0.94, rz: 1.02, archFront: 0.14 },
    { y: 0.48, rx: 0.88, rz: 0.94, archFront: 0.18 },
    { y: 0.88, rx: 0.56, rz: 0.62 },
    { y: 1.05, rx: 0.15, rz: 0.18 },
  ];
  headPivot.add(buildLoftedMesh(skullStations, 18, graniteMat));

  [-0.32, 0.32].forEach((ex) => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      magmaMat,
    );
    eye.position.set(ex, 0.22, 0.96);
    headPivot.add(eye);
  });

  const lowerJawPivot = new THREE.Group();
  lowerJawPivot.position.set(0, -0.22, 0.35);
  headPivot.add(lowerJawPivot);

  const lowerJaw = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.34, 0.78),
    graniteMat,
  );
  lowerJaw.position.set(0, -0.06, 0.38);
  lowerJawPivot.add(lowerJaw);

  [-0.38, 0.38].forEach((tx) => {
    const tusk = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.62, 5),
      armorPlateMat,
    );
    tusk.position.set(tx, 0.22, 0.66);
    tusk.rotation.x = 0.38;
    lowerJawPivot.add(tusk);
  });

  [-0.78, 0.78].forEach((hx) => {
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx * 0.7, 0.52, 0.05),
      new THREE.Vector3(hx * 1.48, 1.22, 0.38),
      new THREE.Vector3(hx * 1.65, 2.02, 0.82),
    ]);
    headPivot.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(hornCurve, 14, 0.22, 7, false),
        magmaMat,
      ),
    );
  });

  // Two-Stage Articulated Titan Arms (Shoulders + Elbows + Clawed Gauntlets)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-2.55, 2.32, 0.18);
  torso.add(leftArmPivot);

  const leftElbowPivot = new THREE.Group();
  leftElbowPivot.position.set(-0.18, -1.38, 0.12);
  leftArmPivot.add(leftElbowPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(2.55, 2.32, 0.18);
  torso.add(rightArmPivot);

  const rightElbowPivot = new THREE.Group();
  rightElbowPivot.position.set(0.18, -1.38, 0.12);
  rightArmPivot.add(rightElbowPivot);

  [leftArmPivot, rightArmPivot].forEach((armPivot, idx) => {
    const side = idx === 0 ? -1 : 1;
    const elPivot = idx === 0 ? leftElbowPivot : rightElbowPivot;

    const pauldron = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.12, 1),
      armorPlateMat,
    );
    pauldron.scale.set(1.22, 0.88, 1.12);
    armPivot.add(pauldron);

    const bicepStations = [
      { y: -1.36, rx: 0.54, rz: 0.56 },
      { y: -0.72, rx: 0.72, rz: 0.74, archFront: 0.1 },
      { y: -0.05, rx: 0.68, rz: 0.7 },
    ];
    const bicep = buildLoftedMesh(bicepStations, 14, graniteMat);
    bicep.position.x = side * 0.16;
    armPivot.add(bicep);

    const elbowSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 12, 10),
      armorPlateMat,
    );
    elPivot.add(elbowSphere);

    const forearmStations = [
      { y: -1.28, rx: 0.78, rz: 0.82, h4: 0.08 },
      { y: -0.65, rx: 0.74, rz: 0.76 },
      { y: 0.0, rx: 0.54, rz: 0.56 },
    ];
    elPivot.add(buildLoftedMesh(forearmStations, 14, graniteMat));

    const magmaBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.76, 0.12, 8, 16),
      magmaMat,
    );
    magmaBand.rotation.x = Math.PI / 2;
    magmaBand.position.y = -0.82;
    elPivot.add(magmaBand);

    // Knuckle-Spikes on Stone Gauntlets
    [-0.32, 0, 0.32].forEach((kx) => {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.48, 5),
        magmaMat,
      );
      spike.position.set(kx, -1.25, 0.65);
      spike.rotation.x = Math.PI / 2.2;
      elPivot.add(spike);
    });
  });

  // Two-Stage Articulated Titan Pillar Legs (Hips + Knees + Clawed Feet)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-1.08, 0, 0);
  hips.add(leftLegPivot);

  const leftKneePivot = new THREE.Group();
  leftKneePivot.position.set(0, -1.05, 0.06);
  leftLegPivot.add(leftKneePivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(1.08, 0, 0);
  hips.add(rightLegPivot);

  const rightKneePivot = new THREE.Group();
  rightKneePivot.position.set(0, -1.05, 0.06);
  rightLegPivot.add(rightKneePivot);

  [leftLegPivot, rightLegPivot].forEach((lp, idx) => {
    const kp = idx === 0 ? leftKneePivot : rightKneePivot;
    const hipSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.66, 12, 10),
      graniteMat,
    );
    lp.add(hipSphere);

    const thighStations = [
      { y: -1.05, rx: 0.56, rz: 0.58 },
      { y: -0.52, rx: 0.72, rz: 0.74 },
      { y: 0.0, rx: 0.68, rz: 0.7 },
    ];
    lp.add(buildLoftedMesh(thighStations, 14, graniteMat));

    const kneeGuard = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.58, 0),
      armorPlateMat,
    );
    kneeGuard.position.z = 0.22;
    kp.add(kneeGuard);

    const shinStations = [
      { y: -1.05, rx: 0.64, rz: 0.74 },
      { y: -0.5, rx: 0.58, rz: 0.62 },
      { y: 0.0, rx: 0.52, rz: 0.54 },
    ];
    kp.add(buildLoftedMesh(shinStations, 14, graniteMat));

    [-0.28, 0, 0.28].forEach((tx) => {
      const toeClaw = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.52, 5),
        armorPlateMat,
      );
      toeClaw.position.set(tx, -0.96, 0.68);
      toeClaw.rotation.x = Math.PI / 2;
      kp.add(toeClaw);
    });
  });

  const bossRing = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.1, 40),
    new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
    }),
  );
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.y = 0.42;
  group.add(bossRing);

  let umaxRoshanCrown = null;
  let umaxRoshanOrbiters = null;
  let umaxGroundRingA = null;
  let umaxGroundRingB = null;
  if (isUltraMax) {
    const aegisGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.45,
      metalness: 0.9,
      roughness: 0.16,
    });
    // Floating 5-Spire Molten Sovereign Crown above Roshan's Head
    umaxRoshanCrown = new THREE.Group();
    umaxRoshanCrown.position.set(0, 1.42, 0.1);
    const cRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.76, 0.075, 8, 24),
      aegisGoldMat,
    );
    cRing.rotation.x = Math.PI / 2;
    umaxRoshanCrown.add(cRing);
    for (let ci = 0; ci < 5; ci++) {
      const ang = (ci / 5) * Math.PI * 2;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.56, 5),
        ci === 0 ? aegisGoldMat : magmaMat,
      );
      spire.position.set(
        Math.cos(ang) * 0.74,
        0.24,
        Math.sin(ang) * 0.74,
      );
      umaxRoshanCrown.add(spire);
    }
    headPivot.add(umaxRoshanCrown);

    // Orbiting Aegis-Amber & Magma Runestones around Roshan's Torso
    umaxRoshanOrbiters = new THREE.Group();
    umaxRoshanOrbiters.position.set(0, 1.95, 0.15);
    for (let oi = 0; oi < 4; oi++) {
      const ang = (oi / 4) * Math.PI * 2;
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        oi % 2 === 0 ? aegisGoldMat : magmaMat,
      );
      shard.scale.set(0.8, 1.5, 0.8);
      shard.position.set(
        Math.cos(ang) * 3.15,
        Math.sin(ang) * 0.35,
        Math.sin(ang) * 3.15,
      );
      umaxRoshanOrbiters.add(shard);
    }
    torso.add(umaxRoshanOrbiters);

    // Blazing Shoulder Magma Halos
    [leftArmPivot, rightArmPivot].forEach((ap, aIdx) => {
      const s = aIdx === 0 ? -1 : 1;
      const shHalo = new THREE.Mesh(
        new THREE.TorusGeometry(1.18, 0.09, 8, 20),
        magmaMat,
      );
      shHalo.rotation.y = Math.PI / 2;
      shHalo.position.set(s * 0.15, 0.12, 0);
      ap.add(shHalo);
    });

    // Dual Counter-Rotating Molten Runic Ground Sigils
    umaxGroundRingA = new THREE.Mesh(
      new THREE.RingGeometry(4.25, 4.65, 12),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      }),
    );
    umaxGroundRingA.rotation.x = -Math.PI / 2;
    umaxGroundRingA.position.y = 0.44;
    umaxGroundRingB = new THREE.Mesh(
      new THREE.RingGeometry(2.85, 3.22, 6),
      new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.68,
      }),
    );
    umaxGroundRingB.rotation.x = -Math.PI / 2;
    umaxGroundRingB.position.y = 0.43;
    group.add(umaxGroundRingA, umaxGroundRingB);
  }

  return {
    group,
    parts: {
      hips,
      torso,
      headPivot,
      lowerJawPivot,
      magmaHeart,
      leftArmPivot,
      leftElbowPivot,
      rightArmPivot,
      rightElbowPivot,
      leftLegPivot,
      leftKneePivot,
      rightLegPivot,
      rightKneePivot,
      umaxRoshanCrown,
      umaxRoshanOrbiters,
      umaxGroundRingA,
      umaxGroundRingB,
    },
  };
}

function updateRoshanAnimation(roshan, time, dt, isMoving) {
  const p = roshan.parts;
  if (!p || !p.torso) return;
  const k = Math.min(1, dt * 12);
  p.stridePhase = (p.stridePhase || 0) + dt * (isMoving ? 7.8 : 2.4);

  const breath = Math.sin(time * 2.4);
  let targetHipX = 0;
  let targetHipY = 2.15 + breath * 0.08;
  let targetHipZRot = 0;
  let targetTorsoX = 0.1 + breath * 0.03;
  let targetTorsoY = 0;
  let targetHeadY = Math.sin(time * 1.3) * 0.22;
  let lArmX = -0.18,
    rArmX = -0.18;
  let lElX = -0.32,
    rElX = -0.32;
  let lLegX = 0,
    rLegX = 0,
    lKneeX = 0,
    rKneeX = 0;
  let jawX = Math.max(0, breath) * 0.22;

  if (roshan.castAnim > 0) {
    const prog = 1 - roshan.castAnim / 0.55;
    const slam = Math.sin(prog * Math.PI);
    targetHipY = 2.15 + slam * 0.45;
    targetTorsoX = -0.25 + slam * 0.65;
    lArmX = -1.85 * slam;
    rArmX = -1.85 * slam;
    lElX = -0.45 * (1 - slam);
    rElX = -0.45 * (1 - slam);
    jawX = 0.58 * slam;
  } else if (roshan.swingAnim > 0) {
    const prog = 1 - roshan.swingAnim / 0.34;
    const punch = Math.sin(prog * Math.PI);
    targetTorsoY = punch * 0.38;
    rArmX = -1.45 * punch;
    rElX = -0.55 + punch * 0.35;
    lArmX = 0.35 * punch;
    jawX = 0.42 * punch;
  } else if (isMoving) {
    const cyc = p.stridePhase;
    const stride = Math.sin(cyc);
    const cosS = Math.cos(cyc);
    targetHipY = 2.15 + Math.abs(cosS) * 0.18 - Math.abs(stride) * 0.12;
    targetHipX = stride * 0.22;
    targetHipZRot = -stride * 0.075;
    targetTorsoX = 0.24;
    targetTorsoY = -stride * 0.18;
    targetHeadY = stride * 0.12;
    lArmX = stride * 0.58 - 0.18;
    lElX = -0.28 - Math.max(0, -stride) * 0.34;
    rArmX = -stride * 0.58 - 0.18;
    rElX = -0.28 - Math.max(0, stride) * 0.34;
    lLegX = -stride * 0.52;
    lKneeX = Math.max(0, cosS) * 0.52 + Math.max(0, -cosS) * 0.12;
    rLegX = stride * 0.52;
    rKneeX = Math.max(0, -cosS) * 0.52 + Math.max(0, cosS) * 0.12;
  }

  p.hips.position.x += (targetHipX - p.hips.position.x) * k;
  p.hips.position.y += (targetHipY - p.hips.position.y) * k;
  p.hips.rotation.z += (targetHipZRot - p.hips.rotation.z) * k;
  p.torso.rotation.x += (targetTorsoX - p.torso.rotation.x) * k;
  p.torso.rotation.y += (targetTorsoY - p.torso.rotation.y) * k;
  p.headPivot.rotation.y += (targetHeadY - p.headPivot.rotation.y) * k;
  if (p.lowerJawPivot)
    p.lowerJawPivot.rotation.x += (jawX - p.lowerJawPivot.rotation.x) * k;
  if (p.magmaHeart) p.magmaHeart.scale.setScalar(1.0 + breath * 0.12);

  p.leftArmPivot.rotation.x += (lArmX - p.leftArmPivot.rotation.x) * k;
  p.rightArmPivot.rotation.x += (rArmX - p.rightArmPivot.rotation.x) * k;
  if (p.leftElbowPivot)
    p.leftElbowPivot.rotation.x +=
      (lElX - p.leftElbowPivot.rotation.x) * k;
  if (p.rightElbowPivot)
    p.rightElbowPivot.rotation.x +=
      (rElX - p.rightElbowPivot.rotation.x) * k;

  p.leftLegPivot.rotation.x += (lLegX - p.leftLegPivot.rotation.x) * k;
  p.rightLegPivot.rotation.x += (rLegX - p.rightLegPivot.rotation.x) * k;
  if (p.leftKneePivot)
    p.leftKneePivot.rotation.x +=
      (lKneeX - p.leftKneePivot.rotation.x) * k;
  if (p.rightKneePivot)
    p.rightKneePivot.rotation.x +=
      (rKneeX - p.rightKneePivot.rotation.x) * k;

  if (p.umaxRoshanCrown) {
    p.umaxRoshanCrown.position.y = 1.42 + Math.sin(time * 3.0) * 0.08;
    p.umaxRoshanCrown.rotation.y = time * 1.35;
  }
  if (p.umaxRoshanOrbiters) {
    p.umaxRoshanOrbiters.rotation.y = time * 2.2;
  }
  if (p.umaxGroundRingA) p.umaxGroundRingA.rotation.z = time * 0.55;
  if (p.umaxGroundRingB) p.umaxGroundRingB.rotation.z = -time * 0.85;
}

// 3. SCULPTED PP LABU — PRIMAL SILVERBACK SOVEREIGN GUARDIAN (Lofted Gorilla Anatomy, Sagittal Crest Crown, Articulated Limbs & Fangs)
function buildPPLabuMesh(team) {
  const group = new THREE.Group();
  attachContactShadow(group, 3.6);
  const isRad = team === "radiant";
  const primalCol = isRad ? 0x10b981 : 0xf43f5e;

  const isUltraMax =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  const furTex = getCreatureTextureSet("kong_fur");
  const furMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0x27272a : 0x3f3f46,
    map: furTex.map,
    bumpMap: furTex.bumpMap,
    bumpScale: isUltraMax ? 0.38 : 0.26,
    roughness: isUltraMax ? 0.58 : 0.72,
    metalness: isUltraMax ? 0.24 : 0.14,
  });
  const silverbackMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0xe2e8f0 : 0xcbd5e1,
    map: furTex.map,
    bumpMap: furTex.bumpMap,
    bumpScale: isUltraMax ? 0.32 : 0.22,
    emissive: isUltraMax ? primalCol : 0x000000,
    emissiveIntensity: isUltraMax ? 0.16 : 0.0,
    roughness: isUltraMax ? 0.34 : 0.48,
    metalness: isUltraMax ? 0.48 : 0.32,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0x292524,
    roughness: 0.52,
    metalness: 0.22,
  });
  const primalMat = new THREE.MeshStandardMaterial({
    color: primalCol,
    emissive: primalCol,
    emissiveIntensity: isUltraMax ? 2.3 : 1.35,
    roughness: 0.16,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: isUltraMax ? 1.05 : 0.55,
    metalness: 0.92,
    roughness: 0.14,
  });

  const hips = new THREE.Group();
  hips.position.y = 2.05;
  group.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  // Lofted Barrel-Chested Silverback Gorilla Torso with Sculpted Pectorals & Broad Dorsal Mantle
  const kongTorsoStations = [
    { y: -0.22, rx: 1.28, rz: 0.94 },
    { y: 0.35, rx: 1.56, rz: 1.12, archFront: 0.16, h2: 0.06 },
    {
      y: 1.25,
      rx: 2.08,
      rz: 1.44,
      archFront: 0.28,
      archBack: 0.18,
      h2: 0.08,
    },
    {
      y: 2.25,
      rx: 2.52,
      rz: 1.66,
      archFront: 0.32,
      archBack: 0.28,
      h2: 0.1,
    },
    { y: 2.95, rx: 1.88, rz: 1.32, archBack: 0.2 },
    { y: 3.35, rx: 0.96, rz: 0.84 },
  ];
  torso.add(buildLoftedMesh(kongTorsoStations, 26, furMat));

  // Silverback Fur Mantle Across Shoulders & Upper Back
  const silverBack = new THREE.Mesh(
    new THREE.SphereGeometry(2.18, 18, 16),
    silverbackMat,
  );
  silverBack.scale.set(1.16, 1.18, 0.72);
  silverBack.position.set(0, 2.08, -0.76);
  torso.add(silverBack);

  // Ornate Primal Ancient Chest Medallion
  const chestCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.86, 1),
    primalMat,
  );
  chestCore.position.set(0, 1.88, 1.88);
  const chestMedallion = new THREE.Mesh(
    new THREE.TorusGeometry(0.96, 0.14, 8, 22),
    goldMat,
  );
  chestMedallion.position.set(0, 1.88, 1.84);
  torso.add(chestCore, chestMedallion);

  // Gilded Sovereign Gorget Collar & Primal Tasset Loin-Plates
  const warCollar = new THREE.Mesh(
    new THREE.TorusGeometry(1.86, 0.18, 10, 24),
    goldMat,
  );
  warCollar.rotation.x = Math.PI / 2.2;
  warCollar.position.set(0, 2.78, 0.35);
  torso.add(warCollar);

  [-1.18, 0, 1.18].forEach((tx, idx) => {
    const tasset = new THREE.Mesh(
      new THREE.BoxGeometry(idx === 1 ? 0.92 : 0.76, 1.15, 0.18),
      goldMat,
    );
    tasset.position.set(tx, -0.35, idx === 1 ? 1.05 : 0.75);
    tasset.rotation.x = -0.18;
    tasset.rotation.z = tx * -0.16;
    torso.add(tasset);
  });

  // Sculpted Silverback Ape Head with Sagittal Crest, Sovereign Diadem, Brow Ridge & Articulated Fang-Jaw
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.18, 1.18);
  torso.add(headPivot);

  const apeSkullStations = [
    { y: -0.45, rx: 0.68, rz: 0.74 },
    { y: 0.0, rx: 0.98, rz: 1.04, archFront: 0.16 },
    { y: 0.45, rx: 0.92, rz: 0.96, archFront: 0.22 },
    { y: 0.85, rx: 0.64, rz: 0.72 },
    { y: 1.15, rx: 0.34, rz: 0.48 },
  ];
  headPivot.add(buildLoftedMesh(apeSkullStations, 20, furMat));

  // Gilded Sovereign Crown Diadem with Primal Emerald/Ruby Gem
  const crownRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.1, 8, 22),
    goldMat,
  );
  crownRing.rotation.x = Math.PI / 2;
  crownRing.position.set(0, 0.88, -0.04);
  const crownGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    primalMat,
  );
  crownGem.position.set(0, 0.94, 0.72);
  headPivot.add(crownRing, crownGem);

  const brow = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.26, 0.54),
    skinMat,
  );
  brow.position.set(0, 0.3, 0.88);
  headPivot.add(brow);

  [-0.32, 0.32].forEach((ex) => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      goldMat,
    );
    eye.position.set(ex, 0.15, 1.08);
    headPivot.add(eye);
  });

  const snout = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.52, 0.74),
    skinMat,
  );
  snout.position.set(0, -0.16, 0.94);
  headPivot.add(snout);

  const lowerJawPivot = new THREE.Group();
  lowerJawPivot.position.set(0, -0.44, 0.55);
  headPivot.add(lowerJawPivot);

  const jaw = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.34, 0.72),
    skinMat,
  );
  jaw.position.set(0, -0.08, 0.35);
  lowerJawPivot.add(jaw);

  [-0.28, 0.28].forEach((fx) => {
    const fang = new THREE.Mesh(
      new THREE.ConeGeometry(0.095, 0.42, 5),
      goldMat,
    );
    fang.position.set(fx, 0.18, 0.62);
    lowerJawPivot.add(fang);
  });

  // Two-Stage Articulated Silverback Arms (Shoulders + Elbows + Sculpted Knuckle Fists)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-2.72, 2.55, 0.22);
  torso.add(leftArmPivot);

  const leftElbowPivot = new THREE.Group();
  leftElbowPivot.position.set(-0.18, -1.48, 0.16);
  leftArmPivot.add(leftElbowPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(2.72, 2.55, 0.22);
  torso.add(rightArmPivot);

  const rightElbowPivot = new THREE.Group();
  rightElbowPivot.position.set(0.18, -1.48, 0.16);
  rightArmPivot.add(rightElbowPivot);

  [leftArmPivot, rightArmPivot].forEach((armPivot, idx) => {
    const side = idx === 0 ? -1 : 1;
    const elPivot = idx === 0 ? leftElbowPivot : rightElbowPivot;

    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(1.14, 16, 14),
      silverbackMat,
    );
    const goldRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.12, 8, 20),
      goldMat,
    );
    goldRim.rotation.y = Math.PI / 2;
    armPivot.add(shoulder, goldRim);

    const upperArmStations = [
      { y: -1.46, rx: 0.62, rz: 0.64 },
      { y: -0.78, rx: 0.78, rz: 0.8, archFront: 0.1 },
      { y: -0.05, rx: 0.74, rz: 0.76 },
    ];
    const upperArm = buildLoftedMesh(upperArmStations, 16, furMat);
    upperArm.position.x = side * 0.16;
    armPivot.add(upperArm);

    const elbowCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.64, 14, 12),
      furMat,
    );
    elPivot.add(elbowCap);

    const forearmStations = [
      { y: -1.45, rx: 0.76, rz: 0.8 },
      { y: -0.72, rx: 0.84, rz: 0.86, archFront: 0.12 },
      { y: 0.0, rx: 0.62, rz: 0.64 },
    ];
    elPivot.add(buildLoftedMesh(forearmStations, 16, furMat));

    const gauntletRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.12, 8, 20),
      primalMat,
    );
    gauntletRing.rotation.x = Math.PI / 2;
    gauntletRing.position.y = -1.15;
    elPivot.add(gauntletRing);

    const fist = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.92, 1.05),
      skinMat,
    );
    fist.position.set(0, -1.68, 0.16);
    elPivot.add(fist);
    for (let f = -1.5; f <= 1.5; f += 1) {
      const knuckle = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.14, 0.42, 4, 8),
        skinMat,
      );
      knuckle.position.set(f * 0.24, -1.85, 0.62);
      knuckle.rotation.x = 0.55;
      elPivot.add(knuckle);
    }
  });

  // Two-Stage Articulated Gorilla Legs (Hips + Knees + Plantigrade Feet)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-1.15, 0, 0);
  hips.add(leftLegPivot);

  const leftKneePivot = new THREE.Group();
  leftKneePivot.position.set(0, -1.02, 0.05);
  leftLegPivot.add(leftKneePivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(1.15, 0, 0);
  hips.add(rightLegPivot);

  const rightKneePivot = new THREE.Group();
  rightKneePivot.position.set(0, -1.02, 0.05);
  rightLegPivot.add(rightKneePivot);

  [leftLegPivot, rightLegPivot].forEach((lp, idx) => {
    const kp = idx === 0 ? leftKneePivot : rightKneePivot;
    const hipCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 14, 12),
      furMat,
    );
    lp.add(hipCap);

    const thighStations = [
      { y: -1.02, rx: 0.62, rz: 0.64 },
      { y: -0.5, rx: 0.78, rz: 0.8 },
      { y: 0.0, rx: 0.74, rz: 0.76 },
    ];
    lp.add(buildLoftedMesh(thighStations, 14, furMat));

    const kneeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 12, 10),
      furMat,
    );
    kp.add(kneeCap);

    const shinStations = [
      { y: -1.02, rx: 0.66, rz: 0.82 },
      { y: -0.48, rx: 0.62, rz: 0.66 },
      { y: 0.0, rx: 0.58, rz: 0.6 },
    ];
    kp.add(buildLoftedMesh(shinStations, 14, furMat));

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.36, 1.38),
      skinMat,
    );
    foot.position.set(0, -0.92, 0.25);
    kp.add(foot);
  });

  const bossRing = new THREE.Mesh(
    new THREE.RingGeometry(3.8, 4.5, 44),
    new THREE.MeshBasicMaterial({
      color: primalCol,
      side: THREE.DoubleSide,
    }),
  );
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.y = 0.22;
  group.add(bossRing);

  let umaxKongHalo = null;
  let umaxKongOrbiters = null;
  let umaxGroundRingA = null;
  let umaxGroundRingB = null;
  if (isUltraMax) {
    // Radiant Sovereign Aureole Halo & Spiked Crown behind PP Labu's Head
    umaxKongHalo = new THREE.Group();
    umaxKongHalo.position.set(0, 0.72, -0.68);
    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.48, 0.085, 10, 32),
      goldMat,
    );
    const innerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.055, 8, 24),
      primalMat,
    );
    umaxKongHalo.add(haloRing, innerHalo);
    for (let hi = 0; hi < 7; hi++) {
      const ang = (hi / 7) * Math.PI * 2;
      const ray = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.62, 5),
        hi % 2 === 0 ? goldMat : primalMat,
      );
      ray.position.set(Math.cos(ang) * 1.65, Math.sin(ang) * 1.65, 0);
      ray.rotation.z = ang - Math.PI / 2;
      umaxKongHalo.add(ray);
    }
    headPivot.add(umaxKongHalo);

    // Orbiting Ancient Totem Relic Crystals around Silverback Torso
    umaxKongOrbiters = new THREE.Group();
    umaxKongOrbiters.position.set(0, 2.05, 0.15);
    for (let oi = 0; oi < 4; oi++) {
      const ang = (oi / 4) * Math.PI * 2;
      const totemGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34, 0),
        oi % 2 === 0 ? primalMat : goldMat,
      );
      totemGem.scale.set(0.85, 1.55, 0.85);
      totemGem.position.set(
        Math.cos(ang) * 3.35,
        Math.sin(ang) * 0.35,
        Math.sin(ang) * 3.35,
      );
      umaxKongOrbiters.add(totemGem);
    }
    torso.add(umaxKongOrbiters);

    // Gilded Shoulder Crest Horns
    [leftArmPivot, rightArmPivot].forEach((ap, aIdx) => {
      const s = aIdx === 0 ? -1 : 1;
      const shSpike = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 1.15, 5),
        goldMat,
      );
      shSpike.position.set(s * 0.65, 0.92, 0);
      shSpike.rotation.z = -s * 0.42;
      ap.add(shSpike);
    });

    // Counter-Rotating Ancient Guardian Ground Sigils
    umaxGroundRingA = new THREE.Mesh(
      new THREE.RingGeometry(4.65, 5.05, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      }),
    );
    umaxGroundRingA.rotation.x = -Math.PI / 2;
    umaxGroundRingA.position.y = 0.25;
    umaxGroundRingB = new THREE.Mesh(
      new THREE.RingGeometry(3.25, 3.62, 8),
      new THREE.MeshBasicMaterial({
        color: primalCol,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      }),
    );
    umaxGroundRingB.rotation.x = -Math.PI / 2;
    umaxGroundRingB.position.y = 0.24;
    group.add(umaxGroundRingA, umaxGroundRingB);
  }

  return {
    group,
    parts: {
      hips,
      torso,
      headPivot,
      lowerJawPivot,
      chestCore,
      leftArmPivot,
      leftElbowPivot,
      rightArmPivot,
      rightElbowPivot,
      leftLegPivot,
      leftKneePivot,
      rightLegPivot,
      rightKneePivot,
      umaxKongHalo,
      umaxKongOrbiters,
      umaxGroundRingA,
      umaxGroundRingB,
    },
  };
}

function updatePPLabuAnimation(kong, time, dt, isMoving) {
  const p = kong.parts;
  if (!p || !p.torso) return;
  const k = Math.min(1, dt * 12);
  p.stridePhase = (p.stridePhase || 0) + dt * (isMoving ? 8.2 : 2.2);

  const breath = Math.sin(time * 2.2);
  let targetHipX = 0;
  let targetHipY = 2.05 + breath * 0.08;
  let targetHipZRot = 0;
  let targetTorsoX = 0.14 + breath * 0.03;
  let targetTorsoY = 0;
  let targetHeadX = -0.08;
  let targetHeadY = Math.sin(time * 1.4) * 0.22;
  let lArmX = -0.22,
    rArmX = -0.22;
  let lElX = -0.28,
    rElX = -0.28;
  let lLegX = 0,
    rLegX = 0,
    lKneeX = 0,
    rKneeX = 0;

  if (kong.castAnim > 0) {
    const prog = 1 - kong.castAnim / 0.65;
    const slam = Math.sin(prog * Math.PI);
    targetHipY = 2.05 + slam * 0.42;
    targetTorsoX = -0.22 + slam * 0.62;
    lArmX = -1.78 * slam;
    rArmX = -1.78 * slam;
    lElX = -0.42 * (1 - slam);
    rElX = -0.42 * (1 - slam);
  } else if (kong.swingAnim > 0) {
    const prog = 1 - kong.swingAnim / 0.34;
    const punch = Math.sin(prog * Math.PI);
    targetTorsoY = punch * 0.36;
    lArmX = -1.35 * punch;
    lElX = -0.45 + punch * 0.3;
    rArmX = 0.85 * punch;
  } else if (isMoving) {
    // Primal Silverback Gorilla forward-pitched lope matching long knuckle-arms & shorter legs
    const cyc = p.stridePhase;
    const stride = Math.sin(cyc);
    const cosS = Math.cos(cyc);
    targetHipY = 1.98 + Math.abs(cosS) * 0.22 - Math.abs(stride) * 0.1;
    targetHipX = stride * 0.24;
    targetHipZRot = -stride * 0.09;
    targetTorsoX = 0.42;
    targetTorsoY = -stride * 0.2;
    targetHeadX = -0.28;
    targetHeadY = stride * 0.14;
    lArmX = stride * 0.68 - 0.32;
    lElX = -0.22 - Math.max(0, -stride) * 0.32;
    rArmX = -stride * 0.68 - 0.32;
    rElX = -0.22 - Math.max(0, stride) * 0.32;
    lLegX = -stride * 0.56;
    lKneeX = Math.max(0, cosS) * 0.62 + Math.max(0, -cosS) * 0.16;
    rLegX = stride * 0.56;
    rKneeX = Math.max(0, -cosS) * 0.62 + Math.max(0, cosS) * 0.16;
  }

  p.hips.position.x += (targetHipX - p.hips.position.x) * k;
  p.hips.position.y += (targetHipY - p.hips.position.y) * k;
  p.hips.rotation.z += (targetHipZRot - p.hips.rotation.z) * k;
  p.torso.rotation.x += (targetTorsoX - p.torso.rotation.x) * k;
  p.torso.rotation.y += (targetTorsoY - p.torso.rotation.y) * k;
  p.headPivot.rotation.x += (targetHeadX - p.headPivot.rotation.x) * k;
  p.headPivot.rotation.y += (targetHeadY - p.headPivot.rotation.y) * k;
  p.lowerJawPivot.rotation.x =
    kong.castAnim > 0 ? 0.55 : Math.max(0, Math.sin(time * 2.4)) * 0.2;
  if (p.chestCore) p.chestCore.scale.setScalar(1.0 + breath * 0.12);

  p.leftArmPivot.rotation.x += (lArmX - p.leftArmPivot.rotation.x) * k;
  p.rightArmPivot.rotation.x += (rArmX - p.rightArmPivot.rotation.x) * k;
  if (p.leftElbowPivot)
    p.leftElbowPivot.rotation.x +=
      (lElX - p.leftElbowPivot.rotation.x) * k;
  if (p.rightElbowPivot)
    p.rightElbowPivot.rotation.x +=
      (rElX - p.rightElbowPivot.rotation.x) * k;

  p.leftLegPivot.rotation.x += (lLegX - p.leftLegPivot.rotation.x) * k;
  p.rightLegPivot.rotation.x += (rLegX - p.rightLegPivot.rotation.x) * k;
  if (p.leftKneePivot)
    p.leftKneePivot.rotation.x +=
      (lKneeX - p.leftKneePivot.rotation.x) * k;
  if (p.rightKneePivot)
    p.rightKneePivot.rotation.x +=
      (rKneeX - p.rightKneePivot.rotation.x) * k;

  if (p.umaxKongHalo) {
    p.umaxKongHalo.rotation.z = time * 1.25;
  }
  if (p.umaxKongOrbiters) {
    p.umaxKongOrbiters.rotation.y = time * 2.4;
  }
  if (p.umaxGroundRingA) p.umaxGroundRingA.rotation.z = time * 0.6;
  if (p.umaxGroundRingB) p.umaxGroundRingB.rotation.z = -time * 0.9;
}

// 4. SCULPTED RED MAN — CRIMSON ONI-SHOGUN WARLORD GUARDIAN (Lamellar Samurai Cuirass, Pleated Cape, Kabuto Horns, Fullered Nodachi & Buckler)
function buildRedManMesh(team) {
  const group = new THREE.Group();
  attachContactShadow(group, 3.5);
  const isRad = team === "radiant";
  const primalCol = isRad ? 0x10b981 : 0xf43f5e;

  const isUltraMax =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  const oniTex = getCreatureTextureSet("oni_lacquer");
  const skinMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0xdc2626 : 0xb91c1c,
    bumpMap: marblePBR.bumpMap,
    bumpScale: isUltraMax ? 0.36 : 0.26,
    emissive: isUltraMax ? 0x7f1d1d : 0x000000,
    emissiveIntensity: isUltraMax ? 0.25 : 0.0,
    roughness: isUltraMax ? 0.42 : 0.52,
    metalness: isUltraMax ? 0.32 : 0.22,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: oniTex.map,
    bumpMap: oniTex.bumpMap,
    bumpScale: isUltraMax ? 0.34 : 0.22,
    roughness: isUltraMax ? 0.22 : 0.34,
    metalness: isUltraMax ? 0.86 : 0.72,
  });
  const obsidianMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: isUltraMax ? 0.24 : 0.36,
    metalness: isUltraMax ? 0.88 : 0.8,
  });
  const primalMat = new THREE.MeshStandardMaterial({
    color: primalCol,
    emissive: primalCol,
    emissiveIntensity: isUltraMax ? 2.35 : 1.38,
    roughness: 0.16,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: isUltraMax ? 1.08 : 0.55,
    metalness: 0.92,
    roughness: 0.14,
  });

  const hips = new THREE.Group();
  hips.position.y = 2.15;
  group.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  // Lofted Muscular Oni-Shogun Cuirass with V-Taper Pectorals & Waist Armor
  const oniTorsoStations = [
    { y: -0.18, rx: 1.18, rz: 0.84 },
    { y: 0.45, rx: 1.38, rz: 0.98, h2: 0.05 },
    {
      y: 1.35,
      rx: 1.88,
      rz: 1.28,
      archFront: 0.24,
      archBack: 0.14,
      h2: 0.08,
    },
    {
      y: 2.35,
      rx: 2.28,
      rz: 1.48,
      archFront: 0.26,
      archBack: 0.18,
      h2: 0.1,
    },
    { y: 3.02, rx: 1.65, rz: 1.14 },
    { y: 3.38, rx: 0.86, rz: 0.76 },
  ];
  torso.add(buildLoftedMesh(oniTorsoStations, 26, armorMat));

  // Studded Gold Warlord Obi-Belt & 4 Layered Kusazuri Samurai Hip Tassets
  const warBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(1.36, 1.46, 0.42, 22),
    goldMat,
  );
  warBelt.scale.set(1.0, 1.0, 0.74);
  warBelt.position.y = 0.24;
  torso.add(warBelt);

  [-1.38, 1.38].forEach((tx) => {
    const side = tx < 0 ? -1 : 1;
    const upperTasset = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.75, 0.18),
      armorMat,
    );
    upperTasset.position.set(tx, -0.25, 0.22);
    upperTasset.rotation.z = -side * 0.22;
    const lowerTasset = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.78, 0.18),
      goldMat,
    );
    lowerTasset.position.set(tx + side * 0.16, -0.92, 0.26);
    lowerTasset.rotation.z = -side * 0.28;
    torso.add(upperTasset, lowerTasset);
  });

  // Pleated Billowing Crimson Shogun War-Cape
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 3.05, -0.95);
  torso.add(capePivot);
  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    map: oniTex.map,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const warCape = buildDrapedCapeMesh(3.2, 4.4, 4.35, 5, capeMat);
  capePivot.add(warCape);

  // Primal Oni Soul-Furnace Core Framed in Gold
  const chestCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.88, 1),
    primalMat,
  );
  chestCore.position.set(0, 1.95, 1.72);
  const coreRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.13, 8, 22),
    goldMat,
  );
  coreRim.position.set(0, 1.95, 1.68);
  torso.add(chestCore, coreRim);

  // Sculpted Fierce Oni Demon Head with Menpo Fang-Mask, Kabuto Crescent Crest, Curved Horns & Flowing Mane
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.28, 0.96);
  torso.add(headPivot);

  const oniHeadStations = [
    { y: -0.45, rx: 0.62, rz: 0.68 },
    { y: 0.0, rx: 0.88, rz: 0.94, archFront: 0.14 },
    { y: 0.45, rx: 0.92, rz: 0.96, archFront: 0.16 },
    { y: 0.85, rx: 0.68, rz: 0.72 },
    { y: 1.05, rx: 0.22, rz: 0.24 },
  ];
  headPivot.add(buildLoftedMesh(oniHeadStations, 20, skinMat));

  // Fierce Menpo Oni Iron Fang-Mask + Upward Ivory Tusks
  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.86,
      0.74,
      0.44,
      16,
      1,
      false,
      -Math.PI * 0.42,
      Math.PI * 0.84,
    ),
    obsidianMat,
  );
  visor.position.set(0, -0.22, 0.22);
  headPivot.add(visor);

  [-0.34, 0.34].forEach((tx) => {
    const tusk = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.56, 5),
      goldMat,
    );
    tusk.position.set(tx, -0.04, 0.96);
    tusk.rotation.x = 0.28;
    headPivot.add(tusk);
  });

  // Gilded Kabuto Crescent Crest & Curved Oni Demon Horns
  const crescent = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.08, 8, 20, Math.PI * 1.15),
    goldMat,
  );
  crescent.rotation.z = Math.PI * 0.925;
  crescent.position.set(0, 1.08, 0.58);
  const crestGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    primalMat,
  );
  crestGem.position.set(0, 0.84, 0.68);
  headPivot.add(crescent, crestGem);

  [-0.3, 0.3].forEach((ex) => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      goldMat,
    );
    eye.position.set(ex, 0.22, 0.95);
    headPivot.add(eye);
  });

  [-0.58, 0.58].forEach((hx) => {
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx * 0.75, 0.65, 0.05),
      new THREE.Vector3(hx * 1.35, 1.25, 0.28),
      new THREE.Vector3(hx * 1.15, 1.85, 0.58),
    ]);
    headPivot.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(hornCurve, 12, 0.15, 7, false),
        goldMat,
      ),
    );
  });

  // Wild Flowing Dark-Crimson Oni Mane Locks
  [-0.45, -0.22, 0, 0.22, 0.45].forEach((mx, idx) => {
    const maneCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(mx, 0.75, -0.55),
      new THREE.Vector3(mx * 1.25, 0.15, -0.88 - (idx % 2) * 0.12),
      new THREE.Vector3(mx * 1.35, -0.65, -0.95),
    ]);
    headPivot.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(maneCurve, 10, 0.12, 6, false),
        obsidianMat,
      ),
    );
  });

  // Two-Stage Articulated Arms with Tiered Samurai Sode Pauldrons, Oni Buckler & Fullered Nodachi Greatsword
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-2.55, 2.65, 0.18);
  torso.add(leftArmPivot);

  const leftElbowPivot = new THREE.Group();
  leftElbowPivot.position.set(-0.15, -1.42, 0.12);
  leftArmPivot.add(leftElbowPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(2.55, 2.65, 0.18);
  torso.add(rightArmPivot);

  const rightElbowPivot = new THREE.Group();
  rightElbowPivot.position.set(0.15, -1.42, 0.12);
  rightArmPivot.add(rightElbowPivot);

  [leftArmPivot, rightArmPivot].forEach((armPivot, idx) => {
    const side = idx === 0 ? -1 : 1;
    const elPivot = idx === 0 ? leftElbowPivot : rightElbowPivot;

    // Tiered Samurai Sode Pauldrons + Golden Shoulder Spike
    const sodeTop = new THREE.Mesh(
      new THREE.SphereGeometry(
        1.06,
        16,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.58,
      ),
      armorMat,
    );
    const sodeMid = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.96,
        14,
        10,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.52,
      ),
      goldMat,
    );
    sodeMid.position.set(side * 0.18, -0.25, 0);
    sodeMid.rotation.z = -side * 0.25;
    const shoulderSpike = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 1.18, 5),
      goldMat,
    );
    shoulderSpike.position.set(side * 0.48, 0.85, 0);
    shoulderSpike.rotation.z = -side * 0.45;
    armPivot.add(sodeTop, sodeMid, shoulderSpike);

    const upperArmStations = [
      { y: -1.4, rx: 0.54, rz: 0.56 },
      { y: -0.72, rx: 0.68, rz: 0.7, archFront: 0.08 },
      { y: -0.05, rx: 0.64, rz: 0.66 },
    ];
    const upperArm = buildLoftedMesh(upperArmStations, 14, skinMat);
    upperArm.position.x = side * 0.15;
    armPivot.add(upperArm);

    const elbowCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.56, 12, 10),
      goldMat,
    );
    elPivot.add(elbowCap);

    const forearmStations = [
      { y: -1.35, rx: 0.58, rz: 0.62, h4: 0.06 },
      { y: -0.68, rx: 0.66, rz: 0.68 },
      { y: 0.0, rx: 0.54, rz: 0.56 },
    ];
    elPivot.add(buildLoftedMesh(forearmStations, 14, armorMat));

    if (idx === 0) {
      // Left Forearm Oni Hex-Buckler Shield
      const shield = new THREE.Mesh(
        new THREE.CylinderGeometry(1.45, 1.45, 0.22, 6),
        armorMat,
      );
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.68, -0.95, 0.35);
      const shieldRim = new THREE.Mesh(
        new THREE.TorusGeometry(1.42, 0.12, 6, 6),
        goldMat,
      );
      shieldRim.rotation.y = Math.PI / 2;
      shieldRim.position.set(-0.78, -0.95, 0.35);
      const shieldGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        primalMat,
      );
      shieldGem.position.set(-0.84, -0.95, 0.35);
      elPivot.add(shield, shieldRim, shieldGem);
    } else {
      // Right Gauntlet Fullered Crimson-Primal Nodachi Greatsword
      const swordGrp = new THREE.Group();
      swordGrp.position.set(0, -1.42, 0.22);
      const hilt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 1.15, 10),
        obsidianMat,
      );
      hilt.position.y = -0.15;
      const pommel = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.26, 0),
        goldMat,
      );
      pommel.position.y = -0.75;
      const tsuba = new THREE.Mesh(
        new THREE.BoxGeometry(1.38, 0.22, 0.36),
        goldMat,
      );
      tsuba.position.y = 0.42;
      const bladeOuter = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 4.1, 4),
        obsidianMat,
      );
      bladeOuter.position.y = 2.48;
      bladeOuter.scale.set(1.25, 1.0, 0.28);
      const bladeCore = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 3.65, 4),
        primalMat,
      );
      bladeCore.position.y = 2.32;
      bladeCore.scale.set(1.15, 1.0, 0.34);
      swordGrp.add(hilt, pommel, tsuba, bladeOuter, bladeCore);
      if (isUltraMax) {
        const swordAura = new THREE.Mesh(
          new THREE.ConeGeometry(0.46, 4.45, 4),
          new THREE.MeshBasicMaterial({
            color: primalCol,
            transparent: true,
            opacity: 0.42,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        swordAura.position.y = 2.55;
        swordAura.scale.set(1.35, 1.0, 0.42);
        swordGrp.add(swordAura);
      }
      swordGrp.rotation.x = Math.PI * 0.34;
      elPivot.add(swordGrp);
    }
  });

  // Two-Stage Articulated Samurai Armored Legs (Hips + Knees + Suneate Greaves)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-1.08, 0, 0);
  hips.add(leftLegPivot);

  const leftKneePivot = new THREE.Group();
  leftKneePivot.position.set(0, -1.05, 0.05);
  leftLegPivot.add(leftKneePivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(1.08, 0, 0);
  hips.add(rightLegPivot);

  const rightKneePivot = new THREE.Group();
  rightKneePivot.position.set(0, -1.05, 0.05);
  rightLegPivot.add(rightKneePivot);

  [leftLegPivot, rightLegPivot].forEach((lp, idx) => {
    const kp = idx === 0 ? leftKneePivot : rightKneePivot;
    const hipCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 12, 10),
      armorMat,
    );
    lp.add(hipCap);

    const thighStations = [
      { y: -1.05, rx: 0.56, rz: 0.58 },
      { y: -0.52, rx: 0.72, rz: 0.74 },
      { y: 0.0, rx: 0.68, rz: 0.7 },
    ];
    lp.add(buildLoftedMesh(thighStations, 14, armorMat));

    const kneeGuard = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.54, 1),
      goldMat,
    );
    kneeGuard.scale.set(0.95, 1.15, 0.75);
    kneeGuard.position.z = 0.32;
    kp.add(kneeGuard);

    const greaveStations = [
      { y: -1.05, rx: 0.54, rz: 0.64 },
      { y: -0.5, rx: 0.6, rz: 0.64 },
      { y: 0.0, rx: 0.54, rz: 0.56 },
    ];
    kp.add(buildLoftedMesh(greaveStations, 14, obsidianMat));

    const sabaton = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.34, 1.32),
      goldMat,
    );
    sabaton.position.set(0, -0.94, 0.24);
    kp.add(sabaton);
  });

  const bossRing = new THREE.Mesh(
    new THREE.RingGeometry(3.8, 4.5, 44),
    new THREE.MeshBasicMaterial({
      color: primalCol,
      side: THREE.DoubleSide,
    }),
  );
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.y = 0.22;
  group.add(bossRing);

  let umaxRedManHalo = null;
  let umaxRedManOrbiters = null;
  let umaxGroundRingA = null;
  let umaxGroundRingB = null;
  if (isUltraMax) {
    // Shogunate Raijin Magatama War-Ring behind Red Man's Shoulders
    umaxRedManHalo = new THREE.Group();
    umaxRedManHalo.position.set(0, 3.15, -0.78);
    const shogunRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.1, 10, 36),
      goldMat,
    );
    umaxRedManHalo.add(shogunRing);
    for (let mi = 0; mi < 8; mi++) {
      const ang = (mi / 8) * Math.PI * 2;
      const magatama = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        mi % 2 === 0 ? primalMat : goldMat,
      );
      magatama.scale.set(0.85, 1.45, 0.85);
      magatama.position.set(
        Math.cos(ang) * 2.15,
        Math.sin(ang) * 2.15,
        0,
      );
      magatama.rotation.z = ang;
      umaxRedManHalo.add(magatama);
    }
    torso.add(umaxRedManHalo);

    // Orbiting Oni Spirit-Fire Wisps
    umaxRedManOrbiters = new THREE.Group();
    umaxRedManOrbiters.position.set(0, 2.15, 0.12);
    for (let oi = 0; oi < 4; oi++) {
      const ang = (oi / 4) * Math.PI * 2;
      const wisp = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        oi % 2 === 0 ? primalMat : goldMat,
      );
      wisp.position.set(
        Math.cos(ang) * 3.15,
        Math.sin(ang) * 0.35,
        Math.sin(ang) * 3.15,
      );
      umaxRedManOrbiters.add(wisp);
    }
    torso.add(umaxRedManOrbiters);

    // Counter-Rotating Shogunate Ground Sigils
    umaxGroundRingA = new THREE.Mesh(
      new THREE.RingGeometry(4.65, 5.05, 12),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    umaxGroundRingA.rotation.x = -Math.PI / 2;
    umaxGroundRingA.position.y = 0.25;
    umaxGroundRingB = new THREE.Mesh(
      new THREE.RingGeometry(3.25, 3.62, 6),
      new THREE.MeshBasicMaterial({
        color: primalCol,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      }),
    );
    umaxGroundRingB.rotation.x = -Math.PI / 2;
    umaxGroundRingB.position.y = 0.24;
    group.add(umaxGroundRingA, umaxGroundRingB);
  }

  return {
    group,
    parts: {
      hips,
      torso,
      headPivot,
      capePivot,
      chestCore,
      leftArmPivot,
      leftElbowPivot,
      rightArmPivot,
      rightElbowPivot,
      leftLegPivot,
      leftKneePivot,
      rightLegPivot,
      rightKneePivot,
      umaxRedManHalo,
      umaxRedManOrbiters,
      umaxGroundRingA,
      umaxGroundRingB,
    },
  };
}

function updateRedManAnimation(rm, time, dt, isMoving) {
  const p = rm.parts;
  if (!p || !p.torso) return;
  const k = Math.min(1, dt * 12);
  p.stridePhase = (p.stridePhase || 0) + dt * (isMoving ? 8.4 : 2.5);

  const breath = Math.sin(time * 2.5);
  let targetHipX = 0;
  let targetHipY = 2.15 + breath * 0.06;
  let targetHipZRot = 0;
  let targetTorsoX = 0.08 + breath * 0.02;
  let targetTorsoY = 0;
  let targetHeadY = Math.sin(time * 1.6) * 0.25;
  let lArmX = -0.32,
    rArmX = -0.25;
  let lElX = -0.45,
    rElX = -0.35;
  let lLegX = 0,
    rLegX = 0,
    lKneeX = 0,
    rKneeX = 0;
  let capeX = 0.14 + Math.sin(time * 3.2) * 0.04;

  if (rm.castAnim > 0) {
    const prog = 1 - rm.castAnim / 0.65;
    const slam = Math.sin(prog * Math.PI);
    targetHipY = 2.15 + slam * 0.38;
    targetTorsoX = -0.24 + slam * 0.58;
    lArmX = -1.65 * slam;
    rArmX = -1.85 * slam;
    rElX = -0.45 * (1 - slam);
    capeX = 0.52 * slam;
  } else if (rm.swingAnim > 0) {
    const prog = 1 - rm.swingAnim / 0.34;
    const slash = Math.sin(prog * Math.PI);
    targetTorsoY = slash * 0.42;
    rArmX = -1.35 + slash * 1.55;
    rElX = -0.35 + slash * 0.45;
    lArmX = -0.35 - slash * 0.25;
  } else if (isMoving) {
    // Oni-Shogun Samurai Stride: Hex-buckler braced forward, Nodachi greatsword swinging
    const cyc = p.stridePhase;
    const stride = Math.sin(cyc);
    const cosS = Math.cos(cyc);
    targetHipY = 2.15 + Math.abs(cosS) * 0.18 - Math.abs(stride) * 0.09;
    targetHipX = stride * 0.16;
    targetHipZRot = -stride * 0.06;
    targetTorsoX = 0.2;
    targetTorsoY = -stride * 0.18;
    targetHeadY = stride * 0.11;
    lArmX = -0.46 + stride * 0.24;
    lElX = -0.58;
    rArmX = -stride * 0.62 - 0.18;
    rElX = -0.32 - Math.max(0, stride) * 0.34;
    lLegX = -stride * 0.56;
    lKneeX = Math.max(0, cosS) * 0.52 + Math.max(0, -cosS) * 0.12;
    rLegX = stride * 0.56;
    rKneeX = Math.max(0, -cosS) * 0.52 + Math.max(0, cosS) * 0.12;
    capeX = 0.42 + Math.sin(cyc * 2) * 0.08;
  }

  p.hips.position.x += (targetHipX - p.hips.position.x) * k;
  p.hips.position.y += (targetHipY - p.hips.position.y) * k;
  p.hips.rotation.z += (targetHipZRot - p.hips.rotation.z) * k;
  p.torso.rotation.x += (targetTorsoX - p.torso.rotation.x) * k;
  p.torso.rotation.y += (targetTorsoY - p.torso.rotation.y) * k;
  p.headPivot.rotation.y += (targetHeadY - p.headPivot.rotation.y) * k;
  if (p.capePivot)
    p.capePivot.rotation.x += (capeX - p.capePivot.rotation.x) * k;
  if (p.chestCore) p.chestCore.scale.setScalar(1.0 + breath * 0.12);

  p.leftArmPivot.rotation.x += (lArmX - p.leftArmPivot.rotation.x) * k;
  p.rightArmPivot.rotation.x += (rArmX - p.rightArmPivot.rotation.x) * k;
  if (p.leftElbowPivot)
    p.leftElbowPivot.rotation.x +=
      (lElX - p.leftElbowPivot.rotation.x) * k;
  if (p.rightElbowPivot)
    p.rightElbowPivot.rotation.x +=
      (rElX - p.rightElbowPivot.rotation.x) * k;

  p.leftLegPivot.rotation.x += (lLegX - p.leftLegPivot.rotation.x) * k;
  p.rightLegPivot.rotation.x += (rLegX - p.rightLegPivot.rotation.x) * k;
  if (p.leftKneePivot)
    p.leftKneePivot.rotation.x +=
      (lKneeX - p.leftKneePivot.rotation.x) * k;
  if (p.rightKneePivot)
    p.rightKneePivot.rotation.x +=
      (rKneeX - p.rightKneePivot.rotation.x) * k;

  const isUmaxRm =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  if (isUmaxRm && p.capePivot && p.capePivot.children.length > 0) {
    const cMesh = p.capePivot.children[0];
    if (
      cMesh &&
      cMesh.userData &&
      cMesh.userData.isDrapedCape &&
      cMesh.userData.basePositions
    ) {
      const posAttr = cMesh.geometry.attributes.position;
      const arr = posAttr.array;
      const base = cMesh.userData.basePositions;
      const len = cMesh.userData.capeLength || 4.35;
      const amp = isMoving ? 0.24 : 0.08;
      const freq = isMoving ? 10.5 : 3.4;
      for (let vi = 0; vi < arr.length; vi += 3) {
        const v = Math.min(1, Math.abs(base[vi + 1]) / len);
        const ripple =
          Math.sin(time * freq - v * 5.0 + base[vi] * 2.2) * amp * v * v;
        arr[vi + 2] = base[vi + 2] + ripple;
      }
      posAttr.needsUpdate = true;
    }
  }
  if (p.umaxRedManHalo) {
    p.umaxRedManHalo.rotation.z = -time * 1.15;
  }
  if (p.umaxRedManOrbiters) {
    p.umaxRedManOrbiters.rotation.y = time * 2.6;
  }
  if (p.umaxGroundRingA) p.umaxGroundRingA.rotation.z = time * 0.65;
  if (p.umaxGroundRingB) p.umaxGroundRingB.rotation.z = -time * 0.95;
}

// 5. SCULPTED SNEAKY GOLEM — CHISELED STONE MONOLITH SENTINEL (2x Size, Flat-Topped Blocky Stone Head, Heavy Brow, Glowing Hot-Pink Eyes & Notched Stone Underbite Jaw)
function buildSneakyGolemMesh(team) {
  const group = new THREE.Group();
  const isUltraMax =
    typeof userSettings !== "undefined" &&
    userSettings.qualityPreset === "ultramax";
  const isRad = team === "radiant";
  const pinkEyeHex = 0xff1493;
  const pinkGlowHex = 0xff4dff;
  const teamAccentHex = isRad ? 0x34d399 : 0xf43f5e;

  attachContactShadow(group, 6.8);

  const basaltTex = getCreatureTextureSet("roshan_basalt");
  // Warm chiseled grey-beige granite stone matching the iconic Golem design
  const stoneMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0x9c928c : 0x8d847e,
    map: basaltTex.map,
    bumpMap: basaltTex.bumpMap,
    bumpScale: isUltraMax ? 0.38 : 0.24,
    emissive: pinkEyeHex,
    emissiveMap: basaltTex.emissiveMap,
    emissiveIntensity: isUltraMax ? 0.42 : 0.2,
    roughness: isUltraMax ? 0.62 : 0.72,
    metalness: 0.14,
    flatShading: true,
  });
  const jawStoneMat = new THREE.MeshStandardMaterial({
    color: isUltraMax ? 0xada29c : 0x9c928c,
    map: basaltTex.map,
    bumpMap: basaltTex.bumpMap,
    bumpScale: 0.22,
    roughness: 0.64,
    metalness: 0.12,
    flatShading: true,
  });
  const darkCreviceMat = new THREE.MeshStandardMaterial({
    color: 0x1a141c,
    roughness: 0.9,
    metalness: 0.1,
  });
  const pinkEyeMat = new THREE.MeshStandardMaterial({
    color: 0xff99eb,
    emissive: pinkEyeHex,
    emissiveIntensity: isUltraMax ? 3.5 : 2.6,
    roughness: 0.08,
  });
  const pinkCrystalMat = new THREE.MeshStandardMaterial({
    color: pinkGlowHex,
    emissive: pinkEyeHex,
    emissiveIntensity: isUltraMax ? 2.5 : 1.6,
    roughness: 0.16,
    metalness: 0.22,
    flatShading: true,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: isUltraMax ? 0.95 : 0.45,
    metalness: 0.92,
    roughness: 0.16,
  });

  // 2x Scale Root Rig (2x size of PP Labu & Red Man!)
  const scaleRoot = new THREE.Group();
  scaleRoot.scale.setScalar(2.0);
  group.add(scaleRoot);

  const hips = new THREE.Group();
  hips.position.y = 2.05;
  scaleRoot.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  // Broad, Faceted Megalithic Boulder Torso
  const mainBoulder = new THREE.Mesh(
    new THREE.DodecahedronGeometry(2.38, 1),
    stoneMat,
  );
  mainBoulder.scale.set(1.16, 1.32, 0.88);
  mainBoulder.position.set(0, 1.72, 0);
  mainBoulder.castShadow = true;
  mainBoulder.receiveShadow = true;
  torso.add(mainBoulder);

  // Chiseled Stone Pectoral & Abdominal Slab Blocks
  [-0.95, 0.95].forEach((px) => {
    const pecSlab = new THREE.Mesh(
      new THREE.BoxGeometry(1.58, 1.25, 0.72),
      jawStoneMat,
    );
    pecSlab.position.set(px, 2.25, 1.48);
    pecSlab.rotation.y = px < 0 ? 0.18 : -0.18;
    pecSlab.rotation.x = -0.1;
    pecSlab.castShadow = true;
    torso.add(pecSlab);
  });
  const bellySlab = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 1.15, 0.65),
    stoneMat,
  );
  bellySlab.position.set(0, 0.98, 1.42);
  bellySlab.rotation.x = 0.08;
  torso.add(bellySlab);

  // Dorsal Pink Crystal Cluster Jutting from Back
  [
    { x: 0, y: 2.95, z: -1.45, rx: -0.52, rz: 0, s: 1.15 },
    { x: -0.92, y: 2.55, z: -1.35, rx: -0.45, rz: 0.35, s: 0.92 },
    { x: 0.92, y: 2.55, z: -1.35, rx: -0.45, rz: -0.35, s: 0.92 },
    { x: -0.48, y: 1.75, z: -1.68, rx: -0.72, rz: 0.2, s: 0.85 },
    { x: 0.48, y: 1.75, z: -1.68, rx: -0.72, rz: -0.2, s: 0.85 },
  ].forEach((c) => {
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.42 * c.s, 1.85 * c.s, 6),
      pinkCrystalMat,
    );
    spire.position.set(c.x, c.y, c.z);
    spire.rotation.set(c.rx, 0, c.rz);
    torso.add(spire);
  });

  // Glowing Pink Crystal Heart Fissure Recessed Between Chest Slabs
  const pinkCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.76, 0),
    pinkCrystalMat,
  );
  pinkCore.position.set(0, 1.86, 1.72);
  torso.add(pinkCore);

  // ICONIC SNEAKY GOLEM HEAD (Flat-Topped Chiseled Stone Cranium, Heavy Brow, Glowing Pink Eyes & Crenellated Underbite Jaw!)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.22, 0.82);
  torso.add(headPivot);

  // Flat-Topped Beveled Monolith Cranium (8-sided truncated frustum)
  const craniumGeo = new THREE.CylinderGeometry(0.92, 1.18, 1.38, 8);
  craniumGeo.rotateY(Math.PI / 8);
  const cranium = new THREE.Mesh(craniumGeo, jawStoneMat);
  cranium.scale.set(1.12, 1.0, 1.05);
  cranium.position.set(0, 0.56, 0.08);
  cranium.castShadow = true;
  headPivot.add(cranium);

  // Heavy Chiseled Stone Brow Ridge Overhanging the Eye Sockets
  const browLedge = new THREE.Mesh(
    new THREE.BoxGeometry(1.92, 0.34, 0.78),
    jawStoneMat,
  );
  browLedge.position.set(0, 0.56, 0.72);
  browLedge.rotation.x = 0.14;
  browLedge.castShadow = true;
  headPivot.add(browLedge);

  // Deep Recessed Dark Eye Socket Cavity + Upper Stone Tooth Notches
  const eyeCavity = new THREE.Mesh(
    new THREE.BoxGeometry(1.74, 0.38, 0.42),
    darkCreviceMat,
  );
  eyeCavity.position.set(0, 0.32, 0.84);
  headPivot.add(eyeCavity);

  const mouthCavity = new THREE.Mesh(
    new THREE.BoxGeometry(1.66, 0.42, 0.68),
    darkCreviceMat,
  );
  mouthCavity.position.set(0, -0.04, 0.68);
  headPivot.add(mouthCavity);

  // Upper Jagged Stone Tooth Notches Hanging Under the Cheek Ridge
  [-0.56, 0.0, 0.56].forEach((ux, uIdx) => {
    const uTooth = new THREE.Mesh(
      new THREE.BoxGeometry(uIdx === 1 ? 0.34 : 0.26, 0.18, 0.24),
      jawStoneMat,
    );
    uTooth.position.set(ux, 0.1, 0.98);
    headPivot.add(uTooth);
  });

  // Signature Bright Glowing Hot-Pink Eyes + Outer Pink Glow Halos
  const leftEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 12),
    pinkEyeMat,
  );
  leftEye.scale.set(1.38, 0.76, 0.72);
  leftEye.position.set(-0.46, 0.32, 0.98);
  leftEye.rotation.z = -0.1;

  const rightEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 12),
    pinkEyeMat,
  );
  rightEye.scale.set(1.38, 0.76, 0.72);
  rightEye.position.set(0.46, 0.32, 0.98);
  rightEye.rotation.z = 0.1;

  const eyeGlowMat = new THREE.MeshBasicMaterial({
    color: pinkGlowHex,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const leftEyeHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 12, 10),
    eyeGlowMat,
  );
  leftEyeHalo.scale.set(1.35, 0.82, 0.75);
  leftEyeHalo.position.copy(leftEye.position);
  const rightEyeHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 12, 10),
    eyeGlowMat,
  );
  rightEyeHalo.scale.set(1.35, 0.82, 0.75);
  rightEyeHalo.position.copy(rightEye.position);
  headPivot.add(leftEye, rightEye, leftEyeHalo, rightEyeHalo);

  // Iconic Massive Projecting Crenellated Stone Underbite Jaw (Wrapping Front & Sides!)
  const lowerJawPivot = new THREE.Group();
  lowerJawPivot.position.set(0, -0.22, 0.22);
  headPivot.add(lowerJawPivot);

  const jawBaseBlock = new THREE.Mesh(
    new THREE.BoxGeometry(1.96, 0.44, 1.32),
    jawStoneMat,
  );
  jawBaseBlock.position.set(0, -0.1, 0.44);
  jawBaseBlock.castShadow = true;
  lowerJawPivot.add(jawBaseBlock);

  // Left & Right Wrapping Cheek-Jaw Stone Pillars
  [-0.96, 0.96].forEach((jx) => {
    const sideJaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.66, 1.18),
      jawStoneMat,
    );
    sideJaw.position.set(jx, 0.12, 0.38);
    sideJaw.castShadow = true;
    lowerJawPivot.add(sideJaw);
  });

  // 4 Notched Crenellated Stone Underbite Teeth/Blocks Across Front Lip
  [
    { x: -0.68, w: 0.38, h: 0.32 },
    { x: -0.22, w: 0.4, h: 0.28 },
    { x: 0.22, w: 0.4, h: 0.3 },
    { x: 0.68, w: 0.38, h: 0.32 },
  ].forEach((tBlock) => {
    const toothBlock = new THREE.Mesh(
      new THREE.BoxGeometry(tBlock.w, tBlock.h, 0.34),
      jawStoneMat,
    );
    toothBlock.position.set(tBlock.x, 0.22, 0.98);
    toothBlock.castShadow = true;
    lowerJawPivot.add(toothBlock);
  });

  // Two-Stage Articulated Colossal Stone Boulder Arms
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-2.85, 2.48, 0.12);
  torso.add(leftArmPivot);
  const leftElbowPivot = new THREE.Group();
  leftElbowPivot.position.set(-0.22, -1.46, 0.12);
  leftArmPivot.add(leftElbowPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(2.85, 2.48, 0.12);
  torso.add(rightArmPivot);
  const rightElbowPivot = new THREE.Group();
  rightElbowPivot.position.set(0.22, -1.46, 0.12);
  rightArmPivot.add(rightElbowPivot);

  [leftArmPivot, rightArmPivot].forEach((armPivot, idx) => {
    const side = idx === 0 ? -1 : 1;
    const elPivot = idx === 0 ? leftElbowPivot : rightElbowPivot;
    // Chunky faceted rock shoulder boulder
    const pauldron = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.36, 0),
      jawStoneMat,
    );
    pauldron.scale.set(1.25, 1.05, 1.15);
    pauldron.castShadow = true;
    armPivot.add(pauldron);

    const bicepBlock = new THREE.Mesh(
      new THREE.BoxGeometry(1.24, 1.48, 1.24),
      stoneMat,
    );
    bicepBlock.position.set(side * 0.18, -0.76, 0);
    bicepBlock.rotation.z = side * -0.08;
    bicepBlock.castShadow = true;
    armPivot.add(bicepBlock);

    // Pink crystal joint vein at elbow
    const elbowJoint = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.66, 0),
      pinkCrystalMat,
    );
    elPivot.add(elbowJoint);

    // Massive Chiseled Stone Forearm & Block Fist
    const forearmBlock = new THREE.Mesh(
      new THREE.BoxGeometry(1.48, 1.68, 1.48),
      jawStoneMat,
    );
    forearmBlock.position.set(0, -0.82, 0.08);
    forearmBlock.castShadow = true;
    elPivot.add(forearmBlock);

    // 3 Chiseled Stone Knuckle Blocks
    [-0.44, 0, 0.44].forEach((kx) => {
      const knuckle = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.42, 0.42),
        stoneMat,
      );
      knuckle.position.set(kx, -1.42, 0.78);
      elPivot.add(knuckle);
    });
  });

  // Two-Stage Articulated Colossal Stone Pillar Legs
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-1.18, 0, 0);
  hips.add(leftLegPivot);
  const leftKneePivot = new THREE.Group();
  leftKneePivot.position.set(0, -1.04, 0.04);
  leftLegPivot.add(leftKneePivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(1.18, 0, 0);
  hips.add(rightLegPivot);
  const rightKneePivot = new THREE.Group();
  rightKneePivot.position.set(0, -1.04, 0.04);
  rightLegPivot.add(rightKneePivot);

  [leftLegPivot, rightLegPivot].forEach((lp, idx) => {
    const kp = idx === 0 ? leftKneePivot : rightKneePivot;
    const thighBlock = new THREE.Mesh(
      new THREE.BoxGeometry(1.32, 1.15, 1.32),
      stoneMat,
    );
    thighBlock.position.y = -0.52;
    thighBlock.castShadow = true;
    lp.add(thighBlock);

    const kneeCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.56, 0),
      pinkCrystalMat,
    );
    kneeCrystal.position.z = 0.25;
    kp.add(kneeCrystal);

    const footPillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.46, 1.12, 1.72),
      jawStoneMat,
    );
    footPillar.position.set(0, -0.54, 0.16);
    footPillar.castShadow = true;
    kp.add(footPillar);
  });

  // Ground Aura Rings (2x Scale Footprint)
  const bossRing = new THREE.Mesh(
    new THREE.RingGeometry(6.4, 7.3, 48),
    new THREE.MeshBasicMaterial({
      color: pinkGlowHex,
      side: THREE.DoubleSide,
    }),
  );
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.y = 0.36;
  group.add(bossRing);

  let umaxGolemCrown = null;
  let umaxGolemOrbiters = null;
  let umaxGroundRingA = null;
  let umaxGroundRingB = null;
  if (isUltraMax) {
    umaxGolemCrown = new THREE.Group();
    umaxGolemCrown.position.set(0, 1.56, 0.08);
    const cRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.86, 0.085, 8, 28),
      goldTrimMat,
    );
    cRing.rotation.x = Math.PI / 2;
    umaxGolemCrown.add(cRing);
    for (let ci = 0; ci < 6; ci++) {
      const ang = (ci / 6) * Math.PI * 2;
      const spire = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        ci % 2 === 0 ? pinkCrystalMat : goldTrimMat,
      );
      spire.scale.set(0.75, 1.8, 0.75);
      spire.position.set(
        Math.cos(ang) * 0.86,
        0.26,
        Math.sin(ang) * 0.86,
      );
      umaxGolemCrown.add(spire);
    }
    headPivot.add(umaxGolemCrown);

    umaxGolemOrbiters = new THREE.Group();
    umaxGolemOrbiters.position.set(0, 2.05, 0.15);
    for (let oi = 0; oi < 6; oi++) {
      const ang = (oi / 6) * Math.PI * 2;
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.36, 0),
        oi % 2 === 0 ? pinkCrystalMat : goldTrimMat,
      );
      shard.scale.set(0.8, 1.65, 0.8);
      shard.position.set(
        Math.cos(ang) * 3.45,
        Math.sin(ang) * 0.42,
        Math.sin(ang) * 3.45,
      );
      umaxGolemOrbiters.add(shard);
    }
    torso.add(umaxGolemOrbiters);

    umaxGroundRingA = new THREE.Mesh(
      new THREE.RingGeometry(7.55, 8.15, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.82,
      }),
    );
    umaxGroundRingA.rotation.x = -Math.PI / 2;
    umaxGroundRingA.position.y = 0.39;
    umaxGroundRingB = new THREE.Mesh(
      new THREE.RingGeometry(5.35, 5.95, 8),
      new THREE.MeshBasicMaterial({
        color: teamAccentHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      }),
    );
    umaxGroundRingB.rotation.x = -Math.PI / 2;
    umaxGroundRingB.position.y = 0.38;
    group.add(umaxGroundRingA, umaxGroundRingB);
  }

  return {
    group,
    parts: {
      scaleRoot,
      hips,
      torso,
      headPivot,
      lowerJawPivot,
      pinkCore,
      leftEye,
      rightEye,
      leftEyeHalo,
      rightEyeHalo,
      leftArmPivot,
      leftElbowPivot,
      rightArmPivot,
      rightElbowPivot,
      leftLegPivot,
      leftKneePivot,
      rightLegPivot,
      rightKneePivot,
      umaxGolemCrown,
      umaxGolemOrbiters,
      umaxGroundRingA,
      umaxGroundRingB,
    },
  };
}

function updateSneakyGolemAnimation(golem, time, dt, isMoving) {
  const p = golem.parts;
  if (!p || !p.torso) return;
  const k = Math.min(1, dt * 11);
  p.stridePhase = (p.stridePhase || 0) + dt * (isMoving ? 6.6 : 2.1);

  const breath = Math.sin(time * 2.1);
  let targetHipX = 0;
  let targetHipY = 2.15 + breath * 0.08;
  let targetHipZRot = 0;
  let targetTorsoX = 0.1 + breath * 0.03;
  let targetTorsoY = 0;
  let targetHeadY = Math.sin(time * 1.4) * 0.24;
  let lArmX = -0.2,
    rArmX = -0.2;
  let lElX = -0.34,
    rElX = -0.34;
  let lLegX = 0,
    rLegX = 0,
    lKneeX = 0,
    rKneeX = 0;
  let jawX = Math.max(0, breath) * 0.2;

  if (golem.castAnim > 0) {
    const prog = 1 - golem.castAnim / 0.65;
    const slam = Math.sin(prog * Math.PI);
    targetHipY = 2.15 + slam * 0.48;
    targetTorsoX = -0.26 + slam * 0.68;
    lArmX = -1.9 * slam;
    rArmX = -1.9 * slam;
    lElX = -0.45 * (1 - slam);
    rElX = -0.45 * (1 - slam);
    jawX = 0.6 * slam;
  } else if (golem.swingAnim > 0) {
    const prog = 1 - golem.swingAnim / 0.34;
    const smash = Math.sin(prog * Math.PI);
    targetTorsoY = smash * 0.4;
    rArmX = -1.52 * smash;
    rElX = -0.55 + smash * 0.35;
    lArmX = 0.38 * smash;
    jawX = 0.42 * smash;
  } else if (isMoving) {
    const cyc = p.stridePhase;
    const stride = Math.sin(cyc);
    const cosS = Math.cos(cyc);
    targetHipY = 2.15 + Math.abs(cosS) * 0.18 - Math.abs(stride) * 0.12;
    targetHipX = stride * 0.22;
    targetHipZRot = -stride * 0.08;
    targetTorsoX = 0.22;
    targetTorsoY = -stride * 0.18;
    targetHeadY = stride * 0.14;
    lArmX = stride * 0.56 - 0.18;
    lElX = -0.28 - Math.max(0, -stride) * 0.34;
    rArmX = -stride * 0.56 - 0.18;
    rElX = -0.28 - Math.max(0, stride) * 0.34;
    lLegX = -stride * 0.5;
    lKneeX = Math.max(0, cosS) * 0.5 + Math.max(0, -cosS) * 0.12;
    rLegX = stride * 0.5;
    rKneeX = Math.max(0, -cosS) * 0.5 + Math.max(0, cosS) * 0.12;
  }

  p.hips.position.x += (targetHipX - p.hips.position.x) * k;
  p.hips.position.y += (targetHipY - p.hips.position.y) * k;
  p.hips.rotation.z += (targetHipZRot - p.hips.rotation.z) * k;
  p.torso.rotation.x += (targetTorsoX - p.torso.rotation.x) * k;
  p.torso.rotation.y += (targetTorsoY - p.torso.rotation.y) * k;
  p.headPivot.rotation.y += (targetHeadY - p.headPivot.rotation.y) * k;
  if (p.lowerJawPivot)
    p.lowerJawPivot.rotation.x += (jawX - p.lowerJawPivot.rotation.x) * k;

  const isSubdued = golem.golemSubduedAtOneHp || golem.hp <= 1;
  const pulseScalar = isSubdued
    ? 0.72
    : 1.0 + Math.sin(time * 4.5) * 0.14;
  if (p.pinkCore) p.pinkCore.scale.setScalar(pulseScalar);
  if (p.leftEyeHalo) p.leftEyeHalo.scale.setScalar(pulseScalar);
  if (p.rightEyeHalo) p.rightEyeHalo.scale.setScalar(pulseScalar);

  p.leftArmPivot.rotation.x += (lArmX - p.leftArmPivot.rotation.x) * k;
  p.rightArmPivot.rotation.x += (rArmX - p.rightArmPivot.rotation.x) * k;
  if (p.leftElbowPivot)
    p.leftElbowPivot.rotation.x +=
      (lElX - p.leftElbowPivot.rotation.x) * k;
  if (p.rightElbowPivot)
    p.rightElbowPivot.rotation.x +=
      (rElX - p.rightElbowPivot.rotation.x) * k;

  p.leftLegPivot.rotation.x += (lLegX - p.leftLegPivot.rotation.x) * k;
  p.rightLegPivot.rotation.x += (rLegX - p.rightLegPivot.rotation.x) * k;
  if (p.leftKneePivot)
    p.leftKneePivot.rotation.x +=
      (lKneeX - p.leftKneePivot.rotation.x) * k;
  if (p.rightKneePivot)
    p.rightKneePivot.rotation.x +=
      (rKneeX - p.rightKneePivot.rotation.x) * k;

  if (p.umaxGolemCrown) {
    p.umaxGolemCrown.position.y = 1.56 + Math.sin(time * 3.0) * 0.08;
    p.umaxGolemCrown.rotation.y = time * 1.45;
  }
  if (p.umaxGolemOrbiters) {
    p.umaxGolemOrbiters.rotation.y = time * 2.4;
  }
  if (p.umaxGroundRingA) p.umaxGroundRingA.rotation.z = time * 0.55;
  if (p.umaxGroundRingB) p.umaxGroundRingB.rotation.z = -time * 0.85;
}

const _neutralMatCache = new Map();
function getNeutralMaterialSet(subType, isAncient) {
  if (_neutralMatCache.has(subType)) return _neutralMatCache.get(subType);
  const colorMap = {
    wolf: 0x7c8696,
    werewolf: 0x8c96a6,
    satyr: 0x7e22ce,
    centaur: 0xb45309,
    hellbear: 0xdc2626,
    harpy: 0x0284c7,
    golem: 0x78716c,
    wyvern: 0x0891b2,
    basilisk: 0x15803d,
    troll: 0x1d4ed8,
    behemoth: 0x6b21a8,
    ancient_dragon: 0x3b0764,
  };
  const glowMap = {
    wolf: 0xf43f5e,
    werewolf: 0xf43f5e,
    satyr: 0xc084fc,
    centaur: 0xf59e0b,
    hellbear: 0xf87171,
    harpy: 0x38bdf8,
    golem: 0xfbbf24,
    wyvern: 0x67e8f9,
    basilisk: 0x4ade80,
    troll: 0x60a5fa,
    behemoth: 0xe879f9,
    ancient_dragon: 0xf97316,
  };
  const texKind = ["wyvern", "basilisk", "ancient_dragon"].includes(
    subType,
  )
    ? "dragon_scales"
    : ["golem", "behemoth"].includes(subType)
      ? "roshan_basalt"
      : "kong_fur";
  const cTex = getCreatureTextureSet(texKind);
  const glowCol = glowMap[subType] || 0xf59e0b;
  const set = {
    bodyMat: registerSharedAsset(
      new THREE.MeshStandardMaterial({
        color: colorMap[subType] || 0x475569,
        map: cTex.map,
        bumpMap: cTex.bumpMap,
        bumpScale: 0.24,
        roughness: 0.56,
        metalness: isAncient ? 0.25 : 0.12,
      }),
    ),
    armorMat: registerSharedAsset(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.78,
        roughness: 0.26,
      }),
    ),
    goldTrimMat: registerSharedAsset(
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.85,
        roughness: 0.22,
      }),
    ),
    glowMat: registerSharedAsset(
      new THREE.MeshStandardMaterial({
        color: glowCol,
        emissive: glowCol,
        emissiveIntensity: 1.75,
      }),
    ),
  };
  _neutralMatCache.set(subType, set);
  return set;
}

function buildRefinedNeutralMesh(subType) {
  if (subType === "vampire") return buildVampireMesh();
  if (subType === "werewolf") return buildWerewolfMesh();
  const group = new THREE.Group();
  const isAncient = [
    "golem",
    "wyvern",
    "basilisk",
    "behemoth",
    "ancient_dragon",
  ].includes(subType);
  const isBig =
    isAncient || ["centaur", "hellbear", "werewolf"].includes(subType);
  const sc = isAncient ? 1.66 : isBig ? 1.46 : 1.12;

  attachContactShadow(group, 1.25 * sc);
  const { bodyMat, armorMat, goldTrimMat, glowMat } =
    getNeutralMaterialSet(subType, isAncient);

  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  let parts = { bodyPivot, kind: "biped", sc };

  if (subType === "wolf") {
    parts.kind = "quadruped";
    bodyPivot.position.y = 0.92 * sc;
    const wolfStations = [
      { y: -0.78 * sc, rx: 0.26 * sc, rz: 0.24 * sc },
      { y: -0.25 * sc, rx: 0.36 * sc, rz: 0.34 * sc },
      {
        y: 0.35 * sc,
        rx: 0.48 * sc,
        rz: 0.45 * sc,
        archFront: 0.08 * sc,
      },
      { y: 0.78 * sc, rx: 0.32 * sc, rz: 0.3 * sc },
    ];
    const body = buildLoftedMesh(wolfStations, 16, bodyMat);
    body.rotation.x = Math.PI / 2;
    bodyPivot.add(body);

    const mane = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 * sc, 0.26 * sc, 0.98 * sc),
      glowMat,
    );
    mane.position.set(0, 0.44 * sc, 0.15 * sc);
    bodyPivot.add(mane);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.12 * sc, -0.75 * sc),
      new THREE.Vector3(0, 0.32 * sc, -1.18 * sc),
      new THREE.Vector3(0, 0.16 * sc, -1.48 * sc),
    ]);
    bodyPivot.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(tailCurve, 8, 0.11 * sc, 6, false),
        bodyMat,
      ),
    );

    const head = new THREE.Group();
    head.position.set(0, 0.28 * sc, 0.86 * sc);
    const skull = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.42 * sc, 1),
      bodyMat,
    );
    const snout = new THREE.Mesh(
      new THREE.ConeGeometry(0.21 * sc, 0.52 * sc, 6),
      bodyMat,
    );
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.06 * sc, 0.38 * sc);
    head.add(skull, snout);
    [-0.18, 0.18].forEach((ex) => {
      const ear = new THREE.Mesh(
        new THREE.ConeGeometry(0.08 * sc, 0.28 * sc, 4),
        bodyMat,
      );
      ear.position.set(ex * sc, 0.38 * sc, -0.05 * sc);
      head.add(ear);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.065 * sc, 8, 8),
        glowMat,
      );
      eye.position.set(ex * sc * 0.8, 0.09 * sc, 0.3 * sc);
      head.add(eye);
    });
    bodyPivot.add(head);
    const legs = [];
    [
      [-0.28, 0.5],
      [0.28, 0.5],
      [-0.28, -0.5],
      [0.28, -0.5],
    ].forEach(([lx, lz]) => {
      const lp = new THREE.Group();
      lp.position.set(lx * sc, -0.25 * sc, lz * sc);
      const legM = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.11 * sc, 0.46 * sc, 4, 8),
        bodyMat,
      );
      legM.position.y = -0.28 * sc;
      lp.add(legM);
      bodyPivot.add(lp);
      legs.push(lp);
    });
    parts.head = head;
    parts.legs = legs;
  } else if (subType === "werewolf") {
    // Heavily Muscled Upright Dire Forest Werewolf
    parts.kind = "werewolf_biped";
    const wSc = sc * 1.12;
    bodyPivot.position.y = 1.36 * wSc;

    const muscleMat = registerSharedAsset(
      new THREE.MeshStandardMaterial({
        color: 0x3f3742,
        map: getCreatureTextureSet("kong_fur").map,
        bumpMap: getCreatureTextureSet("kong_fur").bumpMap,
        bumpScale: 0.26,
        roughness: 0.6,
        metalness: 0.1,
      }),
    );
    const clawMat = registerSharedAsset(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        roughness: 0.28,
      }),
    );

    // Massive V-Tapered Muscular Upper Chest
    const chest = new THREE.Mesh(
      new THREE.SphereGeometry(0.6 * wSc, 14, 12),
      bodyMat,
    );
    chest.scale.set(1.28, 1.04, 0.86);
    chest.position.set(0, 0.34 * wSc, 0.06 * wSc);
    chest.rotation.x = 0.2;
    chest.castShadow = true;
    bodyPivot.add(chest);
    parts.chest = chest;

    // Sculpted Left & Right Pectoral Slabs + 6-Pack Abdominal Plates
    [-1, 1].forEach((side) => {
      const pec = new THREE.Mesh(
        new THREE.SphereGeometry(0.3 * wSc, 12, 10),
        muscleMat,
      );
      pec.scale.set(1.16, 0.8, 0.64);
      pec.position.set(side * 0.27 * wSc, 0.38 * wSc, 0.37 * wSc);
      bodyPivot.add(pec);
    });
    for (let row = 0; row < 3; row++) {
      [-1, 1].forEach((side) => {
        const ab = new THREE.Mesh(
          new THREE.SphereGeometry(0.112 * wSc, 8, 8),
          muscleMat,
        );
        ab.scale.set(1.12, 0.72, 0.56);
        ab.position.set(
          side * 0.12 * wSc,
          (0.04 - row * 0.14) * wSc,
          (0.32 - row * 0.02) * wSc,
        );
        bodyPivot.add(ab);
      });
    }

    // Thick Shoulder Mane & Glowing Bloodmoon Scar
    const mane = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.6 * wSc, 1),
      armorMat,
    );
    mane.scale.set(1.24, 0.68, 1.0);
    mane.position.set(0, 0.66 * wSc, -0.05 * wSc);
    bodyPivot.add(mane);

    const scar = new THREE.Mesh(
      new THREE.BoxGeometry(0.04 * wSc, 0.36 * wSc, 0.04 * wSc),
      glowMat,
    );
    scar.position.set(-0.2 * wSc, 0.38 * wSc, 0.53 * wSc);
    scar.rotation.z = 0.38;
    bodyPivot.add(scar);

    // Snarling Lupine Head, Ears & Ivory Fangs
    const head = new THREE.Group();
    head.position.set(0, 0.84 * wSc, 0.35 * wSc);
    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 * wSc, 12, 12),
      bodyMat,
    );
    skull.scale.set(1.04, 0.94, 1.14);
    const snout = new THREE.Mesh(
      new THREE.BoxGeometry(0.22 * wSc, 0.16 * wSc, 0.34 * wSc),
      muscleMat,
    );
    snout.position.set(0, -0.04 * wSc, 0.26 * wSc);
    head.add(skull, snout);
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(
        new THREE.ConeGeometry(0.08 * wSc, 0.26 * wSc, 5),
        armorMat,
      );
      ear.position.set(side * 0.16 * wSc, 0.28 * wSc, -0.04 * wSc);
      ear.rotation.z = -side * 0.22;
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.038 * wSc, 8, 8),
        glowMat,
      );
      eye.position.set(side * 0.1 * wSc, 0.06 * wSc, 0.23 * wSc);
      const fang = new THREE.Mesh(
        new THREE.ConeGeometry(0.02 * wSc, 0.075 * wSc, 5),
        clawMat,
      );
      fang.rotation.x = Math.PI;
      fang.position.set(side * 0.065 * wSc, -0.11 * wSc, 0.36 * wSc);
      head.add(ear, eye, fang);
    });
    bodyPivot.add(head);
    parts.head = head;

    // Heavily Muscled Arms, Boulder Deltoids, Iron Bracers & Bone Claws
    const makeMuscularArm = (side) => {
      const armPiv = new THREE.Group();
      armPiv.position.set(side * 0.74 * wSc, 0.52 * wSc, 0.04 * wSc);
      const delt = new THREE.Mesh(
        new THREE.SphereGeometry(0.28 * wSc, 10, 10),
        bodyMat,
      );
      const bicep = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.19 * wSc, 0.38 * wSc, 6, 10),
        muscleMat,
      );
      bicep.position.set(side * 0.06 * wSc, -0.28 * wSc, 0.04 * wSc);
      const forearm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.17 * wSc, 0.4 * wSc, 6, 10),
        bodyMat,
      );
      forearm.position.set(side * 0.08 * wSc, -0.64 * wSc, 0.14 * wSc);
      forearm.rotation.x = -0.32;
      const bracer = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.185 * wSc,
          0.185 * wSc,
          0.15 * wSc,
          10,
        ),
        armorMat,
      );
      bracer.position.set(side * 0.08 * wSc, -0.7 * wSc, 0.17 * wSc);
      bracer.rotation.x = -0.32;
      const paw = new THREE.Mesh(
        new THREE.SphereGeometry(0.16 * wSc, 10, 10),
        muscleMat,
      );
      paw.position.set(side * 0.08 * wSc, -0.88 * wSc, 0.25 * wSc);
      for (let c = -1.5; c <= 1.5; c += 1) {
        const claw = new THREE.Mesh(
          new THREE.ConeGeometry(0.024 * wSc, 0.16 * wSc, 5),
          clawMat,
        );
        claw.rotation.x = Math.PI - 0.4;
        claw.position.set(c * 0.048 * wSc, -0.13 * wSc, 0.07 * wSc);
        paw.add(claw);
      }
      armPiv.add(delt, bicep, forearm, bracer, paw);
      bodyPivot.add(armPiv);
      return armPiv;
    };
    parts.leftArm = makeMuscularArm(-1);
    parts.rightArm = makeMuscularArm(1);

    // Thick Muscular Thighs, Calves & Bushy Wolf Tail
    const legs = [];
    [-0.26, 0.26].forEach((lx) => {
      const legPiv = new THREE.Group();
      legPiv.position.set(lx * wSc, -0.44 * wSc, 0);
      const thigh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.19 * wSc, 0.42 * wSc, 6, 10),
        bodyMat,
      );
      thigh.position.y = -0.22 * wSc;
      const calf = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.14 * wSc, 0.38 * wSc, 6, 10),
        muscleMat,
      );
      calf.position.set(0, -0.54 * wSc, -0.04 * wSc);
      legPiv.add(thigh, calf);
      bodyPivot.add(legPiv);
      legs.push(legPiv);
    });
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.14 * wSc, 0.68 * wSc, 8),
      armorMat,
    );
    tail.position.set(0, -0.32 * wSc, -0.46 * wSc);
    tail.rotation.x = -0.82;
    bodyPivot.add(tail);
    parts.tail = tail;
    parts.legs = legs;
  } else if (subType === "centaur") {
    parts.kind = "quadruped";
    bodyPivot.position.y = 1.05 * sc;
    const horseBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.54 * sc, 1.32 * sc, 6, 14),
      bodyMat,
    );
    horseBody.rotation.x = Math.PI / 2;
    horseBody.castShadow = true;
    bodyPivot.add(horseBody);

    const saddleCloth = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.58 * sc,
        0.58 * sc,
        0.85 * sc,
        12,
        1,
        true,
      ),
      armorMat,
    );
    saddleCloth.rotation.x = Math.PI / 2;
    bodyPivot.add(saddleCloth);

    const upperTorso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 * sc, 0.4 * sc, 1.08 * sc, 12),
      armorMat,
    );
    upperTorso.position.set(0, 0.82 * sc, 0.52 * sc);
    upperTorso.castShadow = true;
    bodyPivot.add(upperTorso);
    const chestCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22 * sc, 0),
      glowMat,
    );
    chestCore.position.set(0, 0.88 * sc, 0.96 * sc);
    bodyPivot.add(chestCore);

    const head = new THREE.Group();
    head.position.set(0, 1.52 * sc, 0.56 * sc);
    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.35 * sc, 12, 12),
      bodyMat,
    );
    const helm = new THREE.Mesh(
      new THREE.TorusGeometry(0.33 * sc, 0.05 * sc, 6, 16),
      goldTrimMat,
    );
    helm.rotation.x = Math.PI / 2;
    helm.position.y = 0.14 * sc;
    head.add(skull, helm);
    [-0.28, 0.28].forEach((hx) => {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.11 * sc, 0.62 * sc, 5),
        glowMat,
      );
      horn.position.set(hx * sc, 0.28 * sc, 0.05 * sc);
      horn.rotation.z = hx < 0 ? 0.55 : -0.55;
      head.add(horn);
    });
    bodyPivot.add(head);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.58 * sc, 1.18 * sc, 0.52 * sc);
    const pauldronL = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 * sc, 10, 10),
      goldTrimMat,
    );
    const shield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48 * sc, 0.48 * sc, 0.12 * sc, 12),
      glowMat,
    );
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.14 * sc, -0.35 * sc, 0.24 * sc);
    leftArm.add(pauldronL, shield);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.58 * sc, 1.18 * sc, 0.52 * sc);
    const pauldronR = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 * sc, 10, 10),
      goldTrimMat,
    );
    const axeShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05 * sc, 0.05 * sc, 1.65 * sc, 6),
      armorMat,
    );
    axeShaft.position.set(0, -0.35 * sc, 0.25 * sc);
    axeShaft.rotation.x = 0.55;
    const axeBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08 * sc, 0.54 * sc, 0.46 * sc),
      glowMat,
    );
    axeBlade.position.set(0, 0.22 * sc, 0.55 * sc);
    rightArm.add(pauldronR, axeShaft, axeBlade);
    bodyPivot.add(leftArm, rightArm);

    const legs = [];
    [
      [-0.32, 0.56],
      [0.32, 0.56],
      [-0.32, -0.56],
      [0.32, -0.56],
    ].forEach(([lx, lz]) => {
      const lp = new THREE.Group();
      lp.position.set(lx * sc, -0.32 * sc, lz * sc);
      const legM = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12 * sc, 0.54 * sc, 4, 8),
        bodyMat,
      );
      legM.position.y = -0.32 * sc;
      lp.add(legM);
      bodyPivot.add(lp);
      legs.push(lp);
    });
    parts.head = head;
    parts.legs = legs;
    parts.leftArm = leftArm;
    parts.rightArm = rightArm;
  } else if (
    subType === "wyvern" ||
    subType === "harpy" ||
    subType === "ancient_dragon"
  ) {
    parts.kind = "winged";
    bodyPivot.position.y = 1.72 * sc;
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.54 * sc, 1.32 * sc, 6, 14),
      bodyMat,
    );
    torso.rotation.x = 0.35;
    torso.castShadow = true;
    bodyPivot.add(torso);
    const chestGlow = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.36 * sc, 0),
      glowMat,
    );
    chestGlow.position.set(0, 0.15 * sc, 0.52 * sc);
    bodyPivot.add(chestGlow);
    const neck = new THREE.Mesh(
      new THREE.ConeGeometry(0.34 * sc, 1.15 * sc, 8),
      bodyMat,
    );
    neck.position.set(0, 0.72 * sc, 0.55 * sc);
    neck.rotation.x = 0.45;
    bodyPivot.add(neck);
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.28 * sc, 0.75 * sc, 6),
      bodyMat,
    );
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 1.15 * sc, 0.92 * sc);
    bodyPivot.add(head);
    [-0.18, 0.18].forEach((hx) => {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.08 * sc, 0.52 * sc, 5),
        goldTrimMat,
      );
      horn.position.set(hx * sc, 1.32 * sc, 0.65 * sc);
      horn.rotation.x = -0.5;
      bodyPivot.add(horn);
    });
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.24 * sc, 1.45 * sc, 6),
      bodyMat,
    );
    tail.position.set(0, -0.48 * sc, -0.82 * sc);
    tail.rotation.x = -1.1;
    bodyPivot.add(tail);

    const leftWing = new THREE.Group();
    leftWing.position.set(-0.45 * sc, 0.32 * sc, -0.05);
    const lwMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.95 * sc, 0.08 * sc, 1.02 * sc),
      glowMat,
    );
    lwMesh.position.x = -0.92 * sc;
    const lSpar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07 * sc, 0.04 * sc, 2.0 * sc, 6),
      armorMat,
    );
    lSpar.rotation.z = Math.PI / 2;
    lSpar.position.set(-0.95 * sc, 0.04 * sc, 0.42 * sc);
    const lClaw = new THREE.Mesh(
      new THREE.ConeGeometry(0.13 * sc, 0.46 * sc, 4),
      goldTrimMat,
    );
    lClaw.position.set(-1.9 * sc, 0, 0.42 * sc);
    leftWing.add(lwMesh, lSpar, lClaw);

    const rightWing = new THREE.Group();
    rightWing.position.set(0.45 * sc, 0.32 * sc, -0.05);
    const rwMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.95 * sc, 0.08 * sc, 1.02 * sc),
      glowMat,
    );
    rwMesh.position.x = 0.92 * sc;
    const rSpar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07 * sc, 0.04 * sc, 2.0 * sc, 6),
      armorMat,
    );
    rSpar.rotation.z = Math.PI / 2;
    rSpar.position.set(0.95 * sc, 0.04 * sc, 0.42 * sc);
    const rClaw = new THREE.Mesh(
      new THREE.ConeGeometry(0.13 * sc, 0.46 * sc, 4),
      goldTrimMat,
    );
    rClaw.position.set(1.9 * sc, 0, 0.42 * sc);
    rightWing.add(rwMesh, rSpar, rClaw);
    bodyPivot.add(leftWing, rightWing);
    parts.leftWing = leftWing;
    parts.rightWing = rightWing;
  } else if (subType === "golem") {
    bodyPivot.position.y = 1.28 * sc;
    const torso = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.16 * sc, 1),
      bodyMat,
    );
    torso.castShadow = true;
    bodyPivot.add(torso);
    const head = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.5 * sc, 0),
      bodyMat,
    );
    head.position.set(0, 1.08 * sc, 0.24 * sc);
    bodyPivot.add(head);
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.46 * sc, 0),
      glowMat,
    );
    core.position.set(0, 0.15 * sc, 0.88 * sc);
    const coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.52 * sc, 0.08 * sc, 6, 16),
      goldTrimMat,
    );
    coreRing.position.set(0, 0.15 * sc, 0.85 * sc);
    bodyPivot.add(core, coreRing);
    [-0.22, 0.22].forEach((ex) => {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.16 * sc, 0.08 * sc, 0.12 * sc),
        glowMat,
      );
      eye.position.set(ex * sc, 1.1 * sc, 0.65 * sc);
      bodyPivot.add(eye);
    });
    const leftArm = new THREE.Group();
    leftArm.position.set(-1.22 * sc, 0.58 * sc, 0);
    const laRock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.58 * sc, 0),
      bodyMat,
    );
    const laFist = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.48 * sc, 0),
      glowMat,
    );
    laFist.position.y = -0.78 * sc;
    leftArm.add(laRock, laFist);

    const rightArm = new THREE.Group();
    rightArm.position.set(1.22 * sc, 0.58 * sc, 0);
    const raRock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.58 * sc, 0),
      bodyMat,
    );
    const raFist = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.48 * sc, 0),
      glowMat,
    );
    raFist.position.y = -0.78 * sc;
    rightArm.add(raRock, raFist);
    const legs = [];
    [-0.46, 0.46].forEach((lx) => {
      const lp = new THREE.Group();
      lp.position.set(lx * sc, -0.58 * sc, 0);
      const legM = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.42 * sc, 0),
        bodyMat,
      );
      legM.scale.set(0.95, 1.35, 1.05);
      legM.position.y = -0.34 * sc;
      lp.add(legM);
      bodyPivot.add(lp);
      legs.push(lp);
    });

    bodyPivot.add(leftArm, rightArm);
    parts.head = head;
    parts.leftArm = leftArm;
    parts.rightArm = rightArm;
    parts.legs = legs;
  } else {
    // Satyr, Hellbear, Troll, Basilisk, Behemoth with Lofted Muscular Anatomy
    bodyPivot.position.y = 1.28 * sc;
    const bipedStations = [
      { y: -0.88 * sc, rx: 0.56 * sc, rz: 0.46 * sc },
      { y: -0.25 * sc, rx: 0.64 * sc, rz: 0.52 * sc },
      {
        y: 0.35 * sc,
        rx: 0.82 * sc,
        rz: 0.64 * sc,
        archFront: 0.12 * sc,
      },
      { y: 0.85 * sc, rx: 0.58 * sc, rz: 0.48 * sc },
    ];
    const torso =
      subType === "behemoth"
        ? new THREE.Mesh(
            new THREE.DodecahedronGeometry(1.18 * sc, 1),
            bodyMat,
          )
        : buildLoftedMesh(bipedStations, 16, bodyMat);
    torso.castShadow = true;
    bodyPivot.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.45 * sc, 12, 12),
      bodyMat,
    );
    head.position.set(0, 1.05 * sc, 0.2 * sc);
    bodyPivot.add(head);
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4 * sc, 0),
      glowMat,
    );
    core.position.set(0, 0.16 * sc, 0.72 * sc);
    bodyPivot.add(core);
    [-0.64 * sc, 0.64 * sc].forEach((sx) => {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.18 * sc, 0.96 * sc, 7),
        glowMat,
      );
      horn.position.set(sx, 0.94 * sc, 0.1);
      horn.rotation.z = sx < 0 ? 0.42 : -0.42;
      bodyPivot.add(horn);
    });
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.82 * sc, 0.48 * sc, 0);
    const laShoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 * sc, 10, 10),
      armorMat,
    );
    const laMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22 * sc, 0.76 * sc, 5, 8),
      bodyMat,
    );
    laMesh.position.y = -0.42 * sc;
    leftArm.add(laShoulder, laMesh);
    const rightArm = new THREE.Group();
    rightArm.position.set(0.82 * sc, 0.48 * sc, 0);
    const raShoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 * sc, 10, 10),
      armorMat,
    );
    const raMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22 * sc, 0.76 * sc, 5, 8),
      bodyMat,
    );
    raMesh.position.y = -0.42 * sc;
    rightArm.add(raShoulder, raMesh);

    if (subType === "satyr" || subType === "troll") {
      const staff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * sc, 0.05 * sc, 1.85 * sc, 6),
        armorMat,
      );
      staff.position.set(0, -0.35 * sc, 0.25 * sc);
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.26 * sc, 0),
        glowMat,
      );
      orb.position.set(0, 0.65 * sc, 0.25 * sc);
      rightArm.add(staff, orb);
    } else if (subType === "hellbear" || subType === "behemoth") {
      [-0.14, 0, 0.14].forEach((cx) => {
        const clawL = new THREE.Mesh(
          new THREE.ConeGeometry(0.075 * sc, 0.46 * sc, 4),
          glowMat,
        );
        clawL.position.set(cx * sc, -0.9 * sc, 0.15 * sc);
        clawL.rotation.x = Math.PI;
        const clawR = clawL.clone();
        leftArm.add(clawL);
        rightArm.add(clawR);
      });
    }

    const legs = [];
    [-0.34, 0.34].forEach((lx) => {
      const lp = new THREE.Group();
      lp.position.set(lx * sc, -0.66 * sc, 0);
      const legM = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.18 * sc, 0.44 * sc, 4, 8),
        bodyMat,
      );
      legM.position.y = -0.28 * sc;
      lp.add(legM);
      bodyPivot.add(lp);
      legs.push(lp);
    });

    bodyPivot.add(leftArm, rightArm);
    parts.head = head;
    parts.leftArm = leftArm;
    parts.rightArm = rightArm;
    parts.legs = legs;
  }

  if (isAncient) {
    const ancientCrown = new THREE.Mesh(
      new THREE.RingGeometry(1.38 * sc, 1.62 * sc, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
      }),
    );
    ancientCrown.rotation.x = -Math.PI / 2;
    ancientCrown.position.y = 0.08;
    group.add(ancientCrown);
  }

  return { group, parts };
}

function buildVampireMesh(unitName = "") {
  const group = new THREE.Group();
  const isLeader =
    unitName.includes("Lord") || unitName.includes("Leader");
  const isElder = isLeader || unitName.includes("Elder");
  const isFem =
    unitName.includes("Bloodfiend") || unitName.includes("Courtesan");
  const sc = isLeader ? 1.44 : isElder ? 1.15 : isFem ? 1.03 : 1.07;
  group.scale.setScalar(sc);
  group.userData.baseScale = sc;
  attachContactShadow(group, 1.52 * sc);

  // Human-Proportioned Articulated Rig
  const hips = new THREE.Group();
  hips.position.y = 1.48;
  group.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 1.56, 0.02);
  torso.add(neckPivot);

  const shX = isFem ? 0.44 : 0.52;
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-shX, 1.38, 0);
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(shX, 1.38, 0);
  torso.add(leftShoulder, rightShoulder);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.64, 0);
  leftShoulder.add(leftElbow);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.64, 0);
  rightShoulder.add(rightElbow);

  const hipX = isFem ? 0.21 : 0.24;
  const leftHip = new THREE.Group();
  leftHip.position.set(-hipX, -0.02, 0);
  const rightHip = new THREE.Group();
  rightHip.position.set(hipX, -0.02, 0);
  hips.add(leftHip, rightHip);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.68, 0.02);
  leftHip.add(leftKnee);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.68, 0.02);
  rightHip.add(rightKnee);

  const leftAnkle = new THREE.Group();
  leftAnkle.position.set(0, -0.66, 0.04);
  leftKnee.add(leftAnkle);

  const rightAnkle = new THREE.Group();
  rightAnkle.position.set(0, -0.66, 0.04);
  rightKnee.add(rightAnkle);

  // Aristocratic Velvet, Silk & Gold Materials (Vampire Lord wears Scarlet-Crimson & Gold Regalia)
  const coatTex = createHeroMaterialSet(
    isLeader ? 0x881337 : isElder ? 0x3b0764 : 0x1e1b4b,
    0xfacc15,
    "cloth",
  );
  const coatMat = makeHeroPBRMaterial(coatTex, {
    bumpScale: 0.07,
    side: THREE.DoubleSide,
  });
  coatMat.emissive = new THREE.Color(isLeader ? 0x500724 : 0x1e0826);
  coatMat.emissiveIntensity = isLeader ? 0.62 : 0.38;
  const velvetTex = createHeroMaterialSet(
    isLeader ? 0xe11d48 : 0x881337,
    0xfef08a,
    "cloth",
  );
  const velvetMat = makeHeroPBRMaterial(velvetTex, {
    bumpScale: 0.06,
    side: THREE.DoubleSide,
  });
  velvetMat.emissive = new THREE.Color(isLeader ? 0x881337 : 0x3b0712);
  velvetMat.emissiveIntensity = isLeader ? 0.68 : 0.42;
  const limbTex = createHeroMaterialSet(0x312e59, 0xf43f5e, "cloth");
  const limbMat = makeHeroPBRMaterial(limbTex, { bumpScale: 0.07 });
  const bootTex = createHeroMaterialSet(0x27272a, 0x94a3b8, "scale");
  const bootMat = makeHeroPBRMaterial(bootTex, { bumpScale: 0.07 });
  const goldTrimMat = makeHeroPBRMaterial(
    createHeroMaterialSet(0xf59e0b, 0xfef08a, "plate"),
    { bumpScale: 0.06 },
  );
  const shirtMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.48 }),
  );
  const rubyMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 1.35,
      roughness: 0.25,
    }),
  );
  const fangMat = registerSharedAsset(
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  const clawMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({
      color: 0xffe4e6,
      emissive: 0xbe123c,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.35,
    }),
  );

  // 1. Sculpted Human Torso, Tailored Coat, Silk Waistcoat & Cravat
  const wScale = isFem ? 0.85 : 0.98;
  const chestStations = [
    { y: 0.02, rx: 0.36 * wScale, rz: 0.25 * wScale },
    { y: 0.44, rx: 0.35 * wScale, rz: 0.24 * wScale },
    {
      y: 0.9,
      rx: 0.5 * wScale,
      rz: 0.34 * wScale,
      archFront: 0.08 * wScale,
      h2: 0.06,
    },
    {
      y: 1.24,
      rx: 0.56 * wScale,
      rz: 0.35 * wScale,
      archFront: 0.05 * wScale,
      h2: 0.08,
    },
    { y: 1.48, rx: 0.36 * wScale, rz: 0.25 * wScale },
    { y: 1.56, rx: 0.2 * wScale, rz: 0.19 * wScale },
  ];
  torso.add(buildLoftedMesh(chestStations, 24, coatMat));

  // Waist Belt & Golden Buckle
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36 * wScale, 0.37 * wScale, 0.12, 18),
    bootMat,
  );
  belt.scale.set(1.0, 1.0, 0.72);
  belt.position.set(0, 0.38, 0);
  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.08),
    goldTrimMat,
  );
  buckle.position.set(0, 0.38, 0.26 * wScale);
  torso.add(belt, buckle);

  // Ivory Aristocratic Cravat & Ruby Brooch
  const cravat = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.38, 0.1),
    shirtMat,
  );
  cravat.position.set(0, 1.24, 0.31 * wScale);
  const brooch = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.065, 0),
    rubyMat,
  );
  brooch.position.set(0, 1.32, 0.36 * wScale);
  torso.add(cravat, brooch);

  // Upturned Noble High Collar
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.36 * wScale,
      0.27 * wScale,
      0.28,
      16,
      1,
      true,
      Math.PI * 0.22,
      Math.PI * 1.56,
    ),
    velvetMat,
  );
  collar.position.set(0, 1.56, -0.02);
  torso.add(collar);

  // Tailored Coat Skirt / Coattails
  const coatSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.36 * wScale,
      0.56 * wScale,
      0.78,
      20,
      1,
      true,
      Math.PI * 0.16,
      Math.PI * 1.68,
    ),
    coatMat,
  );
  coatSkirt.position.set(0, -0.34, 0);
  hips.add(coatSkirt);

  // Flowing Aristocratic Cape
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 1.46, -0.25);
  torso.add(capePivot);
  capePivot.add(
    buildDrapedCapeMesh(
      isElder ? 1.34 : 1.14,
      isElder ? 1.86 : 1.62,
      isElder ? 2.04 : 1.86,
      5,
      velvetMat,
    ),
  );

  // 2. Sculpted Human Head & Face + Glowing Red Vampiric Eyes + Fangs
  const hairHex = isElder ? 0xf1f5f9 : isFem ? 0x7f1d1d : 0x1e293b;
  const faceStyle = isFem ? "valkyra" : "kaelthar";
  const face = buildRefinedHeroFace(
    0xf5e2da,
    0xdc2626,
    hairHex,
    faceStyle,
  );
  neckPivot.add(face);

  // Luminous Crimson-Red Eyes & Ocular Glow
  const redEyeIrisMat = registerSharedAsset(
    new THREE.MeshBasicMaterial({ color: 0xff1e38 }),
  );
  const redEyeCoreMat = registerSharedAsset(
    new THREE.MeshBasicMaterial({ color: 0xffcdd5 }),
  );
  const redEyeHaloMat = registerSharedAsset(
    new THREE.MeshBasicMaterial({
      color: 0xe11d48,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    }),
  );
  [-0.105, 0.105].forEach((ex) => {
    const redEye = new THREE.Mesh(
      new THREE.SphereGeometry(0.031, 12, 10),
      redEyeIrisMat,
    );
    redEye.scale.set(1.18, 0.84, 0.48);
    redEye.position.set(ex, 0.295, 0.317);
    redEye.rotation.y = ex < 0 ? -0.18 : 0.18;

    const eyeSpark = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 8, 8),
      redEyeCoreMat,
    );
    eyeSpark.position.set(ex + (ex < 0 ? 0.008 : -0.008), 0.301, 0.331);

    const eyeHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.056, 10, 8),
      redEyeHaloMat,
    );
    eyeHalo.scale.set(1.25, 0.85, 0.5);
    eyeHalo.position.set(ex, 0.295, 0.315);

    face.add(redEye, eyeSpark, eyeHalo);
  });

  [-0.036, 0.036].forEach((fx) => {
    const fang = new THREE.Mesh(
      new THREE.ConeGeometry(0.013, 0.048, 5),
      fangMat,
    );
    fang.rotation.x = Math.PI;
    fang.position.set(fx, 0.125, 0.305);
    face.add(fang);
  });

  // Pointed Vampiric Bat Ears & Gothic Shoulders
  const earSkinMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({ color: 0xf5e2da, roughness: 0.52 }),
  );
  [-1, 1].forEach((side) => {
    const batEar = new THREE.Mesh(
      new THREE.ConeGeometry(0.036, 0.15, 5),
      earSkinMat,
    );
    batEar.position.set(side * 0.21, 0.3, -0.02);
    batEar.rotation.z = -side * 0.86;
    batEar.rotation.x = -0.18;
    face.add(batEar);

    const lapel = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.42, 4),
      velvetMat,
    );
    lapel.scale.set(1.25, 1.0, 0.24);
    lapel.position.set(side * 0.42, 1.46, 0.12);
    lapel.rotation.z = side * 0.48;
    lapel.rotation.x = 0.28;
    torso.add(lapel);
  });

  let leaderBloodOrb = null;
  let leaderHaloRing = null;
  if (isLeader) {
    // Tall Gilded Ruby-Spiked Vampire Lord Crown
    const crownRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.028, 8, 18),
      goldTrimMat,
    );
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.set(0, 0.49, 0.01);
    face.add(crownRing);
    for (let ci = 0; ci < 7; ci++) {
      const ca = (ci / 7) * Math.PI * 2;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(0.028, ci === 0 ? 0.17 : 0.13, 5),
        ci % 2 === 0 ? rubyMat : goldTrimMat,
      );
      spire.position.set(
        Math.cos(ca) * 0.18,
        0.56,
        0.01 + Math.sin(ca) * 0.18,
      );
      face.add(spire);
    }
    // Royal Sanguine Back-Halo behind Vampire Lord's Head
    leaderHaloRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.022, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    );
    leaderHaloRing.position.set(0, 1.78, -0.22);
    torso.add(leaderHaloRing);

    // Dramatic Crimson-Gold Bat-Wing Shoulder Mantle
    [-1, 1].forEach((side) => {
      const wingFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.3, 0.05),
        velvetMat,
      );
      wingFin.position.set(side * 0.72, 1.56, -0.1);
      wingFin.rotation.z = side * 0.46;
      wingFin.rotation.y = -side * 0.24;
      const wingTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.64, 0.045, 0.06),
        goldTrimMat,
      );
      wingTrim.position.set(side * 0.72, 1.7, -0.1);
      wingTrim.rotation.z = side * 0.46;
      wingTrim.rotation.y = -side * 0.24;
      torso.add(wingFin, wingTrim);
    });
    // Orbiting Sanguine Soul Crystal
    leaderBloodOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 1),
      rubyMat,
    );
    leaderBloodOrb.position.set(0.76, 1.82, 0.24);
    torso.add(leaderBloodOrb);
  }

  // 3. Articulated Human Arms & Sharp Vampiric Claws on BOTH Hands (No Swords!)
  const aScale = isFem ? 0.84 : 0.98;
  const handMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({ color: 0xf5e2da, roughness: 0.55 }),
  );
  [leftShoulder, rightShoulder].forEach((shPivot, idx) => {
    const side = idx === 0 ? -1 : 1;
    const elPivot = idx === 0 ? leftElbow : rightElbow;

    const shoulderCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * aScale, 14, 12),
      coatMat,
    );
    shoulderCap.position.set(-side * 0.03, 0, 0);
    const shoulderTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.185 * aScale, 0.022, 8, 18),
      goldTrimMat,
    );
    shoulderTrim.rotation.set(0.2, 0, -side * 0.4);
    shPivot.add(shoulderCap, shoulderTrim);

    const upperArmStations = [
      { y: -0.64, rx: 0.105 * aScale, rz: 0.105 * aScale },
      { y: -0.42, rx: 0.132 * aScale, rz: 0.136 * aScale },
      { y: -0.18, rx: 0.158 * aScale, rz: 0.162 * aScale },
      { y: 0.02, rx: 0.145 * aScale, rz: 0.145 * aScale },
    ];
    shPivot.add(buildLoftedMesh(upperArmStations, 16, coatMat));

    const elbowCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.115 * aScale, 12, 10),
      goldTrimMat,
    );
    elPivot.add(elbowCap);

    const forearmStations = [
      { y: -0.56, rx: 0.092 * aScale, rz: 0.096 * aScale },
      { y: -0.34, rx: 0.122 * aScale, rz: 0.126 * aScale },
      { y: -0.14, rx: 0.132 * aScale, rz: 0.136 * aScale },
      { y: 0.0, rx: 0.108 * aScale, rz: 0.108 * aScale },
    ];
    elPivot.add(buildLoftedMesh(forearmStations, 16, velvetMat));

    const cuffRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.108 * aScale, 0.02, 8, 16),
      goldTrimMat,
    );
    cuffRing.rotation.x = Math.PI / 2;
    cuffRing.position.set(0, -0.52, 0);
    elPivot.add(cuffRing);

    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14 * aScale, 0.15 * aScale, 0.09 * aScale),
      handMat,
    );
    palm.position.set(0, -0.61, 0.02);
    elPivot.add(palm);

    // 4 Curved Razor Vampiric Claws per Hand
    for (let ci = -1.5; ci <= 1.5; ci += 1) {
      const claw = new THREE.Mesh(
        new THREE.ConeGeometry(0.017 * aScale, 0.2 * aScale, 5),
        clawMat,
      );
      claw.rotation.x = Math.PI - 0.34;
      claw.position.set(
        ci * 0.032 * aScale,
        -0.74 * aScale,
        0.055 * aScale,
      );
      elPivot.add(claw);
    }
  });

  // 4. Articulated Human Legs & Tailored Boots
  const rScale = isFem ? 0.86 : 0.98;
  [leftHip, rightHip].forEach((hipPivot, idx) => {
    const kneePivot = idx === 0 ? leftKnee : rightKnee;
    const anklePivot = idx === 0 ? leftAnkle : rightAnkle;

    const hipCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.19 * rScale, 14, 12),
      limbMat,
    );
    hipPivot.add(hipCap);

    const thighStations = [
      { y: -0.66, rx: 0.125 * rScale, rz: 0.13 * rScale },
      { y: -0.44, rx: 0.155 * rScale, rz: 0.16 * rScale },
      { y: -0.22, rx: 0.188 * rScale, rz: 0.192 * rScale },
      { y: -0.02, rx: 0.198 * rScale, rz: 0.202 * rScale },
    ];
    hipPivot.add(buildLoftedMesh(thighStations, 16, limbMat));

    const kneeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.13 * rScale, 12, 10),
      bootMat,
    );
    kneePivot.add(kneeSphere);

    const greaveStations = [
      { y: -0.62, rx: 0.105 * rScale, rz: 0.115 * rScale },
      { y: -0.36, rx: 0.138 * rScale, rz: 0.15 * rScale },
      { y: -0.12, rx: 0.148 * rScale, rz: 0.158 * rScale },
      { y: 0.0, rx: 0.128 * rScale, rz: 0.134 * rScale },
    ];
    kneePivot.add(buildLoftedMesh(greaveStations, 16, bootMat));

    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 * rScale, 0.08, 0.4),
      bootMat,
    );
    sole.position.set(0, -0.02, 0.06);
    const toeCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.105 * rScale, 0.24, 6),
      goldTrimMat,
    );
    toeCap.rotation.x = Math.PI / 2;
    toeCap.scale.set(1.0, 1.0, 0.65);
    toeCap.position.set(0, 0.03, 0.2);
    anklePivot.add(sole, toeCap);
  });

  // Crimson Ground Aura Ring (Enhanced dual-sigil for Vampire Leader)
  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(
      isLeader ? 0.92 : 0.85,
      isLeader ? 1.22 : 1.05,
      28,
    ),
    new THREE.MeshBasicMaterial({
      color: isLeader ? 0xff1e42 : 0xf43f5e,
      transparent: true,
      opacity: isLeader ? 0.68 : 0.45,
      side: THREE.DoubleSide,
    }),
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.06;
  group.add(auraRing);

  const parts = {
    hips,
    torso,
    neckPivot,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    capePivot,
    auraRing,
    leaderBloodOrb,
    leaderHaloRing,
  };
  return { group, parts };
}

function updateVampireAnimation(mob, time, dt, isMoving) {
  const p = mob.parts;
  if (!p || !p.hips) return;
  const k = Math.min(1, dt * 12);
  const runFreq = isMoving ? 10.6 : 2.6;
  p.stridePhase = (p.stridePhase || mob.animPhase) + dt * runFreq;
  const cyc = p.stridePhase;
  const stride = isMoving ? Math.sin(cyc) : 0;
  const cosS = isMoving ? Math.cos(cyc) : 0;

  p.hips.position.y =
    1.48 +
    (isMoving
      ? Math.abs(cosS) * 0.09 - 0.04
      : Math.sin(time * 2.6 + mob.animPhase) * 0.03);
  p.hips.rotation.y = isMoving ? stride * 0.08 : 0;
  p.torso.rotation.x +=
    ((isMoving ? 0.14 : 0.03) - p.torso.rotation.x) * k;
  p.torso.rotation.y = isMoving
    ? -stride * 0.1
    : Math.sin(time * 1.8 + mob.animPhase) * 0.04;

  if (p.capePivot) {
    p.capePivot.rotation.x =
      (isMoving ? 0.3 : 0.08) +
      Math.sin(time * 5.2 + mob.animPhase) * 0.06;
  }
  if (p.leftHip && p.rightHip) {
    p.leftHip.rotation.x = isMoving ? stride * 0.62 : -0.06;
    p.rightHip.rotation.x = isMoving ? -stride * 0.62 : 0.06;
  }
  if (p.leftKnee && p.rightKnee) {
    p.leftKnee.rotation.x = isMoving ? Math.max(0, -stride) * 0.72 : 0.1;
    p.rightKnee.rotation.x = isMoving ? Math.max(0, stride) * 0.72 : 0.1;
  }
  if (p.leftShoulder && p.rightShoulder) {
    if (mob.swingAnim > 0) {
      const slash = Math.sin((1 - mob.swingAnim / 0.34) * Math.PI);
      const alt = (mob.atkComboIndex || 0) % 2 === 0;
      p.rightShoulder.rotation.x = (alt ? -1.62 : -1.15) * slash;
      p.rightShoulder.rotation.z = 0.38 * slash;
      p.rightElbow.rotation.x = -0.45 * slash;
      p.leftShoulder.rotation.x = (alt ? -1.15 : -1.62) * slash;
      p.leftShoulder.rotation.z = -0.38 * slash;
      p.leftElbow.rotation.x = -0.45 * slash;
    } else {
      p.leftShoulder.rotation.x = isMoving ? -stride * 0.46 : -0.14;
      p.rightShoulder.rotation.x = isMoving ? stride * 0.46 : -0.14;
      p.leftShoulder.rotation.z = -0.16;
      p.rightShoulder.rotation.z = 0.16;
      p.leftElbow.rotation.x = isMoving ? -0.38 : -0.28;
      p.rightElbow.rotation.x = isMoving ? -0.38 : -0.28;
    }
  }
  if (p.leaderBloodOrb) {
    p.leaderBloodOrb.position.y =
      1.82 + Math.sin(time * 3.6 + mob.animPhase) * 0.14;
    p.leaderBloodOrb.rotation.y += dt * 2.6;
  }
  if (p.leaderHaloRing) {
    p.leaderHaloRing.rotation.z -= dt * 1.4;
  }
  if (p.auraRing) {
    p.auraRing.rotation.z += dt * 1.1;
  }
}

function buildWerewolfMesh(unitName = "") {
  const group = new THREE.Group();
  const isLeader =
    unitName.includes("Moonfang") || unitName.includes("Leader");
  const isAlpha = isLeader || unitName.includes("Alpha");
  const isRavager = unitName.includes("Ravager");
  const sc = isLeader ? 1.48 : isAlpha ? 1.24 : 1.12;
  group.scale.setScalar(sc);
  group.userData.baseScale = sc;
  attachContactShadow(group, 1.66 * sc);

  // Muscular Apex Werewolf Articulated Rig (Hunched Lupine-Humanoid Silhouette)
  const hips = new THREE.Group();
  hips.position.y = 1.54;
  group.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 1.54, 0.2);
  torso.add(neckPivot);

  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.66, 1.4, 0.08);
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.66, 1.4, 0.08);
  torso.add(leftShoulder, rightShoulder);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.66, 0);
  leftShoulder.add(leftElbow);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.66, 0);
  rightShoulder.add(rightElbow);

  const leftHip = new THREE.Group();
  leftHip.position.set(-0.28, -0.02, -0.02);
  const rightHip = new THREE.Group();
  rightHip.position.set(0.28, -0.02, -0.02);
  hips.add(leftHip, rightHip);

  const leftKnee = new THREE.Group();
  leftKnee.position.set(0, -0.66, 0.08);
  leftHip.add(leftKnee);

  const rightKnee = new THREE.Group();
  rightKnee.position.set(0, -0.66, 0.08);
  rightHip.add(rightKnee);

  const leftAnkle = new THREE.Group();
  leftAnkle.position.set(0, -0.7, -0.04);
  leftKnee.add(leftAnkle);

  const rightAnkle = new THREE.Group();
  rightAnkle.position.set(0, -0.7, -0.04);
  rightKnee.add(rightAnkle);

  // High-Visibility Grey Wolf Pelt (Silver-Grey for Pack, Arctic Frost-Grey for Moonfang Leader)
  const furTex = getCreatureTextureSet("kong_fur");
  const peltHex = isLeader
    ? 0xdbeafe
    : isAlpha
      ? 0x7c8594
      : isRavager
        ? 0x94a3b8
        : 0x8892a4;
  const muscleHex = isLeader
    ? 0xf8fafc
    : isAlpha
      ? 0xa8b3c4
      : isRavager
        ? 0xbdc6d4
        : 0xb0bac9;
  const snoutHex = isLeader ? 0xe2e8f0 : isAlpha ? 0x94a3b8 : 0xa3adbd;

  const furMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({
      color: peltHex,
      map: furTex.map,
      bumpMap: furTex.bumpMap,
      bumpScale: 0.24,
      roughness: 0.56,
      metalness: 0.08,
      emissive: new THREE.Color(isLeader ? 0x1e3a5f : 0x2c3545),
      emissiveIntensity: isLeader ? 0.52 : 0.44,
    }),
  );
  const muscleMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({
      color: muscleHex,
      map: furTex.map,
      bumpMap: furTex.bumpMap,
      bumpScale: 0.2,
      roughness: 0.48,
      metalness: 0.06,
      emissive: new THREE.Color(isLeader ? 0x26466d : 0x364154),
      emissiveIntensity: isLeader ? 0.46 : 0.38,
    }),
  );
  const snoutMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({
      color: snoutHex,
      map: furTex.map,
      bumpMap: furTex.bumpMap,
      bumpScale: 0.14,
      roughness: 0.54,
      emissive: new THREE.Color(0x283040),
      emissiveIntensity: 0.32,
    }),
  );
  const maneMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({
      color: isLeader ? 0x3b4d6b : 0x475569,
      map: furTex.map,
      bumpMap: furTex.bumpMap,
      bumpScale: 0.26,
      roughness: 0.72,
      emissive: new THREE.Color(isLeader ? 0x0c4a6e : 0x1e293b),
      emissiveIntensity: isLeader ? 0.42 : 0.25,
    }),
  );
  const innerEarMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({
      color: 0x6b3a46,
      roughness: 0.72,
    }),
  );
  const leatherMat = makeHeroPBRMaterial(
    createHeroMaterialSet(0x2b1d18, 0x92400e, "scale"),
    { bumpScale: 0.09, side: THREE.DoubleSide },
  );
  const ironMat = makeHeroPBRMaterial(
    createHeroMaterialSet(0x52525b, 0xfbbf24, "plate"),
    { bumpScale: 0.08 },
  );
  const clawMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xd97706,
      emissiveIntensity: 0.32,
      roughness: 0.22,
    }),
  );
  const eyeMat = registerSharedAsset(
    new THREE.MeshBasicMaterial({
      color: isLeader ? 0x38bdf8 : isAlpha ? 0xff2244 : 0xfbbf24,
    }),
  );
  const eyeHaloMat = registerSharedAsset(
    new THREE.MeshBasicMaterial({
      color: isLeader ? 0x0ea5e9 : isAlpha ? 0xf43f5e : 0xf59e0b,
      transparent: true,
      opacity: isLeader ? 0.52 : 0.38,
      depthWrite: false,
    }),
  );
  const tongueMat = registerSharedAsset(
    new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.45 }),
  );

  // 1. Broad, Hunched V-Tapered Werewolf Torso, Pectorals, Rib-Serratus & 6-Pack Abs
  const chestStations = [
    { y: 0.0, rx: 0.4, rz: 0.28, zOff: -0.02 },
    { y: 0.44, rx: 0.45, rz: 0.32, zOff: 0.0 },
    { y: 0.9, rx: 0.66, rz: 0.44, zOff: 0.04, archFront: 0.13, h2: 0.09 },
    {
      y: 1.28,
      rx: 0.76,
      rz: 0.47,
      zOff: 0.08,
      archFront: 0.11,
      h2: 0.11,
    },
    { y: 1.5, rx: 0.48, rz: 0.33, zOff: 0.12 },
    { y: 1.6, rx: 0.26, rz: 0.24, zOff: 0.15 },
  ];
  const chestMesh = buildLoftedMesh(chestStations, 28, furMat);
  torso.add(chestMesh);
  torso.userData.chestMesh = chestMesh;

  // Sculpted Pectoral Slabs + Serratus Ribs + 6-Pack Abs
  [-1, 1].forEach((side) => {
    const pec = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 14, 12),
      muscleMat,
    );
    pec.scale.set(1.18, 0.76, 0.58);
    pec.position.set(side * 0.28, 1.13, 0.42);
    pec.rotation.y = side * -0.18;
    torso.add(pec);
  });
  for (let row = 0; row < 3; row++) {
    [-1, 1].forEach((side) => {
      const ab = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 8),
        muscleMat,
      );
      ab.scale.set(1.15, 0.72, 0.52);
      ab.position.set(side * 0.13, 0.78 - row * 0.16, 0.37 - row * 0.03);
      torso.add(ab);
    });
  }

  // Layered 9-Tuft Wolf Fur Shoulder Mane & Dorsal Spine Hackles
  for (let m = 0; m < 9; m++) {
    const ang = (m / 8 - 0.5) * Math.PI * 1.45;
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.64, 6),
      maneMat,
    );
    tuft.position.set(
      Math.sin(ang) * 0.54,
      1.48 - Math.abs(m - 4) * 0.03,
      -Math.cos(ang) * 0.34 + 0.04,
    );
    tuft.rotation.x = -0.65 - Math.cos(ang) * 0.25;
    tuft.rotation.z = -Math.sin(ang) * 0.48;
    torso.add(tuft);
  }
  for (let sp = 0; sp < 4; sp++) {
    const hackle = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.42, 5),
      maneMat,
    );
    hackle.position.set(0, 1.24 - sp * 0.25, -0.34 + sp * 0.02);
    hackle.rotation.x = -1.05;
    torso.add(hackle);
  }

  // Studded Iron Waist Belt & Tattered War-Kilt Tassets
  const loinBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.46, 0.22, 18),
    ironMat,
  );
  loinBelt.scale.set(1.02, 1.0, 0.74);
  loinBelt.position.set(0, 0.06, 0);
  torso.add(loinBelt);

  const beltBuckle = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    isAlpha ? eyeMat : clawMat,
  );
  beltBuckle.position.set(0, 0.06, 0.33);
  torso.add(beltBuckle);

  for (let kt = 0; kt < 6; kt++) {
    const ka = (kt / 6) * Math.PI * 2 + 0.3;
    const tasset = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.56, 4),
      leatherMat,
    );
    tasset.scale.set(1.15, 1.0, 0.28);
    tasset.position.set(Math.sin(ka) * 0.4, -0.22, Math.cos(ka) * 0.3);
    tasset.rotation.y = ka;
    tasset.rotation.x = -0.24;
    hips.add(tasset);
  }

  // 2. Sculpted Lupine Wolf Head: Lofted Skull, Brow Ridges, Tapered Muzzle, Hinged Snarling Jaw & Ears
  const head = new THREE.Group();
  head.position.set(0, 0.14, 0.12);

  const craniumStations = [
    { y: -0.14, rx: 0.18, rz: 0.2, zOff: -0.02 },
    { y: 0.0, rx: 0.26, rz: 0.28, zOff: 0.0 },
    { y: 0.14, rx: 0.28, rz: 0.3, zOff: -0.01 },
    { y: 0.26, rx: 0.22, rz: 0.24, zOff: -0.03 },
    { y: 0.34, rx: 0.08, rz: 0.1, zOff: -0.04 },
  ];
  head.add(buildLoftedMesh(craniumStations, 20, furMat));

  // Sculpted Tapered Upper Wolf Muzzle (Replaces boxy snout!)
  const muzzleStations = [
    { y: -0.02, rx: 0.17, rz: 0.14, zOff: 0.18 },
    { y: -0.03, rx: 0.14, rz: 0.12, zOff: 0.3 },
    { y: -0.04, rx: 0.1, rz: 0.09, zOff: 0.42 },
    { y: -0.045, rx: 0.06, rz: 0.06, zOff: 0.5 },
  ];
  const upperMuzzle = buildLoftedMesh(muzzleStations, 16, snoutMat);
  upperMuzzle.rotation.x = Math.PI * 0.5;
  upperMuzzle.position.set(0, 0.04, 0.22);
  // Build muzzle along +Z directly with proper stations:
  head.remove(upperMuzzle);
  const muzzleGrp = new THREE.Group();
  const mzBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 10),
    snoutMat,
  );
  mzBack.scale.set(1.05, 0.72, 1.45);
  mzBack.position.set(0, 0.02, 0.26);
  const mzBridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.125, 0.32, 12),
    snoutMat,
  );
  mzBridge.rotation.x = Math.PI * 0.52;
  mzBridge.scale.set(1.08, 1.0, 0.78);
  mzBridge.position.set(0, 0.025, 0.36);
  const noseTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 10, 8),
    maneMat,
  );
  noseTip.scale.set(1.12, 0.85, 0.95);
  noseTip.position.set(0, 0.038, 0.51);
  muzzleGrp.add(mzBack, mzBridge, noseTip);
  head.add(muzzleGrp);

  // Hinged Lower Jaw with Tongue & Lower Fangs (Animates during attacks!)
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.04, 0.16);
  const lowerJaw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.105, 0.28, 10),
    snoutMat,
  );
  lowerJaw.rotation.x = Math.PI * 0.48;
  lowerJaw.scale.set(0.95, 1.0, 0.65);
  lowerJaw.position.set(0, -0.02, 0.16);
  const tongue = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.022, 0.2),
    tongueMat,
  );
  tongue.position.set(0, 0.01, 0.15);
  jawPivot.add(lowerJaw, tongue);
  [-1, 1].forEach((side) => {
    const lowFang = new THREE.Mesh(
      new THREE.ConeGeometry(0.016, 0.065, 5),
      clawMat,
    );
    lowFang.position.set(side * 0.048, 0.032, 0.25);
    jawPivot.add(lowFang);
  });
  jawPivot.rotation.x = 0.22; // Fierce open-mouthed snarl
  head.add(jawPivot);

  // Fierce Brow Ridges, Glowing Eyes, Cheek Fur Ruffs, Upper Fangs & Pointed Wolf Ears
  [-1, 1].forEach((side) => {
    // Heavy Angled Brow Ridge
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.036, 0.09),
      maneMat,
    );
    brow.position.set(side * 0.105, 0.145, 0.23);
    brow.rotation.z = -side * 0.28;
    brow.rotation.y = side * 0.22;

    // Glowing Predator Eye + Halo
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 8),
      eyeMat,
    );
    eye.scale.set(1.15, 0.82, 0.65);
    eye.position.set(side * 0.105, 0.112, 0.242);
    const eyeHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 8, 8),
      eyeHaloMat,
    );
    eyeHalo.position.set(side * 0.105, 0.112, 0.242);

    // Upper Canine Fang + Rear Premolar
    const upFang = new THREE.Mesh(
      new THREE.ConeGeometry(0.019, 0.082, 5),
      clawMat,
    );
    upFang.rotation.x = Math.PI;
    upFang.position.set(side * 0.064, -0.025, 0.43);
    const rearFang = new THREE.Mesh(
      new THREE.ConeGeometry(0.014, 0.052, 5),
      clawMat,
    );
    rearFang.rotation.x = Math.PI;
    rearFang.position.set(side * 0.082, -0.015, 0.34);

    // Swept Cheek Fur Ruffs (2 layered spikes per cheek)
    const ruff1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.26, 5),
      furMat,
    );
    ruff1.position.set(side * 0.25, 0.03, 0.06);
    ruff1.rotation.z = -side * 1.15;
    ruff1.rotation.y = -side * 0.35;
    const ruff2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.062, 0.22, 5),
      maneMat,
    );
    ruff2.position.set(side * 0.23, -0.05, 0.08);
    ruff2.rotation.z = -side * 1.25;

    // Tall Pointed Wolf Ear + Inner Pinna
    const earGrp = new THREE.Group();
    earGrp.position.set(side * 0.165, 0.28, -0.02);
    earGrp.rotation.set(0.16, side * 0.18, -side * 0.24);
    const earOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.082, 0.32, 6),
      maneMat,
    );
    earOuter.scale.set(1.0, 1.0, 0.58);
    earOuter.position.y = 0.14;
    const earInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.046, 0.22, 5),
      innerEarMat,
    );
    earInner.scale.set(1.0, 1.0, 0.45);
    earInner.position.set(0, 0.12, 0.022);
    earGrp.add(earOuter, earInner);

    head.add(brow, eye, eyeHalo, upFang, rearFang, ruff1, ruff2, earGrp);
  });
  neckPivot.add(head);

  // 3. Heavily Muscled Arms, Spiked Iron Pauldrons/Bracers & 5-Clawed Werewolf Hands
  [leftShoulder, rightShoulder].forEach((shPivot, idx) => {
    const side = idx === 0 ? -1 : 1;
    const elPivot = idx === 0 ? leftElbow : rightElbow;

    const delt = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 14, 12),
      furMat,
    );
    delt.scale.set(1.08, 1.04, 1.02);
    delt.position.set(-side * 0.03, 0, 0);
    shPivot.add(delt);

    // Alpha & Moonfang Leader Werewolves wear spiked iron shoulder guards
    if (isLeader || (isAlpha && idx === 0)) {
      const pauldron = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.31,
          14,
          10,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.55,
        ),
        ironMat,
      );
      pauldron.rotation.z = -side * 0.45;
      pauldron.position.set(side * 0.05, 0.04, 0);
      const pSpike = new THREE.Mesh(
        new THREE.ConeGeometry(0.052, 0.26, 5),
        clawMat,
      );
      pSpike.position.set(side * 0.18, 0.23, 0);
      pSpike.rotation.z = -side * 0.65;
      shPivot.add(pauldron, pSpike);
    }

    const upperArmStations = [
      { y: -0.66, rx: 0.155, rz: 0.155 },
      { y: -0.44, rx: 0.2, rz: 0.205 },
      { y: -0.18, rx: 0.23, rz: 0.235 },
      { y: 0.02, rx: 0.21, rz: 0.21 },
    ];
    shPivot.add(buildLoftedMesh(upperArmStations, 16, muscleMat));

    const elbowCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 12, 10),
      furMat,
    );
    const elbowTuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.22, 5),
      maneMat,
    );
    elbowTuft.position.set(side * 0.06, -0.04, -0.14);
    elbowTuft.rotation.x = -0.85;
    elPivot.add(elbowCap, elbowTuft);

    const forearmStations = [
      { y: -0.58, rx: 0.13, rz: 0.135 },
      { y: -0.36, rx: 0.175, rz: 0.18 },
      { y: -0.14, rx: 0.185, rz: 0.19 },
      { y: 0.0, rx: 0.148, rz: 0.148 },
    ];
    elPivot.add(buildLoftedMesh(forearmStations, 16, furMat));

    const bracer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.135, 0.14, 14),
      ironMat,
    );
    bracer.position.set(0, -0.49, 0);
    elPivot.add(bracer);

    // Sculpted Paw-Hand + 4 Articulated Finger Digits + Razor Ivory Claws
    const palm = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 12, 10),
      muscleMat,
    );
    palm.scale.set(1.05, 1.15, 0.72);
    palm.position.set(0, -0.61, 0.02);
    elPivot.add(palm);

    for (let ci = -1.5; ci <= 1.5; ci += 1) {
      const finger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.026, 0.11, 6),
        muscleMat,
      );
      finger.position.set(ci * 0.044, -0.69, 0.035);
      finger.rotation.x = -0.22;
      const claw = new THREE.Mesh(
        new THREE.ConeGeometry(0.022, 0.23, 5),
        clawMat,
      );
      claw.rotation.x = Math.PI - 0.38;
      claw.position.set(ci * 0.044, -0.78, 0.068);
      elPivot.add(finger, claw);
    }
    // Inner Dewclaw / Thumb Claw
    const thumbClaw = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.16, 5),
      clawMat,
    );
    thumbClaw.position.set(-side * 0.1, -0.64, 0.08);
    thumbClaw.rotation.set(Math.PI * 0.65, 0, side * 0.55);
    elPivot.add(thumbClaw);
  });

  // 4. Muscular Lupine Legs & 3-Toed Clawed Wolf Paws
  [leftHip, rightHip].forEach((hipPivot, idx) => {
    const kneePivot = idx === 0 ? leftKnee : rightKnee;
    const anklePivot = idx === 0 ? leftAnkle : rightAnkle;

    const hipCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 14, 12),
      furMat,
    );
    hipPivot.add(hipCap);

    const thighStations = [
      { y: -0.66, rx: 0.165, rz: 0.175, zOff: 0.06 },
      { y: -0.44, rx: 0.21, rz: 0.22, zOff: 0.04 },
      { y: -0.22, rx: 0.245, rz: 0.255, zOff: 0.02 },
      { y: -0.02, rx: 0.255, rz: 0.265, zOff: 0.0 },
    ];
    hipPivot.add(buildLoftedMesh(thighStations, 16, furMat));

    const kneeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 12, 10),
      muscleMat,
    );
    kneePivot.add(kneeSphere);

    const calfStations = [
      { y: -0.7, rx: 0.125, rz: 0.135, zOff: -0.04 },
      { y: -0.44, rx: 0.17, rz: 0.19, zOff: -0.06 },
      { y: -0.18, rx: 0.185, rz: 0.2, zOff: -0.02 },
      { y: 0.0, rx: 0.155, rz: 0.16, zOff: 0.0 },
    ];
    kneePivot.add(buildLoftedMesh(calfStations, 16, muscleMat));

    // Sculpted 3-Toed Wolf Paw with Ground Claws
    const pawBase = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 12, 10),
      furMat,
    );
    pawBase.scale.set(1.05, 0.62, 1.55);
    pawBase.position.set(0, 0.02, 0.1);
    anklePivot.add(pawBase);

    [-1, 0, 1].forEach((ti) => {
      const toe = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 8, 8),
        muscleMat,
      );
      toe.scale.set(0.88, 0.72, 1.45);
      toe.position.set(ti * 0.068, 0.0, 0.24);
      const toeClaw = new THREE.Mesh(
        new THREE.ConeGeometry(0.018, 0.12, 5),
        clawMat,
      );
      toeClaw.rotation.x = Math.PI * 0.56;
      toeClaw.position.set(ti * 0.068, -0.01, 0.34);
      anklePivot.add(toe, toeClaw);
    });
  });

  // 5. Lush Multi-Station Bushy Wolf Tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.08, -0.28);
  const tailStations = [
    { y: 0.0, rx: 0.1, rz: 0.1, zOff: 0.0 },
    { y: -0.18, rx: 0.16, rz: 0.16, zOff: -0.14 },
    { y: -0.4, rx: 0.18, rz: 0.18, zOff: -0.3 },
    { y: -0.62, rx: 0.12, rz: 0.12, zOff: -0.44 },
    { y: -0.78, rx: 0.02, rz: 0.02, zOff: -0.54 },
  ];
  tailPivot.add(buildLoftedMesh(tailStations, 14, maneMat));
  hips.add(tailPivot);

  let alphaLunarCrest = null;
  if (isLeader) {
    // Glowing Lunar-Cyan Alpha Halo & Dorsal Spine Crystals on Werewolf Leader
    alphaLunarCrest = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.042, 8, 24, Math.PI * 1.45),
      eyeMat,
    );
    alphaLunarCrest.position.set(0, 1.94, -0.04);
    alphaLunarCrest.rotation.z = -Math.PI * 0.22;
    torso.add(alphaLunarCrest);

    for (let sp = 0; sp < 4; sp++) {
      const lunarCrystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11, 0),
        eyeMat,
      );
      lunarCrystal.scale.set(0.8, 1.8, 0.8);
      lunarCrystal.position.set(0, 1.32 - sp * 0.25, -0.44 + sp * 0.02);
      lunarCrystal.rotation.x = -0.85;
      torso.add(lunarCrystal);
    }
  }

  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(
      isLeader ? 1.02 : 0.96,
      isLeader ? 1.34 : 1.18,
      28,
    ),
    new THREE.MeshBasicMaterial({
      color: isLeader ? 0x38bdf8 : isAlpha ? 0xf43f5e : 0xf59e0b,
      transparent: true,
      opacity: isLeader ? 0.68 : 0.42,
      side: THREE.DoubleSide,
    }),
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.06;
  group.add(auraRing);

  const parts = {
    hips,
    torso,
    neckPivot,
    jawPivot,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    tailPivot,
    auraRing,
    alphaLunarCrest,
  };
  return { group, parts };
}

function updateWerewolfAnimation(mob, time, dt, isMoving) {
  const p = mob.parts;
  if (!p || !p.hips) return;
  const k = Math.min(1, dt * 12);
  const runFreq = isMoving ? 11.4 : 2.8;
  p.stridePhase = (p.stridePhase || mob.animPhase) + dt * runFreq;
  const cyc = p.stridePhase;
  const stride = isMoving ? Math.sin(cyc) : 0;
  const cosS = isMoving ? Math.cos(cyc) : 0;

  p.hips.position.y =
    1.54 +
    (isMoving
      ? Math.abs(cosS) * 0.11 - 0.04
      : Math.sin(time * 2.8 + mob.animPhase) * 0.035);
  p.hips.rotation.y = isMoving ? stride * 0.09 : 0;
  p.torso.rotation.x +=
    ((isMoving ? 0.24 : 0.1) - p.torso.rotation.x) * k;
  p.torso.rotation.y = isMoving
    ? -stride * 0.11
    : Math.sin(time * 2.0 + mob.animPhase) * 0.04;

  if (p.neckPivot) {
    if ((mob.howlAnimTimer || 0) > 0) {
      mob.howlAnimTimer = Math.max(0, mob.howlAnimTimer - dt);
      p.neckPivot.rotation.x += (-0.68 - p.neckPivot.rotation.x) * k;
    } else {
      p.neckPivot.rotation.x +=
        ((isMoving ? -0.14 : -0.04) - p.neckPivot.rotation.x) * k;
    }
  }
  if (p.jawPivot) {
    const targetJaw =
      (mob.howlAnimTimer || 0) > 0
        ? 0.56
        : mob.swingAnim > 0
          ? 0.48
          : 0.18 + Math.sin(time * 3.6 + mob.animPhase) * 0.05;
    p.jawPivot.rotation.x += (targetJaw - p.jawPivot.rotation.x) * k;
  }
  if (p.torso.userData && p.torso.userData.chestMesh) {
    const br = 1.0 + Math.sin(time * 3.6 + mob.animPhase) * 0.045;
    p.torso.userData.chestMesh.scale.set(br, br, br);
  }
  if (p.tailPivot) {
    p.tailPivot.rotation.y =
      Math.sin(time * (isMoving ? 10.5 : 3.4) + mob.animPhase) * 0.38;
  }
  if (p.leftHip && p.rightHip) {
    p.leftHip.rotation.x = isMoving ? stride * 0.66 : -0.1;
    p.rightHip.rotation.x = isMoving ? -stride * 0.66 : 0.1;
  }
  if (p.leftKnee && p.rightKnee) {
    p.leftKnee.rotation.x = isMoving ? Math.max(0, -stride) * 0.76 : 0.18;
    p.rightKnee.rotation.x = isMoving ? Math.max(0, stride) * 0.76 : 0.18;
  }
  if (p.leftShoulder && p.rightShoulder) {
    if (mob.swingAnim > 0) {
      const slash = Math.sin((1 - mob.swingAnim / 0.34) * Math.PI);
      const alt = (mob.atkComboIndex || 0) % 2 === 0;
      p.rightShoulder.rotation.x = (alt ? -1.68 : -1.18) * slash;
      p.rightShoulder.rotation.z = 0.42 * slash;
      p.rightElbow.rotation.x = -0.48 * slash;
      p.leftShoulder.rotation.x = (alt ? -1.18 : -1.68) * slash;
      p.leftShoulder.rotation.z = -0.42 * slash;
      p.leftElbow.rotation.x = -0.48 * slash;
    } else {
      p.leftShoulder.rotation.x = isMoving ? -stride * 0.5 : -0.2;
      p.rightShoulder.rotation.x = isMoving ? stride * 0.5 : -0.2;
      p.leftShoulder.rotation.z = -0.2;
      p.rightShoulder.rotation.z = 0.2;
      p.leftElbow.rotation.x = isMoving ? -0.44 : -0.34;
      p.rightElbow.rotation.x = isMoving ? -0.44 : -0.34;
    }
  }
  if (p.alphaLunarCrest) {
    p.alphaLunarCrest.rotation.y += dt * 1.9;
  }
  if (p.auraRing) {
    p.auraRing.rotation.z -= dt * 1.1;
  }
}

function updateNeutralAnimation(mob, time, dt, isMoving) {
  const p = mob.parts;
  if (!p || !p.bodyPivot) return;
  const k = Math.min(1, dt * 12);
  const sc = p.sc || 1.0;

  if (mob.isSleeping) {
    const breath = Math.sin(time * 1.8 + mob.animPhase);
    mob.mesh.scale.set(
      1.06 + breath * 0.025,
      0.82 - breath * 0.025,
      1.06 + breath * 0.025,
    );
    return;
  } else {
    mob.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), k);
  }

  if (p.kind === "winged") {
    const flapSpeed = mob.swingAnim > 0 ? 18.0 : isMoving ? 12.2 : 6.8;
    p.wingPhase = (p.wingPhase || mob.animPhase) + dt * flapSpeed;
    const wp = p.wingPhase;
    const flap = (Math.sin(wp) + 0.2 * Math.sin(wp * 2)) * 0.62;
    p.bodyPivot.position.y =
      1.72 * sc + Math.cos(wp - 0.4) * (isMoving ? 0.18 : 0.24);
    p.bodyPivot.rotation.x +=
      ((isMoving ? 0.24 : 0.06) - p.bodyPivot.rotation.x) * k;
    p.leftWing.rotation.z = flap;
    p.rightWing.rotation.z = -flap;
  } else if (p.kind === "quadruped") {
    const isCentaurMob = mob.subType === "centaur";
    const freq = isCentaurMob ? 11.8 : 13.8;
    p.stridePhase =
      (p.stridePhase || mob.animPhase) + dt * (isMoving ? freq : 2.5);
    const cyc = p.stridePhase;
    const stride = isMoving ? Math.sin(cyc) : 0;
    const cosS = isMoving ? Math.cos(cyc) : 0;
    const baseH = isCentaurMob ? 1.05 * sc : 0.92 * sc;
    p.bodyPivot.position.y =
      baseH +
      (isMoving
        ? Math.abs(cosS) * 0.14 - Math.abs(stride) * 0.05
        : Math.sin(time * 2.5) * 0.03);
    p.bodyPivot.rotation.x +=
      ((isMoving ? Math.sin(cyc * 2) * (isCentaurMob ? 0.05 : 0.09) : 0) -
        p.bodyPivot.rotation.x) *
      k;
    p.bodyPivot.rotation.z +=
      ((isMoving ? stride * 0.05 : 0) - p.bodyPivot.rotation.z) * k;
    if (p.legs && p.legs.length === 4) {
      if (isCentaurMob) {
        // Equine diagonal canter/trot: FL + HR together, FR + HL opposite
        p.legs[0].rotation.x = stride * 0.68;
        p.legs[1].rotation.x = -stride * 0.68;
        p.legs[2].rotation.x = -stride * 0.68;
        p.legs[3].rotation.x = stride * 0.68;
      } else {
        // Wolf bounding canine gallop (forelegs paired slightly offset from hindlegs)
        const foreS = Math.sin(cyc);
        const hindS = Math.sin(cyc - 0.75);
        p.legs[0].rotation.x = foreS * 0.78;
        p.legs[1].rotation.x = Math.sin(cyc + 0.35) * 0.78;
        p.legs[2].rotation.x = hindS * 0.78;
        p.legs[3].rotation.x = Math.sin(cyc - 0.4) * 0.78;
      }
    }
    if (p.leftArm && p.rightArm) {
      if (mob.swingAnim > 0) {
        const chop = Math.sin((mob.swingAnim / 0.34) * Math.PI) * 1.35;
        p.rightArm.rotation.x = -chop;
        p.leftArm.rotation.x = -0.35 + chop * 0.25;
      } else if (isMoving) {
        p.leftArm.rotation.x = -0.42 - stride * 0.18;
        p.rightArm.rotation.x = stride * 0.52;
      }
    }
    if (p.head)
      p.head.rotation.x =
        mob.swingAnim > 0 ? 0.35 : Math.sin(time * 2.0) * 0.08;
  } else {
    const isGolemMob =
      mob.subType === "golem" || mob.subType === "behemoth";
    const isWerewolfMob = mob.subType === "werewolf";
    const freq = isGolemMob ? 8.0 : isWerewolfMob ? 11.4 : 10.2;
    p.stridePhase =
      (p.stridePhase || mob.animPhase) + dt * (isMoving ? freq : 2.2);
    const cyc = p.stridePhase;
    const stomp = isMoving ? Math.sin(cyc) : 0;
    const cosS = isMoving ? Math.cos(cyc) : 0;
    const baseY = isWerewolfMob ? 1.52 * sc : 1.28 * sc;
    p.bodyPivot.position.y =
      baseY +
      (isMoving
        ? Math.abs(cosS) * 0.16 - Math.abs(stomp) * 0.06
        : Math.sin(time * 2.2) * 0.04);
    if (isWerewolfMob) {
      if (p.chest) {
        const br = 1.0 + Math.sin(time * 3.6 + mob.animPhase) * 0.045;
        p.chest.scale.set(1.28 * br, 1.04 * br, 0.86 * br);
      }
      if (p.tail)
        p.tail.rotation.y =
          Math.sin(time * (isMoving ? 10.5 : 3.4) + mob.animPhase) * 0.38;
    }
    p.bodyPivot.position.x = isMoving ? -stomp * 0.08 * sc : 0;
    p.bodyPivot.rotation.x +=
      ((isMoving ? (isGolemMob ? 0.16 : 0.12) : 0) -
        p.bodyPivot.rotation.x) *
      k;
    p.bodyPivot.rotation.y +=
      ((isMoving ? stomp * 0.14 : 0) - p.bodyPivot.rotation.y) * k;
    p.bodyPivot.rotation.z +=
      ((isMoving ? stomp * (isGolemMob ? 0.09 : 0.06) : 0) -
        p.bodyPivot.rotation.z) *
      k;
    if (p.legs && p.legs.length === 2) {
      const legAmp = isGolemMob ? 0.54 : 0.68;
      p.legs[0].rotation.x +=
        ((isMoving ? stomp * legAmp : 0) - p.legs[0].rotation.x) * k;
      p.legs[1].rotation.x +=
        ((isMoving ? -stomp * legAmp : 0) - p.legs[1].rotation.x) * k;
    }
    if (p.leftArm && p.rightArm) {
      if (mob.swingAnim > 0) {
        const smash = Math.sin((mob.swingAnim / 0.34) * Math.PI) * 1.3;
        p.leftArm.rotation.x = -smash;
        p.rightArm.rotation.x = -smash;
      } else {
        const armAmp = isGolemMob ? 0.52 : 0.6;
        p.leftArm.rotation.x = -stomp * armAmp;
        p.rightArm.rotation.x = stomp * armAmp;
      }
    }
  }
}

class MobaEntity {
  constructor(cfg) {
    this.id = uidCounter++;
    this.name = cfg.name;
    this.team = cfg.team;
    this.type = cfg.type;
    this.subType = cfg.subType || "melee";
    this.isMega = !!cfg.isMega;
    this.isAncientNeutral = !!cfg.isAncientNeutral;
    this.isMiniBoss = !!cfg.isMiniBoss;
    this.leaderBonusType = cfg.leaderBonusType || null;
    this.vampLeaderBuffTimer = 0;
    this.wolfLeaderBuffTimer = 0;
    this.hasVampLeaderBuff = false;
    this.hasWolfLeaderBuff = false;
    this.baseScale = 1.0;
    this.heroCfg = cfg.heroCfg || null;
    this.isPlayer = !!cfg.isPlayer;

    this.maxHp = cfg.maxHp;
    this.hp = this.maxHp;
    this.hpRegen = cfg.hpRegen || 0;
    this.maxMana = cfg.maxMana || 0;
    this.mana = this.maxMana;
    this.manaRegen = cfg.manaRegen || 0;

    this.shield = 0;
    this.shieldTimer = 0;

    this.str = cfg.str || 24;
    this.agi = cfg.agi || 20;
    this.int = cfg.int || 18;

    this.atkDamage = cfg.atkDamage;
    this.atkRange = cfg.atkRange;
    this.atkCooldownBase = cfg.atkCooldown || 1.0;
    this.atkSpeedMult = 1.0;
    this.atkTimer = 0;

    this.moveSpeed = cfg.moveSpeed || 0;
    this.armor = cfg.armor || 2;
    this.lifesteal = 0;
    this.critChance = 0;
    this.critMult = 2.0;
    this.hasRadiance = false;
    this.hasSkadi = false;
    this.hasTravelBoots = false;
    this.radianceTick = 0;
    this.cdrMult = 1.0;
    this.spellAmpBonus = 0.0;
    this.bladeMailTimer = 0;
    this.bkbTimer = 0;

    this.hasAegis = false;
    this.aegisTimer = 0;
    this.reincarnating = false;

    this.radius = cfg.radius || 1.2;
    this.goldBounty = cfg.goldBounty || [40, 50];
    this.xpBounty = cfg.xpBounty || 60;

    this.camp = cfg.camp || null;
    this.homePos = new THREE.Vector3(cfg.x, 0, cfg.z);
    this.isSleeping = false;
    this.sleepBadgeEl = null;
    this.mobSkillCd = 2.5 + Math.random() * 2.0;
    this.dragonAnimState = "HOVER";
    this.dragonAnimTimer = 0;

    this.level = 1;
    this.xp = 0;
    this.xpToNext = 200;
    this.skillPoints = 1;
    this.abilityLevels = { Q: 0, W: 0, E: 0, R: 0 };
    this.attrBonusRank = 0;
    this.chosenTalents = {};
    this.cooldowns = { Q: 0, W: 0, E: 0, R: 0 };
    this.itemCooldowns = {};

    this.gold = cfg.gold || 650;
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;
    this.lastHits = 0;
    this.spreeCount = 0;
    this.multiKillCount = 0;
    this.lastKillTimestamp = -999;
    this.inventory = [null, null, null, null, null, null];
    this.tpCharges = cfg.tpCharges || 0;
    this.consumableUsedCount = {};
    this.aiThinkTimer = 0;
    this.ancientFuryTimer = 0;
    this.ancientUnderAttackTimer = 0;
    this.towerAuraActive = false;
    this.towerBonusArmor = 0;

    this.dead = false;
    this.deathAnimTimer = 0;
    this.respawnTimer = 0;
    this._stunTimer = 0;
    this._slowTimer = 0;
    this.ancientImmunityTimer = 0;
    this.golemImmunityCd = 0;
    this.labuJumpCd = 0;
    this.slowFactor = 1.0;
    this.blinkBuffTimer = 0;
    this.animPhase = Math.random() * 6.28;
    this.swingAnim = 0;
    this.castAnim = 0;
    this.celebrateTimer = 0;
    this.hitFlashTimer = 0;
    this.hitFlinchX = 0;
    this.hitFlinchZ = 0;
    this.activeDash = null;
    this.atkComboIndex = 0;
    this.spellCastCount = 0;
    this.fierySoulStacks = 0;
    this.fierySoulTimer = 0;
    this.staticOverloadReady = false;
    this.lunarEmpowerReady = false;
    this.krakenDamageAccum = 0;
    this.fleshHeapStacks = 0;
    this.turnRoll = 0;
    this.lowHpWarned = false;

    this.recentHeroDamagers = new Map();
    this.targetPos = null;
    this.targetUnit = null;
    this.attackMovePos = null;
    this.tpChannel = null;
    this.waypoints = cfg.waypoints ? [...cfg.waypoints] : [];

    this.parts = {};
    this.mesh = this.buildMesh();
    this.mesh.position.set(cfg.x, 0, cfg.z);
    scene.add(this.mesh);

    this.bar = this.createWorldBar();
    worldUiLayer.appendChild(this.bar.el);
  }

  buildMesh() {
    if (this.type === "hero" && this.heroCfg) {
      const built = buildSculptedHeroMesh(
        this.heroCfg,
        this.team,
        this.isPlayer,
        false,
      );
      this.parts = built.parts;
      attachContactShadow(built.group, 1.45);
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    if (this.type === "boss") {
      const built = buildRefinedRoshanMesh();
      this.parts = built.parts;
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    if (this.type === "dragon") {
      const built = buildElderDragonMesh();
      this.parts = built.parts;
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    if (this.type === "kong") {
      const built = buildPPLabuMesh(this.team);
      this.parts = built.parts;
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    if (this.type === "redman") {
      const built = buildRedManMesh(this.team);
      this.parts = built.parts;
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    if (this.type === "sneakygolem") {
      const built = buildSneakyGolemMesh(this.team);
      this.parts = built.parts;
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    if (this.type === "vampire" || this.subType === "vampire") {
      const built = buildVampireMesh(this.name);
      this.parts = built.parts;
      this.baseScale = built.group.userData.baseScale || 1.0;
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    if (this.type === "werewolf" || this.subType === "werewolf") {
      const built = buildWerewolfMesh(this.name);
      this.parts = built.parts;
      this.baseScale = built.group.userData.baseScale || 1.0;
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    if (this.type === "neutral") {
      const built = buildRefinedNeutralMesh(this.subType);
      this.parts = built.parts;
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    if (this.type === "creep") {
      const built = buildDetailedCreepMesh(
        this.team,
        this.subType,
        this.isMega,
      );
      this.parts = built.parts;
      built.group.traverse((o) => {
        o.userData.unit = this;
      });
      return built.group;
    }

    const group = new THREE.Group();
    const isRad = this.team === "radiant";

    if (this.type === "tower") nxgBuildTower(this, group, isRad);
    else if (this.type === "ancient") nxgBuildAncient(this, group, isRad);

    group.traverse((obj) => {
      obj.userData.unit = this;
    });
    return group;
  }

  createWorldBar() {
    const el = document.createElement("div");
    el.className = "unit-bar flex flex-col items-center opacity-90";
    const isRad = this.team === "radiant";
    const isNeut = this.team === "neutral";
    const fill =
      this.type === "sneakygolem"
        ? "bg-pink-500"
        : this.isMiniBoss
          ? this.type === "vampire"
            ? "bg-rose-500"
            : "bg-sky-400"
          : this.type === "boss" ||
              this.type === "dragon" ||
              this.type === "kong" ||
              this.type === "redman"
            ? "bg-orange-500"
            : this.isMega || this.isAncientNeutral
              ? "bg-amber-400"
              : isRad
                ? "bg-emerald-500"
                : isNeut
                  ? "bg-amber-500"
                  : "bg-rose-500";
    const wCls =
      this.type === "sneakygolem"
        ? "w-32 h-2.5"
        : this.type === "ancient" ||
            this.type === "boss" ||
            this.type === "dragon" ||
            this.type === "kong" ||
            this.type === "redman"
          ? "w-28 h-2.5"
          : this.isMiniBoss
            ? "w-[84px] h-2"
            : this.type === "hero"
              ? "w-[72px] h-1.5"
              : this.type === "tower"
                ? "w-20 h-2"
                : this.isMega || this.isAncientNeutral
                  ? "w-16 h-1.5"
                  : "w-11 h-1";

    let label = "";
    if (this.type === "hero") {
      label = `<div class="flex items-center gap-1 mb-0.5 px-1 rounded bg-slate-950/80 border border-amber-500/30 text-[8.5px] leading-tight font-bold">
                  <span class="b-lvl text-amber-400 font-mono">Lv1</span>
                  <span class="${isRad ? "text-emerald-300" : "text-rose-300"}">${this.name}</span>
              </div>`;
    } else if (this.isMiniBoss) {
      const bCol =
        this.type === "vampire"
          ? "text-rose-300 border-rose-400/60"
          : "text-sky-300 border-sky-400/60";
      label = `<div class="px-1 rounded bg-slate-950/85 border ${bCol} text-[8px] leading-tight font-cinzel font-black tracking-wide drop-shadow mb-0.5">★ ${this.name} ★</div>`;
    } else if (
      this.type === "vampire" ||
      this.type === "werewolf" ||
      this.type === "boss" ||
      this.type === "dragon" ||
      this.type === "kong" ||
      this.type === "redman" ||
      this.type === "sneakygolem" ||
      this.type === "tower" ||
      this.type === "ancient" ||
      this.isMega ||
      this.isAncientNeutral ||
      (this.type === "neutral" &&
        ["centaur", "hellbear", "werewolf"].includes(this.subType))
    ) {
      const tCol =
        this.type === "sneakygolem"
          ? "text-pink-300"
          : this.type === "boss" ||
              this.type === "dragon" ||
              this.type === "kong" ||
              this.type === "redman"
            ? "text-orange-300"
            : this.isMega || this.isAncientNeutral
              ? "text-amber-300"
              : isRad
                ? "text-emerald-300"
                : isNeut
                  ? "text-amber-300"
                  : "text-rose-300";
      label = `<div class="text-[8px] leading-none font-cinzel font-bold ${tCol} drop-shadow mb-0.5">${this.name}</div>`;
    }

    const borderCls = this.isMiniBoss
      ? this.type === "vampire"
        ? "border-rose-400/80"
        : "border-sky-400/80"
      : "border-slate-800/90";

    el.innerHTML = `
              <div class="b-status hidden flex items-center justify-center gap-0.5 mb-0.5 whitespace-nowrap"></div>
              ${label}
              <div class="${wCls} bg-slate-950/90 border ${borderCls} rounded-xs overflow-hidden relative shadow">
                  <div class="b-hp ${fill} h-full w-full"></div>
                  <div class="b-sh absolute top-0 left-0 bg-cyan-300/80 h-full w-0"></div>
              </div>
              ${this.type === "neutral" ? `<div class="b-zzz hidden text-[9px] font-black text-sky-300 tracking-wider animate-pulse drop-shadow mt-0.5">Zzz</div>` : ""}
              ${this.type === "hero" ? `<div class="w-[72px] h-[3px] bg-slate-950/90 border-x border-b border-slate-800/90"><div class="b-mp bg-sky-400 h-full w-full"></div></div>` : ""}
          `;
    return {
      el,
      status: el.querySelector(".b-status"),
      hp: el.querySelector(".b-hp"),
      sh: el.querySelector(".b-sh"),
      mp: el.querySelector(".b-mp"),
      lvl: el.querySelector(".b-lvl"),
      zzz: el.querySelector(".b-zzz"),
    };
  }

  setSleepingState(sleep) {
    if (this.type !== "neutral" || this.isSleeping === sleep) return;
    this.isSleeping = sleep;
    if (this.bar && this.bar.zzz) {
      this.bar.zzz.classList.toggle("hidden", !sleep);
    }
    if (sleep) {
      this.targetUnit = null;
      this.mesh.scale.set(1.06, 0.84, 1.06);
    } else {
      this.mesh.scale.set(1, 1, 1);
    }
  }

  wakeCamp(aggressor = null) {
    if (this.type !== "neutral") return;
    if (this.camp) {
      units.forEach((u) => {
        if (!u.dead && u.type === "neutral" && u.camp === this.camp) {
          if (u.isSleeping) {
            u.setSleepingState(false);
            spawnFloatText(u.mesh.position, "!", "#facc15", 16);
          }
          if (aggressor && !u.targetUnit) u.targetUnit = aggressor;
        }
      });
    } else {
      if (this.isSleeping) {
        this.setSleepingState(false);
        spawnFloatText(this.mesh.position, "!", "#facc15", 16);
      }
      if (aggressor && !this.targetUnit) this.targetUnit = aggressor;
    }
  }

  isRageResistingDebuff(type = "DEBUFF") {
    const isGuardian =
      this.type === "kong" ||
      this.type === "redman" ||
      this.type === "sneakygolem";
    if (!isGuardian) return false;
    const isRage =
      this.ancientFuryTimer > 0 ||
      units.some(
        (u) =>
          !u.dead &&
          u.type === "ancient" &&
          u.team === this.team &&
          (u.ancientUnderAttackTimer > 0 || (u.ancientFuryTimer || 0) > 0),
      );
    if (!isRage) return false;
    // 50% chance to resist any negative effect
    if (Math.random() < 0.5) {
      if (this.mesh && this.mesh.position) {
        spawnFloatText(
          this.mesh.position,
          `RESISTED ${type}! (50%)`,
          "#38bdf8",
          15,
        );
        spawnShockwaveRing(
          this.mesh.position.x,
          this.mesh.position.z,
          2.8,
          0x38bdf8,
          0.35,
        );
        sfx.play("spell_shield");
      }
      return true;
    }
    return false;
  }

  get stunTimer() {
    return this._stunTimer || 0;
  }

  set stunTimer(val) {
    const num = typeof val === "number" ? val : 0;
    if (num > (this._stunTimer || 0)) {
      if (this.bkbTimer > 0) {
        if (this.mesh && typeof spawnFloatText === "function") {
          spawnFloatText(this.mesh.position, "IMMUNE!", "#facc15", 14);
        }
        return;
      }
      if (this.isRageResistingDebuff("STUN")) return;
    }
    this._stunTimer = Math.max(0, num);
  }

  get slowTimer() {
    return this._slowTimer || 0;
  }

  set slowTimer(val) {
    const num = typeof val === "number" ? val : 0;
    if (num > (this._slowTimer || 0)) {
      if (this.bkbTimer > 0) {
        if (this.mesh && typeof spawnFloatText === "function") {
          spawnFloatText(this.mesh.position, "IMMUNE!", "#facc15", 14);
        }
        return;
      }
      if (this.isRageResistingDebuff("SLOW")) return;
    }
    this._slowTimer = Math.max(0, num);
  }

  getEffectiveAtkCd() {
    const furyAtkBonus =
      this.ancientFuryTimer > 0 &&
      (this.type === "kong" ||
        this.type === "redman" ||
        this.type === "sneakygolem")
        ? (this.type === "redman" ? 1.15 : 0.65)
        : 0;
    const fieryBonus =
      this.fierySoulTimer > 0 && this.fierySoulStacks
        ? this.fierySoulStacks * 0.18
        : 0;
    const wolfAtkBonus = this.hasWolfLeaderBuff ? 0.06 : 0;
    const mult =
      this.atkSpeedMult +
      (this.blinkBuffTimer > 0 ? 0.55 : 0) +
      furyAtkBonus +
      fieryBonus +
      wolfAtkBonus;
    return Math.max(0.22, this.atkCooldownBase / mult);
  }

  getEffectiveSpeed() {
    if (this.stunTimer > 0 || this.reincarnating || this.dead) return 0;
    const slow =
      this.bkbTimer > 0 || this.slowTimer <= 0 ? 1.0 : this.slowFactor;
    const buff = this.blinkBuffTimer > 0 ? 1.25 : 1.0;
    const wolfBuff = this.hasWolfLeaderBuff ? 1.08 : 1.0;
    const furySpd =
      this.ancientFuryTimer > 0 &&
      (this.type === "kong" ||
        this.type === "redman" ||
        this.type === "sneakygolem")
        ? (this.type === "redman" ? 1.95 : 1.42)
        : 1.0;
    return this.moveSpeed * slow * buff * wolfBuff * furySpd;
  }

  recordHeroInvolvement(sourceHero) {
    if (
      this.type !== "hero" ||
      !sourceHero ||
      sourceHero.type !== "hero" ||
      sourceHero.team === this.team
    )
      return;
    if (!this.recentHeroDamagers) this.recentHeroDamagers = new Map();
    this.recentHeroDamagers.set(sourceHero, matchTime);
  }

  gainXp(amt, allowDead = false) {
    if (this.type !== "hero" || (this.dead && !allowDead)) return;
    if (this.level >= MAX_HERO_LEVEL) {
      this.xp = 0;
      return;
    }
    const diffMult =
      this.isPlayer || this.isRemoteHuman
        ? 1.0
        : AI_DIFFICULTY_PROFILES[aiDifficulty].xpMult;
    this.xp += amt * diffMult;
    while (this.xp >= this.xpToNext && this.level < MAX_HERO_LEVEL) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.floor(this.xpToNext * 1.185);
      this.skillPoints++;

      this.str += 3;
      this.agi += 2;
      this.int += 2;
      this.maxHp += 110;
      this.hp = Math.min(this.maxHp, this.hp + 180);
      this.maxMana += 55;
      this.mana = Math.min(this.maxMana, this.mana + 100);
      this.atkDamage += 10;
      this.armor += 1.1;

      if (this.isPlayer) {
        sfx.play("levelup");
        if (this.heroCfg)
          sfx.speakHeroLine(
            this.heroCfg,
            this.heroCfg.voice.levelup,
            true,
            "triumph",
            {
              category: "levelup",
              chime: true,
              minGapMs: 3000,
              catGapMs: 5000,
            },
          );
        const ultUnlockNote =
          this.level === 6
            ? " • ULTIMATE UNLOCKED!"
            : this.level === MAX_HERO_LEVEL
              ? " • MAX LEVEL!"
              : "";
        spawnFloatText(
          this.mesh.position,
          `LEVEL ${this.level}!${ultUnlockNote}`,
          "#facc15",
          18,
        );
        spawnShockwaveRing(
          this.mesh.position.x,
          this.mesh.position.z,
          4.4,
          0xfacc15,
          0.7,
        );
        updateAbilityUpgradeButtons();
      } else if (!this.isRemoteHuman) {
        let spent = false;
        for (const k of ["R", "Q", "W", "E"]) {
          if (canHeroLevelAbility(this, k)) {
            this.abilityLevels[k]++;
            this.skillPoints--;
            spent = true;
            break;
          }
        }
        if (
          !spent &&
          this.heroCfg &&
          this.heroCfg.talents &&
          this.skillPoints > 0
        ) {
          const nextTier = getNextAvailableTalentTier(this);
          if (nextTier && this.heroCfg.talents[nextTier]) {
            const branch =
              this.heroCfg.talents[nextTier][Math.random() < 0.5 ? 0 : 1];
            if (branch) {
              this.skillPoints--;
              this.chosenTalents[nextTier] = branch.id;
              branch.apply(this);
              spent = true;
            }
          }
        }
        if (!spent && canHeroLevelAttributes(this)) {
          this.skillPoints--;
          this.attrBonusRank++;
          this.str += 2;
          this.agi += 2;
          this.int += 2;
          this.maxHp += 44;
          this.hp += 44;
          this.maxMana += 28;
          this.mana += 28;
          this.atkDamage += 4;
          this.armor += 0.4;
          this.atkSpeedMult += 0.03;
        }
      }
    }
    if (this.level >= MAX_HERO_LEVEL) this.xp = 0;
  }

  takeDamage(rawDmg, attacker, isCrit = false) {
    if (this.dead || this.reincarnating || gameOver) return;

    const sourceHero =
      attacker && attacker.type === "hero"
        ? attacker
        : attacker &&
            attacker.summonOwner &&
            attacker.summonOwner.type === "hero"
          ? attacker.summonOwner
          : null;
    if (
      this.type === "hero" &&
      sourceHero &&
      sourceHero.team !== this.team
    ) {
      this.recordHeroInvolvement(sourceHero);
    }

    const lockReason = getStructureTierLockReason(this);
    if (lockReason) {
      if (attacker) {
        if (attacker.isPlayer) {
          const nowWarn = performance.now();
          if (
            !this._lastInvulnWarnTs ||
            nowWarn - this._lastInvulnWarnTs > 1350
          ) {
            this._lastInvulnWarnTs = nowWarn;
            spawnFloatText(this.mesh.position, lockReason, "#facc15", 14);
          }
        }
        if (attacker.targetUnit === this) {
          attacker.targetUnit = null;
          attacker._inAttackRange = false;
        }
      }
      return;
    }
    if (
      (this.type === "tower" || this.type === "ancient") &&
      attacker &&
      attacker.type === "hero"
    ) {
      // Reinforced Masonry: heroes deal reduced damage to structures without creep/siege support
      rawDmg *= this.type === "ancient" ? 0.65 : 0.72;
    }
    if (this.type === "ancient") {
      if (this.ancientImmunityTimer > 0) {
        if (attacker && attacker.isPlayer) {
          spawnFloatText(
            this.mesh.position,
            `ANCIENT IMMUNE (${this.ancientImmunityTimer.toFixed(1)}s)!`,
            "#f472b6",
            15,
          );
        }
        return;
      }
      const sneakyGolemUnit = units.find(
        (u) =>
          !u.dead && u.team === this.team && u.type === "sneakygolem",
      );
      if (sneakyGolemUnit && sneakyGolemUnit.hp > 1) {
        if (attacker && attacker.isPlayer) {
          spawnFloatText(
            this.mesh.position,
            `ANCIENT SHIELDED! Subdue Sneaky Golem to 1 HP (${Math.ceil(sneakyGolemUnit.hp).toLocaleString()} HP left)!`,
            "#f472b6",
            14,
          );
        }
        return;
      }
      // Sneaky Golem Rage Mode Ancient Immunity (4s immune, 10s cooldown)
      if (
        sneakyGolemUnit &&
        !sneakyGolemUnit.dead &&
        (sneakyGolemUnit.golemImmunityCd || 0) <= 0 &&
        this.ancientImmunityTimer <= 0
      ) {
        sneakyGolemUnit.golemImmunityCd = 10.0;
        this.ancientImmunityTimer = 4.0;
        spawnShockwaveRing(
          this.mesh.position.x,
          this.mesh.position.z,
          14.0,
          0xf472b6,
          0.9,
        );
        spawnOrbitalSkyBeam(
          this.mesh.position.x,
          this.mesh.position.z,
          8.0,
          0xf472b6,
          1.8,
        );
        spawnFloatText(
          this.mesh.position,
          "ANCIENT IMMUNE (4s)! SNEAKY GOLEM WARD!",
          "#f472b6",
          18,
        );
        spawnFloatText(
          sneakyGolemUnit.mesh.position,
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
        return;
      }
      const kongUnit = units.find(
        (u) => !u.dead && u.team === this.team && u.type === "kong",
      );
      const redmanUnit = units.find(
        (u) => !u.dead && u.team === this.team && u.type === "redman",
      );
      if (kongUnit || redmanUnit || sneakyGolemUnit) rawDmg *= 0.15;
      this.ancientUnderAttackTimer = 8.0;

      let triggeredNewFury = false;
      [kongUnit, redmanUnit, sneakyGolemUnit].forEach((guard) => {
        if (!guard) return;
        if (guard.ancientFuryTimer <= 0) {
          triggeredNewFury = true;
          spawnShockwaveRing(
            guard.mesh.position.x,
            guard.mesh.position.z,
            10.5,
            guard.type === "sneakygolem" ? 0xf472b6 : 0xef4444,
            0.75,
          );
          spawnFloatText(
            guard.mesh.position,
            "ANCIENT FURY! ENRAGED!",
            guard.type === "sneakygolem" ? "#f472b6" : "#ef4444",
            17,
          );
        }
        guard.ancientFuryTimer = 8.0;
        if (attacker && !attacker.dead && attacker.team !== this.team) {
          if (
            !guard.targetUnit ||
            guard.targetUnit.dead ||
            guard.targetUnit !== attacker
          ) {
            if (
              !guard.targetUnit ||
              guard.targetUnit.dead ||
              guard.targetUnit.type !== "hero" ||
              attacker.type === "hero"
            ) {
              guard.targetUnit = attacker;
              guard.targetPos = null;
            }
          }
        }
      });
      if (triggeredNewFury) {
        sfx.play("roshan_roar");
        triggerCameraShake(0.85);
        const teamLabel = this.team === "radiant" ? "RADIANT" : "DIRE";
        const guardNames = sneakyGolemUnit
          ? "PP Labu, Red Man & Sneaky Golem"
          : "PP Labu & Red Man";
        showBanner(
          `${teamLabel} ANCIENT UNDER ATTACK!`,
          `${guardNames} enter ANCIENT FURY (+42% Speed, +65% Atk Spd, +35% DMG)!`,
          "text-rose-400",
        );
      }
    }

    // Allies near a standing friendly tower are tougher (+Armor & Damage Reduction)
    const towerBuff = getAlliedTowerAuraBuff(this);
    if (towerBuff) {
      rawDmg *= 1 - towerBuff.dmgReduction;
    }

    if (this.isAncientNeutral && attacker && attacker.type === "hero") {
      rawDmg *= 0.78;
    }
    if (this.bkbTimer > 0) {
      rawDmg *= 0.5;
    }

    const effectiveArmor =
      this.armor + (towerBuff ? towerBuff.bonusArmor : 0);
    const armorMit =
      (effectiveArmor * 0.045) / (1 + Math.abs(effectiveArmor) * 0.045);
    let dmg = Math.max(1, rawDmg * (1 - armorMit));

    if (
      this.bladeMailTimer > 0 &&
      attacker &&
      !attacker.dead &&
      attacker !== this
    ) {
      attacker.hp = Math.max(1, attacker.hp - dmg * 0.65);
    }

    if (this.type === "neutral") {
      this.wakeCamp(attacker);
    } else if (
      (this.type === "vampire" || this.type === "werewolf") &&
      attacker &&
      !attacker.dead &&
      attacker.team !== this.team
    ) {
      units.forEach((allyV) => {
        if (
          !allyV.dead &&
          allyV.type === this.type &&
          allyV.camp === this.camp &&
          !allyV.targetUnit
        ) {
          if (
            !isNearAnyStandingTower(
              attacker.mesh.position.x,
              attacker.mesh.position.z,
              VAMPIRE_TOWER_SAFE_DIST,
            )
          ) {
            allyV.targetUnit = attacker;
            allyV.targetPos = null;
          }
        }
      });
    } else if (
      (this.type === "boss" ||
        this.type === "dragon" ||
        this.type === "kong" ||
        this.type === "redman" ||
        this.type === "sneakygolem") &&
      attacker &&
      !attacker.dead &&
      attacker.team !== this.team
    ) {
      if (
        !this.targetUnit ||
        ((this.type === "kong" ||
          this.type === "redman" ||
          this.type === "sneakygolem") &&
          this.targetUnit.type !== "hero" &&
          attacker.type === "hero")
      ) {
        this.targetUnit = attacker;
      }
    }

    if (this.shield > 0) {
      if (this.shield >= dmg) {
        this.shield -= dmg;
        dmg = 0;
      } else {
        dmg -= this.shield;
        this.shield = 0;
      }
    }
    this.hp -= dmg;
    this.hitFlashTimer = 0.13;

    // Directional physical hit-flinch recoil away from attacker
    if (
      attacker &&
      attacker.mesh &&
      this.type !== "tower" &&
      this.type !== "ancient"
    ) {
      const rdx = this.mesh.position.x - attacker.mesh.position.x;
      const rdz = this.mesh.position.z - attacker.mesh.position.z;
      const rLen = Math.hypot(rdx, rdz);
      if (rLen > 0.05) {
        const flinchMag =
          this.type === "hero" || this.type === "creep" ? 0.34 : 0.16;
        this.hitFlinchX = (rdx / rLen) * flinchMag;
        this.hitFlinchZ = (rdz / rLen) * flinchMag;
      }
    }

    // Thalindor Innate Passive: Kraken Shell (purges stuns/slows & blasts hydro-wave after 450 damage)
    if (
      this.type === "hero" &&
      this.heroCfg &&
      this.heroCfg.id === "thalindor" &&
      this.hp > 0
    ) {
      this.krakenDamageAccum = (this.krakenDamageAccum || 0) + dmg;
      if (this.krakenDamageAccum >= 450) {
        this.krakenDamageAccum = 0;
        this.stunTimer = 0;
        this.slowTimer = 0;
        spawnShockwaveRing(
          this.mesh.position.x,
          this.mesh.position.z,
          5.5,
          0x06b6d4,
          0.45,
        );
        spawnFloatText(
          this.mesh.position,
          "KRAKEN SHELL PURGE!",
          "#22d3ee",
          14,
        );
        units.forEach((foe) => {
          if (
            !foe.dead &&
            foe.team !== this.team &&
            foe.type !== "ancient" &&
            foe.mesh.position.distanceTo(this.mesh.position) <=
              5.5 + foe.radius
          ) {
            foe.takeDamage(85, this, false);
          }
        });
      }
    }

    // Dravenor Fatal Bonds: share 35% of damage taken across linked enemies
    if (
      this.fatalBondGroup &&
      this.fatalBondTimer > 0 &&
      !this._inFatalBondShare
    ) {
      const sharedDmg = dmg * 0.35;
      for (let bi = 0; bi < this.fatalBondGroup.length; bi++) {
        const peer = this.fatalBondGroup[bi];
        if (
          peer &&
          peer !== this &&
          !peer.dead &&
          peer.fatalBondTimer > 0
        ) {
          peer._inFatalBondShare = true;
          peer.takeDamage(sharedDmg, attacker, false);
          peer._inFatalBondShare = false;
          spawnLightningBolt3D(
            this.mesh.position,
            peer.mesh.position,
            0xe879f9,
            0xa855f7,
            0.25,
          );
        }
      }
    }

    if (
      (this.type === "kong" ||
        this.type === "redman" ||
        this.type === "sneakygolem") &&
      this.hp <= 1
    ) {
      this.hp = 1;
      if (this.type === "sneakygolem" && !this.golemSubduedAtOneHp) {
        this.golemSubduedAtOneHp = true;
        this.hpRegen = 0;
        const teamLabel = this.team === "radiant" ? "RADIANT" : "DIRE";
        spawnShockwaveRing(
          this.mesh.position.x,
          this.mesh.position.z,
          15.0,
          0xf472b6,
          0.95,
        );
        spawnFloatText(
          this.mesh.position,
          "SNEAKY GOLEM SUBDUED (1 HP)! REGEN BROKEN!",
          "#f472b6",
          18,
        );
        showBanner(
          `${teamLabel} SNEAKY GOLEM SUBDUED (1 HP)!`,
          `Sneaky Golem can no longer regenerate — the ${teamLabel} ANCIENT CAN NOW BE ATTACKED!`,
          "text-fuchsia-300",
        );
      }
    }

    if (
      this.isPlayer &&
      this.hp > 0 &&
      this.hp < this.maxHp * 0.26 &&
      !this.lowHpWarned &&
      this.heroCfg
    ) {
      this.lowHpWarned = true;
      sfx.speakHeroLine(
        this.heroCfg,
        this.heroCfg.voice.lowHp,
        true,
        "urgent",
        { category: "lowHp", minGapMs: 6000, catGapMs: 25000 },
      );
    }

    if (
      dmg > 3 &&
      (this.type === "hero" ||
        this.type === "boss" ||
        this.type === "dragon" ||
        this.type === "kong" ||
        this.type === "redman" ||
        this.type === "sneakygolem" ||
        isCrit ||
        (attacker && (attacker.isPlayer || attacker.isRemoteHuman)))
    ) {
      if (mpState.active && mpState.role === "host") {
        mpQueueFxEvent([
          "D",
          this.netId || this.id,
          Math.round(dmg),
          isCrit ? 1 : 0,
        ]);
      }
      spawnFloatText(
        this.mesh.position,
        isCrit ? `CRIT -${Math.round(dmg)}!` : `-${Math.round(dmg)}`,
        isCrit
          ? "#fb923c"
          : this.team === "radiant"
            ? "#fb7185"
            : "#f8fafc",
        isCrit
          ? 18
          : this.type === "hero" ||
              this.type === "boss" ||
              this.type === "dragon" ||
              this.type === "kong" ||
              this.type === "redman" ||
              this.type === "sneakygolem"
            ? 15
            : 12,
      );
    }

    if (this.hp <= 0) {
      if (this.type === "hero" && this.hasAegis) {
        this.hasAegis = false;
        this.aegisTimer = 0;
        this.hp = 1;
        this.reincarnating = true;
        this.targetPos = null;
        this.targetUnit = null;
        sfx.play("aegis_reborn");
        spawnOrbitalSkyBeam(
          this.mesh.position.x,
          this.mesh.position.z,
          5.5,
          0xfacc15,
          2.2,
        );
        spawnShockwaveRing(
          this.mesh.position.x,
          this.mesh.position.z,
          7.0,
          0xfacc15,
          1.5,
        );
        if (mpState.active && mpState.role === "host") {
          mpQueueFxEvent([
            "G",
            Math.round(this.mesh.position.x),
            Math.round(this.mesh.position.z),
            0,
          ]);
        }
        showBanner(
          "AEGIS OF THE IMMORTAL!",
          `${this.name} is being reborn by the Immortal Aegis!`,
          "text-amber-300",
        );
        scheduledEvents.push({
          delay: 2.2,
          fn: () => {
            if (gameOver) return;
            this.reincarnating = false;
            this.hp = this.maxHp;
            this.mana = this.maxMana;
            this.stunTimer = 0;
            spawnShockwaveRing(
              this.mesh.position.x,
              this.mesh.position.z,
              8.0,
              0xfacc15,
              0.8,
            );
            spawnFloatText(
              this.mesh.position,
              "IMMORTAL REBIRTH!",
              "#facc15",
              20,
            );
            if (mpState.active && mpState.role === "host") {
              mpQueueFxEvent([
                "G",
                Math.round(this.mesh.position.x),
                Math.round(this.mesh.position.z),
                1,
              ]);
            }
          },
        });
        return;
      }

      this.hp = 0;
      this.die(attacker);
    }
  }

  die(killer) {
    if (this.dead) return;
    if (
      this.type === "kong" ||
      this.type === "redman" ||
      this.type === "sneakygolem"
    ) {
      this.hp = 1;
      if (this.type === "sneakygolem") {
        this.golemSubduedAtOneHp = true;
        this.hpRegen = 0;
      }
      return;
    }
    this.dead = true;
    this.spreeCount = 0;
    this.multiKillCount = 0;
    if (inspectedUnit === this) window.clearInspectedUnit();
    if (mpState.active && mpState.role === "host") {
      mpQueueFxEvent([
        "X",
        Math.round(this.mesh.position.x),
        Math.round(this.mesh.position.z),
        this.team,
        this.type,
      ]);
    }
    spawnParticleBurst(
      this.mesh.position,
      this.team === "radiant"
        ? 0x34d399
        : this.team === "neutral"
          ? 0xf59e0b
          : 0xf43f5e,
      this.type === "hero" ||
        this.type === "boss" ||
        this.type === "dragon" ||
        this.type === "kong" ||
        this.type === "redman" ||
        this.type === "sneakygolem"
        ? 32
        : 12,
    );

    const effectiveKiller =
      killer && killer.type === "hero"
        ? killer
        : killer &&
            killer.summonOwner &&
            killer.summonOwner.type === "hero"
          ? killer.summonOwner
          : killer;

    units.forEach((u) => {
      if (
        u.type === "hero" &&
        !u.dead &&
        u.team !== this.team &&
        u.heroCfg
      ) {
        const distToDeath = u.mesh.position.distanceTo(
          this.mesh.position,
        );
        if (
          u.heroCfg.id === "malakor" &&
          (this.type === "hero" ||
            this.type === "boss" ||
            this.type === "dragon") &&
          distToDeath <= 24
        ) {
          u.fleshHeapStacks = (u.fleshHeapStacks || 0) + 1;
          u.maxHp += 28;
          u.hp = Math.min(u.maxHp, u.hp + 45);
          u.atkDamage += 1.5;
          spawnFloatText(
            u.mesh.position,
            `FLESH HEAP +1 (${u.fleshHeapStacks})!`,
            "#10b981",
            14,
          );
        }
        if (u.heroCfg.id === "dravenor" && distToDeath <= 15) {
          u.mana = Math.min(u.maxMana, u.mana + 14);
          u.hp = Math.min(u.maxHp, u.hp + 18);
        }
      }
    });

    if (this.type !== "hero") {
      const isCreep = this.type === "creep";
      const CREEP_XP_RADIUS = 20.0;
      const eligibleHeroes = [];
      units.forEach((u) => {
        if (u.type === "hero" && !u.dead && u.team !== this.team) {
          const distToDeath = u.mesh.position.distanceTo(
            this.mesh.position,
          );
          if (isCreep) {
            // Only give creep experience if the hero was near (within CREEP_XP_RADIUS)
            if (distToDeath <= CREEP_XP_RADIUS) {
              eligibleHeroes.push(u);
            }
          } else {
            if (
              distToDeath <= 28.0 ||
              (effectiveKiller === u && distToDeath <= 42.0)
            ) {
              eligibleHeroes.push(u);
            }
          }
        }
      });

      if (eligibleHeroes.length > 0) {
        const perHeroXp = Math.max(
          1,
          Math.round(
            this.xpBounty / (isCreep ? eligibleHeroes.length : 1),
          ),
        );
        eligibleHeroes.forEach((u) => {
          u.gainXp(perHeroXp);
        });
      }
    }

    const bounty = Array.isArray(this.goldBounty)
      ? Math.floor(
          this.goldBounty[0] +
            Math.random() * (this.goldBounty[1] - this.goldBounty[0]),
        )
      : this.goldBounty;

    if (
      this.type !== "hero" &&
      effectiveKiller &&
      effectiveKiller.type === "hero"
    ) {
      effectiveKiller.gold += bounty;
      if (
        [
          "creep",
          "neutral",
          "vampire",
          "werewolf",
          "tower",
          "dragon",
          "boss",
          "sneakygolem",
        ].includes(this.type)
      )
        effectiveKiller.lastHits++;
      if (
        mpState.active &&
        mpState.role === "host" &&
        (effectiveKiller.isPlayer || effectiveKiller.isRemoteHuman)
      ) {
        mpQueueFxEvent([
          "T",
          Math.round(this.mesh.position.x),
          Math.round(this.mesh.position.z),
          `+${bounty}g`,
          "#facc15",
          17,
        ]);
      }
      if (effectiveKiller.isPlayer) {
        sfx.play("gold");
        if (effectiveKiller.heroCfg)
          sfx.speakHeroLine(
            effectiveKiller.heroCfg,
            effectiveKiller.heroCfg.voice.gold,
            false,
            "normal",
            {
              category: "gold",
              chance: 0.12,
              minGapMs: 20000,
              catGapMs: 26000,
            },
          );
        spawnFloatText(this.mesh.position, `+${bounty}g`, "#facc15", 17);
      }
    }

    if (this.leaderBonusType) {
      if (this.camp) {
        this.camp.leaderSlain = true;
        this.camp.respawnTimer = Math.max(
          this.camp.respawnTimer || 0,
          45.0 * 1.5,
        );
      }
      if (
        effectiveKiller &&
        effectiveKiller.type === "hero" &&
        !effectiveKiller.dead
      ) {
        if (this.leaderBonusType === "vampire_lifesteal") {
          effectiveKiller.hasVampLeaderBuff = true;
          effectiveKiller.hp = Math.min(
            effectiveKiller.maxHp,
            effectiveKiller.hp + effectiveKiller.maxHp * 0.08,
          );
          spawnOrbitalSkyBeam(
            effectiveKiller.mesh.position.x,
            effectiveKiller.mesh.position.z,
            4.5,
            0xf43f5e,
            1.1,
          );
          spawnFloatText(
            effectiveKiller.mesh.position,
            "VAMPIRE LORD SLAIN! PERMANENT +6% LIFESTEAL",
            "#fb7185",
            15,
          );
          if (effectiveKiller.isPlayer) {
            showBanner(
              "CRIMSON VAMPIRE LORD SLAIN!",
              `${effectiveKiller.name} absorbs Permanent Sanguine Bloodlust (+6% Lifesteal)!`,
              "text-rose-400",
            );
          }
        } else if (this.leaderBonusType === "wolf_movespeed") {
          effectiveKiller.hasWolfLeaderBuff = true;
          spawnOrbitalSkyBeam(
            effectiveKiller.mesh.position.x,
            effectiveKiller.mesh.position.z,
            4.5,
            0x38bdf8,
            1.1,
          );
          spawnFloatText(
            effectiveKiller.mesh.position,
            "ALPHA WEREWOLF SLAIN! PERMANENT +8% SPD & +6% ATK SPD",
            "#38bdf8",
            15,
          );
          if (effectiveKiller.isPlayer) {
            showBanner(
              "ALPHA MOONFANG SLAIN!",
              `${effectiveKiller.name} gains Permanent Lunar Swiftness (+8% Move Speed & +6% Attack Speed)!`,
              "text-sky-300",
            );
          }
        }
      }
    }

    if (this.type === "kong") {
      this.hp = 1;
      return;
    }

    if (this.type === "redman") {
      this.hp = 1;
      return;
    }

    if (this.type === "sneakygolem") {
      this.hp = 1;
      this.golemSubduedAtOneHp = true;
      this.hpRegen = 0;
      return;
    }

    if (this.type === "dragon") {
      this.mesh.visible = false;
      this.bar.el.remove();
      elderDragonBoss = null;
      elderDragonSpawnTimer = ELDER_DRAGON_INTERVAL;
      document.getElementById("dragon-hud-badge").classList.add("hidden");
      triggerCameraShake(1.25);
      sfx.announceSpree(
        "The Elder Sky Dragon has been slain! Dragon Soul Relic claimed!",
        4,
      );
      spawnOrbitalSkyBeam(
        this.mesh.position.x,
        this.mesh.position.z,
        9.5,
        0xf97316,
        1.8,
      );

      const slayer =
        killer && killer.type === "hero" ? killer : playerHero;
      const dScale =
        getEscalationMults().goldBounty *
        (getInfinityMonsterMult() > 1 ? 1.65 : 1.0);
      const dragonRelicGold = Math.round(1200 * dScale);
      const dragonRelicHp = Math.round(
        650 * (1 + (escalationTier - 1) * 0.1),
      );
      const dragonRelicAtk = Math.round(
        55 * (1 + (escalationTier - 1) * 0.1),
      );
      if (slayer && !slayer.dead) {
        slayer.gold += dragonRelicGold;
        slayer.maxHp += dragonRelicHp;
        slayer.hp = slayer.maxHp;
        slayer.atkDamage =
          Math.round(slayer.atkDamage * 1.28) + dragonRelicAtk;
        slayer.spellAmpBonus += 0.28;
        slayer.hasRadiance = true;
        const emptyIdx = slayer.inventory.findIndex((s) => s === null);
        if (
          emptyIdx !== -1 &&
          (slayer.isPlayer || slayer.isRemoteHuman)
        ) {
          slayer.inventory[emptyIdx] = {
            id: "dragon_soul",
            name: "Elder Dragon's Soul",
            cost: 1800,
            icon: "fa-dragon",
            color: "text-orange-400",
            desc: `Apex Dragon Relic! Permanent +28% ATK (+${dragonRelicAtk}), +${dragonRelicHp} HP, +28% Spell Amp & Dragonfire Aura!`,
            stats: {
              maxHp: dragonRelicHp,
              atkDamage: dragonRelicAtk,
              spellAmpBonus: 0.28,
              hasRadiance: true,
            },
          };
          refreshInventoryGrid();
        }
      }
      showBanner(
        "ELDER SKY-DRAGON SLAIN!",
        `${slayer ? slayer.name : "The Champion"} absorbs the ELDER DRAGON SOUL (+${dragonRelicGold.toLocaleString()}g, +28% ATK, +${dragonRelicHp} HP & Dragonfire Aura)!`,
        "text-orange-300",
      );
      return;
    }

    if (this.type === "boss") {
      this.mesh.visible = false;
      this.bar.el.remove();
      roshanBoss = null;
      roshanRespawnTimer = 180.0;
      triggerCameraShake(0.95);
      sfx.announceSpree("Roshan has fallen to the champions!", 3);
      spawnOrbitalSkyBeam(
        this.mesh.position.x,
        this.mesh.position.z,
        7.5,
        0xfacc15,
        1.4,
      );

      const beneficiary =
        killer && killer.type === "hero" ? killer : playerHero;
      if (beneficiary && !beneficiary.dead) {
        beneficiary.hasAegis = true;
        beneficiary.aegisTimer = 300.0;
        beneficiary.gold += 450;
        beneficiary.str += 14;
        beneficiary.agi += 14;
        beneficiary.int += 14;
        beneficiary.maxHp += 400;
        beneficiary.hp = beneficiary.maxHp;
        beneficiary.mana = beneficiary.maxMana;
        beneficiary.atkDamage += 45;

        const emptyIdx = beneficiary.inventory.findIndex(
          (s) => s === null,
        );
        if (
          emptyIdx !== -1 &&
          (beneficiary.isPlayer || beneficiary.isRemoteHuman)
        ) {
          beneficiary.inventory[emptyIdx] = {
            id: "divine_cheese",
            name: "Divine Refresher Cheese",
            cost: 600,
            icon: "fa-crown",
            color: "text-amber-300",
            desc: "Roshan Drop! Active [1-6]: Instantly restore 100% HP/Mana & reset all Cooldowns!",
            active: "cheese",
          };
          refreshInventoryGrid();
        }
      }

      showBanner(
        "ROSHAN HAS FALLEN!",
        `${beneficiary ? beneficiary.name : "The Slayer"} claims the AEGIS OF THE IMMORTAL & +450g!`,
        "text-amber-300",
      );
      return;
    }

    if (this.type === "hero") {
      this.deaths++;
      this.deathAnimTimer = 1.25;
      this.respawnTimer = Math.min(18, 5 + this.level * 1.4);
      this.bar.el.style.display = "none";
      this.targetPos = null;
      this.targetUnit = null;

      if (this.team === "radiant") direKills++;
      else radiantKills++;

      // Hero loses gold upon death
      const deathGoldPenalty = Math.min(
        this.gold,
        Math.round(35 + this.level * 24),
      );
      if (deathGoldPenalty > 0) {
        this.gold = Math.max(0, this.gold - deathGoldPenalty);
        const anchorPos = this.mesh ? this.mesh.position : null;
        if (anchorPos) {
          if (this.isPlayer) {
            spawnFloatText(
              anchorPos,
              `-${deathGoldPenalty}g (DEATH LOSS)`,
              "#fb7185",
              17,
            );
          } else {
            spawnFloatText(
              anchorPos,
              `-${deathGoldPenalty}g`,
              "#fb7185",
              14,
            );
          }
        }
        if (
          mpState.active &&
          mpState.role === "host" &&
          (this.isPlayer || this.isRemoteHuman) &&
          anchorPos
        ) {
          mpQueueFxEvent([
            "T",
            Math.round(anchorPos.x),
            Math.round(anchorPos.z),
            `-${deathGoldPenalty}g`,
            "#fb7185",
            16,
          ]);
        }
      }

      // Streak tracking for victim before reset
      const victimStreak = this.spreeCount || 0;
      this.spreeCount = 0;
      this.multiKillCount = 0;

      // Collect all opposing heroes involved in this hero's death (damaged within 18s, killer, or actively fighting within 26m)
      const ASSIST_WINDOW = 18.0;
      const involvedSet = new Set();
      if (
        effectiveKiller &&
        effectiveKiller.type === "hero" &&
        effectiveKiller.team !== this.team
      ) {
        involvedSet.add(effectiveKiller);
      }
      if (this.recentHeroDamagers) {
        this.recentHeroDamagers.forEach((dmgTime, attackerHero) => {
          if (
            attackerHero &&
            attackerHero.type === "hero" &&
            attackerHero.team !== this.team &&
            matchTime - dmgTime <= ASSIST_WINDOW
          ) {
            involvedSet.add(attackerHero);
          }
        });
        this.recentHeroDamagers.clear();
      }
      units.forEach((u) => {
        if (u.type === "hero" && !u.dead && u.team !== this.team) {
          if (u.mesh.position.distanceTo(this.mesh.position) <= 26.0) {
            involvedSet.add(u);
          }
        }
      });

      const involvedHeroes = Array.from(involvedSet);
      const heroKiller =
        effectiveKiller &&
        effectiveKiller.type === "hero" &&
        effectiveKiller.team !== this.team
          ? effectiveKiller
          : null;

      if (involvedHeroes.length > 0) {
        // Streak bonuses: The bigger the streak the more gold and exp killer gets!
        // 1. Shutdown bonus if victim had a streak:
        const shutdownBonusGold =
          victimStreak >= 3
            ? Math.min(1200, (victimStreak - 2) * 150)
            : 0;
        const shutdownBonusXp =
          victimStreak >= 3
            ? Math.min(1500, (victimStreak - 2) * 200)
            : 0;

        // 2. Killer's streak momentum bonus if killer is building a streak:
        const nextKillerStreak = heroKiller
          ? heroKiller.spreeCount + 1
          : 0;
        const killerStreakBonusGold =
          nextKillerStreak >= 3
            ? Math.min(600, (nextKillerStreak - 2) * 75)
            : 0;
        const killerStreakBonusXp =
          nextKillerStreak >= 3
            ? Math.min(800, (nextKillerStreak - 2) * 100)
            : 0;

        const totalStreakGold = shutdownBonusGold + killerStreakBonusGold;
        const totalStreakXp = shutdownBonusXp + killerStreakBonusXp;

        // Base XP Pool scaled with victim level
        const baseXpBounty =
          this.xpBounty || Math.round(120 + this.level * 42);
        const totalXpPool = Math.round(
          baseXpBounty * (involvedHeroes.length > 1 ? 1.15 : 1.0),
        );
        const assistXpShare = Math.max(
          1,
          Math.round(totalXpPool / involvedHeroes.length),
        );

        // Base Gold Bounty scaled with victim level
        const rawBounty = Array.isArray(this.goldBounty)
          ? Math.floor(
              this.goldBounty[0] +
                Math.random() * (this.goldBounty[1] - this.goldBounty[0]),
            )
          : this.goldBounty;
        const baseBounty = Math.round(rawBounty + this.level * 18);

        // Share Gold among involved heroes (60% killer / 40% assists, or 100% split if non-hero killer)
        let killerGoldShare = 0;
        let assistGoldShare = 0;
        if (heroKiller) {
          if (involvedHeroes.length === 1) {
            killerGoldShare = baseBounty;
          } else {
            killerGoldShare = Math.round(baseBounty * 0.6);
            const assistPool = Math.max(
              involvedHeroes.length - 1,
              baseBounty - killerGoldShare,
            );
            assistGoldShare = Math.max(
              1,
              Math.round(assistPool / (involvedHeroes.length - 1)),
            );
          }
        } else {
          assistGoldShare = Math.max(
            1,
            Math.round(baseBounty / involvedHeroes.length),
          );
        }

        // Killer receives the total streak gold and streak XP bonus!
        const killerTotalGold = killerGoldShare + totalStreakGold;
        const killerTotalXp = assistXpShare + totalStreakXp;

        const assistNames = [];
        involvedHeroes.forEach((hUnit) => {
          const isPrimaryKiller = heroKiller && hUnit === heroKiller;
          const goldEarned = isPrimaryKiller
            ? killerTotalGold
            : assistGoldShare;
          const xpEarned = isPrimaryKiller
            ? killerTotalXp
            : assistXpShare;

          hUnit.gold += goldEarned;
          hUnit.gainXp(xpEarned, true);
          if (!isPrimaryKiller) {
            hUnit.assists++;
            assistNames.push(hUnit.name);
          }

          if (
            mpState.active &&
            mpState.role === "host" &&
            (hUnit.isPlayer || hUnit.isRemoteHuman)
          ) {
            const popupPos = hUnit.dead
              ? this.mesh.position
              : hUnit.mesh.position;
            const streakTag =
              isPrimaryKiller && totalStreakGold > 0
                ? ` (+${totalStreakGold}g STREAK BONUS)`
                : "";
            mpQueueFxEvent([
              "T",
              Math.round(popupPos.x),
              Math.round(popupPos.z),
              `+${goldEarned}g${streakTag} • +${xpEarned} XP`,
              "#facc15",
              16,
            ]);
          }
          if (hUnit.isPlayer) {
            sfx.play("gold");
            if (isPrimaryKiller && hUnit.heroCfg) {
              sfx.speakHeroLine(
                hUnit.heroCfg,
                hUnit.heroCfg.voice.kill,
                true,
                "triumph",
                {
                  category: "kill",
                  chime: true,
                  minGapMs: 2500,
                  catGapMs: 4000,
                },
              );
            }
            const anchorPos =
              isPrimaryKiller || hUnit.dead
                ? this.mesh.position
                : hUnit.mesh.position;
            const streakTag =
              isPrimaryKiller && totalStreakGold > 0
                ? ` (+${totalStreakGold}g STREAK BONUS)`
                : "";
            const tagTxt = isPrimaryKiller
              ? `+${goldEarned}g${streakTag} • +${xpEarned} XP`
              : `ASSIST +${goldEarned}g • +${xpEarned} XP`;
            spawnFloatText(anchorPos, tagTxt, "#facc15", 17);
          }
        });

        if (heroKiller) {
          heroKiller.kills++;
          heroKiller.spreeCount++;
          heroKiller.celebrateTimer = 1.45;
          spawnShockwaveRing(
            heroKiller.mesh.position.x,
            heroKiller.mesh.position.z,
            5.2,
            0xfacc15,
            0.65,
          );

          if (matchTime - heroKiller.lastKillTimestamp <= 18.0)
            heroKiller.multiKillCount++;
          else heroKiller.multiKillCount = 1;
          heroKiller.lastKillTimestamp = matchTime;

          handleHeroKillAnnouncements(
            heroKiller,
            this,
            killerTotalGold,
            assistGoldShare,
            assistNames,
            victimStreak,
            shutdownBonusGold,
            totalStreakGold,
          );
        } else {
          const killerLabel = effectiveKiller
            ? effectiveKiller.name
            : this.team === "dire"
              ? "Radiant Forces"
              : "Dire Forces";
          const splitNames = involvedHeroes.map((h) => h.name).join(", ");
          showBanner(
            `${this.name.toUpperCase()} SLAIN!`,
            `${killerLabel} struck the final blow • +${assistGoldShare}g & +${assistXpShare} XP shared with ${splitNames}!`,
            this.team === "dire" ? "text-emerald-400" : "text-rose-400",
          );
        }
      } else {
        // No heroes were involved in the kill (executed by tower/creeps/neutrals) -> NO HERO gets gold or EXP!
        const killerLabel = effectiveKiller
          ? effectiveKiller.name
          : this.team === "dire"
            ? "Radiant Forces"
            : "Dire Forces";
        showBanner(
          `${this.name.toUpperCase()} EXECUTED!`,
          `${this.name} fell to ${killerLabel} with no heroes involved.`,
          this.team === "dire" ? "text-rose-400" : "text-emerald-400",
        );
      }
    } else if (this.type === "tower") {
      this.mesh.visible = false;
      this.bar.el.remove();
      triggerCameraShake(0.8);
      spawnShockwaveRing(
        this.mesh.position.x,
        this.mesh.position.z,
        9.0,
        0xfacc15,
        0.9,
      );
      units.forEach((u) => {
        if (u.type === "hero" && u.team !== this.team) u.gold += 250;
      });

      const remainingTowers = units.filter(
        (u) => !u.dead && u.team === this.team && u.type === "tower",
      ).length;
      if (remainingTowers === 0) {
        if (this.team === "dire" && !radiantMegaCreeps) {
          radiantMegaCreeps = true;
        } else if (this.team === "radiant" && !direMegaCreeps) {
          direMegaCreeps = true;
        }
        if (!ppLabuSpawned[this.team]) {
          spawnPPLabuGuardian(this.team);
        }
      } else {
        sfx.announceSpree(`${this.name} has been destroyed!`, 2);
        showBanner(
          `${this.name.toUpperCase()} DESTROYED!`,
          `${this.team === "dire" ? "Radiant" : "Dire"} heroes earn +250 Gold • ${remainingTowers} Tower${remainingTowers === 1 ? "" : "s"} Remaining!`,
          this.team === "dire" ? "text-emerald-400" : "text-rose-400",
        );
      }
    } else if (this.type === "ancient") {
      const anyTowerAlive = units.some(
        (u) => !u.dead && u.team === this.team && u.type === "tower",
      );
      if (anyTowerAlive) {
        this.dead = false;
        this.hp = this.maxHp;
        return;
      }
      this.mesh.visible = false;
      this.bar.el.remove();
      triggerCameraShake(1.4);
      spawnOrbitalSkyBeam(
        this.mesh.position.x,
        this.mesh.position.z,
        9,
        0xfacc15,
        1.5,
      );
      endMatch(this.team === "dire" ? "radiant" : "dire");
    } else {
      this.mesh.visible = false;
      if (this.mesh) {
        scene.remove(this.mesh);
        disposeObject3D(this.mesh);
      }
      if (this.bar && this.bar.el) this.bar.el.remove();
    }
  }

  respawn() {
    this.dead = false;
    this.deathAnimTimer = 0;
    this.lowHpWarned = false;
    if (this.recentHeroDamagers) this.recentHeroDamagers.clear();
    this.hp = this.maxHp;
    this.mana = this.maxMana;
    this.shield = 0;
    this.stunTimer = 0;
    this.slowTimer = 0;
    if (this.parts && this.parts.hips) {
      this.parts.hips.position.y = 1.42;
      this.parts.hips.rotation.set(0, 0, 0);
    }
    const offset = ((this.id % 3) - 1) * 4;
    const sx = (this.team === "radiant" ? -134 : 134) + offset;
    const sz = (this.team === "radiant" ? 134 : -134) + offset;
    this.mesh.position.set(sx, 0, sz);
    this.mesh.visible = true;
    this.bar.el.style.display = "flex";
    spawnShockwaveRing(
      sx,
      sz,
      4.5,
      this.team === "radiant" ? 0x34d399 : 0xf43f5e,
      0.7,
    );
    if (this.isPlayer && this.heroCfg && this.heroCfg.voice.respawn) {
      sfx.speakHeroLine(
        this.heroCfg,
        this.heroCfg.voice.respawn,
        true,
        "triumph",
        { category: "respawn", minGapMs: 3000, catGapMs: 8000 },
      );
    }
  }
}

function handleHeroKillAnnouncements(
  killer,
  victim,
  bounty,
  assistGold = 0,
  assistNames = [],
  victimStreak = 0,
  shutdownBonusGold = 0,
  totalStreakGold = 0,
) {
  const spreeTitles = {
    3: "KILLING SPREE!",
    4: "DOMINATING!",
    5: "MEGA KILL!",
    6: "UNSTOPPABLE!",
    7: "WICKED SICK!",
    8: "MONSTER KILL!",
    9: "GODLIKE!",
  };
  const multiTitles = {
    2: "DOUBLE KILL!",
    3: "TRIPLE KILL!",
    4: "ULTRA KILL!",
    5: "RAMPAGE!",
  };

  let headline = `${killer.name.toUpperCase()} SLAIN ${victim.name.toUpperCase()}!`;
  let spoken = `${killer.name} has slain ${victim.name}!`;
  let colorCls =
    killer.team === "radiant" ? "text-emerald-400" : "text-rose-400";
  let tier = 1;

  if (!firstBloodDone) {
    firstBloodDone = true;
    headline = "FIRST BLOOD!";
    spoken = `First Blood! ${killer.name} drew first blood!`;
    colorCls = "text-rose-500";
    tier = 3;
  } else if (victimStreak >= 3) {
    const spTitle =
      victimStreak >= 10
        ? "BEYOND GODLIKE"
        : spreeTitles[victimStreak] || "KILLING SPREE";
    headline = `SHUTDOWN! (${spTitle})`;
    spoken = `${killer.name} shut down ${victim.name}'s ${spTitle}!`;
    colorCls = "text-amber-400";
    tier = 4;
  } else if (killer.multiKillCount >= 2) {
    const mk = Math.min(5, killer.multiKillCount);
    headline = multiTitles[mk];
    spoken = `${multiTitles[mk]} ${killer.name}!`;
    colorCls = "text-amber-300";
    tier = mk + 1;
  } else if (killer.spreeCount >= 3) {
    const sp =
      killer.spreeCount >= 10
        ? "BEYOND GODLIKE!"
        : spreeTitles[killer.spreeCount];
    headline = sp;
    spoken = `${killer.name} is ${sp}`;
    colorCls =
      killer.spreeCount >= 8 ? "text-rose-400" : "text-amber-400";
    tier = Math.min(5, Math.floor(killer.spreeCount / 2));
  }

  sfx.announceSpree(spoken, tier);
  if (mpState.active && mpState.role === "host") {
    mpQueueFxEvent(["B", killer.netId || killer.id, spoken, tier]);
  }
  const assistNote =
    assistNames && assistNames.length > 0 && assistGold > 0
      ? ` (+${assistGold}g shared with ${assistNames.join(", ")})`
      : "";
  const streakTag =
    totalStreakGold > 0
      ? ` (includes +${totalStreakGold}g Streak Bounty!)`
      : "";
  showBanner(
    headline,
    `${killer.name} claims +${bounty}g${streakTag}${assistNote} • Streak: ${killer.spreeCount}`,
    colorCls,
  );
}

