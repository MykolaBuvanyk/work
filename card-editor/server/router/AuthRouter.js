import express from "express";
import AuthController from "../Controller/AuthController";
const AuthRouter=express();

AuthRouter.post('register', AuthController.Register);

export default AuthRouter;