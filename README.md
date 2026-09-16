# 내 영어 단어장 PWA v3 — 여러 품사 지원

개인용 영어 단어장 PWA입니다. 로그인, API Key, 백엔드 서버, 외부 사전 서비스가 필요하지 않습니다.

## v3 핵심 변경점
- IPA(발음기호) 입력란 완전 제거
- 한 영어 단어에 품사를 여러 개 추가 가능
- 각 품사마다 다음 항목을 독립적으로 입력
  - 품사
  - 한국어 뜻
  - 영어 예문
  - 예문 해석
- 각 예문마다 🔊 읽기 버튼 제공
- 단어 자체도 🔊 읽기 가능
- 기존 v2 단어 데이터는 앱 시작 시 자동으로 `품사 1개` 구조로 마이그레이션
- v1/v2 백업 JSON도 복원 시 새 구조로 변환 가능

## 예시
`present` 하나를 저장하고 그 안에 다음처럼 여러 품사를 둘 수 있습니다.

- 명사 → 선물 → This is a present for you. → 이것은 너를 위한 선물이야.
- 형용사 → 참석한 → All members are present. → 모든 구성원이 참석해 있다.
- 동사 → 발표하다 → She presented her idea. → 그녀는 자신의 생각을 발표했다.

## 기존 기능
- 📚 내 단어장 / ➕ 새 단어 화면 전환
- Web Speech API로 영어 단어/예문 읽기(en-US 우선)
- IndexedDB에 기기 내부 저장
- 단어·품사·뜻·예문·해석 검색
- 최근 저장순 / 오래된 순 / 알파벳순 정렬
- 수정 / 개별 삭제 / 전체 삭제
- JSON 백업 / 복원
- PWA 설치 / 오프라인 사용

## GitHub Pages 업데이트
기존 `my-vocabulary` 저장소와 GitHub Pages 주소를 그대로 사용하면 됩니다.

1. 현재 단어가 중요하면 먼저 앱의 `관리 → 단어장 백업`을 실행합니다.
2. 이 ZIP을 PC에서 압축 해제합니다.
3. GitHub의 기존 `my-vocabulary` 저장소에서 `Add file → Upload files`를 엽니다.
4. 압축을 푼 폴더 안 파일들을 저장소 루트에 업로드합니다.
5. 같은 이름 파일은 새 파일로 교체됩니다.
6. `Commit changes`를 누릅니다.
7. GitHub Pages 재배포 후 기존 주소를 새로고침합니다.
8. 설치된 PWA는 완전히 닫았다가 다시 열면 새 Service Worker가 적용됩니다.

`dictionary.js`는 v2부터 이미 사용하지 않으며 v3에도 없습니다. 저장소에 예전 `dictionary.js`가 남아 있어도 실행되지 않지만 삭제해도 됩니다.

## 기존 단어 데이터
같은 GitHub Pages 주소를 유지하면 브라우저 IndexedDB는 그대로 유지됩니다.
앱이 처음 열릴 때 기존 단일 품사 데이터를 새 `senses` 배열 구조로 자동 변환합니다.

예전 데이터:
- partOfSpeech
- koreanMeaning
- example
- exampleTranslation

새 데이터:
- senses[0].partOfSpeech
- senses[0].meaning
- senses[0].example
- senses[0].translation

## 백업 권장
브라우저 데이터 삭제나 휴대폰 교체에 대비해 정기적으로 JSON 백업을 해 두는 것을 권장합니다.
