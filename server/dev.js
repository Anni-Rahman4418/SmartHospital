// Local development only (Codespaces or your computer). On Vercel, api/[...path].js runs the app instead.
import app from './app.js';

try { process.loadEnvFile?.(); } catch { /* no .env file, use the environment as it is */ }

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Smart Hospital API on http://localhost:${port}`));
