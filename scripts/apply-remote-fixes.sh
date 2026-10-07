#!/usr/bin/env bash
# Apply prepared security fixes to GitHub + Firebase when tokens are available.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Missing GITHUB_TOKEN (GitHub PAT with repo scope)."
  exit 1
fi

if [[ -z "${FIREBASE_TOKEN:-}" ]]; then
  echo "Missing FIREBASE_TOKEN (from: npx firebase login:ci)."
  exit 1
fi

REPO="${GITHUB_REPO:-kurty000/Hiyas-Museum}"
BRANCH="${GITHUB_BRANCH:-cursor/firebase-security-fix-5c5d}"

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$WORKDIR/repo"
cd "$WORKDIR/repo"
git checkout -B "$BRANCH"

cp "$ROOT/database.rules.json" .
cp "$ROOT/firestore.rules" .
cp "$ROOT/firestore.indexes.json" .
cp "$ROOT/firebase.json" .
cp "$ROOT/.firebaserc" .
cp "$ROOT/vercel.json" .
cp "$ROOT/package.json" .
cp "$ROOT/README.md" .
cp "$ROOT/.gitignore" .
rm -f api/test

git add database.rules.json firestore.rules firestore.indexes.json firebase.json \
  .firebaserc vercel.json package.json README.md .gitignore
git add -u api/test 2>/dev/null || true

if git diff --cached --quiet; then
  echo "No file changes to commit (already applied?)."
else
  git -c user.email="cursor-agent@cursor.com" -c user.name="Cursor Agent" commit -m "$(cat <<'EOF'
Harden Firebase rules and fix Vercel API routing

Lock down RTDB liveSensors (auth read; validated device writes),
add Firestore rules for signed-in museum staff, exclude /api from
SPA rewrites, and declare firebase-admin for the sensors endpoint.
EOF
)"
fi

git push -u origin "$BRANCH"
echo "Pushed branch: https://github.com/${REPO}/tree/${BRANCH}"

cd "$ROOT"
if [[ ! -x node_modules/.bin/firebase ]]; then
  npm install firebase-tools --no-save --no-fund --no-audit
fi

./node_modules/.bin/firebase deploy --only firestore:rules,database --project hiyas-museum-da909 --token "$FIREBASE_TOKEN"

# Add Vercel authorized domain via Identity Toolkit Admin API
ACCESS_TOKEN="$(./node_modules/.bin/firebase login:ci --token "$FIREBASE_TOKEN" >/dev/null 2>&1 || true)"
# Use google auth from firebase token exchange is non-trivial; domain step may need Console.
# Attempt with gcloud if available later.

echo "Rules deploy finished. Verify Auth authorized domains includes hiyas-museum.vercel.app"
echo "Done."
