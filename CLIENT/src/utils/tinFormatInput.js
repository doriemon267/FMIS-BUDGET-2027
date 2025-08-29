const formatTIN = (value) => {
  // Remove any non-digit characters
  const cleanedValue = value.replace(/\D/g, "");

  // Format the cleaned value into groups of 3 digits
  const formattedValue = cleanedValue
    .slice(0, 12) // Limit to 12 digits max
    .replace(/(\d{3})(?=\d)/g, "$1-");

  return formattedValue;
};

export default formatTIN;
