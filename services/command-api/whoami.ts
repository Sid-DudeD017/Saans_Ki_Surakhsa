interface APIGatewayProxyEventV2 {
  requestContext?: {
    authorizer?: {
      lambda?: {
        subject?: string;
        role?: string;
        district?: string;
      };
    };
  };
}

export const handler = async (event: APIGatewayProxyEventV2) => {
    return {
        statusCode: 200,
        body: JSON.stringify({
            subject: event.requestContext?.authorizer?.lambda?.subject,
            role: event.requestContext?.authorizer?.lambda?.role,
            district: event.requestContext?.authorizer?.lambda?.district
        })
    };
};
