// 侧边栏折叠控制 + 动态菜单（根据角色注入管理控制台）
(function () {
    const sidebar = document.getElementById('sidebar');
    const toggle  = document.getElementById('sidebarToggle');
    if (!sidebar || !toggle) return;

    const KEY = 'nd_sidebar_collapsed';
    if (localStorage.getItem(KEY) === '1') sidebar.classList.add('collapsed');

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem(KEY, sidebar.classList.contains('collapsed') ? '1' : '0');
    });

    // 动态注入侧边栏菜单
    const role = localStorage.getItem('nd_role');
    const nav  = sidebar.querySelector('.sidebar-nav');
    if (!nav) return;

    const page = location.pathname.split('/').pop() || 'index.html';
    const active = (p) => page === p ? 'active' : '';

    let html = `<div class="sidebar-section-label">功能导航</div>
        <a href="index.html" class="sidebar-item ${active('index.html')}">
            <i class="fas fa-flask"></i><span>模型评估</span>
        </a>
        <a href="train.html" class="sidebar-item ${active('train.html')}">
            <i class="fas fa-brain"></i><span>模型训练</span>
        </a>
        <a href="profile.html" class="sidebar-item ${active('profile.html')}">
            <i class="fas fa-user-circle"></i><span>个人信息</span>
        </a>`;

    if (role === 'superadmin') {
        html += `<div class="sidebar-section-label mt-3">管理</div>
        <a href="admin.html" class="sidebar-item ${active('admin.html')}">
            <i class="fas fa-shield-alt"></i><span>管理控制台</span>
        </a>`;
    }

    html += `<div class="sidebar-section-label mt-3">系统</div>
        <a href="#" class="sidebar-item" onclick="Auth.logout(); return false;">
            <i class="fas fa-sign-out-alt"></i><span>退出登录</span>
        </a>`;

    nav.innerHTML = html;
})();
