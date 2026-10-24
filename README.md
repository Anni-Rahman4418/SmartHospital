# Smart Hospital

Every hospital in one app. Patients search doctors across hospitals, see real availability and book a slot in a minute. Hospital staff manage the bookings from a dashboard.

> **This is a demo.** All hospitals and doctors are made-up sample data. Do not enter real patient information.

## Features

**For patients**
- Find a doctor by name, specialty, hospital or area, and sort by nearest
- Book a day and time slot (two patients can never take the same slot)
- See and cancel your appointments using your mobile number
- Symptom checker (English and Bangla) that suggests which type of doctor to see, with an emergency warning for serious symptoms
- Nearby hospitals on a map (OpenStreetMap), using your location or a tapped point, with directions

**For hospital staff**
- Dashboard with appointment counts, slot fill rate and bookings by specialty
- Mark appointments completed, missed or rejected (a rejected appointment frees the slot)
- Reset the demo data

## Tech stack

| Part | Technology |
|---|---|
| Client | React 18, Vite, Leaflet (maps) |
| Server | Node.js, Express |
| Database | MongoDB with Mongoose (MongoDB Atlas in production) |
| Hosting | Vercel (the Express app runs as one serverless function) |

## Project structure

```
client/
  index.html
  src/App.jsx        The whole React app in one file (helpers, API calls, icons, all screens)
  src/styles.css     All styles
server/
  app.js             Express routes (patient API and staff API)
  models.js          Hospital, Doctor, Slot and Appointment models
  seed.js            Sample hospitals, doctors and slots
  symptoms.js        Rule-based symptom to specialty matching
  db.js              MongoDB connection (reused between requests on Vercel)
  dev.js             Local API server for development only
api/index.js          Vercel function that runs the Express app for every /api/* request (vercel.json rewrites /api/* to it)
.devcontainer/       GitHub Codespaces setup (includes its own MongoDB)
vercel.json          Build command and output folder for Vercel
```

## Run it

### Option 1: GitHub Codespaces (easiest, no database setup)
1. Put this folder in a GitHub repository.
2. Click **Code > Codespaces > Create codespace on main**.
3. Wait for the setup to finish, then open port **5173** from the **Ports** tab.

The Codespace starts its own MongoDB and runs `npm run dev` for you.

### Option 2: On your computer
You need Node.js 18 or newer and a MongoDB database (local, or a free Atlas cluster).

```bash
npm install
npm install --prefix client
echo "MONGODB_URI=mongodb://localhost:27017/smarthospital" > .env
npm run dev
```

Open http://localhost:5173. `npm run dev` starts the API (port 3001) and the React app (port 5173) together, and Vite forwards `/api` requests to the API.

### Option 3: Deploy on Vercel

**1. Create a free database (MongoDB Atlas)**
1. Sign up at https://www.mongodb.com/cloud/atlas and create a free **M0** cluster.
2. **Database Access** > Add New Database User. Use a password with only letters and numbers.
3. **Network Access** > Add IP Address > **Allow access from anywhere** (0.0.0.0/0). Vercel uses changing IP addresses, so this is required.
4. **Database** > Connect > Drivers. Copy the connection string, replace `<password>`, and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/smarthospital?retryWrites=true&w=majority`

**2. Put the project on GitHub.** Create a repository and upload this folder (`.gitignore` keeps `node_modules` out).

**3. Deploy**
1. Go to https://vercel.com > Add New > Project and import the repository.
2. Leave the settings as they are (`vercel.json` already sets them).
3. Add the environment variable `MONGODB_URI` with your connection string.
4. Click **Deploy**.

If you add or change `MONGODB_URI` later, go to Deployments > Redeploy.

**Check it works:** open `https://YOUR-PROJECT.vercel.app/api/health` (you should see `{"ok":true}`), then open the site. The first visit takes a few seconds because the sample data is created.

## Environment variables

| Name | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string, including the database name |

## Demo logins

| Role | Login |
|---|---|
| Patient | Any 11-digit mobile number starting with 01 (for example `01712345678`) and the code `1234` |
| Hospital staff | `staff@smarthospital.demo` and `demo1234` |

The login is checked in the browser. It is for the demo only.

## API

All routes start with `/api`.

| Method and path | What it does |
|---|---|
| `GET /health` | Checks the function is running (no database needed) |
| `GET /meta` | Hospitals and specialties |
| `GET /doctors?q=&specialty=&hospital=` | Search doctors, with the number of open slots |
| `GET /doctors/:id/slots` | A doctor's upcoming slots |
| `POST /appointments` | Book a slot (`slotId`, `patientName`, `phone`) |
| `GET /appointments?phone=` | Appointments for a mobile number |
| `PATCH /appointments/:id/cancel` | Cancel an appointment (`phone`) |
| `POST /symptoms` | Suggest specialties and doctors for a symptom text |
| `GET /admin/appointments?hospital=` | Staff: appointments for a hospital |
| `PATCH /admin/appointments/:id` | Staff: set status to `completed`, `missed` or `rejected` |
| `GET /admin/stats?hospital=` | Staff: dashboard numbers |
| `POST /admin/reset` | Staff: delete and recreate all sample data |

## How it works

- **No double booking.** Booking uses one conditional database update that only succeeds if the slot is still free. A unique index on doctor, date and time also blocks duplicate slots.
- **Sample slots.** Each doctor gets slots for the next 7 days on their visiting days. When the slots are about to run out, the server recreates them, which also clears demo bookings.
- **Time zone.** Dates and times use Bangladesh time (Asia/Dhaka), even though Vercel servers run in UTC.
- **Symptom checker.** It matches keywords to a specialty. It never diagnoses, and a doctor must review the rules before any real use.
- **Distances** are straight-line, measured from your device location or the point you tap on the map.

## Known limits (demo only)

- The staff dashboard and `/api/admin/*` routes have no server-side login, and anyone can call reset.
- Anyone who knows a mobile number can view or cancel its appointments (no real OTP).
- Do not use real patient data. Before real use, add server-side authentication (for example phone OTP or Firebase Authentication) and protect the admin routes.

## Troubleshooting

| You see | Fix |
|---|---|
| "The database is not connected yet" | `MONGODB_URI` is missing. Add it in Vercel (then redeploy) or in your `.env` file (then restart). |
| "Cannot reach the database" | Check the password in the connection string and that Atlas Network Access allows 0.0.0.0/0. |
| Blank page | Open the browser console (F12) and look for red errors. |
| Map is empty | The map tiles need an internet connection to OpenStreetMap. |
| Codespace page does not open | Open the **Ports** tab and click the link for port 5173. If the app is not running, run `npm run dev` in the terminal. |
