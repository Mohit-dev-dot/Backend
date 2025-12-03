class ApiErrors extends Error
{
    constructor(statusCode,message,errors=[],stack=" ")
    {
        super(message)
        this.statusCode=statusCode
        this.message=message
        this.errors=errors
        this.stack=stack
        this.success=false
   

    if(stack)
    {
        this.stack=stack
    }
    else
    {
        Error.captureStackTrace(this, this.constructor)
    }
}
}

export  {ApiErrors}