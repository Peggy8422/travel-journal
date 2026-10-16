// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  globalIgnores(["dist/*", ".expo/*", "expo-env.d.ts"]),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    // domain/ is pure TypeScript: no React Native or Expo
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(react|react-native|expo|@expo)(/|-|$)",
              message: "domain/ must not depend on React Native or Expo.",
            },
          ],
        },
      ],
    },
  },
  {
    // domain/ must not import other layers. Resolved by file path, so
    // domain-internal imports like ../common/result are allowed.
    // Tests are exempt so they can reach fixtures across layers.
    files: ["src/domain/**"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/domain",
              from: [
                "./src/app",
                "./src/features",
                "./src/data",
                "./src/shared",
              ],
              message: "domain/ must not import other layers.",
            },
          ],
        },
      ],
    },
  },
]);
