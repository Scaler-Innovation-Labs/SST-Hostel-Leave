#!/usr/bin/env bash
# Architecture audit per AGENTS.md + docs/architecture/*.
# Exits non-zero if any violation is found. Run from the repo root:
#   bash scripts/audit-architecture.sh
set -uo pipefail

FAILURES=0

fail() {
  echo "❌ $1"
  FAILURES=$((FAILURES + 1))
}

ok() {
  echo "✓ $1"
}

echo "── Route → DTO → Service → Repository → Database ──"

# 1. Routes must not import repositories (Route → Repository is forbidden).
ROUTE_REPO_IMPORTS=$(grep -rl "db/repositories" src/app/api 2>/dev/null || true)
if [ -n "$ROUTE_REPO_IMPORTS" ]; then
  fail "Routes importing repositories directly:"
  echo "$ROUTE_REPO_IMPORTS" | sed 's/^/    /'
else
  ok "No route imports repositories directly"
fi

# 2. Routes that parse a body must validate it with a DTO (no raw parse).
#    Known exceptions (validated by other means):
#    - leaves/[id]/documents: multipart upload, file is checked with instanceof File
#    - webhooks/clerk: signature verified via svix before the body is read
EXEMPT_NO_DTO="
    src/app/api/v1/leaves/[id]/documents/route.ts
    src/app/api/webhooks/clerk/route.ts"
ROUTES_NO_DTO=""
for f in $(find src/app/api -name "route.ts" 2>/dev/null); do
  case "$EXEMPT_NO_DTO" in
    *"$f"*) continue ;;
  esac
  if grep -q "await request.json()\|request.formData()\|request.text()" "$f" \
     && ! grep -q "\.parse(" "$f"; then
    ROUTES_NO_DTO="$ROUTES_NO_DTO
    $f"
  fi
done
if [ -n "$ROUTES_NO_DTO" ]; then
  fail "Routes parsing bodies without DTO validation:$ROUTES_NO_DTO"
else
  ok "All body-parsing routes validate with a DTO"
fi

# 3. Services must not run raw table operations (bypassing repositories).
RAW_OPS=""
for f in $(find src/services -name "*.service.ts" 2>/dev/null); do
  hits=$(grep -nE "\.(insert|update|delete)\((students|users|userRoles|roles|leaveRequests|leaveApprovals|leaveExtensions|hostels|parents|movementEvents|qrPasses)" "$f" 2>/dev/null | head -3)
  if [ -n "$hits" ]; then
    RAW_OPS="$RAW_OPS
    === $f ===
    $hits"
  fi
done
if [ -n "$RAW_OPS" ]; then
  fail "Services bypassing repositories with raw table ops:$RAW_OPS"
else
  ok "No service bypasses the repository layer"
fi

echo ""
echo "── Audit logging ──"

# 4. Every create/update/delete/deactivate service must write an audit record.
NO_AUDIT=""
for f in $(find src/services -name "*.service.ts" 2>/dev/null | grep -iE "create-|update-|delete-|deactivate-"); do
  if ! grep -q "auditService" "$f"; then
    NO_AUDIT="$NO_AUDIT
    $f"
  fi
done
if [ -n "$NO_AUDIT" ]; then
  fail "Write services missing audit logging:$NO_AUDIT"
else
  ok "All create/update/delete/deactivate services write audit records"
fi

echo ""
echo "── Error handling ──"

# 5. Services and repositories must use domain errors, never generic Error.
GENERIC_ERROR=$(grep -rn "new Error(" src/services src/db/repositories 2>/dev/null | head -5 || true)
if [ -n "$GENERIC_ERROR" ]; then
  fail "Generic 'new Error(...)' in services/repositories:"
  echo "$GENERIC_ERROR" | sed 's/^/    /'
else
  ok "No generic Error in services or repositories"
fi

echo ""
echo "── Type safety ──"

# 6. No `any` in backend code (services, dto, repositories, api routes).
#    The only tolerated case is extracting pg driver error metadata in
#    lib/api/response.ts, which is allow-listed here.
ANY_IN_BACKEND=$(grep -rn ": any\|<any>" src/services src/dto src/db/repositories src/app/api 2>/dev/null | grep -v "lib/api/response.ts" | head -10 || true)
if [ -n "$ANY_IN_BACKEND" ]; then
  fail "'any' in backend code:"
  echo "$ANY_IN_BACKEND" | sed 's/^/    /'
else
  ok "No 'any' in backend code"
fi

echo ""
echo "── Business rules ──"

# 7. Approval chains must come from configuration, never hardcoded.
HARDCODED_CHAIN=$(grep -rn "Parent.*Warden\|POC.*Warden" src/services 2>/dev/null | head -5 || true)
if [ -n "$HARDCODED_CHAIN" ]; then
  fail "Hardcoded approval chain found:"
  echo "$HARDCODED_CHAIN" | sed 's/^/    /'
else
  ok "No hardcoded approval chains"
fi

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo "✅ Architecture audit passed — all checks clean."
  exit 0
else
  echo "❌ Architecture audit failed with $FAILURES violation(s)."
  exit 1
fi
