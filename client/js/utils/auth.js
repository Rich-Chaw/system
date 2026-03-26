/**
 * 认证工具模块 - 所有页面共享
 * 管理 token、用户信息、登录跳转
 */
const Auth = (() => {
    const SERVER_URL = 'http://localhost:5000';

    function getToken() { return localStorage.getItem('nd_token'); }
    function getUser()  { return JSON.parse(localStorage.getItem('nd_user') || 'null'); }
    function getRole()  { return localStorage.getItem('nd_role'); }

    function save(token, username, role) {
        localStorage.setItem('nd_token', token);
        localStorage.setItem('nd_user', JSON.stringify({ username, role }));
        localStorage.setItem('nd_role', role);
    }

    function clear() {
        localStorage.removeItem('nd_token');
        localStorage.removeItem('nd_user');
        localStorage.removeItem('nd_role');
    }

    async function login(username, password) {
        const res = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            save(data.token, data.username, data.role);
        }
        return data;
    }

    async function logout() {
        const token = getToken();
        if (token) {
            try {
                await fetch(`${SERVER_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: { 'X-Auth-Token': token }
                });
            } catch (_) {}
        }
        clear();
        window.location.href = 'login.html';
    }

    /** 普通页面调用：未登录则跳转登录页 */
    function requireLogin() {
        if (!getToken()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /** 管理员页面调用：非管理员则跳转 */
    function requireAdmin() {
        if (!getToken() || getRole() !== 'superadmin') {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /** 渲染顶部用户信息 */
    function renderUserBadge(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const user = getUser();
        if (!user) return;
        const roleLabel = user.role === 'superadmin' ? '超级管理员' : '普通用户';
        const roleColor = user.role === 'superadmin' ? 'warning' : 'info';
        el.innerHTML = `
            <span class="me-2 text-white-50">
                <i class="fas fa-user-circle me-1"></i>${user.username}
                <span class="badge bg-${roleColor} ms-1">${roleLabel}</span>
            </span>
            <button class="btn btn-sm btn-outline-light" onclick="Auth.logout()">
                <i class="fas fa-sign-out-alt"></i> 退出
            </button>`;
    }

    function authHeaders() {
        return { 'X-Auth-Token': getToken() || '', 'Content-Type': 'application/json' };
    }

    return { getToken, getUser, getRole, login, logout, requireLogin, requireAdmin, renderUserBadge, authHeaders, SERVER_URL };
})();
