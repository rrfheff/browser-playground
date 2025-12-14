import type { PlaygroundCompileConfig } from './types';

export const depIdentifierForPackage = (pkgName: string) => {
  const cleaned = pkgName
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_$]/g, '_');
  return `__pg_dep_${cleaned}`;
};

export const extendCompileConfigWithDependencies = (
  config: PlaygroundCompileConfig,
  pkgNames: string[]
): PlaygroundCompileConfig => {
  if (!pkgNames.length) return config;

  const allowedBareImports = new Set(config.allowedBareImports);
  const rollupExternal = new Set(config.rollupExternal);
  const rollupGlobals: Record<string, string> = { ...config.rollupGlobals };

  for (const pkgName of pkgNames) {
    allowedBareImports.add(pkgName);
    rollupExternal.add(pkgName);
    if (rollupGlobals[pkgName] == null) {
      rollupGlobals[pkgName] = depIdentifierForPackage(pkgName);
    }
  }

  return {
    ...config,
    allowedBareImports: Array.from(allowedBareImports),
    rollupExternal: Array.from(rollupExternal),
    rollupGlobals
  };
};

