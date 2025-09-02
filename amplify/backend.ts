// amplify/backend.ts

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";

// Import the access configuration from the separate file
import { accessConfig, AccessRule } from './accessConfig';

const backend = defineBackend({
  auth,
});

// Map custom permissions to S3 actions for the IAM policy generator.
type S3PermissionKeys = "get" | "list" | "write" | "delete";

const permissionToS3Actions: Record<S3PermissionKeys, string[]> = {
  get: ["s3:GetObject"],
  list: ["s3:ListBucket"],
  write: ["s3:PutObject"],
  delete: ["s3:DeleteObject"],
};

/**
 * Dynamically generates a policy statement array from the access configuration.
 * Supports root-level files via path: "".
 */
function generatePolicyStatements(bucketArn: string, rules: AccessRule[]): PolicyStatement[] {
  const statements: PolicyStatement[] = [];
  const folderListPrefixes: string[] = [];
  let hasRootListPermission = false;

  for (const rule of rules) {
    const actions: string[] = [];
    const resources: string[] = [];

    // Map permissions except "list"
    const objectActions = rule.permissions
      .filter((p) => p !== "list")
      .flatMap((p: S3PermissionKeys) => permissionToS3Actions[p]);

    if (objectActions.length > 0) {
      actions.push(...objectActions);
      resources.push(`${bucketArn}/${rule.path}`);
    }

    // Handle list permissions
    if (rule.permissions.includes("list")) {
      if (rule.path === "") {
        hasRootListPermission = true;
      } else {
        const normalizedPrefix = rule.path.replace(/\*$/, "");
        folderListPrefixes.push(normalizedPrefix);
      }
    }

    if (actions.length > 0) {
      statements.push(new PolicyStatement({
        effect: Effect.ALLOW,
        actions,
        resources,
      }));
    }
  }

  // Add a consolidated ListBucket statement for specific folders
  if (folderListPrefixes.length > 0) {
    statements.push(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [bucketArn],
      conditions: {
        StringLike: {
          "s3:prefix": folderListPrefixes,
        },
      },
    }));
  }

  // Add a separate ListBucket statement for the root, if needed
  if (hasRootListPermission) {
    statements.push(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [bucketArn],
    }));
  }

  return statements;
}

/**
 * Generates the frontend-facing path configuration from the accessConfig.
 */
function generateFrontendPaths(config: Record<string, AccessRule[]>): Record<string, any> {
  const paths: Record<string, any> = {};

  for (const [group, rules] of Object.entries(config)) {
    for (const rule of rules) {
      const path = rule.path;
      const groupsKey = `groups${group}`;

      if (!paths[path]) {
        paths[path] = {};
      }

      if (!paths[path][groupsKey]) {
        paths[path][groupsKey] = [];
      }
      paths[path][groupsKey].push(...rule.permissions);
    }
  }
  return paths;
}

const customBucketStack = backend.createStack("custom-bucket-stack");

const bucketName = process.env.MY_CUSTOM_BUCKET_NAME!.trim();
const bucketRegion = process.env.MY_CUSTOM_BUCKET_REGION!.trim();

const customBucket = Bucket.fromBucketName(customBucketStack, "MyCustomBucket", bucketName);

// The frontend paths are now dynamically generated!
const frontendPaths = generateFrontendPaths(accessConfig);

backend.addOutput({
  storage: {
    aws_region: bucketRegion,
    bucket_name: customBucket.bucketName,
    buckets: [{
      aws_region: bucketRegion,
      bucket_name: customBucket.bucketName,
      name: customBucket.bucketName,
      // Pass the dynamically generated paths object here.
      paths: frontendPaths,
    }],
  },
});

const { groups } = backend.auth.resources;

// Loop through the accessConfig and attach a dynamically generated policy to each group.
for (const [group, rules] of Object.entries(accessConfig)) {
  if (groups[group]) {
    const policyStatements = generatePolicyStatements(customBucket.bucketArn, rules);
    if (policyStatements.length > 0) {
      const policy = new Policy(backend.stack, `${group}_AuthPolicy`, {
        statements: policyStatements,
      });
      groups[group].role.attachInlinePolicy(policy);
    }
  } else {
    console.warn(`Group '${group}' not found in auth resources. Skipping policy attachment.`);
  }
}