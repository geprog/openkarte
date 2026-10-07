import antfu from '@antfu/eslint-config';

export default antfu({
  vue: true,
  typescript: true,
  // The pnpm rules insist on `trustPolicy: no-downgrade`, which rejects
  // several postcss packages in the current resolution and breaks install.
  pnpm: false,
  formatters: {
    /**
     * Format CSS, LESS, SCSS files, also the `<style>` blocks in Vue
     * By default uses Prettier
     */
    css: true,
    /**
     * Format HTML files
     * By default uses Prettier
     */
    html: true,
    /**
     * Format Markdown files
     * Supports Prettier and dprint
     * By default uses Prettier
     */
    markdown: 'prettier',
  },
  rules: {
    'style/semi': ['error', 'always'],
    'vue/block-order': ['error', {
      order: [['template', 'script'], 'style'],
    }],
  },
});
