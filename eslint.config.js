import js from '@eslint/js';import globals from 'globals';
export default [
 {ignores:['node_modules/**','dist/**','artifacts/**','data/**']},
 js.configs.recommended,
 {files:['**/*.js'],languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:globals.node},rules:{'no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrors:'none',varsIgnorePattern:'^ignored$'}]}},
 {files:['public/**/*.js'],languageOptions:{globals:globals.browser}},
 {files:['scripts/*check.js','scripts/acceptance.js'],languageOptions:{globals:{...globals.node,...globals.browser}}}
];
