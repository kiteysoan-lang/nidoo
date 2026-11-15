export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    colors: { nid: { DEFAULT: '#1F5C63', dark: '#143F45', soft: '#D5E8E5' }, sun: '#F4C95D', mist: '#EEF5F3', berry: '#C2476B' },
    fontFamily: { sans: ['Quicksand', 'system-ui', 'sans-serif'] }
  } },
  plugins: []
}
