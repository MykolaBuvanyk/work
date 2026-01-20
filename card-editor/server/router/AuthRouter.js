import express from 'express';
import AuthController from '../Controller/AuthController.js';
import IsAdminMiddware from '../middleware/IsAdminMiddware.js';
const AuthRouter = express();

AuthRouter.post('/register', AuthController.Register);
AuthRouter.post('/login', AuthController.Login);
AuthRouter.post('/save', IsAdminMiddware, AuthController.SaveDATE);
AuthRouter.get('/getDate', AuthController.GetDATE);

export default AuthRouter;
