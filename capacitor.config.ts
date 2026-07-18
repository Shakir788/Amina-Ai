import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amina.app',
  appName: 'Amina',
  webDir: 'out',
  server: {
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true 
    }
  }
};

export default config;