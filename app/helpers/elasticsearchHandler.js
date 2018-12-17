'use strict';

const elasticsearch = require('elasticsearch');
const client = new elasticsearch.Client({
	host: 'localhost:9200'//,
	//log: 'trace'
});

// ping
client.ping({
	requestTimeout: 3000
}, function (error) {
	if (error) {
		logger.error('elasticsearch cluster is down!');
	} else {
		logger.info('elasticsearch connected!!');
	}
});

module.exports = client;