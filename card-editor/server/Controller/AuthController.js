import ErrorApi from "../error/ErrorApi";

class AuthController{
    static Register=async(req,res,next)=>{
        try {

        } catch(err) {
            return next(ErrorApi.internalServerError(err));
        }
    }
}

export default AuthController;