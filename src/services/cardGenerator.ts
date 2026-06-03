/**
 * Gerador de cards de perfil para personagens do RPG.
 * Usa @napi-rs/canvas para renderizar uma imagem PNG estilo jogo Naruto.
 */
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Paleta de cores
// ─────────────────────────────────────────────────────────────────────────────

const BG        = "#0c0c18";
const PANEL     = "#13131f";
const RED       = "#c0392b";
const GOLD      = "#d4ac0d";
const TEXT      = "#e8e8f0";
const MUTED     = "#6a6a90";
const DIMBAR    = "#1c1c2e";
const FOOTERBG  = "#0a0a14";

/** Gradiente [escuro, claro] por chave de atributo */
const ATTR_COLOR: Record<string, [string, string]> = {
  chakra:             ["#1a5276", "#2e86c1"],
  forca:              ["#922b21", "#e74c3c"],
  velocidade:         ["#b7950b", "#f4d03f"],
  resistencia:        ["#1e8449", "#2ecc71"],
  ninjutsu:           ["#6c3483", "#9b59b6"],
  ninjutsu_elemental: ["#ba4a00", "#f0841c"],
  taijutsu:           ["#922b21", "#e74c3c"],
  genjutsu:           ["#117a65", "#1abc9c"],
};

/** Ícone unicode por chave de atributo */
const ATTR_ICON: Record<string, string> = {
  chakra:             "◈",
  forca:              "⚔",
  velocidade:         "◎",
  resistencia:        "⬡",
  ninjutsu:           "☯",
  ninjutsu_elemental: "✦",
  taijutsu:           "◆",
  genjutsu:           "◉",
};

// ─────────────────────────────────────────────────────────────────────────────
// Dimensões do card
// ─────────────────────────────────────────────────────────────────────────────

const W  = 820;
const H  = 430;
const PW = 210;          // largura do painel de retrato
const CX = PW + 28;      // início do conteúdo à direita
const CW = W - CX - 16; // largura disponível para conteúdo
const FOOTER_H = 28;

// ─────────────────────────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────────────────────────

export async function generateProfileCard(data: ProfileCardData): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  drawBackground(ctx);
  drawLeftPanel(ctx);
  await drawPortrait(ctx, data.imageUrl);
  drawStatusBadge(ctx, data.isActive);
  drawContent(ctx, data);
  drawFooter(ctx, data.ownerTag);

  return canvas.toBuffer("image/png");
}

// ─────────────────────────────────────────────────────────────────────────────
// Seções do card
// ─────────────────────────────────────────────────────────────────────────────

function drawBackground(ctx: SKRSContext2D) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Grade sutil
  ctx.strokeStyle = "rgba(255,255,255,0.018)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 24) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Borda externa
  ctx.strokeStyle = RED;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
}

function drawLeftPanel(ctx: SKRSContext2D) {
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, PW, H);

  // Separador vermelho vertical
  ctx.fillStyle = RED;
  ctx.fillRect(PW - 2, 0, 2, H);
}

async function drawPortrait(ctx: SKRSContext2D, imageUrl?: string) {
  const margin = 10;
  const px = margin, py = margin;
  const pw = PW - margin * 2;
  const ph = H - margin * 2 - FOOTER_H - 28;

  // Placeholder escuro
  const grad = ctx.createLinearGradient(px, py, px, py + ph);
  grad.addColorStop(0, "#1a1a30");
  grad.addColorStop(1, "#0a0a1a");
  ctx.fillStyle = grad;
  roundRect(ctx, px, py, pw, ph, 6);
  ctx.fill();

  // Imagem do personagem (se disponível)
  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl);
      ctx.save();
      roundRect(ctx, px, py, pw, ph, 6);
      ctx.clip();
      // Calcular para cobrir mantendo proporção
      const scale = Math.max(pw / img.width, ph / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      const ix = px + (pw - iw) / 2, iy = py + (ph - ih) / 2;
      ctx.drawImage(img, ix, iy, iw, ih);
      ctx.restore();
    } catch {
      // silheta placeholder
      ctx.fillStyle = "#2a2a40";
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + ph / 2 - 20, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(px + pw / 2 - 45, py + ph / 2 + 24, 90, 70);
    }
  }

  // Borda do retrato
  ctx.strokeStyle = RED;
  ctx.lineWidth = 2;
  roundRect(ctx, px, py, pw, ph, 6);
  ctx.stroke();

  // Marcadores de canto (decoração)
  const cm = 6;
  ctx.fillStyle = GOLD;
  [
    [px, py], [px + pw - cm, py],
    [px, py + ph - cm], [px + pw - cm, py + ph - cm]
  ].forEach(([cx, cy]) => ctx.fillRect(cx, cy, cm, cm));
}

function drawStatusBadge(ctx: SKRSContext2D, isActive: boolean) {
  const margin = 10;
  const pw = PW - margin * 2;
  const by = H - FOOTER_H - margin - 22;
  const bh = 22;

  ctx.fillStyle = isActive ? "#1a5e38" : "#6d1a1a";
  roundRect(ctx, margin, by, pw, bh, 4);
  ctx.fill();

  ctx.strokeStyle = isActive ? "#2ecc71" : "#e74c3c";
  ctx.lineWidth = 1;
  roundRect(ctx, margin, by, pw, bh, 4);
  ctx.stroke();

  ctx.fillStyle = isActive ? "#2ecc71" : "#e74c3c";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(isActive ? "● FICHA ATIVA" : "○ FICHA INATIVA", margin + pw / 2, by + 15);
  ctx.textAlign = "left";
}

function drawContent(
  ctx: SKRSContext2D,
  data: ProfileCardData
) {
  let y = 26;

  // ── Nome do personagem ──────────────────────────────────────────────────────
  ctx.fillStyle = GOLD;
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(data.characterName, CX, y);
  y += 20;

  // Conceito
  if (data.concept) {
    ctx.fillStyle = MUTED;
    ctx.font = "italic 13px sans-serif";
    ctx.fillText(data.concept.slice(0, 60), CX, y);
    y += 16;
  }

  // Divider
  y += 6;
  drawDivider(ctx, CX, y, CW, RED, 0.8);
  y += 12;

  // ── Identidade (3 colunas) ─────────────────────────────────────────────────
  drawSectionLabel(ctx, "▸ IDENTIDADE", CX, y);
  y += 14;

  const idItems = [
    { label: "Vila",  value: data.villageName ?? "—" },
    { label: "Clã",   value: data.clanName    ?? "—" },
    { label: "Rank",  value: data.rankName    ?? "—" },
  ];
  const colW = CW / 3;

  for (let i = 0; i < idItems.length; i++) {
    const ix = CX + i * colW;
    ctx.fillStyle = MUTED;
    ctx.font = "10px sans-serif";
    ctx.fillText(idItems[i].label, ix, y);
    ctx.fillStyle = TEXT;
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(idItems[i].value.slice(0, 18), ix, y + 14);
  }
  y += 32;

  // Divider
  drawDivider(ctx, CX, y, CW, "#2a2a4a");
  y += 12;

  // ── Atributos ──────────────────────────────────────────────────────────────
  drawSectionLabel(ctx, "▸ ATRIBUTOS", CX, y);
  y += 14;

  // Separar chakra dos demais
  const ordered = [...data.attributes].sort((a, b) => a.sortOrder - b.sortOrder);
  const chakra  = ordered.find(a => a.key === "chakra");
  const others  = ordered.filter(a => a.key !== "chakra");

  // 2 colunas para atributos normais
  const COLS   = 2;
  const barCol = (CW - 8) / COLS;
  const BAR_H  = 7;
  const ROW_H  = 30;

  for (let i = 0; i < others.length; i++) {
    const attr = others[i];
    const col  = i % COLS;
    const row  = Math.floor(i / COLS);
    const ax   = CX + col * barCol + (col > 0 ? 8 : 0);
    const ay   = y + row * ROW_H;

    drawAttributeBar(ctx, ax, ay, barCol - 8, BAR_H, attr);
  }

  y += Math.ceil(others.length / COLS) * ROW_H + 4;

  // Chakra full-width
  if (chakra) {
    drawAttributeBar(ctx, CX, y, CW, BAR_H + 2, chakra, true);
  }
}

function drawFooter(ctx: SKRSContext2D, ownerTag: string) {
  ctx.fillStyle = FOOTERBG;
  ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  ctx.fillStyle = "#2a2a3a";
  ctx.fillRect(0, H - FOOTER_H, W, 1);

  ctx.fillStyle = MUTED;
  ctx.font = "10px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Dono: ${ownerTag}`, 12, H - 9);

  const now = new Date();
  const ts  = now.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
  ctx.textAlign = "right";
  ctx.fillText(ts, W - 12, H - 9);
  ctx.textAlign = "left";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de desenho
// ─────────────────────────────────────────────────────────────────────────────

function drawAttributeBar(
  ctx: SKRSContext2D,
  x: number, y: number, w: number, barH: number,
  attr: AttributeEntry,
  fullWidth = false
) {
  const ratio  = attr.maxValue > 0 ? Math.min(1, attr.value / attr.maxValue) : 0;
  const [dark, light] = ATTR_COLOR[attr.key] ?? ["#444", "#888"];
  const icon   = ATTR_ICON[attr.key] ?? "·";
  const nameW  = fullWidth ? 110 : w * 0.55;

  // Ícone
  ctx.fillStyle = light;
  ctx.font      = fullWidth ? "13px sans-serif" : "11px sans-serif";
  ctx.fillText(icon, x, y + 12);

  // Nome do atributo
  ctx.fillStyle = fullWidth ? TEXT : MUTED;
  ctx.font      = fullWidth ? "bold 12px sans-serif" : "10px sans-serif";
  ctx.fillText(attr.name, x + 16, y + 12);

  // Valor (alinhado à direita na coluna)
  ctx.fillStyle = TEXT;
  ctx.font      = "bold 11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(String(attr.value), x + w, y + 12);
  ctx.textAlign = "left";

  // Barra fundo
  ctx.fillStyle = DIMBAR;
  roundRect(ctx, x, y + 16, w, barH, 3);
  ctx.fill();

  // Barra preenchida
  if (ratio > 0.001) {
    const grad = ctx.createLinearGradient(x, 0, x + w * ratio, 0);
    grad.addColorStop(0, dark);
    grad.addColorStop(1, light);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y + 16, w * ratio, barH, 3);
    ctx.fill();
  }

  void nameW; // evitar TS unused warning
}

function drawSectionLabel(
  ctx: SKRSContext2D,
  label: string, x: number, y: number
) {
  ctx.fillStyle = RED;
  ctx.font      = "bold 10px sans-serif";
  ctx.fillText(label, x, y);
}

function drawDivider(
  ctx: SKRSContext2D,
  x: number, y: number, w: number, color: string, alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = color;
  ctx.fillRect(x, y, w, 1);
  ctx.restore();
}

function roundRect(
  ctx: SKRSContext2D,
  x: number, y: number, w: number, h: number, r: number
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
