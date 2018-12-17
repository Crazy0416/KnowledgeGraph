'use strict';

// required environment variables
	[
		'NODE_ENV'
	].forEach((name) => {
	if (!process.env[name]) {
		throw new Error(`Environment variable ${name} is missing`)
	}
});
const config = {};

// rdf file to indexing
config.RDF_LIST = ["instance_types_en.nt"];

if(process.env.NODE_ENV === "dev") {
	config.mongodb = {
		"DATABASE": 'myExpressGenerator',
		"PORT": '27017',
		"HOST": 'localhost'
	};
	config.cayley = {
		"PORT": '64210',
		"HOST": "127.0.0.1"
	};
	config.server = {
		PORT: 3000
	};
	config.logLevel = "debug"
} else if(process.env.NODE_ENV === "prod") {
	config.mongodb = {
		"DATABASE": 'myExpressGenerator',
		"PORT": '27017',
		"HOST": 'localhost'
	};
	config.cayley = {
		"PORT": 5900,
		"HOST": "1.201.139.81"
	};
	config.server = {
		PORT: 8080
	};
	config.logLevel = "info";
}

module.exports = config;