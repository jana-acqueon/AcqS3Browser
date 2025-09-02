// amplify/backend.ts

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";

const backend = defineBackend({
  auth,
});

const customBucketStack = backend.createStack("custom-bucket-stack");

const bucketName = process.env.MY_CUSTOM_BUCKET_NAME!.trim();
const bucketRegion = process.env.MY_CUSTOM_BUCKET_REGION!.trim();

const customBucket = Bucket.fromBucketName(customBucketStack, "MyCustomBucket", bucketName);

const { groups } = backend.auth.resources;

// --- Administrator Policy: Full access to IMServUAT ---
const administratorPolicy = new Policy(backend.stack, 'Administrator_AuthPolicy', {
  statements: [
    // Allow listing the bucket's root to see top-level folders
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
    }),
    // Grant full CRUD access to the IMServUAT folder and its contents
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      resources: [`${customBucket.bucketArn}/IMServUAT/*`],
    }),
    // Explicitly allow listing the contents of the IMServUAT folder
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: {
        StringLike: {
          "s3:prefix": ["IMServUAT/*"],
        },
      },
    }),
  ],
});
if (groups.Administrator) {
  groups.Administrator.role.attachInlinePolicy(administratorPolicy);
}

// --- Contributor Policy: RW access to IMServUAT ---
const contributorPolicy = new Policy(backend.stack, 'Contributor_AuthPolicy', {
  statements: [
    // Allow listing the bucket's root to see top-level folders
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
    }),
    // Grant RW access (no delete) to the IMServUAT folder and its contents
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject"],
      resources: [`${customBucket.bucketArn}/IMServUAT/*`],
    }),
    // Explicitly allow listing the contents of the IMServUAT folder
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: {
        StringLike: {
          "s3:prefix": ["IMServUAT/*"],
        },
      },
    }),
  ],
});
if (groups.Contributor) {
  groups.Contributor.role.attachInlinePolicy(contributorPolicy);
}

// --- LimitedContributor Policy: RW to specific subfolders only ---
const limitedContributorPolicy = new Policy(backend.stack, 'LimitedContributor_AuthPolicy', {
  statements: [
    // Grant Read/Write access to the two specific subfolders
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject"],
      resources: [
        `${customBucket.bucketArn}/IMServUAT/PreProcAutoupload/*`,
        `${customBucket.bucketArn}/IMServUAT/DataExtract/*`,
      ],
    }),
    // Grant list permission for the two specific subfolders only
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: {
        StringLike: {
          "s3:prefix": [
            "IMServUAT/PreProcAutoupload/*",
            "IMServUAT/DataExtract/*",
          ],
        },
      },
    }),
  ],
});
if (groups.LimitedContributor) {
  groups.LimitedContributor.role.attachInlinePolicy(limitedContributorPolicy);
}

// Frontend configuration
backend.addOutput({
  storage: {
    aws_region: bucketRegion,
    bucket_name: customBucket.bucketName,
    buckets: [{
      aws_region: bucketRegion,
      bucket_name: customBucket.bucketName,
      name: customBucket.bucketName,
    }],
  },
});