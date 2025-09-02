// amplify/backend.ts

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";

const backend = defineBackend({ auth });
const customBucketStack = backend.createStack("custom-bucket-stack");

const bucketName = process.env.MY_CUSTOM_BUCKET_NAME!.trim();
const bucketRegion = process.env.MY_CUSTOM_BUCKET_REGION!.trim();
const customBucket = Bucket.fromBucketName(customBucketStack, "MyCustomBucket", bucketName);

const { groups } = backend.auth.resources;

// ---------------------- Administrator Policy ----------------------
const administratorPolicy = new Policy(backend.stack, 'Administrator_AuthPolicy', {
  statements: [
    // List top-level folders in bucket
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
    }),
    // List IMServUAT folder itself
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: { StringLike: { "s3:prefix": ["IMServUAT/"] } },
    }),
    // Full access to objects inside IMServUAT
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      resources: [`${customBucket.bucketArn}/IMServUAT/*`],
    }),
  ],
});
if (groups.Administrator) groups.Administrator.role.attachInlinePolicy(administratorPolicy);

// ---------------------- Contributor Policy ----------------------
const contributorPolicy = new Policy(backend.stack, 'Contributor_AuthPolicy', {
  statements: [
    // List top-level folders in bucket
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
    }),
    // List IMServUAT folder itself
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: { StringLike: { "s3:prefix": ["IMServUAT/"] } },
    }),
    // Read/Write access (no delete) inside IMServUAT
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject"],
      resources: [`${customBucket.bucketArn}/IMServUAT/*`],
    }),
  ],
});
if (groups.Contributor) groups.Contributor.role.attachInlinePolicy(contributorPolicy);

// ---------------------- LimitedContributor Policy ----------------------
const limitedContributorPolicy = new Policy(backend.stack, 'LimitedContributor_AuthPolicy', {
  statements: [
    // List top-level folders in bucket
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
    }),
    // List only the two specific subfolders
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: {
        StringLike: {
          "s3:prefix": [
            "IMServUAT/PreProcAutoupload/",
            "IMServUAT/DataExtract/",
          ],
        },
      },
    }),
    // Read/Write access inside the two subfolders
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject"],
      resources: [
        `${customBucket.bucketArn}/IMServUAT/PreProcAutoupload/*`,
        `${customBucket.bucketArn}/IMServUAT/DataExtract/*`,
      ],
    }),
  ],
});
if (groups.LimitedContributor) groups.LimitedContributor.role.attachInlinePolicy(limitedContributorPolicy);

// ---------------------- Frontend output ----------------------
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
