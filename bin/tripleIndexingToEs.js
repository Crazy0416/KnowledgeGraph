'use strict';

const config = require('../config/config');
const esClient = require('../app/helpers/elasticsearchHandler');
const path = require('path');
const lineByLine = require('n-readlines', {
	readChunk: 1048576
});
require('../app/helpers/logHandler');

function extractResource(iri) {
	let resourceArr = [];
	let splitArr = iri.slice(1,iri.length - 1).split('/');
	let resource_ = splitArr[splitArr.length - 1];
	if(resource_.indexOf("#") !== -1)
		resource_ = resource_.split('#')[1];
	resource_.replace(/_/gi, ' ');
	resource_.replace(/-/gi, ' ');
	resource_ = "\"" + resource_ + "\"";

	resourceArr.push(resource_);

	let dump = resource_.split(/(?=[A-Z])/);
	dump = dump.join(' ');
	dump = "\"" + dump + "\"";
	resourceArr.push(dump);

	return resourceArr.join('');
}

async function checkIndex(type, query) {
	return await esClient.search({
		index: type,
		q: "id:" + query + ""
	});
}

async function createIndex(type_, dataObj) {
	let type = type_;
	await esClient.index({
		index: type,
		type: type,
		body: dataObj
	});
	return await esClient.indices.refresh({
		index: type_
	})
}

async function subjectIndexing(subject) {
	let resource = extractResource(subject);
	let qWord = "\"" +subject + "\"";
	let res;
	try {
		res = await checkIndex("class", qWord);
		logger.debug("subject Indexing search result: %o %o", qWord, res.hits);
		if(res.hits.total === 0) {
			await createIndex("class", {
				id: subject,
				resource: resource
			});
			logger.debug("subject created: %s", subject);
		}
	} catch (err) {
		logger.error("subject checkIndex Error: %o", err);
		throw err;
	}
}

async function predicateIndexing(subject, predicate, object) {
	let labelUri = "<http://www.w3.org/2000/01/rdf-schema#label>";
	let nameUri = "<http://xmlns.com/foaf/0.1/name>";
	let resource;
	let query;
	let updateField;        // predicate이 label, name일때 subject 업데이트 시 field 타입 결정
	let res;        // search 결과

	if (predicate.indexOf(labelUri) >= 0) {
		updateField = 'label';
		query = subject;
		resource = '"label""readable""라벨"'
	} else if (predicate.indexOf(nameUri) >= 0) {
		updateField = 'name';
		query = subject;
		resource = '"name""이름""Name""title""forename""pretext"'
	} else {
		resource = extractResource(predicate);
		query = predicate;
	}
	let qWord = "\"" + query + "\"";

	try {
		// predicate이 label, name인 경우 검색을 subject로 해야함
		if(query === subject)
			res = await checkIndex("class", qWord);
		else
			res = await checkIndex("predicate", qWord);
		logger.debug("predicate Indexing search result: %o %o %o", qWord, predicate, res.hits);

		// label,name이 아닌 predicate이 없는 경우
		if(res.hits.total === 0 ) {
			await createIndex("predicate", {
				id: query,
				resource: resource
			});
			logger.debug("predicate create %s %s", subject, predicate);
		} else {    // label,name이 아닌 predicate이 있는 경우 혹은 predicate이 label, name인 경우
			// predicate이 label, name인 경우
			if(query === subject) {
				for(let h_Idx = 0; h_Idx < res.hits.hits.length; h_Idx++) {
					await esClient.update({
						index: 'class',
						type: 'class',
						id: res.hits.hits[h_Idx]._id,
						body: {
							script: {
								inline : 'ctx._source.' + updateField + ' += params.tag',
								params: { tag: "\"" + object.replace(/"/gi,'').split('@')[0].split('^^')[0] + "\"" }
							}
						}
					});
					logger.debug("predicate update %s %s", subject, predicate);
				}
			}
		}
	} catch (err) {
		throw err;
	}
}

async function objectIndexing(object) {
	if(object.indexOf("<") !== 0 || object.indexOf(">") !== (object.length - 1))
		return -1;

	let resource = extractResource(object);
	let qWord = "\"" +object + "\"";
	let res;
	try {
		res = await checkIndex("class", qWord);
		logger.debug("object Indexing search result: %o %o", qWord, res.hits);

		if(res.hits.total === 0) {
			await createIndex("class", {
				id: object,
				resource: resource
			})
			logger.debug("object create %s", object);
		}
	} catch (err) {
		logger.error("object checkIndex Error: %o", err);
		throw err;
	}
}

function readFilePromise(filePath) {
	return new Promise(async function(resolve, reject) {
		let cnt = 0;
		let line;
		let liner = new lineByLine(filePath);

		try{
			let res = await checkIndex("predicate", '"<http://www.w3.org/2000/01/rdf-schema#label>"');
			logger.debug("check label, name: %o", res);
			if(res.hits.total === 0) {
				await predicateIndexing("<http://www.w3.org/2000/01/rdf-schema#label>","<http://www.w3.org/2000/01/rdf-schema#label>","");
				await predicateIndexing("<http://xmlns.com/foaf/0.1/name>","<http://xmlns.com/foaf/0.1/name>","");
			}
		} catch(e) {
			logger.error(e); throw e;
		}

		while (line = liner.next()) {
			cnt++;
			line = line.toString('ascii');
			let subject, predicate, object;
			let words = [subject, predicate, object] = line.split(' ');
			if(words.length > 3) {
				object = words.slice(2, words.length - 1).join(' ');
			}

			//logger.debug("%s %s %s", subject, predicate, object);

			if(cnt % 1000 === 0)
				logger.info("line %s complete!!", cnt);

			try {
				logger.debug("%s %s %s", subject, predicate, object);
				await subjectIndexing(subject);
				//logger.debug(1);
				await predicateIndexing(subject, predicate, object);
				//logger.debug(2);
				await objectIndexing(object);
			} catch(err) {
				logger.warn("Indexing Error: %o", err);
			}

		}
		resolve();
	})
}

(async function() {
	let isIndexExist = await esClient.indices.exists({
		index: "class"
	});
	if(!isIndexExist) {
		try {
			await esClient.indices.create({
				index: "class"
			});
			await esClient.indices.create({
				index: "predicate"
			});
		} catch(e) {
			logger.error("init class, predicate index error: %o", e); throw e;
		}
	}


	for(let i = 0; i < config.RDF_LIST.length; i++) {
		let filePath = path.join(__dirname, "../data/", config.RDF_LIST[i]);

		logger.info('readfile %s started', filePath);
		await readFilePromise(filePath);
		logger.info("indexing file %s finished", filePath)
	}
}());