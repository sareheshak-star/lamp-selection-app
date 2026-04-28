/* ══════════════════════════════════════════════════════════════
   UVC Lamp Selection System — Client Application Logic
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // --- DOM References ---
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userGreeting = document.getElementById('user-greeting');

  const calcForm = document.getElementById('calc-form');
  const calcBtn = document.getElementById('calc-btn');
  const coilWidthInput = document.getElementById('coil-width');
  const coilHeightInput = document.getElementById('coil-height');
  const resultsSection = document.getElementById('results-section');

  const opt1Length = document.getElementById('opt1-length');
  const opt1LampsPerRow = document.getElementById('opt1-lamps-per-row');
  const opt1Rows = document.getElementById('opt1-rows');
  const opt1Total = document.getElementById('opt1-total');
  const opt2Length = document.getElementById('opt2-length');
  const opt2LampsPerRow = document.getElementById('opt2-lamps-per-row');
  const opt2Rows = document.getElementById('opt2-rows');
  const opt2Total = document.getElementById('opt2-total');

  // --- Management DOM References ---
  const mgmtBtn = document.getElementById('mgmt-btn');
  const mgmtView = document.getElementById('mgmt-view');
  const calcView = document.getElementById('calc-view');
  const backToCalcBtn = document.getElementById('back-to-calc-btn');
  const userListContainer = document.getElementById('user-list-container');
  
  const addUserPanel = document.getElementById('add-user-panel');
  const addUserForm = document.getElementById('add-user-form');
  const addUserBtn = document.getElementById('add-user-btn');

  const editUserPanel = document.getElementById('edit-user-panel');
  const editUserForm = document.getElementById('edit-user-form');
  const editUserEmailInput = document.getElementById('edit-user-email');
  const editUserRoleSelect = document.getElementById('edit-user-role');
  const editingEmailDisplay = document.getElementById('editing-email-display');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  let currentUser = null;

  // --- Screen Navigation ---
  function showScreen(screen) {
    loginScreen.classList.remove('active');
    appScreen.classList.remove('active');
    screen.classList.add('active');
  }

  function showTab(view) {
    calcView.classList.add('hidden');
    mgmtView.classList.add('hidden');
    view.classList.remove('hidden');
    
    // Clear any active results when switching
    if (view === mgmtView) {
      loadUsers();
    }
  }

  // --- Check Auth on Load ---
  async function checkAuth() {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (data.authenticated) {
        enterApp(data.user);
      } else {
        showScreen(loginScreen);
      }
    } catch (err) {
      showScreen(loginScreen);
    }
  }

  function enterApp(user) {
    currentUser = user;
    userGreeting.textContent = `Hello, ${user.name || user.email}`;
    showScreen(appScreen);
    
    // Role-based visibility
    if (user.role === 'admin') {
      mgmtBtn.classList.remove('hidden');
    } else {
      mgmtBtn.classList.add('hidden');
    }

    // Reset UI
    resultsSection.classList.add('hidden');
    showTab(calcView);
    coilWidthInput.value = '';
    coilHeightInput.value = '';
  }

  // --- Login ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    loginBtn.classList.add('loading');

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        enterApp(data.user);
      } else {
        loginError.textContent = data.error || 'Login failed. Please try again.';
        loginPassword.value = '';
        loginPassword.focus();
      }
    } catch (err) {
      loginError.textContent = 'Network error. Please check your connection.';
    } finally {
      loginBtn.classList.remove('loading');
    }
  });

  // --- Logout ---
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) { /* ignore */ }
    loginPassword.value = '';
    loginError.textContent = '';
    showScreen(loginScreen);
  });

  // --- Calculate ---
  calcForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    calcBtn.classList.add('loading');

    const coilWidth = parseFloat(coilWidthInput.value);
    const coilHeight = parseFloat(coilHeightInput.value);

    if (isNaN(coilWidth) || coilWidth < 14) {
      coilWidthInput.focus();
      calcBtn.classList.remove('loading');
      return;
    }
    if (isNaN(coilHeight) || coilHeight <= 0) {
      coilHeightInput.focus();
      calcBtn.classList.remove('loading');
      return;
    }

    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coilWidth, coilHeight })
      });

      if (res.status === 401) {
        // Session expired
        showScreen(loginScreen);
        loginError.textContent = 'Session expired. Please sign in again.';
        return;
      }

      const data = await res.json();

      if (res.ok) {
        displayResults(data);
      } else {
        alert(data.error || 'Calculation failed.');
      }
    } catch (err) {
      alert('Network error. Please check your connection.');
    } finally {
      calcBtn.classList.remove('loading');
    }
  });

  // --- Display Results ---
  function displayResults(data) {
    const { option1, option2 } = data;

    // Show results section with animation
    resultsSection.classList.remove('hidden');

    // Animate values
    animateValue(opt1Length, option1.lampLength);
    animateValue(opt1LampsPerRow, option1.lampsPerRow);
    animateValue(opt1Rows, option1.numberOfRows);
    animateValue(opt1Total, option1.totalLamps);

    animateValue(opt2Length, option2.lampLength);
    animateValue(opt2LampsPerRow, option2.lampsPerRow);
    animateValue(opt2Rows, option2.numberOfRows);
    animateValue(opt2Total, option2.totalLamps);

    // Scroll into view
    setTimeout(() => {
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function animateValue(element, value) {
    element.classList.remove('counting');
    // Trigger reflow for animation restart
    void element.offsetWidth;
    element.textContent = value;
    element.classList.add('counting');
    // Remove class after animation
    setTimeout(() => element.classList.remove('counting'), 400);
  }

  // --- User Management Logic ---
  mgmtBtn.addEventListener('click', () => showTab(mgmtView));
  backToCalcBtn.addEventListener('click', () => showTab(calcView));

  async function loadUsers() {
    userListContainer.innerHTML = '<div class="loading-spinner">Loading users...</div>';
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to load users');
      const users = await res.json();
      renderUserList(users);
    } catch (err) {
      userListContainer.innerHTML = `<div class="error-message">Error: ${err.message}</div>`;
    }
  }

  function renderUserList(users) {
    if (users.length === 0) {
      userListContainer.innerHTML = '<div class="loading-spinner">No users found.</div>';
      return;
    }

    userListContainer.innerHTML = users.map(user => `
      <div class="user-item">
        <div class="user-info">
          <span class="user-name">${user.email}</span>
        </div>
        <div class="user-actions">
          <span class="role-tag role-${user.role}">${user.role}</span>
          <button class="btn-ghost user-item-btn btn-edit" data-email="${user.email}" data-role="${user.role}" title="Edit user">
            <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
          </button>
          ${user.email !== currentUser.email ? `
            <button class="btn-ghost user-item-btn btn-delete" data-email="${user.email}" title="Delete user">
              <svg viewBox="0 0 20 20" fill="currentColor" style="width:16px;height:16px;"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

    // Add event listeners
    userListContainer.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(btn.dataset.email));
    });
    userListContainer.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditPanel(btn.dataset.email, btn.dataset.role));
    });
  }

  function openEditPanel(email, role) {
    addUserPanel.classList.add('hidden');
    editUserPanel.classList.remove('hidden');
    
    editingEmailDisplay.textContent = email;
    editUserEmailInput.value = email;
    editUserRoleSelect.value = role;
    
    // Clear password fields
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-confirm').value = '';
    
    editUserPanel.scrollIntoView({ behavior: 'smooth' });
  }

  cancelEditBtn.addEventListener('click', () => {
    editUserPanel.classList.add('hidden');
    addUserPanel.classList.remove('hidden');
  });

  async function deleteUser(email) {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;

    try {
      const res = await fetch(`/api/users/${email}`, { method: 'DELETE' });
      if (res.ok) {
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  }

  addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const confirm = document.getElementById('new-user-confirm').value;
    const role = document.getElementById('new-user-role').value;

    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }

    addUserBtn.classList.add('loading');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });

      if (res.ok) {
        addUserForm.reset();
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add user');
      }
    } catch (err) {
      alert('Error connecting to server');
    } finally {
      addUserBtn.classList.remove('loading');
    }
  });

  editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = editUserEmailInput.value;
    const password = document.getElementById('edit-user-password').value;
    const confirm = document.getElementById('edit-user-confirm').value;
    const role = editUserRoleSelect.value;

    if (password && password !== confirm) {
      alert('Passwords do not match');
      return;
    }

    const updateBtn = document.getElementById('update-user-btn');
    updateBtn.classList.add('loading');
    
    try {
      const res = await fetch(`/api/users/${email}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password || undefined, role })
      });

      if (res.ok) {
        editUserPanel.classList.add('hidden');
        addUserPanel.classList.remove('hidden');
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update user');
      }
    } catch (err) {
      alert('Error connecting to server');
    } finally {
      updateBtn.classList.remove('loading');
    }
  });

  // --- Init ---
  checkAuth();
})();
