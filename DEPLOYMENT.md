# GitHub Pages 배포 절차

대상 저장소: `evans-kim/codex`  
배포 주소: `https://evans-kim.github.io/codex/`

## 현재 배포 상태

- GitHub Pages API: HTTP 200
- 공개 앱: HTTP 200
- 핵심 자산: JavaScript, 대표 메뉴 SVG, Manifest 로드 성공
- 자동 검증 결과: [`DEPLOYMENT_STATUS.json`](./DEPLOYMENT_STATUS.json)

## 배포 구조

- `main`: 소스와 테스트, 구현 문서
- `gh-pages`: `npm run build`가 만든 `dist/`의 정적 배포 파일만 포함
- Pages 게시 소스: `gh-pages` 브랜치의 `/` 루트
- 런타임 서버·빌드 도구: 없음

GitHub Pages는 특정 브랜치의 루트를 게시 소스로 사용할 수 있다. 이 프로젝트는 번들링이 필요 없지만, 소스 문서와 테스트를 공개 사이트에서 제외하기 위해 `npm run build`가 필요한 정적 파일만 `dist/`에 복사한다. 배포 스크립트는 이 디렉터리로 독립적인 Git 트리를 만들어 `gh-pages`에 직접 푸시한다.

## 사전 조건

- Git 2.40 이상
- Node.js 20 이상
- GitHub CLI `gh`
- `gh auth login`이 완료된 GitHub 계정
- `evans-kim/codex` 저장소의 관리자 또는 유지관리 권한
- 커밋되지 않은 변경 사항이 없는 `main` 브랜치

## 자동 배포

저장소 루트에서 실행한다.

```bash
./scripts/publish-pages.sh
```

스크립트는 다음 순서를 중간 실패 시 즉시 중단하며 수행한다.

1. `npm test`와 `npm run build`
2. `main` 푸시. 원격에 알려진 초기 README 커밋만 있는 경우에만 `--force-with-lease`로 완성된 이력으로 교체
3. `dist/`만 담은 독립적인 배포 커밋을 만들어 `gh-pages`에 직접 푸시
4. GitHub Pages REST API로 `gh-pages` `/`를 게시 소스로 생성 또는 갱신
5. Pages 상태가 `built`인지 확인
6. 실제 URL에서 `index.html`, `js/app.js`, 대표 메뉴 SVG, Manifest 확인

GitHub Actions의 `verify-pages.yml`도 `main` 변경 시 테스트·빌드·실 URL 확인을 수행하고 결과를 `DEPLOYMENT_STATUS.json`에 저장한다.

## 수동 확인

배포 후 다음 주소가 모두 HTTP 200을 반환해야 한다.

```text
https://evans-kim.github.io/codex/
https://evans-kim.github.io/codex/js/app.js
https://evans-kim.github.io/codex/assets/menus/shabu-shabu.svg
https://evans-kim.github.io/codex/manifest.webmanifest
```

브라우저에서는 다음 흐름을 확인한다.

```text
오늘의 저녁 고르기
→ 기분·체력·음식 느낌·식사 방식 선택
→ 추천 3개 표시
→ 메뉴 확정
→ 기록 화면에 선택 내역 표시
```

모바일에서는 홈 화면 설치와 네트워크를 끈 뒤 재접속도 확인한다. Service Worker는 앱 셸과 메뉴 이미지를 같은 출처의 캐시에 저장한다.

## 재배포

새 커밋을 `main`에 만든 뒤 같은 스크립트를 다시 실행한다. 스크립트는 예상하지 못한 원격 이력이 보이면 덮어쓰지 않고 중단한다. `gh-pages`는 매번 `dist/`만 담은 배포 커밋으로 교체되므로 별도 브랜치 편집은 하지 않는다.
