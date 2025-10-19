// /public/data-store.js

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
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key_value: keyValue, password: password })
        }), "重置密钥失败");
    },
    async generateAndSaveKeys(quantity, keyType, durationDays, durationMinutes, password) {
        return this._handleApiResponse(await fetch("/api/keys/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                quantity: quantity, 
                key_type: keyType, 
                duration_days: durationDays, 
                duration_minutes: durationMinutes,
                password: password 
            })
        }), "批量生成密钥失败");
    },
    async batchDeleteKeys(keyValues, password) {
        return this._handleApiResponse(await fetch("/api/admin/batch-delete-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key_values: keyValues, password: password })
        }), "批量删除密钥失败");
    },

    // 【新增】：删除单个密钥的方法 (对应 admin.js 中的 delete-key-btn)
    async deleteKey(keyValue, password) {
        // keys.js 使用 DELETE 方法，body 中传递 key_value 和 password
        return this._handleApiResponse(await fetch("/api/keys", {
            method: "DELETE", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ key_value: keyValue, password: password })
        }), "删除密钥失败");
    },

    // 配置相关
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
    
    /**
     * 获取公开配置（不需要密码）。
     */
    async getConfig() {
        return this._handleApiResponse(await fetch(`/api/config`), "获取公开配置失败");
    },

    /**
     * 验证密钥有效性并激活（如果未使用）。
     * @param {string} key - 密钥值。
     * @param {string} [userId] - 用户的唯一标识符（可选，仅供快捷指令使用）。
     */
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
    
    // 此方法已弃用，但保留以保持完整性
    async checkTrialStatus(key) {
        return this._handleApiResponse(await fetch("/api/keys/check-trial-status"), "检查试用状态失败");
    },
};