const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Helper to determine content type
const getContentType = (ext) => {
    switch (ext) {
        case '.html': return 'text/html';
        case '.css': return 'text/css';
        case '.js': return 'text/javascript';
        case '.json': return 'application/json';
        default: return 'text/plain';
    }
};

const server = http.createServer((req, res) => {
    // CORS headers just in case
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Handle API routes
    if (req.url.startsWith('/api/')) {
        const file = req.url.split('/api/')[1];
        if (file !== 'worlds.json' && file !== 'articles.json' && file !== 'distant-categories.json') {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
        }

        const filePath = path.join(DATA_DIR, file);

        if (req.method === 'GET') {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: err.message }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            });
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    // Try parsing to ensure it's valid JSON before saving
                    JSON.parse(body);
                    // Format JSON with 4 spaces to match current formatting
                    const formattedJson = JSON.stringify(JSON.parse(body), null, 4);
                    fs.writeFile(filePath, formattedJson, 'utf8', (err) => {
                        if (err) {
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: err.message }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    });
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid JSON', details: e.message }));
                }
            });
        }
        return;
    }

    // Handle static files
    let staticPath = req.url === '/' ? '/index.html' : req.url;
    // Prevent directory traversal
    staticPath = path.normalize(staticPath).replace(/^(\.\.[\/\\])+/, '');
    
    // Serve from public dir
    const servePath = path.join(PUBLIC_DIR, staticPath);
    const ext = path.extname(servePath);
    
    fs.readFile(servePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': getContentType(ext) });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Editor server running at http://localhost:${PORT}`);
    console.log(`API endpoints accessible at http://localhost:${PORT}/api/worlds.json and /api/articles.json`);
});
