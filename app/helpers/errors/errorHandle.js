'use strict';
const mongoError = require('./MongoError');

module.exports = function (err, req, res, next) {
    // TODO: 에러 내용 로그에 출력

    if(err instanceof mongoError) {
        // TODO: 데이터베이스 에러
    } else {
        // set locals, only providing error in development
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};

        // render the error page
        res.status(err.status || 500);
        res.render('error');
    }
};