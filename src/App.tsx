// src/App.tsx
import {
  createAmplifyAuthAdapter,
  createStorageBrowser,
} from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';

import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
  Authenticator,
  Button,
  Image,
  View,
  ThemeProvider,
} from '@aws-amplify/ui-react';

Amplify.configure(config);

// Read API URL that we exposed from backend.addOutput()
const API_URL = (config as any)?.custom?.s3AccessApiUrl as string;

// Custom adapter calls our Lambda-backed API for presigned URLs
const customAdapter = {
  async getPresignedUrl({
    path,
    operation,
  }: {
    path: string;
    operation: 'get' | 'put' | 'delete';
  }) {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const resp = await fetch(`${API_URL}prod/s3access`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: operation, key: path }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API error ${resp.status}: ${text}`);
    }

    const data: unknown = await resp.json();
    if (!data || typeof data !== 'object' || !('url' in data)) {
      throw new Error('Invalid API response: missing url');
    }
    return (data as { url: string }).url;
  },
};

const { StorageBrowser } = createStorageBrowser({
  config: {
    ...createAmplifyAuthAdapter(), // required for Auth integration
    ...customAdapter,              // override URL generation
  },
});

// Custom Auth Header (logo)
function CustomAuthHeader() {
  return (
    <View textAlign="center" padding="medium">
      <Image
        alt="Acqueon Logo"
        src="https://acqueon.com/wp-content/uploads/2025/04/Acqueon-Logo.svg"
        height="60px"
        className="mx-auto mb-4"
      />
    </View>
  );
}

// Theme
const customTheme = {
  name: 'custom-theme',
  tokens: {
    colors: {
      brand: {
        primary: { 80: '#1E40AF', 90: '#1D4ED8', 100: '#1E3A8A' },
      },
    },
    components: {
      button: {
        primary: {
          backgroundColor: '{colors.brand.primary.80}',
          _hover: { backgroundColor: '{colors.brand.primary.90}' },
        },
      },
    },
    radii: { small: '6px', medium: '10px' },
  },
};

function App() {
  return (
    <ThemeProvider theme={customTheme} colorMode="light">
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Authenticator hideSignUp components={{ Header: CustomAuthHeader }}>
          {({ signOut, user }) => (
            <div className="flex flex-col flex-1 w-full min-h-screen">
              <header className="bg-white shadow-md rounded-b-xl border-b border-gray-300 sticky top-0 z-50">
                <div className="w-full flex items-center justify-between px-8 py-4">
                  <div className="flex items-center gap-4">
                    <img
                      src="https://acqueon.com/wp-content/uploads/2025/04/Acqueon-Logo.svg"
                      alt="Acqueon Logo"
                      className="h-12"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-700 font-medium">
                      {user?.signInDetails?.loginId}
                    </span>
                    <Button size="small" variation="primary" onClick={signOut}>
                      Sign out
                    </Button>
                  </div>
                </div>
              </header>

              <main className="flex-1 w-full flex justify-center items-start p-6">
                <div className="w-full max-w-4xl bg-white rounded-xl shadow-md p-6">
                  <StorageBrowser />
                </div>
              </main>

              <footer className="bg-white border-t border-gray-200 text-center text-sm text-gray-500 py-4">
                © {new Date().getFullYear()} Acqueon. All rights reserved.
              </footer>
            </div>
          )}
        </Authenticator>
      </div>
    </ThemeProvider>
  );
}

export default App;
