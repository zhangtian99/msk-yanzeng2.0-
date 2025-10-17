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
    
    // 获取统计数据等方法...
    async getStats(password) {
        return this._handleApiResponse(await fetch(`/api/admin/stats?password=${encodeURIComponent(password)}`), "获取统计数据失败");
    },
    async getAllKeys(password) {
        return this._handleApiResponse(await fetch(`/api/keys?password=${encodeURIComponent(password)}`), "获取密钥列表失败");
    },
    async resetKey(keyValue, password) {
        return this._handleApiResponse(await fetch("/api/admin/reset-key", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_value: keyValue, password })
        }), "重置密钥失败");
    },
    async batchDeleteKeys(keyValues, password) {
        return this._handleApiResponse(await fetch("/api/admin/batch-delete-keys", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_values: keyValues, password })
        }), "批量删除密钥失败");
    },

    // 【核心修正】：生成密钥的Payload构建
    async generateAndSaveKeys(quantity, keyType, durationDays, password) {
        const payload = {
            quantity,
            key_type: keyType,
            password
        };
        // 只有当 keyType 是 trial 时才添加 duration_days 字段，以避免 400 Bad Request
        if (keyType === 'trial') {
            payload.duration_days = durationDays;
        }

        return this._handleApiResponse(await fetch("/api/keys/batch", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        }), "生成密钥失败");
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
    async validateKey(key) {
        // 【核心修正】：移除 anonymous_user_id 字段
        return this._handleApiResponse(await fetch("/api/keys/validate-key-web", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key })
        }), "密钥验证失败");
    },
    async checkTrialStatus(key) {
        return this._handleApiResponse(await fetch("/api/keys/check-trial-status", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key })
        }), "试用密钥检查失败");
    },
    
    // 获取公开配置的方法 (用于快捷指令跳转)
    async getConfig() {
        const response = await fetch("/api/config"); 
        return this._handleApiResponse(response, "获取公开配置失败");
    },
};