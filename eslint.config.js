import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // SSOT: Flag inline definitions that should come from centralized files
      "no-restricted-syntax": [
        "warn",
        {
          selector: "VariableDeclarator[init.type='ObjectExpression'] > Identifier[name='GROUP_TYPES']",
          message: "Use GROUP_TYPES from '@/lib/constants' instead of defining locally.",
        },
        {
          selector: "VariableDeclarator[init.type='ObjectExpression'] > Identifier[name='ROLE_LABELS']",
          message: "Use ROLE_LABELS from '@/lib/constants' instead of defining locally.",
        },
        {
          selector: "VariableDeclarator[init.type='ObjectExpression'] > Identifier[name='ATTENDANCE_MODES']",
          message: "Use ATTENDANCE_MODES from '@/lib/constants' instead of defining locally.",
        },
      ],
      // ARCHITECTURE.md §Layer Boundaries — Step 2 starts as warn (113 violations exist).
      // Promote to "error" once each entity migration is complete (Students → Sessions → Groups → ...).
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["**/integrations/supabase/client"],
              importNames: ["supabase"],
              message:
                "Direct Supabase calls are forbidden in UI/hooks. Use a service in 'src/features/<entity>/services/' (or 'src/services/realtime.ts'). See docs/ARCHITECTURE.md.",
            },
          ],
        },
      ],
    },
  },
  // Whitelist: services + the auto-generated client itself may import supabase directly.
  {
    files: [
      "src/features/*/services/**/*.{ts,tsx}",
      "src/services/**/*.{ts,tsx}",
      "src/integrations/**/*.{ts,tsx}",
      "src/lib/profileService.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);
