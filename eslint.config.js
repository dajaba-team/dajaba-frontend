import js from "@eslint/js"
import globals from "globals"
import hooks from "eslint-plugin-react-hooks"
import refresh from "eslint-plugin-react-refresh"
import prettier from "eslint-config-prettier"

export default [
	{ ignores: ["dist/**", "coverage/**", "public/mockServiceWorker.js"] },
	{
		files: ["**/*.{js,jsx}"],
		...js.configs.recommended,
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			parserOptions: { ecmaFeatures: { jsx: true } },
			globals: { ...globals.browser, ...globals.node },
		},
		plugins: { "react-hooks": hooks, "react-refresh": refresh },
		rules: {
			...hooks.configs.recommended.rules,
			"no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
			"react-refresh/only-export-components": ["error", { allowConstantExport: true }],
		},
	},
	prettier,
]
