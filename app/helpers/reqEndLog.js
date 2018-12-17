require('./logHandler');

module.exports = function (req, res, next) {
	res.on('finish', function() {
		logger.info(`${req.method} ${res.statusCode} ${req.originalUrl} -- ${res.statusMessage}; ${res.get('Content-Length') || 0}b sent`);
	});
	next();
};