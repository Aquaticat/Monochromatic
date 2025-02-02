export default function onDomContentLoaded() {
  const q = new URLSearchParams(location.search).get('q');

  if (q) {
    location.href = `https://duckduckgo.com/?q=${encodeURIComponent(q)}+${
      encodeURIComponent(
        `site:${location.origin}`,
      )
    }`;
  }
}
