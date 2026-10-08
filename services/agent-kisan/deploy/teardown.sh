#!/usr/bin/env bash
# Stops everything P1 runs on AWS, so nothing keeps billing after the hackathon (Sunday task).
#   AWS_PROFILE=saans services/agent-kisan/deploy/teardown.sh          # list what would be deleted
#   AWS_PROFILE=saans services/agent-kisan/deploy/teardown.sh --yes    # delete it
# Covers: the App Runner stack, SageMaker endpoints/configs/models with "saans" in the name (the GPU
# speech endpoint), and the ECR image repository. Bedrock and SNS bill per use and need no teardown.
set -uo pipefail

REGION=ap-south-1
STACK=saans-agent-kisan
REPO=saans-agent-kisan
MATCH=saans
DELETE=false
[ "${1:-}" = "--yes" ] && DELETE=true
aws_() { aws --region "$REGION" "$@"; }
act() {
  if $DELETE; then echo "  deleting: $*"; aws_ "$@" >/dev/null || echo "  FAILED: $*"; else echo "  would delete: $*"; fi
}

echo "App Runner stack"
if aws_ cloudformation describe-stacks --stack-name "$STACK" >/dev/null 2>&1; then
  act cloudformation delete-stack --stack-name "$STACK"
  $DELETE && aws_ cloudformation wait stack-delete-complete --stack-name "$STACK" && echo "  stack gone"
else
  echo "  none"
fi

echo "SageMaker (GPU speech endpoint)"
for kind in endpoint endpoint-config model; do
  case $kind in
    endpoint) list=list-endpoints; key=Endpoints; name=EndpointName; del=delete-endpoint; flag=--endpoint-name ;;
    endpoint-config) list=list-endpoint-configs; key=EndpointConfigs; name=EndpointConfigName; del=delete-endpoint-config; flag=--endpoint-config-name ;;
    model) list=list-models; key=Models; name=ModelName; del=delete-model; flag=--model-name ;;
  esac
  if ! names=$(aws_ sagemaker "$list" --name-contains "$MATCH" --query "$key[].$name" --output text 2>&1); then
    echo "  couldn't list ${kind}s: ${names##*: }"
    continue
  fi
  [ -z "$names" ] || [ "$names" = "None" ] && { echo "  no ${kind}s"; continue; }
  for n in $names; do act sagemaker "$del" "$flag" "$n"; done
done

echo "ECR images"
if aws_ ecr describe-repositories --repository-names "$REPO" >/dev/null 2>&1; then
  act ecr delete-repository --repository-name "$REPO" --force
else
  echo "  none"
fi

$DELETE || echo "Nothing was deleted. Run again with --yes to delete the items above."
echo "Check Billing and Cost Management tomorrow: charges can show up a day late."
