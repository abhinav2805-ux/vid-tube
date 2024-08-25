// parameter and return both are functions    and protect them from try and catch
const asyncHandler = (requestHandler)=>{
    return (req,res,next)=> {
        Promise.resolve(requestHandler(req,res,next)).catch((err)=>next(err))
    }

}

export { asyncHandler}