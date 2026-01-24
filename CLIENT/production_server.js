import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// --- ITO ANG BINAGO (Wildcard Fix) ---
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = 3005;
app.listen(PORT, () => {
    console.log(`Budget Client is running on port ${PORT}`);
});