import express from "express";
import AuthRouter from "./AuthRouter";
const router=express();

router.use('/auth',AuthRouter);

export default router;