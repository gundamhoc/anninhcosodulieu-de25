(() => {
  'use strict';

  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || 'http://localhost:3000';
  const TOKEN_KEY = 'clinic_token';

  const state = {
    token: sessionStorage.getItem(TOKEN_KEY) || '',
    user: null,
    profile: null,
    currentView: null,
    adminUsers: [],
    adminPatients: [],
    adminDoctors: [],
    adminMedicines: [],
    doctorAppointments: [],
    doctorRecords: []
  };

  // Menu hiển thị theo từng vai trò.
  const NAV_BY_ROLE = {
    admin: [
      { id: 'admin-users', label: 'Tài khoản' },
      { id: 'admin-patients', label: 'Bệnh nhân' },
      { id: 'admin-doctors', label: 'Bác sĩ' },
      { id: 'admin-medicines', label: 'Thuốc' },
      { id: 'admin-appointments', label: 'Lịch hẹn' },
      { id: 'admin-audit', label: 'Audit log' }
    ],
    doctor: [
      { id: 'doctor-appointments', label: 'Lịch hẹn' },
      { id: 'doctor-records', label: 'Bệnh án' },
      { id: 'doctor-profile', label: 'Hồ sơ' }
    ],
    patient: [
      { id: 'patient-appointments', label: 'Lịch hẹn' },
      { id: 'patient-booking', label: 'Đặt lịch' },
      { id: 'patient-records', label: 'Bệnh án' },
      { id: 'patient-profile', label: 'Hồ sơ' }
    ]
  };

  const ROLE_LABELS = {
    admin: 'Quản trị',
    doctor: 'Bác sĩ',
    patient: 'Bệnh nhân'
  };

  const STATUS_LABELS = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy'
  };

  const ACTION_LABELS = {
    LOGIN_SUCCESS: 'Đăng nhập',
    LOGIN_FAILED: 'Đăng nhập thất bại',
    PASSWORD_CHANGE: 'Đổi mật khẩu',
    USER_CREATE: 'Tạo tài khoản',
    USER_UPDATE: 'Cập nhật tài khoản',
    USER_DISABLE: 'Khóa tài khoản',
    PATIENT_VIEW: 'Xem hồ sơ bệnh nhân',
    PATIENT_UPDATE: 'Cập nhật bệnh nhân',
    PATIENT_PROFILE_UPDATE: 'Bệnh nhân tự sửa hồ sơ',
    DOCTOR_PROFILE_UPDATE: 'Bác sĩ tự sửa hồ sơ',
    DOCTOR_UPDATE: 'Cập nhật bác sĩ',
    APPOINTMENT_CREATE: 'Tạo lịch hẹn',
    APPOINTMENT_VIEW: 'Xem lịch hẹn',
    APPOINTMENT_STATUS_UPDATE: 'Đổi trạng thái lịch hẹn',
    RECORD_CREATE: 'Tạo bệnh án',
    RECORD_VIEW: 'Xem bệnh án',
    RECORD_UPDATE: 'Cập nhật bệnh án',
    RECORD_ACCESS_DENIED: 'Truy cập bệnh án bị từ chối',
    MEDICINE_CREATE: 'Thêm thuốc',
    MEDICINE_UPDATE: 'Cập nhật thuốc',
    PRESCRIPTION_CREATE: 'Kê đơn thuốc',
    PRESCRIPTION_VIEW: 'Xem đơn thuốc',
    PRESCRIPTION_ACCESS_DENIED: 'Truy cập đơn thuốc bị từ chối'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    $('#api-base-label').textContent = API_BASE;
    $('#api-base-sidebar').textContent = API_BASE;
    bindBaseEvents();

    if (!state.token) {
      showLogin();
      return;
    }

    try {
      const me = await api('/api/auth/me');
      applyMe(me);
      showApp();

      const hashView = window.location.hash.replace('#', '');
      const allowed = (NAV_BY_ROLE[state.user.role] || []).some((item) => item.id === hashView);
      await navigate(allowed ? hashView : defaultView(), allowed);
    } catch {
      clearSession();
      showLogin();
    }
  }

  function bindBaseEvents() {
    $('#login-form').addEventListener('submit', handleLogin);
    $('#logout-btn').addEventListener('click', () => {
      clearSession();
      showLogin();
      showToast('Đã đăng xuất.', 'info');
    });

    $$('.demo-account').forEach((button) => {
      button.addEventListener('click', () => {
        $('#login-email').value = button.dataset.email;
        $('#login-password').value = button.dataset.password;
        $('#login-form').requestSubmit();
      });
    });

    $('#modal-close').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', (event) => {
      if (event.target.id === 'modal' || event.target.closest('[data-close-modal]')) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#modal').hidden) {
        closeModal();
      }
    });

    $('#main-content').addEventListener('click', handleMainClick);
  }

  // Đăng nhập, lưu token và tải hồ sơ tương ứng với vai trò.
  async function handleLogin(event) {
    event.preventDefault();
    hideLoginError();

    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;

    if (!email || !password) {
      showLoginError('Nhập đầy đủ email và mật khẩu.');
      return;
    }

    setLoginLoading(true);
    try {
      const response = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false
      });

      state.token = response.data.token;
      sessionStorage.setItem(TOKEN_KEY, state.token);

      const me = await api('/api/auth/me');
      applyMe(me);
      $('#login-form').reset();
      showApp();
      await navigate(defaultView());
    } catch (error) {
      showLoginError(error.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function applyMe(me) {
    state.user = me.data.user;
    state.profile = me.data.profile;
  }

  function showLogin() {
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    $('#login-error').hidden = true;
    $('#login-error').textContent = '';
    $('#login-password').value = '';
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname);
    }
    document.title = 'Clinic Portal - Đăng nhập';
    setTimeout(() => $('#login-email').focus(), 30);
  }

  function showApp() {
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    updateHeader();

    const items = NAV_BY_ROLE[state.user.role] || [];
    $('#nav').innerHTML = items
      .map((item) => `<button type="button" class="nav-item" data-view="${item.id}">${escapeHtml(item.label)}</button>`)
      .join('');

    $$('#nav .nav-item').forEach((button) => {
      button.addEventListener('click', () => navigate(button.dataset.view));
    });

    document.title = `Clinic Portal - ${ROLE_LABELS[state.user.role] || state.user.role}`;
  }

  function updateHeader() {
    if (!state.user) return;
    $('#user-name').textContent = (state.profile && state.profile.full_name) || state.user.email;
    $('#user-role').textContent = ROLE_LABELS[state.user.role] || state.user.role;
  }

  function clearSession() {
    state.token = '';
    state.user = null;
    state.profile = null;
    state.currentView = null;
    sessionStorage.removeItem(TOKEN_KEY);
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname);
    }
  }

  function defaultView() {
    const items = NAV_BY_ROLE[state.user.role] || [];
    return items[0] ? items[0].id : null;
  }

  // Chuyển màn hình, kiểm tra quyền và gọi hàm render tương ứng.
  async function navigate(view, updateHash = true) {
    const items = NAV_BY_ROLE[state.user.role] || [];
    if (!items.some((item) => item.id === view)) {
      view = defaultView();
    }
    if (!view) return;

    state.currentView = view;
    $$('#nav .nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === view);
    });

    if (updateHash) {
      history.replaceState(null, '', `#${view}`);
    }

    $('#main-content').innerHTML = loadingState();

    try {
      await RENDERERS[view]();
    } catch (error) {
      $('#main-content').innerHTML = errorState(error);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Gọi API, tự gắn token và dịch lỗi sang câu tiếng Việt dễ hiểu.
  async function api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw new ApiError('Không kết nối được API. Kiểm tra backend đã chạy chưa.');
    }

    let payload = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (response.status === 401 && auth) {
      clearSession();
      showLogin();
      showToast('Phiên đăng nhập đã hết hạn. Đăng nhập lại nhé.', 'warning');
      throw new ApiError('Phiên đăng nhập đã hết hạn.', [], 'UNAUTHENTICATED');
    }

    if (!response.ok) {
      const code = payload && payload.error ? payload.error.code : '';
      const fallback = payload && payload.error ? payload.error.message : `Lỗi ${response.status}`;
      const details = payload && payload.error && Array.isArray(payload.error.details)
        ? payload.error.details
        : [];
      throw new ApiError(translateApiError(code, fallback), details, code);
    }

    return payload;
  }

  class ApiError extends Error {
    constructor(message, details = [], code = '') {
      super(message);
      this.name = 'ApiError';
      this.details = details;
      this.code = code;
    }
  }

  function translateApiError(code, fallback) {
    const messages = {
      INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
      VALIDATION_ERROR: 'Dữ liệu chưa hợp lệ.',
      FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
      UNAUTHENTICATED: 'Bạn cần đăng nhập.',
      INVALID_TOKEN: 'Phiên đăng nhập không hợp lệ.',
      ACCOUNT_INACTIVE: 'Tài khoản đã bị khóa.',
      APPOINTMENT_CONFLICT: 'Bác sĩ đã có lịch hẹn vào giờ này.',
      INVALID_SCHEDULE: 'Thời gian hẹn phải ở tương lai.',
      INVALID_STATUS_TRANSITION: 'Không thể chuyển trạng thái như vậy.',
      STATUS_CONFLICT: 'Lịch hẹn vừa được người khác cập nhật. Tải lại trang nhé.',
      APPOINTMENT_NOT_COMPLETED: 'Chỉ tạo bệnh án khi lịch hẹn đã hoàn tất.',
      RECORD_EXISTS: 'Lịch hẹn này đã có bệnh án.',
      PRESCRIPTION_EXISTS: 'Bệnh án này đã có đơn thuốc.',
      PRESCRIPTION_NOT_FOUND: 'Bệnh án này chưa có đơn thuốc.',
      MEDICINE_NOT_FOUND: 'Không tìm thấy thuốc.',
      MEDICINE_UNAVAILABLE: 'Thuốc không tồn tại hoặc đã ngừng sử dụng.',
      INSUFFICIENT_STOCK: 'Không đủ tồn kho thuốc.',
      DUPLICATE_VALUE: 'Email, giấy phép hoặc mã thuốc đã tồn tại.',
      SELF_DEACTIVATION: 'Bạn không thể tự khóa tài khoản của mình.',
      TOO_MANY_REQUESTS: 'Đăng nhập quá nhiều lần. Thử lại sau 15 phút.',
      USER_NOT_FOUND: 'Không tìm thấy tài khoản.',
      PATIENT_NOT_FOUND: 'Không tìm thấy bệnh nhân.',
      DOCTOR_NOT_FOUND: 'Không tìm thấy bác sĩ.',
      APPOINTMENT_NOT_FOUND: 'Không tìm thấy lịch hẹn.',
      RECORD_NOT_FOUND: 'Không tìm thấy bệnh án.'
    };
    return messages[code] || fallback;
  }

  // Toast và modal dùng chung cho tất cả màn hình.
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    $('#toast-container').appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      setTimeout(() => toast.remove(), 200);
    }, 3800);
  }

  function showLoginError(message) {
    const box = $('#login-error');
    box.textContent = message;
    box.hidden = false;
  }

  function hideLoginError() {
    const box = $('#login-error');
    box.textContent = '';
    box.hidden = true;
  }

  function setLoginLoading(loading) {
    const button = $('#login-submit');
    button.disabled = loading;
    button.textContent = loading ? 'Đang đăng nhập...' : 'Đăng nhập';
  }

  function openModal(title, content, wide = false) {
    $('#modal .modal').classList.toggle('modal-wide', wide);
    $('#modal-title').textContent = title;
    $('#modal-content').innerHTML = content;
    $('#modal-error').hidden = true;
    $('#modal-error').textContent = '';
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      const first = $('#modal-content input:not([type="hidden"]), #modal-content select, #modal-content textarea');
      if (first) first.focus();
    }, 30);
  }

  function closeModal() {
    $('#modal').hidden = true;
    $('#modal-content').innerHTML = '';
    $('#modal-error').hidden = true;
    $('#modal-error').textContent = '';
    document.body.style.overflow = '';
  }

  function setModalError(error) {
    const box = $('#modal-error');
    box.hidden = false;
    if (error.details && error.details.length) {
      box.textContent = `${error.message}\n${error.details
        .map((item) => `- ${item.path || 'dữ liệu'}: ${item.message}`)
        .join('\n')}`;
    } else {
      box.textContent = error.message;
    }
  }

  async function handleMainClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    event.preventDefault();
    const action = button.dataset.action;
    const id = Number(button.dataset.id);
    button.disabled = true;

    try {
      if (action === 'reload-view') {
        await navigate(state.currentView);
      } else if (action === 'go-booking') {
        await navigate('patient-booking');
      } else if (action === 'create-user') {
        openCreateUserModal();
      } else if (action === 'view-user') {
        await openUserDetail(id);
      } else if (action === 'toggle-user') {
        await toggleUser(id, button.dataset.active === 'true');
      } else if (action === 'edit-patient') {
        const patient = state.adminPatients.find((item) => Number(item.patient_id) === id);
        if (patient) openEditPatientModal(patient);
      } else if (action === 'edit-doctor') {
        const doctor = state.adminDoctors.find((item) => Number(item.doctor_id) === id);
        if (doctor) openEditDoctorModal(doctor);
      } else if (action === 'create-medicine') {
        openCreateMedicineModal();
      } else if (action === 'edit-medicine') {
        const medicine = state.adminMedicines.find((item) => Number(item.medicine_id) === id);
        if (medicine) openEditMedicineModal(medicine);
      } else if (action === 'toggle-medicine') {
        await toggleMedicine(id, button.dataset.active === 'true');
      } else if (action === 'view-patient') {
        await openPatientDetail(id);
      } else if (action === 'confirm-appointment') {
        await changeAppointmentStatus(id, 'confirmed');
      } else if (action === 'complete-appointment') {
        await changeAppointmentStatus(id, 'completed');
      } else if (action === 'cancel-appointment' || action === 'cancel-my-appointment') {
        await changeAppointmentStatus(id, 'cancelled');
      } else if (action === 'create-record') {
        const appointment = state.doctorAppointments.find((item) => Number(item.appointment_id) === id);
        if (appointment) openCreateRecordModal(appointment);
      } else if (action === 'view-record') {
        await openRecordDetail(id);
      } else if (action === 'edit-record') {
        await openEditRecordModal(id);
      } else if (action === 'create-prescription') {
        const record = state.doctorRecords.find((item) => Number(item.record_id) === id);
        if (record) await openCreatePrescriptionModal(record);
      } else if (action === 'view-prescription') {
        await openPrescriptionDetail(id);
      } else if (action === 'choose-doctor') {
        const select = $('#doctor_id');
        if (select) {
          select.value = String(id);
          $('#scheduled_at').focus();
          showToast('Đã chọn bác sĩ. Chọn thời gian rồi bấm đặt lịch.', 'info');
        }
      } else if (action === 'refresh-audit') {
        await renderAdminAudit();
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function toggleUser(id, isActive) {
    if (isActive) {
      if (!window.confirm('Khóa tài khoản này? Người dùng sẽ không đăng nhập được nữa.')) return;
      await api(`/api/users/${id}`, { method: 'DELETE' });
      showToast('Đã khóa tài khoản.');
    } else {
      await api(`/api/users/${id}`, { method: 'PATCH', body: { is_active: true } });
      showToast('Đã mở lại tài khoản.');
    }
    await renderAdminUsers();
  }

  async function changeAppointmentStatus(id, status) {
    const labels = {
      confirmed: 'Xác nhận lịch hẹn này?',
      completed: 'Đánh dấu lịch hẹn đã hoàn tất?',
      cancelled: 'Hủy lịch hẹn này?'
    };

    if (!window.confirm(labels[status] || 'Cập nhật lịch hẹn?')) return;

    await api(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      body: { status }
    });

    showToast('Đã cập nhật lịch hẹn.');

    if (state.user.role === 'doctor') {
      await renderDoctorAppointments();
    } else if (state.user.role === 'patient') {
      await renderPatientAppointments();
    }
  }

  async function openUserDetail(id) {
    const response = await api(`/api/users/${id}`);
    const user = response.data.user;
    const profile = response.data.profile;

    let profileHtml = '<p class="muted">Tài khoản admin không có hồ sơ riêng.</p>';

    if (profile && user.role === 'patient') {
      profileHtml = `<div class="detail-grid">
        ${detailItem('Mã bệnh nhân', profile.patient_id)}
        ${detailItem('Họ tên', profile.full_name)}
        ${detailItem('Ngày sinh', formatDate(profile.date_of_birth))}
        ${detailItem('Giới tính', genderLabel(profile.gender))}
        ${detailItem('Số điện thoại', profile.phone)}
        ${detailItem('Địa chỉ', profile.address, true)}
      </div>`;
    } else if (profile && user.role === 'doctor') {
      profileHtml = `<div class="detail-grid">
        ${detailItem('Mã bác sĩ', profile.doctor_id)}
        ${detailItem('Họ tên', profile.full_name)}
        ${detailItem('Chuyên khoa', profile.specialty)}
        ${detailItem('Giấy phép', profile.license_number)}
        ${detailItem('Số điện thoại', profile.phone)}
      </div>`;
    }

    openModal('Chi tiết tài khoản', `
      <div class="detail-grid">
        ${detailItem('Email', user.email)}
        ${detailItem('Vai trò', ROLE_LABELS[user.role] || user.role)}
        ${detailItem('Trạng thái', user.is_active ? 'Đang hoạt động' : 'Đã khóa')}
        ${detailItem('Ngày tạo', formatDateTime(user.created_at))}
      </div>
      <hr class="divider">
      ${profileHtml}
    `);
  }

  async function openPatientDetail(id) {
    const response = await api(`/api/patients/${id}`);
    const patient = response.data;

    openModal('Hồ sơ bệnh nhân', `
      <div class="detail-grid">
        ${detailItem('Mã bệnh nhân', patient.patient_id)}
        ${detailItem('Họ tên', patient.full_name)}
        ${detailItem('Ngày sinh', formatDate(patient.date_of_birth))}
        ${detailItem('Giới tính', genderLabel(patient.gender))}
        ${detailItem('Số điện thoại', patient.phone)}
        ${detailItem('Email', patient.email)}
        ${detailItem('Địa chỉ', patient.address, true)}
      </div>
    `);
  }

  async function openRecordDetail(id) {
    const response = await api(`/api/records/${id}`);
    openModal('Chi tiết bệnh án', recordDetailHtml(response.data));
  }

  function recordDetailHtml(record) {
    return `<div class="detail-grid">
      ${detailItem('Mã bệnh án', record.record_id)}
      ${detailItem('Mã lịch hẹn', record.appointment_id)}
      ${detailItem('Bệnh nhân', record.patient_name)}
      ${detailItem('Bác sĩ', record.doctor_name)}
      ${detailItem('Ngày hẹn', formatDateTime(record.scheduled_at))}
      ${detailItem('Trạng thái lịch hẹn', STATUS_LABELS[record.appointment_status] || record.appointment_status)}
      ${detailItem('Đơn thuốc', record.has_prescription ? 'Đã kê' : 'Chưa kê')}
      ${detailItem('Chẩn đoán', record.diagnosis, true)}
      ${detailItem('Điều trị', record.treatment, true)}
      ${detailItem('Ghi chú', record.notes, true)}
      ${detailItem('Cập nhật lần cuối', formatDateTime(record.updated_at))}
    </div>`;
  }

  function openCreateRecordModal(appointment) {
    openModal('Tạo bệnh án', `
      <form id="record-form" class="form">
        <div class="context-box">
          Bệnh nhân: <strong>${escapeHtml(appointment.patient_name)}</strong><br>
          Thời gian hẹn: ${escapeHtml(formatDateTime(appointment.scheduled_at))}
        </div>
        <label>Chẩn đoán
          <textarea name="diagnosis" rows="3" required placeholder="Nhập chẩn đoán..."></textarea>
        </label>
        <label>Hướng điều trị
          <textarea name="treatment" rows="3" placeholder="Nhập hướng điều trị..."></textarea>
        </label>
        <label>Ghi chú
          <textarea name="notes" rows="3" placeholder="Ghi chú thêm..."></textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-primary">Tạo bệnh án</button>
        </div>
      </form>
    `);

    $('#record-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);

      try {
        await api('/api/records', {
          method: 'POST',
          body: {
            appointment_id: appointment.appointment_id,
            diagnosis: values.diagnosis,
            treatment: values.treatment,
            notes: values.notes
          }
        });
        closeModal();
        showToast('Đã tạo bệnh án.');
        await renderDoctorAppointments();
      } catch (error) {
        setModalError(error);
      }
    });
  }

  async function openEditRecordModal(id) {
    const response = await api(`/api/records/${id}`);
    const record = response.data;

    openModal('Sửa bệnh án', `
      <form id="edit-record-form" class="form">
        <div class="context-box">
          Bệnh nhân: <strong>${escapeHtml(record.patient_name)}</strong><br>
          Ngày hẹn: ${escapeHtml(formatDateTime(record.scheduled_at))}
        </div>
        <label>Chẩn đoán
          <textarea name="diagnosis" rows="3" required>${escapeHtml(record.diagnosis || '')}</textarea>
        </label>
        <label>Hướng điều trị
          <textarea name="treatment" rows="3">${escapeHtml(record.treatment || '')}</textarea>
        </label>
        <label>Ghi chú
          <textarea name="notes" rows="3">${escapeHtml(record.notes || '')}</textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
        </div>
      </form>
    `);

    $('#edit-record-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);

      try {
        await api(`/api/records/${id}`, {
          method: 'PATCH',
          body: {
            diagnosis: values.diagnosis,
            treatment: values.treatment,
            notes: values.notes
          }
        });
        closeModal();
        showToast('Đã cập nhật bệnh án.');
        if (state.currentView === 'doctor-records') {
          await renderDoctorRecords();
        } else {
          await renderDoctorAppointments();
        }
      } catch (error) {
        setModalError(error);
      }
    });
  }

  function prescriptionMedicineOptions(medicines) {
    return medicines.map((medicine) => `
      <option value="${medicine.medicine_id}">
        ${escapeHtml(medicine.medicine_code)} - ${escapeHtml(medicine.name)} (${escapeHtml(medicine.unit)}) - còn ${medicine.stock_quantity}
      </option>
    `).join('');
  }

  function prescriptionItemRow(medicines) {
    return `
      <div class="prescription-item-row">
        <label>Thuốc
          <select class="prescription-medicine" required>
            ${prescriptionMedicineOptions(medicines)}
          </select>
        </label>
        <label>Liều dùng
          <input class="prescription-dosage" required placeholder="1 viên/lần">
        </label>
        <label>Tần suất
          <input class="prescription-frequency" required placeholder="2 lần/ngày">
        </label>
        <label>Số ngày
          <input class="prescription-duration" type="number" min="1" max="365" value="5" required>
        </label>
        <label>Số lượng
          <input class="prescription-quantity" type="number" min="1" max="10000" value="10" required>
        </label>
        <label>Hướng dẫn
          <input class="prescription-instruction" placeholder="Uống sau ăn">
        </label>
        <button type="button" class="btn btn-sm btn-danger prescription-remove">Xóa</button>
      </div>
    `;
  }

  async function openCreatePrescriptionModal(record) {
    const response = await api('/api/medicines?limit=100');
    const medicines = response.data.filter(
      (medicine) => medicine.is_active && Number(medicine.stock_quantity) > 0
    );

    if (!medicines.length) {
      showToast('Chưa có thuốc còn tồn kho để kê đơn.', 'error');
      return;
    }

    openModal('Kê đơn thuốc', `
      <form id="prescription-form" class="form">
        <div class="context-box">
          Bệnh nhân: <strong>${escapeHtml(record.patient_name)}</strong><br>
          Ngày hẹn: ${escapeHtml(formatDateTime(record.scheduled_at))}<br>
          Chẩn đoán: ${escapeHtml(record.diagnosis || '—')}
        </div>
        <div id="prescription-items" class="prescription-items"></div>
        <div class="form-actions">
          <button type="button" class="btn" id="add-prescription-item">+ Thêm thuốc</button>
        </div>
        <label>Ghi chú đơn thuốc
          <textarea name="note" rows="2" placeholder="Ví dụ: uống đủ liều, tái khám sau 2 tuần..."></textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-primary">Kê đơn</button>
        </div>
      </form>
    `, true);

    const form = $('#prescription-form');
    const itemsBox = $('#prescription-items');
    itemsBox.innerHTML = prescriptionItemRow(medicines);

    $('#add-prescription-item').addEventListener('click', () => {
      itemsBox.insertAdjacentHTML('beforeend', prescriptionItemRow(medicines));
    });

    itemsBox.addEventListener('click', (event) => {
      const removeButton = event.target.closest('.prescription-remove');
      if (!removeButton) return;

      if ($$('.prescription-item-row', itemsBox).length <= 1) {
        showToast('Đơn thuốc phải có ít nhất một loại thuốc.', 'warning');
        return;
      }

      removeButton.closest('.prescription-item-row').remove();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const rows = $$('.prescription-item-row', form);
      const items = rows.map((row) => ({
        medicine_id: Number($('.prescription-medicine', row).value),
        dosage: $('.prescription-dosage', row).value.trim(),
        frequency: $('.prescription-frequency', row).value.trim(),
        duration_days: Number($('.prescription-duration', row).value),
        quantity: Number($('.prescription-quantity', row).value),
        instruction: $('.prescription-instruction', row).value.trim() || undefined
      }));

      if (items.some((item) => !item.medicine_id || !item.dosage || !item.frequency || !item.duration_days || !item.quantity)) {
        showToast('Nhập đầy đủ thông tin cho từng loại thuốc.', 'error');
        return;
      }

      const medicineIds = items.map((item) => item.medicine_id);
      if (new Set(medicineIds).size !== medicineIds.length) {
        showToast('Mỗi loại thuốc chỉ được kê một lần trong đơn.', 'error');
        return;
      }

      const note = form.querySelector('textarea[name="note"]').value.trim();

      try {
        await api(`/api/records/${record.record_id}/prescription`, {
          method: 'POST',
          body: { note: note || undefined, items }
        });
        closeModal();
        showToast('Đã kê đơn thuốc.');
        await renderDoctorRecords();
      } catch (error) {
        setModalError(error);
      }
    });
  }

  async function openPrescriptionDetail(recordId) {
    const response = await api(`/api/records/${recordId}/prescription`);
    openModal('Đơn thuốc', prescriptionDetailHtml(response.data), true);
  }

  function prescriptionDetailHtml(prescription) {
    const items = prescription.items || [];
    const rows = items.map((item) => `
      <tr>
        <td>${escapeHtml(item.medicine_name)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.dosage)}</td>
        <td>${escapeHtml(item.frequency)}</td>
        <td>${item.duration_days}</td>
        <td>${item.quantity}</td>
        <td>${escapeHtml(item.instruction || '—')}</td>
      </tr>
    `).join('');

    return `
      <div class="detail-grid">
        ${detailItem('Mã đơn thuốc', prescription.prescription_id)}
        ${detailItem('Mã bệnh án', prescription.record_id)}
        ${detailItem('Bệnh nhân', prescription.patient_name)}
        ${detailItem('Bác sĩ kê đơn', prescription.doctor_name)}
        ${detailItem('Ngày kê', formatDateTime(prescription.issued_at))}
        ${detailItem('Ghi chú', prescription.note, true)}
      </div>
      <hr class="divider">
      <h3>Danh sách thuốc</h3>
      ${renderTable(['Thuốc', 'Đơn vị', 'Liều dùng', 'Tần suất', 'Số ngày', 'Số lượng', 'Hướng dẫn'], rows, 'Đơn thuốc chưa có thuốc.')}
    `;
  }

  function openEditPatientModal(patient) {
    openModal('Sửa hồ sơ bệnh nhân', `
      <form id="edit-patient-form" class="form">
        <div class="readonly-box">
          Email đăng nhập: ${escapeHtml(patient.email || '—')}<br>
          Mã bệnh nhân: ${escapeHtml(patient.patient_id)}
        </div>
        <div class="form-grid">
          <label>Họ tên
            <input name="full_name" value="${escapeHtml(patient.full_name || '')}" required>
          </label>
          <label>Ngày sinh
            <input name="date_of_birth" type="date" value="${escapeHtml(patient.date_of_birth || '')}">
          </label>
          <label>Giới tính
            <select name="gender">
              <option value="">Chưa cập nhật</option>
              <option value="male" ${patient.gender === 'male' ? 'selected' : ''}>Nam</option>
              <option value="female" ${patient.gender === 'female' ? 'selected' : ''}>Nữ</option>
              <option value="other" ${patient.gender === 'other' ? 'selected' : ''}>Khác</option>
            </select>
          </label>
          <label>Số điện thoại
            <input name="phone" value="${escapeHtml(patient.phone || '')}">
          </label>
        </div>
        <label>Địa chỉ
          <textarea name="address" rows="2">${escapeHtml(patient.address || '')}</textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
        </div>
      </form>
    `);

    $('#edit-patient-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);

      try {
        await api(`/api/patients/${patient.patient_id}`, {
          method: 'PATCH',
          body: values
        });
        closeModal();
        showToast('Đã cập nhật hồ sơ bệnh nhân.');
        await renderAdminPatients();
      } catch (error) {
        setModalError(error);
      }
    });
  }

  function openEditDoctorModal(doctor) {
    openModal('Sửa hồ sơ bác sĩ', `
      <form id="edit-doctor-form" class="form">
        <div class="readonly-box">
          Mã bác sĩ: ${escapeHtml(doctor.doctor_id)}
        </div>
        <div class="form-grid">
          <label>Họ tên
            <input name="full_name" value="${escapeHtml(doctor.full_name || '')}" required>
          </label>
          <label>Chuyên khoa
            <input name="specialty" value="${escapeHtml(doctor.specialty || '')}">
          </label>
          <label>Số điện thoại
            <input name="phone" value="${escapeHtml(doctor.phone || '')}">
          </label>
          <label>Giấy phép
            <input name="license_number" value="${escapeHtml(doctor.license_number || '')}">
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
        </div>
      </form>
    `);

    $('#edit-doctor-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);

      try {
        await api(`/api/doctors/${doctor.doctor_id}`, {
          method: 'PATCH',
          body: values
        });
        closeModal();
        showToast('Đã cập nhật hồ sơ bác sĩ.');
        await renderAdminDoctors();
      } catch (error) {
        setModalError(error);
      }
    });
  }

  async function toggleMedicine(id, isActive) {
    if (isActive && !window.confirm('Ngừng sử dụng thuốc này? Bác sĩ sẽ không kê được thuốc này nữa.')) {
      return;
    }

    await api(`/api/medicines/${id}`, {
      method: 'PATCH',
      body: { is_active: !isActive }
    });

    showToast(isActive ? 'Đã ngừng sử dụng thuốc.' : 'Đã mở lại thuốc.');
    await renderAdminMedicines();
  }

  function openCreateMedicineModal() {
    openModal('Thêm thuốc', `
      <form id="medicine-form" class="form">
        <div class="form-grid">
          <label>Mã thuốc
            <input name="medicine_code" required placeholder="Ví dụ: MED009">
          </label>
          <label>Tên thuốc
            <input name="name" required placeholder="Ví dụ: Amlodipine 5mg">
          </label>
          <label>Hoạt chất
            <input name="active_ingredient" placeholder="Ví dụ: Amlodipine">
          </label>
          <label>Đơn vị
            <input name="unit" required placeholder="viên, chai, ống...">
          </label>
          <label>Số lượng tồn
            <input name="stock_quantity" type="number" min="0" step="1" value="0" required>
          </label>
          <label class="checkbox-label">
            <input name="is_prescription_only" type="checkbox" checked>
            Thuốc kê đơn
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-primary">Thêm thuốc</button>
        </div>
      </form>
    `);

    $('#medicine-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formValues(form);

      try {
        await api('/api/medicines', {
          method: 'POST',
          body: {
            medicine_code: values.medicine_code,
            name: values.name,
            active_ingredient: values.active_ingredient,
            unit: values.unit,
            stock_quantity: Number(values.stock_quantity || 0),
            is_prescription_only: form.elements.is_prescription_only.checked
          }
        });
        closeModal();
        showToast('Đã thêm thuốc.');
        await renderAdminMedicines();
      } catch (error) {
        setModalError(error);
      }
    });
  }

  function openEditMedicineModal(medicine) {
    openModal('Sửa thuốc', `
      <form id="edit-medicine-form" class="form">
        <div class="form-grid">
          <label>Mã thuốc
            <input name="medicine_code" value="${escapeHtml(medicine.medicine_code)}" required>
          </label>
          <label>Tên thuốc
            <input name="name" value="${escapeHtml(medicine.name)}" required>
          </label>
          <label>Hoạt chất
            <input name="active_ingredient" value="${escapeHtml(medicine.active_ingredient || '')}">
          </label>
          <label>Đơn vị
            <input name="unit" value="${escapeHtml(medicine.unit)}" required>
          </label>
          <label>Số lượng tồn
            <input name="stock_quantity" type="number" min="0" step="1" value="${Number(medicine.stock_quantity)}" required>
          </label>
          <label class="checkbox-label">
            <input name="is_prescription_only" type="checkbox" ${medicine.is_prescription_only ? 'checked' : ''}>
            Thuốc kê đơn
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
        </div>
      </form>
    `);

    $('#edit-medicine-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = formValues(form);

      try {
        await api(`/api/medicines/${medicine.medicine_id}`, {
          method: 'PATCH',
          body: {
            medicine_code: values.medicine_code,
            name: values.name,
            active_ingredient: values.active_ingredient || '',
            unit: values.unit,
            stock_quantity: Number(values.stock_quantity || 0),
            is_prescription_only: form.elements.is_prescription_only.checked
          }
        });
        closeModal();
        showToast('Đã cập nhật thuốc.');
        await renderAdminMedicines();
      } catch (error) {
        setModalError(error);
      }
    });
  }

  function openCreateUserModal() {
    openModal('Thêm tài khoản', `
      <form id="create-user-form" class="form">
        <div class="form-grid">
          <label>Email
            <input name="email" type="email" required>
          </label>
          <label>Mật khẩu
            <input name="password" type="password" minlength="8" required>
          </label>
          <label>Vai trò
            <select name="role" id="new-user-role">
              <option value="patient">Bệnh nhân</option>
              <option value="doctor">Bác sĩ</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>

        <div class="role-fields" data-role-fields="patient" hidden>
          <div class="form-grid">
            <label>Họ tên
              <input name="full_name" data-required-for="patient">
            </label>
            <label>Ngày sinh
              <input name="date_of_birth" type="date">
            </label>
            <label>Giới tính
              <select name="gender">
                <option value="">Chưa cập nhật</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </label>
            <label>Số điện thoại
              <input name="phone">
            </label>
          </div>
          <label>Địa chỉ
            <textarea name="address" rows="2"></textarea>
          </label>
        </div>

        <div class="role-fields" data-role-fields="doctor" hidden>
          <div class="form-grid">
            <label>Họ tên
              <input name="full_name" data-required-for="doctor">
            </label>
            <label>Chuyên khoa
              <input name="specialty">
            </label>
            <label>Giấy phép
              <input name="license_number">
            </label>
            <label>Số điện thoại
              <input name="phone">
            </label>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-primary">Tạo tài khoản</button>
        </div>
      </form>
    `);

    const form = $('#create-user-form');
    const roleSelect = $('#new-user-role');

    const syncRoleFields = () => {
      const role = roleSelect.value;
      $$('[data-role-fields]', form).forEach((section) => {
        const hidden = section.dataset.roleFields !== role;
        section.hidden = hidden;
        section.querySelectorAll('input, select, textarea').forEach((field) => {
          field.disabled = hidden;
        });
      });
      $$('[data-required-for]', form).forEach((input) => {
        input.required = input.dataset.requiredFor === role;
      });
    };

    roleSelect.addEventListener('change', syncRoleFields);
    syncRoleFields();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formValues(form);
      const payload = {
        email: values.email,
        password: values.password,
        role: values.role
      };

      if (values.role === 'patient') {
        Object.assign(payload, pick(values, ['full_name', 'date_of_birth', 'gender', 'phone', 'address']));
      } else if (values.role === 'doctor') {
        Object.assign(payload, pick(values, ['full_name', 'specialty', 'phone', 'license_number']));
      }

      try {
        await api('/api/users', { method: 'POST', body: payload });
        closeModal();
        showToast('Đã tạo tài khoản.');
        await renderAdminUsers();
      } catch (error) {
        setModalError(error);
      }
    });
  }

  // ===== Màn hình admin =====
  async function renderAdminUsers() {
    const response = await api('/api/users?limit=100');
    state.adminUsers = response.data;

    const rows = state.adminUsers.map((user) => `
      <tr>
        <td>${user.user_id}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${roleBadge(user.role)}</td>
        <td>${activeBadge(user.is_active)}</td>
        <td>${escapeHtml(formatDateTime(user.created_at))}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="view-user" data-id="${user.user_id}">Xem</button>
          ${Number(user.user_id) === Number(state.user.user_id)
            ? '<span class="muted">Tài khoản của bạn</span>'
            : `<button class="btn btn-sm ${user.is_active ? 'btn-danger' : ''}" data-action="toggle-user" data-id="${user.user_id}" data-active="${user.is_active ? 'true' : 'false'}">${user.is_active ? 'Khóa' : 'Mở'}</button>`}
        </td>
      </tr>
    `).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Tài khoản', 'Quản lý tài khoản admin, bác sĩ và bệnh nhân.', '<button class="btn btn-primary" data-action="create-user">+ Thêm tài khoản</button>')}
      ${renderTable(['ID', 'Email', 'Vai trò', 'Trạng thái', 'Ngày tạo', 'Thao tác'], rows, 'Chưa có tài khoản.')}
    `;
  }

  async function renderAdminPatients() {
    const response = await api('/api/patients?limit=100');
    state.adminPatients = response.data;

    const rows = state.adminPatients.map((patient) => `
      <tr>
        <td>${patient.patient_id}</td>
        <td>${escapeHtml(patient.full_name)}</td>
        <td>${escapeHtml(formatDate(patient.date_of_birth))}</td>
        <td>${escapeHtml(genderLabel(patient.gender))}</td>
        <td>${escapeHtml(patient.phone || '—')}</td>
        <td>${escapeHtml(patient.email || '—')}</td>
        <td>${activeBadge(patient.is_active)}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="edit-patient" data-id="${patient.patient_id}">Sửa</button>
        </td>
      </tr>
    `).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Bệnh nhân', 'Danh sách hồ sơ hành chính của bệnh nhân.')}
      ${renderTable(['ID', 'Họ tên', 'Ngày sinh', 'Giới tính', 'SĐT', 'Email', 'Trạng thái', 'Thao tác'], rows, 'Chưa có bệnh nhân.')}
    `;
  }

  async function renderAdminDoctors() {
    const response = await api('/api/doctors');
    state.adminDoctors = response.data;

    const rows = state.adminDoctors.map((doctor) => `
      <tr>
        <td>${doctor.doctor_id}</td>
        <td>${escapeHtml(doctor.full_name)}</td>
        <td>${escapeHtml(doctor.specialty || '—')}</td>
        <td>${escapeHtml(doctor.license_number || '—')}</td>
        <td>${escapeHtml(doctor.phone || '—')}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="edit-doctor" data-id="${doctor.doctor_id}">Sửa</button>
        </td>
      </tr>
    `).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Bác sĩ', 'Danh sách bác sĩ đang hoạt động.')}
      ${renderTable(['ID', 'Họ tên', 'Chuyên khoa', 'Giấy phép', 'SĐT', 'Thao tác'], rows, 'Chưa có bác sĩ.')}
    `;
  }

  async function renderAdminMedicines() {
    const response = await api('/api/medicines?limit=100');
    state.adminMedicines = response.data;

    const rows = state.adminMedicines.map((medicine) => `
      <tr>
        <td>${medicine.medicine_id}</td>
        <td>${escapeHtml(medicine.medicine_code)}</td>
        <td>${escapeHtml(medicine.name)}</td>
        <td>${escapeHtml(medicine.active_ingredient || '—')}</td>
        <td>${escapeHtml(medicine.unit)}</td>
        <td>${medicine.stock_quantity}</td>
        <td>${medicine.is_prescription_only
          ? '<span class="badge badge-blue">Kê đơn</span>'
          : '<span class="badge badge-gray">Không kê đơn</span>'}</td>
        <td>${activeBadge(medicine.is_active)}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="edit-medicine" data-id="${medicine.medicine_id}">Sửa</button>
          <button class="btn btn-sm ${medicine.is_active ? 'btn-danger' : ''}" data-action="toggle-medicine" data-id="${medicine.medicine_id}" data-active="${medicine.is_active ? 'true' : 'false'}">${medicine.is_active ? 'Ngừng' : 'Mở'}</button>
        </td>
      </tr>
    `).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Kho thuốc', 'Quản lý danh mục thuốc và số lượng tồn. Admin không xem đơn thuốc của bệnh nhân.', '<button class="btn btn-primary" data-action="create-medicine">+ Thêm thuốc</button>')}
      ${renderTable(['ID', 'Mã', 'Tên thuốc', 'Hoạt chất', 'Đơn vị', 'Tồn', 'Loại', 'Trạng thái', 'Thao tác'], rows, 'Chưa có thuốc.')}
    `;
  }

  async function renderAdminAppointments(status = '') {
    const params = new URLSearchParams({ limit: '100' });
    if (status) params.set('status', status);

    const response = await api(`/api/appointments?${params.toString()}`);
    const appointments = response.data;

    const rows = appointments.map((appointment) => `
      <tr>
        <td>${appointment.appointment_id}</td>
        <td>${escapeHtml(appointment.patient_name)}</td>
        <td>${escapeHtml(appointment.doctor_name)}</td>
        <td>${escapeHtml(formatDateTime(appointment.scheduled_at))}</td>
        <td>${statusBadge(appointment.status)}</td>
        <td>${escapeHtml(truncate(appointment.reason || '—', 60))}</td>
      </tr>
    `).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Lịch hẹn', 'Admin xem lịch để quản lý, không xem nội dung bệnh án.')}
      <div class="toolbar">
        <label>Trạng thái
          <select id="admin-status-filter">
            <option value="">Tất cả</option>
            ${['pending', 'confirmed', 'completed', 'cancelled']
              .map((value) => `<option value="${value}" ${value === status ? 'selected' : ''}>${STATUS_LABELS[value]}</option>`)
              .join('')}
          </select>
        </label>
        <span class="muted">${appointments.length} lịch hẹn</span>
      </div>
      ${renderTable(['ID', 'Bệnh nhân', 'Bác sĩ', 'Thời gian', 'Trạng thái', 'Lý do'], rows, 'Chưa có lịch hẹn.')}
    `;

    const filter = $('#admin-status-filter');
    filter.addEventListener('change', async () => {
      try {
        await renderAdminAppointments(filter.value);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  async function renderAdminAudit() {
    const response = await api('/api/audit-logs?limit=100');
    const logs = response.data;

    const rows = logs.map((log) => `
      <tr>
        <td>${escapeHtml(formatDateTime(log.created_at))}</td>
        <td>${log.user_id === null ? '—' : log.user_id}</td>
        <td>${escapeHtml(ACTION_LABELS[log.action] || log.action)}</td>
        <td>${escapeHtml(log.entity || '—')}</td>
        <td>${escapeHtml(log.entity_id || '—')}</td>
        <td>${escapeHtml(log.ip || '—')}</td>
        <td>${resultBadge(log.result)}</td>
      </tr>
    `).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Audit log', '100 bản ghi gần nhất. Chỉ admin xem được mục này.', '<button class="btn" data-action="refresh-audit">Tải lại</button>')}
      ${renderTable(['Thời gian', 'User ID', 'Hành động', 'Đối tượng', 'Entity ID', 'IP', 'Kết quả'], rows, 'Chưa có audit log.')}
    `;
  }

  // ===== Màn hình bác sĩ =====
  async function renderDoctorAppointments() {
    const [appointmentsResponse, recordsResponse] = await Promise.all([
      api('/api/appointments?limit=100'),
      api('/api/records?limit=100')
    ]);

    state.doctorAppointments = appointmentsResponse.data;
    state.doctorRecords = recordsResponse.data;

    const recordByAppointment = new Map(
      state.doctorRecords.map((record) => [String(record.appointment_id), record])
    );

    const rows = state.doctorAppointments.map((appointment) => {
      const record = recordByAppointment.get(String(appointment.appointment_id));
      const actions = [
        `<button class="btn btn-sm" data-action="view-patient" data-id="${appointment.patient_id}">Bệnh nhân</button>`
      ];

      if (appointment.status === 'pending') {
        actions.push('<button class="btn btn-sm btn-primary" data-action="confirm-appointment" data-id="' + appointment.appointment_id + '">Xác nhận</button>');
        actions.push('<button class="btn btn-sm btn-danger" data-action="cancel-appointment" data-id="' + appointment.appointment_id + '">Hủy</button>');
      } else if (appointment.status === 'confirmed') {
        actions.push('<button class="btn btn-sm btn-primary" data-action="complete-appointment" data-id="' + appointment.appointment_id + '">Hoàn tất</button>');
        actions.push('<button class="btn btn-sm btn-danger" data-action="cancel-appointment" data-id="' + appointment.appointment_id + '">Hủy</button>');
      } else if (appointment.status === 'completed') {
        if (record) {
          actions.push(`<button class="btn btn-sm" data-action="view-record" data-id="${record.record_id}">Xem bệnh án</button>`);
        } else {
          actions.push(`<button class="btn btn-sm btn-primary" data-action="create-record" data-id="${appointment.appointment_id}">Tạo bệnh án</button>`);
        }
      }

      return `
        <tr>
          <td>${appointment.appointment_id}</td>
          <td>${escapeHtml(appointment.patient_name)}</td>
          <td>${escapeHtml(formatDateTime(appointment.scheduled_at))}</td>
          <td>${statusBadge(appointment.status)}</td>
          <td>${escapeHtml(truncate(appointment.reason || '—', 50))}</td>
          <td class="actions">${actions.join('')}</td>
        </tr>
      `;
    }).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Lịch hẹn của tôi', 'Xác nhận, hoàn tất hoặc hủy lịch hẹn.')}
      ${renderTable(['ID', 'Bệnh nhân', 'Thời gian', 'Trạng thái', 'Lý do', 'Thao tác'], rows, 'Chưa có lịch hẹn.')}
    `;
  }

  async function renderDoctorRecords() {
    const response = await api('/api/records?limit=100');
    state.doctorRecords = response.data;

    const rows = state.doctorRecords.map((record) => `
      <tr>
        <td>${record.record_id}</td>
        <td>${escapeHtml(record.patient_name)}</td>
        <td>${escapeHtml(formatDateTime(record.scheduled_at))}</td>
        <td>${escapeHtml(truncate(record.diagnosis || '—', 55))}</td>
        <td>${escapeHtml(truncate(record.treatment || '—', 55))}</td>
        <td>${escapeHtml(formatDateTime(record.updated_at))}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="view-record" data-id="${record.record_id}">Xem</button>
          <button class="btn btn-sm" data-action="edit-record" data-id="${record.record_id}">Sửa</button>
          ${record.has_prescription
            ? `<button class="btn btn-sm" data-action="view-prescription" data-id="${record.record_id}">Đơn thuốc</button>`
            : `<button class="btn btn-sm btn-primary" data-action="create-prescription" data-id="${record.record_id}">Kê đơn</button>`}
        </td>
      </tr>
    `).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Bệnh án', 'Bệnh án của các lịch hẹn do bạn phụ trách. Có thể kê đơn thuốc cho từng bệnh án.')}
      ${renderTable(['ID', 'Bệnh nhân', 'Ngày hẹn', 'Chẩn đoán', 'Điều trị', 'Cập nhật', 'Thao tác'], rows, 'Chưa có bệnh án.')}
    `;
  }

  async function renderDoctorProfile() {
    const response = await api('/api/doctors/me');
    const doctor = response.data;
    state.profile = { ...(state.profile || {}), ...doctor };
    updateHeader();

    $('#main-content').innerHTML = `
      ${pageHead('Hồ sơ bác sĩ', 'Thông tin này hiển thị cho bệnh nhân khi đặt lịch.')}
      <div class="card">
        <form id="doctor-profile-form" class="form">
          <div class="readonly-box">
            Email đăng nhập: ${escapeHtml(state.user.email)}<br>
            Mã bác sĩ: ${escapeHtml(doctor.doctor_id)}<br>
            Giấy phép: ${escapeHtml(doctor.license_number || '—')}
          </div>
          <div class="form-grid">
            <label>Họ tên
              <input name="full_name" value="${escapeHtml(doctor.full_name || '')}" required>
            </label>
            <label>Chuyên khoa
              <input name="specialty" value="${escapeHtml(doctor.specialty || '')}">
            </label>
            <label>Số điện thoại
              <input name="phone" value="${escapeHtml(doctor.phone || '')}">
            </label>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
          </div>
        </form>
      </div>
    `;

    $('#doctor-profile-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);

      try {
        const updated = await api('/api/doctors/me', {
          method: 'PATCH',
          body: values
        });
        state.profile = { ...(state.profile || {}), ...updated.data };
        updateHeader();
        showToast('Đã cập nhật hồ sơ.');
        await renderDoctorProfile();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  // ===== Màn hình bệnh nhân =====
  async function renderPatientAppointments() {
    const response = await api('/api/appointments?limit=100');
    const appointments = response.data;

    const rows = appointments.map((appointment) => {
      const canCancel = appointment.status === 'pending' || appointment.status === 'confirmed';
      return `
        <tr>
          <td>${appointment.appointment_id}</td>
          <td>${escapeHtml(appointment.doctor_name)}</td>
          <td>${escapeHtml(formatDateTime(appointment.scheduled_at))}</td>
          <td>${statusBadge(appointment.status)}</td>
          <td>${escapeHtml(truncate(appointment.reason || '—', 60))}</td>
          <td class="actions">
            ${canCancel
              ? `<button class="btn btn-sm btn-danger" data-action="cancel-my-appointment" data-id="${appointment.appointment_id}">Hủy</button>`
              : '<span class="muted">—</span>'}
          </td>
        </tr>
      `;
    }).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Lịch hẹn của tôi', 'Bạn chỉ hủy được lịch đang chờ hoặc đã xác nhận.', '<button class="btn btn-primary" data-action="go-booking">+ Đặt lịch mới</button>')}
      ${renderTable(['ID', 'Bác sĩ', 'Thời gian', 'Trạng thái', 'Lý do', 'Thao tác'], rows, 'Bạn chưa có lịch hẹn.')}
    `;
  }

  async function renderPatientBooking() {
    const response = await api('/api/doctors');
    const doctors = response.data;

    const options = doctors.map((doctor) => {
      const specialty = doctor.specialty ? ` - ${escapeHtml(doctor.specialty)}` : '';
      return `<option value="${doctor.doctor_id}">${escapeHtml(doctor.full_name)}${specialty}</option>`;
    }).join('');

    const doctorCards = doctors.length
      ? doctors.map((doctor) => `
          <div class="doctor-card">
            <div>
              <strong>${escapeHtml(doctor.full_name)}</strong>
              <p>${escapeHtml(doctor.specialty || 'Chưa cập nhật chuyên khoa')}</p>
              <p>${escapeHtml(doctor.phone || 'Chưa có số điện thoại')}</p>
            </div>
            <button class="btn btn-sm" data-action="choose-doctor" data-id="${doctor.doctor_id}">Chọn</button>
          </div>
        `).join('')
      : '<div class="empty-state">Chưa có bác sĩ đang hoạt động.</div>';

    $('#main-content').innerHTML = `
      ${pageHead('Đặt lịch', 'Chọn bác sĩ, thời gian và ghi lý do khám.')}
      <div class="grid-two">
        <div class="card">
          <form id="booking-form" class="form">
            <label>Bác sĩ
              <select name="doctor_id" id="doctor_id" required ${doctors.length ? '' : 'disabled'}>
                ${options || '<option value="">Chưa có bác sĩ</option>'}
              </select>
            </label>
            <label>Thời gian
              <input name="scheduled_at" id="scheduled_at" type="datetime-local" required>
            </label>
            <label>Lý do khám
              <textarea name="reason" rows="3" placeholder="Ví dụ: tái khám, đau đầu..."></textarea>
            </label>
            <button class="btn btn-primary" type="submit" ${doctors.length ? '' : 'disabled'}>Đặt lịch</button>
          </form>
        </div>
        <div class="card">
          <h3>Bác sĩ đang hoạt động</h3>
          <div class="doctor-list">${doctorCards}</div>
        </div>
      </div>
    `;

    const timeInput = $('#scheduled_at');
    const now = new Date();
    timeInput.min = toLocalInput(now);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    timeInput.value = toLocalInput(tomorrow);

    $('#booking-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);
      const scheduled = new Date(values.scheduled_at);

      if (Number.isNaN(scheduled.getTime()) || scheduled <= new Date()) {
        showToast('Chọn thời gian trong tương lai.', 'error');
        return;
      }

      try {
        await api('/api/appointments', {
          method: 'POST',
          body: {
            doctor_id: values.doctor_id,
            scheduled_at: scheduled.toISOString(),
            reason: values.reason
          }
        });
        showToast('Đã đặt lịch. Chờ bác sĩ xác nhận nhé.');
        await navigate('patient-appointments');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  async function renderPatientRecords() {
    const response = await api('/api/records?limit=100');
    const records = response.data;

    const rows = records.map((record) => `
      <tr>
        <td>${record.record_id}</td>
        <td>${escapeHtml(record.doctor_name)}</td>
        <td>${escapeHtml(formatDateTime(record.scheduled_at))}</td>
        <td>${escapeHtml(truncate(record.diagnosis || '—', 60))}</td>
        <td class="actions">
          <button class="btn btn-sm" data-action="view-record" data-id="${record.record_id}">Xem</button>
          ${record.has_prescription
            ? `<button class="btn btn-sm" data-action="view-prescription" data-id="${record.record_id}">Đơn thuốc</button>`
            : ''}
        </td>
      </tr>
    `).join('');

    $('#main-content').innerHTML = `
      ${pageHead('Bệnh án của tôi', 'Chỉ hiển thị bệnh án và đơn thuốc của chính bạn.')}
      ${renderTable(['ID', 'Bác sĩ', 'Ngày hẹn', 'Chẩn đoán', 'Thao tác'], rows, 'Bạn chưa có bệnh án.')}
    `;
  }

  async function renderPatientProfile() {
    const response = await api('/api/patients/me');
    const patient = response.data;
    state.profile = { ...(state.profile || {}), ...patient };
    updateHeader();

    $('#main-content').innerHTML = `
      ${pageHead('Hồ sơ của tôi', 'Cập nhật thông tin liên hệ và ngày sinh.')}
      <div class="card">
        <form id="patient-profile-form" class="form">
          <div class="readonly-box">
            Email đăng nhập: ${escapeHtml(state.user.email)}<br>
            Mã bệnh nhân: ${escapeHtml(patient.patient_id)}
          </div>
          <div class="form-grid">
            <label>Họ tên
              <input name="full_name" value="${escapeHtml(patient.full_name || '')}" required>
            </label>
            <label>Ngày sinh
              <input name="date_of_birth" type="date" value="${escapeHtml(patient.date_of_birth || '')}">
            </label>
            <label>Giới tính
              <select name="gender">
                <option value="">Chưa cập nhật</option>
                <option value="male" ${patient.gender === 'male' ? 'selected' : ''}>Nam</option>
                <option value="female" ${patient.gender === 'female' ? 'selected' : ''}>Nữ</option>
                <option value="other" ${patient.gender === 'other' ? 'selected' : ''}>Khác</option>
              </select>
            </label>
            <label>Số điện thoại
              <input name="phone" value="${escapeHtml(patient.phone || '')}">
            </label>
          </div>
          <label>Địa chỉ
            <textarea name="address" rows="2">${escapeHtml(patient.address || '')}</textarea>
          </label>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
          </div>
        </form>
      </div>
    `;

    $('#patient-profile-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = formValues(event.currentTarget);

      try {
        const updated = await api('/api/patients/me', {
          method: 'PATCH',
          body: values
        });
        state.profile = { ...(state.profile || {}), ...updated.data };
        updateHeader();
        showToast('Đã cập nhật hồ sơ.');
        await renderPatientProfile();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  // Bảng ánh xạ view -> hàm render, dùng trong navigate().
  const RENDERERS = {
    'admin-users': renderAdminUsers,
    'admin-patients': renderAdminPatients,
    'admin-doctors': renderAdminDoctors,
    'admin-medicines': renderAdminMedicines,
    'admin-appointments': renderAdminAppointments,
    'admin-audit': renderAdminAudit,
    'doctor-appointments': renderDoctorAppointments,
    'doctor-records': renderDoctorRecords,
    'doctor-profile': renderDoctorProfile,
    'patient-appointments': renderPatientAppointments,
    'patient-booking': renderPatientBooking,
    'patient-records': renderPatientRecords,
    'patient-profile': renderPatientProfile
  };

  // ===== Hàm hiển thị dùng chung =====
  function pageHead(title, subtitle, actions = '') {
    return `
      <div class="page-head">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        ${actions ? `<div class="page-actions">${actions}</div>` : ''}
      </div>
    `;
  }

  function renderTable(headers, rows, emptyText) {
    if (!rows) {
      return `<div class="empty-state">${escapeHtml(emptyText || 'Chưa có dữ liệu.')}</div>`;
    }

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function loadingState() {
    return '<div class="loading-state"><span class="spinner"></span>Đang tải dữ liệu...</div>';
  }

  function errorState(error) {
    return `
      <div class="error-state">
        <h2>Không tải được dữ liệu</h2>
        <p>${escapeHtml(error.message || 'Có lỗi xảy ra.')}</p>
        <button class="btn" data-action="reload-view">Thử lại</button>
      </div>
    `;
  }

  function detailItem(label, value, full = false) {
    const text = value === null || value === undefined || value === '' ? '—' : String(value);
    return `
      <div class="${full ? 'detail-full' : ''}">
        <span class="detail-label">${escapeHtml(label)}</span>
        <div class="pre-wrap">${escapeHtml(text)}</div>
      </div>
    `;
  }

  function roleBadge(role) {
    const classes = { admin: 'badge-blue', doctor: 'badge-green', patient: 'badge-gray' };
    return `<span class="badge ${classes[role] || 'badge-gray'}">${escapeHtml(ROLE_LABELS[role] || role)}</span>`;
  }

  function activeBadge(isActive) {
    return isActive
      ? '<span class="badge badge-green">Hoạt động</span>'
      : '<span class="badge badge-gray">Đã khóa</span>';
  }

  function statusBadge(status) {
    const classes = {
      pending: 'badge-warning',
      confirmed: 'badge-blue',
      completed: 'badge-green',
      cancelled: 'badge-red'
    };
    return `<span class="badge ${classes[status] || 'badge-gray'}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
  }

  function resultBadge(result) {
    const classes = {
      success: 'badge-green',
      failed: 'badge-red',
      denied: 'badge-warning'
    };
    const labels = {
      success: 'Thành công',
      failed: 'Thất bại',
      denied: 'Bị từ chối'
    };
    return `<span class="badge ${classes[result] || 'badge-gray'}">${escapeHtml(labels[result] || result || '—')}</span>`;
  }

  function genderLabel(gender) {
    const labels = { male: 'Nam', female: 'Nữ', other: 'Khác' };
    return labels[gender] || '—';
  }

  function formValues(form) {
    const result = {};
    for (const [key, value] of new FormData(form).entries()) {
      const text = typeof value === 'string' ? value.trim() : value;
      if (text !== '') result[key] = text;
    }
    return result;
  }

  function pick(source, keys) {
    const result = {};
    keys.forEach((key) => {
      if (source[key] !== undefined) result[key] = source[key];
    });
    return result;
  }

  function truncate(value, maxLength) {
    const text = String(value || '');
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function toDate(value) {
    if (!value) return null;
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(value) {
    const date = toDate(value);
    return date
      ? date.toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      : '—';
  }

  function formatDate(value) {
    const date = toDate(value);
    return date
      ? date.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      : '—';
  }

  function toLocalInput(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('-') + 'T' + [
      pad(date.getHours()),
      pad(date.getMinutes())
    ].join(':');
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }
})();
