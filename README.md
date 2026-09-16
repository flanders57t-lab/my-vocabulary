# 내 영어 단어장 PWA

로그인, API Key, 백엔드 서버 없이 사용하는 개인 영어 단어장입니다.

## 주요 기능
- 📚 내 단어장 / ➕ 새 단어 화면 전환
- 무료 공개 사전(Free Dictionary API)로 영어 뜻·품사·일부 예문·발음기호 검색
- 여러 품사·여러 뜻 선택
- 한국어 뜻·예문 해석 직접 입력 및 수정
- Web Speech API로 미국식 영어 음성(en-US 우선) 읽기
- IndexedDB에 스마트폰 내부 저장
- 검색, 정렬, 수정, 삭제
- JSON 백업 / 복원
- PWA 설치 및 오프라인 단어장 사용

## 무료 사전
- 서비스: Free Dictionary API
- 공식 사이트: https://dictionaryapi.dev/
- 기본 엔드포인트: https://api.dictionaryapi.dev/api/v2/entries/en/<word>
- API Key가 필요 없습니다.
- 이 앱은 한국어 번역 API를 사용하지 않습니다. 한국어 뜻과 예문 해석은 직접 입력합니다.
- 브라우저나 네트워크 환경에서 외부 API 요청이 차단되면 자동 검색은 실패할 수 있습니다. 이 경우 앱은 직접 입력 화면을 열어 저장할 수 있게 합니다.

## PC에서 테스트
PWA와 ES 모듈은 `file://`로 직접 열지 말고 로컬 웹서버로 실행하세요.

Python이 있다면 이 폴더에서:

```bash
python -m http.server 8080
```

그 뒤 브라우저에서 `http://localhost:8080`을 여세요.

## Android 스마트폰에서 PWA로 설치
스마트폰에서 PWA로 설치하려면 이 폴더를 **HTTPS로 서비스**해야 합니다. 가장 쉬운 무료 방법 중 하나는 GitHub Pages입니다.

### 방법 A: GitHub Pages
1. GitHub 계정을 만들거나 로그인합니다.
2. 새 저장소(repository)를 만듭니다. 예: `my-vocabulary`.
3. 이 ZIP을 풀고 폴더 안 파일 전체를 저장소 루트에 업로드합니다.
4. GitHub 저장소의 `Settings` → `Pages`로 이동합니다.
5. `Build and deployment`에서 `Deploy from a branch`를 선택합니다.
6. Branch를 `main`, 폴더를 `/(root)`로 선택하고 저장합니다.
7. 잠시 후 표시되는 `https://...github.io/.../` 주소를 Galaxy 스마트폰의 Chrome으로 엽니다.
8. Chrome 메뉴(⋮)에서 `홈 화면에 추가` 또는 `앱 설치`를 선택합니다.
9. 설치 후 홈 화면 아이콘으로 실행하면 standalone 앱처럼 사용할 수 있습니다.

GitHub UI 문구는 시점에 따라 조금 달라질 수 있습니다. 핵심은 이 정적 파일들을 HTTPS 주소로 서비스하는 것입니다.

### 방법 B: 다른 무료 정적 호스팅
Cloudflare Pages, Netlify 등 HTTPS를 제공하는 정적 호스팅에 같은 파일을 올려도 됩니다. 서버 코드는 필요 없습니다.

## 데이터 저장 위치
단어는 브라우저의 IndexedDB에 저장됩니다. 로그인이나 클라우드 동기화는 없습니다.

따라서 다음 경우 데이터가 사라질 수 있습니다.
- Chrome 사이트 데이터 삭제
- 앱/브라우저 초기화
- 휴대폰 교체

정기적으로 `📤 단어장 백업`을 눌러 JSON 파일을 보관하세요.

## 백업/복원
- 백업: `관리` → `📤 단어장 백업`
- 복원: `관리` → `📥 단어장 복원` → JSON 선택
- 복원은 기존 단어를 유지하고 새 단어만 병합합니다.

## 사전 서비스를 교체하려면
`dictionary.js`의 `API_BASE`와 `getWordData()`를 수정하면 됩니다. 나머지 UI/저장 로직과 분리되어 있습니다.

## 자동 제공하지 않는 부분
- 한국어 뜻 자동 번역
- 한국어 예문 자동 번역

무료·무제한·API Key 없는 안정적인 번역 서비스를 강제로 연결하지 않았습니다. 잘못된 번역을 자동 저장하는 대신 직접 입력·수정하게 설계했습니다.
