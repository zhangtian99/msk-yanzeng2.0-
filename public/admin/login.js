document.addEventListener('DOMContentLoaded', () => {
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