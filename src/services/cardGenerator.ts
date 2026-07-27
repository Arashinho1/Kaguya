import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, "../../assets/fonts");

const FONT_BOLD = "Kaguya Card Bold";
const FONT_SEMIBOLD = "Kaguya Card SemiBold";
const FONT_REGULAR = "Kaguya Card Regular";

let fontsRegistered = false;

/** Fontes bundladas (Poppins, OFL) em vez de depender de fonte de sistema — o container
 * do Discloud não tem garantia de ter fonte nenhuma instalada, diferente de dev local. */
function ensureFontsRegistered(): void {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Poppins-Bold.ttf"), FONT_BOLD);
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Poppins-SemiBold.ttf"), FONT_SEMIBOLD);
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, "Poppins-Regular.ttf"), FONT_REGULAR);
  fontsRegistered = true;
}

const WIDTH = 960;
const HEIGHT = 540;
const DEFAULT_ACCENT = "#ff6b1a";
const PANEL_FILL = "rgba(8, 5, 12, 0.45)";

/** Espaço reservado ao painel de identidade (avatar/nome/badges/chakra). */
const HEADER_PANEL = { x: 24, y: 24, w: WIDTH - 48, h: 196 };
/** Painel dos atributos — começa depois de uma folga clara do painel de cima, pra
 * o rótulo da seção nunca ficar colado na costura ou no avatar (feedback de UX). */
const BODY_PANEL = { x: 24, y: 236, w: WIDTH - 48, h: HEIGHT - 236 - 24 };

export interface CardAttribute {
  name: string;
  value: number;
  maxValue: number | null;
}

/** Formato aceito nos campos de cor dos modais do editor visual (#rrggbb). */
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export interface CardParams {
  characterName: string;
  avatarUrl: string;
  backgroundUrl: string | null;
  /** Fundo sólido (gradiente sutil a partir dessa cor) — só usado se backgroundUrl for null/falhar. */
  backgroundColor?: string | null;
  rankName: string | null;
  villageName: string | null;
  clanName: string | null;
  chakra: number;
  trainingPoints: number | null;
  attributes: CardAttribute[];
  /** Desenhado acima das barras — usado quando a ficha gera um card por categoria de
   * atributo (ex: "ATRIBUTOS FÍSICOS" / "ATRIBUTOS MENTAIS"), ver fichaMenu.ts. */
  sectionLabel?: string | null;
  /** Cor de destaque (frame, chakra, badges, barras) — cada categoria pode ter a sua
   * pra não ficarem visualmente idênticas (ver CATEGORY_THEME em fichaMenu.ts). */
  accent?: string;
}

const MAX_ATTRIBUTE_BARS = 8;
const FETCH_TIMEOUT_MS = 6000;

export async function renderFichaCard(params: CardParams): Promise<Buffer> {
  ensureFontsRegistered();

  const accent = params.accent ?? DEFAULT_ACCENT;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  await drawBackground(ctx, params.backgroundUrl, params.backgroundColor ?? null);
  drawOverlay(ctx);
  // Fundos de usuário podem ser claros ou muito "cheios" (ver feedback de visibilidade) —
  // painéis semi-opacos atrás do texto garantem contraste mínimo independente da imagem.
  drawPanel(ctx, HEADER_PANEL.x, HEADER_PANEL.y, HEADER_PANEL.w, HEADER_PANEL.h, 24);
  if (params.attributes.length > 0) {
    drawPanel(ctx, BODY_PANEL.x, BODY_PANEL.y, BODY_PANEL.w, BODY_PANEL.h, 24);
  }
  await drawAvatarAndHeader(ctx, params, accent);
  drawChakraStat(ctx, params.chakra, params.trainingPoints, accent);
  drawAttributeBars(ctx, params.attributes, params.sectionLabel, accent);
  drawFrame(ctx, accent);

  return canvas.toBuffer("image/png");
}

async function loadRemoteImage(url: string): Promise<Image | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

/**
 * Confere se um link realmente carrega como imagem antes de salvar como fundo — sem
 * isso, um link de página (ex: um link curto do Pinterest, que aponta pro post em vez
 * do arquivo .jpg) falha silenciosamente e o card cai no gradiente padrão sem avisar nada.
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  return (await loadRemoteImage(url)) !== null;
}

async function drawBackground(ctx: SKRSContext2D, backgroundUrl: string | null, backgroundColor: string | null): Promise<void> {
  const image = backgroundUrl ? await loadRemoteImage(backgroundUrl) : null;

  if (!image) {
    const [from, to] = backgroundColor && HEX_COLOR_PATTERN.test(backgroundColor)
      ? [backgroundColor, darken(backgroundColor, 0.5)]
      : ["#1b1230", "#3a1c12"];
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = (WIDTH - drawWidth) / 2;
  const dy = (HEIGHT - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawOverlay(ctx: SKRSContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "rgba(8, 5, 12, 0.45)");
  gradient.addColorStop(0.45, "rgba(8, 5, 12, 0.45)");
  gradient.addColorStop(1, "rgba(5, 3, 8, 0.8)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function roundRectPath(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Painel semi-opaco atrás de uma seção do card — dá contraste consistente pro
 * texto/barras em cima, mesmo com um fundo de usuário claro ou muito detalhado. */
function drawPanel(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.save();
  ctx.fillStyle = PANEL_FILL;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

/** Sombra suave atrás de texto — reforça a legibilidade em cima de qualquer fundo/painel. */
function withTextShadow(ctx: SKRSContext2D, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  draw();
  ctx.restore();
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.substring(0, 2), 16),
    Number.parseInt(normalized.substring(2, 4), 16),
    Number.parseInt(normalized.substring(4, 6), 16)
  ];
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Mistura a cor com branco — usada pro início do gradiente das barras (mais clara que o accent). */
function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Mistura a cor com preto — usada pro segundo tom do gradiente de fundo sólido (dá profundidade). */
function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel * (1 - amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function drawFrame(ctx: SKRSContext2D, accent: string): void {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  roundRectPath(ctx, 6, 6, WIDTH - 12, HEIGHT - 12, 28);
  ctx.stroke();
  ctx.restore();
}

async function drawAvatarAndHeader(ctx: SKRSContext2D, params: CardParams, accent: string): Promise<void> {
  const cx = 130;
  const cy = 130;
  const radius = 74;

  const avatar = await loadRemoteImage(params.avatarUrl);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = "#2a2140";
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const textX = cx + radius + 34;

  ctx.font = `bold 42px "${FONT_BOLD}"`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  withTextShadow(ctx, () => ctx.fillText(params.characterName, textX, 108));

  let badgeX = textX;
  const badgeY = 128;
  const badges = [params.rankName, params.villageName, params.clanName].filter(
    (label): label is string => !!label
  );

  ctx.font = `600 20px "${FONT_SEMIBOLD}"`;
  for (const label of badges) {
    const paddingX = 16;
    const textWidth = ctx.measureText(label).width;
    const badgeWidth = textWidth + paddingX * 2;
    const badgeHeight = 34;

    ctx.fillStyle = withAlpha(accent, 0.45);
    roundRectPath(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    withTextShadow(ctx, () => ctx.fillText(label, badgeX + paddingX, badgeY + 23));

    badgeX += badgeWidth + 12;
  }
}

function drawChakraStat(ctx: SKRSContext2D, chakra: number, trainingPoints: number | null, accent: string): void {
  ctx.textAlign = "right";

  ctx.font = `600 18px "${FONT_SEMIBOLD}"`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  withTextShadow(ctx, () => ctx.fillText("CHAKRA", WIDTH - 40, 60));

  ctx.font = `bold 56px "${FONT_BOLD}"`;
  ctx.fillStyle = accent;
  withTextShadow(ctx, () => ctx.fillText(String(chakra), WIDTH - 40, 112));

  if (trainingPoints !== null) {
    ctx.font = `600 16px "${FONT_SEMIBOLD}"`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    withTextShadow(ctx, () => ctx.fillText(`• Pontos livres: ${trainingPoints}`, WIDTH - 40, 140));
  }

  ctx.textAlign = "left";
}

function drawAttributeBars(
  ctx: SKRSContext2D,
  attributes: CardAttribute[],
  sectionLabel: string | null | undefined,
  accent: string
): void {
  const shown = attributes.slice(0, MAX_ATTRIBUTE_BARS);
  if (shown.length === 0) return;

  // Rótulo com bastante folga do topo do painel (que por sua vez já tem folga do
  // avatar) — antes ficava colado na costura entre os dois painéis (feedback de UX).
  const labelY = BODY_PANEL.y + 38;
  if (sectionLabel) {
    ctx.font = `600 22px "${FONT_SEMIBOLD}"`;
    ctx.fillStyle = accent;
    withTextShadow(ctx, () => ctx.fillText(sectionLabel, 60, labelY));
  }

  // Só considera atributos sem maxValue próprio pra não deixar um atributo com teto alto
  // (ex: um "ninjutsu" com maxValue:50) esmagar visualmente os outros na mesma escala.
  const uncapped = shown.filter((attr) => attr.maxValue === null);
  const impliedMax = Math.max(...uncapped.map((attr) => attr.value), 1) * 1.4;

  const colX = [60, 500];
  const colWidth = 400;
  const rowHeight = 56;
  const startY = sectionLabel ? labelY + 34 : BODY_PANEL.y + 40;
  const barHeight = 14;
  const barStart = lighten(accent, 0.35);

  shown.forEach((attr, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = colX[col];
    const y = startY + row * rowHeight;
    const max = attr.maxValue ?? impliedMax;
    const ratio = max > 0 ? Math.min(1, Math.max(0, attr.value / max)) : 0;

    ctx.font = `600 20px "${FONT_SEMIBOLD}"`;
    ctx.fillStyle = "#ffffff";
    withTextShadow(ctx, () => ctx.fillText(attr.name, x, y));

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    withTextShadow(ctx, () => ctx.fillText(String(attr.value), x + colWidth, y));
    ctx.textAlign = "left";

    const trackY = y + 12;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    roundRectPath(ctx, x, trackY, colWidth, barHeight, barHeight / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    roundRectPath(ctx, x, trackY, colWidth, barHeight, barHeight / 2);
    ctx.stroke();

    if (ratio > 0) {
      const fillGradient = ctx.createLinearGradient(x, 0, x + colWidth, 0);
      fillGradient.addColorStop(0, barStart);
      fillGradient.addColorStop(1, accent);
      ctx.fillStyle = fillGradient;
      roundRectPath(ctx, x, trackY, colWidth * ratio, barHeight, barHeight / 2);
      ctx.fill();
    }
  });
}
