import { transformAsync } from "@babel/core";
import type { BunPlugin } from "bun";

/**
 * Compiles Solid JSX and registers vanilla-extract file scopes for `bun test`, the same 2
 * jobs `vite-plugin-solid` and `@vanilla-extract/vite-plugin` do for Vite.
 */
export const solidAndVanillaExtract: BunPlugin = {
  name: "solid-and-vanilla-extract",
  setup(build) {
    build.onLoad({ filter: /\/src\/.*\.css\.ts$/ }, async ({ path }) => {
      const source = await Bun.file(path).text();
      const contents = [
        'import { endFileScope, setFileScope } from "@vanilla-extract/css/fileScope";',
        `setFileScope(${JSON.stringify(path)}, "raceme");`,
        source,
        "endFileScope();",
      ].join("\n");

      return { contents, loader: "ts" };
    });

    build.onLoad({ filter: /\/src\/.*\.tsx$/ }, async ({ path }) => {
      const source = await Bun.file(path).text();
      const result = await transformAsync(source, {
        filename: path,
        babelrc: false,
        configFile: false,
        presets: [["babel-preset-solid", { generate: "dom", hydratable: false }]],
        plugins: [["@babel/plugin-syntax-typescript", { isTSX: true }]],
      });

      if (!result?.code) {
        throw new Error(`Babel returned no code for '${path}'.`);
      }

      return { contents: result.code, loader: "ts" };
    });
  },
};
