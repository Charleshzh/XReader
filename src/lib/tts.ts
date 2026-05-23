function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function htmlToSpeechText(html: string): string {
  return stripHtml(html);
}

export function splitIntoUtteranceChunks(text: string, maxLength = 2000): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let current = "";
  const sentences = normalized.split(/(?<=[。！？!?])/);

  const pushChunk = (value: string) => {
    const chunk = value.trim();
    if (chunk) {
      chunks.push(chunk);
    }
  };

  for (const sentence of sentences) {
    if (!sentence) continue;
    if ((current + sentence).length > maxLength && current) {
      pushChunk(current);
      current = sentence;
      continue;
    }

    if (sentence.length > maxLength) {
      if (current) {
        pushChunk(current);
        current = "";
      }
      for (let index = 0; index < sentence.length; index += maxLength) {
        pushChunk(sentence.slice(index, index + maxLength));
      }
      continue;
    }

    current += sentence;
  }

  pushChunk(current);
  return chunks;
}
