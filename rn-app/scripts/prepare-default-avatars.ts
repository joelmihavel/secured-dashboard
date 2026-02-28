#!/usr/bin/env npx ts-node
/**
 * Prepare Default Avatars — One-Time Build Script
 *
 * Fetches 30 Pokemon sprites from PokeAPI, applies orange tint (#FF9A6D),
 * upscales to 256×256 with nearest-neighbor (crisp pixel art),
 * and uploads to Supabase Storage: avatars/defaults/1.png through 30.png.
 *
 * Usage:
 *   cd rn-app && npx ts-node scripts/prepare-default-avatars.ts
 *
 * Prerequisites:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set
 *   - Or run: eval $(supabase projects api-keys --project-ref zqlowjveyqiagnbmfwsb | grep SERVICE)
 */

import { createClient } from '@supabase/supabase-js';
import { deflateSync, inflateSync } from 'zlib';

// ==============================================
// CONFIG
// ==============================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  console.error('Run: export SUPABASE_URL=https://zqlowjveyqiagnbmfwsb.supabase.co');
  console.error('Run: export SUPABASE_SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref zqlowjveyqiagnbmfwsb | grep service_role | awk \'{print $NF}\')');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 30 recognizable Pokemon IDs
const POKEMON_IDS = [
  1,   // Bulbasaur
  4,   // Charmander
  7,   // Squirtle
  10,  // Caterpie
  25,  // Pikachu
  35,  // Clefairy
  39,  // Jigglypuff
  52,  // Meowth
  54,  // Psyduck
  58,  // Growlithe
  63,  // Abra
  65,  // Alakazam
  94,  // Gengar
  129, // Magikarp
  130, // Gyarados
  131, // Lapras
  133, // Eevee
  143, // Snorlax
  150, // Mewtwo
  151, // Mew
  152, // Chikorita
  155, // Cyndaquil
  158, // Totodile
  172, // Pichu
  175, // Togepi
  196, // Espeon
  197, // Umbreon
  246, // Larvitar
  249, // Lugia
  282, // Gardevoir
];

// Orange tint: #FF9A6D = RGB(255, 154, 109)
const TINT_R = 0xff;
const TINT_G = 0x9a;
const TINT_B = 0x6d;
const TINT_BLEND = 0.4;

const OUTPUT_SIZE = 256;

// ==============================================
// PNG ENCODER (minimal, no dependencies)
// ==============================================

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU32BE(arr: Uint8Array, offset: number, value: number) {
  arr[offset] = (value >> 24) & 0xff;
  arr[offset + 1] = (value >> 16) & 0xff;
  arr[offset + 2] = (value >> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

function createPNGChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  writeU32BE(chunk, 0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crcData = new Uint8Array(4 + data.length);
  crcData[0] = type.charCodeAt(0);
  crcData[1] = type.charCodeAt(1);
  crcData[2] = type.charCodeAt(2);
  crcData[3] = type.charCodeAt(3);
  crcData.set(data, 4);
  writeU32BE(chunk, 8 + data.length, crc32(crcData));
  return chunk;
}

function encodePNG(pixels: Uint8Array, width: number, height: number): Uint8Array {
  // IHDR
  const ihdr = new Uint8Array(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data with filter bytes
  const rawData = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];
      rawData[dstIdx + 1] = pixels[srcIdx + 1];
      rawData[dstIdx + 2] = pixels[srcIdx + 2];
      rawData[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  // Deflate using Node.js zlib
  const compressed = deflateSync(Buffer.from(rawData));

  // Assemble PNG
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = createPNGChunk('IHDR', ihdr);
  const idatChunk = createPNGChunk('IDAT', new Uint8Array(compressed));
  const iendChunk = createPNGChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  );
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  png.set(ihdrChunk, offset); offset += ihdrChunk.length;
  png.set(idatChunk, offset); offset += idatChunk.length;
  png.set(iendChunk, offset);

  return png;
}

// ==============================================
// PNG DECODER (minimal, for PokeAPI sprites)
// ==============================================

function decodePNG(data: Uint8Array): { width: number; height: number; pixels: Uint8Array } {
  // Verify signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== sig[i]) throw new Error('Invalid PNG signature');
  }

  // Parse IHDR
  let offset = 8;
  const ihdrLen = (data[offset] << 24) | (data[offset+1] << 16) | (data[offset+2] << 8) | data[offset+3];
  offset += 4;
  // Skip type (4 bytes)
  offset += 4;
  const width = (data[offset] << 24) | (data[offset+1] << 16) | (data[offset+2] << 8) | data[offset+3];
  offset += 4;
  const height = (data[offset] << 24) | (data[offset+1] << 16) | (data[offset+2] << 8) | data[offset+3];

  // Use sharp or canvas to decode — but since this is a build script,
  // we'll use a simpler approach: fetch the sprite pre-decoded
  // Actually, let's use the pngjs library or Node built-in

  // For simplicity, we'll use a different approach: decode with canvas
  // Since we're in Node.js, use the built-in approach

  // Fallback: use pngjs-like manual decode
  // This is complex, so let's just use the raw pixels approach:
  // We'll use Node.js zlib to decompress IDAT chunks

  // Collect IDAT chunks
  const idatChunks: Uint8Array[] = [];
  offset = 8;
  let bitDepth = 8;
  let colorType = 6;

  while (offset < data.length) {
    const chunkLen = (data[offset] << 24) | (data[offset+1] << 16) | (data[offset+2] << 8) | data[offset+3];
    const chunkType = String.fromCharCode(data[offset+4], data[offset+5], data[offset+6], data[offset+7]);

    if (chunkType === 'IHDR') {
      bitDepth = data[offset + 16];
      colorType = data[offset + 17];
    }

    if (chunkType === 'IDAT') {
      idatChunks.push(data.slice(offset + 8, offset + 8 + chunkLen));
    }

    if (chunkType === 'IEND') break;
    offset += 12 + chunkLen; // 4 length + 4 type + data + 4 crc
  }

  const compressed = Buffer.concat(idatChunks.map(c => Buffer.from(c)));
  const decompressed = inflateSync(compressed);

  // Calculate bytes per pixel based on color type
  let bpp: number;
  switch (colorType) {
    case 0: bpp = 1; break; // Grayscale
    case 2: bpp = 3; break; // RGB
    case 3: bpp = 1; break; // Palette
    case 4: bpp = 2; break; // Grayscale + Alpha
    case 6: bpp = 4; break; // RGBA
    default: throw new Error(`Unsupported color type: ${colorType}`);
  }

  // Unfilter rows
  const stride = width * bpp;
  const pixels = new Uint8Array(width * height * 4); // Always output RGBA
  let prevRow = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const filterType = decompressed[y * (stride + 1)];
    const rowStart = y * (stride + 1) + 1;
    const row = new Uint8Array(stride);

    for (let i = 0; i < stride; i++) {
      const raw = decompressed[rowStart + i];
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prevRow[i];
      const c = i >= bpp ? prevRow[i - bpp] : 0;

      switch (filterType) {
        case 0: row[i] = raw; break;
        case 1: row[i] = (raw + a) & 0xff; break;
        case 2: row[i] = (raw + b) & 0xff; break;
        case 3: row[i] = (raw + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: row[i] = (raw + paethPredictor(a, b, c)) & 0xff; break;
      }
    }

    // Convert row to RGBA
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;
      if (colorType === 6) { // RGBA
        pixels[dstIdx] = row[x * 4];
        pixels[dstIdx + 1] = row[x * 4 + 1];
        pixels[dstIdx + 2] = row[x * 4 + 2];
        pixels[dstIdx + 3] = row[x * 4 + 3];
      } else if (colorType === 2) { // RGB
        pixels[dstIdx] = row[x * 3];
        pixels[dstIdx + 1] = row[x * 3 + 1];
        pixels[dstIdx + 2] = row[x * 3 + 2];
        pixels[dstIdx + 3] = 255;
      } else if (colorType === 4) { // GA
        pixels[dstIdx] = row[x * 2];
        pixels[dstIdx + 1] = row[x * 2];
        pixels[dstIdx + 2] = row[x * 2];
        pixels[dstIdx + 3] = row[x * 2 + 1];
      } else { // Grayscale or Palette (simplified)
        pixels[dstIdx] = row[x];
        pixels[dstIdx + 1] = row[x];
        pixels[dstIdx + 2] = row[x];
        pixels[dstIdx + 3] = 255;
      }
    }

    prevRow = row;
  }

  return { width, height, pixels };
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ==============================================
// IMAGE PROCESSING
// ==============================================

function applyOrangeTint(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(pixels);

  for (let i = 0; i < width * height * 4; i += 4) {
    const r = result[i];
    const g = result[i + 1];
    const b = result[i + 2];
    const a = result[i + 3];

    // Skip fully transparent pixels
    if (a === 0) continue;

    // Blend: out = original * (1 - blend) + tint * blend
    result[i] = Math.round(r * (1 - TINT_BLEND) + TINT_R * TINT_BLEND);
    result[i + 1] = Math.round(g * (1 - TINT_BLEND) + TINT_G * TINT_BLEND);
    result[i + 2] = Math.round(b * (1 - TINT_BLEND) + TINT_B * TINT_BLEND);
    // Alpha unchanged
  }

  return result;
}

function nearestNeighborUpscale(
  pixels: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8Array {
  const result = new Uint8Array(dstWidth * dstHeight * 4);

  for (let y = 0; y < dstHeight; y++) {
    const srcY = Math.floor(y * srcHeight / dstHeight);
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.floor(x * srcWidth / dstWidth);
      const srcIdx = (srcY * srcWidth + srcX) * 4;
      const dstIdx = (y * dstWidth + x) * 4;
      result[dstIdx] = pixels[srcIdx];
      result[dstIdx + 1] = pixels[srcIdx + 1];
      result[dstIdx + 2] = pixels[srcIdx + 2];
      result[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  return result;
}

// ==============================================
// MAIN
// ==============================================

async function main() {
  console.log('🎨 Preparing 30 default pixel art avatars...\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < POKEMON_IDS.length; i++) {
    const pokemonId = POKEMON_IDS[i];
    const avatarNumber = i + 1;

    try {
      // Fetch sprite from PokeAPI
      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
      console.log(`  [${avatarNumber}/30] Fetching Pokemon #${pokemonId}...`);

      const response = await fetch(spriteUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const spriteBytes = new Uint8Array(await response.arrayBuffer());

      // Decode PNG
      const { width, height, pixels } = decodePNG(spriteBytes);
      console.log(`    Decoded: ${width}x${height}`);

      // Apply orange tint
      const tinted = applyOrangeTint(pixels, width, height);

      // Upscale to 256×256 with nearest-neighbor
      const upscaled = nearestNeighborUpscale(tinted, width, height, OUTPUT_SIZE, OUTPUT_SIZE);

      // Encode as PNG
      const pngBytes = encodePNG(upscaled, OUTPUT_SIZE, OUTPUT_SIZE);
      console.log(`    Encoded: ${(pngBytes.length / 1024).toFixed(1)}KB`);

      // Upload to Supabase Storage
      const path = `defaults/${avatarNumber}.png`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, pngBytes, {
          contentType: 'image/png',
          upsert: true,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log(`    ✓ Uploaded to avatars/${path}`);
      successCount++;
    } catch (err) {
      console.error(`    ✗ Failed for Pokemon #${pokemonId}: ${err}`);
      failCount++;
    }
  }

  console.log(`\n📊 Results: ${successCount} succeeded, ${failCount} failed`);

  if (successCount > 0) {
    // Verify by listing
    const { data: files } = await supabase.storage
      .from('avatars')
      .list('defaults', { limit: 100 });

    console.log(`\n📁 Files in avatars/defaults/: ${files?.length ?? 0}`);
    files?.forEach((f) => console.log(`  - ${f.name} (${(f.metadata?.size ?? 0) / 1024}KB)`));
  }
}

main().catch(console.error);
