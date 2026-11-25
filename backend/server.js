"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = __importDefault(require("./routes/auth"));
const supplier_1 = __importDefault(require("./routes/supplier"));
const admin_1 = __importDefault(require("./routes/admin"));
dotenv_1.default.config();
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is missing.');
    process.exit(1);
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);
// Middleware
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '100kb' }));
// Routes
app.use('/auth', auth_1.default);
app.use('/supplier', supplier_1.default);
app.use('/admin', admin_1.default);
// Root health check
app.get('/health', (_req, res) => {
    res.json({ status: 'OK', service: 'Supplier Work Order Portal Backend' });
});
// Serve frontend static build
let frontendDist = path_1.default.resolve(__dirname, '../../../frontend/dist');
if (!fs_1.default.existsSync(frontendDist)) {
    frontendDist = path_1.default.resolve(__dirname, '../frontend/dist');
}
if (!fs_1.default.existsSync(frontendDist)) {
    frontendDist = path_1.default.resolve(process.cwd(), '../frontend/dist');
}
if (!fs_1.default.existsSync(frontendDist)) {
    frontendDist = path_1.default.resolve(process.cwd(), 'frontend/dist');
}
console.log('Serving frontend from:', frontendDist, '| Found:', fs_1.default.existsSync(frontendDist));
app.use(express_1.default.static(frontendDist));
// SPA wildcard fallback
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(frontendDist, 'index.html'));
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ message: 'Internal server error' });
});
// Start server
app.listen(PORT, () => {
    console.log(`Supplier Work Order Portal backend is running on http://localhost:${PORT}`);
});
exports.default = app;
