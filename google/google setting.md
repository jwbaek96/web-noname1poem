# Google Setting Guide

## 개요
이 프로젝트에서 관리자 CRUD, 게시물 순서 변경, 공개/비공개를 여러 기기에서 일관되게 쓰려면 Google Sheet + Apps Script API 구성이 필요합니다.

현재 배포된 Apps Script Web App URL:
- https://script.google.com/macros/s/AKfycbwNgy3HbWOb3_rloYGltIgJwq35sH8tM6j2Tjqs4B_UCPMW_bjEe8PP7v7WtsN0G2pr/exec

현재 프론트 코드 구조 기준으로 권장 아키텍처는 아래와 같습니다.

- 저장소(DB): Google Sheet
- API 레이어: Google Apps Script Web App
- 프론트엔드: `index.html`에서 fetch로 API 호출

## 1) 시트 준비
Google Sheet를 1개 만들고, 첫 행 헤더를 아래 순서로 구성합니다.

제목 | 태그 | 공개여부 | 본문 | 작가코멘트 | 인스타링크 | 제작일시 | 수정시각

헤더 설명:
- 공개여부: 공개 / 비공개
- 제작일시: `YYYY-MM-DD hh:mm` 형식 (예: `2026-06-29 14:35`)
- 수정시각: 서버(Apps Script)에서 자동 기록

## 2) Apps Script 프로젝트 생성
1. 시트에서 확장 프로그램 -> Apps Script
2. 기본 코드 삭제 후 API 코드 작성
3. `doGet(e)`, `doPost(e)` 엔드포인트 구현
4. 웹 앱으로 배포(Deploy as Web App)
5. Script Properties에 관리자 비밀번호 저장

관리자 비밀번호 저장 방법(권장):
- Apps Script 편집기에서 `setAdminPassword('원하는비밀번호')` 1회 실행
- 실행 후 Script Properties에 `ADMIN_PASSWORD`가 저장됨

배포 권장값:
- Execute as: Me
- Who has access: Anyone with the link (초기 테스트)

운영 시에는 인증 토큰 검증을 반드시 추가하세요.

## 3) 권장 API 스펙
### GET / list
- 목적: 게시물 목록 조회
- 쿼리: `publishedOnly=true|false`
- 반환: 시트 행 순서 기준 배열

### POST / create
- 목적: 게시물 생성
- body: 제목, 본문, 태그, 제작일시, 작가코멘트, 인스타링크, 공개여부
- 동작: 시트 마지막 행에 추가

### POST / update
- 목적: 게시물 수정
- body: rowId(또는 고유 id), 수정 필드

### POST / delete
- 목적: 게시물 삭제
- body: rowId

### POST / reorder
- 목적: 순서 변경
- body: [{rowId, order}, ...]

### POST / publish
- 목적: 공개/비공개 전환
- body: rowId, 공개여부

## 4) Apps Script 구현 포인트
- 시트 1행은 헤더, 데이터는 2행부터
- 컬럼명을 하드코딩하지 말고 헤더 인덱스 맵으로 처리
- 응답은 JSON 통일
- 모든 write 작업 후 `수정시각` 갱신
- 에러 시 `{ ok:false, message:"..." }` 형식 반환

## 5) 보안 권장
- 관리자 토큰(예: `X-Admin-Token`) 검증
- 토큰은 Script Properties에 저장
- CORS 허용 도메인 제한(가능하면)
- 로그에서 민감값 마스킹

## 6) 프론트 연동 순서
1. `index.html`에서 로컬 DB 우선 로직 대신 API 우선 로직으로 전환
2. 목록 렌더링: GET list
3. CRUD 버튼: 각 POST 액션 호출
4. 순서 변경 후 reorder API 호출
5. 공개전환 후 publish API 호출

## 7) 테스트 체크리스트
- 공개여부가 비공개인 글이 사용자 목록에 숨김 처리되는가
- 관리자에서 생성/수정/삭제 직후 목록이 재조회되는가
- 순서 변경이 새로고침 후에도 유지되는가
- 시트 직접 수정 후 목록에 반영되는가

## 8) 최소 운영 규칙
- 시트 헤더명은 변경하지 않기
- 공개여부 값은 공개/비공개만 사용
- 순서 변경은 API로만 처리하기

## 9) 다음 작업 제안
필요하면 다음 단계로 바로 진행 가능합니다.
- Apps Script `Code.gs` 실제 코드 템플릿 생성
- `index.html` API 연동 패치
- 관리자 토큰 입력 UI 추가
