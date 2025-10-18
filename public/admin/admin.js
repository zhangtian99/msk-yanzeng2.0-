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
    let currentTabView = 'all';

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
    const bulkActionsToolbar = document.getElementById('bulkActionsToolbar');
    const selectedCountSpan = document.getElementById('selectedCount');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    
    // 【新增调试元素】
    const debugQuantityInput = document.getElementById('debugQuantityInput'); 
    const debugDurationInput = document.getElementById('debugDurationInput'); 
    const generateDebugBtn = document.getElementById('generateDebugBtn');

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

    const loadHomePage = async () => {
        [statsTotalKeys, statsUsedKeys, statsUnusedKeys].forEach(el => el.textContent = '...');
        try {
            const result = await DataStore.getStats(password);
            if (result.success) {
                statsTotalKeys.textContent = result.data.totalKeys;
                statsUsedKeys.textContent = result.data.usedKeys;
                statsUnusedKeys.textContent = result.data.totalKeys - result.data.usedKeys;
            } else { throw new Error(result.message); }
        } catch(error) {
            [statsTotalKeys, statsUsedKeys, statsUnusedKeys].forEach(el => el.textContent = 'N/A');
        }
    };

    const loadConfigPage = async () => {
        feishuLinkInput.value = '加载中...';
        shortcutLinkInput.value = '加载中...';
        try {
            const result = await DataStore.getAdminConfig(password);
            if (result.success) {
                feishuLinkInput.value = result.data.FEISHU_TEMPLATE_LINK || '';
                shortcutLinkInput.value = result.data.SHORTCUT_ICLOUD_LINK || '';
            } else { throw new Error(result.message); }
        } catch(error) {
            feishuStatus.textContent = `加载失败: ${error.message}`;
            feishuStatus.style.color = 'red';
        }
    };

    const renderTableHeader = () => {
        let headerContent = '<tr><th class="p-4"><input type="checkbox" id="selectAllCheckbox" class="h-4 w-4"></th>';
        const baseHeaders = `
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">密钥值</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
        `;
        if (currentTabView === 'all') {
            headerContent += baseHeaders + `
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">过期时间</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            `;
        } else { // 'trial' view
            headerContent += baseHeaders + `
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">过期时间</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            `;
        }
        headerContent += '</tr>';
        keysTableHead.innerHTML = headerContent;
        // Re-bind event listener to the new checkbox
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
             selectAllCheckbox.addEventListener('click', () => {
                 keysTableBody.querySelectorAll('.key-checkbox').forEach(cb => cb.checked = selectAllCheckbox.checked);
                 updateBulkActionsToolbar();
            });
        }
    };
    
    const renderCurrentPage = () => {
        keysTableBody.innerHTML = '';
        keysTableStatus.textContent = '';
        const filteredKeys = currentTabView === 'trial' ? allKeysCache.filter(key => key.key_type === 'trial') : allKeysCache;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const keysForCurrentPage = filteredKeys.slice(startIndex, endIndex);

        if (filteredKeys.length === 0) {
            keysTableStatus.textContent = currentTabView === 'trial' ? '没有找到试用密钥。' : '没有找到任何密钥。';
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
            
            let rowContent = `<td class="p-4"><input type="checkbox" class="key-checkbox h-4 w-4" data-key-value="${key.key_value}"></td>`;
            rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">${key.key_value}</td>`;
            if (currentTabView === 'all') {
                rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${keyType === '试用' ? 'text-yellow-600' : 'text-green-600'}">${keyType}</td>`;
            }
            rowContent += `<td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span></td>`;
            rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(key.created_at).toLocaleString()}</td>`;
            
            const expiresText = key.expires_at ? new Date(key.expires_at).toLocaleString() : 'N/A';
            rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expiresText}</td>`;
            
            rowContent += `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center gap-4">
                    <button title="复制" data-key-value="${key.key_value}" class="copy-btn text-blue-600 hover:underline">复制</button>
                    <button title="重置" data-key-value="${key.key_value}" class="reset-btn text-blue-600 hover:underline disabled:text-gray-400" ${key.validation_status !== 'used' ? 'disabled' : ''}>重置</button>
                    <button title="删除" data-key-value="${key.key_value}" class="delete-btn text-red-600 hover:underline">删除</button>
                </td>
            `;
            tr.innerHTML = rowContent;
            keysTableBody.appendChild(tr);
        });
        updatePaginationControls(filteredKeys.length);
    };

    const updateBulkActionsToolbar = () => {
        const selectedCheckboxes = keysTableBody.querySelectorAll('.key-checkbox:checked');
        const count = selectedCheckboxes.length;
        bulkActionsToolbar.classList.toggle('hidden', count === 0);
        selectedCountSpan.textContent = count;
        const allVisibleCheckboxes = keysTableBody.querySelectorAll('.key-checkbox');
        const selectAll = document.getElementById('selectAllCheckbox');
        if(selectAll) {
            selectAll.checked = allVisibleCheckboxes.length > 0 && count === allVisibleCheckboxes.length;
        }
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

    const setStatusMessage = (el, message, isError = false, duration = 3000) => {
        el.textContent = message;
        el.style.color = isError ? 'red' : 'green';
        setTimeout(() => { el.textContent = ''; }, duration);
    };

    // 【修改 handleGeneration 函数，使其支持分钟参数】
    const handleGeneration = async (quantity, keyType, durationDays, durationMinutes = null) => {
        // 禁用所有生成按钮
        generateSingleBtn.disabled = true;
        generateBatchBtn.disabled = true;
        if (generateDebugBtn) generateDebugBtn.disabled = true;
        
        // 检查参数有效性
        if (keyType === 'trial' && !durationDays && !durationMinutes) {
            setStatusMessage(generatorStatus, '请输入有效的持续天数或分钟数。', true);
            // 重新启用按钮
            generateSingleBtn.disabled = false;
            generateBatchBtn.disabled = false;
            if (generateDebugBtn) generateDebugBtn.disabled = false;
            return;
        }

        setStatusMessage(generatorStatus, `正在生成并保存 ${quantity} 个 ${durationMinutes ? durationMinutes + '分钟' : durationDays + '天'} 的密钥...`);
        try {
            // 【核心修改】：调用 DataStore 时传入 durationMinutes
            const result = await DataStore.generateAndSaveKeys(quantity, keyType, durationDays, durationMinutes, password);
            if (result.success) {
                generatedKeysDisplay.value = result.generatedKeys.join('\n');
                setStatusMessage(generatorStatus, `成功保存 ${result.added_count} 个新密钥！`);
                copyKeysBtn.disabled = result.added_count === 0;
            } else { throw new Error(result.message); }
        } catch (error) {
            setStatusMessage(generatorStatus, `操作失败: ${error.message}`, true);
        }
        
        // 启用所有生成按钮
        generateSingleBtn.disabled = false;
        generateBatchBtn.disabled = false;
        if (generateDebugBtn) generateDebugBtn.disabled = false;
    };
    
    // 绑定原有事件 (调用修改后的 handleGeneration)
    generateSingleBtn.addEventListener('click', () => {
        const keyType = document.querySelector('input[name="keyType"]:checked').value;
        const durationDays = keyType === 'trial' ? parseInt(trialDurationInput.value, 10) : null;
        handleGeneration(1, keyType, durationDays);
    });
    
    generateBatchBtn.addEventListener('click', () => {
        const keyType = document.querySelector('input[name="keyType"]:checked').value;
        const durationDays = keyType === 'trial' ? parseInt(trialDurationInput.value, 10) : null;
        handleGeneration(parseInt(batchQuantityInput.value, 10) || 10, keyType, durationDays);
    });
    
    // 【新增调试按钮事件】
    if (generateDebugBtn) {
        generateDebugBtn.addEventListener('click', () => {
            const quantity = parseInt(debugQuantityInput.value, 10) || 1;
            const durationMinutes = parseInt(debugDurationInput.value, 10) || 5;
            // 调试密钥强制使用 'trial' 类型
            handleGeneration(quantity, 'trial', null, durationMinutes);
        });
    }

    keyTypeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            trialDurationWrapper.classList.toggle('hidden', event.target.value !== 'trial');
        });
    });

    copyKeysBtn.addEventListener('click', () => {
        if (!generatedKeysDisplay.value) return;
        navigator.clipboard.writeText(generatedKeysDisplay.value).then(() => {
            copyKeysBtn.textContent = '已复制!';
            setTimeout(() => { copyKeysBtn.textContent = '一键复制'; }, 2000);
        });
    });

    keysTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('key-checkbox')) {
            updateBulkActionsToolbar();
            return;
        }
        const keyValue = target.dataset.keyValue;
        if (!keyValue) return;
        if (target.classList.contains('copy-btn')) { navigator.clipboard.writeText(keyValue).then(() => alert('密钥已复制!')); }
        if (target.classList.contains('reset-btn')) {
            if (confirm(`确定要重置密钥 "${keyValue}" 吗？`)) {
                const result = await DataStore.resetKey(keyValue, password);
                if (result.success) loadViewPage(); else alert(`重置失败: ${result.message}`);
            }
        }
        if (target.classList.contains('delete-btn')) {
            if (confirm(`确定要删除密钥 "${keyValue}" 吗？`)) {
                const result = await DataStore.deleteKey(keyValue, password);
                if (result.success) loadViewPage(); else alert(`删除失败: ${result.message}`);
            }
        }
    });

    deleteSelectedBtn.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.key-checkbox:checked');
        const keysToDelete = Array.from(selectedCheckboxes).map(cb => cb.dataset.keyValue);
        if (keysToDelete.length === 0) return;
        if (confirm(`您确定要删除选中的 ${keysToDelete.length} 个密钥吗？此操作不可撤销。`)) {
            const result = await DataStore.batchDeleteKeys(keysToDelete, password);
            if(result.success) {
                alert(result.message);
                loadViewPage();
            } else {
                alert(`删除失败: ${result.message}`);
            }
        }
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentPage();
            updatePaginationControls();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        const filteredKeys = currentTabView === 'trial' ? allKeysCache.filter(key => key.key_type === 'trial') : allKeysCache;
        const totalPages = Math.ceil(filteredKeys.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderCurrentPage();
            updatePaginationControls();
        }
    });
    
    saveFeishuBtn.addEventListener('click', async () => {
        const url = feishuLinkInput.value.trim();
        if(!url) { setStatusMessage(feishuStatus, '链接不能为空', true); return; }
        const result = await DataStore.saveAdminConfig('feishu', url, password);
        setStatusMessage(feishuStatus, result.message, !result.success);
    });

    saveShortcutBtn.addEventListener('click', async () => {
        const url = shortcutLinkInput.value.trim();
        if(!url) { setStatusMessage(shortcutStatus, '链接不能为空', true); return; }
        const result = await DataStore.saveAdminConfig('shortcut', url, password);
        setStatusMessage(shortcutStatus, result.message, !result.success);
    });

    // --- 6. 初始化 ---
    showPage('home');
});