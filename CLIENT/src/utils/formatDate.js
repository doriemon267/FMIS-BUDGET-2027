

export function isValidDate(dateString) {
    // Regular expression to check the format M(M)-D(D)-YYYY (allows leading zero but doesn't require it)
    const regex = /^(0?[1-9]|1[0-2])-(0?[1-9]|[12][0-9]|3[01])-\d{4}$/;

    if (!regex.test(dateString)) {
        return false; // Invalid format
    }

    // Parse the date components
    const [month, day, year] = dateString.split('-').map(Number);

    // Create a Date object
    const date = new Date(year, month - 1, day);

    // Validate if the date components match (to prevent cases like 2-30-2025)
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
}

export function formatDateToMDY(isoDateString) {
    const date = new Date(isoDateString);
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
}

