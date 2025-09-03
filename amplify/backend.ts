import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";

const backend = defineBackend({ auth });

const customBucketStack = backend.createStack("custom-bucket-stack");

const bucketName = process.env.MY_CUSTOM_BUCKET_NAME?.trim();
const bucketRegion = process.env.MY_CUSTOM_BUCKET_REGION?.trim();

if (!bucketName || !bucketRegion) {
  throw new Error("Missing required environment variables: MY_CUSTOM_BUCKET_NAME or MY_CUSTOM_BUCKET_REGION");
}

const customBucket = Bucket.fromBucketName(customBucketStack, "MyCustomBucket", bucketName);

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
          "IMServUAT/*": {
            groupsAdministrator: ["get", "list", "write", "delete"],
            groupsContributor: ["get", "list", "write"],
          },
          "IMServUAT/PreProcAutoupload/*": {
            groupsLimitedContributor: ["get", "list", "write"],
          },
          "IMServUAT/DataExtract/*": {
            groupsLimitedContributor: ["get", "list", "write"],
          },
        },
      },
    ],
  },
});

// ---------------------- IAM Policies ----------------------

const authPolicy_Administrator = new Policy(backend.stack, "Administrator_AuthPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      resources: [`${customBucket.bucketArn}/*`],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
    }),
  ],
});

const authPolicy_Contributor = new Policy(backend.stack, "Contributor_AuthPolicy", {
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
      conditions: {
        StringLike: {
          "s3:prefix": ["IMServUAT/"],
        },
      },
    }),
  ],
});

const authPolicy_LimitedContributor = new Policy(backend.stack, "LimitedContributor_AuthPolicy", {
  statements: [
    // Get access to root files and allowed subfolders
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject"],
      resources: [
        `${customBucket.bucketArn}/IMServUAT/*`,
        `${customBucket.bucketArn}/IMServUAT/PreProcAutoupload/*`,
        `${customBucket.bucketArn}/IMServUAT/DataExtract/*`,
      ],
    }),
    // Write access only to allowed subfolders
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:PutObject"],
      resources: [
        `${customBucket.bucketArn}/IMServUAT/PreProcAutoupload/*`,
        `${customBucket.bucketArn}/IMServUAT/DataExtract/*`,
      ],
    }),
    // List only specific prefixes
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
      conditions: {
        StringLike: {
          "s3:prefix": [
            "IMServUAT/",
            "IMServUAT/PreProcAutoupload/",
            "IMServUAT/DataExtract/",
          ],
        },
      },
    }),
  ],
});

// ---------------------- Attach policies to groups ----------------------

const { groups } = backend.auth.resources;

groups["Administrator"].role.attachInlinePolicy(authPolicy_Administrator);
groups["Contributor"].role.attachInlinePolicy(authPolicy_Contributor);
groups["LimitedContributor"].role.attachInlinePolicy(authPolicy_LimitedContributor);