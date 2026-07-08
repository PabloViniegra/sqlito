const WORD_CHAR = /[A-Za-z0-9_]/;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

function isOpenQuote(ch: string | undefined): boolean {
  return ch === "'" || ch === '"';
}

function skipPastCloseQuote(text: string, cursor: number): number {
  const quote = text[cursor];
  let j = cursor + 1;
  while (j < text.length && text[j] !== quote) j++;
  if (j < text.length) j++;
  return j;
}

function skipPastOpenQuote(text: string, cursor: number): number {
  const quote = text[cursor - 1];
  let j = cursor - 2;
  while (j >= 0 && text[j] !== quote) j--;
  return j < 0 ? 0 : j;
}

export function findWordLeft(text: string, cursor: number): number {
  let i = Math.max(0, Math.min(cursor, text.length));
  while (i > 0) {
    const prev = text[i - 1];
    if (isWordChar(prev)) break;
    if (isOpenQuote(prev)) return skipPastOpenQuote(text, i);
    i--;
  }
  while (i > 0 && isWordChar(text[i - 1])) i--;
  return i;
}

export function findWordRight(text: string, cursor: number): number {
  let i = Math.max(0, Math.min(cursor, text.length));
  while (i < text.length) {
    if (isWordChar(text[i])) break;
    if (isOpenQuote(text[i])) return skipPastCloseQuote(text, i);
    i++;
  }
  while (i < text.length && isWordChar(text[i])) i++;
  return i;
}
