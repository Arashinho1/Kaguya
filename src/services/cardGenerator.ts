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
const ACCENT = "#ff6b1a";
const ACCENT_SOFT = "rgba(255, 107, 26, 0.35)";

export interface CardAttribute {
  name: string;
  value: number;
  maxValue: number | null;
}

export interface CardParams {
  characterName: string;
  avatarUrl: string;
  backgroundUrl: string | null;
  rankName: string | null;
  villageName: string | null;
  clanName: string | null;
  chakra: number;
  trainingPoints: number | null;
  attributes: CardAttribute[];
}

const MAX_ATTRIBUTE_BARS = 8;
const FETCH_TIMEOUT_MS = 6000;

export async function renderFichaCard(params: CardParams): Promise<Buffer> {
  ensureFontsRegistered();

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  await drawBackground(ctx, params.backgroundUrl);
  drawOverlay(ctx);
  await drawAvatarAndHeader(ctx, params);
  drawChakraStat(ctx, params.chakra, params.trainingPoints);
  drawAttributeBars(ctx, params.attributes);
  drawFrame(ctx);

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

async function drawBackground(ctx: SKRSContext2D, backgroundUrl: string | null): Promise<void> {
  const image = backgroundUrl ? await loadRemoteImage(backgroundUrl) : null;

  if (!image) {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, "#1b1230");
    gradient.addColorStop(1, "#3a1c12");
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
  gradient.addColorStop(0, "rgba(10, 6, 14, 0.55)");
  gradient.addColorStop(0.45, "rgba(10, 6, 14, 0.55)");
  gradient.addColorStop(1, "rgba(6, 4, 10, 0.92)");
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

function drawFrame(ctx: SKRSContext2D): void {
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 6;
  roundRectPath(ctx, 6, 6, WIDTH - 12, HEIGHT - 12, 28);
  ctx.stroke();
  ctx.restore();
}

async function drawAvatarAndHeader(ctx: SKRSContext2D, params: CardParams): Promise<void> {
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
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const textX = cx + radius + 34;

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 42px "${FONT_BOLD}"`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(params.characterName, textX, 108);

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

    ctx.fillStyle = ACCENT_SOFT;
    roundRectPath(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.fill();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, badgeX + paddingX, badgeY + 23);

    badgeX += badgeWidth + 12;
  }
}

function drawChakraStat(ctx: SKRSContext2D, chakra: number, trainingPoints: number | null): void {
  ctx.textAlign = "right";

  ctx.font = `600 18px "${FONT_SEMIBOLD}"`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.fillText("CHAKRA", WIDTH - 40, 60);

  ctx.font = `bold 56px "${FONT_BOLD}"`;
  ctx.fillStyle = ACCENT;
  ctx.fillText(String(chakra), WIDTH - 40, 112);

  if (trainingPoints !== null) {
    ctx.font = `600 16px "${FONT_SEMIBOLD}"`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillText(`• Pontos livres: ${trainingPoints}`, WIDTH - 40, 140);
  }

  ctx.textAlign = "left";
}

function drawAttributeBars(ctx: SKRSContext2D, attributes: CardAttribute[]): void {
  const shown = attributes.slice(0, MAX_ATTRIBUTE_BARS);
  if (shown.length === 0) return;

  // Só considera atributos sem maxValue próprio pra não deixar um atributo com teto alto
  // (ex: um "ninjutsu" com maxValue:50) esmagar visualmente os outros na mesma escala.
  const uncapped = shown.filter((attr) => attr.maxValue === null);
  const impliedMax = Math.max(...uncapped.map((attr) => attr.value), 1) * 1.4;

  const colX = [60, 500];
  const colWidth = 400;
  const rowHeight = 70;
  const startY = 250;
  const barHeight = 14;

  shown.forEach((attr, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = colX[col];
    const y = startY + row * rowHeight;
    const max = attr.maxValue ?? impliedMax;
    const ratio = max > 0 ? Math.min(1, Math.max(0, attr.value / max)) : 0;

    ctx.font = `600 20px "${FONT_SEMIBOLD}"`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(attr.name, x, y);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText(String(attr.value), x + colWidth, y);
    ctx.textAlign = "left";

    const trackY = y + 12;
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    roundRectPath(ctx, x, trackY, colWidth, barHeight, barHeight / 2);
    ctx.fill();

    if (ratio > 0) {
      const fillGradient = ctx.createLinearGradient(x, 0, x + colWidth, 0);
      fillGradient.addColorStop(0, "#ffb347");
      fillGradient.addColorStop(1, ACCENT);
      ctx.fillStyle = fillGradient;
      roundRectPath(ctx, x, trackY, colWidth * ratio, barHeight, barHeight / 2);
      ctx.fill();
    }
  });
}
