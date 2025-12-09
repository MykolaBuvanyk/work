import express from 'express';
import AuthController from '../Controller/AuthController.js';
const AuthRouter = express();

AuthRouter.post('/register', AuthController.Register);
AuthRouter.post('/login', AuthController.Login);

export default AuthRouter;
