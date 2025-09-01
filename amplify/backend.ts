// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';

import * as path from 'path';
import { fileURLToPath } from 'url';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement, Effect, Policy } from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

// -------------------------
// ESM-safe __dirname
// -------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------
// Define backend
// -------------------------
const backend = defineBackend({ auth });

// -------------------------
// Import existing bucket
// -------------------------
const bucketStack = backend.createStack('custom-bucket-stack');
const bucketName = process.env.MY_CUSTOM_BUCKET_NAME!.trim();
const bucketRegion = process.env.MY_CUSTOM_BUCKET_REGION!.trim();
const customBucket = Bucket.fromBucketName(bucketStack, 'MyCustomBucket', bucketName);

// -------------------------
// Lambda + API Gateway
// -------------------------
const lambdaStack = backend.createStack('s3-access-handler-stack');

const s3AccessHandler = new NodejsFunction(lambdaStack, 'S3AccessHandler', {
  entry: path.resolve(__dirname, 'functions/s3AccessHandler/index.ts'),
  handler: 'handler',
  runtime: Runtime.NODEJS_20_X,
  bundling: {
    externalModules: [],
    target: 'node20',
  },
  environment: {
    MY_CUSTOM_BUCKET_NAME: bucketName,
    MY_CUSTOM_BUCKET_REGION: bucketRegion,
    DB_HOST: '', // populate via Amplify secrets
    DB_USER: '',
    DB_PASS: '',
    DB_NAME: '',
  },
});

// Attach S3 permissions for Lambda
s3AccessHandler.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
    resources: [`${customBucket.bucketArn}/*`],
  })
);
s3AccessHandler.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['s3:ListBucket', 's3:GetBucketLocation'],
    resources: [customBucket.bucketArn],
  })
);

// API Gateway
const api = new apigw.RestApi(lambdaStack, 'S3AccessApi', {
  restApiName: 'S3AccessApi',
  deployOptions: { stageName: 'prod' },
});

const s3access = api.root.addResource('s3access');
s3access.addMethod(
  'POST',
  new apigw.LambdaIntegration(s3AccessHandler, { proxy: true })
);

// -------------------------
// Attach IAM policies to Cognito groups
// -------------------------
const { groups } = backend.auth.resources;

if (groups['ReadOnly'] && groups['Contributor'] && groups['Administrator']) {
  const readOnlyPolicy = new Policy(backend.stack, 'ReadOnlyPolicy', {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:ListBucket', 's3:GetObject'],
        resources: [customBucket.bucketArn, `${customBucket.bucketArn}/*`],
      }),
    ],
  });

  const contributorPolicy = new Policy(backend.stack, 'ContributorPolicy', {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject'],
        resources: [customBucket.bucketArn, `${customBucket.bucketArn}/*`],
      }),
    ],
  });

  const adminPolicy = new Policy(backend.stack, 'AdminPolicy', {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [customBucket.bucketArn, `${customBucket.bucketArn}/*`],
      }),
    ],
  });

  groups['ReadOnly'].role.attachInlinePolicy(readOnlyPolicy);
  groups['Contributor'].role.attachInlinePolicy(contributorPolicy);
  groups['Administrator'].role.attachInlinePolicy(adminPolicy);
}

// -------------------------
// Outputs for frontend
// -------------------------
backend.addOutput({
  storage: {
    aws_region: bucketRegion,
    bucket_name: customBucket.bucketName,
  },
  custom: {
    s3AccessApiUrl: api.url,
  },
});

export default backend;
