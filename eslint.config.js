import globals from "globals";
import pluginJs from "@eslint/js";
import Import from "eslint-plugin-import";

export default [
  pluginJs.configs.recommended,
  {
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js'],
          moduleDirectory: ['node_modules', 'src/']
        }
      }
    },
    languageOptions: {
      globals: { ...globals.browser },
      ecmaVersion: "latest",
      sourceType: "module"
    },
		plugins: {
			Import
		},
    rules: {
			"camelcase": "off",
			"curly": "off",
			"dot-notation": "warn",
			"Import/no-unresolved": "warn",
			"Import/named": "error",
			"Import/namespace": "error",
			"Import/default": "error",
			"Import/export": "error",
			"Import/no-named-as-default": "warn",
			"Import/no-named-as-default-member": "warn",
			"Import/no-duplicates": "warn",
			"Import/first": "off",
			"new-cap": "off",
			"no-alert": "off",
			"no-console": "off",
			"no-debugger": "error",
			"no-eval": "warn",
			"no-fallthrough": "off",
			"no-global-assign": "off",
			"no-loop-func": "warn",
			"no-mixed-spaces-and-tabs": "off",
			"no-new": "off",
			"no-prototype-builtins": "off",
			"no-redeclare": [
				"error",
				{
					"builtinGlobals": false
				}
			],
			"no-trailing-spaces": "warn",
			"no-underscore-dangle": "off",
			"no-unused-vars": "off",
			"no-useless-escape": "warn",
			"no-use-before-define": "off",
			"quotes": "off",
			"strict": "off"
    }
  }
];
