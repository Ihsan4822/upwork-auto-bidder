import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Loads a prompt text file reliably across ESM, CJS, and tsx runtimes.
 */
export function loadPrompt(fileName: string): string {
  const candidates: string[] = [
    resolve(process.cwd(), 'packages/ai/src/prompts', fileName),
    resolve(process.cwd(), 'apps/worker/src/prompts', fileName),
    resolve(process.cwd(), 'src/prompts', fileName),
    resolve(process.cwd(), 'prompts', fileName),
  ];

  if (typeof __dirname !== 'undefined') {
    candidates.unshift(resolve(__dirname, './prompts', fileName));
    candidates.unshift(resolve(__dirname, '../prompts', fileName));
  }

  for (const p of candidates) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf8');
    }
  }

  throw new Error(`Unable to locate prompt file "${fileName}" in any candidate directory.`);
}
