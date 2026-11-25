/* Tailwind (Play CDN) settings — prefix "tw-" and no preflight so it doesn't fight Bootstrap */
tailwind.config = {
  prefix: "tw-",
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        paper: "#F6F1E7", "paper-deep": "#EDE4D3", card: "#FFFDF8", line: "#E3DACB",
        ink: "#1F2A24", "ink-soft": "#5B6660", slate: "#7A8A8E",
        forest: "#2F5D46", "forest-dark": "#1E3F2F", moss: "#8AA37B", "moss-soft": "#DCE6D2",
        pink: "#C24F7C", "pink-soft": "#F9DDE7", blossom: "#E58FB0", "blossom-soft": "#FCEAF0"
      }
    }
  }
};
