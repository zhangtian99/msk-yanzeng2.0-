import { kv } from '@vercel/kv';

// 固定的数据库键名
const CONFIG_KEY = 'system_config';

function checkAuth(password) {
    return password === process.env.ADMIN_PASSWORD;
}

export default async function handler(request, response) {
    // --- 处理 GET 请求：获取当前配置 ---
    if (request.method === 'GET') {
        const { password } = request.query;
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }
        try {
            const config = await kv.hgetall(CONFIG_KEY);
            return response.status(200).json({ success: true, data: config || {} });
        } catch (error) {
            console.error('获取配置API出错:', error);
            return response.status(500).json({ success: false, message: '服务器内部错误' });
        }
    }

    // --- 处理 POST 请求：更新单个配置 ---
    if (request.method === 'POST') {
        const { link_type, url, password } = request.body;
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }
        if (!['feishu', 'shortcut'].includes(link_type) || !url) {
            return response.status(400).json({ success: false, message: '无效的请求参数' });
        }

        try {
            // hset 会创建或更新指定字段，而不会影响其他字段
            if (link_type === 'feishu') {
                await kv.hset(CONFIG_KEY, { FEISHU_TEMPLATE_LINK: url });
            } else if (link_type === 'shortcut') {
                await kv.hset(CONFIG_KEY, { SHORTCUT_ICLOUD_LINK: url });
            }
            return response.status(200).json({ success: true, message: '配置已成功保存' });
        } catch (error) {
            console.error('保存配置API出错:', error);
            return response.status(500).json({ success: false, message: '服务器内部错误' });
        }
    }

    return response.status(405).json({ success: false, message: `不支持的请求方法: ${request.method}` });
}