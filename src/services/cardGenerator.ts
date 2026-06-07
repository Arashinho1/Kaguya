/**
 * Gerador de cards de perfil — estética Naruto RPG.
 * Fontes: Chakra Petch (Google Fonts / jsDelivr CDN, OFL license)
 * Todos os assets são criados programaticamente ou baixados de CDNs públicas.
 */
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface AttributeEntry {
  key: string;
  name: string;
  value: number;
  maxValue: number;
  sortOrder: number;
}

export interface ProfileCardData {
  characterName: string;
  concept?: string;
  villageName?: string;
  clanName?: string;
  rankName?: string;
  isActive: boolean;
  imageUrl?: string;
  attributes: AttributeEntry[];
  ownerTag: string;
  availablePA?: number;
}

export interface PericiaEntry {
  key: string;
  name: string;
  level: number;
  xp: number;
  maxXp: number;
  sortOrder: number;
}

export interface PericiaCardData {
  characterName: string;
  ownerTag: string;
  pericias: PericiaEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Paleta Naruto RPG
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:       "#080812",
  panel:    "#0D0D1C",
  border:   "#8B1A1A",
  red:      "#C0392B",
  orange:   "#E8690A",
  gold:     "#D4A017",
  goldL:    "#F1C232",
  text:     "#F0F0FF",
  muted:    "#5A5A88",
  dimbar:   "#181828",
  foot:     "#060610",
  glow:     "#FF6B35",
} as const;

/** [dark, light, glow] por atributo/perícia */
const ATTR: Record<string, [string, string, string]> = {
  chakra:             ["#154360", "#2E86C1", "#5DADE2"],
  forca:              ["#7B241C", "#E74C3C", "#FF6961"],
  velocidade:         ["#9A7D0A", "#F4D03F", "#FFF176"],
  resistencia:        ["#1D6A39", "#2ECC71", "#58D68D"],
  ninjutsu:           ["#5B2C82", "#8E44AD", "#BB8FCE"],
  ninjutsu_elemental: ["#943126", "#E67E22", "#F0A500"],
  taijutsu:           ["#7B241C", "#CD6155", "#F1948A"],
  genjutsu:           ["#0E6655", "#1ABC9C", "#48C9B0"],
  // ─── Perícias adicionais (sem atributo equivalente) ───────────────────────
  bukijutsu:          ["#6E2C00", "#CA6F1E", "#F5B041"],
  kenjutsu:           ["#34495E", "#85929E", "#D6DBDF"],
  fuinjutsu:          ["#4A235A", "#A569BD", "#D7BDE2"],
  shurikenjutsu:      ["#5D6D7E", "#AEB6BF", "#EAEDED"],
  juinjutsu:          ["#1B2631", "#5D6D7E", "#85929E"],
  senjutsu:           ["#145A32", "#27AE60", "#82E0AA"],
  iryo:               ["#0B5345", "#16A085", "#76D7C4"],
  kuchiyose:          ["#784212", "#B9770E", "#F8C471"],
  kanchi:             ["#1A5276", "#2980B9", "#85C1E9"],
  barrier:            ["#7D6608", "#D4AC0D", "#F7DC6F"],
  nintaijutsu:        ["#922B21", "#CB4335", "#F1948A"],
};

const ICON: Record<string, string> = {
  chakra:             "◈",
  forca:              "⚔",
  velocidade:         "◎",
  resistencia:        "⬡",
  ninjutsu:           "☯",
  ninjutsu_elemental: "✦",
  taijutsu:           "◆",
  genjutsu:           "◉",
  // ─── Perícias adicionais (glifos restritos ao conjunto testado e renderizável) ──
  bukijutsu:          "▲",
  kenjutsu:           "▶",
  fuinjutsu:          "◊",
  shurikenjutsu:      "◁",
  juinjutsu:          "▼",
  senjutsu:           "Ω",
  iryo:               "■",
  kuchiyose:          "Δ",
  kanchi:             "▽",
  barrier:            "△",
  nintaijutsu:        "◀",
};

// ─────────────────────────────────────────────────────────────────────────────
// Dimensões
// ─────────────────────────────────────────────────────────────────────────────

const W = 820, H = 512;
const PW = 210;             // largura painel esquerdo (retrato)
const CX = PW + 24;         // X do conteúdo
const CW = W - CX - 14;    // largura do conteúdo
const FH = 26;              // altura do rodapé

// ─────────────────────────────────────────────────────────────────────────────
// Carregamento de fontes (uma vez, cached)
// ─────────────────────────────────────────────────────────────────────────────

let fontsReady = false;

async function ensureFonts(): Promise<void> {
  if (fontsReady) return;

  const BASE = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/chakrapetch";
  const urls = [
    `${BASE}/ChakraPetch-Regular.ttf`,
    `${BASE}/ChakraPetch-SemiBold.ttf`,
    `${BASE}/ChakraPetch-Bold.ttf`,
  ];

  try {
    const buffers = await Promise.all(
      urls.map(u => fetch(u).then(r => r.arrayBuffer()).then(ab => Buffer.from(ab)))
    );
    GlobalFonts.register(buffers[0], "ChakraPetch");
    GlobalFonts.register(buffers[1], "ChakraPetch");
    GlobalFonts.register(buffers[2], "ChakraPetch");
    fontsReady = true;
  } catch {
    // Fallback silencioso — usará sans-serif do sistema
  }
}

const FONT = (size: number, weight: "normal" | "600" | "bold" = "normal") =>
  `${weight} ${size}px ${fontsReady ? "ChakraPetch" : "sans-serif"}`;

// ─────────────────────────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────────────────────────

export async function generateProfileCard(data: ProfileCardData): Promise<Buffer> {
  await ensureFonts();

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  drawBackground(ctx);
  drawSealPattern(ctx);
  drawEnergyAccents(ctx);
  drawLeftPanel(ctx);
  await drawPortrait(ctx, data.imageUrl);
  drawPortraitOrnaments(ctx);
  drawStatusBadge(ctx, data.isActive);
  drawContent(ctx, data);
  drawFooter(ctx, data.ownerTag);
  drawVignette(ctx);

  return canvas.toBuffer("image/png");
}

export async function generatePericiaCard(data: PericiaCardData): Promise<Buffer> {
  await ensureFonts();

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  drawBackground(ctx);
  drawSealPattern(ctx);
  drawEnergyAccents(ctx);
  drawPericiaContent(ctx, data);
  drawFooter(ctx, data.ownerTag);
  drawVignette(ctx);

  return canvas.toBuffer("image/png");
}

// ─────────────────────────────────────────────────────────────────────────────
// Camadas de fundo
// ─────────────────────────────────────────────────────────────────────────────

function drawBackground(ctx: SKRSContext2D) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Grade hexagonal sutil
  ctx.save();
  ctx.strokeStyle = "rgba(255,120,30,0.06)";
  ctx.lineWidth = 1;
  const step = 28;
  for (let x = 0; x < W + step; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H + step; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // Borda externa dupla
  ctx.save();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.strokeStyle = "rgba(192,57,43,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.restore();
}

function drawSealPattern(ctx: SKRSContext2D) {
  // Selo fuinjutsu no canto inferior direito
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = C.orange;
  ctx.lineWidth = 1;
  const ox = W - 55, oy = H - 55;

  for (let r = 15; r <= 180; r += 22) {
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(a) * 180, oy + Math.sin(a) * 180);
    ctx.stroke();
  }

  // Selo menor no canto superior esquerdo (fora do painel)
  ctx.globalAlpha = 0.05;
  const ox2 = 15, oy2 = 15;
  for (let r = 10; r <= 60; r += 15) {
    ctx.beginPath();
    ctx.arc(ox2, oy2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnergyAccents(ctx: SKRSContext2D) {
  ctx.save();

  // Glow laranja no canto superior direito
  const grad1 = ctx.createRadialGradient(W, 0, 0, W, 0, 260);
  grad1.addColorStop(0, "rgba(232,105,10,0.12)");
  grad1.addColorStop(1, "rgba(232,105,10,0)");
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, W, H);

  // Linhas de energia diagonais (top-right)
  ctx.strokeStyle = "rgba(232,105,10,0.08)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const ox = W - 100 + i * 18;
    ctx.beginPath();
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox - 80, H);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVignette(ctx: SKRSContext2D) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.85);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,10,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ─────────────────────────────────────────────────────────────────────────────
// Painel esquerdo — retrato
// ─────────────────────────────────────────────────────────────────────────────

function drawLeftPanel(ctx: SKRSContext2D) {
  // Fundo levemente diferente
  const panelGrad = ctx.createLinearGradient(0, 0, PW, 0);
  panelGrad.addColorStop(0, "#0A0A18");
  panelGrad.addColorStop(1, C.panel);
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, 0, PW, H);

  // Separador vertical com glow
  ctx.fillStyle = C.red;
  ctx.fillRect(PW - 2, 0, 2, H);

  // Glow no separador
  const sepGlow = ctx.createLinearGradient(PW - 8, 0, PW, 0);
  sepGlow.addColorStop(0, "rgba(192,57,43,0)");
  sepGlow.addColorStop(1, "rgba(192,57,43,0.3)");
  ctx.fillStyle = sepGlow;
  ctx.fillRect(PW - 8, 0, 8, H);
}

async function drawPortrait(ctx: SKRSContext2D, imageUrl?: string) {
  const m = 12, r = 6;
  const px = m, py = m;
  const pw = PW - m * 2;
  const ph = H - m * 2 - FH - 32;

  // Fundo do retrato
  const bgGrad = ctx.createLinearGradient(px, py, px, py + ph);
  bgGrad.addColorStop(0, "#1A1A30");
  bgGrad.addColorStop(1, "#080818");
  ctx.fillStyle = bgGrad;
  roundRect(ctx, px, py, pw, ph, r);
  ctx.fill();

  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl);
      ctx.save();
      roundRect(ctx, px, py, pw, ph, r);
      ctx.clip();
      const scale = Math.max(pw / img.width, ph / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      ctx.drawImage(img, px + (pw - iw) / 2, py + (ph - ih) / 2, iw, ih);
      // Gradiente escurecendo a parte inferior (para o badge ficar legível)
      const overlay = ctx.createLinearGradient(px, py + ph * 0.6, px, py + ph);
      overlay.addColorStop(0, "rgba(0,0,0,0)");
      overlay.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = overlay;
      ctx.fillRect(px, py, pw, ph);
      ctx.restore();
    } catch {
      // Silhueta fallback
      ctx.save();
      ctx.fillStyle = "#22224A";
      ctx.beginPath(); ctx.arc(px + pw / 2, py + ph * 0.38, 36, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(px + pw / 2 - 44, py + ph * 0.62, 88, 68);
      ctx.restore();
    }
  }

  // Borda do retrato com glow
  ctx.save();
  ctx.shadowColor = C.gold;
  ctx.shadowBlur  = 8;
  ctx.strokeStyle = C.gold;
  ctx.lineWidth   = 2;
  roundRect(ctx, px, py, pw, ph, r);
  ctx.stroke();
  ctx.restore();
}

function drawPortraitOrnaments(ctx: SKRSContext2D) {
  const m = 12, sz = 7;
  const pw = PW - m * 2;
  const ph = H - m * 2 - FH - 32;

  // Losangos dourados nos 4 cantos
  const corners: [number, number][] = [
    [m, m], [m + pw, m],
    [m, m + ph], [m + pw, m + ph]
  ];
  for (const [cx, cy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = C.gold;
    ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
    ctx.fillStyle = C.bg;
    ctx.fillRect(-sz / 4, -sz / 4, sz / 2, sz / 2);
    ctx.restore();
  }

  // Marcadores de canto nas laterais (metade do retrato)
  const halfY = m + (ph) / 2;
  ctx.fillStyle = C.red;
  ctx.fillRect(m - 3, halfY - 12, 3, 24);
  ctx.fillRect(m + pw, halfY - 12, 3, 24);
}

function drawStatusBadge(ctx: SKRSContext2D, isActive: boolean) {
  const m = 12;
  const pw = PW - m * 2;
  const by = H - FH - m - 24;
  const bh = 24;

  const bgColor  = isActive ? "#0D3B1F" : "#3B0D0D";
  const fgColor  = isActive ? "#27AE60" : "#E74C3C";
  const label    = isActive ? "● FICHA ATIVA" : "○ FICHA INATIVA";

  ctx.save();
  ctx.shadowColor = fgColor;
  ctx.shadowBlur  = 6;
  ctx.fillStyle   = bgColor;
  roundRect(ctx, m, by, pw, bh, 4);
  ctx.fill();
  ctx.strokeStyle = fgColor;
  ctx.lineWidth   = 1;
  roundRect(ctx, m, by, pw, bh, 4);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = fgColor;
  ctx.font      = FONT(11, "bold");
  ctx.textAlign = "center";
  ctx.fillText(label, m + pw / 2, by + 16);
  ctx.textAlign = "left";
}

// ─────────────────────────────────────────────────────────────────────────────
// Conteúdo — lado direito
// ─────────────────────────────────────────────────────────────────────────────


// Grupos de atributos
const PHYSICAL_KEYS = new Set(['forca', 'velocidade', 'resistencia']);
const NINJA_KEYS    = new Set(['ninjutsu', 'ninjutsu_elemental', 'taijutsu', 'genjutsu']);

function drawContent(ctx: SKRSContext2D, data: ProfileCardData) {
  let y = 38;

  // Nome
  ctx.save();
  ctx.shadowColor = C.gold;
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = C.goldL;
  ctx.font        = FONT(34, 'bold');
  ctx.fillText(data.characterName, CX, y);
  ctx.restore();
  y += 26;

  // Conceito
  if (data.concept) {
    ctx.fillStyle = C.muted;
    ctx.font      = 'italic ' + FONT(14);
    ctx.fillText(data.concept.slice(0, 60), CX, y);
    y += 22;
  }

  y += 10;
  drawGlowLine(ctx, CX, y, CW, C.orange, 0.7);
  y += 18;

  // Identidade
  drawSectionLabel(ctx, '▸ IDENTIDADE', CX, y);
  y += 20;
  const idItems = [
    { label: 'Vila', value: data.villageName || '—' },
    { label: 'Clã',  value: data.clanName    || '—' },
    { label: 'Rank', value: data.rankName    || '—' },
  ];
  const icw = CW / 3;
  for (let i = 0; i < idItems.length; i++) {
    const ix = CX + i * icw;
    ctx.fillStyle = C.muted; ctx.font = FONT(11);
    ctx.fillText(idItems[i].label, ix, y);
    ctx.fillStyle = C.text; ctx.font = FONT(16, 'bold');
    ctx.fillText(idItems[i].value.slice(0, 18), ix, y + 20);
  }
  y += 46;

  // Badge de PA (Pontos de Atributo disponíveis)
  if (data.availablePA !== undefined) {
    const paLabel = `◆ ${data.availablePA} PA disponíveis`;
    const paColor = data.availablePA > 0 ? '#F1C232' : '#5A5A88';
    ctx.save();
    if (data.availablePA > 0) { ctx.shadowColor = '#D4A017'; ctx.shadowBlur = 8; }
    ctx.fillStyle = paColor;
    ctx.font = FONT(12, '600');
    ctx.fillText(paLabel, CX, y);
    ctx.restore();
    y += 20;
  }

  drawGlowLine(ctx, CX, y, CW, '#2A2A4A');
  y += 18;

  const physical = data.attributes.filter((a: AttributeEntry) => PHYSICAL_KEYS.has(a.key)).sort((a: AttributeEntry, b: AttributeEntry) => a.sortOrder - b.sortOrder);
  const ninja    = data.attributes.filter((a: AttributeEntry) => NINJA_KEYS.has(a.key)).sort((a: AttributeEntry, b: AttributeEntry) => a.sortOrder - b.sortOrder);
  const chakra   = data.attributes.find((a: AttributeEntry) => a.key === 'chakra');

  const BAR_H = 9;
  const ROW_H = 46;

  // FÍSICO (3 cols)
  if (physical.length > 0) {
    drawSectionLabel(ctx, '▸ FÍSICO', CX, y); y += 20;
    const phW = (CW - 2 * 6) / 3;
    for (let i = 0; i < physical.length; i++) {
      drawAttrBar(ctx, CX + (i % 3) * (phW + 6), y + Math.floor(i / 3) * ROW_H, phW, BAR_H, physical[i]);
    }
    y += Math.ceil(physical.length / 3) * ROW_H + 12;
  }

  // NINJA (2 cols)
  if (ninja.length > 0) {
    drawSectionLabel(ctx, '▸ NINJA', CX, y); y += 20;
    const njW = (CW - 8) / 2;
    for (let i = 0; i < ninja.length; i++) {
      drawAttrBar(ctx, CX + (i % 2) * (njW + 8), y + Math.floor(i / 2) * ROW_H, njW, BAR_H, ninja[i]);
    }
    y += Math.ceil(ninja.length / 2) * ROW_H + 12;
  }

  // CHAKRA (full)
  if (chakra) {
    drawGlowLine(ctx, CX, y, CW, '#1A3A6B', 0.6); y += 14;
    drawAttrBar(ctx, CX, y, CW, BAR_H + 4, chakra, true);
  }
}

function drawAttrBar(
  ctx: SKRSContext2D,
  x: number, y: number,
  w: number, barH: number,
  attr: AttributeEntry,
  highlight = false
) {
  const ratio = attr.maxValue > 0 ? Math.min(1, attr.value / attr.maxValue) : 0;
  const colors = ATTR[attr.key] ?? ["#444", "#888", "#aaa"];
  const [dark, light, glow] = colors;
  const icon = ICON[attr.key] ?? "·";
  const labelSize = highlight ? 12 : 10;
  const iconSize  = highlight ? 14 : 11;

  // Ícone com cor do atributo
  ctx.save();
  ctx.fillStyle = light;
  ctx.font = FONT(iconSize);
  ctx.fillText(icon, x, y + 12);
  ctx.restore();

  // Nome do atributo
  ctx.fillStyle = highlight ? C.text : C.muted;
  ctx.font = FONT(labelSize, highlight ? "600" : "normal");
  ctx.fillText(attr.name, x + 18, y + 12);

  // Valor (alinhado à direita)
  ctx.fillStyle = C.text;
  ctx.font = FONT(labelSize, "bold");
  ctx.textAlign = "right";
  ctx.fillText(String(attr.value), x + w, y + 12);
  ctx.textAlign = "left";

  const barY = y + (highlight ? 18 : 17);

  // Barra de fundo
  ctx.fillStyle = C.dimbar;
  roundRect(ctx, x, barY, w, barH, 3);
  ctx.fill();

  if (ratio > 0.005) {
    const fw = w * ratio;

    // Glow sob a barra
    ctx.save();
    ctx.globalAlpha = 0.3;
    const glowGrad = ctx.createLinearGradient(x, 0, x + fw, 0);
    glowGrad.addColorStop(0, glow);
    glowGrad.addColorStop(1, glow);
    ctx.fillStyle = glowGrad;
    roundRect(ctx, x - 1, barY - 2, fw + 2, barH + 4, 4);
    ctx.fill();
    ctx.restore();

    // Barra principal com gradiente
    const grad = ctx.createLinearGradient(x, 0, x + fw, 0);
    grad.addColorStop(0, dark);
    grad.addColorStop(0.6, light);
    grad.addColorStop(1, glow);
    ctx.fillStyle = grad;
    roundRect(ctx, x, barY, fw, barH, 3);
    ctx.fill();

    // Reflexo no topo da barra
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x + 1, barY + 1, fw - 2, barH / 2 - 1, 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conteúdo — card de perícias
// ─────────────────────────────────────────────────────────────────────────────

const PERICIA_MARGIN = 40;
const PERICIA_COLS = 2;
const PERICIA_ROWS = 7;
const PERICIA_COL_GAP = 28;

function drawPericiaContent(ctx: SKRSContext2D, data: PericiaCardData) {
  const mx = PERICIA_MARGIN;
  const cw = W - mx * 2;
  let y = 46;

  // Nome do personagem
  ctx.save();
  ctx.shadowColor = C.gold;
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = C.goldL;
  ctx.font        = FONT(30, 'bold');
  ctx.fillText(data.characterName, mx, y);
  ctx.restore();

  // Subtítulo
  ctx.fillStyle = C.muted;
  ctx.font      = 'italic ' + FONT(13);
  ctx.textAlign = 'right';
  ctx.fillText('Catálogo de Perícias', mx + cw, y);
  ctx.textAlign = 'left';

  y += 18;
  drawGlowLine(ctx, mx, y, cw, C.orange, 0.7);
  y += 26;

  drawSectionLabel(ctx, '▸ PROGRESSÃO POR USO — XP 0–100 · NÍVEL 1–5', mx, y);
  y += 22;

  const gridTop = y;
  const gridBottom = H - FH - 14;
  const rowH = (gridBottom - gridTop) / PERICIA_ROWS;
  const colW = (cw - PERICIA_COL_GAP * (PERICIA_COLS - 1)) / PERICIA_COLS;

  const sorted = [...data.pericias].sort((a, b) => a.sortOrder - b.sortOrder);
  const maxEntries = PERICIA_COLS * PERICIA_ROWS;

  for (let i = 0; i < sorted.length && i < maxEntries; i++) {
    const col = i % PERICIA_COLS;
    const row = Math.floor(i / PERICIA_COLS);
    const x = mx + col * (colW + PERICIA_COL_GAP);
    const cy = gridTop + row * rowH;
    drawPericiaRow(ctx, x, cy, colW, sorted[i]);
  }
}

function drawPericiaRow(ctx: SKRSContext2D, x: number, y: number, w: number, entry: PericiaEntry) {
  const ratio = entry.maxXp > 0 ? Math.min(1, entry.xp / entry.maxXp) : 0;
  const colors = ATTR[entry.key] ?? ["#444", "#888", "#aaa"];
  const [dark, light, glow] = colors;
  const icon = ICON[entry.key] ?? "·";

  // Ícone
  ctx.save();
  ctx.fillStyle = light;
  ctx.font = FONT(13);
  ctx.fillText(icon, x, y + 13);
  ctx.restore();

  // Nome da perícia
  ctx.fillStyle = C.text;
  ctx.font = FONT(13, "600");
  ctx.fillText(entry.name, x + 20, y + 13);

  // Badge "Nv. X" (alinhado à direita)
  const levelLabel = `Nv. ${entry.level}`;
  ctx.font = FONT(11, "bold");
  const badgeW = ctx.measureText(levelLabel).width + 18;
  const badgeH = 17;
  const badgeX = x + w - badgeW;
  const badgeY = y;

  ctx.save();
  ctx.fillStyle = "rgba(212,160,23,0.15)";
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fill();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 1;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
  ctx.stroke();
  ctx.fillStyle = C.goldL;
  ctx.textAlign = "center";
  ctx.fillText(levelLabel, badgeX + badgeW / 2, badgeY + 12);
  ctx.textAlign = "left";
  ctx.restore();

  // XP atual (entre o nome e o badge)
  ctx.fillStyle = C.muted;
  ctx.font = FONT(10);
  ctx.textAlign = "right";
  ctx.fillText(`${entry.xp}/${entry.maxXp} XP`, badgeX - 10, y + 12);
  ctx.textAlign = "left";

  // Barra de XP
  const barY = y + 23;
  const barH = 8;

  ctx.fillStyle = C.dimbar;
  roundRect(ctx, x, barY, w, barH, 3);
  ctx.fill();

  if (ratio > 0.005) {
    const fw = w * ratio;

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = glow;
    roundRect(ctx, x - 1, barY - 2, fw + 2, barH + 4, 4);
    ctx.fill();
    ctx.restore();

    const grad = ctx.createLinearGradient(x, 0, x + fw, 0);
    grad.addColorStop(0, dark);
    grad.addColorStop(0.6, light);
    grad.addColorStop(1, glow);
    ctx.fillStyle = grad;
    roundRect(ctx, x, barY, fw, barH, 3);
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x + 1, barY + 1, fw - 2, barH / 2 - 1, 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rodapé
// ─────────────────────────────────────────────────────────────────────────────

function drawFooter(ctx: SKRSContext2D, ownerTag: string) {
  ctx.fillStyle = C.foot;
  ctx.fillRect(0, H - FH, W, FH);

  // Linha separadora com glow
  drawGlowLine(ctx, 0, H - FH, W, C.red, 0.5);

  ctx.fillStyle = C.muted;
  ctx.font = FONT(10);
  ctx.textAlign = "left";
  ctx.fillText(`Dono: ${ownerTag}`, 14, H - 8);

  const ts = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
  ctx.textAlign = "right";
  ctx.fillText(ts, W - 10, H - 8);
  ctx.textAlign = "left";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawSectionLabel(ctx: SKRSContext2D, text: string, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = C.orange;
  ctx.font = FONT(10, "bold");
  ctx.letterSpacing = "1px";
  ctx.fillText(text, x, y);
  ctx.letterSpacing = "0px";
  ctx.restore();
}

function drawGlowLine(
  ctx: SKRSContext2D,
  x: number, y: number, w: number,
  color: string, alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.6;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 4;
  ctx.fillStyle   = color;
  ctx.fillRect(x, y, w, 1);
  ctx.restore();
}

function roundRect(
  ctx: SKRSContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
