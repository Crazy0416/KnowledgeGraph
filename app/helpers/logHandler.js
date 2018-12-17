'use strict';

const { createLogger, format, transports } = require('winston');
const chalk = require('chalk');
const {combine, timestamp, label, printf} = format;
const config = require('../../config/config');

// 로그 출력 포맷 지정
const myFormat = printf(info => {
	let time = chalk.grey(info.timestamp);
	return `${time}--${info.level}: ${info.message}`
});

// logger를 전역 변수로 지정
global.logger = createLogger({
	transports: [
		new transports.Console({
			level: config.logLevel,
			timestamp: true,
			showLevel: true,
			colorize: true
		})
	],
	format: format.combine(
		format.colorize(),
		format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss'
		}),
		format.splat(),
		myFormat
	),
	exitOnError: false
});

module.exports = logger;