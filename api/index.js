// Vercel runs every /api/* request through this one function (an Express app).
// vercel.json rewrites /api/anything to this file, so the file name does not matter for matching.
import app from '../server/app.js';

export default app;
