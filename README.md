# 지식 그래프 구축

## 프로젝트 영상

유튜브 영상: https://youtu.be/KLOzQx0BdoY

발표 pdf: https://github.com/Crazy0416/KnowledgeGraph/blob/master/resources/%EC%B5%9C%EC%A2%85%EB%B0%9C%ED%91%9C.pdf



## 프로젝트 목표

이 프로젝트는 지식 그래프에서 사용자가 키워드를 입력했을 때 이를 활용하여 데이터를 추출하고 사용자가 원하는 정보로 볼 수 있도록 view로 변환하는 서비스 아키텍쳐를 구현하는 것을 목표로 한다. 

지식 그래프의 데이터는 이미 있다는 가정 하에 진행되므로 이 프로젝트에선 dbpedia에서 제공하는 인물 정보를 저장한 nt 파일과 스키마를 저장한 nt 파일을 이용한다. 



## 설명

쉽게 말하면 단순히 검색 엔진을 만들어보는 것이고 디테일하게 설명하자면 단순 인덱스 방식의 검색 엔진이 아닌 키워드 집합의 검색 의도를 파악하여 RDF 그래프 데이터에서 의미있는 데이터를 추출하는 검색 엔진을 개발해보았습니다.

RDF 데이터는 dbpedia의 무료 nt 파일을 이용하였습니다.

링크: https://wiki.dbpedia.org/data-set-39



## 사용된 논문 및 알고리즘

**Keyword Search on RDF Graphs - A Query Graph Assembly Approach**

![알고리즘 설명1](https://raw.githubusercontent.com/Crazy0416/KnowledgeGraph/master/resources/algorithm1.png)

![알고리즘 설명2](https://raw.githubusercontent.com/Crazy0416/KnowledgeGraph/master/resources/algorithm2.png)



## 기능설명

![메인 화면](https://raw.githubusercontent.com/Crazy0416/KnowledgeGraph/master/resources/mainPage.png)

메인화면의 검색 바에서 키워드를 입력하면 됩니다.



### 키워드 1개 입력했을 때

![키워드 1개](https://raw.githubusercontent.com/Crazy0416/KnowledgeGraph/master/resources/1keyword.png)

그 키워드에 관한 관련된 데이터들을 전부 표시합니다. 

- Aristotle의 이름
- Aristotle의 type
- Aristotle의 생일
- Aristotle의 태어난 장소 등등..



## 키워드 2개 입력했을 때

![키워드 2개](https://raw.githubusercontent.com/Crazy0416/KnowledgeGraph/master/resources/2keywords.png)

키워드들이 연관되어 있는 결과값을 도출



## 키워드 3개 입력했을 때

![키워드 3개](https://raw.githubusercontent.com/Crazy0416/KnowledgeGraph/master/resources/3keyword.png)

위의 설명한 알고리즘대로 연관된 데이터를 추출

위의 사진은 kentucky에서 태어난(birth place) person을 도출해낸 모습.



## 아키텍쳐

### 그래프 저장 과정 아키텍쳐

![그래프 저장 과정](https://raw.githubusercontent.com/Crazy0416/KnowledgeGraph/master/resources/architecture1.png)

- RDF 파일의 데이터를 키워드로 검색하기 위해 키워드를 인덱싱하여 elasticsearch에 먼저 저장.
- 같은 RDF 데이터를 cayley 그래프에 저장.  (cayley는 mongodb를 이용하여 RDF를 그래프 화)



### 검색 과정 아키텍쳐

![검색 과정](https://raw.githubusercontent.com/Crazy0416/KnowledgeGraph/master/resources/architecture2.png)

- 키워드가 입력되면 WAS로 키워드 집합 전달
- elasticsearch에서 각 키워드에 대한 URI 후보군 전달.
- URI 후보군들을 알고리즘에 의해 데이터를 추출할 수 있는 쿼리문 생성
- 쿼리문을 Cayley 그래프에 전달 및 Cayley에서 후보 그래프를 응답받음.
- 후보 그래프를 Client에 전달.



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
mkdir data		// nt 파일 data 디렉토리에 옮기기.
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

