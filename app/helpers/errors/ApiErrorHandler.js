'use strict';

module.exports = function (err, req, res, next) {
	let errStatus;
	let errMessage;
	let time = new Date();
	logger.error(err);

	if(err.name === 'MongoError') {
		errStatus = 500;
		errMessage = err.myMessage;
	} else if (err instanceof TypeError) {
		errStatus = 400;
		errMessage = err.message;
	}

	res.status(errStatus || 500)
		.json({
			"success": false,
			"code": errStatus,
			"message": errMessage,
			"time": time
		})
};