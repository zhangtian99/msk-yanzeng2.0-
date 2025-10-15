import { kv } from '@vercel/kv';

const CONFIG_KEY = 'system_config';

export default async function handler(request, response) {
    if (request.method === 'GET') {
        try {
            const config = await kv.hgetall(CONFIG_KEY);
            // 如果数据库中没有配置，返回空字符串
            const publicConfig = {
                FEISHU_TEMPLATE_LINK: config?.FEISHU_TEMPLATE_LINK || '',
                SHORTCUT_ICLOUD_LINK: config?.SHORTCUT_ICLOUD_LINK || ''
            };
            return response.status(200).json({ success: true, data: publicConfig });
        } catch (error) {
            console.error('获取公开配置API出错:', error);
            return response.status(500).json({ success: false, message: '服务器内部错误' });
        }
    }
    return response.status(405).json({ success: false, message: '仅允许GET请求' });
}