// Smart Hospital: the whole React client in one file.
// Sections: imports, helpers, API, icons, components, App, render.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';

/* ================= Helpers ================= */

const fmtTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
const fmtDate = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// Straight-line distance in km between two points (haversine formula).
function km(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// localStorage can be blocked (private mode, strict browser settings), so never let it crash the app.
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

/* ================= API ================= */

async function call(path, options = {}) {
  const res = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
const body = (obj) => JSON.stringify(obj);

const api = {
  meta: () => call('/meta'),
  doctors: (params) => call('/doctors?' + new URLSearchParams(params)),
  slots: (doctorId) => call(`/doctors/${doctorId}/slots`),
  book: (data) => call('/appointments', { method: 'POST', body: body(data) }),
  myAppointments: (phone) => call('/appointments?phone=' + encodeURIComponent(phone)),
  cancel: (id, phone) => call(`/appointments/${id}/cancel`, { method: 'PATCH', body: body({ phone }) }),
  symptoms: (text) => call('/symptoms', { method: 'POST', body: body({ text }) }),
  adminAppointments: (hospital) => call('/admin/appointments?hospital=' + hospital),
  setStatus: (id, status) => call(`/admin/appointments/${id}`, { method: 'PATCH', body: body({ status }) }),
  stats: (hospital) => call('/admin/stats?hospital=' + hospital),
  reset: () => call('/admin/reset', { method: 'POST' }),
};

/* ================= Icons ================= */

const Svg = ({ children, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const SearchIcon = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
const CalendarIcon = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
const DashboardIcon = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Svg>
);
const PulseIcon = (p) => <Svg {...p}><path d="M3 12h4l2-6 4 12 2-6h6" /></Svg>;
const UserIcon = (p) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
const PinIcon = (p) => <Svg {...p}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></Svg>;
const LogoutIcon = (p) => <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></Svg>;

const LogoMark = ({ size = 40 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} role="img" aria-label="Smart Hospital logo">
    <rect width="40" height="40" rx="10" fill="#0b7f6c" />
    <path d="M17 9h6v8h8v6h-8v8h-6v-8H9v-6h8z" fill="#fff" />
  </svg>
);

/* ================= Login ================= */

// DEMO ONLY: the login is checked in the browser. The real product will use
// phone OTP through a server or Firebase Authentication.
const DEMO_STAFF = { email: 'staff@smarthospital.demo', password: 'demo1234' };
const DEMO_OTP = '1234';

function Login({ onLogin }) {
  const [role, setRole] = useState('patient');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    setError('');
    if (role === 'patient') {
      if (!/^01\d{9}$/.test(mobile.trim())) return setError('Enter a valid 11-digit mobile number, for example 01712345678.');
      if (otp.trim() !== DEMO_OTP) return setError(`Wrong code. In this demo the code is ${DEMO_OTP}.`);
      onLogin({ role: 'patient', phone: mobile.trim() });
    } else {
      if (email.trim().toLowerCase() !== DEMO_STAFF.email || password !== DEMO_STAFF.password) {
        return setError('Wrong email or password. Use the demo login shown below the form.');
      }
      onLogin({ role: 'staff', email: DEMO_STAFF.email });
    }
  }

  function fillDemo() {
    setError('');
    if (role === 'patient') { setMobile('01712345678'); setOtp(DEMO_OTP); }
    else { setEmail(DEMO_STAFF.email); setPassword(DEMO_STAFF.password); }
  }

  return (
    <div className="login">
      <section className="login-brand">
        <LogoMark size={64} />
        <h1>Smart Hospital</h1>
        <p lang="bn">স্মার্ট হাসপাতাল</p>
        <p>Every hospital in one app. Find a doctor and book a slot in a minute.</p>
      </section>
      <form className="login-card" onSubmit={submit}>
        <h2>Log in</h2>
        <div className="seg">
          <button type="button" className={role === 'patient' ? 'on' : ''} onClick={() => { setRole('patient'); setError(''); }}>Patient</button>
          <button type="button" className={role === 'staff' ? 'on' : ''} onClick={() => { setRole('staff'); setError(''); }}>Hospital staff</button>
        </div>
        {role === 'patient' ? (
          <>
            <label>Mobile number
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="01712345678" inputMode="numeric" autoComplete="tel" />
            </label>
            <label>One-time code (OTP)
              <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="4-digit code" inputMode="numeric" />
            </label>
          </>
        ) : (
          <>
            <label>Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </label>
            <label>Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
          </>
        )}
        {error && <p className="alert" role="alert">{error}</p>}
        <button className="primary wide">Log in</button>
        <p className="muted hint">
          Demo login: {role === 'patient' ? `any 11-digit mobile number and code ${DEMO_OTP}` : `${DEMO_STAFF.email} and ${DEMO_STAFF.password}`}.{' '}
          <button type="button" className="link" onClick={fillDemo}>Fill it in for me</button>
        </p>
      </form>
    </div>
  );
}

/* ================= Doctor card ================= */

function DoctorCard({ doctor, onBook, loc }) {
  const spot = doctor.hospital?.location;
  const away = loc && spot ? km(loc, spot) : null;
  return (
    <article className="doc">
      <div>
        <h3>{doctor.name}</h3>
        <p className="spec">{doctor.specialty}</p>
        <p className="muted">{doctor.qualifications}</p>
        <p className="muted">{doctor.hospital?.name}, {doctor.hospital?.area}</p>
        {away !== null && <p className="away"><PinIcon size={16} /> {away.toFixed(1)} km away</p>}
      </div>
      <div className="doc-side">
        <p className="fee">৳{doctor.fee}</p>
        <p className={doctor.openSlots ? 'open' : 'muted'}>
          {doctor.openSlots ? `${doctor.openSlots} open slots this week` : 'No open slots this week'}
        </p>
        <button className="primary" disabled={!doctor.openSlots} onClick={() => onBook(doctor)}>Book a slot</button>
      </div>
    </article>
  );
}

/* ================= Find a doctor ================= */

const FROM = { gps: 'your location', map: 'the point you chose on the map', default: 'central Dhaka' };

function Search({ meta, onBook, location, initialHospital }) {
  const [q, setQ] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [hospital, setHospital] = useState(initialHospital || '');
  const [sort, setSort] = useState('best');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const { loc, locate, message } = location;

  useEffect(() => {
    let stale = false; // ignore answers that arrive after a newer search was started
    const t = setTimeout(() => {
      api.doctors({ q, specialty, hospital })
        .then((d) => { if (!stale) { setList(d); setError(''); } })
        .catch((e) => { if (!stale) setError(e.message); });
    }, 200);
    return () => { stale = true; clearTimeout(t); };
  }, [q, specialty, hospital]);

  const shown = useMemo(() => {
    if (!list || sort !== 'nearest') return list;
    const away = (d) => (d.hospital?.location ? km(loc, d.hospital.location) : Infinity);
    return [...list].sort((a, b) => away(a) - away(b));
  }, [list, sort, loc]);

  return (
    <section>
      <div className="intro">
        <h1>Find the right doctor and book a slot in a minute</h1>
        <p>Search every hospital in one place, see real availability, and skip the hotline.</p>
      </div>
      <div className="filters">
        <label>Search
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Doctor, specialty or area" />
        </label>
        <label>Specialty
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value="">All specialties</option>
            {meta.specialties.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Hospital
          <select value={hospital} onChange={(e) => setHospital(e.target.value)}>
            <option value="">All hospitals</option>
            {meta.hospitals.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
        </label>
        <label>Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="best">Best match</option>
            <option value="nearest">Nearest first</option>
          </select>
        </label>
      </div>
      <p className="muted">
        Distances are measured from {FROM[loc.source]}.{' '}
        <button className="link" onClick={locate}><PinIcon size={16} /> Use my location</button>
      </p>
      {message && <p className="alert" role="alert">{message}</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      {shown && shown.length === 0 && <p className="empty">No doctors match. Clear a filter or try another spelling.</p>}
      <div className="stack">
        {shown?.map((d) => <DoctorCard key={d._id} doctor={d} onBook={onBook} loc={loc} />)}
      </div>
    </section>
  );
}

/* ================= My appointments ================= */

function Appointments({ phone, onPhone }) {
  const [input, setInput] = useState(phone);
  const [loadedPhone, setLoadedPhone] = useState(phone); // the number the list below belongs to
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  const load = (p) => {
    setError('');
    setLoadedPhone(p);
    return api.myAppointments(p).then(setList).catch((e) => { setList(null); setError(e.message); });
  };
  useEffect(() => { if (phone) load(phone); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel(id) {
    try { await api.cancel(id, loadedPhone); await load(loadedPhone); } catch (e) { setError(e.message); }
  }

  return (
    <section>
      <h1>My appointments</h1>
      <form className="inline" onSubmit={(e) => { e.preventDefault(); const p = input.trim(); onPhone(p); load(p); }}>
        <label>Mobile number you booked with
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="01712345678" inputMode="numeric" />
        </label>
        <button className="primary">Show appointments</button>
      </form>
      {error && <p className="alert" role="alert">{error}</p>}
      {list && list.length === 0 && <p className="empty">No appointments for this number yet. Find a doctor to book one.</p>}
      <div className="stack">
        {list?.map((a) => (
          <article className="doc" key={a._id}>
            <div>
              <h3>{a.doctor?.name || 'Doctor no longer listed'}</h3>
              <p className="spec">{a.doctor?.specialty}</p>
              <p className="muted">{a.hospital?.name}{a.hospital?.area ? `, ${a.hospital.area}` : ''}</p>
              <p className="when">{fmtDate(a.date)} at {fmtTime(a.time)}</p>
            </div>
            <div className="doc-side">
              <span className={'status ' + a.status}>{a.status}</span>
              {a.status === 'confirmed' && <button onClick={() => cancel(a._id)}>Cancel appointment</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ================= Booking popup ================= */

function BookingModal({ doctor, phone, onClose, onBooked, onViewMine }) {
  const [slots, setSlots] = useState(null);
  const [day, setDay] = useState(null);
  const [slotId, setSlotId] = useState(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState(phone || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const load = () => api.slots(doctor._id).then((s) => { setSlots(s); setDay((d) => d ?? s[0]?.date ?? null); });
  useEffect(() => { load().catch((e) => setError(e.message)); }, [doctor._id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const days = useMemo(() => [...new Set((slots || []).map((s) => s.date))], [slots]);
  const daySlots = (slots || []).filter((s) => s.date === day);
  const chosen = (slots || []).find((s) => s._id === slotId);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      const appt = await api.book({ slotId, patientName: name, phone: mobile.trim() });
      onBooked(mobile.trim());
      setDone(appt);
    } catch (e) {
      setError(e.message);
      setSlotId(null);
      await load().catch(() => {}); // refresh so a slot someone else just took shows as booked
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Book ${doctor.name}`} onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        {done ? (
          <div className="done">
            <h2>Your appointment is confirmed</h2>
            <p><strong>{done.doctor?.name}</strong>, {done.doctor?.specialty}</p>
            <p>{done.hospital?.name}, {done.hospital?.area}</p>
            <p className="when">{fmtDate(done.date)} at {fmtTime(done.time)}</p>
            <p className="muted">Booked for {done.patientName} ({done.phone})</p>
            <div className="row">
              <button className="primary" onClick={onViewMine}>View my appointments</button>
              <button onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <>
            <h2>{doctor.name}</h2>
            <p className="muted">{doctor.specialty}, {doctor.hospital?.name}. Fee ৳{doctor.fee}</p>
            {slots === null && !error && <p className="muted">Loading available times…</p>}
            <h3>Choose a day</h3>
            <div className="chips">
              {days.map((d) => (
                <button key={d} className={'day' + (d === day ? ' on' : '')} onClick={() => { setDay(d); setSlotId(null); }}>{fmtDate(d)}</button>
              ))}
            </div>
            <h3>Choose a time</h3>
            <div className="chips">
              {daySlots.map((s) => (
                <button
                  key={s._id}
                  className={'slot' + (s._id === slotId ? ' on' : '') + (s.status === 'booked' ? ' taken' : '')}
                  disabled={s.status === 'booked'}
                  aria-pressed={s._id === slotId}
                  onClick={() => setSlotId(s._id)}
                >
                  {fmtTime(s.time)}{s.status === 'booked' && <small>Booked</small>}
                </button>
              ))}
            </div>
            <div className="form">
              <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
              <label>Mobile number<input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="01712345678" inputMode="numeric" autoComplete="tel" /></label>
            </div>
            {error && <p className="alert" role="alert">{error}</p>}
            <button className="primary wide" disabled={!chosen || busy} onClick={confirm}>
              {busy ? 'Booking…' : chosen ? `Confirm ${fmtDate(chosen.date)} at ${fmtTime(chosen.time)}` : 'Pick a time to continue'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ================= Hospital dashboard ================= */

function Dashboard({ meta, onReload }) {
  const [hospital, setHospital] = useState(meta.hospitals[0]?._id);
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = () =>
    Promise.all([api.stats(hospital), api.adminAppointments(hospital)])
      .then(([s, r]) => { setStats(s); setRows(r); setError(''); })
      .catch((e) => setError(e.message));
  useEffect(() => { if (hospital) load(); }, [hospital]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(id, status) {
    try { await api.setStatus(id, status); await load(); } catch (e) { setError(e.message); }
  }
  async function reset() {
    if (!window.confirm('Reset all demo data? Bookings made during the demo will be removed.')) return;
    try {
      await api.reset();
      // Resetting creates brand-new hospital records, so pick up the new ones and keep the same hospital selected.
      const keepName = meta.hospitals.find((h) => h._id === hospital)?.name;
      const fresh = await onReload();
      const next = fresh?.hospitals.find((h) => h.name === keepName) || fresh?.hospitals[0];
      if (next && next._id !== hospital) setHospital(next._id);
      else await load();
    } catch (e) { setError(e.message); }
  }

  const bars = Object.entries(stats?.bySpecialty || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...bars.map(([, n]) => n));

  return (
    <section>
      <div className="row between">
        <h1>Hospital dashboard</h1>
        <label className="compact">Hospital
          <select value={hospital} onChange={(e) => setHospital(e.target.value)}>
            {meta.hospitals.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {stats && (
        <>
          <div className="stats">
            <div><b>{stats.appointments}</b><span>Appointments</span></div>
            <div><b>{stats.fillRate}%</b><span>Slots filled ({stats.slotsBooked} of {stats.slotsTotal})</span></div>
            <div><b>{stats.byStatus.completed || 0}</b><span>Completed</span></div>
            <div><b>{(stats.byStatus.cancelled || 0) + (stats.byStatus.missed || 0)}</b><span>Cancelled or missed</span></div>
          </div>
          <div className="panel">
            <h2>Bookings by specialty</h2>
            {bars.length === 0 && <p className="muted">No bookings yet.</p>}
            {bars.map(([name, n]) => (
              <div className="bar" key={name}>
                <span>{name}</span>
                <div><i style={{ width: `${(n / max) * 100}%` }} /></div>
                <b>{n}</b>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="panel">
        <h2>Appointments</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Patient</th><th>Doctor</th><th>Date and time</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows?.map((a) => (
                <tr key={a._id}>
                  <td>{a.patientName}<small>{a.phone}</small></td>
                  <td>{a.doctor?.name}<small>{a.doctor?.specialty}</small></td>
                  <td>{fmtDate(a.date)}<small>{fmtTime(a.time)}</small></td>
                  <td><span className={'status ' + a.status}>{a.status}</span></td>
                  <td className="actions">
                    {a.status === 'confirmed' && (
                      <>
                        <button onClick={() => act(a._id, 'completed')}>Mark completed</button>
                        <button onClick={() => act(a._id, 'missed')}>Mark missed</button>
                        <button onClick={() => act(a._id, 'rejected')}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows && rows.length === 0 && <p className="empty">No appointments for this hospital yet.</p>}
        </div>
      </div>
      <button className="link" onClick={reset}>Reset demo data</button>
    </section>
  );
}

/* ================= Symptom checker ================= */

const EXAMPLES = ['fever and cough', 'skin rash and itch', 'headache and feeling dizzy', 'বুকে ব্যথা', 'my child has a fever'];

function Symptoms({ onBook, loc }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(value) {
    if (!value.trim()) return;
    setError('');
    setBusy(true);
    try { setResult(await api.symptoms(value)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <section>
      <h1>Which doctor should I see?</h1>
      <p className="muted">Phase 2 preview. Describe how you feel in English or Bangla, and we suggest the type of doctor to see.</p>
      <form className="inline" onSubmit={(e) => { e.preventDefault(); run(text); }}>
        <label>Your symptoms
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: fever and cough" />
        </label>
        <button className="primary" disabled={busy || !text.trim()}>{busy ? 'Checking…' : 'Suggest a specialty'}</button>
      </form>
      <div className="chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="day" lang={/[^\x00-\x7F]/.test(ex) ? 'bn' : 'en'} onClick={() => { setText(ex); run(ex); }}>{ex}</button>
        ))}
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {result && (
        <>
          {result.emergency && (
            <p className="alert strong" role="alert">
              These symptoms can be serious. Call 999 or go to the nearest emergency department now. Do not wait for an appointment.
            </p>
          )}
          {result.specialties.length === 0 ? (
            <p className="empty">We could not match those symptoms. Try describing them in a few more words, or book a General Medicine doctor.</p>
          ) : (
            <>
              <h2>Suggested: {result.specialties.map((s) => s.specialty).join(', ')}</h2>
              <div className="stack">
                {result.doctors.map((d) => <DoctorCard key={d._id} doctor={d} onBook={onBook} loc={loc} />)}
              </div>
            </>
          )}
          <p className="disclaimer">{result.disclaimer}</p>
        </>
      )}
    </section>
  );
}

/* ================= Nearby hospitals (map) ================= */

const WHERE = {
  gps: 'Using your device location.',
  map: 'Using the point you tapped on the map.',
  default: 'Showing central Dhaka. Use your location or tap the map to change it.',
};

function Nearby({ meta, location, onSeeDoctors }) {
  const { loc: me, setLoc, locate, message } = location;
  const mapEl = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  const hospitals = useMemo(
    () => meta.hospitals
      .filter((h) => h.location)
      .map((h) => ({ ...h, distance: km(me, h.location) }))
      .sort((a, b) => a.distance - b.distance),
    [meta, me],
  );

  // Create the map once.
  useEffect(() => {
    map.current = L.map(mapEl.current).setView([me.lat, me.lng], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    // Tapping the map sets "where I am" (manual location, FR-24).
    map.current.on('click', (e) => setLoc({ lat: e.latlng.lat, lng: e.latlng.lng, source: 'map' }));
    return () => map.current.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw markers whenever the location changes.
  useEffect(() => {
    layer.current.clearLayers();
    L.circleMarker([me.lat, me.lng], { radius: 9, color: '#b85c0c', fillColor: '#b85c0c', fillOpacity: 0.9 })
      .bindTooltip('You are here').addTo(layer.current);
    hospitals.forEach((h, i) => {
      L.circleMarker([h.location.lat, h.location.lng], {
        radius: 11, weight: 3, color: '#0b7f6c', fillColor: i === 0 ? '#0b7f6c' : '#ffffff', fillOpacity: 1,
      }).bindTooltip(`${h.name}, ${h.distance.toFixed(1)} km`).addTo(layer.current);
    });
    const points = [[me.lat, me.lng], ...hospitals.map((h) => [h.location.lat, h.location.lng])];
    map.current.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
  }, [me, hospitals]);

  return (
    <section>
      <h1>Hospitals near you</h1>
      <p className="muted">Phase 2 preview. {WHERE[me.source]}</p>
      <div className="row">
        <button className="primary" onClick={locate}><PinIcon size={18} /> Use my location</button>
      </div>
      {message && <p className="alert" role="alert">{message}</p>}
      <div className="map" ref={mapEl} />
      <div className="stack">
        {hospitals.map((h, i) => (
          <article className="doc" key={h._id}>
            <div>
              <h3>{h.name}{i === 0 && <span className="status"> Nearest</span>}</h3>
              <p className="muted">{h.address}</p>
              <p className="muted">{h.phone}</p>
            </div>
            <div className="doc-side">
              <p className="fee">{h.distance.toFixed(1)} km</p>
              <button className="primary" onClick={() => onSeeDoctors(h._id)}>See doctors</button>
              <a className="button-link" target="_blank" rel="noopener noreferrer"
                href={`https://www.google.com/maps/dir/?api=1&destination=${h.location.lat},${h.location.lng}`}>
                Get directions
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ================= App ================= */

// Which menu items each role can see (this is the "roles" requirement, FR-3).
const NAV = {
  patient: [
    ['find', 'Find a doctor', SearchIcon],
    ['mine', 'My appointments', CalendarIcon],
    ['symptoms', 'Symptoms', PulseIcon],
    ['nearby', 'Nearby', PinIcon],
  ],
  staff: [['dash', 'Dashboard', DashboardIcon]],
};

const USER_KEY = 'sh-user';
function savedUser() {
  const u = store.get(USER_KEY);
  return u && NAV[u.role] ? u : null; // ignore anything that is not a valid saved login
}

export default function App() {
  const [user, setUser] = useState(savedUser);
  const [tab, setTab] = useState(() => (savedUser()?.role === 'staff' ? 'dash' : 'symptoms'));
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  const [phone, setPhone] = useState(() => savedUser()?.phone || '');
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [loc, setLoc] = useState({ lat: 23.8103, lng: 90.4125, source: 'default' });
  const [locMessage, setLocMessage] = useState('');

  function locate() {
    if (!navigator.geolocation) return setLocMessage('Your browser cannot share its location. Open Nearby and tap the map to set where you are.');
    setLocMessage('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' }); setLocMessage(''); },
      () => setLocMessage('Location access was blocked. Open Nearby and tap the map to set where you are.'),
      { timeout: 10000 },
    );
  }
  const location = { loc, setLoc, locate, message: locMessage };

  // Load hospitals and specialties. Shows the server's own message (for example "database is not connected").
  const loadMeta = () =>
    api.meta()
      .then((m) => { setMeta(m); setError(''); return m; })
      .catch((e) => { setError(e.message || 'Cannot reach the server. Check your connection and refresh.'); return null; });

  useEffect(() => { if (user) loadMeta(); }, [user]);

  function login(u) {
    store.set(USER_KEY, u);
    setUser(u);
    setPhone(u.phone || '');
    setTab(u.role === 'staff' ? 'dash' : 'symptoms');
  }
  function logout() {
    store.remove(USER_KEY);
    setUser(null);
    setMeta(null);
    setError('');
    setBooking(null);
  }

  if (!user) return <Login onLogin={login} />;

  const who = user.role === 'staff' ? 'Hospital staff' : user.phone;

  return (
    <div className="app">
      <aside className="side">
        <div className="logo" title="Smart Hospital"><LogoMark size={40} /></div>
        <nav aria-label="Main">
          {NAV[user.role].map(([id, label, Icon]) => (
            <button key={id} title={label} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); if (id === 'find') setHospitalFilter(''); }}>
              <Icon /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who" title={who}><UserIcon /><span>{user.role === 'staff' ? 'Staff' : 'Patient'}</span></div>
          <button title="Log out" onClick={logout}><LogoutIcon /><span>Log out</span></button>
        </div>
      </aside>
      <div className="content">
        <p className="demo-note">Demo with sample hospitals and doctors. No real patient data is used.</p>
        <main>
          {error && (
            <p className="alert" role="alert">
              {error} <button className="link" onClick={loadMeta}>Try again</button>
            </p>
          )}
          {!meta && !error && <p className="muted">Loading… the first visit can take a few seconds while sample data is created.</p>}
          {meta && tab === 'find' && <Search key={hospitalFilter} meta={meta} onBook={setBooking} location={location} initialHospital={hospitalFilter} />}
          {meta && tab === 'mine' && <Appointments phone={phone} onPhone={setPhone} />}
          {meta && tab === 'dash' && <Dashboard meta={meta} onReload={loadMeta} />}
          {meta && tab === 'symptoms' && <Symptoms onBook={setBooking} loc={loc} />}
          {meta && tab === 'nearby' && <Nearby meta={meta} location={location} onSeeDoctors={(id) => { setHospitalFilter(id); setTab('find'); }} />}
        </main>
      </div>
      {booking && (
        <BookingModal
          doctor={booking}
          phone={phone}
          onClose={() => setBooking(null)}
          onBooked={setPhone}
          onViewMine={() => { setBooking(null); setTab('mine'); }}
        />
      )}
    </div>
  );
}

/* ================= Start the app ================= */

createRoot(document.getElementById('root')).render(<App />);
