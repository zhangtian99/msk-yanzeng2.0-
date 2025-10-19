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
    let currentTabView = 'all'; // all, permanent, trial
    let currentSearchTerm = '';
    let currentFilter = 'all'; // all, unused, used, expired

    // --- 3. DOM元素获取 ---
    const pages = { 
        home: document.getElementById('page-home'), 
        create: document.getElementById('page-create'), 
        view: document.getElementById('page-view'), 
        config: document.getElementById('page-config') 
    };
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-page]');
    const logoutBtn = document.getElementById('logoutBtn');
    const statsTotalKeys = document.getElementById('stats-total-keys');
    const statsUsedKeys = document.getElementById('stats-used-keys');
    const statsUnusedKeys = document.getElementById('stats-unused-keys');

    // 密钥生成
    const generatedKeysDisplay = document.getElementById('generatedKeysDisplay');
    const generateSingleBtn = document.getElementById('generateSingleBtn');
    const generateBatchBtn = document.getElementById('generateBatchBtn');
    const batchQuantityInput = document.getElementById('batchQuantityInput');
    const copyKeysBtn = document.getElementById('copyKeysBtn');
    const keyTypeSelect = document.getElementById('keyTypeSelect');
    const keyDurationInput = document.getElementById('keyDurationInput');
    const keyDurationUnit = document.getElementById('keyDurationUnit');
    const keyDurationWrapper = document.getElementById('keyDurationWrapper');
    const generateStatus = document.getElementById('generateStatus');
    
    // 密钥查看
    const keysTableBody = document.getElementById('keysTableBody');
    const keysTableHead = document.getElementById('keysTableHead');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const filterSelect = document.getElementById('filterSelect');
    const tabAllBtn = document.getElementById('tabAllBtn');
    const tabPermanentBtn = document.getElementById('tabPermanentBtn');
    const tabTrialBtn = document.getElementById('tabTrialBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');
    const totalKeysCountSpan = document.getElementById('totalKeysCount');

    // 配置
    const feishuLinkInput = document.getElementById('feishuLinkInput');
    const shortcutLinkInput = document.getElementById('shortcutLinkInput');
    const saveFeishuBtn = document.getElementById('saveFeishuBtn');
    const saveShortcutBtn = document.getElementById('saveShortcutBtn');
    const feishuStatus = document.getElementById('feishuStatus');
    const shortcutStatus = document.getElementById('shortcutStatus');


    // --- 4. 辅助函数 ---

    // 状态信息显示
    const setStatusMessage = (element, message, isError = false) => {
        element.textContent = message;
        element.style.color = isError ? 'red' : 'green';
    };
    
    // 格式化时间戳
    const formatTime = (isoString) => {
        if (!isoString) return 'N/A';
        try {
            return new Date(isoString).toLocaleString('zh-CN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch {
            return '无效时间';
        }
    };
    
    // 渲染表格头部
    const renderTableHeader = (currentFilter) => {
        keysTableHead.innerHTML = `
            <tr>
                <th class="px-4 py-2 text-left w-1/12"><input type="checkbox" id="selectAllKeys"></th>
                <th class="px-4 py-2 text-left w-2/12">密钥值</th>
                <th class="px-4 py-2 text-left w-2/12">类型</th>
                <th class="px-4 py-2 text-left w-2/12">状态</th>
                <th class="px-4 py-2 text-left w-2/12">创建时间</th>
                <th class="px-4 py-2 text-left w-2/12">操作</th>
            </tr>
        `;
        // 事件绑定：全选/反选
        const selectAllKeys = document.getElementById('selectAllKeys');
        if (selectAllKeys) {
            selectAllKeys.checked = false;
            selectAllKeys.addEventListener('change', (e) => {
                document.querySelectorAll('.key-checkbox').forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            });
        }
    };
    
    // 渲染分页的函数
    const renderCurrentPage = (data = allKeysCache) => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageKeys = data.slice(start, end);

        keysTableBody.innerHTML = pageKeys.map(key => {
            const isUsed = key.validation_status === 'used';
            const isExpired = key.key_type === 'trial' && key.expires_at && new Date() > new Date(key.expires_at);
            const statusClass = isExpired ? 'bg-red-200 text-red-800' : isUsed ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800';
            const statusText = isExpired ? '已过期' : isUsed ? '已使用' : '未使用';
            const expiresText = key.expires_at ? `Expires: ${formatTime(key.expires_at)}` : '';
            const usedTimeText = key.activated_at ? `Activated: ${formatTime(key.activated_at)}` : (key.web_validated_time ? `Web Validated: ${formatTime(key.web_validated_time)}` : '');

            return `
                <tr class="border-b hover:bg-gray-50">
                    <td class="px-4 py-2"><input type="checkbox" class="key-checkbox" data-key-value="${key.key_value}"></td>
                    <td class="px-4 py-2 break-all text-sm">${key.key_value}</td>
                    <td class="px-4 py-2 text-sm">${key.key_type}</td>
                    <td class="px-4 py-2 text-xs"><span class="px-2 inline-flex leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span></td>
                    <td class="px-4 py-2 text-xs">
                        <p>${formatTime(key.created_at)}</p>
                        <p class="text-gray-500">${expiresText}</p>
                        <p class="text-gray-500">${usedTimeText}</p>
                    </td>
                    <td class="px-4 py-2 text-sm">
                        <button data-key-value="${key.key_value}" class="reset-key-btn text-blue-600 hover:text-blue-900 mr-2">重置</button>
                        <button data-key-value="${key.key_value}" class="delete-key-btn text-red-600 hover:text-red-900">删除</button>
                    </td>
                </tr>
            `;
        }).join('');

        // 事件绑定：重置和删除按钮
        document.querySelectorAll('.reset-key-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const keyValue = e.target.dataset.keyValue;
                if (confirm(`确定要重置密钥 ${keyValue} 吗?`)) {
                    e.target.disabled = true;
                    e.target.textContent = '重置中...';
                    const result = await DataStore.resetKey(keyValue, password);
                    alert(result.message);
                    fetchAndRenderKeys(true); // 强制重新加载数据
                }
            });
        });
        
        document.querySelectorAll('.delete-key-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const keyValue = e.target.dataset.keyValue;
                if (confirm(`确定要删除密钥 ${keyValue} 吗?`)) {
                    e.target.disabled = true;
                    e.target.textContent = '删除中...';
                    // 假设 DataStore.deleteKey 接受 key_value 和 password
                    const result = await DataStore.deleteKey(keyValue, password); 
                    alert(result.message);
                    fetchAndRenderKeys(true); // 强制重新加载数据
                }
            });
        });
    };
    
    // 更新分页控件的函数
    const updatePaginationControls = (totalItems) => {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        currentPageSpan.textContent = currentPage;
        totalPagesSpan.textContent = totalPages;
        totalKeysCountSpan.textContent = totalItems;

        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalItems === 0;
    };
    
    // 搜索和过滤函数
    const filterKeys = (keys, term, filter) => {
        const lowerCaseTerm = term.toLowerCase();
        
        return keys.filter(key => {
            const matchesTerm = key.key_value.toLowerCase().includes(lowerCaseTerm);

            let matchesFilter = true;
            if (filter !== 'all') {
                switch (filter) {
                    case 'unused':
                        matchesFilter = key.validation_status === 'unused';
                        break;
                    case 'used':
                        matchesFilter = key.validation_status === 'used';
                        break;
                    case 'expired':
                        matchesFilter = key.key_type === 'trial' && key.expires_at && new Date() > new Date(key.expires_at);
                        break;
                }
            }
            return matchesTerm && matchesFilter;
        });
    };
    
    // 获取和渲染密钥列表的主函数
    const fetchAndRenderKeys = async (forceReload = false) => {
        if (forceReload) {
            // 清空缓存并重置分页
            allKeysCache = []; 
            currentPage = 1; 
        }

        let filteredAndSearchedKeys = allKeysCache;
        if (allKeysCache.length === 0 || forceReload) {
            keysTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">加载中...</td></tr>';
            try {
                const result = await DataStore.getAllKeys(password);
                if (result.success) {
                    // 根据当前的 Tab View 过滤结果
                    let initialKeys = result.data;
                    if (currentTabView === 'permanent') {
                        initialKeys = initialKeys.filter(k => k.key_type === 'permanent');
                    } else if (currentTabView === 'trial') {
                        initialKeys = initialKeys.filter(k => k.key_type === 'trial');
                    }
                    allKeysCache = initialKeys;
                    
                } else {
                    throw new Error(result.message);
                }
            } catch(error) {
                keysTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-600">加载失败: ${error.message}</td></tr>`;
                updatePaginationControls(0);
                return;
            }
            
            // 在获取数据后立即应用搜索和过滤
            filteredAndSearchedKeys = filterKeys(allKeysCache, currentSearchTerm, currentFilter);
        } else {
            // 如果数据已缓存，则应用搜索和过滤
            filteredAndSearchedKeys = filterKeys(allKeysCache, currentSearchTerm, currentFilter);
        }

        // 渲染页面并更新控件
        renderCurrentPage(filteredAndSearchedKeys);
        updatePaginationControls(filteredAndSearchedKeys.length);
    };
    
    // --- 5. 页面加载函数 ---

    const showPage = (pageName) => {
        // 移除所有页面的 active 类
        Object.values(pages).forEach(page => page && page.classList.remove('active'));
        // 激活目标页面
        pages[pageName] && pages[pageName].classList.add('active');

        // 更新侧边栏链接的 active 状态
        sidebarLinks.forEach(link => {
            if (link.dataset.page === pageName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // 触发页面特定的加载逻辑
        switch (pageName) {
            case 'home':
                loadHomePage();
                break;
            case 'view':
                loadViewPage();
                break;
            case 'config':
                loadConfigPage();
                break;
            case 'create':
                // 确保生成状态清空
                generatedKeysDisplay.textContent = '';
                setStatusMessage(generateStatus, '准备生成密钥', false);
                break;
        }
    };

    const loadViewPage = () => {
        // 确保表格头渲染
        renderTableHeader(currentFilter); 

        // 重新加载数据
        fetchAndRenderKeys(true);
    };

    // 【保留的定义，解决了函数重复声明的错误】
    const loadHomePage = async () => {
        [statsTotalKeys, statsUsedKeys, statsUnusedKeys].forEach(el => el && (el.textContent = '...'));
        try {
            const result = await DataStore.getStats(password);
            if (result.success) {
                if (statsTotalKeys) statsTotalKeys.textContent = result.data.totalKeys;
                if (statsUsedKeys) statsUsedKeys.textContent = result.data.usedKeys;
                if (statsUnusedKeys) statsUnusedKeys.textContent = result.data.totalKeys - result.data.usedKeys;
            } else { throw new Error(result.message); }
        } catch(error) {
            [statsTotalKeys, statsUsedKeys, statsUnusedKeys].forEach(el => el && (el.textContent = 'N/A'));
        }
    };

    const loadConfigPage = async () => {
        if (feishuLinkInput) feishuLinkInput.value = '加载中...';
        if (shortcutLinkInput) shortcutLinkInput.value = '加载中...';
        try {
            const result = await DataStore.getAdminConfig(password);
            if (result.success) {
                if (feishuLinkInput) feishuLinkInput.value = result.data.FEISHU_TEMPLATE_LINK || '';
                if (shortcutLinkInput) shortcutLinkInput.value = result.data.SHORTCUT_ICLOUD_LINK || '';
            } else { throw new Error(result.message); }
        } catch(error) {
            if (feishuStatus) feishuStatus.textContent = `加载失败: ${error.message}`;
            if (feishuStatus) feishuStatus.style.color = 'red';
        }
    };
    
    // --- 6. 事件绑定 ---

    // 侧边栏导航
    if (sidebarLinks.length > 0) {
        sidebarLinks.forEach(link => link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(link.dataset.page);
        }));
    }

    // 退出按钮
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => { 
            sessionStorage.removeItem('admin-token');
            window.location.href = '/admin/login.html'; 
        });
    }

    // 密钥生成页面的类型选择器
    if (keyTypeSelect) {
        keyTypeSelect.addEventListener('change', (e) => {
            // 只有试用密钥才显示持续时间输入框
            if (e.target.value === 'trial') {
                keyDurationWrapper.classList.remove('hidden');
            } else {
                keyDurationWrapper.classList.add('hidden');
            }
        });
    }
    
    // 生成单个密钥按钮 (默认永久)
    if (generateSingleBtn) {
        generateSingleBtn.addEventListener('click', async () => {
            generateSingleBtn.disabled = true;
            generateSingleBtn.textContent = '生成中...';
            generatedKeysDisplay.textContent = '';
            
            try {
                // 调用批量生成接口，数量为1，类型为 permanent
                const result = await DataStore.generateAndSaveKeys(1, 'permanent', null, null, password);
                if (result.success && result.generated_keys.length > 0) {
                    generatedKeysDisplay.textContent = result.generated_keys.join('\n');
                    setStatusMessage(generateStatus, '单个永久密钥生成成功!', false);
                } else {
                    throw new Error(result.message || '生成失败');
                }
            } catch (error) {
                setStatusMessage(generateStatus, `生成失败: ${error.message}`, true);
            } finally {
                generateSingleBtn.disabled = false;
                generateSingleBtn.textContent = '生成单个密钥';
            }
        });
    }

    // 批量生成密钥按钮
    if (generateBatchBtn) {
        generateBatchBtn.addEventListener('click', async () => {
            const quantity = parseInt(batchQuantityInput.value) || 0;
            const keyType = keyTypeSelect.value;
            const duration = parseInt(keyDurationInput.value) || 0;
            const durationUnit = keyDurationUnit.value;

            if (quantity <= 0) {
                setStatusMessage(generateStatus, '生成数量必须大于 0', true);
                return;
            }
            if (keyType === 'trial' && duration <= 0) {
                setStatusMessage(generateStatus, '试用密钥必须设置大于 0 的持续时间', true);
                return;
            }

            generateBatchBtn.disabled = true;
            generateBatchBtn.textContent = '批量生成中...';
            generatedKeysDisplay.textContent = '';

            let duration_days = null;
            let duration_minutes = null;

            if (keyType === 'trial') {
                if (durationUnit === 'days') {
                    duration_days = duration;
                } else if (durationUnit === 'minutes') {
                    duration_minutes = duration;
                }
            }
            
            try {
                const result = await DataStore.generateAndSaveKeys(
                    quantity, 
                    keyType, 
                    duration_days, 
                    duration_minutes, 
                    password
                );
                
                if (result.success && result.generated_keys.length > 0) {
                    generatedKeysDisplay.textContent = result.generated_keys.join('\n');
                    setStatusMessage(generateStatus, `成功生成 ${result.added_count} 个密钥!`, false);
                } else {
                    throw new Error(result.message || '批量生成失败');
                }
            } catch (error) {
                setStatusMessage(generateStatus, `批量生成失败: ${error.message}`, true);
            } finally {
                generateBatchBtn.disabled = false;
                generateBatchBtn.textContent = '批量生成密钥';
            }
        });
    }
    
    // 复制密钥按钮
    if (copyKeysBtn) {
        copyKeysBtn.addEventListener('click', () => {
            const keysText = generatedKeysDisplay.textContent;
            if (keysText) {
                navigator.clipboard.writeText(keysText).then(() => {
                    alert('密钥已复制到剪贴板!');
                }).catch(err => {
                    console.error('复制失败:', err);
                    alert('复制失败，请手动复制。');
                });
            }
        });
    }

    // 密钥查看页面的 Tab 切换
    [tabAllBtn, tabPermanentBtn, tabTrialBtn].forEach(btn => {
        btn.addEventListener('click', (e) => {
            [tabAllBtn, tabPermanentBtn, tabTrialBtn].forEach(b => b.classList.remove('active-tab'));
            e.target.classList.add('active-tab');
            currentTabView = e.target.dataset.tab;
            // 重置搜索和过滤，并强制重新加载数据
            searchInput.value = '';
            currentSearchTerm = '';
            filterSelect.value = 'all';
            currentFilter = 'all';
            fetchAndRenderKeys(true);
        });
    });

    // 搜索按钮
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentPage = 1;
            currentSearchTerm = searchInput.value.trim();
            fetchAndRenderKeys(false); // 使用缓存数据进行搜索
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchBtn.click();
            }
        });
    }

    // 筛选下拉框
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentPage = 1;
            currentFilter = e.target.value;
            fetchAndRenderKeys(false); // 使用缓存数据进行过滤
        });
    }

    // 批量删除按钮
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', async () => {
            const selectedKeys = Array.from(document.querySelectorAll('.key-checkbox:checked'))
                                     .map(cb => cb.dataset.keyValue)
                                     .filter(key => key !== 'on'); // 排除全选框的值

            if (selectedKeys.length === 0) {
                alert('请选择至少一个密钥进行删除。');
                return;
            }

            if (confirm(`确定要删除选中的 ${selectedKeys.length} 个密钥吗?`)) {
                deleteSelectedBtn.disabled = true;
                deleteSelectedBtn.textContent = '删除中...';
                
                try {
                    const result = await DataStore.batchDeleteKeys(selectedKeys, password);
                    alert(result.message);
                    fetchAndRenderKeys(true); // 强制重新加载数据
                } catch(error) {
                    alert(`批量删除失败: ${error.message}`);
                } finally {
                    deleteSelectedBtn.disabled = false;
                    deleteSelectedBtn.textContent = '批量删除';
                }
            }
        });
    }
    
    // 分页控件
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            const filteredKeys = filterKeys(allKeysCache, currentSearchTerm, currentFilter);
            if (currentPage > 1) {
                currentPage--;
                renderCurrentPage(filteredKeys);
                updatePaginationControls(filteredKeys.length); // 传入总数进行更新
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const filteredKeys = filterKeys(allKeysCache, currentSearchTerm, currentFilter);
            const totalPages = Math.ceil(filteredKeys.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderCurrentPage(filteredKeys);
                updatePaginationControls(filteredKeys.length); // 传入总数进行更新
            }
        });
    }

    // Config save buttons
    if (saveFeishuBtn) {
        saveFeishuBtn.addEventListener('click', async () => {
            const url = feishuLinkInput.value.trim();
            if(!url) { setStatusMessage(feishuStatus, '链接不能为空', true); return; }
            const result = await DataStore.saveAdminConfig('feishu', url, password);
            setStatusMessage(feishuStatus, result.message, !result.success);
        });
    }
    
    if (saveShortcutBtn) {
        saveShortcutBtn.addEventListener('click', async () => {
            const url = shortcutLinkInput.value.trim();
            if(!url) { setStatusMessage(shortcutStatus, '链接不能为空', true); return; }
            const result = await DataStore.saveAdminConfig('shortcut', url, password);
            setStatusMessage(shortcutStatus, result.message, !result.success);
        });
    }
    
    // --- 7. 初始化 ---
    // 默认显示首页
    showPage('home'); 
});