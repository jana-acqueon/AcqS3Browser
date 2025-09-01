// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';

import * as path from 'path';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Effect, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

// Add debugging logs
console.log('Initializing Amplify backend...');

const backend = defineBackend({ auth });

// ===============================
// Import existing bucket (env vars)
// ===============================
const bucketStack = backend.createStack('custom-bucket-stack');

console.log('Reading S3 bucket environment variables...');
const bucketName = process.env.MY_CUSTOM_BUCKET_NAME!.trim();
const bucketRegion = process.env.MY_CUSTOM_BUCKET_REGION!.trim();
console.log(`Using bucket: ${bucketName} in region: ${bucketRegion}`);

const customBucket = Bucket.fromBucketName(bucketStack, 'MyCustomBucket', bucketName);

// ===============================
// Lambda (Node.js 20) + API Gateway (CDK)
// ===============================
const lambdaStack = backend.createStack('s3-access-handler-stack');

console.log('Configuring Lambda function for S3 access...');
const s3AccessHandler = new NodejsFunction(lambdaStack, 'S3AccessHandler', {
  entry: path.join(__dirname, 'functions', 's3AccessHandler', 'index.ts'),
  handler: 'handler',
  runtime: Runtime.NODEJS_20_X,
  bundling: {
    externalModules: [], // bundle everything by default
    target: 'node20',
  },
  environment: {
    MY_CUSTOM_BUCKET_NAME: bucketName,
    MY_CUSTOM_BUCKET_REGION: bucketRegion,

    // DB connection envs - set real values in Amplify console or CI secrets
    DB_HOST: process.env.DB_HOST ?? '',
    DB_USER: process.env.DB_USER ?? '',
    DB_PASS: process.env.DB_PASS ?? '',
    DB_NAME: process.env.DB_NAME ?? '',
  },
});

console.log('Attaching S3 permissions to Lambda...');
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

// REST API
console.log('Creating API Gateway REST API...');
const api = new apigw.RestApi(lambdaStack, 'S3AccessApi', {
  restApiName: 'S3AccessApi',
  deployOptions: { stageName: 'prod' },
});

// POST /s3access
console.log('Adding /s3access POST method to API Gateway...');
const s3access = api.root.addResource('s3access');
s3access.addMethod(
  'POST',
  new apigw.LambdaIntegration(s3AccessHandler, { proxy: true }),
  {
    // OPTIONAL: add a Cognito authorizer here if you want API Gateway to reject unauthenticated clients
    // otherwise Lambda will validate the token itself.
  }
);

// ===============================
// (Optional) Broad IAM policies for your Cognito groups
// (fine-grained folder rules still enforced by Lambda + SQL at runtime)
// ===============================
const { groups } = backend.auth.resources;

console.log('Attaching IAM policies to Cognito groups...');
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

// ===============================
// Outputs for frontend (amplify_outputs.json)
// ===============================
console.log('Adding outputs for frontend...');
backend.addOutput({
  storage: {
    aws_region: bucketRegion,
    bucket_name: customBucket.bucketName,
  },
  custom: {
    s3AccessApiUrl: api.url, // <--- we’ll read this in App.tsx
  },
});

console.log('Amplify backend setup complete.');

export default backend;
