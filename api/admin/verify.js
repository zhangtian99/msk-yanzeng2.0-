export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        const { password } = request.body;
        const correctPassword = process.env.ADMIN_PASSWORD;
        if (!correctPassword) {
            console.error('SERVER ERROR: ADMIN_PASSWORD environment variable is not set!');
            return response.status(500).json({ success: false, message: '服务器配置错误' });
        }
        if (password === correctPassword) {
            return response.status(200).json({ success: true, message: '验证成功' });
        } else {
            return response.status(401).json({ success: false, message: '密码错误' });
        }
    } catch (error) {
        console.error('API Error in /api/admin/verify:', error);
        return response.status(500).json({ success: false, message: '服务器内部发生意外错误' });
    }
}