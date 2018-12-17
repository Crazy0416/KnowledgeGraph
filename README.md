# 지식 그래프 구축

## 의존성

- elasticsearch Version: 6.5.0
- mongodb v4.0.4
- cayley 0.7.4



## cayley 설치

설치 방법: https://github.com/cayleygraph/cayley/blob/master/docs/Quickstart-As-Application.md



## 프로젝트 설치

```bash
cd <cayley path>
vim cayley.json // 밑의 json 복사
./cayley init --db=mongo --dbpath="<HOSTNAME>:<PORT>"	// ex) "localhost:27017"
./cayley load -i <프로젝트path>/data/*.nt // cayley를 활용한 graph data
./cayley http —host:64210	// cayley http로 연결
cd <프로젝트 path>
npm install
vim ./config/config.js
config.RDF_LIST = [“data 폴더에 있는 파일 name”];	// ex) instance_types_en.nt
NODE_ENV=prod node bin/tripleIndexingToEs.js	// elasticsearch에 nt 파일들 인덱싱
NODE_ENV=dev node bin/www	// 다른 bash 창에 입력
// 웹 브라우저에 localhost:3000 입력
```



### cayley.json 파일

```javascript
{
	"store": {
		"backend": "mongo",
		"address": "localhost:27017",
		"options": {
			"database_name":"cayley"
		}
	},
	"query": {
		"timeout": "30s"
	}
} // cayley.json
```

