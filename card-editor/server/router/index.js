import express from 'express';
import AuthRouter from './AuthRouter.js';
import TemplateRouter from './TemplateRouter.js';
const router = express();

router.use('/auth', AuthRouter);
router.use('/templates', TemplateRouter);

export default router;
