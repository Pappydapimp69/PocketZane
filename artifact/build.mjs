#!/usr/bin/env node
/* =====================================================================
 *  build.mjs — concatenate artifact/src/*.tsx fragments into signal.tsx
 *
 *  Source of truth: artifact/src/NN-name.tsx fragments.
 *  Output:          artifact/signal.tsx (single file for claude.ai paste).
 *
 *  Run with:        node artifact/build.mjs
 *
 *  Fragment rules:
 *  - No top-level imports or exports (except the default export in the
 *    last fragment).
 *  - Files are concatenated in lexical order by filename.
 *  - This script prepends a single React + lucide-react import header.
 * ===================================================================== */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "src");
const outFile = join(here, "signal.tsx");

const HEADER = `/* =====================================================================
 *  Signal — bundled artifact (DO NOT EDIT BY HAND)
 *
 *  Generated from artifact/src/*.tsx by artifact/build.mjs.
 *  To modify Signal, edit the fragment files under artifact/src/ and
 *  re-run: node artifact/build.mjs
 *
 *  This is the file you paste into a Claude.ai artifact.
 * ===================================================================== */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Trash2,
  Sparkles,
  Check,
  X,
  AlertTriangle,
  Save,
  ChevronLeft,
  Loader2,
  Pencil,
  Send,
  Eye,
} from "lucide-react";

`;

async function build() {
  const files = (await readdir(srcDir))
    .filter((f) => /^\d+-.+\.(tsx|ts)$/.test(f))
    .sort();
  if (files.length === 0) {
    console.error("No fragments found in", srcDir);
    process.exit(1);
  }
  const parts = [HEADER];
  for (const f of files) {
    const body = await readFile(join(srcDir, f), "utf8");
    parts.push(`\n/* ====================================================================\n * BUNDLED FROM: src/${f}\n * ==================================================================== */\n`);
    parts.push(body.trimEnd() + "\n");
  }
  await writeFile(outFile, parts.join(""), "utf8");
  const bytes = (await readFile(outFile, "utf8")).length;
  console.log(`built ${outFile} — ${files.length} fragments, ${bytes} bytes`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
