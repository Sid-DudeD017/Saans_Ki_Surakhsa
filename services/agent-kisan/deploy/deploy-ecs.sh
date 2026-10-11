#!/usr/bin/env bash
# Builds the agent image, pushes it to ECR and runs it on Amazon ECS Express Mode (App Runner's replacement:
# App Runner closed to new customers on 30 April 2026). Prints the https URL to use as KISAN_AGENT_URL.
# Run from anywhere in the repo, with Docker running:
#   AWS_PROFILE=saans services/agent-kisan/deploy/deploy-ecs.sh
# Costs money while it runs (one Fargate task, 1 vCPU / 2 GB, plus a load balancer). Tear down with:
#   aws ecs delete-express-gateway-service --region ap-south-1 --service-arn <the ARN this prints>
set -euo pipefail

REGION=ap-south-1
REPO=saans-agent-kisan
SERVICE=saans-agent-kisan
MODEL_ID=${KISAN_MODEL_ID:-in.anthropic.claude-opus-5}
# Where the agent files complaints and looks up tickets (the SAM stack's ApiUrl).
SAANS_API_URL=${SAANS_API_URL:-https://5qu2ontx1e.execute-api.ap-south-1.amazonaws.com/dev}

ROOT=$(git rev-parse --show-toplevel)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
TAG=$(git -C "$ROOT" rev-parse --short HEAD)$(git -C "$ROOT" diff --quiet || echo "-dirty")
IMAGE="$REGISTRY/$REPO:$TAG"

# 1. Roles: ECS pulls the image and writes logs (execution), manages the load balancer and scaling
#    (infrastructure), and the running agent may call Bedrock and nothing else (task).
role() { # name, trusted service
  aws iam get-role --role-name "$1" >/dev/null 2>&1 || aws iam create-role --role-name "$1" \
    --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"$2\"},\"Action\":\"sts:AssumeRole\"}]}" >/dev/null
}
role ecsTaskExecutionRole ecs-tasks.amazonaws.com
aws iam attach-role-policy --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
role ecsInfrastructureRoleForExpressServices ecs.amazonaws.com
aws iam attach-role-policy --role-name ecsInfrastructureRoleForExpressServices \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices
role saansAgentKisanTaskRole ecs-tasks.amazonaws.com
aws iam put-role-policy --role-name saansAgentKisanTaskRole --policy-name bedrock-invoke --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{\"Effect\": \"Allow\",
    \"Action\": [\"bedrock:InvokeModel\", \"bedrock:InvokeModelWithResponseStream\"],
    \"Resource\": [\"arn:aws:bedrock:$REGION:$ACCOUNT:inference-profile/*\", \"arn:aws:bedrock:*::foundation-model/anthropic.*\"]}]
}"

# 2. Image: Fargate here runs x86_64, so build for that even on an Apple Silicon Mac.
aws ecr describe-repositories --region "$REGION" --repository-names "$REPO" >/dev/null 2>&1 ||
  aws ecr create-repository --region "$REGION" --repository-name "$REPO" \
    --image-scanning-configuration scanOnPush=true >/dev/null
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker build --platform linux/amd64 -f "$ROOT/services/agent-kisan/Dockerfile" -t "$IMAGE" "$ROOT"
docker push "$IMAGE"

# 3. Service. Conversations live in memory, so exactly one task (min = max = 1).
CONTAINER="{\"image\":\"$IMAGE\",\"containerPort\":8080,\"environment\":[
  {\"name\":\"KISAN_MODEL_ID\",\"value\":\"$MODEL_ID\"},
  {\"name\":\"KISAN_BEDROCK_REGION\",\"value\":\"$REGION\"},
  {\"name\":\"SAANS_API_URL\",\"value\":\"$SAANS_API_URL\"}]}"
ARN=$(aws ecs list-services --region "$REGION" --query "serviceArns[?ends_with(@, '/$SERVICE')] | [0]" --output text)
if [ "$ARN" = "None" ] || [ -z "$ARN" ]; then
  sleep 10 # new IAM roles take a moment to be usable
  ARN=$(aws ecs create-express-gateway-service --region "$REGION" \
    --service-name "$SERVICE" \
    --execution-role-arn "arn:aws:iam::$ACCOUNT:role/ecsTaskExecutionRole" \
    --infrastructure-role-arn "arn:aws:iam::$ACCOUNT:role/ecsInfrastructureRoleForExpressServices" \
    --task-role-arn "arn:aws:iam::$ACCOUNT:role/saansAgentKisanTaskRole" \
    --primary-container "$CONTAINER" \
    --health-check-path /healthz \
    --scaling-target '{"minTaskCount":1,"maxTaskCount":1}' \
    --query service.serviceArn --output text)
else
  aws ecs update-express-gateway-service --region "$REGION" --service-arn "$ARN" \
    --primary-container "$CONTAINER" >/dev/null
fi
echo "Service: $ARN"
echo "Waiting for it to come up (a few minutes the first time)..."
aws ecs monitor-express-gateway-service --region "$REGION" --service-arn "$ARN" || true

URL=$(aws ecs describe-express-gateway-service --region "$REGION" --service-arn "$ARN" --output json |
  grep -oE '[A-Za-z0-9.-]+\.on\.aws' | head -1 || true)
URL=${URL:-https://$SERVICE.ecs.$REGION.on.aws}
URL=https://${URL#*://}
echo "Deployed $IMAGE"
echo "Health: $(curl -s "$URL/healthz")"
echo
echo "KISAN_AGENT_URL=$URL"
