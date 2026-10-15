// Phase 2 preview: a simple rule-based mapping from symptom keywords to a specialty.
// It never diagnoses. In production, a doctor must review and own these rules.
const RULES = [
  { specialty: 'Cardiology', words: ['chest pain', 'palpitation', 'heart', 'বুকে ব্যথা'] },
  { specialty: 'Dermatology', words: ['rash', 'itch', 'skin', 'acne', 'চুলকানি'] },
  { specialty: 'Neurology', words: ['headache', 'migraine', 'dizzy', 'numb', 'মাথা ব্যথা'] },
  { specialty: 'Orthopedics', words: ['back pain', 'knee', 'joint', 'fracture', 'bone'] },
  { specialty: 'ENT', words: ['ear pain', 'sore throat', 'blocked nose', 'sinus', 'কান ব্যথা'] },
  { specialty: 'Pediatrics', words: ['baby', 'infant', 'newborn', 'my child'] },
  { specialty: 'Gynecology', words: ['pregnan', 'period', 'menstrual'] },
  { specialty: 'Medicine', words: ['fever', 'cough', 'cold', 'weakness', 'stomach pain', 'জ্বর', 'পেট ব্যথা'] },
];
const EMERGENCY = [
  'chest pain', 'difficulty breathing', 'shortness of breath', 'unconscious',
  'stroke', 'severe bleeding', 'শ্বাসকষ্ট', 'বুকে ব্যথা',
];

// English words must start at a word boundary ("rash" must not match "crash", "itch" must not match "switch").
// Bangla words are matched as plain text because \b does not work for Bangla script.
const has = (text, word) => (/^[\x00-\x7F]+$/.test(word)
  ? new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text)
  : text.includes(word));

export function suggest(text = '') {
  const t = String(text).toLowerCase();
  const specialties = RULES
    .map((r) => ({ specialty: r.specialty, matched: r.words.filter((w) => has(t, w)) }))
    .filter((r) => r.matched.length > 0);
  const emergency = EMERGENCY.some((w) => has(t, w));
  return { specialties, emergency };
}
