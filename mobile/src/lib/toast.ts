import Toast from 'react-native-toast-message';

export const showSuccess = (title: string, message?: string) =>
  Toast.show({ type: 'success', text1: title, text2: message, position: 'top', visibilityTime: 2500 });

export const showError = (title: string, message?: string) =>
  Toast.show({ type: 'error', text1: title, text2: message, position: 'top', visibilityTime: 3500 });

export const showWarning = (title: string, message?: string) =>
  Toast.show({ type: 'warning', text1: title, text2: message, position: 'top', visibilityTime: 3000 });

export const showInfo = (title: string, message?: string) =>
  Toast.show({ type: 'info', text1: title, text2: message, position: 'top', visibilityTime: 2500 });
