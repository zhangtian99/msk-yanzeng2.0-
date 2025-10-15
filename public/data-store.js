const DataStore = {
    // 这是一个通用的辅助函数，用来处理所有API请求的响应
    async _handleApiResponse(response, errorMessagePrefix) {
        if (!response.ok) {
            try {
                const errorData = await response.json();
                throw new Error(errorData.message || `${errorMessagePrefix}: ${response.status} ${response.statusText}`);
            } catch (e) {
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
    async getAllKeys(password) {
        return this._handleApiResponse(await fetch(`/api/keys?password=${encodeURIComponent(password)}`), "获取密钥列表失败");
    },
    async generateAndSaveKeys(quantity, password) {
        return this._handleApiResponse(await fetch("/api/keys/batch", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity, password })
        }), "批量生成密钥失败");
    },
    async resetKey(keyValue, password) {
        return this._handleApiResponse(await fetch("/api/admin/reset-key", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_value: keyValue, password })
        }), "重置密钥失败");
    },
    async deleteKey(keyValue, password) {
         return this._handleApiResponse(await fetch("/api/keys", {
            method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_value: keyValue, password })
        }), "删除密钥失败");
    },
    async getAdminConfig(password) {
        return this._handleApiResponse(await fetch(`/api/admin/config?password=${encodeURIComponent(password)}`), "获取配置失败");
    },
    async saveAdminConfig(linkType, url, password) {
        return this._handleApiResponse(await fetch("/api/admin/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ link_type: linkType, url: url, password: password })
        }), "保存配置失败");
    },
    async batchDeleteKeys(keyValues, password) {
        return this._handleApiResponse(await fetch("/api/admin/batch-delete-keys", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key_values: keyValues, password })
        }), "批量删除密钥失败");
    },

    // --- 用户前端需要的方法 ---
    async getConfig() {
        // 这个方法调用的是公开API，不需要密码
        const response = await fetch("/api/config"); 
        const data = await this._handleApiResponse(response, "获取配置信息失败");
        if (data.success) return data.data;
        throw new Error(data.message || "获取配置信息失败");
    },
    async getFeishuTemplateLink() {
        const config = await this.getConfig();
        return config.FEISHU_TEMPLATE_LINK;
    },
    async getShortcutLink() {
        const config = await this.getConfig();
        return config.SHORTCUT_ICLOUD_LINK;
    }
};
window.DataStore = DataStore;