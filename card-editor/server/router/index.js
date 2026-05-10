import express from 'express';
import AuthRouter from './AuthRouter.js';
import TemplateRouter from './TemplateRouter.js';
import IconsRouter from './IconsRouter.js';
import CartRouter from './CartRouter.js';
import ShareRouter from './ShareRouter.js';
import SendEmail from './SendEmail.js';
import ProjectsRouter from './ProjectsRouter.js';
import UPSRouter from './UPSRouter.js';
const router = express();

router.use('/auth', AuthRouter);
router.use('/templates', TemplateRouter);
router.use('/icons', IconsRouter);
router.use('/cart', CartRouter);
router.use('/share', ShareRouter);
router.use('/email', SendEmail);
router.use('/projects', ProjectsRouter);
router.use('/ups', UPSRouter);

export default router;
