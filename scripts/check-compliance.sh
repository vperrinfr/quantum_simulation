#!/usr/bin/env bash
# check-compliance.sh
set -euo pipefail
PASS=0; FAIL=0

check() {
  local label="$1"; local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo "  ✅ $label"; PASS=$((PASS+1))
  else
    echo "  ❌ FAIL: $label"; FAIL=$((FAIL+1))
  fi
}

echo "=== Compliance Check ==="
check "README.md present"          "[ -f README.md ]"
check "ARCHITECTURE.md present"    "[ -f ARCHITECTURE.md ]"
check "PILOT_PLAN.md present"      "[ -f PILOT_PLAN.md ]"
check "DEMO_SCRIPT.md present"     "[ -f DEMO_SCRIPT.md ]"
check ".env.example present"       "[ -f .env.example ]"
check ".env NOT committed"         "! git ls-files --error-unmatch .env 2>/dev/null"
check "No hardcoded API keys"      "! grep -r 'IBM_QUANTUM_API_KEY=' backend/ --include='*.py' | grep -v 'None' | grep -v '#'"
check "@carbon/react in deps"      "grep -q '@carbon/react' frontend/package.json"
check "DemoBanner used"            "grep -r 'DemoBanner' frontend/src/App.jsx"
check "ILLUSTRATIVE disclaimer"    "grep -r 'ILLUSTRATIVE' backend/services/molecular_hamiltonians.py"
check "No eval() usage"            "! grep -r 'eval(' frontend/src/"
check "No real emails"             "! grep -rE '[a-z]+@(?!example|demo\.ibm)' backend/ --include='*.py'"
check "IBM Plex font"              "grep -q 'IBM Plex' frontend/index.html"
check "InlineNotification"         "grep -q 'InlineNotification' frontend/src/components/DemoBanner.jsx"
check "EstimatorV2 (V2 primitives)" "grep -q 'EstimatorV2' backend/services/quantum_service.py"
check "No V1 Estimator import"     "! grep -q 'from qiskit_ibm_runtime import.*Estimator[^V]' backend/services/quantum_service.py"
check "apply_layout called"        "grep -q 'apply_layout' backend/services/quantum_service.py"
check "Exact energy computed"      "grep -q 'exact_ground_state_energy' backend/routers/quantum.py"

# Dockerfile headers
check "Dockerfile.frontend DEPLOY_TARGET header" "grep -q '# DEPLOY_TARGET:' Dockerfile.frontend"
check "Dockerfile.backend DEPLOY_TARGET header"  "grep -q '# DEPLOY_TARGET:' Dockerfile.backend"
check "Frontend uses UBI9 (openshift)"  "grep -q 'ubi9/' Dockerfile.frontend"
check "Backend uses UBI9 (openshift)"   "grep -q 'ubi9/' Dockerfile.backend"
check "Runtime pinned linux/amd64"      "grep -q 'platform=linux/amd64' Dockerfile.backend"

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed."
[ "$FAIL" -eq 0 ] && echo "✅ ALL COMPLIANCE CHECKS PASSED" || { echo "❌ COMPLIANCE FAILURES DETECTED"; exit 1; }
