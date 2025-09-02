// amplify/auth/resource.ts

import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // These groups must match the keys in accessConfig.ts
  groups: ['Administrator', 'Contributor', 'LimitedContributor'],
});