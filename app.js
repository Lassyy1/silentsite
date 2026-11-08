
// ==========================================================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================================================
const SUPABASE_URL = 'https://jiklujlueadsxjckhpuq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FF2Up7xoQqoV3apoY8csrQ_43VJrsYw';

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
      loadUserProfileData();
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
        try {
          const { data: foundEmail, error: rpcErr } = await sb.rpc('get_email_by_username', { p_username: userOrEmail });
          if (foundEmail) {
            email = foundEmail;
          }
        } catch (err) {
          console.warn('Username lookup notice:', err);
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
  let uid = 1;
  let role = 'user';

  try {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
      if (profile.username) username = profile.username;
      if (profile.hwid) hwid = profile.hwid;
      if (profile.active_sub) activeSub = profile.active_sub;
      if (profile.sub_expiry) subExpiry = new Date(profile.sub_expiry);
      if (profile.created_at) regDate = new Date(profile.created_at).toLocaleDateString('ru-RU');
      if (profile.uid !== undefined && profile.uid !== null) uid = profile.uid;
      if (profile.role) role = profile.role;

      if (profile.is_banned) {
        alert('Ваш аккаунт заблокирован администратором.');
        await sb.auth.signOut();
        if (window.switchSilentView) window.switchSilentView('landing');
        return;
      }
    }
  } catch (err) {
    console.warn('Profile fetch note:', err);
  }

  const welcomeEl = document.getElementById('welcomeUserName');
  const cardNameEl = document.getElementById('cardUserName');
  const cardIdEl = document.getElementById('cardUserId');
  const cardRoleEl = document.getElementById('cardRole');
  const emailEl = document.getElementById('userEmailVal');
  const regDateEl = document.getElementById('userRegDateVal');
  const hwidEl = document.getElementById('hwidText');
  const daysText = document.getElementById('daysLeftText');
  const statusDesc = document.getElementById('statusDescText');
  const navUserLabel = document.getElementById('userNameLabel');
  const sidebarAdminBtn = document.getElementById('sidebarAdminBtn');

  if (welcomeEl) welcomeEl.textContent = username;
  if (cardNameEl) cardNameEl.textContent = username;
  if (navUserLabel) navUserLabel.textContent = username;
  if (cardIdEl) cardIdEl.textContent = 'User ID: ' + uid;
  if (emailEl) emailEl.textContent = email;
  if (regDateEl) regDateEl.textContent = regDate;
  if (hwidEl) hwidEl.textContent = hwid;

  // Role badge and Admin navigation
  if (role === 'admin') {
    if (cardRoleEl) {
      cardRoleEl.textContent = 'Admin';
      cardRoleEl.className = 'pf-badge-admin';
    }
    if (sidebarAdminBtn) sidebarAdminBtn.style.display = 'flex';
  } else {
    if (cardRoleEl) {
      cardRoleEl.textContent = 'Default';
      cardRoleEl.className = 'pf-badge-default';
    }
    if (sidebarAdminBtn) sidebarAdminBtn.style.display = 'none';
  }

  // Compute days left
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


// Admin Keys Management Functions
let lastGeneratedKeys = [];

async function adminLoadKeys(filter = 'active') {
  const tableBody = document.getElementById('adminKeysTableBody');
  if (!tableBody) return;

  const sb = getSupabase();
  if (!sb) return;

  tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #8890a6; padding: 20px;">Загрузка ключей...</td></tr>';

  try {
    const { data: keys, error } = await sb.rpc('admin_get_keys', { p_filter: filter });
    if (error) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 20px;">Ошибка доступа: ${error.message}</td></tr>`;
      return;
    }

    if (!keys || keys.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #8890a6; padding: 20px;">Ключи не найдены</td></tr>';
      return;
    }

    tableBody.innerHTML = keys.map(k => {
      const isUsed = !!k.is_used;
      const statusHtml = isUsed
        ? '<span style="color:#ef4444; font-weight:600; font-size:11px; padding:2px 6px; background:rgba(239,68,68,0.15); border-radius:4px;">Активирован</span>'
        : '<span style="color:#10b981; font-weight:700; font-size:11px; padding:2px 6px; background:rgba(16,185,129,0.15); border-radius:4px;">Свободен</span>';
      
      const usedBy = k.used_by_username ? `<strong>${k.used_by_username}</strong>` : '<span style="color:#72798e;">—</span>';

      return `
        <tr>
          <td style="font-family:monospace; font-weight:700; font-size:12px; letter-spacing:0.02em;">
            ${k.key}
            <button type="button" style="margin-left:6px; padding:2px 6px; font-size:10px; cursor:pointer;" onclick="navigator.clipboard.writeText('${k.key}'); this.textContent='OK'; setTimeout(()=>this.textContent='Копир.', 1200);">Копир.</button>
          </td>
          <td><span class="pf-admin-badge-sub">${k.plan_name}</span></td>
          <td>${statusHtml}</td>
          <td>${usedBy}</td>
          <td>
            ${!isUsed ? `<button type="button" class="pf-admin-btn-action" style="color:#ef4444; border-color:#ef4444;" onclick="adminDeleteKey('${k.key}')">Удалить</button>` : '<span style="color:#72798e; font-size:11px;">Использован</span>'}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 20px;">Ошибка: ${err.message}</td></tr>`;
  }
}

window.adminDeleteKey = async function(keyCode) {
  if (!confirm(`Удалить ключ ${keyCode}?`)) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { error } = await sb.rpc('admin_delete_key', { p_key: keyCode });
    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }
    alert('Ключ успешно удален!');
    const filter = document.getElementById('adminKeysFilterSelect')?.value || 'active';
    adminLoadKeys(filter);
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

// Admin Panel Functions
async function adminLoadUsers() {
  const tableBody = document.getElementById('adminUsersTableBody');
  if (!tableBody) return;

  const sb = getSupabase();
  if (!sb) return;

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #8890a6; padding: 20px;">Загрузка пользователей...</td></tr>';

  try {
    const { data: users, error } = await sb.rpc('admin_get_all_users');
    if (error) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Ошибка доступа: ${error.message}</td></tr>`;
      return;
    }

    if (!users || users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #8890a6; padding: 20px;">Пользователи не найдены</td></tr>';
      return;
    }

    tableBody.innerHTML = users.map(u => {
      const isSub = u.active_sub && u.active_sub !== 'Free';
      const badgeCls = isSub ? 'pf-admin-badge-sub' : 'pf-admin-badge-sub free';
      const subLabel = isSub ? u.active_sub : 'Free';
      const hwidLabel = u.hwid || 'Not linked';
      const isBanned = !!u.is_banned;
      const statusHtml = isBanned 
        ? '<span style="color:#ef4444; font-weight:700; font-size:11px; padding:2px 6px; background:rgba(239,68,68,0.15); border-radius:4px;">BANNED</span>'
        : '<span style="color:#10b981; font-weight:600; font-size:11px;">Active</span>';

      return `
        <tr>
          <td style="font-weight: 700;">#${u.uid || 1}</td>
          <td><strong>${u.username || 'User'}</strong> ${u.role === 'admin' ? '<span class="pf-badge-admin" style="font-size:9px; padding:1px 4px;">Admin</span>' : ''}</td>
          <td><span class="${badgeCls}">${subLabel}</span></td>
          <td><span class="pf-admin-hwid-val">${hwidLabel}</span></td>
          <td>${statusHtml}</td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" class="pf-admin-btn-action" onclick="adminResetUserHwid(${u.uid})" title="Сбросить привязку HWID">
                Сброс HWID
              </button>
              ${isSub ? `<button type="button" class="pf-admin-btn-action" style="color:#eab308; border-color:rgba(234,179,8,0.4);" onclick="adminRemoveUserSub(${u.uid})" title="Снять подписку">Снять подписку</button>` : ''}
              <button type="button" class="pf-admin-btn-action" style="${isBanned ? 'color:#10b981; border-color:#10b981;' : 'color:#ef4444; border-color:#ef4444;'}" onclick="adminToggleBanUser(${u.uid}, ${!isBanned})" title="${isBanned ? 'Разблокировать' : 'Заблокировать'}">
                ${isBanned ? 'Разбан' : 'Бан'}
              </button>
              ${u.role !== 'admin' ? `<button type="button" class="pf-admin-btn-action" style="background:#dc2626; color:#ffffff; border-color:#dc2626;" onclick="adminDeleteUser(${u.uid})" title="Удалить аккаунт навсегда">Удалить</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Ошибка: ${err.message}</td></tr>`;
  }
}

window.adminResetUserHwid = async function(targetUid) {
  if (!confirm(`Сбросить HWID для пользователя UID #${targetUid}?`)) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { error } = await sb.rpc('admin_reset_user_hwid', { target_uid: targetUid });
    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }
    alert(`HWID для UID #${targetUid} успешно сброшен!`);
    adminLoadUsers();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

window.adminRemoveUserSub = async function(targetUid) {
  if (!confirm(`Снять подписку у пользователя UID #${targetUid}?`)) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { error } = await sb.rpc('admin_remove_user_sub', { target_uid: targetUid });
    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }
    alert(`Подписка для UID #${targetUid} аннулирована!`);
    adminLoadUsers();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

window.adminToggleBanUser = async function(targetUid, banState) {
  const actionText = banState ? 'заблокировать' : 'разблокировать';
  if (!confirm(`Вы действительно хотите ${actionText} аккаунт UID #${targetUid}?`)) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { error } = await sb.rpc('admin_toggle_ban_user', { target_uid: targetUid, ban_state: banState });
    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }
    alert(`Аккаунт UID #${targetUid} успешно ${banState ? 'заблокирован' : 'разблокирован'}!`);
    adminLoadUsers();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

window.adminDeleteUser = async function(targetUid) {
  if (!confirm(`ВНИМАНИЕ: Удалить аккаунт UID #${targetUid} НАВСЕГДА из базы данных?`)) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { error } = await sb.rpc('admin_delete_user', { target_uid: targetUid });
    if (error) {
      alert('Ошибка удаления: ' + error.message);
      return;
    }
    alert(`Пользователь UID #${targetUid} удален навсегда!`);
    adminLoadUsers();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
};

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

  // Profile sidebar tab switching: Settings vs Admin Panel
  const sidebarSettingsBtn = document.getElementById('sidebarSettingsBtn');
  const sidebarAdminBtn = document.getElementById('sidebarAdminBtn');
  const pfSettingsSection = document.getElementById('pfSettingsSection');
  const pfAdminSection = document.getElementById('pfAdminSection');

  if (sidebarSettingsBtn && sidebarAdminBtn && pfSettingsSection && pfAdminSection) {
    sidebarSettingsBtn.addEventListener('click', () => {
      sidebarSettingsBtn.classList.add('active');
      sidebarAdminBtn.classList.remove('active');
      pfSettingsSection.style.display = 'block';
      pfAdminSection.style.display = 'none';
    });

    sidebarAdminBtn.addEventListener('click', () => {
      sidebarAdminBtn.classList.add('active');
      sidebarSettingsBtn.classList.remove('active');
      pfSettingsSection.style.display = 'none';
      pfAdminSection.style.display = 'block';
      adminLoadUsers();
      adminLoadKeys();
    });
  }

  // Admin Generate Keys
  const adminGenKeysBtn = document.getElementById('adminGenKeysBtn');
  if (adminGenKeysBtn) {
    adminGenKeysBtn.addEventListener('click', async () => {
      const planVal = document.getElementById('adminKeyPlan')?.value || '30 Days|30';
      const countVal = parseInt(document.getElementById('adminKeyCount')?.value || '1', 10);
      const [planName, durationStr] = planVal.split('|');
      const durationDays = parseInt(durationStr, 10);

      const sb = getSupabase();
      if (!sb) return;

      adminGenKeysBtn.disabled = true;
      adminGenKeysBtn.textContent = 'Генерация...';

      try {
        const { data, error } = await sb.rpc('admin_generate_keys', {
          p_plan: planName,
          p_days: durationDays,
          p_count: countVal
        });

        if (error) {
          alert('Ошибка генерации ключей: ' + error.message);
          return;
        }

        lastGeneratedKeys = data ? data.map(d => d.key_code) : [];
        const outBox = document.getElementById('adminGenKeysOutput');
        const listEl = document.getElementById('adminKeysList');
        if (outBox && listEl && data) {
          outBox.style.display = 'block';
          listEl.innerHTML = data.map(item => `
            <div class="pf-key-item">
              <span>${item.key_code}</span>
              <button type="button" onclick="navigator.clipboard.writeText('${item.key_code}'); this.textContent='Скопировано!'; setTimeout(()=>this.textContent='Копировать', 1500);">
                Копировать
              </button>
            </div>
          `).join('');
        }
        const filter = document.getElementById('adminKeysFilterSelect')?.value || 'active';
        adminLoadKeys(filter);
      } catch (err) {
        alert('Ошибка: ' + err.message);
      } finally {
        adminGenKeysBtn.disabled = false;
        adminGenKeysBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Сгенерировать';
      }
    });
  }

  // Admin Copy All Generated Keys
  const copyAllBtn = document.getElementById('adminCopyAllKeysBtn');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', () => {
      if (!lastGeneratedKeys || lastGeneratedKeys.length === 0) {
        alert('Нет сгенерированных ключей для копирования');
        return;
      }
      const textToCopy = lastGeneratedKeys.join('\n');
      navigator.clipboard.writeText(textToCopy);
      copyAllBtn.textContent = `Скопировано (${lastGeneratedKeys.length} шт.)!`;
      setTimeout(() => {
        copyAllBtn.textContent = 'Скопировать все списком для FunPay';
      }, 2000);
    });
  }

  // Admin Keys Database Filter & Refresh
  const keysFilterSelect = document.getElementById('adminKeysFilterSelect');
  if (keysFilterSelect) {
    keysFilterSelect.addEventListener('change', () => {
      adminLoadKeys(keysFilterSelect.value);
    });
  }

  const refreshKeysBtn = document.getElementById('adminRefreshKeysBtn');
  if (refreshKeysBtn) {
    refreshKeysBtn.addEventListener('click', () => {
      const f = keysFilterSelect ? keysFilterSelect.value : 'active';
      adminLoadKeys(f);
    });
  }

  // Admin Refresh Users
  const adminRefreshUsersBtn = document.getElementById('adminRefreshUsersBtn');
  if (adminRefreshUsersBtn) {
    adminRefreshUsersBtn.addEventListener('click', () => adminLoadUsers());
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

  // License Key Activation
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
