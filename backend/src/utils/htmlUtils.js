// Some job sources (arbeitnow in particular, occasionally adzuna) return
// description fields as raw HTML rather than plain text. We store and
// display descriptions as plain text everywhere, so strip markup and
// decode entities once here at ingestion time instead of downstream.

const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function stripHtml(input) {
  if (!input) return '';

  let text = String(input);

  // Block-level tags become line breaks so paragraphs don't run together.
  text = text.replace(/<\/(p|div|li|h[1-6]|br)>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Drop all remaining tags.
  text = text.replace(/<[^>]*>/g, '');

  // Decode the common named entities plus numeric ones (&#123; / &#x1F;).
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  text = text.replace(/&[a-z]+;/gi, (match) => ENTITY_MAP[match] ?? match);

  // Collapse whitespace left behind by the tag removal.
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/ *\n */g, '\n');

  return text.trim();
}