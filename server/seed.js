import { Hospital, Doctor, Slot, Appointment } from './models.js';

// All names below are made-up demo data. They are not real hospitals or doctors.
const HOSPITALS = [
  { name: 'Sample City Hospital', area: 'Dhanmondi, Dhaka', address: 'Road 27, Dhanmondi, Dhaka', phone: '01700-000001', website: 'https://example.com/city', location: { lat: 23.7461, lng: 90.3742 } },
  { name: 'Sample Heart & Medicine Centre', area: 'Gulshan, Dhaka', address: 'Avenue 2, Gulshan, Dhaka', phone: '01700-000002', website: 'https://example.com/heart', location: { lat: 23.7925, lng: 90.4078 } },
  { name: 'Sample Women & Child Clinic', area: 'Mirpur, Dhaka', address: 'Section 10, Mirpur, Dhaka', phone: '01700-000003', website: 'https://example.com/clinic', location: { lat: 23.8069, lng: 90.3687 } },
];

// h = hospital index, days = visiting days (0 = Sunday)
const DOCTORS = [
  { name: 'Dr. Demo Arman Hossain', specialty: 'Cardiology', qualifications: 'MBBS, MD (Cardiology)', fee: 1000, days: [0, 2, 4], h: 1 },
  { name: 'Dr. Demo Farzana Akter', specialty: 'Dermatology', qualifications: 'MBBS, DDV', fee: 800, days: [1, 3, 6], h: 0 },
  { name: 'Dr. Demo Kamal Uddin', specialty: 'Medicine', qualifications: 'MBBS, FCPS (Medicine)', fee: 700, days: [0, 1, 2, 3, 4], h: 0 },
  { name: 'Dr. Demo Sabrina Rahman', specialty: 'Pediatrics', qualifications: 'MBBS, DCH', fee: 800, days: [0, 2, 3], h: 2 },
  { name: 'Dr. Demo Nasreen Sultana', specialty: 'Gynecology', qualifications: 'MBBS, FCPS (Gynecology)', fee: 1000, days: [1, 3, 4], h: 2 },
  { name: 'Dr. Demo Imran Khan', specialty: 'Orthopedics', qualifications: 'MBBS, MS (Orthopedics)', fee: 900, days: [0, 3, 6], h: 0 },
  { name: 'Dr. Demo Tahmina Islam', specialty: 'ENT', qualifications: 'MBBS, DLO', fee: 700, days: [1, 2, 4], h: 1 },
  { name: 'Dr. Demo Rafiq Chowdhury', specialty: 'Neurology', qualifications: 'MBBS, MD (Neurology)', fee: 1200, days: [2, 4, 6], h: 1 },
  { name: 'Dr. Demo Shirin Parvin', specialty: 'Pediatrics', qualifications: 'MBBS, FCPS (Pediatrics)', fee: 900, days: [1, 4, 6], h: 0 },
  { name: 'Dr. Demo Mahbub Alam', specialty: 'Medicine', qualifications: 'MBBS, MD (Internal Medicine)', fee: 800, days: [0, 2, 3], h: 1 },
];

const TIMES = ['10:00', '10:30', '11:00', '11:30', '17:00', '17:30'];
const PATIENTS = ['Nusrat Jahan', 'Tanvir Ahmed', 'Mithila Das', 'Rakib Hasan', 'Sadia Afrin', 'Jahid Karim', 'Lamia Noor', 'Arif Mahmud'];

// Today's date in Bangladesh as YYYY-MM-DD (Vercel servers run in UTC).
export const dhakaTodayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
// Add whole days to a YYYY-MM-DD string.
export const addDays = (dateStr, n) => new Date(new Date(dateStr + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
const weekday = (dateStr) => new Date(dateStr + 'T00:00:00Z').getUTCDay(); // 0 = Sunday
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export async function seed() {
  await Promise.all([Hospital, Doctor, Slot, Appointment].map((m) => m.deleteMany({})));
  const hospitals = await Hospital.insertMany(HOSPITALS);
  const doctors = await Doctor.insertMany(DOCTORS.map((d) => ({
    name: d.name, specialty: d.specialty, qualifications: d.qualifications, fee: d.fee,
    visitingDays: d.days, hospital: hospitals[d.h]._id,
  })));

  const slots = [];
  for (const doc of doctors) {
    for (let i = 1; i <= 7; i++) {
      const date = addDays(dhakaTodayStr(), i);
      if (!doc.visitingDays.includes(weekday(date))) continue;
      for (const time of TIMES) {
        slots.push({ doctor: doc._id, date, time, status: Math.random() < 0.3 ? 'booked' : 'free' });
      }
    }
  }
  const created = await Slot.insertMany(slots);

  // Give every pre-booked slot a patient so the dashboard has realistic data.
  const byDoctor = Object.fromEntries(doctors.map((d) => [String(d._id), d]));
  const appointments = created.filter((s) => s.status === 'booked').map((s) => ({
    patientName: pick(PATIENTS),
    phone: '01' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'),
    doctor: s.doctor,
    hospital: byDoctor[String(s.doctor)].hospital,
    slot: s._id, date: s.date, time: s.time, status: 'confirmed',
  }));
  await Appointment.insertMany(appointments);
  return { hospitals: hospitals.length, doctors: doctors.length, slots: created.length, appointments: appointments.length };
}
