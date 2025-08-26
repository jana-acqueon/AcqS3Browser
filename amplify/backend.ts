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
const bucketName = process.env.MY_CUSTOM_BUCKET_NAME!.trim();;
const bucketRegion = process.env.MY_CUSTOM_BUCKET_REGION!.trim();;

// Import the existing bucket by name
const customBucket = Bucket.fromBucketName(
  customBucketStack,
  "MyCustomBucket",
  bucketName
);

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
            guest: ["get", "list"],
            authenticated: ["get", "list", "write", "delete"],
          },
        },
      },
    ],
  },
});

/*
  Define an inline policy to attach to Amplify's auth role
  This policy defines how authenticated users can access your existing bucket
*/
const authPolicy = new Policy(backend.stack, "customBucketAuthPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      resources: [`arn:aws:s3:::${bucketName}/*`],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [`arn:aws:s3:::${bucketName}`],
    }),
  ],
});

// Attach policy to authenticated role
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(authPolicy);
