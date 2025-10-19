const DataStore = {
    // 这是一个通用的辅助函数，用来处理所有API请求的响应
    async _handleApiResponse(response, errorMessagePrefix) {
        if (!response.ok) {
            try {
                const errorData = await response.json();
                throw new Error(errorData.message || `${errorMessagePrefix}: ${response.status} ${response.statusText}`);
            } catch (e) {
                // 如果API返回的不是JSON，则抛出通用错误
                throw new Error(`${errorMessagePrefix}: ${response.status} ${response.statusText}`);
            }
        }
        return response.json();
    },

    // --- 管理后台功能 ---
    async verifyAdminPassword(password) {
        return this._handleApiResponse(await fetch("/api/admin/verify", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password })
        }), "密码验证失败");
    },
    
    async getStats(password) {
        return this._handleApiResponse(await fetch(`/api/admin/stats?password=${encodeURIComponent(password)}`), "获取统计数据失败");
    },
    
    // 【修正点】：getAllKeys 现在接受 search 和 filter 参数
    async getAllKeys(password, search = '', filter = 'all') {
        const queryParams = new URLSearchParams({ 
            password: password, 
            search: search, 
            filter: filter 
        }).toString();
        
        return this._handleApiResponse(await fetch(`/api/keys?${queryParams}`), "获取密钥列表失败");
    },
    
    async resetKey(keyValue, password) {
        return this._handleApiResponse(await fetch("/api/admin/reset-key", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_value: keyValue, password })
        }), "重置密钥失败");
    },
    async generateAndSaveKeys(quantity, keyType, durationDays, durationMinutes, password) {
        const payload = {
            quantity,
            key_type: keyType,
            password
        };
        // 只有当 keyType 是 trial 时才添加时间字段
        if (keyType === 'trial') {
            // 优先使用分钟 (用于调试)
            if (durationMinutes) {
                payload.duration_minutes = durationMinutes;
            } 
            // 否则使用天数 (正常流程)
            else if (durationDays) {
                payload.duration_days = durationDays;
            }
        }
        return this._handleApiResponse(await fetch("/api/keys/batch", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        }), "生成密钥失败");
    },
    async batchDeleteKeys(keyValues, password) {
        return this._handleApiResponse(await fetch("/api/admin/batch-delete-keys", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_values: keyValues, password })
        }), "批量删除密钥失败");
    },
    async deleteKey(keyValue, password) {
        return this._handleApiResponse(await fetch("/api/keys", {
            method: "DELETE", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ key_value: keyValue, password: password })
        }), "删除密钥失败");
    },

    // 配置保存方法
    async saveAdminConfig(linkType, url, password) {
        return this._handleApiResponse(await fetch("/api/admin/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ link_type: linkType, url: url, password: password })
        }), "保存配置失败");
    },
    async getAdminConfig(password) {
        return this._handleApiResponse(await fetch(`/api/admin/config?password=${encodeURIComponent(password)}`), "获取配置失败");
    },

    // --- 用户前端需要的方法 ---
    async validateKey(key, userId) {
        const payload = { key };
        if (userId) {
            payload.user_id = userId;
        }
        return this._handleApiResponse(await fetch("/api/validate-key-web", {
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(payload)
        }), "密钥验证失败");
    },
    
    async checkTrialStatus(key) {
        return this._handleApiResponse(await fetch("/api/keys/check-trial-status", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key })
        }), "试用密钥检查失败");
    },
    
    async getConfig() {
        const response = await fetch("/api/config"); 
        return this._handleApiResponse(response, "获取公开配置失败");
    },
};