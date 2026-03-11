import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middlewares/authenticate';

const router = Router();
const userController = new UserController();

// GET /api/users/me  — protected
router.get('/me', authenticate, userController.getMe);

// GET /api/users/:id — public
router.get('/:id', userController.getUserById);

export default router;
