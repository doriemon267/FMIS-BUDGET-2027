export default function truncateText(text, length = 100) {
    if (text.length > length) {
        return text.slice(0, length) + '...';
    }
    return text;
}