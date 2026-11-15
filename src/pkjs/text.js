// Cuts text to `max` UTF-16 code units without splitting a surrogate pair
// (e.g. an emoji), which would otherwise reach the watch as garbage.
function truncateText(text, max) {
  text = String(text);
  if (text.length <= max) {
    return text;
  }
  var code = text.charCodeAt(max - 1);
  var end = (code >= 0xD800 && code <= 0xDBFF) ? max - 1 : max; // high surrogate: drop it
  return text.substring(0, end) + '…';
}

// Removes sentence punctuation (and surrounding whitespace) that voice
// dictation appends to the end of the text, e.g. "Milk." -> "Milk". Only
// trailing punctuation is touched; characters inside the text, and closing
// brackets or symbols such as "%", are kept.
var TRAILING_PUNCTUATION = /[\s.,;:!?\u2026\u3001\u3002\uFF01\uFF0C\uFF1A\uFF1B\uFF1F\u00A1\u00BF]+$/;

function stripTrailingPunctuation(text) {
  return String(text).replace(TRAILING_PUNCTUATION, '');
}

module.exports = {
  truncateText: truncateText,
  stripTrailingPunctuation: stripTrailingPunctuation
};
