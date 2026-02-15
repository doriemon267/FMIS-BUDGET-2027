/**
 * Formats user object into full name with middle initial and suffix.
 * Handles various property names (FirstName, MiddleName, LastName, Suffix, etc.)
 */
const normalizePart = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

const formatFullName = (user) => {
  if (!user) return "";

  const getPart = (keys) => {
    for (const key of keys) {
      const part = normalizePart(user?.[key]);
      if (part) return part;
    }
    return "";
  };

  const firstName = getPart([
    "FirstName",
    "firstName",
    "GivenName",
    "givenName",
  ]);
  const lastName = getPart([
    "LastName",
    "lastName",
    "Surname",
    "surname",
  ]);
  const middleName = getPart([
    "MiddleName",
    "middleName",
    "Middle",
    "middle",
    "MiddleInitial",
    "middleInitial",
  ]);
  const suffix = getPart(["Suffix", "suffix", "SuffixName", "suffixName"]);

  const middleInitial = middleName
    ? `${middleName.charAt(0).toUpperCase()}.`
    : "";

  return [firstName, middleInitial, lastName, suffix]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

module.exports = formatFullName;
