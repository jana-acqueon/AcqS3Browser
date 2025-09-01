import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";

const backend = defineBackend({
  auth,
});

// Create a stack for your custom bucket resources
const customBucketStack = backend.createStack("custom-bucket-stack");

// Use bucket name from environment variable instead of ARN
const bucketName = process.env.MY_CUSTOM_BUCKET_NAME!.trim();
const bucketRegion = process.env.MY_CUSTOM_BUCKET_REGION!.trim();

// Import existing bucket
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
          "": {
            groupsReadOnly: ["list"],
            groupsContributor: ["get", "list", "write"],
            groupsAdmin: ["get", "list", "write", "delete"],
          },
        },
      }
    ]
  },
});


const authPolicy_ReadOnly = new Policy(backend.stack, "ReadOnly_AuthPolicy", {
  statements: [

    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [
        `${customBucket.bucketArn}`,
        `${customBucket.bucketArn}/*`
      ],
    }),
  ],
});

const authPolicy_Contributor = new Policy(backend.stack, "Contributor_AuthPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "s3:GetObject",
        "s3:PutObject"
      ],
      resources: [`${customBucket.bucketArn}/*`,],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [
        `${customBucket.bucketArn}`,
        `${customBucket.bucketArn}/*`
      ],
    }),
  ],
});

const authPolicy_Admin = new Policy(backend.stack, "Admin_AuthPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      resources: [`${customBucket.bucketArn}/*`,],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [
        `${customBucket.bucketArn}`,
        `${customBucket.bucketArn}/*`
      ],
    }),
  ],
});

const { groups } = backend.auth.resources

// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.IRole.html
groups["ReadOnly"].role.attachInlinePolicy(authPolicy_ReadOnly);
groups["Contributor"].role.attachInlinePolicy(authPolicy_Contributor);
groups["Admin"].role.attachInlinePolicy(authPolicy_Admin);