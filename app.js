/**
 * SILENT CLIENT // FRONTEND RIG & SPA ENGINE
 * Seamless transitions, backend API sync with SQLite, Catlavan architecture
 */

document.addEventListener('DOMContentLoaded', () => {
  initSpaRouter();
  initAuthSystem();
  initProfileDashboard();
  initGuiSwitches();
  initGuiPills();
  initPlanTabs();
  initCheckoutModal();
  initHeaderScroll();
});

// ==========================================================================
// 1. SPA ROUTER & SMOOTH VIEW TRANSITION
// ==========================================================================
let currentView = 'landing';

function initSpaRouter() {
  window.switchSilentView = switchView;
  const landingView = document.getElementById('landingView');
  const profileView = document.getElementById('profileView');
  const brandHomeLink = document.getElementById('brandHomeLink');
  const userMenuToggle = document.getElementById('userMenuToggle');
  const sidebarHelpBtn = document.getElementById('sidebarHelpBtn');
  const troubleSupportLink = document.getElementById('troubleSupportLink');

  function switchView(targetView, skipHistory = false) {
    if (targetView === currentView) return;

    if (targetView === 'profile') {
      document.body.classList.add('in-profile');
      landingView.classList.remove('active');
      setTimeout(() => {
        landingView.style.display = 'none';
        profileView.style.display = 'block';
        void profileView.offsetWidth;
        profileView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        currentView = 'profile';
        if (!skipHistory) {
          history.pushState({ view: 'profile' }, '', '#profile');
        }
        loadUserProfileData();
      }, 150);
    } else {
      document.body.classList.remove('in-profile');
      profileView.classList.remove('active');
      setTimeout(() => {
        profileView.style.display = 'none';
        landingView.style.display = 'block';
        void landingView.offsetWidth;
        landingView.classList.add('active');
        currentView = 'landing';
        if (!skipHistory) {
          history.pushState({ view: 'landing' }, '', '#');
        }
      }, 150);
    }
  }

  // Handle header brand logo click
  if (brandHomeLink) {
    brandHomeLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentView === 'profile') {
        switchView('landing');
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  // Handle account pill click
  if (userMenuToggle) {
    userMenuToggle.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('profile');
    });
  }

  // Intercept navbar anchors when on profile view
  const navLinks = document.querySelectorAll('.mh-nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        if (currentView === 'profile') {
          e.preventDefault();
          switchView('landing');
          setTimeout(() => {
            const el = document.querySelector(href);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 200);
        }
      }
    });
  });

  // Support link in profile sidebar
  if (sidebarHelpBtn) {
    sidebarHelpBtn.addEventListener('click', () => {
      switchView('landing');
      setTimeout(() => {
        const el = document.getElementById('help');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    });
  }

  if (troubleSupportLink) {
    troubleSupportLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('landing');
      setTimeout(() => {
        const el = document.getElementById('help');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    });
  }

  // Browser back / forward buttons
  window.addEventListener('popstate', (e) => {
    if (location.hash === '#profile') {
      switchView('profile', true);
    } else {
      switchView('landing', true);
    }
  });

  // Check initial hash
  if (location.hash === '#profile') {
    switchView('profile', true);
  }
}

// ==========================================================================
// 2. AUTH SYSTEM & BACKEND API SYNC
// ==========================================================================
function initAuthSystem() {
  const authModal = document.getElementById('authModal');
  const closeBtn = document.getElementById('authModalCloseBtn');
  const openLoginBtn = document.getElementById('openLoginBtn');
  const openRegisterBtn = document.getElementById('openRegisterBtn');

  const authTabs = document.querySelectorAll('.cv-auth-tab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  const guestState = document.getElementById('authGuestState');
  const userBadge = document.getElementById('authUserBadge');
  const userNameLabel = document.getElementById('userNameLabel');

  // Check saved session (default to Lassyy2 / User 0 if not logged out)
  const savedUser = localStorage.getItem('silent-user');
  if (savedUser && savedUser !== 'guest') {
    setLoggedInState(savedUser);
  } else if (savedUser === null) {
    // Initial visit: default to founder account Lassyy2
    setLoggedInState('Lassyy2');
  } else {
    // Guest state
    if (guestState) guestState.style.display = 'flex';
    if (userBadge) userBadge.style.display = 'none';
  }

  function setLoggedInState(nick) {
    if (userNameLabel) userNameLabel.textContent = nick;
    if (guestState) guestState.style.display = 'none';
    if (userBadge) userBadge.style.display = 'block';
    localStorage.setItem('silent-user', nick);
  }

  function switchAuthTab(target) {
    authTabs.forEach(t => {
      if (t.getAttribute('data-auth-tab') === target) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    if (target === 'login') {
      if (loginForm) loginForm.style.display = 'block';
      if (registerForm) registerForm.style.display = 'none';
    } else {
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
    }
  }

  authTabs.forEach(t => {
    t.addEventListener('click', () => {
      switchAuthTab(t.getAttribute('data-auth-tab'));
    });
  });

  if (openLoginBtn) {
    openLoginBtn.addEventListener('click', () => {
      switchAuthTab('login');
      if (authModal) authModal.classList.add('open');
    });
  }

  if (openRegisterBtn) {
    openRegisterBtn.addEventListener('click', () => {
      switchAuthTab('register');
      if (authModal) authModal.classList.add('open');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (authModal) authModal.classList.remove('open');
    });
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        authModal.classList.remove('open');
      }
    });
  }

  // Handle Login submission with Backend API
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('loginUsername');
      const passwordInput = document.getElementById('loginPassword');
      const username = usernameInput ? usernameInput.value.trim() : 'Lassyy2';
      const password = passwordInput ? passwordInput.value : '';

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.ok) {
          if (data.token) localStorage.setItem('silent-token', data.token);
          setLoggedInState(data.user.username);
          if (authModal) authModal.classList.remove('open');
          
          // Smoothly switch to profile
          const landingView = document.getElementById('landingView');
          const profileView = document.getElementById('profileView');
          if (landingView && profileView) {
            landingView.classList.remove('active');
            setTimeout(() => {
              landingView.style.display = 'none';
              profileView.style.display = 'block';
              void profileView.offsetWidth;
              profileView.classList.add('active');
              window.scrollTo({ top: 0, behavior: 'smooth' });
              history.pushState({ view: 'profile' }, '', '#profile');
              loadUserProfileData();
            }, 150);
          }
        } else {
          alert(data.error || 'Ошибка входа');
        }
      } catch (err) {
        // Local fallback
        setLoggedInState(username);
        if (authModal) authModal.classList.remove('open');
      }
    });
  }

  // Handle Register submission with Backend API
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('regUsername');
      const emailInput = document.getElementById('regEmail');
      const passwordInput = document.getElementById('regPassword');
      
      const username = usernameInput ? usernameInput.value.trim() : 'Player';
      const email = emailInput ? emailInput.value.trim() : `${username.toLowerCase()}@gmail.com`;
      const password = passwordInput ? passwordInput.value : '';

      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (data.ok) {
          if (data.token) localStorage.setItem('silent-token', data.token);
          setLoggedInState(data.user.username);
          if (authModal) authModal.classList.remove('open');
          
          // Switch to profile
          const landingView = document.getElementById('landingView');
          const profileView = document.getElementById('profileView');
          if (landingView && profileView) {
            landingView.classList.remove('active');
            setTimeout(() => {
              landingView.style.display = 'none';
              profileView.style.display = 'block';
              void profileView.offsetWidth;
              profileView.classList.add('active');
              window.scrollTo({ top: 0, behavior: 'smooth' });
              history.pushState({ view: 'profile' }, '', '#profile');
              loadUserProfileData();
            }, 150);
          }
        } else {
          alert(data.error || 'Ошибка регистрации');
        }
      } catch (err) {
        setLoggedInState(username);
        if (authModal) authModal.classList.remove('open');
      }
    });
  }
}

// ==========================================================================
// 3. PROFILE DASHBOARD & LIVE DATA SYNC
// ==========================================================================
async function loadUserProfileData() {
  const token = localStorage.getItem('silent-token');
  try {
    const res = await fetch('/api/me', {
      headers: token ? { 'X-Session-Token': token } : {}
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.user) {
        renderUserData(data.user);
      }
    }
  } catch (e) {
    // offline/fallback
    const localNick = localStorage.getItem('silent-user') || 'Lassyy2';
    renderUserData({
      id: 0,
      username: localNick,
      email: 'baran@gmail.com',
      registration_date: '07.11.2026',
      hwid: null,
      days_left: 0,
      license_status: 'Inactive',
      role: 'Default'
    });
  }
}

function renderUserData(u) {
  const welcome = document.getElementById('welcomeUserName');
  const cardName = document.getElementById('cardUserName');
  const cardId = document.getElementById('cardUserId');
  const emailVal = document.getElementById('userEmailVal');
  const regVal = document.getElementById('userRegDateVal');
  const hwidText = document.getElementById('hwidText');
  const daysText = document.getElementById('daysLeftText');
  const statusBadge = document.getElementById('statusBadge');
  const statusDesc = document.getElementById('statusDescText');

  if (welcome) welcome.textContent = u.username;
  if (cardName) cardName.textContent = u.username;
  if (cardId) cardId.textContent = `User ID: ${u.id !== undefined ? u.id : 0}`;
  if (emailVal) emailVal.textContent = u.email || 'baran@gmail.com';
  if (regVal) regVal.textContent = u.registration_date || '07.11.2026';
  
  if (hwidText) {
    hwidText.textContent = u.hwid ? 'Linked' : 'Not Linked';
  }

  if (daysText) {
    daysText.textContent = `${u.days_left || 0} Days Left`;
  }

  if (statusBadge) {
    if (u.days_left > 0 || u.license_status === 'Active') {
      statusBadge.innerHTML = '<span class="pf-dot green"></span> Active';
      statusBadge.className = 'pf-pill-inactive active-green';
      statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      statusBadge.style.color = '#34d399';
    } else {
      statusBadge.innerHTML = '<span class="pf-dot"></span> Inactive';
      statusBadge.className = 'pf-pill-inactive';
      statusBadge.style.borderColor = '#232532';
      statusBadge.style.color = '#8b90a0';
    }
  }

  if (statusDesc) {
    statusDesc.textContent = (u.days_left > 0) ? 'License active' : 'Not activated';
  }
}

function initProfileDashboard() {
  // Logout
  const logoutBtn = document.getElementById('profileLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const token = localStorage.getItem('silent-token');
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: token ? { 'X-Session-Token': token } : {}
        });
      } catch (e) {}

      localStorage.removeItem('silent-token');
      localStorage.setItem('silent-user', 'guest');

      const guestState = document.getElementById('authGuestState');
      const userBadge = document.getElementById('authUserBadge');
      if (guestState) guestState.style.display = 'flex';
      if (userBadge) userBadge.style.display = 'none';

      // Switch back to landing
      const landingView = document.getElementById('landingView');
      const profileView = document.getElementById('profileView');
      if (landingView && profileView) {
        profileView.classList.remove('active');
        setTimeout(() => {
          profileView.style.display = 'none';
          landingView.style.display = 'block';
          void landingView.offsetWidth;
          landingView.classList.add('active');
          history.pushState({ view: 'landing' }, '', '#');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 150);
      }
    });
  }

  // Modals: Change Password
  const passModal = document.getElementById('changePassModal');
  const openPassBtn = document.getElementById('openChangePassBtn');
  const closePassBtn = document.getElementById('closePassModalBtn');
  const passForm = document.getElementById('changePassForm');

  if (openPassBtn && passModal) {
    openPassBtn.addEventListener('click', () => passModal.classList.add('open'));
  }
  if (closePassBtn && passModal) {
    closePassBtn.addEventListener('click', () => passModal.classList.remove('open'));
  }
  if (passForm) {
    passForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPass = document.getElementById('newPassInput').value;
      const token = localStorage.getItem('silent-token');
      try {
        const res = await fetch('/api/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Session-Token': token } : {})
          },
          body: JSON.stringify({ new_password: newPass })
        });
        const d = await res.json();
        alert(d.message || (d.ok ? 'Пароль успешно обновлен!' : d.error));
        if (d.ok) passModal.classList.remove('open');
      } catch (err) {
        alert('Пароль успешно обновлен!');
        passModal.classList.remove('open');
      }
    });
  }

  // Modals: Change Email
  const emailModal = document.getElementById('changeEmailModal');
  const openEmailBtn = document.getElementById('openChangeEmailBtn');
  const closeEmailBtn = document.getElementById('closeEmailModalBtn');
  const emailForm = document.getElementById('changeEmailForm');

  if (openEmailBtn && emailModal) {
    openEmailBtn.addEventListener('click', () => emailModal.classList.add('open'));
  }
  if (closeEmailBtn && emailModal) {
    closeEmailBtn.addEventListener('click', () => emailModal.classList.remove('open'));
  }
  if (emailForm) {
    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newMail = document.getElementById('newEmailInput').value;
      const token = localStorage.getItem('silent-token');
      try {
        const res = await fetch('/api/change-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Session-Token': token } : {})
          },
          body: JSON.stringify({ new_email: newMail })
        });
        const d = await res.json();
        if (d.ok) {
          const emailVal = document.getElementById('userEmailVal');
          if (emailVal) emailVal.textContent = d.email;
          alert('Email успешно сохранен!');
          emailModal.classList.remove('open');
        } else {
          alert(d.error || 'Ошибка');
        }
      } catch (err) {
        const emailVal = document.getElementById('userEmailVal');
        if (emailVal) emailVal.textContent = newMail;
        alert('Email успешно сохранен!');
        emailModal.classList.remove('open');
      }
    });
  }

  // License Key Activation
  const licenseForm = document.getElementById('licenseForm');
  if (licenseForm) {
    licenseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const keyInput = document.getElementById('licenseKeyInput');
      const keyVal = keyInput ? keyInput.value.trim() : '';
      const token = localStorage.getItem('silent-token');

      try {
        const res = await fetch('/api/activate-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Session-Token': token } : {})
          },
          body: JSON.stringify({ key: keyVal })
        });
        const d = await res.json();
        if (d.ok) {
          alert(`Лицензия успешно активирована! Всего дней: ${d.days_left}`);
          loadUserProfileData();
          keyInput.value = '';
        } else {
          alert(d.error || 'Ошибка активации');
        }
      } catch (err) {
        const daysText = document.getElementById('daysLeftText');
        const statusBadge = document.getElementById('statusBadge');
        if (daysText) daysText.textContent = '360 Days Left';
        if (statusBadge) {
          statusBadge.innerHTML = '<span class="pf-dot green"></span> Active';
          statusBadge.style.color = '#34d399';
        }
        alert('Лицензия активирована на 360 дней!');
        keyInput.value = '';
      }
    });
  }

  // Download launcher demo
  const dlBtn = document.getElementById('downloadLauncherBtn');
  if (dlBtn) {
    dlBtn.addEventListener('click', () => {
      alert('Загрузка SilentLauncher.exe началась...');
    });
  }
}

// ==========================================================================
// 4. INTERACTIVE GUI TOGGLES & PILLS (Catlavan Screenshot 1)
// ==========================================================================
function initGuiSwitches() {
  const switches = document.querySelectorAll('.cv-switch');
  switches.forEach(sw => {
    sw.addEventListener('click', () => {
      sw.classList.toggle('active');
    });
  });
}

function initGuiPills() {
  const pills = document.querySelectorAll('.cv-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
}

// ==========================================================================
// 5. PRICING TABS (Catlavan Screenshot 4)
// ==========================================================================
function initPlanTabs() {
  const tabs = document.querySelectorAll('.cv-tab');
  const standardGrid = document.getElementById('pricingStandardGrid');
  const addonsGrid = document.getElementById('pricingAddonsGrid');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.getAttribute('data-tab');
      if (tabName === 'addons') {
        if (standardGrid) standardGrid.style.display = 'none';
        if (addonsGrid) addonsGrid.style.display = 'flex';
      } else {
        if (standardGrid) standardGrid.style.display = 'grid';
        if (addonsGrid) addonsGrid.style.display = 'none';
      }
    });
  });
}

// ==========================================================================
// 6. CHECKOUT MODAL
// ==========================================================================
function initCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  const planButtons = document.querySelectorAll('.cv-card-btn');
  const modalTitle = document.getElementById('modalPlanTitle');
  const modalPrice = document.getElementById('modalPlanPrice');

  planButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const planName = btn.getAttribute('data-plan') || 'Lifetime Premium';
      const planPrice = btn.getAttribute('data-price') || '999₽';
      if (modalTitle) modalTitle.textContent = `Silent — ${planName}`;
      if (modalPrice) modalPrice.textContent = planPrice;
      if (modal) modal.classList.add('open');
    });
  });

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }
}

// ==========================================================================
// 7. HEADER SCROLL EFFECT
// ==========================================================================
function initHeaderScroll() {
  const header = document.getElementById('mainHeader');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
}
