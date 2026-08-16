/**
 * README badge snippet. Shields' `link` param does not work inside GitHub
 * READMEs, so the image is wrapped in a markdown link to the methodology page
 * — that link is the whole point of the badge.
 */
export function readmeSnippet(badgeJsonRawUrl: string, methodologyUrl: string): string {
  const img = `https://img.shields.io/endpoint?url=${encodeURIComponent(badgeJsonRawUrl)}`;
  return `[![context cost](${img})](${methodologyUrl})`;
}
