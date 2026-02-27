import { readFileSync } from 'fs';

const FALLBACK_VERSION = '0.1.0';

function readPackageVersion(): string {
  try {
    const packageJsonPath = new URL('../package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version?: string };
    return packageJson.version || FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

export const CLI_VERSION = readPackageVersion();
