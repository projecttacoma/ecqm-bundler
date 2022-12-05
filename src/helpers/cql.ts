export function extractDefinesFromCQL(cql: string) {
  const results: string[] = [];

  const expressionRegex = /define\s+"?([\w\s]+)"?:/g;
  const functionRegex = /define\s+function\s+"?([\w\s]+)"?\(.*\):/g;

  let expressionMatches = expressionRegex.exec(cql);

  while (expressionMatches) {
    results.push(expressionMatches[1]);

    expressionMatches = expressionRegex.exec(cql);
  }

  let functionMatches = functionRegex.exec(cql);

  while (functionMatches) {
    results.push(functionMatches[1]);

    functionMatches = functionRegex.exec(cql);
  }

  return results;
}

export function getMainLibraryId(cql: string): string | null {
  const re = /^library ([a-zA-Z0-9_]+)( version .*)?/gm;

  const matches = re.exec(cql);

  if (matches) {
    return matches[1];
  }

  return null;
}
