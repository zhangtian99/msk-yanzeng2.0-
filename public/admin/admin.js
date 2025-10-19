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
    let currentSearchTerm = '';
    let currentFilter = 'all';

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
    
    // 【修正点】：确保获取所有分页和搜索/筛选控件
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageStartSpan = document.getElementById('pageStartSpan');
    const pageEndSpan = document.getElementById('pageEndSpan');
    const totalItemsSpan = document.getElementById('totalItemsSpan');
    const searchInput = document.getElementById('searchInput');
    const filterSelect = document.getElementById('filterSelect');
    
    const feishuLinkInput = document.getElementById('feishuLinkInput');
    const saveFeishuBtn = document.getElementById('saveFeishuBtn');
    const feishuStatus = document.getElementById('feishuStatus');
    const shortcutLinkInput = document.getElementById('shortcutLinkInput');
    const saveShortcutBtn = document.getElementById('saveShortcutBtn');
    const shortcutStatus = document.getElementById('shortcutStatus');
    const keyTypeRadios = document.querySelectorAll('input[name="keyType"]');
    
    // 获取调试和时长容器
    const trialDurationWrapper = document.getElementById('trialDurationWrapper');
    const debugDurationWrapper = document.getElementById('debugDurationWrapper');
    const debugQuantityInput = document.getElementById('debugQuantityInput'); 
    const debugDurationInput = document.getElementById('debugDurationInput'); 
    const generateDebugBtn = document.getElementById('generateDebugBtn');
    
    const bulkActionsToolbar = document.getElementById('bulkActionsToolbar');
    const selectedCountSpan = document.getElementById('selectedCount');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');


    // --- 4. 核心功能函数 ---
    const showPage = (pageId) => {
        const effectivePageId = pages[pageId] ? pageId : 'home';
        // 确保页面 DOM 元素存在时才操作
        Object.values(pages).forEach(page => page && page.classList.remove('active'));
        if (pages[effectivePageId]) pages[effectivePageId].classList.add('active');
        
        sidebarLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === effectivePageId) link.classList.add('active');
        });
        if (effectivePageId === 'home') loadHomePage();
        if (effectivePageId === 'view') loadViewPage();
        if (effectivePageId === 'config') loadConfigPage();
    };

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
        if (keysTableHead) {
            keysTableHead.innerHTML = headerContent;
            // Re-bind event listener to the new checkbox
            const selectAllCheckbox = document.getElementById('selectAllCheckbox');
            if (selectAllCheckbox) {
                 selectAllCheckbox.addEventListener('click', () => {
                     keysTableBody.querySelectorAll('.key-checkbox').forEach(cb => cb.checked = selectAllCheckbox.checked);
                     updateBulkActionsToolbar();
                });
            }
        }
    };
    
    const renderCurrentPage = () => {
        if (!keysTableBody || !keysTableStatus) return; // 安全退出
        keysTableBody.innerHTML = '';
        keysTableStatus.textContent = '';
        
        // --- 核心修正：现在 allKeysCache 已经是 API 筛选/搜索后的结果 ---
        const filteredKeys = allKeysCache; // 直接使用 API 返回的已筛选/搜索数据
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const keysForCurrentPage = filteredKeys.slice(startIndex, endIndex);

        if (filteredKeys.length === 0) {
            keysTableStatus.textContent = '没有找到符合条件的密钥。';
            return;
        }
        if (keysForCurrentPage.length === 0) {
             keysTableStatus.textContent = '此页无数据。';
             return;
        }
        
        // --- 时间格式化工具函数 ---
        // 关键修正：修改此函数以返回本地时间 (UTC+8) 的格式，以匹配您期望的显示。
        const formatLocalTimeAsRequired = (isoString) => {
            if (!isoString) return 'N/A';
            const date = new Date(isoString);
            
            // 计算 UTC+8 的时间
            // 8小时 * 60分钟/小时 * 60秒/分钟 * 1000毫秒/秒
            const offsetMs = 8 * 60 * 60 * 1000;
            const localDate = new Date(date.getTime() + offsetMs);

            // 提取本地时间组件 (注意：这里使用 getUTC* 确保我们拿到的是经过偏移后的时间，而不是浏览器本地时间)
            const year = localDate.getUTCFullYear();
            const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(localDate.getUTCDate()).padStart(2, '0');
            const hours = String(localDate.getUTCHours()).padStart(2, '0');
            const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
            const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');

            return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
        };
        // ---------------------------------------------

        keysForCurrentPage.forEach(key => {
            const tr = document.createElement('tr');
            const statusText = key.validation_status === 'used' ? '已激活' : '未激活';
            const statusColor = key.validation_status === 'used' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            const keyType = key.key_type === 'trial' ? '试用' : '永久';
            
            let rowContent = `<td class="p-4"><input type="checkbox" class="key-checkbox h-4 w-4" data-key-value="${key.key_value}"></td>`;
            rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">${key.key_value}</td>`;
            if (currentTabView === 'all') { // 保持 this check for rendering columns
                rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${keyType === '试用' ? 'text-yellow-600' : 'text-green-600'}">${keyType}</td>`;
            }
            rowContent += `<td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span></td>`;
            
            const createdText = formatLocalTimeAsRequired(key.created_at);
            rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdText}</td>`;
            
            const expiresText = formatLocalTimeAsRequired(key.expires_at);
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
        if (!keysTableBody || !bulkActionsToolbar || !selectedCountSpan) return;
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
        if (!pageStartSpan || !pageEndSpan || !totalItemsSpan || !prevPageBtn || !nextPageBtn) return; // 安全退出

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        pageStartSpan.textContent = totalItems > 0 ? startIndex + 1 : 0;
        pageEndSpan.textContent = endIndex;
        totalItemsSpan.textContent = totalItems;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    };
    
    // 新增：封装加载列表数据的函数，带筛选/搜索参数
    const fetchAndRenderKeys = async () => {
        if (keysTableStatus) keysTableStatus.textContent = '正在加载...';
        try {
            // API 调用时传入参数
            const result = await DataStore.getAllKeys(password, currentSearchTerm, currentFilter); 
            if (result.success) {
                allKeysCache = result.data;
                currentPage = 1;
                renderTableHeader();
                renderCurrentPage();
            } else { throw new Error(result.message); }
        } catch(error) {
             if (keysTableStatus) keysTableStatus.textContent = `加载失败: ${error.message}`;
        }
    };

    const loadViewPage = () => {
        // 第一次进入时加载数据
        fetchAndRenderKeys();
    };

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


    const setStatusMessage = (el, message, isError = false, duration = 3000) => {
        if (!el) return;
        el.textContent = message;
        el.style.color = isError ? 'red' : 'green';
        setTimeout(() => { el.textContent = ''; }, duration);
    };

    // 【修改 handleGeneration 函数，使其支持分钟参数】
    const handleGeneration = async (quantity, keyType, durationDays, durationMinutes = null) => {
        // 禁用所有生成按钮
        if (generateSingleBtn) generateSingleBtn.disabled = true;
        if (generateBatchBtn) generateBatchBtn.disabled = true;
        if (generateDebugBtn) generateDebugBtn.disabled = true;
        
        // 检查参数有效性
        if (keyType === 'trial' && !durationDays && !durationMinutes) {
            setStatusMessage(generatorStatus, '请输入有效的持续天数或分钟数。', true);
            // 重新启用按钮
            if (generateSingleBtn) generateSingleBtn.disabled = false;
            if (generateBatchBtn) generateBatchBtn.disabled = false;
            if (generateDebugBtn) generateDebugBtn.disabled = false;
            return;
        }

        setStatusMessage(generatorStatus, `正在生成并保存 ${quantity} 个 ${durationMinutes ? durationMinutes + '分钟' : durationDays + '天'} 的密钥...`);
        try {
            // 调用 DataStore 时传入 durationMinutes
            const result = await DataStore.generateAndSaveKeys(quantity, keyType, durationDays, durationMinutes, password);
            if (result.success) {
                // 【核心修复】：安全地获取 generated_keys，并使用 added_count 显示成功信息
                const generatedKeys = Array.isArray(result.generated_keys) ? result.generated_keys : [];
                
                if (generatedKeysDisplay) generatedKeysDisplay.value = generatedKeys.join('\n');
                
                // 修正：显示生成成功的消息 (绿色字体)
                setStatusMessage(generatorStatus, `成功保存 ${result.added_count} 个新密钥！`);
                
                if (copyKeysBtn) copyKeysBtn.disabled = generatedKeys.length === 0;
            } else { throw new Error(result.message); }
        } catch (error) {
            setStatusMessage(generatorStatus, `操作失败: ${error.message}`, true);
        }
        
        // 启用所有生成按钮
        if (generateSingleBtn) generateSingleBtn.disabled = false;
        if (generateBatchBtn) generateBatchBtn.disabled = false;
        if (generateDebugBtn) generateDebugBtn.disabled = false;
    };
    
    // 绑定原有事件 (调用修改后的 handleGeneration)
    if (generateSingleBtn) {
        generateSingleBtn.addEventListener('click', () => {
            const keyType = document.querySelector('input[name="keyType"]:checked').value;
            let durationDays = null;
            if (keyType === 'trial') {
                 // 修正：试用密钥硬编码为 3 天
                 durationDays = 3;
            }
            handleGeneration(1, keyType, durationDays);
        });
    }
    
    if (generateBatchBtn) {
        generateBatchBtn.addEventListener('click', () => {
            const keyType = document.querySelector('input[name="keyType"]:checked').value;
            let durationDays = null;
            if (keyType === 'trial') {
                 // 修正：试用密钥硬编码为 3 天
                 durationDays = 3;
            }
            handleGeneration(parseInt(batchQuantityInput.value, 10) || 10, keyType, durationDays);
        });
    }
    
    // 【新增调试按钮事件】
    if (generateDebugBtn) {
        generateDebugBtn.addEventListener('click', () => {
            const quantity = parseInt(debugQuantityInput.value, 10) || 1;
            const durationMinutes = parseInt(debugDurationInput.value, 10) || 5;
            // 调试密钥强制使用 'trial' 类型
            handleGeneration(quantity, 'trial', null, durationMinutes);
        });
    }

    // 【修正显示逻辑】：根据 KeyType 切换时长输入框和调试功能的显示
    const updateVisibility = (keyType) => {
        const isTrial = keyType === 'trial';
        
        // 试用密钥时长（天）标签
        if (trialDurationWrapper) {
            trialDurationWrapper.style.display = isTrial ? 'block' : 'none';
        }
        
        // 调试功能（分钟）
        if (debugDurationWrapper) {
            debugDurationWrapper.style.display = isTrial ? 'block' : 'none';
        }
    };
    
    keyTypeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            updateVisibility(event.target.value);
        });
    });
    
    // 初始化时确保正确的显示状态
    const initialKeyType = document.querySelector('input[name="keyType"]:checked')?.value || 'permanent';
    updateVisibility(initialKeyType);


    if (copyKeysBtn) {
        copyKeysBtn.addEventListener('click', () => {
            if (!generatedKeysDisplay || !generatedKeysDisplay.value) return;
            // 使用 execCommand('copy') for better compatibility
            try {
                navigator.clipboard.writeText(generatedKeysDisplay.value).then(() => {
                    copyKeysBtn.textContent = '已复制!';
                    setTimeout(() => { copyKeysBtn.textContent = '一键复制'; }, 2000);
                });
            } catch (err) {
                 console.error('Copy failed:', err);
            }
        });
    }


    // 绑定搜索和筛选事件
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentSearchTerm = searchInput.value.trim();
            currentPage = 1; // 搜索时重置页码
            fetchAndRenderKeys();
        });
    }

    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            currentFilter = filterSelect.value;
            currentPage = 1; // 筛选时重置页码
            fetchAndRenderKeys();
        });
    }

    // 【核心修复】：菜单按钮点击事件绑定
    if (sidebarLinks.length > 0) {
        sidebarLinks.forEach(link => link.addEventListener('click', () => showPage(link.dataset.page)));
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => { 
            sessionStorage.removeItem('admin-token'); 
            window.location.href = '/admin/login.html'; 
        });
    }
    // End of 菜单按钮点击事件绑定
    

    keysTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('key-checkbox')) {
            updateBulkActionsToolbar();
            return;
        }
        const keyValue = target.dataset.keyValue;
        if (!keyValue) return;
        if (target.classList.contains('copy-btn')) { 
            navigator.clipboard.writeText(keyValue).then(() => alert('密钥已复制!')); 
        }
        if (target.classList.contains('reset-btn')) {
            // 重置后重新加载列表
            if (window.confirm(`确定要重置密钥 "${keyValue}" 吗？`)) { 
                const result = await DataStore.resetKey(keyValue, password);
                if (result.success) fetchAndRenderKeys(); else alert(`重置失败: ${result.message}`);
            }
        }
        if (target.classList.contains('delete-btn')) {
            // 删除后重新加载列表
            if (window.confirm(`确定要删除密钥 "${keyValue}" 吗？`)) {
                // 使用 DELETE /api/keys 删除单个密钥
                const result = await DataStore.deleteKey(keyValue, password);
                if (result.success) fetchAndRenderKeys(); else alert(`删除失败: ${result.message}`);
            }
        }
    });

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', async () => {
            const selectedCheckboxes = document.querySelectorAll('.key-checkbox:checked');
            const keysToDelete = Array.from(selectedCheckboxes).map(cb => cb.dataset.keyValue);
            if (keysToDelete.length === 0) return;
            // 批量删除后重新加载列表
            if (window.confirm(`您确定要删除选中的 ${keysToDelete.length} 个密钥吗？此操作不可撤销。`)) {
                const result = await DataStore.batchDeleteKeys(keysToDelete, password);
                if(result.success) {
                    alert(result.message);
                    fetchAndRenderKeys(); 
                } else {
                    alert(`删除失败: ${result.message}`);
                }
            }
        });
    }
    
    // Pagination controls
    if (prevPageBtn) {
         prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderCurrentPage();
                updatePaginationControls(allKeysCache.length); // 传入总数进行更新
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const filteredKeys = allKeysCache; // 使用当前缓存的总数
            const totalPages = Math.ceil(filteredKeys.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderCurrentPage();
                updatePaginationControls(allKeysCache.length); // 传入总数进行更新
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


    // --- 6. 初始化 ---
    showPage('home');
});