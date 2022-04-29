export function getMainLibraryId(cql: string): string | null {
  const re = /library ([a-zA-Z0-9_]+)( version .*)?/g;

  const matches = re.exec(cql);

  if (matches) {
    return matches[1];
  }

  return null;
}
