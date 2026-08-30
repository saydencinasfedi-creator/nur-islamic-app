import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fedi.nur',
  appName: 'Nur',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#11d483',
    },
  },
};

export default config;
