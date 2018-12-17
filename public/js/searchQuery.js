function searchQuery(elem) {
	let textQuery = $('#searchbox')[0].value;
	console.log(textQuery);
	if(textQuery === null || textQuery === '') { return; }

	$.get('/search', {q: textQuery}, 'json')
		.done((jsonObj) => {
			console.log("done: ", jsonObj);
			let result = jsonObj;

			if(!(result.result) || (result.result instanceof Array && result.result.length === 0)) {
				graph.nodes = [{
					id: 'n',
					x: 0,
					y: 0,
					label: "데이터를 찾지 못했습니다.",
					size:10
				}];
				graph.edges = [];
				s.graph.clear();
				s.graph.read(graph);
				s.refresh();
				return;
			}

			graph.nodes = [];
			graph.edges = [];

			for(var i = 0; i < result.result.length; i++) {
				let resultObj = result.result[i];
				let node1 = {
					id: 's'+i,
					x: Math.random(),
					y: Math.random(),
					size: 3,
					color: '#008cc2'
				};
				let node2 = {
					id: 'o'+i,
					x: Math.random(),
					y: Math.random(),
					size: 1.5,
					color: '#008cc2'
				};
				let edge = {
					id: 'p'+i,
					size: 0.05,
					color: '#666666'
				};

				let existId = false;
				let existVer = false;
				let existRes = false;

				for(let vi = 0; vi < graph.nodes.length; vi++) {
					let node = graph.nodes[vi];
					if(node.label === resultObj.id) {
						node.size += 0.1; existId = true;
					} else if(node.label === resultObj.vertex) {
						node.size += 0.1;
						edge.source = node.id;
						existVer = true;
					} else if (node.label === resultObj.result) {
						node.size += 0.1;
						edge.target = node.id;
						existRes = true;
					}
				}

				if(resultObj.id && !existId) {
					node1.label = resultObj.id;
					graph.nodes.push(node1);
				} else {
					node1.label = resultObj.vertex;
					edge.label = resultObj.predicate;
					node2.label = resultObj.result;

					if(existVer) {
						edge.target = 'o'+i;
						graph.nodes.push(node2);
						graph.edges.push(edge);
					} else if (existRes) {
						edge.source = 's'+i;
						graph.nodes.push(node1);
						graph.edges.push(edge);
					} else {
						edge.source = 's'+i;
						edge.target = 'o'+i;
						graph.nodes.push(node1);
						graph.nodes.push(node2);
						graph.edges.push(edge);
					}
				}

			}
			s.graph.clear();
			// Load the graph in sigma
			s.graph.read(graph);
			// Ask sigma to draw it
			s.refresh();
		}).fail((failData) => {
			console.log("fail: ", failData);
		})
	return false;
}
$(function() {
	$("form input").keypress(function (e) {
		if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13)) {
			$('button[type=button]')[0].click();
			return false;
		} else {
			return true;
		}
	});
});
