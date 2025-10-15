document.addEventListener('DOMContentLoaded', () => {
    // 1. 身份验证
    const password = sessionStorage.getItem('admin-token');
    if (!password) {
        window.location.href = '/admin/login.html';
        return;
    }

    // --- 2. 状态管理 ---
    let allKeysCache = [];
    let currentPage = 1;
    const itemsPerPage = 10;
    let currentTabView = 'all'; // 当前标签页状态

    // --- 3. DOM元素获取 ---
    const pages = { home: document.getElementById('page-home'), create: document.getElementById('page-create'), view: document.getElementById('page-view'), config: document.getElementById('page-config') };
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-page]');
    const logoutBtn = document.getElementById('logoutBtn');
    const statsTotalKeys = document.getElementById('stats-total-keys');
    const statsUsedKeys = document.getElementById('stats-used-keys');
    const statsUnusedKeys = document.getElementById('stats-unused-keys');
    const generatedKeysDisplay = document.getElementById('generatedKeysDisplay');
    const generateSingleBtn = document.getElementById('generateSingleBtn');
    const generateBatchBtn = document.getElementById('generateBatchBtn');
    const batchQuantityInput = document.getElementById('batchQuantityInput');
    const copyKeysBtn = document.getElementById('copyKeysBtn');
    const generatorStatus = document.getElementById('generatorStatus');
    const keysTableHead = document.getElementById('keys-table-head');
    const keysTableBody = document.getElementById('keys-table-body');
    const keysTableStatus = document.getElementById('keys-table-status');
    const tabLinks = document.querySelectorAll('.tab-link');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageStartSpan = document.getElementById('pageStartSpan');
    const pageEndSpan = document.getElementById('pageEndSpan');
    const totalItemsSpan = document.getElementById('totalItemsSpan');
    const feishuLinkInput = document.getElementById('feishuLinkInput');
    const saveFeishuBtn = document.getElementById('saveFeishuBtn');
    const feishuStatus = document.getElementById('feishuStatus');
    const shortcutLinkInput = document.getElementById('shortcutLinkInput');
    const saveShortcutBtn = document.getElementById('saveShortcutBtn');
    const shortcutStatus = document.getElementById('shortcutStatus');
    const keyTypeRadios = document.querySelectorAll('input[name="keyType"]');
    const trialDurationWrapper = document.getElementById('trialDurationWrapper');
    const trialDurationInput = document.getElementById('trialDurationInput');

    // --- 4. 核心功能函数 ---
    const showPage = (pageId) => {
        const effectivePageId = pages[pageId] ? pageId : 'home';
        Object.values(pages).forEach(page => page.classList.remove('active'));
        pages[effectivePageId].classList.add('active');
        sidebarLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === effectivePageId) link.classList.add('active');
        });
        if (effectivePageId === 'home') loadHomePage();
        if (effectivePageId === 'view') loadViewPage();
        if (effectivePageId === 'config') loadConfigPage();
    };

    const loadHomePage = async () => { /* (实现不变) */ };
    const loadConfigPage = async () => { /* (实现不变) */ };

    const renderTableHeader = () => {
        let headerContent = '<tr>';
        if (currentTabView === 'all') {
            headerContent += `
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">密钥值</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            `;
        } else { // 'trial' view
            headerContent += `
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">密钥值</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">过期时间</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            `;
        }
        headerContent += '</tr>';
        keysTableHead.innerHTML = headerContent;
    };
    
    const renderCurrentPage = () => {
        keysTableBody.innerHTML = '';
        keysTableStatus.textContent = '';
        const filteredKeys = currentTabView === 'trial' ? allKeysCache.filter(key => key.key_type === 'trial') : allKeysCache;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const keysForCurrentPage = filteredKeys.slice(startIndex, endIndex);

        if (filteredKeys.length === 0) {
            keysTableStatus.textContent = '没有找到匹配的密钥。';
            return;
        }
        if (keysForCurrentPage.length === 0) {
            keysTableStatus.textContent = '此页无数据。';
            return;
        }
        keysForCurrentPage.forEach(key => {
            const tr = document.createElement('tr');
            const statusText = key.validation_status === 'used' ? '已激活' : '未激活';
            const statusColor = key.validation_status === 'used' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            const keyType = key.key_type === 'trial' ? '试用' : '永久';
            let rowContent = `<td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">${key.key_value}</td>`;
            if (currentTabView === 'all') {
                rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${keyType}</td>`;
            }
            rowContent += `<td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span></td>`;
            rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(key.created_at).toLocaleString()}</td>`;
            if (currentTabView === 'trial') {
                const expiresText = key.expires_at ? new Date(key.expires_at).toLocaleString() : '永不';
                rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expiresText}</td>`;
            }
            rowContent += `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center gap-4">
                    <button title="复制" data-key-value="${key.key_value}" class="copy-btn text-blue-600 hover:underline">复制</button>
                    <button title="删除" data-key-value="${key.key_value}" class="delete-btn text-red-600 hover:underline">删除</button>
                </td>
            `;
            tr.innerHTML = rowContent;
            keysTableBody.appendChild(tr);
        });
        updatePaginationControls(filteredKeys.length);
    };

    const updatePaginationControls = (totalItems) => {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, totalItems);
        pageStartSpan.textContent = totalItems > 0 ? startIndex : 0;
        pageEndSpan.textContent = endIndex;
        totalItemsSpan.textContent = totalItems;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    };
    
    const loadViewPage = async () => {
        keysTableStatus.textContent = '正在加载...';
        try {
            const result = await DataStore.getAllKeys(password);
            if (result.success) {
                allKeysCache = result.data;
                currentPage = 1;
                renderTableHeader();
                renderCurrentPage();
            } else { throw new Error(result.message); }
        } catch(error) {
             keysTableStatus.textContent = `加载失败: ${error.message}`;
        }
    };

    // --- 5. 事件监听器绑定 ---
    sidebarLinks.forEach(link => link.addEventListener('click', () => showPage(link.dataset.page)));
    logoutBtn.addEventListener('click', () => { sessionStorage.removeItem('admin-token'); window.location.href = '/admin/login.html'; });

    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            currentTabView = link.dataset.tab;
            tabLinks.forEach(tab => {
                tab.classList.remove('border-blue-500', 'text-blue-600');
                tab.classList.add('border-transparent', 'text-gray-500');
            });
            link.classList.add('border-blue-500', 'text-blue-600');
            link.classList.remove('border-transparent', 'text-gray-500');
            currentPage = 1;
            renderTableHeader();
            renderCurrentPage();
        });
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderCurrentPage(); }
    });
    nextPageBtn.addEventListener('click', () => {
        const filteredKeys = currentTabView === 'trial' ? allKeysCache.filter(key => key.key_type === 'trial') : allKeysCache;
        const totalPages = Math.ceil(filteredKeys.length / itemsPerPage);
        if (currentPage < totalPages) { currentPage++; renderCurrentPage(); }
    });

    keysTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const keyValue = target.dataset.keyValue;
        if (!keyValue) return;
        if (target.classList.contains('copy-btn')) { navigator.clipboard.writeText(keyValue).then(() => alert('密钥已复制!')); }
        if (target.classList.contains('delete-btn')) {
            if (confirm(`确定要删除密钥 "${keyValue}" 吗？`)) {
                const result = await DataStore.deleteKey(keyValue, password);
                if (result.success) loadViewPage(); else alert(`删除失败: ${result.message}`);
            }
        }
    });

    // (其他页面的事件监听器和函数实现省略，以保持简洁)
    
    // --- 6. 初始化 ---
    showPage('home');
});