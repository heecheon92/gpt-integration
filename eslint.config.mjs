import { dirname } from "path";
import { fileURLToPath } from "url";

import { FlatCompat } from "@eslint/eslintrc";
import tsParser from "@typescript-eslint/parser";
import reactCompiler from "eslint-plugin-react-compiler";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,jsx,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          modules: true,
        },
        ecmaVersion: "latest",
        project: true,
      },
    },
    plugins: {
      "unused-imports": unusedImports,
      "react-compiler": reactCompiler,
    },
    rules: {
      /* 0: off, 1: warn, 2: error */
      "no-unused-vars": "error",
      "prefer-const": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "warn",
      "react-hooks/exhaustive-deps": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-key": [2, { checkFragmentShorthand: true }],
      "react/jsx-props-no-spreading": "off",
      "react/no-unstable-nested-components": [
        "error",
        {
          allowAsProps: true,
        },
      ],
      "react/prop-types": [
        0,
        {
          ignore: "className",
        },
      ],
      "react-compiler/react-compiler": "error",

      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "error",
      "unused-imports/no-unused-imports": "error",
      "import/no-default-export": "error",
      "import/no-anonymous-default-export": "error",

      /* only enable @typescript-eslint/no-unused-vars */
      "unused-imports/no-unused-vars": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: [
      "**/NoSSR.{js,ts,jsx,tsx}",
      "*.config.{js,mjs,cjs,ts,mts,jsx,tsx}",
      "**/manifest.{js,ts}",

      /* Exclude NextJS special files */
      "**/default.{jsx,tsx}",
      "**/error.{jsx,tsx}",
      "**/forbidden.{jsx,tsx}",
      "**/instrumentation.{jsx,tsx}",
      "**/layout.{jsx,tsx}",
      "**/loading.{jsx,tsx}",
      "**/mdx-components.{jsx,tsx}",
      "**/not-found.{jsx,tsx}",
      "**/page.{jsx,tsx}",
      "**/template.{jsx,tsx}",
      "**/unauthorized.{jsx,tsx}",
      "**/middleware.{js,ts}",
    ],
    rules: {
      "import/no-default-export": "off",
    },
  },
  {
    files: ["*.config.{js,mjs,cjs,ts,mts,jsx,tsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
