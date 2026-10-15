import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });

export const Hospital = model('Hospital', new Schema({
  name: String, area: String, address: String, phone: String, website: String,
  location: { lat: Number, lng: Number },
}));

export const Doctor = model('Doctor', new Schema({
  name: String, specialty: String, qualifications: String, fee: Number,
  visitingDays: [Number], // 0 = Sunday ... 6 = Saturday
  hospital: ref('Hospital'),
}));

const slotSchema = new Schema({
  doctor: { ...ref('Doctor'), index: true },
  date: String, // YYYY-MM-DD
  time: String, // HH:mm
  status: { type: String, enum: ['free', 'booked'], default: 'free' },
});
// One slot per doctor, date and time: the database itself blocks duplicates.
slotSchema.index({ doctor: 1, date: 1, time: 1 }, { unique: true });
export const Slot = model('Slot', slotSchema);

export const Appointment = model('Appointment', new Schema({
  patientName: String,
  phone: String,
  doctor: ref('Doctor'),
  hospital: ref('Hospital'),
  slot: ref('Slot'),
  date: String,
  time: String,
  status: { type: String, default: 'confirmed' }, // confirmed | completed | missed | rejected | cancelled
  createdAt: { type: Date, default: Date.now },
}));
