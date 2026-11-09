import qrcode from 'qrcode-generator';
import { createSakuraQR, PALETTES, buildTree } from '../src/sakura-qr-tree.js';
globalThis.qrcode = qrcode;
globalThis.SakuraQR = { createSakuraQR, PALETTES, buildTree };
