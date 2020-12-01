#!/bin/bash
set -evo pipefail
MESSAGE="$(git log -1 --pretty=%B) .... bump version [skip ci]"
git remote set-url --push origin "https://${GH_TOKEN}@github.com/${REPO_SLUG}.git"
lerna version patch --no-push --yes --includeMergedTags --no-git-tag-version --no-commit-hooks -m "${MESSAGE}"
lerna exec "npm install -s --ignore-scripts --package-lock-only --no-audit"
git add core/*/package-lock.json 
git add core/*/package.json 
HUSKY_SKIP_HOOKS=1 git commit -m "${MESSAGE}" || true
HUSKY_SKIP_HOOKS=1 npm version patch --git-tag-version --commit-hooks=false -m "${MESSAGE}"
git push --follow-tags