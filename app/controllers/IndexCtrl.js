'use strict';

const esClient = require('../helpers/elasticsearchHandler');
const g = require('../helpers/cayleyHandler');
const MAX_CANDIDATE_RANGE = 5;

exports.searchText = async(req, res, next) => {
	//let queryArr = req.query.q.toLowerCase().replace(/ /gi, '_');
	logger.debug('req body: %o', req.query);
	let queryArr = req.query.q.split(',');
	let result;

	try {
		result = await QGA(queryArr);
	} catch (e) {
		logger.error("QGA error: %o",e);
		throw e;
	}

	res.json(result);
};

async function QGA(queryArr) {
	let result = {};        // Answer 그래프 저장
	// keyword 배열을 uri 후보군 객체로 변환
	let keywordResult = await findUrifromKeyword(queryArr);
	// keyword uri 후보군을 Vertex와 edge로 구분
	let termCandidateResult = await ExtractTermToVE(keywordResult);

	if(Object.keys(termCandidateResult.V).length === 0) {       // term V가 0인 경우
		result = {result: ["데이터를 찾을 수 없습니다."]};
	} else if(Object.keys(termCandidateResult.V).length === 1) { // term V가 1인 경우
		let vKey = Object.keys(termCandidateResult.V)[0];
		let eKey = Object.keys(termCandidateResult.E)[0];

		if (Object.keys(termCandidateResult.E).length === 1) {   // term V: 1, E: 1 인 경우
			result.result = [];
			for(let i = 0; i < termCandidateResult.V[vKey].length; i++) {
				let data = await outPredicateQuery(termCandidateResult.V[vKey][i].id, termCandidateResult.E[eKey][0].id);
				if(!data.result || data.result.length === 0)
					continue;
				for(let j = 0; j < data.result.length; j++) {
					let node = data.result[j];
					result.result.push(node);
				}
			}
			//result = await outPredicateQuery(termCandidateResult.V[vKey][0].id, termCandidateResult.E[eKey][0].id);
		} else {
			result.result = [];
			for(let i = 0; i < termCandidateResult.V[vKey].length; i++) {
				let data = await vertexInfoQuery(termCandidateResult.V[vKey][i].id);
				for(let j = 0; j < data.result.length; j++) {
					let node = data.result[j];
					result.result.push(node);
				}
			}
			//result = await vertexInfoQuery(termCandidateResult.V[vKey][0].id);
		}
	}  else {   // term V가 2 이상인 경우
		if(Object.keys(termCandidateResult.E).length === 0) {   // V가 2 이상 E가 0인 경우
			let vKey = Object.keys(termCandidateResult.V);
			let vi1 = termCandidateResult.V[vKey[0]];
			let vi2 = termCandidateResult.V[vKey[1]];
			result.result = [];

			for(let vi1Idx = 0; vi1Idx < vi1.length; vi1Idx++) {
				for(let vi2Idx = 0; vi2Idx < vi2.length; vi2Idx++ ) {
					let data = await vertex2InfoQuery(vi1[vi1Idx], vi2[vi2Idx]);
					if(data.result && data.result.length > 0) {
						result = data; break;
					}
					logger.debug("result: %o", result);
				}
			}
		} else {    // V가 2 이상 E가 1 이상인 경우
			// Vertex, Edge 후보군을 Vi1 X Vi2, Ej로 구분
			let assembly2GraphCandidate = await ExtractTVtoT2V(termCandidateResult);
			// e(<vi1, vi2>, pj)의 모든 집합
			let assembly2GraphEB = await Vi1XVi2toEB(assembly2GraphCandidate);

			let predictKeywords = Object.keys(assembly2GraphEB);

			for(let predictCnt = 0; predictCnt < predictKeywords.length; predictCnt++) {
				let edgeCandidate = assembly2GraphEB[predictKeywords[predictCnt]];
				for(let eIdx = 0; eIdx < edgeCandidate.length; eIdx++) {
					logger.debug("edgeCandidate to search: %o",edgeCandidate[eIdx]);
					let data = await Vi1Vi2Search(edgeCandidate[eIdx]);
					if(data[0] && data[0].result.length > 0) {
						result = data[0]; break;
					}
				}
			}
		}
	}
	logger.debug("qga all result: %o", result);
	return result;

	// TODO: 키워드 엔티티와 클래스를 분리하여 AQ(쿼리 집합)을 하나가 아닌 여러개로 만들 것
	async function findUrifromKeyword(queryArr) {
		let resultObj = {};
		for(let i = 0; i < queryArr.length; i++) {
			let q = {
				index: "class",
				q:  "\"" + queryArr[i] + "\"",
				analyzer: 'standard'
			};
			let csData, prData;
			try {
				csData = await esClient.search(q);
				q.index = "predicate";
				prData = await esClient.search(q);

			} catch (e) {
				logger.error("searchText Ctrl ERROR: %o", e); throw e;
			}

			let Predicate = []; let Class = [];

			if(prData.hits.hits.length > 0) {
				let prCandidate = prData.hits.hits;
				for(let prIdx = 0; prIdx < prCandidate.length; prIdx++) {
					let doc = prCandidate[prIdx];
					let type = await defineTermAnnot(doc._source.id);
					if (type === null)
						continue;
					doc._source.type = type;
					Predicate.push({id: doc._source.id, type: type})
				}
				// class를 아예 후보에 넣지 않음
				csData.hits.hits = [];
			} else if(csData.hits.hits.length > 0) {
				let csCandidate = csData.hits.hits;
				let checkClass = false;
				let cl = []; let en = [];
				for(let csIdx = 0; csIdx < csCandidate.length; csIdx++) {
					let doc = csCandidate[csIdx];
					let type = await defineTermAnnot(doc._source.id);
					if(type === null)   // type 없으면 doc에 추가하지 않음
						continue;
					doc._source.type = type;
					if(type === "entity" && !checkClass) {
						en.push({id: doc._source.id, type: type})
					}
					if(type === "class") {
						checkClass = true;
						cl.push({id: doc._source.id, type: type})
					}
				}
				if(checkClass)
					Class = cl;
				else
					Class = en;
			}
			resultObj[queryArr[i]] = {};
			resultObj[queryArr[i]]["class_"] = Class;
			resultObj[queryArr[i]]["predicate_"] = Predicate;
		}

		logger.debug("keyword search result: %o", resultObj);
		return resultObj;
	}

	// Query Graph Assembly를 위해 용어를 Vertex와 Edge로 구분
	async function ExtractTermToVE(esResult) {
		let keywords = Object.keys(esResult);
		let AnnotTermSet = {};
		AnnotTermSet.V = {};
		AnnotTermSet.E = {};

		for (let kIdx = 0; kIdx < keywords.length; kIdx++) {
			if (esResult[keywords[kIdx]]['predicate_'].length !== 0) {
				let Ej = [];
				for (let eIdx = 0; eIdx < esResult[keywords[kIdx]]['predicate_'].length && eIdx < MAX_CANDIDATE_RANGE; eIdx++) {
					let candidateObj = esResult[keywords[kIdx]]['predicate_'][eIdx];
					candidateObj.keyword = keywords[kIdx];
					Ej.push(candidateObj);
				}
				AnnotTermSet.E[keywords[kIdx]] = Ej;
			} else if (esResult[keywords[kIdx]]['class_'].length !== 0) {
				let Vi = [];
				for (let vIdx = 0; vIdx < esResult[keywords[kIdx]]['class_'].length  && vIdx < MAX_CANDIDATE_RANGE; vIdx++) {
					let candidateObj = esResult[keywords[kIdx]]['class_'][vIdx];
					candidateObj.keyword = keywords[kIdx];
					Vi.push(candidateObj);
				}
				AnnotTermSet.V[keywords[kIdx]] = Vi;
			}
		}

		logger.debug("ExtractTermToVE result: %o", AnnotTermSet);
		return AnnotTermSet;
	}

	async function ExtractTVtoT2V(termCandidateResult) {
		return new Promise(async (resolve, reject) => {
			let Vi1Vi2E = {Vi1Vi2: null, E: termCandidateResult.E};
			let Vi1Vi2 = {};
			let V = termCandidateResult.V;
			let keywords = Object.keys(V);

			for(let V1Idx = 0; V1Idx < keywords.length - 1; V1Idx++) {
				let Vi1 = V[keywords[V1Idx]];

				for(let V2Idx = V1Idx + 1; V2Idx < keywords.length; V2Idx++) {
					let Combination = [];
					let Vi2 = V[keywords[V2Idx]];

					for(let v1Idx = 0; v1Idx < V[keywords[V1Idx]].length; v1Idx++) {
						for(let v2Idx = 0; v2Idx < V[keywords[V2Idx]].length; v2Idx++){
							let vi1vi2 = [Vi1[v1Idx], Vi2[v2Idx]];
							Combination.push(vi1vi2);
						}
					}
					Vi1Vi2[keywords[V1Idx] + "&&" + keywords[V2Idx]] = Combination;
				}
			}
			Vi1Vi2E.Vi1Vi2= Vi1Vi2;
			logger.debug("ExtractTVtoT2V: %o", Vi1Vi2E);
			resolve(Vi1Vi2E);
		})
	}

	// cayley에서 uri의 type을 찾는다.
	function defineTermAnnot(keyUri) {
		return new Promise(async (resolve, reject) => {
			g.V(keyUri).Out('<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>').All().then((res) => {
				//logger.debug("keyUri: %s gizmo result: %o", keyUri, res);
				if(res instanceof Object && res.result !== null) {
					if(res.result.length !== 0) {
						for(let rIdx = 0; rIdx < res.result.length; rIdx++) {
							let uriType = res.result[0].id;
							if(uriType === "<http://www.w3.org/2002/07/owl#ObjectProperty>" || uriType === "<http://www.w3.org/1999/02/22-rdf-syntax-ns#Property>") {
								resolve("predicate"); return;
							} else if(uriType === "<http://www.w3.org/2002/07/owl#Class>" || uriType === "<http://www.w3.org/2000/01/rdf-schema#Class>") {
								resolve("class"); return;
							}
						}
						resolve("entity");
					} else
						resolve(null);
				} else
					resolve(null)
			}).catch((err) => {
				reject(err);
			})
		})
	}

	function Vi1XVi2toEB(assembly2GraphCandidate) {
		return new Promise(async(resolve, reject) => {
			let result = {};
			let Vi1Vi2Keywords = Object.keys(assembly2GraphCandidate.Vi1Vi2);
			let EKeywords = Object.keys(assembly2GraphCandidate.E);

			for(let Vi1Vi2Idx = 0; Vi1Vi2Idx < Vi1Vi2Keywords.length; Vi1Vi2Idx++) {
				for(let EIdx = 0; EIdx < EKeywords.length; EIdx++) {
					let Vi1Vi2 = assembly2GraphCandidate.Vi1Vi2[Vi1Vi2Keywords[Vi1Vi2Idx]];
					let E = assembly2GraphCandidate.E[EKeywords[EIdx]];
					result[EKeywords[EIdx]] = [];
					for(let vi1vi2Idx = 0; vi1vi2Idx < Vi1Vi2.length; vi1vi2Idx++ ) {
						for(let eIdx = 0; eIdx < E.length; eIdx++) {
							let edge = {};
							edge.vi1vi2 = Vi1Vi2[vi1vi2Idx];
							edge.pj = E[eIdx];
							result[EKeywords[EIdx]].push(edge);
						}
					}
				}
			}

			logger.debug("Vi1XVi2toEB: %o", result);
			resolve(result);
		});
	}

	async function Vi1Vi2Search(edge) {
		return new Promise(async(resolve, reject) => {
			let vi1 = edge.vi1vi2[0];
			let vi2 = edge.vi1vi2[1];
			let pred = edge.pj;
			let result = [];

			logger.debug("Vi1Vi2Search=> vi1: %o vi2: %o", vi1, vi2);

			// TODO: Morphism과 Follow로 교체 작업하기
			if(vi1.type === "class") {
				let x = await queryHas("<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>", vi1.id);
				if(vi2.type === "class") {
					let y = await queryHas("<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>", vi2.id);

					logger.debug("Vi1Vi2Search=> if vi1 class vi2 class x: %o y: %o", x, y);

					for(let xIdx = 0; xIdx < x.result.length; xIdx++) {
						for(let yIdx = 0; yIdx < y.result.length; yIdx++) {
							let data1 = await querySpecialVHas(x.result[xIdx].id, pred.id, y.result[yIdx].id);
							let data2 = await querySpecialVHas(y.result[yIdx].id, pred.id, x.result[xIdx].id);
							if(data1.result !== null && data1.result.length > 0)
								result.push(data1);
							else if(data2.result !== null && data2.result.length > 0)
								result.push(data2);
						}
					}
				} else {
					let data = await class1Entity1Pred1Query(vi1.id, pred.id, vi2.id);
					if(data.result && data.result.length > 0)
						result.push(data);
				}
 			} else {
				if(vi2.type === "class") {
					let x = await queryHas("<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>", vi2.id);
					for(let xIdx = 0; xIdx < x.length; xIdx++) {
						let data = await querySpecialVHas(x.result[xIdx].id, pred.id, vi1.id)
						if(data.result && data.result.length > 0)
							result.push(data);
					}
				}
			}
			logger.debug("Vi1Vi2Search: %o", result);
			resolve(result);
		});
	}

	async function qgaAlgorithmQuery(EB) {
		return new Promise(async (resolve, reject) => {
			let EkeyArr = Object.keys(EB);
			let EArr = [];
			let result = [];        // 리턴할 answer graph 집합
			for(let eIdx = 0; eIdx < EkeyArr.length; eIdx++)
				EArr.push(EB[EkeyArr[eIdx]]);
			let searchState = {M: [], Z: EArr};
			await qgaSearch(searchState, 0);
			resolve(null);
			// async function qgaQuery(qgaGraph) {
			//
			// }
			//async function popConflictEdge()
			async function qgaSearch(searchState, level) {
				if(level === EArr.length) {
					let visit = [];
					let qgaGraph = searchState.M;
					let graph = g.V();

					for(let v = 0; v < qgaGraph.length; v++)
						visit.push(0);
					visit[0] = 1;

					logger.debug("qgaGraph: %o", qgaGraph);
					for(let i = 1; i < qgaGraph.length; i++ ) {
						let vi1 = qgaGraph.vi1vi2[0];
						let vi2 = qgaGraph.vi1vi2[1];
						let pj = qgaGraph.pj;


					}
					return;
				}
				for(let eIdx = level; eIdx < EArr.length; eIdx++) {
					// Ej마다 한 개의 e(<vi1, vi2>, pj)를 골라야함.
					let cadidatebyEdgeArr = searchState.Z[eIdx];
					for(let candidateIdx = 0; candidateIdx < cadidatebyEdgeArr.length; candidateIdx++) {
						let candiE = cadidatebyEdgeArr[candidateIdx];
						let checkContinue = false;
						searchState.M.push(candiE);
						searchState.Z[eIdx].splice(candidateIdx,1);
						await qgaSearch(searchState, level + 1);
						searchState.M.pop();
						searchState.Z[eIdx].push(candiE);


						// for(let mIdx = 0; mIdx < searchState.M.length; mIdx++) {
							// if(checkConflict(candiE, searchState.M[mIdx])) {
							// 	checkContinue = true;
							// 	break;
							// }
						// }

						// if(checkContinue)
						// 	continue;
						// else {
						// 	searchState.M.push(candiE);
						// 	searchState.Z[eIdx].splice(candidateIdx,1);
						// 	await qgaSearch(searchState, level + 1);
						// 	searchState.M.pop();
						// 	searchState.Z[eIdx].push(candiE);
						// }
					}
				}
			}

			function checkConflict(e1, e2) {
				if((e1.vi1vi2[0].keyword === e2.vi1vi2[0].keyword) && (e1.vi1vi2[0].id !== e2.vi1vi2[0].id))
					return true;
				else if((e1.vi1vi2[1].keyword === e2.vi1vi2[1].keyword) && (e1.vi1vi2[1].id !== e2.vi1vi2[1].id))
					return true;
				else if((e1.pj.keyword === e2.pj.keyword) && (e1.pj.id !== e2.pj.id))
					return true;
				else if ((e1.vi1vi2[0].id !== e2.vi1vi2[0].id) && (e1.vi1vi2[1].id !== e2.vi1vi2[1].id) || (e1.pj.id !== e2.pj.id))
					return true;
				else
					return false;
			}
		})
	}

	async function vertex2InfoQuery(vi1, vi2) {
		return new Promise((resolve, reject) => {
			let v1Id = vi1.id, v2Id = vi2.id;
			let entiId;
			let classPath1 = g.M().Has("<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>", v1Id).Limit(10000)
			let classPath2 = g.M().Has("<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>", v2Id).Limit(10000)
			let path1, path2;

			if(vi1.type === "entity" && vi2.type === "entity")
				resolve({result: ["엔티티 한 개만 입력해주세요"]});
			else if(vi1.type === "entity") {
				entiId = vi1.id;
				path1 = g.M().Is(entiId); path2 = classPath2;
			} else if (vi2.type === "entity"){
				entiId = vi2.id;
				path1 = g.M().Is(entiId).Tag("vertex"); path2 = classPath1;
			} else {
				path1 = classPath1; path2 = classPath2;
			}
			logger.debug("v1Id: %s, v2Id: %s, entiId: %s", v1Id, v2Id, entiId);
			g.V().Follow(path1).Follow(path2).ForEach(function (v) {
				g.Emit({
					"id": v.id
				})
			}).then(res => {
				if(res.error)
					reject(res);
				else
					resolve(res);
			});

		});
	}

	async function vertexInfoQuery(vertexId) {
		return new Promise((resolve, reject) => {
			g.V(vertexId).Tag("vertex").OutPredicates().ForEach(function(d) {
				g.V(d.vertex).Tag("vertex").Out(d.id, "predicate").ForEach(function(info) {
					g.Emit({
						"vertex": info.vertex,
						"predicate": info.predicate,
						"result": info.id
					})
				})
			}).then(res => {
				if(res.error)
					reject(res);
				else
					resolve(res);
			}).catch(err => {
				reject(err);
			})
		})
	}

	async function class1Entity1Pred1Query(classId, predId, entiId) {
		return new Promise((resolve, reject) => {
			g.V().Has("<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>", classId).Limit(10000)
				.Has(predId, entiId).All()
				.then((res) => {
					resolve(res);
				}).catch((err) => {
					reject(err);
				})
		});
	}

	async function outPredicateQuery(vId, predId) {
		return new Promise((resolve, reject) => {
			g.V(vId).Tag("vertex").Out(predId, "predicate").ForEach(function(d) {
				g.Emit({
					"vertex": d.vertex,
					"predicate": d.predicate,
					"result": d.id
				})
			}).then(function(result) {
				if(result.error)
					reject(result);
				else
					resolve(result);
			}).catch(function(err) {
				reject(err);
			})
		})
	}

	async function querySpecialVHas(vId, predId, cId) {
		return new Promise((resolve, reject) => {
			g.V(vId).Tag("vertex").Has(predId, cId).Tag("result").All()
				.then(function(result) {
					resolve(result);
				})
				.catch(function(err) {
					reject(err);
				})
		})
	}

	async function queryHas(predId, cId) {
		return new Promise((resolve, reject) => {
			g.V().Tag("vertex").Has(predId, cId).Tag("result").All()
				.then(function(result) {
					resolve(result);
				})
				.catch(function(err) {
					reject(err);
				})
		})
	}
}