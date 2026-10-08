# Kisan Saathi API + agent, for App Runner (port 8080). Build from the repo root:
#   docker build -f services/agent-kisan/Dockerfile -t saans-agent-kisan .
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.12.21 /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY services/agent-kisan/pyproject.toml services/agent-kisan/uv.lock ./
RUN uv sync --locked --no-default-groups --no-install-project
COPY services/agent-kisan/src ./src
RUN uv sync --locked --no-default-groups

FROM python:3.12-slim
RUN useradd --create-home --uid 10001 kisan
WORKDIR /app
COPY --from=build /app /app
COPY data/seed /app/data/seed
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    KISAN_CHC_SEED=/app/data/seed/chc_demo.json \
    KISAN_OUTBOX=/tmp/outbox/support_requests.jsonl \
    KISAN_BEDROCK_REGION=ap-south-1 \
    AWS_REGION=ap-south-1
USER kisan
EXPOSE 8080
CMD ["uvicorn", "agent_kisan.api:app", "--host", "0.0.0.0", "--port", "8080"]
