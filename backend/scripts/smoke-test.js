const BASE = process.env.API_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

function assertStatus(response, expected, label) {
  assert(
    response.status === expected,
    `${label}: expected ${expected}, got ${response.status} (${JSON.stringify(response.body)})`
  );
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let parsed = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  return { status: response.status, body: parsed };
}

async function login(email, password) {
  const response = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  assertStatus(response, 200, `login ${email}`);
  assert(response.body.data && response.body.data.token, `login ${email}: missing token`);
  return response.body.data.token;
}

async function run() {
  const health = await api('/health');
  assertStatus(health, 200, 'GET /health');
  assert(health.body.data.database === 'up', 'health: database should be up');

  const noToken = await api('/api/users');
  assertStatus(noToken, 401, 'GET /api/users without token');

  const badToken = await api('/api/auth/me', { token: 'not-a-real-token' });
  assertStatus(badToken, 401, 'GET /api/auth/me with invalid token');

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@clinic.local', password: 'wrong-password' }
  });
  assertStatus(badLogin, 401, 'login with wrong password');

  const injectionLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: "' OR 1=1 --", password: 'anything' }
  });
  assert(
    injectionLogin.status === 400 || injectionLogin.status === 401,
    `SQL injection login should be rejected, got ${injectionLogin.status}`
  );

  const adminToken = await login('admin@clinic.local', 'Admin@123');
  const doctor1Token = await login('doctor1@clinic.local', 'Doctor@123');
  const doctor2Token = await login('doctor2@clinic.local', 'Doctor@123');
  const patient1Token = await login('patient1@clinic.local', 'Patient@123');
  const patient2Token = await login('patient2@clinic.local', 'Patient@123');
  const patient3Token = await login('patient3@clinic.local', 'Patient@123');
  const patient4Token = await login('patient4@clinic.local', 'Patient@123');

  const me = await api('/api/auth/me', { token: adminToken });
  assertStatus(me, 200, 'GET /api/auth/me admin');
  assert(me.body.data.user.role === 'admin', 'admin role mismatch');

  const users = await api('/api/users', { token: adminToken });
  assertStatus(users, 200, 'GET /api/users admin');
  assert(Array.isArray(users.body.data) && users.body.data.length >= 7, 'admin users list too short');

  const patientUsers = await api('/api/users', { token: patient1Token });
  assertStatus(patientUsers, 403, 'GET /api/users as patient');

  const doctorUsers = await api('/api/users', { token: doctor1Token });
  assertStatus(doctorUsers, 403, 'GET /api/users as doctor');

  const auditLogs = await api('/api/audit-logs', { token: adminToken });
  assertStatus(auditLogs, 200, 'GET /api/audit-logs admin');
  assert(Array.isArray(auditLogs.body.data) && auditLogs.body.data.length > 0, 'audit logs empty');

  const adminRecords = await api('/api/records', { token: adminToken });
  assertStatus(adminRecords, 403, 'admin cannot list clinical records');

  const patient1Records = await api('/api/records', { token: patient1Token });
  assertStatus(patient1Records, 200, 'patient1 lists own records');
  assert(patient1Records.body.data.length >= 1, 'patient1 should have records');
  assert(
    patient1Records.body.data.every((record) => record.patient_name === 'Nguyễn Văn An'),
    'patient1 record list leaked another patient'
  );

  const patient2Record1 = await api('/api/records/1', { token: patient2Token });
  assertStatus(patient2Record1, 403, 'patient2 cannot read patient1 record');

  const doctor2Record1 = await api('/api/records/1', { token: doctor2Token });
  assertStatus(doctor2Record1, 403, 'doctor2 cannot read doctor1 record');

  const doctor1Record1 = await api('/api/records/1', { token: doctor1Token });
  assertStatus(doctor1Record1, 200, 'doctor1 reads own record');

  const adminRecord1 = await api('/api/records/1', { token: adminToken });
  assertStatus(adminRecord1, 403, 'admin cannot read clinical record by default');

  const patient2Profile = await api('/api/patients/2', { token: patient1Token });
  assertStatus(patient2Profile, 403, 'patient1 cannot read patient2 profile');

  const doctor1Patient1 = await api('/api/patients/1', { token: doctor1Token });
  assertStatus(doctor1Patient1, 200, 'doctor1 can read patient1 profile');

  const doctor1Patient4 = await api('/api/patients/4', { token: doctor1Token });
  assertStatus(doctor1Patient4, 403, 'doctor1 cannot read patient4 without appointment');

  const adminPatients = await api('/api/patients', { token: adminToken });
  assertStatus(adminPatients, 200, 'admin lists patients');

  const doctorPatients = await api('/api/patients', { token: doctor1Token });
  assertStatus(doctorPatients, 403, 'doctor cannot list all patients');

  const massAssignment = await api('/api/patients/me', {
    method: 'PATCH',
    token: patient1Token,
    body: { user_id: 2 }
  });
  assertStatus(massAssignment, 400, 'patient cannot mass-assign user_id');

  const profileUpdate = await api('/api/patients/me', {
    method: 'PATCH',
    token: patient1Token,
    body: { full_name: 'Nguyễn Văn An' }
  });
  assertStatus(profileUpdate, 200, 'patient updates own profile');

  const pastAppointment = await api('/api/appointments', {
    method: 'POST',
    token: patient1Token,
    body: {
      doctor_id: 1,
      scheduled_at: new Date(Date.now() - 86400000).toISOString(),
      reason: 'Past appointment test'
    }
  });
  assertStatus(pastAppointment, 400, 'cannot book appointment in the past');

  const future = new Date(Date.now() + (30 + Math.floor(Math.random() * 10)) * 86400000);
  future.setHours(3, Math.floor(Math.random() * 60), 0, 0);

  const newAppointment = await api('/api/appointments', {
    method: 'POST',
    token: patient1Token,
    body: {
      doctor_id: 1,
      scheduled_at: future.toISOString(),
      reason: 'Smoke test appointment'
    }
  });
  assertStatus(newAppointment, 201, 'patient books appointment');
  const appointmentId = newAppointment.body.data.appointment_id;
  assert(Number.isInteger(appointmentId), 'appointment id missing');

  const conflict = await api('/api/appointments', {
    method: 'POST',
    token: patient1Token,
    body: {
      doctor_id: 1,
      scheduled_at: future.toISOString(),
      reason: 'Duplicate slot'
    }
  });
  assertStatus(conflict, 409, 'duplicate appointment slot rejected');

  const otherPatientView = await api(`/api/appointments/${appointmentId}`, {
    token: patient2Token
  });
  assertStatus(otherPatientView, 403, 'patient2 cannot read patient1 appointment');

  const otherDoctorView = await api(`/api/appointments/${appointmentId}`, {
    token: doctor2Token
  });
  assertStatus(otherDoctorView, 403, 'doctor2 cannot read doctor1 appointment');

  const patientConfirm = await api(`/api/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    token: patient1Token,
    body: { status: 'confirmed' }
  });
  assertStatus(patientConfirm, 403, 'patient cannot confirm appointment');

  const doctorConfirm = await api(`/api/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    token: doctor1Token,
    body: { status: 'confirmed' }
  });
  assertStatus(doctorConfirm, 200, 'doctor confirms own appointment');

  const patientCreateRecord = await api('/api/records', {
    method: 'POST',
    token: patient1Token,
    body: { appointment_id: appointmentId, diagnosis: 'Should fail' }
  });
  assertStatus(patientCreateRecord, 403, 'patient cannot create medical record');

  const otherDoctorCreateRecord = await api('/api/records', {
    method: 'POST',
    token: doctor2Token,
    body: { appointment_id: appointmentId, diagnosis: 'Should fail' }
  });
  assertStatus(otherDoctorCreateRecord, 403, 'doctor2 cannot create record for doctor1 appointment');

  const earlyRecord = await api('/api/records', {
    method: 'POST',
    token: doctor1Token,
    body: { appointment_id: appointmentId, diagnosis: 'Too early' }
  });
  assertStatus(earlyRecord, 409, 'record requires completed appointment');

  const doctorComplete = await api(`/api/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    token: doctor1Token,
    body: { status: 'completed' }
  });
  assertStatus(doctorComplete, 200, 'doctor completes own appointment');

  const createRecord = await api('/api/records', {
    method: 'POST',
    token: doctor1Token,
    body: {
      appointment_id: appointmentId,
      diagnosis: 'Smoke test diagnosis',
      treatment: 'Smoke test treatment',
      notes: 'Smoke test notes'
    }
  });
  assertStatus(createRecord, 201, 'doctor creates record for completed appointment');
  const recordId = createRecord.body.data.record_id;

  const duplicateRecord = await api('/api/records', {
    method: 'POST',
    token: doctor1Token,
    body: { appointment_id: appointmentId, diagnosis: 'Duplicate' }
  });
  assertStatus(duplicateRecord, 409, 'one record per appointment');

  const patientReadRecord = await api(`/api/records/${recordId}`, {
    token: patient1Token
  });
  assertStatus(patientReadRecord, 200, 'patient reads own record');

  const otherPatientReadRecord = await api(`/api/records/${recordId}`, {
    token: patient2Token
  });
  assertStatus(otherPatientReadRecord, 403, 'patient2 cannot read patient1 new record');

  const otherDoctorReadRecord = await api(`/api/records/${recordId}`, {
    token: doctor2Token
  });
  assertStatus(otherDoctorReadRecord, 403, 'doctor2 cannot read doctor1 new record');

  const doctorUpdateRecord = await api(`/api/records/${recordId}`, {
    method: 'PATCH',
    token: doctor1Token,
    body: { notes: 'Updated by smoke test' }
  });
  assertStatus(doctorUpdateRecord, 200, 'doctor updates own record');

  const patientAppointments = await api('/api/appointments', { token: patient1Token });
  assertStatus(patientAppointments, 200, 'patient lists own appointments');
  assert(
    patientAppointments.body.data.every((item) => item.patient_name === 'Nguyễn Văn An'),
    'patient appointment list leaked another patient'
  );

  const doctorAppointments = await api('/api/appointments', { token: doctor1Token });
  assertStatus(doctorAppointments, 200, 'doctor lists own appointments');
  assert(
    doctorAppointments.body.data.every((item) => item.doctor_name === 'BS. Phạm Quốc Bảo'),
    'doctor appointment list leaked another doctor'
  );

  const adminAppointments = await api('/api/appointments', { token: adminToken });
  assertStatus(adminAppointments, 200, 'admin lists appointments');
  assert(adminAppointments.body.data.length >= 7, 'admin appointment list too short');

  const doctors = await api('/api/doctors', { token: patient1Token });
  assertStatus(doctors, 200, 'patient lists doctors');
  assert(doctors.body.data.length === 2, 'expected two doctors');

  // ===== Thuốc và đơn thuốc =====
  const adminMedicines = await api('/api/medicines?limit=100', { token: adminToken });
  assertStatus(adminMedicines, 200, 'admin lists medicines');
  assert(adminMedicines.body.data.length >= 8, 'admin medicine list too short');

  const doctorMedicines = await api('/api/medicines?limit=100', { token: doctor1Token });
  assertStatus(doctorMedicines, 200, 'doctor lists medicines');
  assert(
    doctorMedicines.body.data.every((medicine) => medicine.is_active),
    'doctor list exposed inactive medicines'
  );

  const patientMedicines = await api('/api/medicines', { token: patient1Token });
  assertStatus(patientMedicines, 403, 'patient cannot list medicine catalog');

  const doctorCreateMedicine = await api('/api/medicines', {
    method: 'POST',
    token: doctor1Token,
    body: {
      medicine_code: 'SMOKE-DOC',
      name: 'Doctor cannot create',
      unit: 'viên',
      stock_quantity: 1
    }
  });
  assertStatus(doctorCreateMedicine, 403, 'doctor cannot create medicine');

  const uniqueCode = `SMOKE${String(Date.now()).slice(-8)}`;
  const testMedicineName = `Smoke Medicine ${uniqueCode}`;
  const createMedicine = await api('/api/medicines', {
    method: 'POST',
    token: adminToken,
    body: {
      medicine_code: uniqueCode,
      name: testMedicineName,
      active_ingredient: 'Smoke ingredient',
      unit: 'viên',
      stock_quantity: 1,
      is_prescription_only: true
    }
  });
  assertStatus(createMedicine, 201, 'admin creates medicine');
  const testMedicineId = createMedicine.body.data.medicine_id;
  assert(Number.isInteger(testMedicineId), 'medicine id missing');

  const doctorUpdateMedicine = await api(`/api/medicines/${testMedicineId}`, {
    method: 'PATCH',
    token: doctor1Token,
    body: { stock_quantity: 2 }
  });
  assertStatus(doctorUpdateMedicine, 403, 'doctor cannot update medicine');

  const patientCreatePrescription = await api(`/api/records/${recordId}/prescription`, {
    method: 'POST',
    token: patient1Token,
    body: {
      items: [
        {
          medicine_id: testMedicineId,
          dosage: '1 viên/lần',
          frequency: '1 lần/ngày',
          duration_days: 1,
          quantity: 1
        }
      ]
    }
  });
  assertStatus(patientCreatePrescription, 403, 'patient cannot create prescription');

  const otherDoctorCreatePrescription = await api(`/api/records/${recordId}/prescription`, {
    method: 'POST',
    token: doctor2Token,
    body: {
      items: [
        {
          medicine_id: testMedicineId,
          dosage: '1 viên/lần',
          frequency: '1 lần/ngày',
          duration_days: 1,
          quantity: 1
        }
      ]
    }
  });
  assertStatus(otherDoctorCreatePrescription, 403, 'doctor2 cannot prescribe for doctor1 record');

  const insufficientStock = await api(`/api/records/${recordId}/prescription`, {
    method: 'POST',
    token: doctor1Token,
    body: {
      items: [
        {
          medicine_id: testMedicineId,
          dosage: '1 viên/lần',
          frequency: '1 lần/ngày',
          duration_days: 1,
          quantity: 2
        }
      ]
    }
  });
  assertStatus(insufficientStock, 409, 'prescription rejects insufficient stock');
  assert(
    insufficientStock.body.error && insufficientStock.body.error.code === 'INSUFFICIENT_STOCK',
    'insufficient stock error code mismatch'
  );

  const duplicateItems = await api(`/api/records/${recordId}/prescription`, {
    method: 'POST',
    token: doctor1Token,
    body: {
      items: [
        {
          medicine_id: testMedicineId,
          dosage: '1 viên/lần',
          frequency: '1 lần/ngày',
          duration_days: 1,
          quantity: 1
        },
        {
          medicine_id: testMedicineId,
          dosage: '1 viên/lần',
          frequency: '1 lần/ngày',
          duration_days: 1,
          quantity: 1
        }
      ]
    }
  });
  assertStatus(duplicateItems, 400, 'prescription rejects duplicate medicine items');

  const createPrescription = await api(`/api/records/${recordId}/prescription`, {
    method: 'POST',
    token: doctor1Token,
    body: {
      note: 'Smoke prescription',
      items: [
        {
          medicine_id: testMedicineId,
          dosage: '1 viên/lần',
          frequency: '1 lần/ngày',
          duration_days: 1,
          quantity: 1,
          instruction: 'Uống sau ăn'
        }
      ]
    }
  });
  assertStatus(createPrescription, 201, 'doctor creates prescription');
  const prescriptionId = createPrescription.body.data.prescription_id;
  assert(Number.isInteger(prescriptionId), 'prescription id missing');
  assert(createPrescription.body.data.items.length === 1, 'prescription items missing');

  const duplicatePrescription = await api(`/api/records/${recordId}/prescription`, {
    method: 'POST',
    token: doctor1Token,
    body: {
      items: [
        {
          medicine_id: testMedicineId,
          dosage: '1 viên/lần',
          frequency: '1 lần/ngày',
          duration_days: 1,
          quantity: 1
        }
      ]
    }
  });
  assertStatus(duplicatePrescription, 409, 'one prescription per record');

  const patientReadPrescription = await api(`/api/records/${recordId}/prescription`, {
    token: patient1Token
  });
  assertStatus(patientReadPrescription, 200, 'patient reads own prescription');
  assert(
    patientReadPrescription.body.data.items[0].medicine_name === testMedicineName,
    'prescription medicine snapshot mismatch'
  );

  const doctorReadPrescription = await api(`/api/records/${recordId}/prescription`, {
    token: doctor1Token
  });
  assertStatus(doctorReadPrescription, 200, 'doctor reads own prescription');

  const otherPatientReadPrescription = await api(`/api/records/${recordId}/prescription`, {
    token: patient2Token
  });
  assertStatus(otherPatientReadPrescription, 403, 'patient2 cannot read patient1 prescription');

  const otherDoctorReadPrescription = await api(`/api/records/${recordId}/prescription`, {
    token: doctor2Token
  });
  assertStatus(otherDoctorReadPrescription, 403, 'doctor2 cannot read doctor1 prescription');

  const adminReadPrescription = await api(`/api/records/${recordId}/prescription`, {
    token: adminToken
  });
  assertStatus(adminReadPrescription, 403, 'admin cannot read prescription');

  const updatedMedicine = await api(`/api/medicines/${testMedicineId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { name: 'Smoke Medicine Renamed' }
  });
  assertStatus(updatedMedicine, 200, 'admin updates medicine');

  const snapshotPrescription = await api(`/api/records/${recordId}/prescription`, {
    token: patient1Token
  });
  assertStatus(snapshotPrescription, 200, 'patient reads prescription after catalog edit');
  assert(
    snapshotPrescription.body.data.items[0].medicine_name === testMedicineName,
    'prescription snapshot changed after catalog edit'
  );

  const medicinesAfterPrescription = await api('/api/medicines?limit=100', { token: adminToken });
  assertStatus(medicinesAfterPrescription, 200, 'admin lists medicines after prescription');
  const usedMedicine = medicinesAfterPrescription.body.data.find(
    (medicine) => Number(medicine.medicine_id) === Number(testMedicineId)
  );
  assert(usedMedicine && Number(usedMedicine.stock_quantity) === 0, 'stock was not decremented');

  const recordsWithPrescription = await api('/api/records?limit=100', { token: patient1Token });
  assertStatus(recordsWithPrescription, 200, 'patient lists records with prescription flag');
  const newRecord = recordsWithPrescription.body.data.find(
    (record) => Number(record.record_id) === Number(recordId)
  );
  assert(newRecord && newRecord.has_prescription === true, 'record has_prescription flag mismatch');

  console.log(`\nPASS: ${passed}, FAIL: ${failed}`);
  console.log('Smoke test completed successfully.');
}

run().catch((error) => {
  failed += 1;
  console.error(`\nFAIL: ${error.message}`);
  console.error(`PASS: ${passed}, FAIL: ${failed}`);
  process.exitCode = 1;
});
