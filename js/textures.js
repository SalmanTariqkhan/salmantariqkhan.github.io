/***********************************************************************
 * 3. PROCEDURAL PBR TEXTURES & NATURAL WORLD-SPACE GLSL TERRAIN
 ***********************************************************************/
const _isTouchBoot =
  "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
const _bootCores = navigator.hardwareConcurrency || 4;
const _bootMem = navigator.deviceMemory || 4;
const _is1GbMobileBoot =
  LowRamOptimizer.profile.isLowRam ||
  (_isTouchBoot && (_bootMem <= 2 || _bootCores <= 2));
const _isLowEndMobileBoot =
  _is1GbMobileBoot ||
  (_isTouchBoot && (_bootCores <= 4 || _bootMem <= 3));

function createPBRTextureSet(type, repeatX = 12, repeatY = 12) {
  const size = _is1GbMobileBoot ? 128 : _isLowEndMobileBoot ? 256 : 512;
  const mapC = document.createElement("canvas");
  const bumpC = document.createElement("canvas");
  const roughC = document.createElement("canvas");
  mapC.width = bumpC.width = roughC.width = size;
  mapC.height = bumpC.height = roughC.height = size;

  const mCtx = mapC.getContext("2d");
  const bCtx = bumpC.getContext("2d");
  const rCtx = roughC.getContext("2d");

  if (type === "cobble") {
    // Hand-dressed beveled stone flagstones with deep mortar seams, highlight bevels & surface grain
    mCtx.fillStyle = "#1e2633";
    mCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = "#121215";
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = "#f0f0f0";
    rCtx.fillRect(0, 0, size, size);
    const step = 32;
    for (let y = 0; y < size; y += step) {
      const rowShift = ((y / step) % 2) * 16;
      for (let x = -16; x < size; x += step) {
        const shade = 72 + Math.floor(Math.random() * 38);
        const w = step - 4 + (Math.random() * 2.6 - 1.3);
        const h = step - 4 + (Math.random() * 2.6 - 1.3);
        const sx = x + rowShift + 2;
        const sy = y + 2;

        // Stone body
        mCtx.fillStyle = `rgb(${shade}, ${shade + 8}, ${shade + 20})`;
        mCtx.beginPath();
        mCtx.roundRect(sx, sy, w, h, 7);
        mCtx.fill();

        // Top-left chiseled bevel highlight
        mCtx.strokeStyle = `rgba(215, 228, 245, 0.24)`;
        mCtx.lineWidth = 1.6;
        mCtx.beginPath();
        mCtx.roundRect(sx + 1, sy + 1, w - 2, h - 2, 6);
        mCtx.stroke();

        // Bump height + inner beveled crown
        const bVal = 160 + Math.floor(Math.random() * 68);
        bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
        bCtx.beginPath();
        bCtx.roundRect(sx + 1, sy + 1, w - 2, h - 2, 6);
        bCtx.fill();
        bCtx.strokeStyle = "#ffffff";
        bCtx.lineWidth = 1.4;
        bCtx.stroke();

        // Specular variation per flagstone
        const rVal = 175 + Math.floor(Math.random() * 55);
        rCtx.fillStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
        rCtx.beginPath();
        rCtx.roundRect(sx + 1, sy + 1, w - 2, h - 2, 6);
        rCtx.fill();
      }
    }
    // Micro-mineral pitting across flagstones
    for (let p = 0; p < 900; p++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      mCtx.fillStyle =
        p % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(10,15,25,0.16)";
      mCtx.fillRect(px, py, 2.2, 2.2);
      bCtx.fillStyle =
        p % 2 === 0 ? "rgba(255,255,255,0.14)" : "rgba(20,20,20,0.22)";
      bCtx.fillRect(px, py, 2.0, 2.0);
    }
  } else if (type === "riverbed") {
    mCtx.fillStyle = "#0f3c4a";
    mCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = "#282828";
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = "#9a9a9a";
    rCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 820; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const rx = 5 + Math.random() * 14;
      const ry = 4 + Math.random() * 11;
      const rot = Math.random() * Math.PI;
      const palette = [
        "#1d5b6e",
        "#287285",
        "#195446",
        "#3a7b8c",
        "#2d5e70",
        "#488496",
        "#164e63",
      ];
      mCtx.fillStyle =
        palette[Math.floor(Math.random() * palette.length)];
      mCtx.beginPath();
      mCtx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
      mCtx.fill();
      bCtx.fillStyle = `rgb(${145 + Math.random() * 98}, ${145 + Math.random() * 98}, ${145 + Math.random() * 98})`;
      bCtx.beginPath();
      bCtx.ellipse(px, py, rx * 0.9, ry * 0.9, rot, 0, Math.PI * 2);
      bCtx.fill();
    }
  } else if (type === "marble") {
    // Imperial veined temple stone with crystalline mineral striations & inlaid gold trim
    mCtx.fillStyle = "#364559";
    mCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = "#808080";
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = "#787878";
    rCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1600; i++) {
      const v = 54 + Math.floor(Math.random() * 64);
      mCtx.fillStyle = `rgba(${v},${v + 6},${v + 16},0.22)`;
      mCtx.fillRect(Math.random() * size, Math.random() * size, 7, 7);
      const bv = 96 + Math.floor(Math.random() * 76);
      bCtx.fillStyle = `rgba(${bv},${bv},${bv},0.3)`;
      bCtx.fillRect(Math.random() * size, Math.random() * size, 6, 6);
    }
    // Diagonal marble mineral veins
    for (let v = 0; v < 26; v++) {
      const vx0 = (v * 41.3) % size;
      const vy0 = (v * 73.7) % size;
      mCtx.strokeStyle =
        v % 3 === 0
          ? "rgba(226, 232, 240, 0.16)"
          : "rgba(15, 23, 42, 0.24)";
      mCtx.lineWidth = 1.5 + (v % 3);
      mCtx.beginPath();
      mCtx.moveTo(vx0, vy0);
      mCtx.bezierCurveTo(
        vx0 + 48,
        vy0 + 24,
        vx0 + 92,
        vy0 - 18,
        vx0 + 145,
        vy0 + 36,
      );
      mCtx.stroke();
    }
    mCtx.strokeStyle = "rgba(250, 204, 21, 0.65)";
    mCtx.lineWidth = 8;
    mCtx.strokeRect(16, 16, size - 32, size - 32);
    mCtx.strokeStyle = "rgba(254, 240, 138, 0.35)";
    mCtx.lineWidth = 2;
    mCtx.strokeRect(26, 26, size - 52, size - 52);
    bCtx.strokeStyle = "#ffffff";
    bCtx.lineWidth = 8;
    bCtx.strokeRect(16, 16, size - 32, size - 32);
  } else if (type === "bark") {
    // Multi-layered furrowed botanical bark PBR (fibrous wood grain + sinuous ridges + moss/lichen flecks)
    mCtx.fillStyle = "#472816";
    mCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = "#6e6e6e";
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = "#e2e2e2";
    rCtx.fillRect(0, 0, size, size);

    // Fine vertical fibrous wood grain
    for (let i = 0; i < 950; i++) {
      const gx = (i * 37.3) % size;
      const gy = (i * 91.7) % size;
      const gh = 28 + (i % 7) * 14;
      mCtx.fillStyle =
        i % 3 === 0
          ? "rgba(30, 15, 7, 0.36)"
          : i % 3 === 1
            ? "rgba(104, 64, 38, 0.32)"
            : "rgba(78, 46, 26, 0.28)";
      mCtx.fillRect(gx, gy, 2.2, gh);
      bCtx.fillStyle =
        i % 2 === 0
          ? "rgba(42, 42, 42, 0.35)"
          : "rgba(198, 198, 198, 0.35)";
      bCtx.fillRect(gx, gy, 2.0, gh);
    }

    // Sinuous, interlocking deep bark fissures & raised plates
    for (let f = 0; f < 135; f++) {
      const sx = (f * 53.1) % size;
      const sy = ((f * 119.3) % size) - 40;
      const len = 75 + (f % 6) * 28;
      const sway1 = Math.sin(f * 1.7) * 11;
      const sway2 = Math.cos(f * 2.3) * 11;
      const w = 2.4 + (f % 4) * 1.3;

      // Highlighted bark ridge next to fissure
      mCtx.strokeStyle = f % 2 === 0 ? "#6b4228" : "#5c361f";
      mCtx.lineWidth = w + 2.5;
      mCtx.lineCap = "round";
      mCtx.beginPath();
      mCtx.moveTo(sx + 2.5, sy);
      mCtx.bezierCurveTo(
        sx + sway1 + 2.5,
        sy + len * 0.35,
        sx + sway2 + 2.5,
        sy + len * 0.7,
        sx + 2.5,
        sy + len,
      );
      mCtx.stroke();

      bCtx.strokeStyle = "#e6e6e6";
      bCtx.lineWidth = w + 2.2;
      bCtx.lineCap = "round";
      bCtx.beginPath();
      bCtx.moveTo(sx + 2.5, sy);
      bCtx.bezierCurveTo(
        sx + sway1 + 2.5,
        sy + len * 0.35,
        sx + sway2 + 2.5,
        sy + len * 0.7,
        sx + 2.5,
        sy + len,
      );
      bCtx.stroke();

      // Deep shadowed bark crevice
      mCtx.strokeStyle = "#1e0e06";
      mCtx.lineWidth = w;
      mCtx.beginPath();
      mCtx.moveTo(sx, sy);
      mCtx.bezierCurveTo(
        sx + sway1,
        sy + len * 0.35,
        sx + sway2,
        sy + len * 0.7,
        sx,
        sy + len,
      );
      mCtx.stroke();

      bCtx.strokeStyle = "#141414";
      bCtx.lineWidth = w;
      bCtx.beginPath();
      bCtx.moveTo(sx, sy);
      bCtx.bezierCurveTo(
        sx + sway1,
        sy + len * 0.35,
        sx + sway2,
        sy + len * 0.7,
        sx,
        sy + len,
      );
      bCtx.stroke();

      rCtx.strokeStyle = "#ffffff";
      rCtx.lineWidth = w;
      rCtx.beginPath();
      rCtx.moveTo(sx, sy);
      rCtx.bezierCurveTo(
        sx + sway1,
        sy + len * 0.35,
        sx + sway2,
        sy + len * 0.7,
        sx,
        sy + len,
      );
      rCtx.stroke();
    }

    // Subtle organic lichen & moss patches in bark hollows
    for (let m = 0; m < 45; m++) {
      const mx = (m * 79.1) % size;
      const my = (m * 143.7) % size;
      mCtx.fillStyle =
        m % 2 === 0
          ? "rgba(63, 98, 48, 0.24)"
          : "rgba(130, 125, 102, 0.20)";
      mCtx.beginPath();
      mCtx.ellipse(mx, my, 4 + (m % 5), 7 + (m % 7), 0.2, 0, Math.PI * 2);
      mCtx.fill();
    }
  }

  const map = new THREE.CanvasTexture(mapC);
  const bumpMap = new THREE.CanvasTexture(bumpC);
  const roughnessMap = new THREE.CanvasTexture(roughC);
  [map, bumpMap, roughnessMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bumpMap, roughnessMap };
}

const cobblePBR = createPBRTextureSet("cobble", 24, 24);
const riverbedPBR = createPBRTextureSet("riverbed", 18, 18);
const marblePBR = createPBRTextureSet("marble", 1, 1);
const barkPBR = createPBRTextureSet("bark", 2, 4);

