import { kv } from '@vercel/kv';

function checkAuth(password) {
    return password === process.env.ADMIN_PASSWORD;
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        const { key_values, password } = request.body;
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }
        if (!Array.isArray(key_values) || key_values.length === 0) {
            return response.status(400).json({ success: false, message: '请提供要删除的密钥列表' });
        }
        const pipeline = kv.pipeline();
        key_values.forEach(key => {
            pipeline.del(`key:${key}`);
        });
        await pipeline.exec();
        return response.status(200).json({ success: true, message: `成功删除了 ${key_values.length} 个密钥` });
    } catch (error) {
        console.error('批量删除密钥API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}