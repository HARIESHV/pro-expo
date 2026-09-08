import { Router } from 'express';
import { chatController } from '../controllers/chatController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/conversations', chatController.createConversation);
router.get('/conversations', chatController.getConversations);
router.get('/conversations/:id', chatController.getConversationMessages);
router.delete('/conversations/:id', chatController.deleteConversation);
router.post('/message', chatController.sendMessage);

export default router;
