// /public/admin/login.js

document.addEventListener('DOMContentLoaded', () => {
    // 【关键新增逻辑】：如果已登录 (sessionStorage 中有 token)，则直接跳转到管理后台主页
    if (sessionStorage.getItem('admin-token')) {
        // 假设管理后台主页是根目录 /admin/
        window.location.href = '/admin/'; 
        return; // 阻止后续逻辑执行
    }
    
    const passwordInput = document.getElementById('adminPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginStatus = document.getElementById('loginStatus');

    const handleLogin = async () => {
        const password = passwordInput.value;
        if (!password) {
            loginStatus.textContent = '请输入密码。';
            return;
        }

        loginStatus.textContent = '';
        loginBtn.disabled = true;
        loginBtn.textContent = '验证中...';

        // 确保 DataStore 已被正确引入
        if (typeof DataStore === 'undefined') {
            loginStatus.textContent = '错误: 缺少 DataStore 库。请检查 login.html 是否引入 data-store.js。';
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
            return;
        }

        const result = await DataStore.verifyAdminPassword(password);

        if (result.success) {
            sessionStorage.setItem('admin-token', password);
            window.location.href = '/admin/';
        } else {
            loginStatus.textContent = result.message || '密码错误。';
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
        }
    };

    loginBtn.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });
});