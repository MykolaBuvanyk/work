import express from 'express';
import AuthController from '../Controller/AuthController.js';
import IsAdminMiddware from '../middleware/IsAdminMiddware.js';
import { requireAuth } from '../middleware/authMiddleware.js';
const AuthRouter = express();

AuthRouter.post('/register', AuthController.Register);
AuthRouter.post('/login', AuthController.Login);
AuthRouter.post('/save', IsAdminMiddware, AuthController.SaveDATE);
AuthRouter.get('/getDate', AuthController.GetDATE);
AuthRouter.get('/getMy',requireAuth,AuthController.GetMy)
AuthRouter.put('/updateProfile',requireAuth, AuthController.UpdateProfile)
AuthRouter.post('/update-password',requireAuth, AuthController.UpdatePassword)
AuthRouter.post('/sendNewPassword',AuthController.NewPass);

export default AuthRouter;
