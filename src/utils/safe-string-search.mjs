/**
 * Replaces all string literals and comments with spaces of the same length.
 * This allows safe regex matching on code identifiers without accidentally
 * matching text inside strings or comments.
 * 
 * @param {string} code The original source code
 * @returns {string} The code with strings and comments blanked out
 */
export function blankStringsAndComments(code) {
  let result = '';
  let i = 0;
  
  while (i < code.length) {
    const c = code[i];
    const nextC = code[i + 1];

    // Single-line comment
    if (c === '/' && nextC === '/') {
      let start = i;
      while (i < code.length && code[i] !== '\n') {
        i++;
      }
      result += ' '.repeat(i - start);
      continue;
    }

    // Multi-line comment
    if (c === '/' && nextC === '*') {
      let start = i;
      i += 2; // skip /*
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
        // preserve newlines for accurate line numbers if needed, but since we are doing 1:1 char replacement, space is fine.
        // Actually, replacing \n with space breaks line-by-line processing later if we do it globally.
        // Let's preserve newlines.
        if (code[i] === '\n') {
          result += ' '.repeat(i - start) + '\n';
          start = i + 1;
        }
        i++;
      }
      i += 2; // skip */
      result += ' '.repeat(i - start);
      continue;
    }

    // Strings
    if (c === '"' || c === "'" || c === '`') {
      let start = i;
      let quote = c;
      i++;
      while (i < code.length) {
        if (code[i] === '\\' && code[i + 1] !== '\n') {
          i += 2; // skip escaped char
          continue;
        }
        if (code[i] === quote) {
          i++;
          break;
        }
        if (code[i] === '\n') {
          // Quotes cannot span lines in JS. Stopping here keeps a stray apostrophe
          // (e.g. JSX text like "Don't") from blanking out the code that follows.
          if (quote !== '`') break;
          result += ' '.repeat(i - start) + '\n';
          start = i + 1;
        }
        i++;
      }
      i = Math.min(i, code.length);
      result += ' '.repeat(i - start);
      continue;
    }

    result += c;
    i++;
  }
  
  return result;
}
