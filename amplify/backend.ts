import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";

const backend = defineBackend({ auth });

const customBucketStack = backend.createStack("custom-bucket-stack");

// const bucketName = process.env.BUCKET_NAME?.trim();
// const bucketRegion = process.env.BUCKET_REGION?.trim();
// const rootfolderName = process.env.ROOT_FOLDER_NAME?.trim();

const bucketName = 'aec-imserv-uat-bkt';
const bucketRegion = 'us-east-1';
const rootfolderName = "IMServUAT";

if (!bucketName || !bucketRegion || !rootfolderName) {
  throw new Error("Missing required environment variables: CUSTOM_BUCKET_NAME or CUSTOM_BUCKET_REGION or ROOT_FOLDER_NAME");
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
          [`${rootfolderName}/*`]: {
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
      resources: [`${customBucket.bucketArn}/*`],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [customBucket.bucketArn],
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
        `${customBucket.bucketArn}/${rootfolderName}/*`,
        `${customBucket.bucketArn}/${rootfolderName}/PreProcAutoupload/*`,
        `${customBucket.bucketArn}/${rootfolderName}/DataExtract/*`,
      ],
    }),
    // Write access only to allowed subfolders
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:PutObject"],
      resources: [
        `${customBucket.bucketArn}/${rootfolderName}/PreProcAutoupload/*`,
        `${customBucket.bucketArn}/${rootfolderName}/DataExtract/*`,
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
            `${rootfolderName}/`,
            `${rootfolderName}/PreProcAutoupload/`,
            `${rootfolderName}/DataExtract/`,
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
