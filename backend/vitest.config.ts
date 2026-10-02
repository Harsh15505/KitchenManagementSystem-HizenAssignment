import ts from 'typescript';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * NestJS dependency injection needs `emitDecoratorMetadata`, which Vite's default esbuild
 * transform does not support. We compile test sources with the TypeScript compiler itself
 * (pure JS, no native binaries) so tests behave the same on Windows and in Linux CI.
 */
function typescriptWithDecoratorMetadata(): Plugin {
  return {
    name: 'typescript-decorator-metadata',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.ts') || id.includes('node_modules')) return null;
      const result = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          sourceMap: true,
        },
      });
      return { code: result.outputText, map: result.sourceMapText ?? null };
    },
  };
}

export default defineConfig({
  oxc: false,
  esbuild: false,
  plugins: [typescriptWithDecoratorMetadata()],
  test: { include: ['src/**/*.test.ts', 'test/**/*.test.ts'] },
});
