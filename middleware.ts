import { KameleoonClient, Environment } from "@kameleoon/nodejs-sdk";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@vercel/edge-config";

const KAMELEOON_USER_ID = "kameleoon_user_id";

// Replace it with your featureKey from Kameleoon Platform
// If you follow the instruction from `README`, leave `featureKey` as it is
const FEATURE_KEY = "new_home_page";

// On these paths the current middleware will be invoked
export const config = {
  matcher: ["/", "/new-home-page"],
};

export default async function middleware(req: NextRequest) {
  if (!process.env.KAMELEOON_SITE_CODE) {
    throw new Error(
      "[KAMELEOON] ERROR: Missing the `KAMELEOON_SITE_CODE` environment variable"
    );
  }

  // Fetch user id from the cookie if available to make sure that results are sticky
  // If you have your own unique user identifier, please replace crypto.randomUUID() with it
  const visitorCode =
    req.cookies.get(KAMELEOON_USER_ID)?.value || crypto.randomUUID();

  // Pass the Connection String to create the edge client
  const edgeConfigClient = createClient(process.env.EDGE_CONFIG);
  // Pass the site code to retrieve the `clientConfiguration` stored in Edge Config
  const clientConfiguration = await edgeConfigClient.get(
    process.env.KAMELEOON_SITE_CODE
  );

  // Create KameleoonClient instance using external `clientConfiguration` fetched from Edge Config
  const kameleoonClient = new KameleoonClient({
    siteCode: process.env.KAMELEOON_SITE_CODE,
    configuration: { environment: Environment.Production },
    integrations: {
      externalClientConfiguration: JSON.parse(clientConfiguration as string),
    },
  });

  // Initialize Kameleoon client before using it's methods
  await kameleoonClient.initialize();

  // Returns a boolean indicating whether the visitor with visitorCode has featureKey active for him
  const isFeatureActive = kameleoonClient.isFeatureFlagActive(
    visitorCode,
    FEATURE_KEY
  );

  // Returns a variable for the visitor under visitorCode in the found feature flag
  const homePageVariable = kameleoonClient.getFeatureFlagVariable({
    visitorCode,
    featureKey: FEATURE_KEY,
    variableKey: "home_page",
  });

  console.log(
    `[KAMELEOON] Feature flag with '${FEATURE_KEY}' feature key is '${
      isFeatureActive ? "active" : "inactive"
    }'`
  );
  console.log(
    `[KAMELEOON] Feature flag with '${FEATURE_KEY}' feature key has '${homePageVariable.value}' variable`
  );

  // Rewriting the path based on `homePageVariable` value
  // If the value is `old_version`, it returns `/` path, otherwise `/new-home-page`
  req.nextUrl.pathname =
    homePageVariable.value === "old_version" ? "/" : "/new-home-page";
  const response = NextResponse.rewrite(req.nextUrl);

  if (!req.cookies.has(KAMELEOON_USER_ID)) {
    // Saving visitorCode in the cookie so that the decision sticks for subsequent visits
    response.cookies.set(KAMELEOON_USER_ID, visitorCode);
  }

  return response;
}
