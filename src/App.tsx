import {
  createAmplifyAuthAdapter,
  createStorageBrowser,
} from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';

import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import {
  Authenticator,
  Button,
  Image,
  View,
  ThemeProvider,
} from '@aws-amplify/ui-react';

Amplify.configure(config);

const { StorageBrowser } = createStorageBrowser({
  config: createAmplifyAuthAdapter(),
});

// Custom Auth Header (login page)
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

// Custom theme (brand colors)
const customTheme = {
  name: 'custom-theme',
  tokens: {
    colors: {
      brand: {
        primary: {
          80: '#1E40AF',
          90: '#1D4ED8',
          100: '#1E3A8A',
        },
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
    radii: {
      small: '6px',
      medium: '10px',
    },
  },
};

function App() {
  return (
    <ThemeProvider theme={customTheme} colorMode="light">
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <Authenticator
          hideSignUp={true}
          components={{ Header: CustomAuthHeader }}>
          {({ signOut, user }) => (
            <div className="flex flex-col flex-1 w-full min-h-screen">
              {/* Boxy Admin Header */}
              <header className="bg-white shadow-md rounded-b-xl border-b border-gray-300 sticky top-0 z-50">
                <div className="w-full flex items-center justify-between px-8 py-4">
                  {/* Left: Logo + Portal Title */}
                  <div className="flex items-center gap-4">
                    <img
                      src="https://acqueon.com/wp-content/uploads/2025/04/Acqueon-Logo.svg"
                      alt="Acqueon Logo"
                      className="h-12"
                    />
                  </div>

                  {/* Right: Username + Sign Out */}
                  <div className="flex items-center gap-4">
                    <span className="text-gray-700 font-medium">{user?.signInDetails?.loginId}</span>
                    <Button size="small" variation="primary" onClick={signOut}>
                      Sign out
                    </Button>
                  </div>
                </div>
              </header>

              {/* Main Content */}
              <main className="flex-1 w-full flex justify-center items-start p-6">
                <div className="w-full max-w-4xl bg-white rounded-xl shadow-md p-6">
                  {/* <Heading level={4} className="mb-4 text-gray-700">
                    File Storage
                  </Heading> */}
                  <StorageBrowser />
                </div>
              </main>

              {/* Footer */}
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
