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

module.exports = {
  truncateText: truncateText
};
