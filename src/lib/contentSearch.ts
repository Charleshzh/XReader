export interface ContentMatch {
  text: string;
  index: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function findContentMatches(
  html: string,
  query: string,
  caseSensitive: boolean,
): ContentMatch[] {
  if (!query.trim()) return [];

  const text = stripHtml(html);
  const source = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches: ContentMatch[] = [];
  let index = 0;

  while (index < source.length) {
    const found = source.indexOf(needle, index);
    if (found === -1) break;
    matches.push({ text: text.slice(found, found + needle.length), index: found });
    index = found + needle.length;
  }

  return matches;
}

export function highlightSearchMatches(
  html: string,
  query: string,
  caseSensitive: boolean,
): string {
  if (!query.trim() || typeof DOMParser === "undefined" || typeof NodeFilter === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");
  const needle = caseSensitive ? query : query.toLowerCase();
  const textNodes: Text[] = [];
  const walker = documentNode.createTreeWalker(documentNode.body, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    if (!textNode.nodeValue || !textNode.nodeValue.trim()) continue;
    textNodes.push(textNode);
  }

  let matchIndex = 0;
  for (const textNode of textNodes) {
    const original = textNode.nodeValue ?? "";
    const searchable = caseSensitive ? original : original.toLowerCase();
    let cursor = 0;
    let found = searchable.indexOf(needle, cursor);
    if (found === -1) continue;

    const fragment = documentNode.createDocumentFragment();
    while (found !== -1) {
      if (found > cursor) {
        fragment.appendChild(documentNode.createTextNode(original.slice(cursor, found)));
      }

      const span = documentNode.createElement("span");
      span.className = "rounded-sm bg-primary/30";
      span.dataset.searchIndex = String(matchIndex);
      span.textContent = original.slice(found, found + query.length);
      fragment.appendChild(span);

      matchIndex += 1;
      cursor = found + query.length;
      found = searchable.indexOf(needle, cursor);
    }

    if (cursor < original.length) {
      fragment.appendChild(documentNode.createTextNode(original.slice(cursor)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return documentNode.body.innerHTML;
}
