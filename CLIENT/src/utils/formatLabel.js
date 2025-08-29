export const formatLabel = (name) => {
  if (!name) return "";
  // Convert camelCase or PascalCase to separate words
  const words = name
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ");
  // Capitalize each word
  const formattedWords = words.map((word, index) =>
    index === 0
      ? word.charAt(0).toUpperCase() + word.slice(1)
      : word.toLowerCase()
  );

  // Handle pluralization (remove last 's' if exists)
  if (formattedWords.length > 1) {
    const lastWord = formattedWords[formattedWords.length - 1];
    if (lastWord.endsWith("s")) {
      formattedWords[formattedWords.length - 1] = lastWord.slice(0, -1);
    }
  }
  return formattedWords.join(" ");
};
