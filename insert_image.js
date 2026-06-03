const fs = require('fs');
const path = require('path');

// 配置项
const IMAGE_DIR = 'images';       // 图片目录名
const HTML_FILE = 'index.html';   // 你的HTML文件名
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

// 1. 读取目录下的所有图片，生成相对路径数组
let imagesArray = [];
try {
    const files = fs.readdirSync(IMAGE_DIR);
    imagesArray = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ALLOWED_EXTS.includes(ext);
    }).map(file => `${IMAGE_DIR}/${file}`);
    
    console.log(`找到 ${imagesArray.length} 张图片:`, imagesArray);
} catch (err) {
    console.error(`读取目录失败，请确保 "${IMAGE_DIR}" 文件夹存在:`, err.message);
    process.exit(1);
}

// 2. 生成要插入的 JS 代码字符串
const scriptContent = `
 <script>
    const gallery = document.getElementById('gallery');
    const imagesArray = ${JSON.stringify(imagesArray, null, 4)};

    imagesArray.forEach((src, index) => {
        const item = document.createElement('div');
        item.className = 'item';

        const img = document.createElement('img');
        img.src = src;
        img.alt = \`Image \${index + 1}\`;
        img.loading = 'lazy';

        item.appendChild(img);
        gallery.appendChild(item);
    });
     </script>
`.trim();

// 3. 读取 HTML 文件并替换内容
try {
    let htmlContent = fs.readFileSync(HTML_FILE, 'utf-8');
    
    // 使用正则匹配 <!-- SCRIPT_REPLACE_START --> 和 <!-- SCRIPT_REPLACE_END --> 之间的内容
    const regex = /(<\!-- SCRIPT_REPLACE_START -->)([\s\S]*?)(<\!-- SCRIPT_REPLACE_END -->)/;
    
    if (!regex.test(htmlContent)) {
        console.error(`在 ${HTML_FILE} 中未找到替换标记，请检查 HTML 模板。`);
        process.exit(1);
    }

    // 替换为新的脚本内容
    htmlContent = htmlContent.replace(regex, `$1\n\t${scriptContent}\n\t$3`);

    // 4. 写回 HTML 文件
    fs.writeFileSync(HTML_FILE, htmlContent, 'utf-8');
    console.log(`成功将图片数组写入 ${HTML_FILE}！`);
} catch (err) {
    console.error(`修改 HTML 文件失败:`, err.message);
}
// 注意：请确保你的 HTML 文件中包含 <!-- SCRIPT_REPLACE_START --> 和 <!-- SCRIPT_REPLACE_END --> 标记，以便插入脚本内容。