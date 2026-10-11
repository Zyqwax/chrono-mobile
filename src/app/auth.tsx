import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { AuthScreen } from '../components/AuthScreen';
import { useChatStore } from '../store/useChatStore';

export default function AuthRoute() {
  const router = useRouter();
  const { currentUser } = useChatStore();

  useEffect(() => {
    if (currentUser) {
      router.replace('/(tabs)');
    }
  }, [currentUser]);

  return <AuthScreen />;
}
