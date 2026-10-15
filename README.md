# Smart Hospital demo, ready for Vercel

React app + Express API + MongoDB Atlas, hosted on Vercel. All hospitals and doctors are made-up sample data.

```
client/   React (Vite) app. All React code is in one file: client/src/App.jsx (styles in styles.css)
server/   Express app, models, sample data, symptom rules
api/      Vercel function that runs the Express app for every /api/* request
```

## Deploy in 3 steps

### 1. Create a free database (MongoDB Atlas)
1. Sign up at https://www.mongodb.com/cloud/atlas and create a free **M0** cluster.
2. **Database Access** > Add New Database User. Choose a username and a password with only letters and numbers.
3. **Network Access** > Add IP Address > **Allow access from anywhere** (0.0.0.0/0). Vercel uses changing IP addresses, so this is required.
4. **Database** > Connect > Drivers. Copy the connection string and:
   - replace `<password>` with your password
   - add the database name before the `?`, so it looks like
     `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/smarthospital?retryWrites=true&w=majority`

### 2. Put the project on GitHub
Create a new GitHub repository and upload this folder (the `.gitignore` keeps `node_modules` out).

### 3. Deploy on Vercel
1. Go to https://vercel.com > Add New > Project and import the repository.
2. Leave the settings as they are (`vercel.json` already sets the build command and output folder).
3. Open **Environment Variables** and add `MONGODB_URI` with your connection string.
4. Click **Deploy**.

If you add or change `MONGODB_URI` after the first deploy, go to Deployments > Redeploy so it takes effect.

**Without GitHub:** install the Vercel CLI (`npm i -g vercel`), run `vercel` in this folder, then `vercel env add MONGODB_URI`, then `vercel --prod`.

## Check it works
- Open `https://YOUR-PROJECT.vercel.app/api/health`. You should see `{"ok":true}`.
- Open `https://YOUR-PROJECT.vercel.app`. The first visit takes a few seconds because the sample data is created in your database.

## Demo logins
- **Patient:** any 11-digit mobile number (for example 01712345678) and the code `1234`.
- **Hospital staff:** `staff@smarthospital.demo` and `demo1234`.

The login is a demo only (checked in the browser). Do not use real patient data.

## Run it on your computer
Install the Vercel CLI (`npm i -g vercel`), put `MONGODB_URI` in a `.env` file in this folder, and run `vercel dev`. This starts the React app and the `/api` function together.

## Notes
- The hospital dashboard and its `/api/admin/*` routes have no real login, and anyone can call "Reset demo data". This is fine for a demo with sample data. Before using real data, add server-side login (for example Firebase Authentication) and protect those routes.
- Sample appointment slots cover the next 7 days. When fewer than 3 days remain, the server refills them automatically, which also clears demo bookings. The dashboard also has a **Reset demo data** link.
- Dates and times use Bangladesh time (Asia/Dhaka).
- The map uses OpenStreetMap and the browser's location. Distances are straight-line.

## Troubleshooting
| You see | Fix |
|---|---|
| "The database is not connected yet" | `MONGODB_URI` is missing. Add it in Vercel and redeploy. |
| "Cannot reach the database" | Check the password in the connection string and that Atlas Network Access allows 0.0.0.0/0. |
| Build error "Could not resolve ./components/Nearby.jsx" | The file name must be `Nearby.jsx` with a capital N. Vercel is case-sensitive. |
| Blank page | Open the browser console (F12) and check for red errors. |
