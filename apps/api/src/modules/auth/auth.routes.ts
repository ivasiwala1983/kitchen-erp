/**
 * Auth Module — Routes
 *
 * Public:  POST /api/auth/login
 * Public:  POST /api/auth/refresh
 * Private: GET  /api/auth/me
 * Private: POST /api/auth/change-password
 * Private: POST /api/auth/logout
 */

import { Router } from 'express';
import { login, refreshToken, getMe, changePassword, logout } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/refresh', refreshToken);

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);
router.post('/logout', authenticate, logout);

export default router;
