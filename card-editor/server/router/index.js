import express from 'express';
import AuthRouter from './AuthRouter.js';
import TemplateRouter from './TemplateRouter.js';
import IconsRouter from './IconsRouter.js';
import CartRouter from './CartRouter.js';
import ShareRouter from './ShareRouter.js';
const router = express();

router.use('/auth', AuthRouter);
router.use('/templates', TemplateRouter);
router.use('/icons', IconsRouter);
router.use('/cart', CartRouter);
router.use('/share', ShareRouter);

export default router;
