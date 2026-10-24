import express from 'express';
import { Hospital, Doctor, Slot, Appointment } from './models.js';
import { seed, dhakaTodayStr } from './seed.js';
import { connectDb } from './db.js';
import { suggest } from './symptoms.js';

const app = express();
app.use(express.json());

// Simple check that the function is alive (does not touch the database).
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Connect to MongoDB before every other API route.
app.use('/api', async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: e.code === 'NO_URI'
        ? 'The database is not connected yet. Add MONGODB_URI (in the Vercel project settings, or in your .env file), then redeploy or restart.'
        : 'Cannot reach the database. Check the MongoDB Atlas connection string and Network Access settings.',
    });
  }
});

// Wrap async handlers so errors become clean JSON responses.
const h = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

// Mongo ids are 24 hex characters. Anything else would crash a query, so reject it early with a clean error.
const isId = (v) => /^[0-9a-f]{24}$/i.test(String(v || ''));

const withDetails = (q) => q.populate('doctor', 'name specialty').populate('hospital', 'name area');

async function doctorsWithOpenSlots(filter) {
  const doctors = await Doctor.find(filter).populate('hospital', 'name area location').lean();
  const counts = await Slot.aggregate([
    { $match: { doctor: { $in: doctors.map((d) => d._id) }, status: 'free', date: { $gte: dhakaTodayStr() } } },
    { $group: { _id: '$doctor', n: { $sum: 1 } } },
  ]);
  const open = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return doctors.map((d) => ({ ...d, openSlots: open[String(d._id)] || 0 }));
}

// ---------- Patient API ----------
app.get('/api/meta', h(async (req, res) => {
  const [hospitals, specialties] = await Promise.all([Hospital.find().lean(), Doctor.distinct('specialty')]);
  res.json({ hospitals, specialties: specialties.sort() });
}));

app.get('/api/doctors', h(async (req, res) => {
  const { q, specialty, hospital } = req.query;
  const filter = {};
  if (specialty) filter.specialty = String(specialty);
  if (hospital) {
    if (!isId(hospital)) return res.status(400).json({ error: 'Unknown hospital.' });
    filter.hospital = hospital;
  }
  let list = await doctorsWithOpenSlots(filter);
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter((d) => [d.name, d.specialty, d.hospital?.name, d.hospital?.area]
      .some((v) => v?.toLowerCase().includes(needle)));
  }
  res.json(list);
}));

app.get('/api/doctors/:id/slots', h(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Doctor not found.' });
  const slots = await Slot.find({ doctor: req.params.id, date: { $gte: dhakaTodayStr() } }).sort({ date: 1, time: 1 }).lean();
  res.json(slots);
}));

// Booking: the conditional update only succeeds for a slot that is still free,
// so two patients can never take the same slot (requirement FR-12 / NFR-11).
app.post('/api/appointments', h(async (req, res) => {
  const { slotId, patientName, phone } = req.body || {};
  if (!isId(slotId) || !patientName?.trim() || !/^01\d{9}$/.test(phone || '')) {
    return res.status(400).json({ error: 'Enter your name and a valid 11-digit mobile number, for example 01712345678.' });
  }
  const slot = await Slot.findOneAndUpdate({ _id: slotId, status: 'free', date: { $gte: dhakaTodayStr() } }, { status: 'booked' }, { new: true });
  if (!slot) return res.status(409).json({ error: 'Someone just booked this slot. Please choose another time.' });
  try {
    const doctor = await Doctor.findById(slot.doctor).lean();
    const appt = await Appointment.create({
      patientName: patientName.trim(), phone, doctor: slot.doctor, hospital: doctor.hospital,
      slot: slot._id, date: slot.date, time: slot.time, status: 'confirmed',
    });
    res.status(201).json(await withDetails(Appointment.findById(appt._id)).lean());
  } catch (e) {
    await Slot.updateOne({ _id: slot._id }, { status: 'free' });
    throw e;
  }
}));

app.get('/api/appointments', h(async (req, res) => {
  const { phone } = req.query;
  if (!/^01\d{9}$/.test(phone || '')) return res.status(400).json({ error: 'Enter the 11-digit mobile number you booked with.' });
  res.json(await withDetails(Appointment.find({ phone }).sort({ date: -1, time: -1 })).lean());
}));

app.patch('/api/appointments/:id/cancel', h(async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Appointment not found for this mobile number.' });
  if (!req.body?.phone) return res.status(400).json({ error: 'Enter the mobile number you booked with.' });
  const appt = await Appointment.findOne({ _id: req.params.id, phone: req.body?.phone });
  if (!appt) return res.status(404).json({ error: 'Appointment not found for this mobile number.' });
  if (appt.status !== 'confirmed') return res.status(400).json({ error: 'Only confirmed appointments can be cancelled.' });
  appt.status = 'cancelled';
  await appt.save();
  await Slot.updateOne({ _id: appt.slot }, { status: 'free' });
  res.json(await withDetails(Appointment.findById(appt._id)).lean());
}));

// ---------- Phase 2 preview: symptom checker ----------
app.post('/api/symptoms', h(async (req, res) => {
  const { specialties, emergency } = suggest(req.body?.text);
  const doctors = specialties.length
    ? await doctorsWithOpenSlots({ specialty: { $in: specialties.map((s) => s.specialty) } })
    : [];
  res.json({
    specialties, emergency, doctors,
    disclaimer: 'This is not a diagnosis. It only suggests which type of doctor to see.',
  });
}));

// ---------- Hospital dashboard API (no login in this demo) ----------
app.get('/api/admin/appointments', h(async (req, res) => {
  if (!isId(req.query.hospital)) return res.status(400).json({ error: 'Choose a hospital.' });
  const list = await withDetails(Appointment.find({ hospital: req.query.hospital }).sort({ date: 1, time: 1 })).lean();
  res.json(list);
}));

app.patch('/api/admin/appointments/:id', h(async (req, res) => {
  const { status } = req.body || {};
  if (!['rejected', 'completed', 'missed'].includes(status)) {
    return res.status(400).json({ error: 'Unknown status.' });
  }
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Appointment not found.' });
  // Only a confirmed appointment can be changed, so a cancelled or rejected one is never revived.
  const appt = await Appointment.findOneAndUpdate({ _id: req.params.id, status: 'confirmed' }, { status }, { new: true });
  if (!appt) return res.status(404).json({ error: 'Appointment not found, or it is no longer confirmed.' });
  if (status === 'rejected') await Slot.updateOne({ _id: appt.slot }, { status: 'free' });
  res.json(await withDetails(Appointment.findById(appt._id)).lean());
}));

app.get('/api/admin/stats', h(async (req, res) => {
  const hospital = req.query.hospital;
  if (!isId(hospital)) return res.status(400).json({ error: 'Choose a hospital.' });
  const doctors = await Doctor.find({ hospital }).lean();
  const ids = doctors.map((d) => d._id);
  const [slotsTotal, slotsBooked, appts] = await Promise.all([
    Slot.countDocuments({ doctor: { $in: ids } }),
    Slot.countDocuments({ doctor: { $in: ids }, status: 'booked' }),
    Appointment.find({ hospital }).lean(),
  ]);
  const specialtyOf = Object.fromEntries(doctors.map((d) => [String(d._id), d.specialty]));
  const byStatus = {};
  const bySpecialty = {};
  for (const a of appts) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    if (['confirmed', 'completed'].includes(a.status)) {
      const s = specialtyOf[String(a.doctor)];
      bySpecialty[s] = (bySpecialty[s] || 0) + 1;
    }
  }
  res.json({
    appointments: appts.length, slotsTotal, slotsBooked,
    fillRate: slotsTotal ? Math.round((slotsBooked / slotsTotal) * 100) : 0,
    byStatus, bySpecialty,
  });
}));

app.post('/api/admin/reset', h(async (req, res) => res.json(await seed())));

// Unknown API paths and bad JSON bodies get a JSON answer instead of an HTML error page.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(err.status || 500).json({ error: err.status === 400 ? 'The request could not be read.' : 'Something went wrong on the server. Please try again.' });
});

export default app;
