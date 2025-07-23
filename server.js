// server.js

// Import các thư viện cần thiết
const express = require('express');
const fetch = require('node-fetch'); // Sử dụng node-fetch để gọi API
const path = require('path');
require('dotenv').config(); // Để đọc biến môi trường từ file .env

// Khởi tạo ứng dụng Express
const app = express();
const PORT = process.env.PORT || 3000; // Render sẽ tự cung cấp PORT

// Middleware để xử lý JSON và phục vụ các tệp tĩnh
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Phục vụ các tệp trong cùng thư mục

// Route chính để phục vụ file index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route API proxy để gọi đến Stability AI một cách an toàn với cơ chế luân chuyển key
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    // Lấy danh sách API key từ biến môi trường.
    // Các key được phân tách bằng dấu phẩy, ví dụ: "key1,key2,key3"
    const apiKeysString = process.env.STABILITY_API_KEYS;

    if (!apiKeysString) {
        console.error('STABILITY_API_KEYS not found in environment variables.');
        return res.status(500).json({ error: 'API keys are not configured on the server.' });
    }

    // Tách chuỗi thành một mảng các key và loại bỏ khoảng trắng thừa
    const apiKeys = apiKeysString.split(',').map(key => key.trim());

    // --- THAY ĐỔI MODEL TẠI ĐÂY ---
    // Đã chuyển từ 'stable-diffusion-v1-6' sang model SDXL 1.0 theo yêu cầu.
    const engineId = 'stable-diffusion-xl-base-1.0';
    const apiHost = 'https://api.stability.ai';

    // Vòng lặp để thử từng key
    for (const apiKey of apiKeys) {
        console.log(`Trying API key ending with ...${apiKey.slice(-4)}`);
        try {
            const response = await fetch(`${apiHost}/v1/generation/${engineId}/text-to-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    text_prompts: [{ text: prompt }],
                    cfg_scale: 7,
                    height: 1024,
                    width: 1024,
                    steps: 30,
                    samples: 1,
                    // style_preset: "anime" // Bạn có thể thêm các tham số cho model XL tại đây nếu cần
                }),
            });

            // Nếu key hợp lệ và yêu cầu thành công (status 200 OK)
            if (response.ok) {
                console.log(`Success with API key ...${apiKey.slice(-4)}`);
                const responseJSON = await response.json();
                return res.json(responseJSON); // Trả kết quả về cho client và kết thúc
            }

            // Nếu key không hợp lệ hoặc hết tín dụng (401 Unauthorized)
            // Stability AI thường dùng mã 401 cho các trường hợp này.
            if (response.status === 401) {
                console.warn(`API key ...${apiKey.slice(-4)} failed (Unauthorized/Out of credits). Trying next key.`);
                continue; // Bỏ qua key này và thử key tiếp theo trong vòng lặp
            }
            
            // Đối với các lỗi khác (ví dụ: lỗi server 5xx từ Stability), chúng ta dừng lại và báo lỗi
            const errorText = await response.text();
            throw new Error(`Non-recoverable response from Stability AI: ${response.status} - ${errorText}`);

        } catch (error) {
            // Bắt các lỗi mạng hoặc lỗi được ném ra ở trên
            console.error(`Error with API key ...${apiKey.slice(-4)}:`, error.message);
            // Nếu đây là key cuối cùng, vòng lặp sẽ kết thúc và lỗi cuối cùng sẽ được trả về bên dưới.
        }
    }

    // Nếu vòng lặp kết thúc mà không có key nào thành công
    console.error('All API keys failed.');
    res.status(500).json({ error: 'Failed to generate image. All available API keys failed.' });
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
