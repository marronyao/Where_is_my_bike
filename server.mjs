import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/sw.js':'sw.js','/icon.svg':'icon.svg','/manifest.webmanifest':'manifest.webmanifest'};
const mime={html:'text/html',css:'text/css',js:'text/javascript',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
http.createServer(async(req,res)=>{const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404).end();return;}try{res.writeHead(200,{'Content-Type':mime[file.split('.').pop()]+'; charset=utf-8','Cache-Control':'no-cache'}).end(await readFile(new URL(file,import.meta.url)));}catch{res.writeHead(500).end();}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
