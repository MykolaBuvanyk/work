const IsAdminMiddleWare=async(req,res,next)=>{
    console.log(2)
    //тимчасово
    next()
}

export default IsAdminMiddleWare;