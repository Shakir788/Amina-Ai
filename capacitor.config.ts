import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amina.app',
  appName: 'Amina',
  webDir: 'out',
  server: {
    url: 'http://127.0.0.1:3000', // Android emulator ke liye localhost mapping
    cleartext: true
  }
};

export default config;