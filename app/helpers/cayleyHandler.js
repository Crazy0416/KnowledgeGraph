const config = require('../../config/config');
const client = require('node-cayley')(config.cayley.HOST + ":" + config.cayley.PORT, {
	promisify: true
});

module.exports = graph = client.g;