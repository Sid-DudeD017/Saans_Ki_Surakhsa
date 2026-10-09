import { CognitoJwtVerifier } from "aws-jwt-verify";
import { CognitoJwtVerifierSingleUserPool } from "aws-jwt-verify/cognito-verifier";
import { VerifiedPermissionsClient, IsAuthorizedWithTokenCommand } from "@aws-sdk/client-verifiedpermissions";

export interface APIGatewayRequestAuthorizerEventV2 {
  /** "GET /v1/cases/{id}": the route as template.yaml declares it, without the stage prefix. */
  routeKey?: string;
  requestContext?: {
    http?: {
      method: string;
      path: string;
    }
  };
  headers?: Record<string, string>;
}

export interface APIGatewaySimpleAuthorizerResult {
  isAuthorized: boolean;
  context?: {
    subject?: string;
    role?: string;
    district?: string;
    error?: string;
  };
}

let verifier: CognitoJwtVerifierSingleUserPool<{ userPoolId: string; tokenUse: "access"; clientId: string }> | undefined;
let avpClient: any;

export const setVerifierForTest = (mockVerifier: typeof verifier) => {
    verifier = mockVerifier;
};
export const setAvpClientForTest = (mockClient: any) => {
    avpClient = mockClient;
};

const routeMap: Record<string, string> = {
    "GET /v1/officer/whoami": "whoami"
};

// The case API: here only "a signed-in officer of exactly one district"; the case Lambda then asks
// Verified Permissions per case, with the district read from the database (avp.ts, avpAuthz.ts).
const caseRoutes = new Set(["GET /v1/cases", "GET /v1/cases/{id}", "POST /v1/cases/{id}/actions"]);

/** The route's key: API Gateway's routeKey, else method and path with any stage prefix and case id folded. */
export function routeOf(event: APIGatewayRequestAuthorizerEventV2): string {
    if (event.routeKey) return event.routeKey;
    const method = event.requestContext?.http?.method || "";
    const path = (event.requestContext?.http?.path || "").replace(/^\/(?!v1\/|health)[^/]+(?=\/)/, "");
    return `${method} ${path.replace(/^\/v1\/cases\/[^/]+/, "/v1/cases/{id}")}`;
}

export const authorizer = async (event: APIGatewayRequestAuthorizerEventV2): Promise<APIGatewaySimpleAuthorizerResult> => {
    const poolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;
    const policyStoreId = process.env.VERIFIED_PERMISSIONS_POLICY_STORE_ID;
    
    if (!poolId || !clientId || !policyStoreId) {
        return { isAuthorized: false, context: { error: "unauthorized" } };
    }

    if (!verifier) {
        verifier = CognitoJwtVerifier.create({
            userPoolId: poolId,
            tokenUse: "access",
            clientId: clientId,
        });
    }

    const c = avpClient || new VerifiedPermissionsClient({});

    try {
        const authHeader = event.headers?.authorization || event.headers?.Authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return { isAuthorized: false, context: { error: "unauthorized" } };
        }
        
        const token = authHeader.substring(7);
        const payload = await verifier.verify(token);
        const groups = payload["cognito:groups"] || [];
        
        if (!groups.includes("officer")) {
            return { isAuthorized: false, context: { error: "unauthorized" } };
        }
        
        const hasSangrur = groups.includes("district-sangrur");
        const hasPatiala = groups.includes("district-patiala");
        if ((hasSangrur && hasPatiala) || (!hasSangrur && !hasPatiala)) {
            return { isAuthorized: false, context: { error: "unauthorized" } };
        }
        const district = hasSangrur ? "sangrur" : "patiala";
        
        const route = routeOf(event);
        if (caseRoutes.has(route)) {
            return { isAuthorized: true, context: { subject: payload.sub, role: "officer", district } };
        }
        const matchedAction = routeMap[route];

        if (!matchedAction) {
            return { isAuthorized: false, context: { error: "unauthorized" } };
        }

        const res = await c.send(new IsAuthorizedWithTokenCommand({
            policyStoreId,
            accessToken: token,
            action: { actionType: "Saans::Action", actionId: matchedAction },
            resource: { entityType: "Saans::Application", entityId: "app" }
        }));

        if (res.decision !== "ALLOW") {
            return { isAuthorized: false, context: { error: "unauthorized" } };
        }

        return {
            isAuthorized: true,
            context: {
                subject: payload.sub,
                role: "officer",
                district
            }
        };
    } catch (err) {
        return { isAuthorized: false, context: { error: "unauthorized" } };
    }
};
