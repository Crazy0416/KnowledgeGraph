module.exports = class MongoError extends Error{
    constructor(message, status, code, time) {
        super(message);
        this.status = status || 500;
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
        this.code = code;
        this.time = time;
    }
};