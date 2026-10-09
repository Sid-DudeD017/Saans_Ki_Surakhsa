import { VerifiedPermissionsClient, IsAuthorizedWithTokenCommand } from "@aws-sdk/client-verifiedpermissions";

let avpClient: any;
export const setAvpClientForTest = (c: any) => { avpClient = c; };

const ALLOWED_ACTIONS = new Set([
  "list", "counts", "map", "detail", "evidence", "assign", "mark_in_field", "record_action", "close"
]);

/**
 * Authorizes a specific case action using Verified Permissions.
 * @param token The raw access token string.
 * @param action The specific action to authorize (e.g. 'detail', 'assign').
 * @param caseId The real case ID being acted upon.
 * @param trustedResourceDistrict The district string. This MUST be supplied ONLY after loading the case from the database. Never accept a request-body district.
 */
export const authorizeResource = async (
    token: string, 
    action: string, 
    caseId: string, 
    trustedResourceDistrict: string
): Promise<boolean> => {
    if (!ALLOWED_ACTIONS.has(action)) {
        return false;
    }

    const c = avpClient || new VerifiedPermissionsClient({});
    const policyStoreId = process.env.VERIFIED_PERMISSIONS_POLICY_STORE_ID;
    if (!policyStoreId) {
        throw new Error("Missing policy store config");
    }

    try {
        const res = await c.send(new IsAuthorizedWithTokenCommand({
            policyStoreId,
            accessToken: token,
            action: { actionType: "Saans::Action", actionId: action },
            resource: { entityType: "Saans::Case", entityId: caseId },
            entities: {
                entityList: [
                    {
                        identifier: { entityType: "Saans::Case", entityId: caseId },
                        attributes: { district: { string: trustedResourceDistrict } }
                    }
                ]
            }
        }));
        return res.decision === "ALLOW";
    } catch (e) {
        return false;
    }
};
