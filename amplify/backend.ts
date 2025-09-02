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

// ---------------------- Outputs for frontend ----------------------
backend.addOutput({
  storage: {
    aws_region: bucketRegion,
    bucket_name: customBucket.bucketName,
    buckets: [
      {
        aws_region: bucketRegion,
        bucket_name: customBucket.bucketName,
        name: customBucket.bucketName,
        paths: {
          "IMServUAT/": {
            groupsAdministrator: ["get", "list", "write", "delete"],
            groupsContributor: ["get", "list", "write"],
            groupsLimitedContributor: ["get", "list"], // only files in root
          },
          "IMServUAT/PreProcAutoupload": {
            groupsAdministrator: ["get", "list", "write", "delete"],
            groupsContributor: ["get", "list", "write"],
            groupsLimitedContributor: ["get", "list", "write"],
          },
          "IMServUAT/DataExtract": {
            groupsAdministrator: ["get", "list", "write", "delete"],
            groupsContributor: ["get", "list", "write"],
            groupsLimitedContributor: ["get", "list", "write"],
          },
        },
      },
    ],
  },
});

// ---------------------- IAM Policies ----------------------

// Administrator: full access to IMServUAT
const authPolicy_Administrator = new Policy(customBucketStack, "Administrator_AuthPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      resources: [`${customBucket.bucketArn}/IMServUAT/*`],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: { StringLike: { "s3:prefix": ["IMServUAT/*"] } },
    }),
  ],
});

// Contributor: upload + list only, no delete
const authPolicy_Contributor = new Policy(customBucketStack, "Contributor_AuthPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject"],
      resources: [`${customBucket.bucketArn}/IMServUAT/*`],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: { StringLike: { "s3:prefix": ["IMServUAT/*"] } },
    }),
  ],
});

// LimitedContributor: see files in IMServUAT root + full access to two subfolders
const authPolicy_LimitedContributor = new Policy(customBucketStack, "LimitedContributor_AuthPolicy", {
  statements: [
    // List & get files in root of IMServUAT
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject"],
      resources: [
        `${customBucket.bucketArn}/IMServUAT/*`, // root files
        `${customBucket.bucketArn}/IMServUAT/PreProcAutoupload/*`,
        `${customBucket.bucketArn}/IMServUAT/DataExtract/*`,
      ],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: {
        StringLike: {
          "s3:prefix": [
            "IMServUAT/", // root files
            "IMServUAT/PreProcAutoupload/*",
            "IMServUAT/DataExtract/*",
          ],
        },
      },
    }),
    // Write access only to the two subfolders
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:PutObject"],
      resources: [
        `${customBucket.bucketArn}/IMServUAT/PreProcAutoupload/*`,
        `${customBucket.bucketArn}/IMServUAT/DataExtract/*`,
      ],
    }),
  ],
});

// ---------------------- Attach policies to groups ----------------------
const { groups } = backend.auth.resources;

groups["Administrator"].role.attachInlinePolicy(authPolicy_Administrator);
groups["Contributor"].role.attachInlinePolicy(authPolicy_Contributor);
groups["LimitedContributor"].role.attachInlinePolicy(authPolicy_LimitedContributor);
