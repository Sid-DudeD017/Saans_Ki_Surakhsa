#!/usr/bin/env bash
# Builds the agent image, pushes it to ECR and deploys App Runner. Run from anywhere in the repo:
#   AWS_PROFILE=saans services/agent-kisan/deploy/deploy.sh
# Costs money while it runs (one always-on instance). Tear down with:
#   aws cloudformation delete-stack --stack-name saans-agent-kisan --region ap-south-1
set -euo pipefail

REGION=ap-south-1
REPO=saans-agent-kisan
STACK=saans-agent-kisan
MODEL_ID=${KISAN_MODEL_ID:-in.anthropic.claude-opus-5}
SAANS_API_URL=${SAANS_API_URL:-}

ROOT=$(git rev-parse --show-toplevel)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
TAG=$(git -C "$ROOT" rev-parse --short HEAD)$(git -C "$ROOT" diff --quiet || echo "-dirty")
IMAGE="$REGISTRY/$REPO:$TAG"

aws ecr describe-repositories --region "$REGION" --repository-names "$REPO" >/dev/null 2>&1 ||
  aws ecr create-repository --region "$REGION" --repository-name "$REPO" \
    --image-scanning-configuration scanOnPush=true >/dev/null
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

# App Runner runs x86_64, so build for that even on an Apple Silicon Mac.
docker build --platform linux/amd64 -f "$ROOT/services/agent-kisan/Dockerfile" -t "$IMAGE" "$ROOT"
docker push "$IMAGE"

aws cloudformation deploy --region "$REGION" --stack-name "$STACK" \
  --template-file "$ROOT/services/agent-kisan/deploy/apprunner.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides ImageUri="$IMAGE" ModelId="$MODEL_ID" SaansApiUrl="$SAANS_API_URL"

URL=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='ServiceUrl'].OutputValue" --output text)
echo "Deployed $IMAGE"
echo "Health: $(curl -s "$URL/healthz")  $URL"
