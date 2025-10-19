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
    const getElement = (id) => document.getElementById(id);
    const getAllElements = (selector) => document.querySelectorAll(selector);

    const pages = { 
        home: getElement('page-home'), 
        create: getElement('page-create'), 
        view: getElement('page-view'), 
        config: getElement('page-config') 
    };
    const sidebarLinks = getAllElements('.sidebar-link[data-page]');
    const logoutBtn = getElement('logoutBtn');

    // 统计数据
    const statsTotalKeys = getElement('stats-total-keys');
    const statsUsedKeys = getElement('stats-used-keys');
    const statsUnusedKeys = getElement('stats-unused-keys');

    // 密钥生成 (Create Page)
    const generatedKeysDisplay = getElement('generatedKeysDisplay');
    const generateSingleBtn = getElement('generateSingleBtn');
    const generateBatchBtn = getElement('generateBatchBtn');
    const batchQuantityInput = getElement('batchQuantityInput');
    const copyKeysBtn = getElement('copyKeysBtn');
    const generatorStatus = getElement('generatorStatus');
    const keyTypeRadios = getAllElements('input[name="keyType"]');
    
    // 调试和时长容器
    const trialDurationWrapper = getElement('trialDurationWrapper');
    const debugDurationWrapper = getElement('debugDurationWrapper');
    const debugQuantityInput = getElement('debugQuantityInput'); 
    const debugDurationInput = getElement('debugDurationInput'); 
    const generateDebugBtn = getElement('generateDebugBtn');
    
    // 密钥查看 (View Page)
    const keysTableHead = getElement('keys-table-head');
    const keysTableBody = getElement('keys-table-body');
    const keysTableStatus = getElement('keys-table-status'); 

    // 分页、搜索、筛选 - 【关键修正：获取所有分页按钮】
    const prevPageBtns = getAllElements('#prevPageBtn, #mobilePrevPageBtn'); 
    const nextPageBtns = getAllElements('#nextPageBtn, #mobileNextPageBtn'); 
    
    const pageStartSpan = getElement('pageStartSpan');
    const pageEndSpan = getElement('pageEndSpan');
    const totalItemsSpan = getElement('totalItemsSpan');
    const searchInput = getElement('searchInput');
    const filterSelect = getElement('filterSelect');
    const tabLinks = getAllElements('.tab-link'); 
    
    // 【新增获取搜索按钮】
    const searchBtn = getElement('searchBtn');

    // 批量操作
    const bulkActionsToolbar = getElement('bulkActionsToolbar');
    const selectedCountSpan = getElement('selectedCount');
    const deleteSelectedBtn = getElement('deleteSelectedBtn');

    // 配置 (Config Page)
    const feishuLinkInput = getElement('feishuLinkInput');
    const saveFeishuBtn = getElement('saveFeishuBtn');
    const feishuStatus = getElement('feishuStatus');
    const shortcutLinkInput = getElement('shortcutLinkInput');
    const saveShortcutBtn = getElement('saveShortcutBtn');
    const shortcutStatus = getElement('shortcutStatus');


    // --- 4. 核心功能函数 ---
    
    // 状态信息显示 (增加 duration 参数)
    const setStatusMessage = (el, message, isError = false, duration = 3000) => {
        // 健壮性检查：如果元素不存在，立即返回
        if (!el) {
            console.warn(`Attempted to set status message on null element.`);
            return;
        }
        el.textContent = message;
        el.style.color = isError ? 'red' : 'green';
        setTimeout(() => { el.textContent = ''; }, duration);
    };

    const showPage = (pageId) => {
        const effectivePageId = pages[pageId] ? pageId : 'home';
        // 确保页面 DOM 元素存在时才操作
        Object.values(pages).forEach(page => page && page.classList.remove('active'));
        if (pages[effectivePageId]) pages[effectivePageId].classList.add('active');
        
        sidebarLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === effectivePageId) link.classList.add('active');
        });
        
        // 【优化点】：确保 DataStore 存在，防止在 showPage 内部触发错误
        if (typeof DataStore === 'undefined') {
             console.error("Cannot load page data: DataStore is not defined.");
             return;
        }
        
        if (effectivePageId === 'home') loadHomePage();
        if (effectivePageId === 'view') loadViewPage();
        if (effectivePageId === 'config') loadConfigPage();
    };

    const formatLocalTimeAsRequired = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        
        // 计算 UTC+8 的时间
        const offsetMs = 8 * 60 * 60 * 1000;
        const localDate = new Date(date.getTime() + offsetMs);

        // 提取本地时间组件
        const year = localDate.getUTCFullYear();
        const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(localDate.getUTCDate()).padStart(2, '0');
        const hours = String(localDate.getUTCHours()).padStart(2, '0');
        const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
        const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');

        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    };

    const renderTableHeader = () => {
        let headerContent = '<tr><th class="p-4"><input type="checkbox" id="selectAllCheckbox" class="h-4 w-4"></th>';
        const baseHeaders = `
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">密钥值</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
        `;
        // 统一渲染所有列
        headerContent += baseHeaders + `
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">过期时间</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
        `;

        if (keysTableHead) {
            keysTableHead.innerHTML = headerContent;
            // Re-bind event listener to the new checkbox
            const selectAllCheckbox = document.getElementById('selectAllCheckbox');
            if (selectAllCheckbox) {
                 keysTableBody && selectAllCheckbox.addEventListener('click', () => {
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

        keysForCurrentPage.forEach(key => {
            const tr = document.createElement('tr');
            const statusText = key.validation_status === 'used' ? '已激活' : '未激活';
            const statusColor = key.validation_status === 'used' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            const keyType = key.key_type === 'trial' ? '试用' : '永久';
            
            let rowContent = `<td class="p-4"><input type="checkbox" class="key-checkbox h-4 w-4" data-key-value="${key.key_value}"></td>`;
            rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">${key.key_value}</td>`;
            rowContent += `<td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span></td>`;
            
            const createdText = formatLocalTimeAsRequired(key.created_at);
            rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdText}</td>`;
            
            // 修正：统一渲染类型和过期时间列
            rowContent += `<td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${keyType === '试用' ? 'text-yellow-600' : 'text-green-600'}">${keyType}</td>`;
            
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

    // 【关键修正：更新分页控件函数，处理多个按钮】
    const updatePaginationControls = (totalItems) => {
        if (!pageStartSpan || !pageEndSpan || !totalItemsSpan) return; 

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        pageStartSpan.textContent = totalItems > 0 ? startIndex + 1 : 0;
        pageEndSpan.textContent = Math.min(endIndex, totalItems); 
        totalItemsSpan.textContent = totalItems;
        
        const isFirstPage = currentPage === 1;
        const isLastPage = currentPage >= totalPages;

        // 遍历所有上一页和下一页按钮并设置禁用状态
        prevPageBtns.forEach(btn => btn.disabled = isFirstPage);
        nextPageBtns.forEach(btn => btn.disabled = isLastPage);
    };
    
    // 【关键修正：修改 fetchAndRenderKeys 以传递搜索和筛选参数】
    const fetchAndRenderKeys = async () => {
        if (keysTableStatus) keysTableStatus.textContent = '正在加载...';
        try {
            // API 调用时传入参数 - 【修正点】: 传递 currentSearchTerm 和 currentFilter
            // 确保 DataStore.getAllKeys 现在被调用时带有搜索和筛选参数
            const result = await DataStore.getAllKeys(password, currentSearchTerm, currentFilter); 
            if (result.success) {
                allKeysCache = result.data;
                // 注意：这里不需要重置 currentPage = 1，因为搜索事件已经重置了
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
        // 安全检查：确保元素存在
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
            if (feishuStatus) setStatusMessage(feishuStatus, `加载失败: ${error.message}`, true); 
            if (shortcutStatus) setStatusMessage(shortcutStatus, `加载失败: ${error.message}`, true); 
        }
    };


    // 【修改 handleGeneration 函数，使其支持分钟参数】
    const handleGeneration = async (quantity, keyType, durationDays, durationMinutes = null) => {
        // 禁用所有生成按钮 (需要确保这些按钮都已在 DOM 中被获取)
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
            const keyType = document.querySelector('input[name="keyType"]:checked')?.value || 'permanent'; // 安全获取
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
            const keyType = document.querySelector('input[name="keyType"]:checked')?.value || 'permanent'; // 安全获取
            let durationDays = null;
            if (keyType === 'trial') {
                 // 修正：试用密钥硬编码为 3 天
                 durationDays = 3;
            }
            handleGeneration(parseInt(batchQuantityInput?.value, 10) || 10, keyType, durationDays);
        });
    }
    
    // 【新增调试按钮事件】
    if (generateDebugBtn) {
        generateDebugBtn.addEventListener('click', () => {
            const quantity = parseInt(debugQuantityInput?.value, 10) || 1;
            const durationMinutes = parseInt(debugDurationInput?.value, 10) || 5;
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
            // 使用 Clipboard API
            try {
                navigator.clipboard.writeText(generatedKeysDisplay.value).then(() => {
                    copyKeysBtn.textContent = '已复制!';
                    setTimeout(() => { copyKeysBtn.textContent = '一键复制'; }, 2000);
                });
            } catch (err) {
                 console.error('Copy failed:', err);
                 alert('复制失败，请手动复制。');
            }
        });
    }


    // 【关键修正：搜索事件处理函数】
    const searchHandler = () => {
        if (!searchInput) return; 

        currentSearchTerm = searchInput.value.trim();
        currentPage = 1; // 搜索时重置页码
        // 触发数据加载
        fetchAndRenderKeys();
    };

    if (searchBtn) {
        // 绑定点击事件
        searchBtn.addEventListener('click', searchHandler);
    }
    
    if (searchInput) {
        // 移除原有的 input 实时搜索功能
        searchInput.removeEventListener('input', searchHandler); 
        
        // 监听 Enter 键，使其也能触发搜索
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                searchHandler();
            }
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
    
    // 表格操作按钮事件委托
    if (keysTableBody) {
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
                    const result = await DataStore.deleteKey(keyValue, password);
                    if (result.success) fetchAndRenderKeys(); else alert(`删除失败: ${result.message}`);
                }
            }
        });
    }


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
    
    // 【关键修正：分页控制事件绑定，绑定到所有按钮】
    const handlePaginationClick = (isNext) => {
        const filteredKeys = allKeysCache;
        const totalPages = Math.ceil(filteredKeys.length / itemsPerPage);

        // 如果在最后一页尝试点击下一页，或在第一页尝试点击上一页，则返回
        if (isNext && currentPage >= totalPages) return;
        if (!isNext && currentPage <= 1) return;

        if (isNext) {
            currentPage++;
        } else {
            currentPage--;
        }
        renderCurrentPage();
        updatePaginationControls(filteredKeys.length);
    };

    // 绑定 Prev 按钮
    prevPageBtns.forEach(btn => {
        // 移除旧的事件监听器以防重复绑定 (仅作为健壮性措施)
        btn.removeEventListener('click', () => handlePaginationClick(false)); 
        btn.addEventListener('click', () => handlePaginationClick(false));
    });

    // 绑定 Next 按钮
    nextPageBtns.forEach(btn => {
        // 移除旧的事件监听器以防重复绑定 (仅作为健壮性措施)
        btn.removeEventListener('click', () => handlePaginationClick(true)); 
        btn.addEventListener('click', () => handlePaginationClick(true));
    });


    // Config save buttons
    if (saveFeishuBtn) {
        saveFeishuBtn.addEventListener('click', async () => {
            const url = feishuLinkInput?.value.trim() || '';
            if(!url) { setStatusMessage(feishuStatus, '链接不能为空', true); return; }
            const result = await DataStore.saveAdminConfig('feishu', url, password);
            setStatusMessage(feishuStatus, result.message, !result.success);
        });
    }
    
    if (saveShortcutBtn) {
        saveShortcutBtn.addEventListener('click', async () => {
            const url = shortcutLinkInput?.value.trim() || '';
            if(!url) { setStatusMessage(shortcutStatus, '链接不能为空', true); return; }
            const result = await DataStore.saveAdminConfig('shortcut', url, password);
            setStatusMessage(shortcutStatus, result.message, !result.success);
        });
    }


    // --- 6. 初始化 ---
    // 确保 DataStore 已加载
    if (typeof DataStore === 'undefined') {
        console.error("DataStore is not loaded. Please ensure /data-store.js is included before admin.js in the HTML.");
        return; 
    }
    
    // 初始化时确保正确的显示状态 (防止切换到非 trial 页面时隐藏输入框)
    if (initialKeyType === 'permanent') {
        if (trialDurationWrapper) trialDurationWrapper.style.display = 'none';
        if (debugDurationWrapper) debugDurationWrapper.style.display = 'none';
    }

    showPage('home');
});