export const normalizeRationaleText = (input: string) => {
  const withBreaks = input
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')

  const decoded = withBreaks
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  return decoded.replace(/<\/?[^>]+>/g, '')
}
