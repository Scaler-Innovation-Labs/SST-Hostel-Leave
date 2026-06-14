import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import checkFile from "eslint-plugin-check-file";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    plugins: {
      boundaries,
      "check-file": checkFile,
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },

    settings: {
      "import/resolver": {
        typescript: true,
      },

      "boundaries/elements": [
        {
          type: "app",
          pattern: "src/app/**/*",
        },
        {
          type: "service",
          pattern: "src/services/**/*",
        },
        {
          type: "repository",
          pattern: "src/db/repositories/**/*",
        },
        {
          type: "schema",
          pattern: "src/db/schema/**/*",
        },
        {
          type: "dto",
          pattern: "src/dto/**/*",
        },
        {
          type: "feature",
          pattern: "src/features/**/*",
        },
        {
          type: "lib",
          pattern: "src/lib/**/*",
        },
        {
          type: "component",
          pattern: "src/components/**/*",
        },
        {
          type: "constant",
          pattern: "src/constants/**/*",
        },
        {
          type: "type",
          pattern: "src/types/**/*",
        },
      ],
    },

    rules: {
      // =====================================================
      // IMPORTS
      // =====================================================

      "import/no-cycle": "error",

      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      "unused-imports/no-unused-imports": "error",

      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      // =====================================================
      // TYPESCRIPT
      // =====================================================

      "@typescript-eslint/no-explicit-any": "warn",

      "@typescript-eslint/no-unused-vars": "off",

      "@typescript-eslint/consistent-type-definitions": [
        "error",
        "type",
      ],

      // =====================================================
      // FILE NAMING
      // =====================================================

      "check-file/filename-naming-convention": [
        "error",
        {
          "**/*.{ts,tsx}": "KEBAB_CASE",
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],

      // =====================================================
      // FOLDER NAMING
      // =====================================================

      "check-file/folder-naming-convention": [
        "error",
        {
          "src/**": "KEBAB_CASE",
        },
      ],

      // =====================================================
      // ARCHITECTURE
      // =====================================================

      "boundaries/element-types": [
        "error",
        {
          default: "allow",

          rules: [
            {
              from: "app",
              allow: [
                "service",
                "dto",
                "lib",
                "constant",
                "type",
              ],
            },

            {
              from: "service",
              allow: [
                "repository",
                "dto",
                "lib",
                "constant",
                "type",
                "schema",
              ],
            },

            {
              from: "repository",
              allow: [
                "schema",
                "lib",
                "constant",
                "type",
              ],
            },

            {
              from: "dto",
              allow: [
                "lib",
                "constant",
                "type",
              ],
            },

            {
              from: "feature",
              disallow: [
                "repository",
                "schema",
                "service",
              ],
            },

            {
              from: "component",
              disallow: [
                "repository",
                "schema",
                "service",
              ],
            },

            {
              from: "schema",
              allow: [],
            },
          ],
        },
      ],
    },
  },

  // =====================================================
  // REACT COMPONENTS
  // =====================================================

  {
    files: [
      "src/components/**/*.tsx",
      "src/features/**/components/**/*.tsx",
      "src/providers/**/*.tsx",
    ],

    rules: {
      "check-file/filename-naming-convention": [
        "error",
        {
          "**/*.tsx": "PASCAL_CASE",
        },
      ],
    },
  },

  // =====================================================
  // NEXT APP ROUTER SPECIAL FILES
  // =====================================================

  {
    files: [
      "src/app/**/page.tsx",
      "src/app/**/layout.tsx",
      "src/app/**/loading.tsx",
      "src/app/**/error.tsx",
      "src/app/**/not-found.tsx",
      "src/app/**/route.ts",
    ],

    rules: {
      "check-file/filename-naming-convention": "off",
      "check-file/folder-naming-convention": "off",
    },
  },

  {
  files: ["src/db/schema/**/*.ts"],
  rules: {
    "import/no-cycle": "off",
  },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "drizzle/**",
    "tests/**",
    "src/components/ui/**",
  ]),
]);
