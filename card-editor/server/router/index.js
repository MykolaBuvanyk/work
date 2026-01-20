import express from 'express';
import AuthRouter from './AuthRouter.js';
import TemplateRouter from './TemplateRouter.js';
import IconsRouter from './IconsRouter.js';
const router = express();

router.use('/auth', AuthRouter);
router.use('/templates', TemplateRouter);
router.use('/icons', IconsRouter);

export default router;
