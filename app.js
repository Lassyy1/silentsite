
// ==========================================================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================================================
const SUPABASE_URL = 'https://zqbfnscycruydgeiexwp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4nzCvZvgErwyrIyDiRRJ1A_zAS14etW';

let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
      console.warn('Supabase init notice:', e);
    }
  }
  return supabaseClient;
}


// ==========================================================================
// 0. THEME SWITCHER (Light / Dark)
// ==========================================================================
function initThemeToggle() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  const savedTheme = localStorage.getItem('silent_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('silent_theme', nextTheme);
    });
  }
}

/**
 * SILENT CLIENT // FRONTEND RIG & SPA ENGINE
 * Seamless transitions, backend API sync with SQLite, Catlavan architecture
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
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

  function setLoggedInState(nick) {
    if (userNameLabel) userNameLabel.textContent = nick;
    if (guestState) guestState.style.display = 'none';
    if (userBadge) userBadge.style.display = 'block';
  }

  function setLoggedOutState() {
    if (guestState) guestState.style.display = 'flex';
    if (userBadge) userBadge.style.display = 'none';
  }

  // Check Supabase session on startup
  const sb = getSupabase();
  if (sb) {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user) {
        const nick = session.user.user_metadata?.username || session.user.email.split('@')[0];
        setLoggedInState(nick);
        loadUserProfileData();
      } else {
        setLoggedOutState();
      }
    });

    sb.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        const nick = session.user.user_metadata?.username || session.user.email.split('@')[0];
        setLoggedInState(nick);
        loadUserProfileData();
      } else {
        setLoggedOutState();
      }
    });
  } else {
    // Fallback default state
    setLoggedOutState();
  }

  // Switch tabs in modal
  function switchAuthTab(targetTab) {
    authTabs.forEach(t => {
      if (t.getAttribute('data-auth-tab') === targetTab) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    if (targetTab === 'login') {
      if (loginForm) loginForm.style.display = 'block';
      if (registerForm) registerForm.style.display = 'none';
    } else {
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
    }
  }

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-auth-tab');
      switchAuthTab(tabName);
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

  // Live Supabase Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('loginUsername');
      const passwordInput = document.getElementById('loginPassword');
      const userOrEmail = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      const sb = getSupabase();
      if (!sb) {
        alert('Supabase клиент недоступен.');
        return;
      }

      let email = userOrEmail;
      if (!email.includes('@')) {
        // Look up email by username
        try {
          const { data: p } = await sb.from('profiles').select('email').eq('username', userOrEmail).single();
          if (p && p.email) {
            email = p.email;
          } else {
            email = `${userOrEmail.toLowerCase()}@silent.client`;
          }
        } catch (_) {
          email = `${userOrEmail.toLowerCase()}@silent.client`;
        }
      }

      const { data, error } = await sb.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        alert('Ошибка входа: ' + (error.message || 'Неверный логин или пароль'));
        return;
      }

      if (data && data.user) {
        const nick = data.user.user_metadata?.username || userOrEmail;
        setLoggedInState(nick);
        if (authModal) authModal.classList.remove('open');
        if (window.switchSilentView) window.switchSilentView('profile');
        loadUserProfileData();
      }
    });
  }

  // Live Supabase Register
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('regUsername');
      const emailInput = document.getElementById('regEmail');
      const passwordInput = document.getElementById('regPassword');

      const username = usernameInput ? usernameInput.value.trim() : '';
      let email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email || !email.includes('@')) {
        email = `${username.toLowerCase()}@silent.client`;
      }

      const sb = getSupabase();
      if (!sb) {
        alert('Supabase клиент недоступен.');
        return;
      }

      const { data, error } = await sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { username: username }
        }
      });

      if (error) {
        alert('Ошибка регистрации: ' + error.message);
        return;
      }

      if (data && data.user) {
        setLoggedInState(username);
        if (authModal) authModal.classList.remove('open');
        if (window.switchSilentView) window.switchSilentView('profile');
        loadUserProfileData();
      }
    });
  }
}

async function loadUserProfileData() {
  const sb = getSupabase();
  if (!sb) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const email = user.email || '';
  let username = user.user_metadata?.username || email.split('@')[0];
  let regDate = user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : 'Today';
  let hwid = 'Not Linked';
  let activeSub = 'Free';
  let subExpiry = null;

  try {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
      if (profile.username) username = profile.username;
      if (profile.hwid) hwid = profile.hwid;
      if (profile.active_sub) activeSub = profile.active_sub;
      if (profile.sub_expiry) subExpiry = new Date(profile.sub_expiry);
      if (profile.created_at) regDate = new Date(profile.created_at).toLocaleDateString('ru-RU');
    }
  } catch (err) {
    console.warn('Profile fetch note:', err);
  }

  const welcomeEl = document.getElementById('welcomeUserName');
  const cardNameEl = document.getElementById('cardUserName');
  const cardIdEl = document.getElementById('cardUserId');
  const emailEl = document.getElementById('userEmailVal');
  const regDateEl = document.getElementById('userRegDateVal');
  const hwidEl = document.getElementById('hwidText');
  const daysText = document.getElementById('daysLeftText');
  const statusDesc = document.getElementById('statusDescText');
  const navUserLabel = document.getElementById('userNameLabel');

  if (welcomeEl) welcomeEl.textContent = username;
  if (cardNameEl) cardNameEl.textContent = username;
  if (navUserLabel) navUserLabel.textContent = username;
  if (cardIdEl) cardIdEl.textContent = 'UID: ' + user.id.slice(0, 8);
  if (emailEl) emailEl.textContent = email;
  if (regDateEl) regDateEl.textContent = regDate;
  if (hwidEl) hwidEl.textContent = hwid;

  if (activeSub && activeSub !== 'Free' && subExpiry) {
    const diffMs = subExpiry.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 3000) {
      if (daysText) daysText.textContent = 'Lifetime';
      if (statusDesc) statusDesc.textContent = activeSub + ' (Бессрочно)';
    } else if (diffDays > 0) {
      if (daysText) daysText.textContent = diffDays + ' Days Left';
      if (statusDesc) statusDesc.textContent = activeSub + ' активна';
    } else {
      if (daysText) daysText.textContent = '0 Days Left';
      if (statusDesc) statusDesc.textContent = 'Подписка истекла';
    }
  } else {
    if (daysText) daysText.textContent = '0 Days Left';
    if (statusDesc) statusDesc.textContent = 'Нет активной подписки';
  }
}

function initProfileDashboard() {
  const logoutBtn = document.getElementById('profileLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.auth.signOut();
        } catch (_) {}
      }

      localStorage.removeItem('silent-token');
      localStorage.setItem('silent-user', 'guest');

      const guestState = document.getElementById('authGuestState');
      const userBadge = document.getElementById('authUserBadge');
      if (guestState) guestState.style.display = 'flex';
      if (userBadge) userBadge.style.display = 'none';

      if (window.switchSilentView) {
        window.switchSilentView('landing');
      } else {
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
      }
    });
  }

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
      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.auth.updateUser({ password: newPass });
        if (error) {
          alert('Ошибка обновления пароля: ' + error.message);
          return;
        }
      }
      alert('Пароль успешно обновлен!');
      if (passModal) passModal.classList.remove('open');
    });
  }

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
      const newMail = document.getElementById('newEmailInput').value.trim();
      const sb = getSupabase();
      if (sb) {
        const { error } = await sb.auth.updateUser({ email: newMail });
        if (error) {
          alert('Ошибка обновления Email: ' + error.message);
          return;
        }
      }
      const emailVal = document.getElementById('userEmailVal');
      if (emailVal) emailVal.textContent = newMail;
      alert('Email успешно сохранен!');
      if (emailModal) emailModal.classList.remove('open');
    });
  }

  const licenseForm = document.getElementById('licenseForm');
  if (licenseForm) {
    licenseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const keyInput = document.getElementById('licenseKeyInput');
      const keyVal = keyInput ? keyInput.value.trim() : '';
      if (!keyVal) return;

      const sb = getSupabase();
      if (sb) {
        const { data, error } = await sb.rpc('activate_license_key', { key_code: keyVal });
        if (error) {
          alert('Ошибка активации: ' + error.message);
          return;
        }
        if (data && data.success) {
          alert('Лицензия ' + data.plan + ' успешно активирована!');
          keyInput.value = '';
          loadUserProfileData();
          return;
        } else {
          alert(data?.message || 'Неверный ключ');
          return;
        }
      }
    });
  }

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
  const modalButtons = document.querySelectorAll('.open-checkout-modal');
  const modalTitle = document.getElementById('modalPlanTitle');
  const modalPrice = document.getElementById('modalPlanPrice');

  modalButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
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
