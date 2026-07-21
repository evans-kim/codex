#!/usr/bin/env bash
set -euo pipefail

REPO="${GH_REPO:-evans-kim/codex}"
SITE_URL="${SITE_URL:-https://evans-kim.github.io/codex/}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
PAGES_BRANCH="${PAGES_BRANCH:-gh-pages}"
KNOWN_BOOTSTRAP_SHA="${KNOWN_BOOTSTRAP_SHA:-2ae92c204c708adaea12c89deaa3256500640b9c}"

fail() {
  printf '오류: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git이 필요합니다."
command -v gh >/dev/null 2>&1 || fail "GitHub CLI(gh)가 필요합니다."
command -v curl >/dev/null 2>&1 || fail "curl이 필요합니다."
command -v npm >/dev/null 2>&1 || fail "Node.js와 npm이 필요합니다."

gh auth status >/dev/null 2>&1 || fail "먼저 'gh auth login'으로 GitHub에 로그인하세요."

current_branch="$(git branch --show-current)"
[[ "$current_branch" == "$DEFAULT_BRANCH" ]] || fail "현재 브랜치가 '$DEFAULT_BRANCH'가 아닙니다: $current_branch"
[[ -z "$(git status --porcelain)" ]] || fail "커밋되지 않은 변경 사항이 있습니다. 먼저 정리하세요."

printf '\n[1/6] 자동 테스트와 정적 배포 산출물 생성\n'
npm test
npm run build

printf '\n[2/6] %s 브랜치 푸시\n' "$DEFAULT_BRANCH"
git fetch origin "$DEFAULT_BRANCH" || true
if git show-ref --verify --quiet "refs/remotes/origin/${DEFAULT_BRANCH}"; then
  remote_head="$(git rev-parse "refs/remotes/origin/${DEFAULT_BRANCH}")"
  if git merge-base --is-ancestor "$remote_head" "$DEFAULT_BRANCH"; then
    git push -u origin "$DEFAULT_BRANCH"
  elif [[ "$remote_head" == "$KNOWN_BOOTSTRAP_SHA" ]]; then
    printf '  알려진 초기 README 커밋을 완성된 로컬 이력으로 교체합니다.\n'
    git push -u origin "$DEFAULT_BRANCH" \
      --force-with-lease="refs/heads/${DEFAULT_BRANCH}:${remote_head}"
  else
    fail "원격 ${DEFAULT_BRANCH}에 예상하지 못한 이력이 있습니다: ${remote_head}"
  fi
else
  git push -u origin "$DEFAULT_BRANCH"
fi

printf '\n[3/6] 검증된 정적 산출물을 %s 브랜치에 게시\n' "$PAGES_BRANCH"
temporary_index="$(mktemp)"
rm -f "$temporary_index"
GIT_INDEX_FILE="$temporary_index" git --git-dir="$PWD/.git" --work-tree="$PWD/dist" add -A
pages_tree="$(GIT_INDEX_FILE="$temporary_index" git write-tree)"
pages_commit="$(printf 'Deploy %s to GitHub Pages\n' "$(git rev-parse --short HEAD)" | git commit-tree "$pages_tree")"
rm -f "$temporary_index"
git push origin "${pages_commit}:refs/heads/${PAGES_BRANCH}" --force

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT
cat > "$payload" <<JSON
{
  "build_type": "legacy",
  "source": {
    "branch": "${PAGES_BRANCH}",
    "path": "/"
  }
}
JSON

printf '\n[4/6] GitHub Pages 게시 소스 구성\n'
if gh api "repos/${REPO}/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/${REPO}/pages" --input "$payload" >/dev/null
else
  gh api --method POST "repos/${REPO}/pages" --input "$payload" >/dev/null
fi

printf '\n[5/6] Pages 빌드 상태 확인\n'
for attempt in $(seq 1 36); do
  status="$(gh api "repos/${REPO}/pages" --jq '.status // "unknown"' 2>/dev/null || true)"
  printf '  시도 %02d: %s\n' "$attempt" "$status"
  if [[ "$status" == "built" ]]; then
    break
  fi
  sleep 5
done

status="$(gh api "repos/${REPO}/pages" --jq '.status // "unknown"' 2>/dev/null || true)"
[[ "$status" == "built" ]] || fail "Pages 상태가 아직 built가 아닙니다: $status"

printf '\n[6/6] 실제 배포 URL 스모크 테스트\n'
tmp_html="$(mktemp)"
trap 'rm -f "$payload" "$tmp_html"' EXIT
curl --fail --silent --show-error --location --retry 6 --retry-delay 5 "$SITE_URL" --output "$tmp_html"
grep -q '<title>여보, 오늘 뭐 먹지?</title>' "$tmp_html" || fail "배포 HTML에서 예상 제목을 찾지 못했습니다."
curl --fail --silent --show-error --location "${SITE_URL}js/app.js" >/dev/null
curl --fail --silent --show-error --location "${SITE_URL}assets/menus/shabu-shabu.svg" >/dev/null
curl --fail --silent --show-error --location "${SITE_URL}manifest.webmanifest" >/dev/null

printf '\n배포와 원격 스모크 테스트가 완료되었습니다.\n%s\n' "$SITE_URL"
